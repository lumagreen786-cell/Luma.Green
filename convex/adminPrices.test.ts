/// <reference types="vite/client" />
// @vitest-environment edge-runtime
import { convexTest } from "convex-test";
import { afterEach, describe, expect, it, vi } from "vitest";

import { api } from "./_generated/api";
import {
  convexModules,
  registerAuth,
  seedDemo,
  signIn,
  signInAs,
} from "./lib/auth.testing";
import { CATALOGUE } from "./lib/catalogue";
import schema from "./schema";

const modules = convexModules(import.meta.glob("./**/*.*s"));

const ADMIN_EMAIL = "admin@luma.test";
const CITY = "Bengaluru";

afterEach(() => {
  vi.unstubAllEnvs();
});

/** The demo world and its admin (with an authenticator, unless not yet). */
async function demoWorld({ twoFactorEnabled = true } = {}) {
  vi.stubEnv("ADMIN_EMAIL", ADMIN_EMAIL);
  vi.stubEnv("AUTH_DEV_MODE", "true");
  const t = convexTest(schema, modules);
  registerAuth(t);
  await seedDemo(t);
  const admin = await signIn(t, { email: ADMIN_EMAIL, twoFactorEnabled });
  if (twoFactorEnabled) {
    await admin.mutation(api.identity.ensureProfile, { locale: "en" });
  }
  return { t, admin };
}

type World = Awaited<ReturnType<typeof demoWorld>>;

async function newspaperRates(t: World["t"]) {
  return t.run(async (ctx) =>
    ctx.db
      .query("rateCards")
      .withIndex("by_material", (q) => q.eq("materialCode", "PAPER-NEWS"))
      .collect(),
  );
}

describe("the price tables", () => {
  it("list every material with the city's floor and fallback", async () => {
    const { admin } = await demoWorld();
    const rows = await admin.query(api.adminPrices.list, { city: CITY });
    expect(rows.map((row) => row.code)).toEqual(
      CATALOGUE.map((entry) => entry.code),
    );
    expect(rows[0]).toMatchObject({
      code: "PAPER-NEWS",
      family: "paper",
      stage: "scrap",
      floorPaise: 1200,
      fallbackPaise: 1400,
    });

    // A city with no table yet: every material, no prices.
    const empty = await admin.query(api.adminPrices.list, { city: "Mysuru" });
    expect(empty).toHaveLength(CATALOGUE.length);
    expect(empty.every((row) => row.floorPaise === null)).toBe(true);
  });

  it("save a new floor and fallback, with the old ones in the audit log", async () => {
    const { t, admin } = await demoWorld();
    const result = await admin.mutation(api.adminPrices.set, {
      city: CITY,
      materialCode: "PAPER-CARTON",
      floorPaise: 850,
      fallbackPaise: 1050,
    });
    expect(result).toEqual({ lifted: 0 });

    const rows = await admin.query(api.adminPrices.list, { city: CITY });
    expect(rows.find((row) => row.code === "PAPER-CARTON")).toMatchObject({
      floorPaise: 850,
      fallbackPaise: 1050,
    });
    const audit = await t.run(async (ctx) =>
      ctx.db
        .query("auditLog")
        .filter((q) => q.eq(q.field("action"), "referencePrice.updated"))
        .collect(),
    );
    expect(audit).toHaveLength(1);
    expect(audit[0]?.metadata).toMatchObject({
      city: CITY,
      materialCode: "PAPER-CARTON",
      from: { floorPaise: 800, fallbackPaise: 1000 },
      to: { floorPaise: 850, fallbackPaise: 1050 },
    });

    // Saving the same numbers again changes nothing and logs nothing.
    await admin.mutation(api.adminPrices.set, {
      city: CITY,
      materialCode: "PAPER-CARTON",
      floorPaise: 850,
      fallbackPaise: 1050,
    });
    const again = await t.run(async (ctx) =>
      ctx.db
        .query("auditLog")
        .filter((q) => q.eq(q.field("action"), "referencePrice.updated"))
        .collect(),
    );
    expect(again).toHaveLength(1);
  });

  it("start a city's table the first time a price is set", async () => {
    const { admin } = await demoWorld();
    await admin.mutation(api.adminPrices.set, {
      city: "Mysuru",
      materialCode: "PLASTIC-PET",
      floorPaise: 1500,
      fallbackPaise: 1800,
    });
    const rows = await admin.query(api.adminPrices.list, { city: "Mysuru" });
    expect(rows.find((row) => row.code === "PLASTIC-PET")).toMatchObject({
      floorPaise: 1500,
      fallbackPaise: 1800,
    });
  });

  it("keeps business offers unchanged when a reference changes", async () => {
    const { t, admin } = await demoWorld();
    const before = await newspaperRates(t);
    const under = before.filter((rate) => rate.paisePerKg < 1450);
    expect(under.length).toBeGreaterThan(0);

    const result = await admin.mutation(api.adminPrices.set, {
      city: CITY,
      materialCode: "PAPER-NEWS",
      floorPaise: 1450,
      fallbackPaise: 1600,
    });
    expect(result).toEqual({ lifted: 0 });

    const after = await newspaperRates(t);
    for (const rate of after) {
      const was = before.find((old) => old._id === rate._id)?.paisePerKg ?? 0;
      expect(rate.paisePerKg).toBe(was);
    }
    const lifts = await t.run(async (ctx) =>
      ctx.db
        .query("auditLog")
        .filter((q) => q.eq(q.field("action"), "rateCard.liftedToFloor"))
        .collect(),
    );
    expect(lifts).toHaveLength(0);
  });

  it("refuse prices that don't make sense", async () => {
    const { admin } = await demoWorld();
    const set = (
      floorPaise: number,
      fallbackPaise: number,
      code = "METAL-IRON",
    ) =>
      admin.mutation(api.adminPrices.set, {
        city: CITY,
        materialCode: code,
        floorPaise,
        fallbackPaise,
      });
    await expect(set(0, 2800)).rejects.toThrow(/INVALID_PRICE/);
    await expect(set(-100, 2800)).rejects.toThrow(/INVALID_PRICE/);
    await expect(set(2400.5, 2800)).rejects.toThrow(/INVALID_PRICE/);
    await expect(set(3000, 2800)).rejects.toThrow(/FLOOR_ABOVE_FALLBACK/);
    await expect(set(2400, 2_000_000)).rejects.toThrow(/PRICE_TOO_HIGH/);
    await expect(set(2400, 2800, "METAL-GOLD")).rejects.toThrow(
      /UNKNOWN_MATERIAL/,
    );
    await expect(
      admin.mutation(api.adminPrices.set, {
        city: " ",
        materialCode: "METAL-IRON",
        floorPaise: 2400,
        fallbackPaise: 2800,
      }),
    ).rejects.toThrow(/INVALID_CITY/);
  });

  it("are for the admin only", async () => {
    const { t, admin: halfway } = await demoWorld({ twoFactorEnabled: false });
    const change = {
      city: CITY,
      materialCode: "PAPER-NEWS",
      floorPaise: 100,
      fallbackPaise: 200,
    };
    await expect(t.query(api.adminPrices.list, { city: CITY })).rejects.toThrow(
      /NOT_SIGNED_IN/,
    );
    await expect(t.mutation(api.adminPrices.set, change)).rejects.toThrow(
      /NOT_SIGNED_IN/,
    );
    // A kabadiwala can't lower the floor under their own prices.
    const shop = await signInAs(t, "+919000000101");
    await expect(
      shop.query(api.adminPrices.list, { city: CITY }),
    ).rejects.toThrow(/NOT_ADMIN/);
    await expect(shop.mutation(api.adminPrices.set, change)).rejects.toThrow(
      /NOT_ADMIN/,
    );
    // The admin before their authenticator is set up.
    await expect(halfway.mutation(api.adminPrices.set, change)).rejects.toThrow(
      /TWO_FACTOR_REQUIRED/,
    );
  });
});

