/// <reference types="vite/client" />
// @vitest-environment edge-runtime
import { convexTest } from "convex-test";
import { afterEach, describe, expect, it, vi } from "vitest";

import { api, internal } from "./_generated/api";
import { convexModules, registerAuth, signIn } from "./lib/auth.testing";
import { CATALOGUE, catalogueEntry } from "./lib/catalogue";
import { shiftDate } from "./lib/dates";
import { indiaToday } from "./lib/onboarding";
import { PET_REFERENCE_DEFINITIONS } from "./lib/referenceDefinitions";
import schema from "./schema";

const modules = convexModules(import.meta.glob("./**/*.*s"));
const ADMIN_EMAIL = "admin@luma.test";

afterEach(() => vi.unstubAllEnvs());

function world() {
  vi.stubEnv("ADMIN_EMAIL", ADMIN_EMAIL);
  const t = convexTest(schema, modules);
  registerAuth(t);
  return t;
}

describe("production catalogue definitions", () => {
  it("requires the configured admin and completed two-factor protection", async () => {
    const t = world();
    await expect(
      t.mutation(api.catalogue.initializeDefinitions, {}),
    ).rejects.toThrow("NOT_SIGNED_IN");
    const member = await signIn(t, {
      email: "member@luma.test",
      twoFactorEnabled: true,
    });
    await expect(
      member.mutation(api.catalogue.initializeDefinitions, {}),
    ).rejects.toThrow("NOT_ADMIN");
    const pending = await signIn(t, { email: ADMIN_EMAIL });
    await expect(
      pending.mutation(api.catalogue.initializeDefinitions, {}),
    ).rejects.toThrow("TWO_FACTOR_REQUIRED");
    expect(await t.run((ctx) => ctx.db.query("materials").collect())).toEqual(
      [],
    );
    expect(await t.run((ctx) => ctx.db.query("auditLog").collect())).toEqual(
      [],
    );
    expect(
      await t.run((ctx) => ctx.db.query("operationalDefinitions").collect()),
    ).toEqual([]);
  });

  it("adds only missing definitions with unknown factors and no operational records", async () => {
    const t = world();
    const admin = await signIn(t, {
      email: ADMIN_EMAIL,
      twoFactorEnabled: true,
    });
    await admin.mutation(api.identity.ensureProfile, { locale: "en" });
    expect(
      await admin.mutation(api.catalogue.initializeDefinitions, {}),
    ).toEqual({
      inserted: 45,
      definitionsInserted: 21,
      materialsSkipped: 0,
      definitionsSkipped: 0,
    });
    const materials = await t.run((ctx) =>
      ctx.db.query("materials").withIndex("by_sortOrder").collect(),
    );
    expect(
      materials
        .slice(0, CATALOGUE.length)
        .map(({ code, family, stage, names, sortOrder, active }) => ({
          code,
          family,
          stage,
          names,
          sortOrder,
          active,
        })),
    ).toEqual(
      CATALOGUE.map(({ code, family, stage, names }, sortOrder) => ({
        code,
        family,
        stage,
        names,
        sortOrder,
        active: true,
      })),
    );
    for (const material of materials) {
      expect(material.co2eFactor).toBeUndefined();
      expect(material.byproductEligibility).toBeUndefined();
    }
    expect(materials).toHaveLength(45);
    expect(new Set(materials.map(({ code }) => code)).size).toBe(45);
    expect(
      materials.slice(CATALOGUE.length).every(({ active }) => !active),
    ).toBe(true);
    const definitions = await admin.query(
      api.operationalCatalogue.adminList,
      {},
    );
    expect(definitions).toHaveLength(21);
    for (const definition of definitions) {
      expect(definition.status).toBe("draft");
      expect(definition.sourceReference).toContain("workbook_unverified");
      expect(definition.specification).toContain("quality thresholds");
      expect(definition.specification).toContain(
        "grants no hazard classification",
      );
      expect(
        materials.find(({ code }) => code === definition.materialCode),
      ).toBeDefined();
    }
    expect(
      definitions
        .map(({ materialCode }) => materialCode)
        .toSorted((a, b) => a.localeCompare(b)),
    ).toEqual(
      PET_REFERENCE_DEFINITIONS.map(
        ({ materialCode }) => materialCode,
      ).toSorted((a, b) => a.localeCompare(b)),
    );
    const publicRows = await t.query(api.catalogue.materials, {});
    expect(publicRows).toHaveLength(26);
    expect(publicRows.every((material) => material.co2eFactor === null)).toBe(
      true,
    );
    const audit = await t.run((ctx) => ctx.db.query("auditLog").collect());
    expect(
      audit.filter(({ action }) => action === "material.definitionInitialized"),
    ).toHaveLength(45);
    expect(
      audit.filter(({ action }) => action === "catalogue.definitionDrafted"),
    ).toHaveLength(21);
    const rows = await t.run(async (ctx) => ({
      references: await ctx.db.query("referencePrices").collect(),
      history: await ctx.db.query("marketPrices").collect(),
      stock: await ctx.db.query("inventory").collect(),
      listings: await ctx.db.query("listings").collect(),
      trades: await ctx.db.query("trades").collect(),
      evidence: await ctx.db.query("commercialEvidence").collect(),
      lots: await ctx.db.query("materialLots").collect(),
      eligibility: await ctx.db.query("facilityScopeReviews").collect(),
      destinations: await ctx.db.query("controlledDestinations").collect(),
    }));
    for (const records of Object.values(rows)) expect(records).toEqual([]);
    expect(
      await admin.mutation(api.catalogue.initializeDefinitions, {}),
    ).toEqual({
      inserted: 0,
      definitionsInserted: 0,
      materialsSkipped: 45,
      definitionsSkipped: 21,
    });
    expect(
      await t.run((ctx) =>
        ctx.db.query("materials").withIndex("by_sortOrder").collect(),
      ),
    ).toEqual(materials);
    expect(await t.run((ctx) => ctx.db.query("auditLog").collect())).toEqual(
      audit,
    );
    expect(await admin.query(api.operationalCatalogue.adminList, {})).toEqual(
      definitions,
    );
  });

  it("preserves existing definitions, factors and prices exactly", async () => {
    const t = world();
    const admin = await signIn(t, {
      email: ADMIN_EMAIL,
      twoFactorEnabled: true,
    });
    const id = await t.run((ctx) =>
      ctx.db.insert("materials", {
        code: "PAPER-NEWS",
        family: "paper",
        stage: "scrap",
        names: { en: "Reviewed paper" },
        co2eFactor: 3.25,
        sortOrder: 99,
        active: false,
      }),
    );
    const before = await t.run((ctx) => ctx.db.get(id));
    const priceId = await t.run((ctx) =>
      ctx.db.insert("referencePrices", {
        city: "Bengaluru",
        materialCode: "PAPER-NEWS",
        floorPaise: 1234,
        fallbackPaise: 2345,
        updatedAt: 1,
      }),
    );
    const priceBefore = await t.run((ctx) => ctx.db.get(priceId));
    expect(
      await admin.mutation(api.catalogue.initializeDefinitions, {}),
    ).toEqual({
      inserted: 44,
      definitionsInserted: 21,
      materialsSkipped: 1,
      definitionsSkipped: 0,
    });
    expect(await t.run((ctx) => ctx.db.get(id))).toEqual(before);
    expect(await t.run((ctx) => ctx.db.get(priceId))).toEqual(priceBefore);
  });

  it("rejects material code collisions atomically", async () => {
    const t = world();
    const admin = await signIn(t, {
      email: ADMIN_EMAIL,
      twoFactorEnabled: true,
    });
    await t.run((ctx) =>
      ctx.db.insert("materials", {
        code: "RECYCLED-PET-HOT-FLAKE",
        family: "paper",
        stage: "scrap",
        names: { en: "Other reviewed material" },
        sortOrder: 1,
        active: true,
      }),
    );
    await expect(
      admin.mutation(api.catalogue.initializeDefinitions, {}),
    ).rejects.toThrow("MATERIAL_DEFINITION_CONFLICT");
    expect(
      await t.run((ctx) => ctx.db.query("materials").collect()),
    ).toHaveLength(1);
    expect(
      await t.run((ctx) => ctx.db.query("operationalDefinitions").collect()),
    ).toEqual([]);
    expect(await t.run((ctx) => ctx.db.query("auditLog").collect())).toEqual(
      [],
    );
  });

  it("rejects conflicting operational code versions without partial initialization", async () => {
    const t = world();
    const admin = await signIn(t, {
      email: ADMIN_EMAIL,
      twoFactorEnabled: true,
    });
    const reference = PET_REFERENCE_DEFINITIONS[0];
    await admin.mutation(api.operationalCatalogue.draft, {
      ...reference,
      family: "paper",
    });
    const auditBefore = await t.run((ctx) =>
      ctx.db.query("auditLog").collect(),
    );
    await expect(
      admin.mutation(api.catalogue.initializeDefinitions, {}),
    ).rejects.toThrow("MATERIAL_DEFINITION_CONFLICT");
    expect(await t.run((ctx) => ctx.db.query("materials").collect())).toEqual(
      [],
    );
    expect(
      await t.run((ctx) => ctx.db.query("operationalDefinitions").collect()),
    ).toHaveLength(1);
    expect(await t.run((ctx) => ctx.db.query("auditLog").collect())).toEqual(
      auditBefore,
    );
  });

  it("uses bounded indexed reads even when unrelated catalogue records grow", async () => {
    vi.stubEnv("ADMIN_EMAIL", ADMIN_EMAIL);
    const t = convexTest({
      schema,
      modules,
      transactionLimits: { documentsRead: 100 },
    });
    registerAuth(t);
    const admin = await signIn(t, {
      email: ADMIN_EMAIL,
      twoFactorEnabled: true,
    });
    await t.run(async (ctx) => {
      for (let index = 0; index < 200; index += 1) {
        await ctx.db.insert("materials", {
          code: `CUSTOM-${String(index)}`,
          family: "other",
          stage: "scrap",
          names: { en: `Custom material ${String(index)}` },
          active: false,
          sortOrder: 1000 + index,
        });
      }
    });
    expect(
      await admin.mutation(api.catalogue.initializeDefinitions, {}),
    ).toEqual({
      inserted: 45,
      definitionsInserted: 21,
      materialsSkipped: 0,
      definitionsSkipped: 0,
    });
    expect(
      await admin.mutation(api.catalogue.initializeDefinitions, {}),
    ).toEqual({
      inserted: 0,
      definitionsInserted: 0,
      materialsSkipped: 45,
      definitionsSkipped: 21,
    });
    const custom = await t.run((ctx) =>
      ctx.db
        .query("materials")
        .withIndex("by_code", (q) => q.eq("code", "CUSTOM-199"))
        .unique(),
    );
    expect(custom).toMatchObject({
      active: false,
      names: { en: "Custom material 199" },
    });
  });

  it("lets the deployment operator initialize references internally without fabricating an admin identity", async () => {
    const t = world();
    const args = { operatorReference: "offline-test-release" };
    expect(
      await t.mutation(internal.catalogue.initializeReferenceDefinitions, args),
    ).toEqual({
      inserted: 45,
      definitionsInserted: 21,
      materialsSkipped: 0,
      definitionsSkipped: 0,
    });
    const snapshot = await t.run(async (ctx) => ({
      materials: await ctx.db.query("materials").collect(),
      definitions: await ctx.db.query("operationalDefinitions").collect(),
      audit: await ctx.db.query("auditLog").collect(),
      prices: await ctx.db.query("referencePrices").collect(),
      market: await ctx.db.query("marketPrices").collect(),
      profiles: await ctx.db.query("profiles").collect(),
    }));
    expect(snapshot.prices).toEqual([]);
    expect(snapshot.market).toEqual([]);
    expect(snapshot.profiles).toEqual([]);
    expect(
      snapshot.materials.every(({ co2eFactor }) => co2eFactor === undefined),
    ).toBe(true);
    expect(snapshot.audit).toHaveLength(66);
    for (const entry of snapshot.audit) {
      expect(entry.actorProfileId).toBeUndefined();
      expect(entry.metadata).toMatchObject({
        source: "deployment_operator",
        operatorReference: "offline-test-release",
      });
      expect(entry.metadata).not.toHaveProperty("adminUserId");
    }
    expect(
      await t.mutation(internal.catalogue.initializeReferenceDefinitions, args),
    ).toEqual({
      inserted: 0,
      definitionsInserted: 0,
      materialsSkipped: 45,
      definitionsSkipped: 21,
    });
    expect(await t.run((ctx) => ctx.db.query("auditLog").collect())).toEqual(
      snapshot.audit,
    );
    await expect(
      t.mutation(internal.catalogue.initializeReferenceDefinitions, {
        operatorReference: " ",
      }),
    ).rejects.toThrow("INVALID_REFERENCE");
    await expect(
      t.mutation(api.catalogue.initializeDefinitions, {}),
    ).rejects.toThrow("NOT_SIGNED_IN");
  });
});

