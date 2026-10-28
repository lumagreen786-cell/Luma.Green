/// <reference types="vite/client" />
// @vitest-environment edge-runtime
import { convexTest } from "convex-test";
import { afterEach, expect, it, vi } from "vitest";

import { api, components, internal } from "./_generated/api";
import {
  convexModules,
  registerAuth,
  seedDemo,
  signIn,
  signInAs,
} from "./lib/auth.testing";
import { LOCAL_ACCEPTANCE_PERSONAS } from "./lib/localAcceptance";
import { PET_REFERENCE_DEFINITIONS } from "./lib/referenceDefinitions";
import schema from "./schema";

const modules = convexModules(import.meta.glob("./**/*.*s"));
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

it("links a synthetic household receipt, stock movement, inspected order and returned claim without calling providers", async () => {
  // This test cannot seed a deployed database. Every provider result below is
  // injected into convex-test, never obtained from a gateway or regulator.
  const fetchGuard = vi.fn(() => {
    throw new Error("OFFLINE_FIXTURE_MUST_NOT_CALL_PROVIDER");
  });
  vi.stubGlobal("fetch", fetchGuard);
  vi.stubEnv("AUTH_DEV_MODE", "true");
  vi.stubEnv("ADMIN_EMAIL", "fixture-admin@luma.test");
  vi.stubEnv("CASHFREE_MODE", "live");
  vi.stubEnv("CASHFREE_LIVE_CLIENT_ID", "offline-fixture-only");
  vi.stubEnv("CASHFREE_LIVE_CLIENT_SECRET", "offline-fixture-only");
  vi.stubEnv("CASHFREE_LIVE_CHECKOUT_ENABLED", "true");
  vi.stubEnv("CASHFREE_LIVE_POLICY_VERSION", "offline-fixture-only");
  const t = convexTest(schema, modules);
  registerAuth(t);
  await seedDemo(t);
  const seller = await signInAs(t, "+919000000101");
  const buyer = await signInAs(t, "+919000000102");
  const household = await signInAs(t, "+919000000109");
  const admin = await signIn(t, {
    email: "fixture-admin@luma.test",
    twoFactorEnabled: true,
  });
  const booking = await t.run(async (ctx) => {
    const row = await ctx.db
      .query("bookings")
      .withIndex("by_token", (q) => q.eq("token", "priyademo1"))
      .unique();
    if (!row) throw new Error("Missing household fixture");
    // Fixture starts at accepted pickup; eligibility/assignment has its own tests.
    await ctx.db.patch("bookings", row._id, { status: "accepted" });
    return row;
  });
  await seller.mutation(api.shop.complete, {
    bookingId: booking._id,
    lines: [{ materialCode: "PAPER-NEWS", grams: 1001 }],
    method: "cash",
  });
  const receipt = await t.run((ctx) => ctx.db.get("bookings", booking._id));
  if (!receipt?.receipt) throw new Error("Missing measured receipt");
  await household.mutation(api.householdReceipts.review, {
    token: booking.token,
    receiptVersion: receipt.receipt.paidAt,
    decision: "accepted",
    rejectedLineIndexes: [],
  });
  await household.mutation(api.householdReceipts.acknowledgePayment, {
    token: booking.token,
    receiptVersion: receipt.receipt.paidAt,
  });
  const movement = await t.run((ctx) =>
    ctx.db
      .query("inventoryMovements")
      .withIndex("by_org_source", (q) =>
        q
          .eq("orgId", booking.orgId)
          .eq("sourceKey", `booking:${booking._id}:PAPER-NEWS`),
      )
      .unique(),
  );
  expect(movement).toMatchObject({ deltaGrams: 1001 });
  const lotId = await seller.mutation(api.traceability.declareLot, {
    materialCode: "PAPER-NEWS",
    state: "Synthetic measured household source",
    grams: 1001,
    sourceReference: `booking:${booking._id}`,
    streamClass: "recoverable_waste",
    handlingClass: "non_hazardous",
  });
  await seller.mutation(api.quality.recordInspection, {
    lotId,
    specificationReference: "OFFLINE-FIXTURE-SPEC",
    specificationVersion: "1",
    sampleMethod: "Synthetic test sample",
    decision: "accepted",
    results: [
      { parameter: "Fixture observation", unit: "text", value: "accepted" },
    ],
  });
  const listingId = await seller.mutation(api.market.createListing, {
    materialCode: "PAPER-NEWS",
    grams: 1001,
    askPaisePerKg: 1000,
    specification: {
      grade: "Synthetic only",
      specification: "OFFLINE-FIXTURE-SPEC",
      lotId,
    },
  });
  const tradeId = await buyer.mutation(api.market.requestTrade, {
    listingId,
    grams: 1001,
  });
  await seller.mutation(api.market.act, { tradeId, action: "accept" });
  await expect(
    seller.mutation(api.cashfreeLifecycle.act, {
      tradeId,
      action: "dispatch",
      reference: "BEFORE-INJECTED-EVIDENCE",
    }),
  ).rejects.toThrow("GATEWAY_REQUIRED");
  await admin.mutation(api.cashfreeLifecycle.savePolicyForAdmin, {
    version: "offline-fixture-only",
    feePayer: "platform",
    refundFunder: "seller",
    refundAuthority: "platform_admin",
    settlementTermsReference: "SYNTHETIC fixture terms",
    providerAcceptanceReference:
      "SYNTHETIC injected approval; no provider acceptance",
  });
  await t.mutation(internal.cashfreePayments.registerVendor, {
    orgId: booking.orgId,
    mode: "live",
    vendorId: "SYNTHETIC_FIXTURE_VENDOR",
  });
  await t.mutation(internal.cashfreePayments.recordVendor, {
    mode: "live",
    vendorId: "SYNTHETIC_FIXTURE_VENDOR",
    status: "ACTIVE",
  });
  const orderId = await buyer.mutation(internal.cashfreePayments.prepare, {
    tradeId,
    idempotencyKey: "00000000-0000-4000-8000-000000000082",
    mode: "live",
  });
  const claim = await t.mutation(internal.cashfreePayments.claim, { orderId });
  if (!claim) throw new Error("Missing offline order lease");
  // Inject only the provider adapter's result; use real physical ledger mutations.
  await t.mutation(internal.cashfreePayments.finish, {
    orderId,
    lease: claim.lease,
    outcome: "paid",
    cfOrderId: "SYNTHETIC-ORDER",
    paymentId: "SYNTHETIC-PAYMENT",
  });
  await seller.mutation(api.cashfreeLifecycle.act, {
    tradeId,
    action: "dispatch",
    reference: "SYNTHETIC-DISPATCH",
  });
  await buyer.mutation(api.cashfreeLifecycle.act, {
    tradeId,
    action: "receive",
    reference: "SYNTHETIC-RECEIPT",
  });
  const allocationId = await buyer.mutation(api.schemeClaims.declare, {
    sourceTradeId: tradeId,
    schemeReference: "SYNTHETIC-SCHEME-NO-CERTIFICATE",
    issuerReference: "SYNTHETIC reported reference",
    operationReference: "SYNTHETIC-ALLOCATION",
    grams: 1001,
  });
  const returned = await buyer.mutation(api.returns.propose, {
    tradeId,
    reference: "SYNTHETIC-RETURN",
    reason: "Synthetic complete-order return",
    destinationOrgId: booking.orgId,
    freightPayer: "seller",
  });
  await seller.mutation(api.returns.review, {
    returnId: returned,
    accept: true,
  });
  expect(
    await t.run((ctx) => ctx.db.get("schemeAllocations", allocationId)),
  ).toMatchObject({
    status: "withdrawn",
    withdrawalReason: "accepted_full_return",
  });
  await buyer.mutation(api.returns.dispatch, {
    returnId: returned,
    grams: 1001,
    reference: "SYNTHETIC-RETURN-DISPATCH",
  });
  await seller.mutation(api.returns.receive, {
    returnId: returned,
    grams: 1001,
    reference: "SYNTHETIC-RETURN-RECEIPT",
  });
  await expect(
    seller.mutation(api.returns.reconcile, { returnId: returned }),
  ).rejects.toThrow("RETURN_PROVIDER_RECONCILIATION_REQUIRED");
  const trade = await t.run((ctx) => ctx.db.get("trades", tradeId));
  expect(trade).toMatchObject({
    grams: 1001,
    totalPaise: 1001,
    specification: { lotId },
  });
  const history = await seller.query(api.traceability.history, { lotId });
  expect(history.lot.sourceReference).toBe(`booking:${booking._id}`);
  expect(fetchGuard).not.toHaveBeenCalled();
});

