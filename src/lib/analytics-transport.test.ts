import { afterEach, expect, it, vi } from "vitest";

vi.mock("./env", () => ({
  clientEnv: {
    NEXT_PUBLIC_TELEMETRY_ENABLED: true,
    NEXT_PUBLIC_POSTHOG_KEY: "phc_transport_test_only",
    NEXT_PUBLIC_POSTHOG_HOST: "https://us.i.posthog.com",
  },
}));
vi.mock("./vercel-analytics", () => ({ recordVercelPageView: vi.fn() }));

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

it("aborts a pending count on withdrawal, resumes safely and never retries a failed count", async () => {
  localStorage.clear();
  sessionStorage.clear();
  window.history.replaceState(
    {},
    "",
    "/en/prices?phone=private-value#private-token",
  );
  const requests: { url: string; options: RequestInit }[] = [];
  const transport = vi.fn((url: string, options: RequestInit = {}) => {
    requests.push({ url, options });
    if (requests.length === 1) {
      return new Promise<Response>((_resolve, reject) => {
        options.signal?.addEventListener(
          "abort",
          () => {
            reject(new DOMException("Aborted", "AbortError"));
          },
          { once: true },
        );
      });
    }
    return Promise.resolve(new Response("{}", { status: 500 }));
  });
  vi.stubGlobal("fetch", transport);
  vi.spyOn(console, "warn").mockImplementation(() => {
    // The deliberately failed request is asserted below.
  });
  const { recordPageView, resumeAnalytics, stopAnalytics } =
    await import("./analytics-runtime");
  resumeAnalytics();
  const pending = recordPageView("/prices", "en");
  await vi.waitFor(() => {
    expect(requests).toHaveLength(1);
  });
  const original = requests[0]?.options.signal;
  expect(original).toBeDefined();
  expect(original?.aborted).toBe(false);
  localStorage.setItem("luma.analytics.v1", "denied");
  stopAnalytics();
  expect(original?.aborted).toBe(true);
  try {
    await pending;
  } catch {
    // An aborted count is allowed to reject; the provider handles transport failure.
  }
  await recordPageView("/prices", "en");
  expect(requests).toHaveLength(1);

  localStorage.removeItem("luma.analytics.v1");
  window.history.replaceState({}, "", "/en/help");
  resumeAnalytics();
  vi.useFakeTimers();
  try {
    await recordPageView("/help", "en");
  } catch {
    // This response deliberately returns HTTP 500.
  }
  expect(requests).toHaveLength(2);
  const resumed = requests[1]?.options.signal;
  expect(resumed).not.toBe(original);
  expect(resumed?.aborted).toBe(false);
  expect(original?.aborted).toBe(true);

  await vi.advanceTimersByTimeAsync(60_000);
  expect(requests).toHaveLength(2);
  for (const { url, options } of requests) {
    expect(url).toBe("https://us.i.posthog.com/capture/");
    expect(options.credentials).toBe("omit");
    expect(options.referrerPolicy).toBe("no-referrer");
    expect(options.keepalive).not.toBe(true);
    expect(typeof options.body).toBe("string");
    expect(options.body).not.toMatch(/private-value|private-token|phone=/);
  }
  expect(localStorage).toHaveLength(0);
  expect(sessionStorage).toHaveLength(0);
  stopAnalytics();
}, 15_000);