describe("fill missing material names", () => {
  it("requires an authenticated admin with two-factor authentication", async () => {
    const t = world();
    await expect(
      t.mutation(api.catalogue.fillMissingNames, {}),
    ).rejects.toThrow("NOT_SIGNED_IN");
    const member = await signIn(t, {
      email: "member@luma.test",
      twoFactorEnabled: true,
    });
    await expect(
      member.mutation(api.catalogue.fillMissingNames, {}),
    ).rejects.toThrow("NOT_ADMIN");
    const unenrolled = await signIn(t, { email: ADMIN_EMAIL });
    await expect(
      unenrolled.mutation(api.catalogue.fillMissingNames, {}),
    ).rejects.toThrow("TWO_FACTOR_REQUIRED");
    expect(await t.run((ctx) => ctx.db.query("auditLog").collect())).toEqual(
      [],
    );
  });

  it("fills only missing names and audits each changed material once", async () => {
    const t = world();
    const admin = await signIn(t, {
      email: ADMIN_EMAIL,
      twoFactorEnabled: true,
    });
    await admin.mutation(api.identity.ensureProfile, { locale: "en" });
    const ids = await t.run(async (ctx) => {
      const first = await ctx.db.insert("materials", {
        code: "PAPER-NEWS",
        family: "paper",
        stage: "scrap",
        names: {
          en: "Custom newspaper",
          hi: "रद्दी",
          ta: "என் பெயர்",
          fr: "Journal",
        },
        co2eFactor: 7.125,
        sortOrder: 99,
        active: false,
      });
      const second = await ctx.db.insert("materials", {
        code: "METAL-COPPER",
        family: "metal",
        stage: "scrap",
        names: { en: "Copper" },
        co2eFactor: 3,
        sortOrder: 2,
        active: true,
      });
      const custom = await ctx.db.insert("materials", {
        code: "CUSTOM-MATERIAL",
        family: "other",
        stage: "scrap",
        names: { en: "Custom" },
        co2eFactor: 0.25,
        sortOrder: 100,
        active: true,
      });
      const price = await ctx.db.insert("referencePrices", {
        city: "Bengaluru",
        materialCode: "PAPER-NEWS",
        floorPaise: 1234,
        fallbackPaise: 5678,
        updatedAt: 1,
      });
      const market = await ctx.db.insert("marketPrices", {
        city: "Bengaluru",
        materialCode: "PAPER-NEWS",
        date: "2026-10-01",
        paisePerKg: 2345,
      });
      return { first, second, custom, price, market };
    });
    const before = await t.run(async (ctx) => ({
      material: await ctx.db.get(ids.first),
      custom: await ctx.db.get(ids.custom),
      price: await ctx.db.get(ids.price),
      market: await ctx.db.get(ids.market),
    }));
    expect(await admin.mutation(api.catalogue.fillMissingNames, {})).toEqual({
      updated: 2,
    });
    const after = await t.run(async (ctx) => ({
      material: await ctx.db.get(ids.first),
      custom: await ctx.db.get(ids.custom),
      price: await ctx.db.get(ids.price),
      market: await ctx.db.get(ids.market),
      audit: await ctx.db.query("auditLog").collect(),
      materials: await ctx.db.query("materials").collect(),
    }));
    expect(after.material).toEqual({
      ...before.material,
      names: {
        ...catalogueEntry("PAPER-NEWS")?.names,
        ...before.material?.names,
      },
    });
    expect(after.custom).toEqual(before.custom);
    expect(after.price).toEqual(before.price);
    expect(after.market).toEqual(before.market);
    expect(after.materials).toHaveLength(3);
    const audit = after.audit.filter(
      (entry) => entry.action === "material.namesFilled",
    );
    expect(audit).toHaveLength(2);
    expect(audit[0]).toMatchObject({
      entityTable: "materials",
      entityId: ids.first,
      actorProfileId: expect.any(String),
      metadata: {
        code: "PAPER-NEWS",
        from: before.material?.names,
        to: after.material?.names,
      },
    });
    expect(audit[0]?.metadata.addedLocales).not.toContain("ta");
    expect(audit[0]?.metadata.addedLocales).toContain("ar");
    expect(await admin.mutation(api.catalogue.fillMissingNames, {})).toEqual({
      updated: 0,
    });
    expect(await t.run((ctx) => ctx.db.query("materials").collect())).toEqual(
      after.materials,
    );
    expect(await t.run((ctx) => ctx.db.query("auditLog").collect())).toEqual(
      after.audit,
    );
  });
});