it("creates every named local participant fixture once under the strict loopback gate without stock or payments", async () => {
  vi.stubEnv("AUTH_LOCAL_TEST_MODE", "true");
  vi.stubEnv("SITE_URL", "http://localhost:3100");
  vi.stubEnv("CONVEX_SITE_URL", "http://127.0.0.1:3211");
  const t = convexTest(schema, modules);
  registerAuth(t);
  const accounts = [];
  for (const persona of LOCAL_ACCEPTANCE_PERSONAS) {
    const authUserId = await t.run(async (ctx) => {
      const now = Date.now();
      const user = (await ctx.runMutation(
        components.betterAuth.adapter.create,
        {
          input: {
            model: "user",
            data: {
              name: persona.name,
              email: persona.email,
              emailVerified: true,
              createdAt: now,
              updatedAt: now,
            },
          },
        },
      )) as { _id: string };
      await ctx.db.insert("profiles", {
        authUserId: user._id,
        kind: "member",
        locale: "en",
        createdAt: now,
        updatedAt: now,
      });
      return user._id;
    });
    accounts.push({ key: persona.key, authUserId });
  }
  expect(await t.mutation(internal.localAcceptance.seed, { accounts })).toEqual(
    { created: LOCAL_ACCEPTANCE_PERSONAS.length, existing: 0 },
  );
  expect(await t.mutation(internal.localAcceptance.seed, { accounts })).toEqual(
    { created: 0, existing: LOCAL_ACCEPTANCE_PERSONAS.length },
  );
  const records = await t.run(async (ctx) => ({
    stock: await ctx.db.query("inventory").take(1),
    orders: await ctx.db.query("cashfreeOrders").take(1),
    trades: await ctx.db.query("trades").take(1),
    audit: await ctx.db.query("auditLog").take(100),
  }));
  expect(records.stock).toEqual([]);
  expect(records.orders).toEqual([]);
  expect(records.trades).toEqual([]);
  expect(records.audit).toHaveLength(LOCAL_ACCEPTANCE_PERSONAS.length);
  expect(
    records.audit.every(({ metadata }) => metadata?.synthetic === true),
  ).toBe(true);
  vi.stubEnv("SITE_URL", "https://luma.green");
  await expect(
    t.mutation(internal.localAcceptance.seed, { accounts }),
  ).rejects.toThrow("LOCAL_ACCEPTANCE_ONLY");
});

