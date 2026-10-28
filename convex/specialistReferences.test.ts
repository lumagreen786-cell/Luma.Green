/// <reference types="vite/client" />
// @vitest-environment edge-runtime
import { convexTest } from "convex-test";
import { afterEach, expect, it, vi } from "vitest";

import { api, internal } from "./_generated/api";
import {
  convexModules,
  registerAuth,
  seedDemo,
  signInAs,
} from "./lib/auth.testing";
import { isOrdinaryMaterial } from "./lib/materialEligibility";
import {
  SPECIALIST_CATEGORIES,
  SPECIALIST_LABELS,
} from "./lib/specialistReferences";
import schema from "./schema";

const modules = convexModules(import.meta.glob("./**/*.*s"));
afterEach(() => vi.unstubAllEnvs());

it("seeds each distinct specialist category as inactive unverified references with insertion audits only", async () => {
  const t = convexTest(schema, modules);
  const counts = await t.mutation(
    internal.catalogue.initializeReferenceDefinitions,
    { operatorReference: "synthetic-specialist-test" },
  );
  expect(counts).toEqual({
    inserted: 51,
    definitionsInserted: 32,
    materialsSkipped: 0,
    definitionsSkipped: 0,
  });
  const snapshot = await t.run(async (ctx) => ({
    materials: await ctx.db.query("materials").collect(),
    definitions: await ctx.db.query("operationalDefinitions").collect(),
    audit: await ctx.db.query("auditLog").collect(),
  }));
  const rows = snapshot.materials.filter((row) => row.specialistReference);
  expect(rows).toHaveLength(11);
  expect(new Set(rows.map((row) => row.specialistReference?.category))).toEqual(
    new Set(SPECIALIST_CATEGORIES),
  );
  for (const row of rows) {
    expect(row.active).toBe(false);
    expect(
      isOrdinaryMaterial({ ...row, code: "CUSTOM-SPECIALIST", active: true }),
    ).toBe(false);
    expect(row.specialistReference).toMatchObject({
      routeStatus: "unavailable",
      classificationStatus: "unverified",
    });
    expect(row.co2eFactor).toBeUndefined();
    expect(row.byproductEligibility).toBeUndefined();
    const definition = snapshot.definitions.find(
      (entry) => entry.materialCode === row.code,
    );
    expect(definition).toMatchObject({ status: "draft" });
    expect(definition?.specification).toContain("routes are unavailable");
  }
  expect(snapshot.audit).toHaveLength(83);
  const tyre = rows.find(({ code }) => code === "TYRE-USED");
  const tyreDefinition = snapshot.definitions.find(
    ({ materialCode }) => materialCode === "TYRE-USED",
  );
  if (!tyre || !tyreDefinition) throw new Error("Missing specialist reference");
  await t.run(async (ctx) => {
    await ctx.db.patch("materials", tyre._id, {
      active: true,
      names: { en: "Later reviewed tyre label" },
    });
    await ctx.db.patch("operationalDefinitions", tyreDefinition._id, {
      status: "retired",
    });
  });
  expect(
    await t.mutation(internal.catalogue.initializeReferenceDefinitions, {
      operatorReference: "repeat",
    }),
  ).toEqual({
    inserted: 0,
    definitionsInserted: 0,
    materialsSkipped: 51,
    definitionsSkipped: 32,
  });
  expect(await t.run((ctx) => ctx.db.get(tyre._id))).toMatchObject({
    active: true,
    names: { en: "Later reviewed tyre label" },
  });
  expect(await t.run((ctx) => ctx.db.get(tyreDefinition._id))).toMatchObject({
    status: "retired",
  });
  expect(await t.run((ctx) => ctx.db.query("auditLog").collect())).toEqual(
    snapshot.audit,
  );
});

it("rejects a specialist code collision atomically without rewriting unrelated reviewed records", async () => {
  const t = convexTest(schema, modules);
  await t.run((ctx) =>
    ctx.db.insert("materials", {
      code: "TYRE-USED",
      family: "metal",
      stage: "recycled",
      names: { en: "Reviewed conflicting identity" },
      active: true,
      sortOrder: 1,
    }),
  );
  await expect(
    t.mutation(internal.catalogue.initializeReferenceDefinitions, {
      operatorReference: "synthetic-conflict",
    }),
  ).rejects.toThrow("MATERIAL_DEFINITION_CONFLICT");
  expect(
    await t.run((ctx) => ctx.db.query("materials").collect()),
  ).toHaveLength(1);
  expect(await t.run((ctx) => ctx.db.query("auditLog").collect())).toEqual([]);
});

