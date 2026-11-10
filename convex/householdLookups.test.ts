// @vitest-environment edge-runtime
import { convexTest } from "convex-test";
import { afterEach, expect, it, vi } from "vitest";

import { api } from "./_generated/api";
import { convexModules, registerAuth, signIn } from "./lib/auth.testing";
import schema from "./schema";

const modules = convexModules(import.meta.glob("./**/*.*s"));
const point = { lat: 12.971234, lng: 77.591234, consent: true };
const air = { ...point, kind: "air" as const };
const solar = { ...point, kind: "solar" as const };

async function setup() {
  const t = convexTest(schema, modules);
  registerAuth(t);
  const user = await signIn(t, {
    email: "household-lookups@example.test",
    phoneNumber: "+919000000823",
  });
  await user.mutation(api.identity.ensureProfile, { locale: "en" });
  vi.stubEnv("GOOGLE_HOUSEHOLD_AQI_ENABLED", "true");
  vi.stubEnv("GOOGLE_HOUSEHOLD_AQI_API_KEY", "fixture-air");
  vi.stubEnv("GOOGLE_HOUSEHOLD_SOLAR_ENABLED", "true");
  vi.stubEnv("GOOGLE_HOUSEHOLD_SOLAR_API_KEY", "fixture-solar");
  const transport =
    vi.fn<(url: URL, options: RequestInit) => Promise<Response>>();
  vi.stubGlobal("fetch", transport);
  return { t, user, transport };
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

it("does not contact Google without sign-in, phone verification, consent and valid coordinates", async () => {
  const { t, user, transport } = await setup();
  await expect(t.action(api.householdLookups.check, air)).rejects.toThrow(
    "NOT_SIGNED_IN",
  );
  const withoutPhone = await signIn(t, { email: "unverified@example.test" });
  await expect(
    withoutPhone.action(api.householdLookups.check, air),
  ).rejects.toThrow("PHONE_REQUIRED");
  await expect(
    user.action(api.householdLookups.check, { ...air, consent: false }),
  ).rejects.toThrow("VALIDATION_REQUIRED");
  await expect(
    user.action(api.householdLookups.check, { ...solar, lng: 181 }),
  ).rejects.toThrow("VALIDATION_REQUIRED");
  expect(transport).not.toHaveBeenCalled();
});

it("keeps each provider off until its own enable flag and key are configured", async () => {
  const { t, user, transport } = await setup();
  vi.stubEnv("GOOGLE_HOUSEHOLD_AQI_ENABLED", "false");
  vi.stubEnv("GOOGLE_HOUSEHOLD_SOLAR_API_KEY", "");
  expect(await t.query(api.householdLookups.availability, {})).toEqual({
    air: false,
    solar: false,
  });
  expect(await user.action(api.householdLookups.check, air)).toEqual({
    status: "unavailable",
  });
  expect(await user.action(api.householdLookups.check, solar)).toEqual({
    status: "unavailable",
  });
  expect(transport).not.toHaveBeenCalled();
});

it("rounds the AQI point, returns only the universal index and keeps no provider content", async () => {
  const { t, user, transport } = await setup();
  const dateTime = new Date().toISOString();
  transport.mockResolvedValue(
    Response.json({
      dateTime,
      indexes: [{ code: "uaqi", aqi: 74, private: "ignored" }],
    }),
  );
  expect(await user.action(api.householdLookups.check, air)).toEqual({
    status: "air",
    score: 74,
    observedAt: Date.parse(dateTime),
  });
  const [url, request] = transport.mock.calls[0];
  expect(url.origin + url.pathname).toBe(
    "https://airquality.googleapis.com/v1/currentConditions:lookup",
  );
  if (typeof request.body !== "string") throw new Error("Missing JSON body");
  expect(JSON.parse(request.body)).toEqual({
    location: { latitude: 12.971, longitude: 77.591 },
  });
  expect(await user.action(api.householdLookups.check, air)).toEqual({
    status: "limit",
  });
  const rows = await t.run((ctx) =>
    ctx.db.query("householdLookupUsage").take(5),
  );
  expect(rows.map(({ used }) => used)).toEqual([1, 1]);
  expect(JSON.stringify(rows)).not.toMatch(/12\.97|ignored|fixture-air/);
  expect(transport).toHaveBeenCalledTimes(1);
});

it("limits the solar response to modeled output for a matching building", async () => {
  const { user, transport } = await setup();
  transport.mockResolvedValue(
    Response.json({
      boundingBox: {
        sw: { latitude: 12.971, longitude: 77.591 },
        ne: { latitude: 12.972, longitude: 77.592 },
      },
      solarPotential: {
        solarPanelConfigs: [
          { panelsCount: 5, yearlyEnergyDcKwh: 1200 },
          { panelsCount: 10, yearlyEnergyDcKwh: 2200 },
        ],
      },
    }),
  );
  expect(await user.action(api.householdLookups.check, solar)).toEqual({
    status: "solar",
    panelCount: 10,
    annualDcKwh: 2200,
  });
  const [url, request] = transport.mock.calls[0];
  expect(url.origin + url.pathname).toBe(
    "https://solar.googleapis.com/v1/buildingInsights:findClosest",
  );
  expect(url.searchParams.get("location.latitude")).toBe("12.97123");
  expect(request.redirect).toBe("error");
  expect(url.searchParams.has("key")).toBe(false);
  expect(new Headers(request.headers).get("x-goog-api-key")).toBe(
    "fixture-solar",
  );
});

it("does not retry a failed transport and checks the deployment-wide allowance before transport", async () => {
  const { t, user, transport } = await setup();
  transport.mockRejectedValue(new Error("provider key must not leak"));
  expect(await user.action(api.householdLookups.check, solar)).toEqual({
    status: "unavailable",
  });
  expect(await user.action(api.householdLookups.check, solar)).toEqual({
    status: "limit",
  });
  expect(transport).toHaveBeenCalledTimes(1);
  await t.run(async (ctx) => {
    const rows = await ctx.db.query("householdLookupUsage").take(5);
    const global = rows.find(({ profileId }) => profileId === undefined);
    if (!global) throw new Error("Missing quota row");
    await ctx.db.patch("householdLookupUsage", global._id, { used: 25 });
  });
  const another = await signIn(t, {
    email: "another-household@example.test",
    phoneNumber: "+919000000824",
  });
  await another.mutation(api.identity.ensureProfile, { locale: "en" });
  expect(await another.action(api.householdLookups.check, solar)).toEqual({
    status: "limit",
  });
  expect(transport).toHaveBeenCalledTimes(1);
});
