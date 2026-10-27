// @vitest-environment edge-runtime
import { convexTest } from "convex-test";
import { afterEach, expect, it, vi } from "vitest";

import { api } from "./_generated/api";
import { convexModules, registerAuth, signIn } from "./lib/auth.testing";
import schema from "./schema";

const modules = convexModules(import.meta.glob("./**/*.*s"));
const args = { lat: 12.97, lng: 77.59, language: "en", consent: true };
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  vi.useRealTimers();
});
async function setup(phone = "+919000000811") {
  vi.stubEnv("GOOGLE_GEOCODING_ENABLED", "true");
  vi.stubEnv("GOOGLE_GEOCODING_API_KEY", "test-google-key");
  const t = convexTest(schema, modules);
  registerAuth(t);
  const as = await signIn(t, {
    email: `${phone}@phone.luma.green`,
    phoneNumber: phone,
  });
  await as.mutation(api.identity.ensureProfile, { locale: "en" });
  return { t, as };
}
function provider() {
  const fetcher = vi.fn().mockImplementation(() =>
    Response.json({
      status: "OK",
      results: [{ formatted_address: "Synthetic test street" }],
    }),
  );
  vi.stubGlobal("fetch", fetcher);
  return fetcher;
}
it("requires a live verified phone and explicit consent before spending or calling Google", async () => {
  const { t, as } = await setup();
  const fetcher = provider();
  await expect(t.action(api.geocoding.reverse, args)).rejects.toThrow(
    "NOT_SIGNED_IN",
  );
  const unverified = await signIn(t, { email: "not-verified@example.test" });
  await expect(unverified.action(api.geocoding.reverse, args)).rejects.toThrow(
    "PHONE_REQUIRED",
  );
  await expect(
    as.action(api.geocoding.reverse, { ...args, consent: false }),
  ).rejects.toThrow("VALIDATION_REQUIRED");
  await expect(
    as.action(api.geocoding.reverse, { ...args, lat: 91 }),
  ).rejects.toThrow("VALIDATION_REQUIRED");
  expect(fetcher).not.toHaveBeenCalled();
});
it("stays unavailable with missing config and preserves allowance", async () => {
  const { t, as } = await setup();
  const fetcher = provider();
  vi.stubEnv("GOOGLE_GEOCODING_ENABLED", "false");
  expect(await as.action(api.geocoding.reverse, args)).toEqual({
    status: "unavailable",
  });
  expect(fetcher).not.toHaveBeenCalled();
  expect(
    await t.run((ctx) => ctx.db.query("geocodingAccountDays").take(1)),
  ).toEqual([]);
});
it("returns a transient preview, suppresses duplicate paid calls and stores no Google content or raw point", async () => {
  const { t, as } = await setup();
  const fetcher = provider();
  expect(await as.action(api.geocoding.reverse, args)).toEqual({
    status: "found",
    address: "Synthetic test street",
    allowAddressSave: false,
  });
  expect(await as.action(api.geocoding.reverse, args)).toEqual({
    status: "duplicate",
  });
  expect(fetcher).toHaveBeenCalledTimes(1);
  const url = fetcher.mock.calls[0][0] as URL;
  expect(url.origin + url.pathname).toBe(
    "https://maps.googleapis.com/maps/api/geocode/json",
  );
  const rows = await t.run((ctx) =>
    ctx.db.query("geocodingAccountDays").take(10),
  );
  expect(rows[0].used).toBe(1);
  const saved = JSON.stringify(rows);
  expect(saved).not.toContain("Synthetic test street");
  expect(saved).not.toContain("12.97");
  expect(saved).not.toContain("test-google-key");
});
it("bounds allowance per profile and blocks calls before provider transport", async () => {
  const { t, as } = await setup();
  const fetcher = provider();
  await as.action(api.geocoding.reverse, args);
  await t.run(async (ctx) => {
    const row = await ctx.db.query("geocodingAccountDays").first();
    if (!row) throw new Error("missing test quota");
    await ctx.db.patch("geocodingAccountDays", row._id, {
      used: 10,
      lastAt: 0,
    });
  });
  expect(await as.action(api.geocoding.reverse, { ...args, lat: 13 })).toEqual({
    status: "limit",
  });
  const other = await signIn(t, {
    email: "other@phone.luma.green",
    phoneNumber: "+919000000812",
  });
  await other.mutation(api.identity.ensureProfile, { locale: "en" });
  const otherResult = await other.action(api.geocoding.reverse, args);
  expect(otherResult.status).toBe("found");
  expect(fetcher).toHaveBeenCalledTimes(2);
});
it("consumes failed attempts without automatic retries and returns only a safe unavailable state", async () => {
  const { t, as } = await setup();
  const fetcher = vi
    .fn()
    .mockRejectedValue(new Error("private provider error"));
  vi.stubGlobal("fetch", fetcher);
  expect(await as.action(api.geocoding.reverse, args)).toEqual({
    status: "unavailable",
  });
  expect(await as.action(api.geocoding.reverse, args)).toEqual({
    status: "duplicate",
  });
  expect(fetcher).toHaveBeenCalledTimes(1);
  const usage = await t.run((ctx) =>
    ctx.db.query("geocodingAccountDays").take(1),
  );
  expect(usage[0].used).toBe(1);
});
it("rejects oversized and empty provider responses without retaining their payload", async () => {
  const { as } = await setup();
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue(new Response("x".repeat(200_001))),
  );
  expect(await as.action(api.geocoding.reverse, args)).toEqual({
    status: "unavailable",
  });
});

it("rejects a verified phone without a member profile before any paid request", async () => {
  const { t } = await setup();
  const caller = await signIn(t, {
    email: "no-profile@phone.luma.green",
    phoneNumber: "+919000000819",
  });
  const fetcher = provider();
  await expect(caller.action(api.geocoding.reverse, args)).rejects.toThrow(
    "NO_PROFILE",
  );
  expect(fetcher).not.toHaveBeenCalled();
});
it("reserves simultaneous duplicate requests once and paces new point requests", async () => {
  const { t, as } = await setup();
  const fetcher = provider();
  const results = await Promise.all([
    as.action(api.geocoding.reverse, args),
    as.action(api.geocoding.reverse, args),
  ]);
  expect(
    results
      .map((result) => result.status)
      .toSorted((a, b) => a.localeCompare(b)),
  ).toEqual(["duplicate", "found"]);
  expect(await as.action(api.geocoding.reverse, { ...args, lat: 13 })).toEqual({
    status: "limit",
  });
  expect(fetcher).toHaveBeenCalledTimes(1);
  const usage = await t.run((ctx) =>
    ctx.db.query("geocodingAccountDays").take(1),
  );
  expect(usage[0].used).toBe(1);
});
it("aborts provider waiting after eight seconds without an automatic paid retry", async () => {
  const { as } = await setup();
  vi.useFakeTimers();
  const fetcher = vi.fn(
    (_url: URL, options: RequestInit) =>
      new Promise<Response>((_resolve, reject) => {
        options.signal?.addEventListener(
          "abort",
          () => {
            reject(new Error("aborted"));
          },
          { once: true },
        );
      }),
  );
  vi.stubGlobal("fetch", fetcher);
  const pending = as.action(api.geocoding.reverse, args);
  await vi.waitFor(() => {
    expect(fetcher).toHaveBeenCalledOnce();
  });
  await vi.advanceTimersByTimeAsync(8000);
  expect(await pending).toEqual({ status: "unavailable" });
  expect(fetcher).toHaveBeenCalledTimes(1);
});
