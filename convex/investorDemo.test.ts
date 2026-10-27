/// <reference types="vite/client" />
// @vitest-environment edge-runtime
import { makeFunctionReference } from "convex/server";
import { convexTest } from "convex-test";
import { afterEach, expect, it, vi } from "vitest";

import { components, internal } from "./_generated/api";
import type { TableNames } from "./_generated/dataModel";
import { convexModules, registerAuth } from "./lib/auth.testing";
import { DEMO_INDUSTRY_ROWS, demoDate } from "./lib/investorDemoData";
import {
  INVESTOR_DEMO_BATCH,
  INVESTOR_DEMO_ROSTER,
} from "./lib/investorDemoRoster";
import { planSchema } from "./lib/sourcing";
import schema from "./schema";

const isTable = (table: string): table is TableNames =>
  Object.hasOwn(schema.tables, table);
const modules = convexModules(import.meta.glob("./**/*.*s"));
const seed = makeFunctionReference<
  "mutation",
  { batchKey: string; cohort: number },
  { cohort: number; operators: number; stakeholders: number }
>("investorDemo:seed");
const industries = makeFunctionReference<
  "mutation",
  { batchKey: string; offset: number; limit: number },
  { nextOffset: number | null; total: number }
>("investorDemo:seedIndustries");
afterEach(() => vi.unstubAllEnvs());
function world() {
  vi.stubEnv("CONVEX_SITE_URL", "http://127.0.0.1:3211");
  vi.stubEnv("INVESTOR_DEMO_TARGET_URL", "http://127.0.0.1:3211");
  vi.stubEnv(
    "INVESTOR_DEMO_IMPORT_EXPIRES_AT",
    new Date(Date.now() + 3_600_000).toISOString(),
  );
  const t = convexTest(schema, modules);
  registerAuth(t);
  return t;
}
async function imports(t: ReturnType<typeof world>, cohorts = [1]) {
  await t.run(async (ctx) => {
    for (const persona of INVESTOR_DEMO_ROSTER) {
      if (!cohorts.includes(persona.cohort)) continue;
      const user = (await ctx.runMutation(
        components.betterAuth.adapter.create,
        {
          input: {
            model: "user",
            data: {
              name: persona.name,
              email: persona.email,
              emailVerified: true,
              createdAt: Date.now(),
              updatedAt: Date.now(),
            },
          },
        },
      )) as { _id: string };
      const authUserId = user._id;
      const profileId = await ctx.db.insert("profiles", {
        authUserId,
        kind: "member",
        locale: "en",
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
      await ctx.db.insert("investorDemoAccounts", {
        batchKey: INVESTOR_DEMO_BATCH,
        personaKey: persona.key,
        email: persona.email,
        authUserId,
        profileId,
        passwordHashDigest: "synthetic-not-a-password",
        createdAt: Date.now(),
      });
    }
  });
}
const args = { batchKey: INVESTOR_DEMO_BATCH, cohort: 1 };
it("refuses missing import approval and incomplete identities without domain writes", async () => {
  const t = world();
  vi.stubEnv("INVESTOR_DEMO_TARGET_URL", "https://example.invalid");
  await expect(t.mutation(seed, args)).rejects.toThrow(
    "INVESTOR_DEMO_IMPORT_DISABLED",
  );
  vi.stubEnv("INVESTOR_DEMO_TARGET_URL", "http://127.0.0.1:3211");
  await expect(t.mutation(seed, args)).rejects.toThrow(
    "DEMO_IDENTITY_REQUIRED",
  );
  const rows = await t.run((ctx) => ctx.db.query("orgs").collect());
  expect(rows).toEqual([]);
});
it.each([0, 6, 1.5])("refuses invalid cohort %s", async (cohort) => {
  const t = world();
  await expect(t.mutation(seed, { ...args, cohort })).rejects.toThrow(
    "DEMO_INVALID_COHORT",
  );
});
it("creates linked exact quantities with gateway-blocked trades and repeats without writes", async () => {
  const t = world();
  await imports(t);
  expect(await t.mutation(seed, args)).toEqual({
    cohort: 1,
    operators: 8,
    stakeholders: 12,
  });
  const before = await t.run(async (ctx) => ({
    markers: await ctx.db.query("investorDemoRecords").collect(),
    audits: await ctx.db.query("auditLog").collect(),
    orgs: await ctx.db.query("orgs").collect(),
    stock: await ctx.db.query("inventory").collect(),
    listings: await ctx.db.query("listings").collect(),
    trades: await ctx.db.query("trades").collect(),
    transformations: await ctx.db.query("lotTransformations").collect(),
    lots: await ctx.db.query("materialLots").collect(),
    profiles: await ctx.db.query("profiles").collect(),
    memberships: await ctx.db.query("memberships").collect(),
  }));
  expect(before.orgs).toHaveLength(8);
  expect(before.stock).toHaveLength(48);
  expect(before.trades).toHaveLength(12);
  expect(
    before.profiles.every((p) => p.kind === "member" && p.phone === undefined),
  ).toBe(true);
  expect(before.memberships.filter((m) => m.role === "viewer")).toHaveLength(1);
  for (const trade of before.trades) {
    expect(["accepted", "requested"]).toContain(trade.status);
    expect(trade.totalPaise).toBe((trade.grams * trade.paisePerKg) / 1000);
    const stock = before.stock.find(
      (s) =>
        s.orgId === trade.sellerOrgId && s.materialCode === trade.materialCode,
    );
    const listing = before.listings.find((l) => l._id === trade.listingId);
    expect(stock?.grams).toBeGreaterThanOrEqual(
      (listing?.grams ?? 0) + trade.grams,
    );
  }
  for (const transformation of before.transformations) {
    const outputs = before.lots.filter(
      (l) => l.parentTransformationId === transformation._id,
    );
    expect(
      outputs.reduce((sum, l) => sum + l.initialGrams, 0) +
        transformation.contaminationGrams +
        transformation.processLossGrams,
    ).toBe(transformation.inputGrams);
  }
  await t.mutation(seed, args);
  const after = await t.run(async (ctx) => ({
    markers: await ctx.db.query("investorDemoRecords").collect(),
    audits: await ctx.db.query("auditLog").collect(),
    stock: await ctx.db.query("inventory").collect(),
  }));
  expect(after.markers).toEqual(before.markers);
  expect(after.audits).toEqual(before.audits);
  expect(after.stock).toEqual(before.stock);
  for (const row of before.markers)
    expect(
      await t.run(async (ctx) => {
        if (!isTable(row.table)) throw new Error("Unknown manifest table");
        const id = ctx.db.normalizeId(row.table, row.recordId);
        if (!id) throw new Error("Invalid manifest id");
        return ctx.db.get(row.table, id);
      }),
    ).not.toBeNull();
  for (const table of [
    "cashfreeOrders",
    "cashfreeVendors",
    "tradeFinancials",
    "financialMovements",
    "cashfreeRefunds",
    "facilityRegistrations",
    "facilityScopeReviews",
    "controlledDestinations",
    "smsNotifications",
    "pushDeliveries",
    "adminProfiles",
  ] as const) {
    const rows = await t.run((ctx) => ctx.db.query(table).collect());
    expect(rows).toEqual([]);
  }
});
it("does not overwrite existing catalogue records or retain a partial cohort", async () => {
  const t = world();
  await imports(t);
  const existing = await t.run((ctx) =>
    ctx.db.insert("materials", {
      code: "DEMO-PET-BOTTLE",
      family: "metal",
      stage: "scrap",
      names: { en: "Existing user data" },
      sortOrder: 1,
      active: false,
    }),
  );
  await expect(t.mutation(seed, args)).rejects.toThrow(
    "DEMO_MATERIAL_CONFLICT",
  );
  const result = await t.run(async (ctx) => ({
    material: await ctx.db.get(existing),
    orgs: await ctx.db.query("orgs").collect(),
    markers: await ctx.db.query("investorDemoRecords").collect(),
  }));
  expect(result.material?.names.en).toBe("Existing user data");
  expect(result.orgs).toEqual([]);
  expect(result.markers).toEqual([]);
});
it("refuses stale cleanup markers instead of recreating deleted stock", async () => {
  const t = world();
  await imports(t);
  await t.mutation(seed, args);
  await t.run(async (ctx) => {
    const stock = await ctx.db.query("inventory").first();
    if (!stock) throw new Error("Missing test stock");
    await ctx.db.delete(stock._id);
  });
  await expect(t.mutation(seed, args)).rejects.toThrow(
    "DEMO_RECORD_CHANGED_OR_MISSING",
  );
});
it("covers every workbook row in bounded batches without claiming approval or exceeding facility limits", async () => {
  const t = world();
  await imports(t, [1, 2, 3, 4, 5]);
  for (const cohort of [1, 2, 3, 4, 5])
    await t.mutation(seed, { ...args, cohort });
  expect(DEMO_INDUSTRY_ROWS).toHaveLength(518);
  let offset: number | null = 0;
  while (offset !== null) {
    const page: { nextOffset: number | null; total: number } = await t.mutation(
      industries,
      {
        batchKey: INVESTOR_DEMO_BATCH,
        offset,
        limit: 25,
      },
    );
    offset = page.nextOffset;
  }
  const rows = await t.run((ctx) =>
    ctx.db.query("industrialFacilities").collect(),
  );
  expect(rows).toHaveLength(558);
  expect(rows.filter((r) => r.sector)).toHaveLength(419);
  expect(
    rows
      .filter((r) => r.sector)
      .every((r) => r.sector?.sourceQuality === "workbook_unverified"),
  ).toBe(true);
  const counts = new Map<string, number>();
  for (const row of rows)
    counts.set(row.orgId, (counts.get(row.orgId) ?? 0) + 1);
  expect(Math.max(...counts.values())).toBeLessThan(100);
  await t.mutation(industries, {
    batchKey: INVESTOR_DEMO_BATCH,
    offset: 0,
    limit: 25,
  });
  const unchanged = await t.run((ctx) =>
    ctx.db.query("industrialFacilities").collect(),
  );
  expect(unchanged).toEqual(rows);
  await expect(
    t.mutation(industries, {
      batchKey: INVESTOR_DEMO_BATCH,
      offset: 0,
      limit: 26,
    }),
  ).rejects.toThrow("DEMO_INVALID_BATCH");
  const summary = await t.query(internal.investorDemo.status, {
    batchKey: INVESTOR_DEMO_BATCH,
  });
  expect(summary.accountCount).toBe(140);
  // Each cohort adds 48 stock movements and their 48 audit markers.
  expect(summary.markerCount).toBe(3903 + 5 * 96);
  expect(
    summary.recordCounts.find((row) => row.table === "inventoryMovements"),
  ).toEqual({ table: "inventoryMovements", count: 5 * 48 });
  expect(
    summary.recordCounts.find((row) => row.table === "industrialFacilities"),
  ).toEqual({ table: "industrialFacilities", count: 558 });
  expect(summary.recordCounts.find((row) => row.table === "auditLog")).toEqual({
    table: "auditLog",
    count: 1979 + 5 * 48,
  });
  expect(summary.cohorts).toEqual(
    [1, 2, 3, 4, 5].map((cohort) => ({
      cohort,
      accounts: 28,
      expectedAccounts: 28,
      organisations: 8,
    })),
  );
  const integrity = await t.query(internal.investorDemo.integrity, {
    batchKey: INVESTOR_DEMO_BATCH,
    cohort: 1,
  });
  expect(integrity.missingMarkers).toBe(0);
  expect(integrity.inventory).toEqual({
    checkedRows: 48,
    missingRows: 0,
    invalidIntegerRows: 0,
    baselineChangedRows: 0,
    missingAuditRows: 0,
    intakeMismatchRows: 0,
    commitmentExcessPairs: 0,
  });
  // This integration case imports all140 identities and processes all518 rows in21 atomic batches.
}, 60_000);

it("uses only supported recurring dates and scrap intake history", async () => {
  const t = world();
  await imports(t);
  await t.mutation(seed, args);
  const records = await t.run(async (ctx) => ({
    plans: await ctx.db.query("sourcingPlans").collect(),
    intakes: await ctx.db.query("manufacturerStockIntakes").collect(),
    materials: await ctx.db.query("materials").collect(),
  }));
  for (const plan of records.plans)
    expect(
      planSchema.safeParse({ ...plan, neededBy: plan.nextNeededBy }).success,
    ).toBe(true);
  for (const intake of records.intakes)
    expect(
      records.materials.find((m) => m.code === intake.materialCode)?.stage,
    ).toBe("scrap");
  expect(demoDate(Date.parse("2026-10-10T20:00:00.000Z"))).toBe("2026-10-11");
});
it("rejects an import receipt after the real auth identity loses email verification", async () => {
  const t = world();
  await imports(t);
  await t.run(async (ctx) => {
    const receipt = await ctx.db.query("investorDemoAccounts").first();
    if (!receipt) throw new Error("Missing test account");
    await ctx.runMutation(components.betterAuth.adapter.updateOne, {
      input: {
        model: "user",
        where: [{ field: "_id", value: receipt.authUserId }],
        update: { emailVerified: false },
      },
    });
  });
  await expect(t.mutation(seed, args)).rejects.toThrow(
    "DEMO_IDENTITY_REQUIRED",
  );
  const rows = await t.run((ctx) => ctx.db.query("orgs").collect());
  expect(rows).toEqual([]);
});

it("returns only stable batch counts after the import gate is closed", async () => {
  const t = world();
  await imports(t);
  await t.mutation(seed, args);
  const before = await t.query(internal.investorDemo.status, {
    batchKey: INVESTOR_DEMO_BATCH,
  });
  expect(before.accountCount).toBe(28);
  expect(before.markerCount).toBe(583 + 96);
  expect(
    before.recordCounts.find((row) => row.table === "inventoryMovements"),
  ).toEqual({ table: "inventoryMovements", count: 48 });
  expect(before.truncated).toBe(false);
  expect(before.invalidAccountCount).toBe(0);
  expect(before.unexpectedTableMarkers).toBe(0);
  const integrity = await t.query(internal.investorDemo.integrity, {
    batchKey: INVESTOR_DEMO_BATCH,
    cohort: 1,
  });
  expect(integrity.nonMemberProfileCount).toBe(0);
  expect(integrity.scopedAdminProfileCount).toBe(0);
  expect(before.duplicateMarkerKeys).toBe(0);
  expect(before.duplicateRecordReferences).toBe(0);
  expect(integrity.paymentObservations).toEqual({
    tradesWithProviderOrders: 0,
    tradesWithFinancialRecords: 0,
    tradesWithFinancialMovements: 0,
    orgsWithProviderVendors: 0,
  });
  await t.mutation(seed, args);
  vi.stubEnv("INVESTOR_DEMO_TARGET_URL", "");
  const after = await t.query(internal.investorDemo.status, {
    batchKey: INVESTOR_DEMO_BATCH,
  });
  expect(after).toEqual(before);
  expect(JSON.stringify(after)).not.toContain("investor.luma.invalid");
  expect(JSON.stringify(after)).not.toContain("password");
  await expect(
    t.query(internal.investorDemo.status, { batchKey: "other" }),
  ).rejects.toThrow("DEMO_INVALID_BATCH");
});
it("reports missing and duplicate markers, changed stock and scoped financial state without counting unrelated vendors", async () => {
  const t = world();
  await imports(t);
  await t.mutation(seed, args);
  await t.run(async (ctx) => {
    const listing = await ctx.db.query("listings").first();
    if (!listing) throw new Error("Missing test listing");
    const stock = await ctx.db
      .query("inventory")
      .withIndex("by_org_material", (q) =>
        q.eq("orgId", listing.orgId).eq("materialCode", listing.materialCode),
      )
      .unique();
    if (!stock) throw new Error("Missing test stock");
    await ctx.db.patch(stock._id, { grams: 0 });
    const intake = await ctx.db.query("manufacturerStockIntakes").first();
    if (!intake) throw new Error("Missing test intake");
    await ctx.db.patch(intake._id, { grams: 1.5 });
    // A missing target and duplicate reference must be visible, not repaired by a query.
    const route = await ctx.db.query("routePlans").first();
    if (!route) throw new Error("Missing test route");
    await ctx.db.delete(route._id);
    await ctx.db.insert("investorDemoRecords", {
      batchKey: INVESTOR_DEMO_BATCH,
      key: "duplicate-test",
      table: "inventory",
      recordId: stock._id,
      createdAt: Date.now(),
    });
    await ctx.db.insert("investorDemoRecords", {
      batchKey: INVESTOR_DEMO_BATCH,
      key: "duplicate-test",
      table: "cashfreePolicies",
      recordId: "not-a-real-id",
      createdAt: Date.now(),
    });
    const trade = await ctx.db.query("trades").first();
    if (!trade) throw new Error("Missing test trade");
    await ctx.db.insert("tradeFinancials", {
      tradeId: trade._id,
      state: "hold",
      collection: "pending",
      settlement: "pending",
      refund: "none",
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
    const org = await ctx.db.get(listing.orgId);
    if (!org) throw new Error("Missing test org");
    const { _id, _creationTime, ...fields } = org;
    const unrelated = await ctx.db.insert("orgs", {
      ...fields,
      slug: "unrelated-status-test",
    });
    for (const orgId of [org._id, unrelated])
      await ctx.db.insert("cashfreeVendors", {
        orgId,
        mode: "sandbox",
        vendorId: "synthetic",
        providerStatus: "UNVERIFIED",
        checkedAt: Date.now(),
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
  });
  const result = await t.query(internal.investorDemo.status, {
    batchKey: INVESTOR_DEMO_BATCH,
  });
  expect(result.duplicateMarkerKeys).toBe(1);
  expect(result.duplicateRecordReferences).toBe(1);
  expect(result.unexpectedTableMarkers).toBe(1);
  let cursor: string | null = null;
  let missing = 0;
  let checked = 0;
  let isDone = false;
  while (!isDone) {
    const page: {
      cursor: string;
      isDone: boolean;
      checkedRecords: number;
      missingRecords: number;
      unexpectedTableMarkers: number;
    } = await t.query(internal.investorDemo.verifySlice, {
      batchKey: INVESTOR_DEMO_BATCH,
      cursor,
      limit: 100,
    });
    cursor = page.cursor;
    isDone = page.isDone;
    missing += page.missingRecords;
    checked += page.checkedRecords;
  }
  expect(missing).toBe(1);
  expect(checked).toBe(result.markerCount);
  const integrity = await t.query(internal.investorDemo.integrity, {
    batchKey: INVESTOR_DEMO_BATCH,
    cohort: 1,
  });
  expect(integrity.inventory.baselineChangedRows).toBeGreaterThan(0);
  expect(integrity.inventory.intakeMismatchRows).toBe(1);
  expect(integrity.inventory.commitmentExcessPairs).toBe(1);
  expect(integrity.paymentObservations).toEqual({
    tradesWithProviderOrders: 0,
    tradesWithFinancialRecords: 1,
    tradesWithFinancialMovements: 0,
    orgsWithProviderVendors: 1,
  });
});