it("retains all PET reference states as unassessed physical evidence without creating stock or handling approval", async () => {
  vi.stubEnv("AUTH_DEV_MODE", "true");
  const t = convexTest(schema, modules);
  registerAuth(t);
  await seedDemo(t);
  await t.mutation(internal.catalogue.initializeReferenceDefinitions, {
    operatorReference: "offline-material-state-fixture",
  });
  const owner = await signInAs(t, "+919000000101");
  const before = await t.run((ctx) =>
    ctx.db.query("inventoryMovements").take(100),
  );
  for (const definition of PET_REFERENCE_DEFINITIONS) {
    const source = await owner.mutation(api.traceability.declareLot, {
      materialCode: definition.materialCode,
      state: definition.processingState,
      grams: 1001,
      sourceReference:
        "SYNTHETIC reference-state fixture; not a process recipe",
    });
    const process = await owner.mutation(api.traceability.transform, {
      inputLotId: source,
      inputGrams: 1001,
      contaminationGrams: 0,
      processLossGrams: 1,
      outputs: [
        {
          materialCode: definition.materialCode,
          state: definition.processingState,
          grams: 1000,
        },
      ],
    });
    const history = await owner.query(api.traceability.history, {
      lotId: source,
    });
    expect(history.transformations).toHaveLength(1);
    expect(history.transformations[0]).toMatchObject({
      id: process,
      inputGrams: 1001,
      processLossGrams: 1,
    });
    const outputId = history.transformations[0].outputs[0].id;
    const output = await owner.query(api.traceability.history, {
      lotId: outputId,
    });
    expect(output.lot).toMatchObject({
      initialGrams: 1000,
      handlingClass: "unassessed",
      sourceKind: "transformed",
    });
    await expect(
      owner.mutation(api.market.createListing, {
        materialCode: definition.materialCode,
        grams: 1000,
        askPaisePerKg: 1000,
        specification: {
          grade: "SYNTHETIC",
          specification: "No approved handling or quality",
          lotId: outputId,
        },
      }),
    ).rejects.toThrow();
  }
  expect(
    await t.run((ctx) => ctx.db.query("inventoryMovements").take(100)),
  ).toEqual(before);
});