describe("household preview prices", () => {
  it("keeps the fallback distinct from today's market quote and the floor", async () => {
    const t = convexTest(schema, modules);
    await t.run(async (ctx) => {
      await ctx.db.insert("materials", {
        code: "PAPER-NEWS",
        family: "paper",
        stage: "scrap",
        names: { en: "Newspaper" },
        co2eFactor: 1,
        active: true,
        sortOrder: 1,
      });
      await ctx.db.insert("referencePrices", {
        city: "Bengaluru",
        materialCode: "PAPER-NEWS",
        floorPaise: 1000,
        fallbackPaise: 1400,
        updatedAt: Date.now(),
      });
      await ctx.db.insert("marketPrices", {
        city: "Bengaluru",
        materialCode: "PAPER-NEWS",
        date: indiaToday(),
        paisePerKg: 2200,
      });
    });
    const board = await t.query(api.catalogue.priceBoard, {
      city: "Bengaluru",
    });
    expect(board.rows[0]).toMatchObject({
      todayPaise: 2200,
      floorPaise: 1000,
      fallbackPaise: 1400,
    });
    const missing = await t.query(api.catalogue.priceBoard, {
      city: "Chennai",
    });
    expect(missing.rows[0]?.fallbackPaise).toBeNull();
  });
});