it("records source and observation date and does not create binding shop offers", async () => {
  const { t, admin } = await demoWorld();
  const before = await newspaperRates(t);
  const observedAt = Date.now();
  const { indiaToday } = await import("./lib/onboarding");
  const args = {
    city: CITY,
    materialCode: "PAPER-NEWS",
    date: indiaToday(observedAt),
    paisePerKg: 1234,
    sourceLabel: "Reported test reference only",
    observedAt,
  };
  const id = await admin.mutation(api.adminPrices.recordMarket, args);
  expect(await t.run((ctx) => ctx.db.get("marketPrices", id))).toMatchObject(
    args,
  );
  expect(await newspaperRates(t)).toEqual(before);
  await expect(
    admin.mutation(api.adminPrices.recordMarket, { ...args, sourceLabel: " " }),
  ).rejects.toThrow(/INVALID_REFERENCE/);
  await expect(
    admin.mutation(api.adminPrices.recordMarket, {
      ...args,
      observedAt: observedAt + 86_400_000,
    }),
  ).rejects.toThrow(/INVALID_DATE/);
});

it("hides unlabelled and stale indications instead of refreshing them at import time", async () => {
  const { t } = await demoWorld();
  const { marketPriceOn } = await import("./stock");
  const { indiaToday } = await import("./lib/onboarding");
  const now = Date.now();
  const date = indiaToday(now);
  await t.run(async (ctx) => {
    await ctx.db.insert("marketPrices", {
      city: CITY,
      materialCode: "SOURCE-TEST",
      date,
      paisePerKg: 100,
    });
    expect(await marketPriceOn(ctx, CITY, "SOURCE-TEST", date)).toBeNull();
    await ctx.db.insert("marketPrices", {
      city: CITY,
      materialCode: "STALE-TEST",
      date,
      paisePerKg: 100,
      sourceLabel: "Test observation",
      observedAt: now - 86_400_001,
    });
    expect(await marketPriceOn(ctx, CITY, "STALE-TEST", date)).toBeNull();
    await ctx.db.insert("marketPrices", {
      city: CITY,
      materialCode: "VALID-TEST",
      date,
      paisePerKg: 100,
      sourceLabel: "Test observation",
      observedAt: now - 86_400_001,
      expiresAt: now + 86_400_000,
    });
    expect(await marketPriceOn(ctx, CITY, "VALID-TEST", date)).toMatchObject({
      paisePerKg: 100,
      sourceLabel: "Test observation",
    });
  });
});
