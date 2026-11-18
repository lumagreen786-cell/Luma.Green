import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const configuration = vi.hoisted(() => ({
  NEXT_PUBLIC_TELEMETRY_ENABLED: true,
  NEXT_PUBLIC_POSTHOG_KEY: "phc_test_only",
  NEXT_PUBLIC_POSTHOG_HOST: "https://us.i.posthog.com",
  NEXT_PUBLIC_GA_MEASUREMENT_ID: "G-TESTONLY",
}));
vi.mock("./env", () => ({ clientEnv: configuration }));
const vercel = vi.hoisted(() => vi.fn(() => Promise.resolve()));
vi.mock("./vercel-analytics", () => ({ recordVercelPageView: vercel }));
const fetcher = vi.fn<typeof fetch>();
function requestBody() {
  const body = fetcher.mock.calls[0]?.[1]?.body;
  if (typeof body !== "string") throw new Error("Expected JSON request body");
  return body;
}
beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
  configuration.NEXT_PUBLIC_TELEMETRY_ENABLED = true;
  configuration.NEXT_PUBLIC_POSTHOG_KEY = "phc_test_only";
  configuration.NEXT_PUBLIC_POSTHOG_HOST = "https://us.i.posthog.com";
  localStorage.clear();
  window.history.replaceState({}, "", "/prices");
  fetcher.mockResolvedValue(new Response("{}", { status: 200 }));
  vi.stubGlobal("fetch", fetcher);
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

it.each([
  "denied",
  "disabled",
  "private",
  "storage blocked",
  "missing key",
  "untrusted host",
])("sends no PostHog request when %s", async (gate) => {
  switch (gate) {
    case "denied": {
      localStorage.setItem("luma.analytics.v1", "denied");
      break;
    }
    case "disabled": {
      configuration.NEXT_PUBLIC_TELEMETRY_ENABLED = false;
      break;
    }
    case "private": {
      window.history.replaceState({}, "", "/app/trades/private");
      break;
    }
    case "storage blocked": {
      vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
        throw new Error("blocked");
      });
      break;
    }
    case "missing key": {
      configuration.NEXT_PUBLIC_POSTHOG_KEY = "";
      break;
    }
    case "untrusted host": {
      configuration.NEXT_PUBLIC_POSTHOG_HOST = "https://attacker.invalid";
      break;
    }
  }
  const { recordPageView } = await import("./analytics-runtime");
  await recordPageView("/prices", "en");
  expect(fetcher).not.toHaveBeenCalled();
});

it("automatically sends only the approved payload without cookies, referrer or persistent identity", async () => {
  window.history.replaceState({}, "", "/ar/prices?phone=private#token=private");
  const { recordPageView } = await import("./analytics-runtime");
  await recordPageView("/prices", "ar");
  expect(fetcher).toHaveBeenCalledExactlyOnceWith(
    "https://us.i.posthog.com/capture/",
    expect.objectContaining({
      method: "POST",
      credentials: "omit",
      referrerPolicy: "no-referrer",
      signal: expect.any(AbortSignal),
    }),
  );
  const body = requestBody();
  expect(JSON.parse(body)).toEqual({
    api_key: "phc_test_only",
    event: "$pageview",
    properties: {
      distinct_id: expect.any(String),
      $process_person_profile: false,
      $current_url: window.location.origin + "/prices",
      page: "/prices",
      locale: "ar",
    },
  });
  expect(localStorage).toHaveLength(0);
  expect(document.cookie).not.toContain("ph_");
  expect(
    document.head.querySelector('script[src*="googletagmanager"]'),
  ).toBeNull();
});

it("does not activate legacy Google settings even after a saved grant", async () => {
  configuration.NEXT_PUBLIC_POSTHOG_KEY = "";
  localStorage.setItem("luma.analytics.v1", "granted");
  const { recordPageView } = await import("./analytics-runtime");
  await recordPageView("/prices", "en");
  expect(fetcher).not.toHaveBeenCalled();
  expect(
    document.head.querySelector('script[src*="googletagmanager"]'),
  ).toBeNull();
});

it("rechecks choice and route after an asynchronous Vercel load", async () => {
  vercel.mockImplementationOnce(() => {
    localStorage.setItem("luma.analytics.v1", "denied");
    return Promise.resolve();
  });
  const { recordPageView } = await import("./analytics-runtime");
  await recordPageView("/prices", "en");
  expect(fetcher).not.toHaveBeenCalled();
  localStorage.removeItem("luma.analytics.v1");
  vercel.mockImplementationOnce(() => {
    window.history.replaceState({}, "", "/login");
    return Promise.resolve();
  });
  await recordPageView("/prices", "en");
  expect(fetcher).not.toHaveBeenCalled();
});

it("does not send stale caller paths and normalizes the business root", async () => {
  const { recordPageView } = await import("./analytics-runtime");
  await recordPageView("/help", "en");
  expect(fetcher).not.toHaveBeenCalled();
  vi.stubGlobal("window", {
    location: new URL("https://business.luma.green/ar?token=secret"),
  });
  await recordPageView("/business", "ar");
  expect(requestBody()).toContain(
    '"$current_url":"https://business.luma.green/business"',
  );
  expect(requestBody()).not.toContain("secret");
});

describe("PostHog destination boundary", () => {
  it.each(["https://us.i.posthog.com", "https://eu.i.posthog.com/"])(
    "accepts documented cloud origin %s",
    async (host) => {
      const { posthogCaptureUrl } = await import("./analytics-runtime");
      expect(posthogCaptureUrl(host)).toBe(new URL(host).origin + "/capture/");
    },
  );
  it.each([
    "https://us.i.posthog.com.attacker.invalid",
    "https://us.i.posthog.com/private",
    "https://user:secret@us.i.posthog.com",
    "https://us.i.posthog.com/?secret=1",
    "https://us.i.posthog.com/#secret",
    "invalid",
  ])("rejects %s", async (host) => {
    const { posthogCaptureUrl } = await import("./analytics-runtime");
    expect(posthogCaptureUrl(host)).toBeUndefined();
  });
});