async function seedQuoteHistory(t: ReturnType<typeof world>) {
  await t.run(async (ctx) => {
    for (const [index, entry] of CATALOGUE.entries()) {
      await ctx.db.insert("materials", {
        code: entry.code,
        family: entry.family,
        stage: entry.stage,
        names: entry.names,
        co2eFactor: entry.co2eFactor,
        active: true,
        sortOrder: index,
      });
      await ctx.db.insert("referencePrices", {
        city: "Bengaluru",
        materialCode: entry.code,
        floorPaise: 1000,
        fallbackPaise: 1400,
        updatedAt: Date.now(),
      });
      for (let day = -29; day <= 0; day += 1) {
        await ctx.db.insert("marketPrices", {
          city: "Bengaluru",
          materialCode: entry.code,
          date: shiftDate(indiaToday(), day),
          paisePerKg: 2200 + day,
        });
      }
    }
  });
}

describe("compact form quotes", () => {
  it("reads at most two documents per material even with a full month of history", async () => {
    const t = convexTest({
      schema,
      modules,
      transactionLimits: { documentsRead: CATALOGUE.length * 2 },
    });
    await seedQuoteHistory(t);
    for (const source of ["fallback", "market"] as const) {
      const result = await t.query(api.catalogue.priceQuotes, {
        city: "Bengaluru",
        source,
      });
      expect(result.rows).toHaveLength(CATALOGUE.length);
      expect(result.rows[0]).toEqual({
        code: CATALOGUE[0].code,
        paisePerKg: source === "fallback" ? 1400 : 2200,
      });
    }
    // A chart query needs the month; forms must stay within the lower budget.
    await expect(
      t.query(api.catalogue.priceBoard, { city: "Bengaluru" }),
    ).rejects.toThrow("Scanned too many documents");
  });

  it("matches full-board values with under a tenth of its JSON payload", async () => {
    const t = convexTest(schema, modules);
    await seedQuoteHistory(t);
    const board = await t.query(api.catalogue.priceBoard, {
      city: "Bengaluru",
    });
    expect(board.rows.every((row) => row.series.length === 30)).toBe(true);
    for (const source of ["fallback", "market"] as const) {
      const compact = await t.query(api.catalogue.priceQuotes, {
        city: "Bengaluru",
        source,
      });
      expect(compact.rows).toEqual(
        board.rows.map((row) => ({
          code: row.code,
          paisePerKg:
            source === "fallback" ? row.fallbackPaise : row.todayPaise,
        })),
      );
      expect(
        new TextEncoder().encode(JSON.stringify(compact)).length,
      ).toBeLessThan(
        new TextEncoder().encode(JSON.stringify(board)).length / 10,
      );
    }
  });

  it("keeps missing and stale quotes null and reads fresh admin changes", async () => {
    const t = convexTest(schema, modules);
    const referenceId = await t.run(async (ctx) => {
      for (const [code, active] of [
        ["PAPER-NEWS", true],
        ["CUSTOM-MATERIAL", true],
        ["INACTIVE", false],
      ] as const) {
        await ctx.db.insert("materials", {
          code,
          family: "paper",
          stage: "scrap",
          names: { en: code },
          co2eFactor: 1,
          active,
          sortOrder: 1,
        });
      }
      await ctx.db.insert("marketPrices", {
        city: "Bengaluru",
        materialCode: "PAPER-NEWS",
        date: shiftDate(indiaToday(), -30),
        paisePerKg: 2200,
      });
      return ctx.db.insert("referencePrices", {
        city: "Bengaluru",
        materialCode: "PAPER-NEWS",
        floorPaise: 1000,
        fallbackPaise: 1400,
        updatedAt: Date.now(),
      });
    });
    const args = { city: "Bengaluru", source: "fallback" } as const;
    const before = await t.query(api.catalogue.priceQuotes, args);
    expect(before.rows).toEqual([
      { code: "PAPER-NEWS", paisePerKg: 1400 },
      { code: "CUSTOM-MATERIAL", paisePerKg: null },
    ]);
    await t.run((ctx) => ctx.db.patch(referenceId, { fallbackPaise: 1700 }));
    const after = await t.query(api.catalogue.priceQuotes, args);
    expect(after.rows[0]).toEqual({
      code: "PAPER-NEWS",
      paisePerKg: 1700,
    });
    for (const request of [
      { city: "Bengaluru", source: "market" },
      { city: "Chennai", source: "fallback" },
    ] as const) {
      const missing = await t.query(api.catalogue.priceQuotes, request);
      expect(missing.rows.every((row) => row.paisePerKg === null)).toBe(true);
    }
  });
});
