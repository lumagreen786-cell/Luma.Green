// @vitest-environment edge-runtime
import { convexTest } from "convex-test";
import { afterEach, expect, it, vi } from "vitest";

import { internal } from "./_generated/api";
import { convexModules } from "./lib/auth.testing";
import schema from "./schema";

const modules = convexModules(import.meta.glob("./**/*.*s"));
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

it.each([true, false])(
  "preserves provider acceptance=%s when the status mutation fails",
  async (accepted) => {
    vi.stubEnv("OSDIGITAL_API_KEY", "");
    vi.stubEnv("MSG91_AUTH_KEY", "key");
    vi.stubEnv("MSG91_OTP_TEMPLATE_ID", "template");
    const fetch = vi
      .fn()
      .mockResolvedValue(
        Response.json({ type: accepted ? "success" : "error" }),
      );
    vi.stubGlobal("fetch", fetch);
    const warning = vi.spyOn(console, "warn").mockImplementation(() => {
      // Capture the sanitized warning without writing it to test output.
    });
    const t = convexTest(schema, modules);
    // Force the observation's unique-row query to fail, after the provider call.
    await t.run(async (ctx) => {
      for (const isAccepted of [true, false]) {
        await ctx.db.insert("serviceHealth", {
          service: "sms",
          accepted: isAccepted,
          observedAt: Date.now(),
        });
      }
    });
    const send = t.action(internal.sms.sendCode, {
      phone: "+919876543210",
      code: "123456",
    });
    if (accepted) await expect(send).resolves.toBeNull();
    else
      await expect(send).rejects.toThrow(
        /^SMS provider did not confirm acceptance\.$/,
      );
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(warning).toHaveBeenCalledWith(
      "SMS status observation could not be saved.",
    );
    expect(JSON.stringify(warning.mock.calls)).not.toMatch(
      /9876543210|123456|template|key/,
    );
  },
);
it("reports unconfigured SMS and returns no configuration or private data", async () => {
  vi.stubEnv("OSDIGITAL_API_KEY", "");
  vi.stubEnv("MSG91_AUTH_KEY", "");
  const t = convexTest(schema, modules);
  const response = await t.fetch("/health");
  expect(response.status).toBe(200);
  expect(response.headers.get("cache-control")).toBe("no-store");
  expect(await response.json()).toEqual({
    api: "up",
    sms: "unavailable",
    checkedAt: expect.any(Number),
    observedAt: null,
  });
});
it("distinguishes recent acceptance, failure, and stale evidence without sending SMS", async () => {
  vi.stubEnv("OSDIGITAL_API_KEY", "");
  vi.stubEnv("MSG91_AUTH_KEY", "key");
  vi.stubEnv("MSG91_OTP_TEMPLATE_ID", "template");
  const fetch = vi.fn();
  vi.stubGlobal("fetch", fetch);
  const t = convexTest(schema, modules);
  expect(
    await t.query(internal.serviceStatus.snapshot, { checkedAt: Date.now() }),
  ).toMatchObject({
    sms: "unknown",
  });
  await t.mutation(internal.serviceStatus.recordSms, { accepted: true });
  expect(
    await t.query(internal.serviceStatus.snapshot, { checkedAt: Date.now() }),
  ).toMatchObject({
    sms: "accepted",
  });
  const later = Date.now() + 16 * 60_000;
  expect(
    await t.query(internal.serviceStatus.snapshot, { checkedAt: later }),
  ).toMatchObject({ sms: "unknown", checkedAt: later });
  await t.mutation(internal.serviceStatus.recordSms, { accepted: false });
  expect(
    await t.query(internal.serviceStatus.snapshot, { checkedAt: Date.now() }),
  ).toMatchObject({
    sms: "failed",
  });
  await t.run(async (ctx) => {
    const row = await ctx.db.query("serviceHealth").first();
    if (row)
      await ctx.db.patch(row._id, { observedAt: Date.now() - 16 * 60_000 });
  });
  expect(
    await t.query(internal.serviceStatus.snapshot, { checkedAt: Date.now() }),
  ).toMatchObject({
    sms: "unknown",
  });
  expect(fetch).not.toHaveBeenCalled();
});
it("records provider rejection without persisting recipient or code", async () => {
  vi.stubEnv("OSDIGITAL_API_KEY", "");
  vi.stubEnv("MSG91_AUTH_KEY", "key");
  vi.stubEnv("MSG91_OTP_TEMPLATE_ID", "template");
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue(Response.json({ type: "error" })),
  );
  const t = convexTest(schema, modules);
  await expect(
    t.action(internal.sms.sendCode, { phone: "+919876543210", code: "123456" }),
  ).rejects.toThrow("SMS provider did not confirm acceptance");
  const rows = await t.run((ctx) => ctx.db.query("serviceHealth").collect());
  expect(rows).toHaveLength(1);
  expect(rows[0]).toMatchObject({ service: "sms", accepted: false });
  expect(JSON.stringify(rows)).not.toMatch(/9876543210|123456|template|key/);
});
