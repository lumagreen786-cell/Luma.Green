import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const configuration = vi.hoisted(() => ({
  NEXT_PUBLIC_TELEMETRY_ENABLED: true,
  NEXT_PUBLIC_VERCEL_ANALYTICS_ENABLED: true,
}));
vi.mock("./env", () => ({ clientEnv: configuration }));
const sdk = vi.hoisted(() => ({ inject: vi.fn(), pageview: vi.fn() }));
vi.mock("@vercel/analytics", () => sdk);

beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
  configuration.NEXT_PUBLIC_TELEMETRY_ENABLED = true;
  configuration.NEXT_PUBLIC_VERCEL_ANALYTICS_ENABLED = true;
  localStorage.clear();
  vi.stubGlobal("window", {
    location: new URL("https://business.luma.green/"),
  });
  vi.spyOn(document, "referrer", "get").mockReturnValue("");
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("Vercel public URL boundary", () => {
  it.each([
    "https://luma.green/",
    "https://www.luma.green/ar/help",
    "https://business.luma.green/",
    "https://business.luma.green/business/collectors",
  ])("accepts exact approved public URL %s", async (url) => {
    const { isVercelPublicUrl } = await import("./vercel-analytics");
    expect(isVercelPublicUrl(url)).toBe(true);
  });
  it.each([
    "https://luma.green/?phone=secret",
    "https://luma.green/#token=secret",
    "https://luma.green/login",
    "https://business.luma.green/app",
    "https://business.luma.green/business/private-id",
    "https://external.invalid/",
    "https://luma.green.attacker.invalid/",
    // Rejection fixture: an insecure scheme must never load analytics.
    // eslint-disable-next-line sonarjs/no-clear-text-protocols, unicorn/prefer-https
    "http://luma.green/",
    "https://user:secret@luma.green/",
    "not-a-url",
  ])("rejects unsafe URL %s", async (url) => {
    const { isVercelPublicUrl } = await import("./vercel-analytics");
    expect(isVercelPublicUrl(url)).toBe(false);
  });
});

it.each([
  "flag off",
  "telemetry off",
  "denied",
  "private",
  "query",
  "fragment",
  "referrer",
])("does not inject or queue when %s", async (gate) => {
  switch (gate) {
    case "flag off": {
      configuration.NEXT_PUBLIC_VERCEL_ANALYTICS_ENABLED = false;
      break;
    }
    case "telemetry off": {
      configuration.NEXT_PUBLIC_TELEMETRY_ENABLED = false;
      break;
    }
    case "denied": {
      localStorage.setItem("luma.analytics.v1", "denied");
      break;
    }
    case "private": {
      window.location.pathname = "/app";
      break;
    }
    case "query": {
      window.location.search = "?utm_source=secret";
      break;
    }
    case "fragment": {
      window.location.hash = "#token=secret";
      break;
    }
    case "referrer": {
      {
        vi.spyOn(document, "referrer", "get").mockReturnValue(
          "https://luma.green/login?token=secret",
        );
        // No default
      }
      break;
    }
  }
  const { recordVercelPageView } = await import("./vercel-analytics");
  await recordVercelPageView("/business");
  expect(sdk.inject).not.toHaveBeenCalled();
  expect(sdk.pageview).not.toHaveBeenCalled();
});

it("uses manual canonical pageviews and blocks delayed delivery after withdrawal or navigation", async () => {
  const { recordVercelPageView, beforeVercelSend } =
    await import("./vercel-analytics");
  await recordVercelPageView("/business");
  expect(sdk.inject).toHaveBeenCalledWith({
    disableAutoTrack: true,
    debug: false,
    beforeSend: beforeVercelSend,
  });
  expect(sdk.pageview).toHaveBeenCalledWith({
    route: "/business",
    path: "/business",
  });
  const event = {
    type: "pageview" as const,
    url: "https://business.luma.green/",
  };
  expect(beforeVercelSend(event)).toEqual({
    type: "pageview",
    url: "https://business.luma.green/business",
  });
  expect(beforeVercelSend({ ...event, type: "event" })).toBeNull();
  expect(
    beforeVercelSend({
      ...event,
      url: "https://business.luma.green/?secret=1",
    }),
  ).toBeNull();
  expect(
    beforeVercelSend({ ...event, url: "https://business.luma.green/prices" }),
  ).toBeNull();
  localStorage.setItem("luma.analytics.v1", "denied");
  expect(beforeVercelSend(event)).toBeNull();
  localStorage.setItem("luma.analytics.v1", "granted");
  window.location.pathname = "/app";
  expect(beforeVercelSend(event)).toBeNull();
});

it("rechecks consent before injecting an asynchronously imported SDK", async () => {
  const { recordVercelPageView } = await import("./vercel-analytics");
  const pending = recordVercelPageView("/business");
  localStorage.setItem("luma.analytics.v1", "denied");
  await pending;
  expect(sdk.inject).not.toHaveBeenCalled();
  expect(sdk.pageview).not.toHaveBeenCalled();
});

it.each(["", "{}", '{"userId":"private"}'])(
  "blocks any stored attribution value %s",
  async (value) => {
    localStorage.setItem("__va_attribution", value);
    const { recordVercelPageView } = await import("./vercel-analytics");
    await recordVercelPageView("/business");
    expect(sdk.inject).not.toHaveBeenCalled();
  },
);
it("blocks attribution added after loading and storage exceptions at send time", async () => {
  const { recordVercelPageView, beforeVercelSend } =
    await import("./vercel-analytics");
  await recordVercelPageView("/business");
  const event = {
    type: "pageview" as const,
    url: "https://business.luma.green/",
  };
  localStorage.setItem("__va_attribution", '{"userId":"private"}');
  expect(beforeVercelSend(event)).toBeNull();
  localStorage.removeItem("__va_attribution");
  vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
    throw new Error("storage blocked");
  });
  expect(beforeVercelSend(event)).toBeNull();
});
