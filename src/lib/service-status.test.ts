import { afterEach, expect, it, vi } from "vitest";

import { readServiceStatus } from "./service-status";

afterEach(() => vi.unstubAllGlobals());
it("rejects unavailable, invalid and stale health responses", async () => {
  const signal = new AbortController().signal;
  for (const response of [
    new Response(null, { status: 503 }),
    Response.json({}),
    Response.json({
      api: "up",
      sms: "accepted",
      observedAt: null,
      checkedAt: Date.now() - 90_000,
    }),
  ]) {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response));
    await expect(
      readServiceStatus("https://test.convex.site/health", signal),
    ).rejects.toThrow();
  }
});
it("accepts a fresh snapshot without claiming SMS delivery", async () => {
  const data = {
    api: "up",
    sms: "unknown",
    observedAt: null,
    checkedAt: Date.now(),
  };
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json(data)));
  await expect(
    readServiceStatus(
      "https://test.convex.site/health",
      new AbortController().signal,
    ),
  ).resolves.toEqual(data);
});