it("blocks every specialist reference from ordinary offers, matching and stock intake even when active and marked non-hazardous", async () => {
  vi.stubEnv("AUTH_DEV_MODE", "true");
  const t = convexTest(schema, modules);
  registerAuth(t);
  await seedDemo(t);
  await t.mutation(internal.catalogue.initializeReferenceDefinitions, {
    operatorReference: "synthetic-guard",
  });
  const maker = await signInAs(t, "+919000000104");
  const shop = await signInAs(t, "+919000000101");
  const yard = await signInAs(t, "+919000000102");
  await t.run(async (ctx) => {
    const orgs = await ctx.db.query("orgs").collect();
    for (const org of orgs)
      await ctx.db.patch("orgs", org._id, {
        families: ["paper", "plastic", "metal", "glass", "ewaste", "other"],
      });
    const listings = await ctx.db.query("listings").collect();
    const template = listings.find((row) => row.sellerKind === "kabadiwala");
    if (!template) throw new Error("Missing synthetic listing");
    const {
      _id: templateId,
      _creationTime: creationTime,
      ...listing
    } = template;
    expect(templateId).toBeDefined();
    expect(creationTime).toBeGreaterThan(0);
    for (const { code } of SPECIALIST_LABELS) {
      const material = await ctx.db
        .query("materials")
        .withIndex("by_code", (q) => q.eq("code", code))
        .unique();
      if (!material) throw new Error("Missing specialist reference");
      await ctx.db.insert("listings", {
        ...listing,
        materialCode: code,
        status: "open",
        expiresAt: Date.now() + 86_400_000,
      });
      // Simulate an old active row with no metadata and a classification flag.
      await ctx.db.patch("materials", material._id, {
        active: true,
        specialistReference: undefined,
        byproductEligibility: {
          hazardStatus: "non_hazardous",
          sourceReference: "Synthetic classification flag; no route authority",
          reviewedAt: 1,
        },
      });
    }
  });
  const auditBefore = await t.run((ctx) => ctx.db.query("auditLog").collect());
  const movementsBefore = await t.run((ctx) =>
    ctx.db.query("inventoryMovements").collect(),
  );
  for (const { code } of SPECIALIST_LABELS) {
    const row = await t.run((ctx) =>
      ctx.db
        .query("materials")
        .withIndex("by_code", (q) => q.eq("code", code))
        .unique(),
    );
    expect(isOrdinaryMaterial(row)).toBe(false);
    await expect(
      shop.mutation(api.market.createListing, {
        materialCode: code,
        grams: 1000,
        askPaisePerKg: 100,
      }),
    ).rejects.toThrow("MATERIAL_NOT_ELIGIBLE");
    expect(await yard.query(api.market.browse, { materialCode: code })).toEqual(
      [],
    );
    const existingListing = await t.run(async (ctx) => {
      const listings = await ctx.db.query("listings").collect();
      return listings.find(
        (row) => row.materialCode === code && row.status === "open",
      );
    });
    if (!existingListing)
      throw new Error("Missing synthetic restricted listing");
    await expect(
      yard.mutation(api.market.requestTrade, {
        listingId: existingListing._id,
        grams: 1,
      }),
    ).rejects.toThrow("MATERIAL_NOT_ELIGIBLE");
    await expect(
      shop.mutation(api.shop.setRate, { materialCode: code, paisePerKg: 100 }),
    ).rejects.toThrow("NOT_MY_MATERIAL");
    await expect(
      maker.mutation(api.stockClosing.adjust, {
        operationKey: `synthetic-${code}`,
        materialCode: code,
        deltaGrams: 1,
        costPaise: null,
        reason: "Synthetic guard test",
        evidenceReference: "Synthetic scale",
      }),
    ).rejects.toThrow("MATERIAL_NOT_ELIGIBLE");
    await expect(
      maker.mutation(api.stockIntake.record, {
        intakeReference: `synthetic-${code}`,
        materialCode: code,
        grams: 1000,
        producedOn: "2026-01-01",
        sourceReference: "Synthetic source",
        weighingReference: "Synthetic scale",
        ownProductionConfirmed: true,
      }),
    ).rejects.toThrow("BYPRODUCT_NOT_ELIGIBLE");
  }
  const availableIntake = await maker.query(api.stockIntake.materials, {});
  expect(
    availableIntake.some(({ code }) =>
      SPECIALIST_LABELS.some((label) => label.code === code),
    ),
  ).toBe(false);
  expect(
    await t.run((ctx) => ctx.db.query("manufacturerStockIntakes").collect()),
  ).toEqual([]);
  expect(
    await t.run((ctx) => ctx.db.query("inventoryMovements").collect()),
  ).toEqual(movementsBefore);
  expect(await t.run((ctx) => ctx.db.query("auditLog").collect())).toEqual(
    auditBefore,
  );
});
