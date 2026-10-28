/// <reference types="vite/client" />
// @vitest-environment edge-runtime
import { convexTest } from "convex-test";
import { afterEach, expect, it, vi } from "vitest";

import { api } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import type { MutationCtx } from "./_generated/server";
import {
  convexModules,
  registerAuth,
  seedDemo,
  signInAs,
} from "./lib/auth.testing";
import { recordInventoryMovement } from "./lib/inventoryLedger";
import schema from "./schema";
const modules = convexModules(import.meta.glob("./**/*.*s"));
afterEach(() => vi.unstubAllEnvs());
async function world() {
  vi.stubEnv("AUTH_DEV_MODE", "true");
  const t = convexTest(schema, modules);
  registerAuth(t);
  await seedDemo(t);
  const seller = await signInAs(t, "+919000000101"),
    buyer = await signInAs(t, "+919000000102"),
    outsider = await signInAs(t, "+919000000103");
  // eslint-disable-next-line sonarjs/cognitive-complexity -- A single transactional synthetic fixture sets linked payment, stock and identity evidence.
  const scope = await t.run(async (ctx) => {
    const sellerProfile = await ctx.db
      .query("profiles")
      .withIndex("by_phone", (q) => q.eq("phone", "+919000000101"))
      .unique();
    const buyerProfile = await ctx.db
      .query("profiles")
      .withIndex("by_phone", (q) => q.eq("phone", "+919000000102"))
      .unique();
    if (!sellerProfile || !buyerProfile) throw new Error("Missing profiles");
    const sellerMembership = await ctx.db
      .query("memberships")
      .withIndex("by_profile", (q) => q.eq("profileId", sellerProfile._id))
      .first();
    const buyerMembership = await ctx.db
      .query("memberships")
      .withIndex("by_profile", (q) => q.eq("profileId", buyerProfile._id))
      .first();
    if (!sellerMembership || !buyerMembership)
      throw new Error("Missing membership");
    const sellerOrgId = sellerMembership.orgId,
      buyerOrgId = buyerMembership.orgId;
    const listing = await ctx.db
      .query("listings")
      .withIndex("by_org", (q) => q.eq("orgId", sellerOrgId))
      .filter((q) => q.eq(q.field("materialCode"), "PAPER-NEWS"))
      .first();
    if (!listing) throw new Error("Missing listing");
    await clearFixtureReservations(ctx, buyerOrgId);
    for (const orgId of [sellerOrgId, buyerOrgId]) {
      const stock = await ctx.db
        .query("inventory")
        .withIndex("by_org_material", (q) =>
          q.eq("orgId", orgId).eq("materialCode", "PAPER-NEWS"),
        )
        .unique();
      if (stock)
        await ctx.db.patch("inventory", stock._id, {
          grams: orgId === sellerOrgId ? 1001 : 0,
          costPaise: orgId === sellerOrgId ? 400 : 0,
        });
      else
        await ctx.db.insert("inventory", {
          orgId,
          materialCode: "PAPER-NEWS",
          grams: orgId === sellerOrgId ? 1001 : 0,
          costPaise: orgId === sellerOrgId ? 400 : 0,
          updatedAt: Date.now(),
        });
    }
    const now = Date.now();
    const tradeId = await ctx.db.insert("trades", {
      listingId: listing._id,
      sellerOrgId,
      buyerOrgId,
      materialCode: "PAPER-NEWS",
      grams: 1001,
      paisePerKg: 1000,
      totalPaise: 1001,
      status: "completed",
      timeline: [{ status: "completed", at: now }],
      createdAt: now,
      updatedAt: now,
    });
    await recordInventoryMovement(ctx, {
      orgId: sellerOrgId,
      actorProfileId: sellerProfile._id,
      materialCode: "PAPER-NEWS",
      deltaGrams: -1001,
      addedCostPaise: null,
      sourceKey: `trade:${tradeId}:dispatch`,
      createdAt: now,
    });
    await recordInventoryMovement(ctx, {
      orgId: buyerOrgId,
      actorProfileId: buyerProfile._id,
      materialCode: "PAPER-NEWS",
      deltaGrams: 1001,
      addedCostPaise: 1001,
      sourceKey: `trade:${tradeId}:receipt`,
      createdAt: now,
    });
    const orderId = await ctx.db.insert("cashfreeOrders", {
      tradeId,
      sellerOrgId,
      buyerOrgId,
      totalPaise: 1001,
      mode: "live",
      currency: "INR",
      customerId: "synthetic",
      customerPhone: "+919000000102",
      vendorId: "synthetic",
      providerOrderId: "synthetic",
      idempotencyKey: "synthetic",
      expiresAt: now + 10_000,
      checkout: "closed",
      collection: "live_confirmed",
      settlement: "blocked",
      refund: "blocked",
      lease: 0,
      leaseUntil: 0,
      attempts: 1,
      createdAt: now,
      updatedAt: now,
    });
    const financialId = await ctx.db.insert("tradeFinancials", {
      tradeId,
      orderId,
      state: "received",
      collection: "live_confirmed",
      refund: "none",
      settlement: "settled",
      createdAt: now,
      updatedAt: now,
    });
    return { sellerOrgId, buyerOrgId, tradeId, orderId, financialId };
  });
  return { t, seller, buyer, outsider, ...scope };
}
async function propose(w: Awaited<ReturnType<typeof world>>) {
  return w.buyer.mutation(api.returns.propose, {
    tradeId: w.tradeId,
    reference: "RETURN-TEST-1",
    reason: "Rejected complete order",
    destinationOrgId: w.sellerOrgId,
    freightPayer: "seller",
  });
}
async function declare(
  w: Awaited<ReturnType<typeof world>>,
  grams = 1001,
  operationReference = "ALLOC-TEST-1",
) {
  return w.buyer.mutation(api.schemeClaims.declare, {
    sourceTradeId: w.tradeId,
    schemeReference: "TEST-SCHEME",
    issuerReference: "Reported external reference TEST ONLY",
    operationReference,
    grams,
  });
}

it("returns exact full quantity once, withdraws claims atomically and waits for actual provider evidence", async () => {
  const w = await world(),
    allocation = await declare(w),
    returnId = await propose(w);
  expect(await propose(w)).toBe(returnId);
  await expect(
    w.buyer.mutation(api.returns.review, { returnId, accept: true }),
  ).rejects.toThrow(/COUNTERPARTY/);
  await w.seller.mutation(api.returns.review, { returnId, accept: true });
  expect(
    await w.t.run((ctx) => ctx.db.get("schemeAllocations", allocation)),
  ).toMatchObject({
    status: "withdrawn",
    withdrawalReason: "accepted_full_return",
  });
  await expect(
    w.buyer.mutation(api.schemeClaims.declare, {
      sourceTradeId: w.tradeId,
      schemeReference: "TEST-SCHEME",
      issuerReference: "test",
      operationReference: "AFTER-RETURN",
      grams: 1,
    }),
  ).rejects.toThrow();
  for (const grams of [1000, 1000.5, 1002])
    await expect(
      w.buyer.mutation(api.returns.dispatch, {
        returnId,
        reference: "RETURN-DISPATCH",
        grams,
      }),
    ).rejects.toThrow(/FULL_QUANTITY/);
  await expect(
    w.seller.mutation(api.returns.reconcile, { returnId }),
  ).rejects.toThrow(/PHYSICAL/);
  await Promise.all([
    w.buyer.mutation(api.returns.dispatch, {
      returnId,
      reference: "RETURN-DISPATCH",
      grams: 1001,
    }),
    w.buyer.mutation(api.returns.dispatch, {
      returnId,
      reference: "RETURN-DISPATCH",
      grams: 1001,
    }),
  ]);
  await w.seller.mutation(api.returns.receive, {
    returnId,
    reference: "RETURN-RECEIPT",
    grams: 1001,
  });
  await w.seller.mutation(api.returns.receive, {
    returnId,
    reference: "RETURN-RECEIPT",
    grams: 1001,
  });
  await expect(
    w.seller.mutation(api.returns.reconcile, { returnId }),
  ).rejects.toThrow(/PROVIDER/);
  const movements = await w.t.run((ctx) =>
    ctx.db.query("inventoryMovements").collect(),
  );
  expect(
    movements
      .filter((row) => row.sourceKey.startsWith(`return:${returnId}:`))
      .map((row) => [row.deltaGrams, row.costDeltaPaise]),
  ).toEqual([
    [-1001, -1001],
    [1001, 400],
  ]);
  expect(await w.t.run((ctx) => ctx.db.get("trades", w.tradeId))).toMatchObject(
    { grams: 1001, totalPaise: 1001, status: "completed" },
  );
  await w.t.run(async (ctx) => {
    await ctx.db.patch("tradeFinancials", w.financialId, {
      refund: "refunded",
      settlement: "reversed",
    });
    const now = Date.now();
    const refundId = await ctx.db.insert("cashfreeRefunds", {
      orderId: w.orderId,
      tradeId: w.tradeId,
      reference: "SYNTHETIC",
      reason: "Synthetic provider fixture",
      amountPaise: 1001,
      providerRefundId: "SYNTHETIC",
      idempotencyKey: "SYNTHETIC",
      actorId: "SYNTHETIC",
      status: "success",
      lease: 0,
      leaseUntil: 0,
      attempts: 1,
      createdAt: now,
      updatedAt: now,
    });
    await ctx.db.insert("cashfreeRefundEvidence", {
      refundId,
      fingerprint: "SYNTHETIC",
      status: "success",
      providerRefundId: "SYNTHETIC",
      amountPaise: 1001,
      createdAt: now,
    });
    await ctx.db.insert("cashfreeSettlementEvidence", {
      orderId: w.orderId,
      settlementId: "SYNTHETIC",
      vendorId: "SYNTHETIC",
      allocationPaise: 1001,
      feePaise: 0,
      status: "reversed",
      fingerprint: "SYNTHETIC",
      createdAt: now,
    });
  });
  await w.buyer.mutation(api.returns.reconcile, { returnId });
  const reconciled = await w.buyer.query(api.returns.mine, {});
  expect(reconciled.rows[0].status).toBe("reconciled");
});

it("blocks unrelated or suspended parties and stock already promised elsewhere", async () => {
  const w = await world(),
    returnId = await propose(w);
  await expect(
    w.outsider.mutation(api.returns.review, { returnId, accept: true }),
  ).rejects.toThrow(/TRADE_NOT_FOUND/);
  const listing = await w.buyer.mutation(api.market.createListing, {
    materialCode: "PAPER-NEWS",
    grams: 1001,
    askPaisePerKg: 100,
  });
  await expect(
    w.seller.mutation(api.returns.review, { returnId, accept: true }),
  ).rejects.toThrow(/RETURN_STOCK_NOT_FREE/);
  await w.buyer.mutation(api.market.withdraw, { listingId: listing });
  await w.seller.mutation(api.returns.review, { returnId, accept: true });
  await expect(
    w.buyer.mutation(api.market.createListing, {
      materialCode: "PAPER-NEWS",
      grams: 1,
      askPaisePerKg: 100,
    }),
  ).rejects.toThrow(/NOT_ENOUGH_STOCK/);
  await w.t.run((ctx) =>
    ctx.db.patch("orgs", w.sellerOrgId, { status: "suspended" }),
  );
  await expect(
    w.buyer.mutation(api.returns.dispatch, {
      returnId,
      reference: "RETURN-DISPATCH",
      grams: 1001,
    }),
  ).rejects.toThrow(/INACTIVE/);
});

it("prevents double allocation in one scheme and fails closed after source invalidation", async () => {
  const w = await world(),
    id = await declare(w, 700);
  expect(await declare(w, 700)).toBe(id);
  await expect(declare(w, 302, "ALLOC-TEST-2")).rejects.toThrow(
    /ALREADY_ALLOCATED/,
  );
  await declare(w, 301, "ALLOC-TEST-2");
  const unrelated = await w.outsider.query(api.schemeClaims.mine, {});
  expect(unrelated.rows).toHaveLength(0);
  await expect(
    w.seller.mutation(api.schemeClaims.withdrawDeclaration, {
      allocationId: id,
      reason: "Not owned",
    }),
  ).rejects.toThrow(/NOT_FOUND/);
  await w.t.run((ctx) =>
    ctx.db.patch("orgs", w.sellerOrgId, { status: "suspended" }),
  );
  const invalid = await w.buyer.query(api.schemeClaims.mine, {});
  expect(invalid.rows.every((row) => row.effectiveStatus === "withdrawn")).toBe(
    true,
  );
  expect(
    await w.buyer.mutation(api.schemeClaims.validate, { allocationId: id }),
  ).toBe(false);
  expect(
    await w.t.run((ctx) => ctx.db.get("schemeAllocations", id)),
  ).toMatchObject({ status: "withdrawn" });
});

async function clearFixtureReservations(ctx: MutationCtx, orgId: Id<"orgs">) {
  const listings = await ctx.db
    .query("listings")
    .withIndex("by_org", (q) => q.eq("orgId", orgId))
    .collect();
  for (const row of listings)
    await ctx.db.patch("listings", row._id, { status: "withdrawn" });
  const trades = await ctx.db
    .query("trades")
    .withIndex("by_seller", (q) => q.eq("sellerOrgId", orgId))
    .collect();
  for (const row of trades)
    await ctx.db.patch("trades", row._id, { status: "declined" });
}

it("withdraws the effective claim after an accepted source inspection is superseded by rejection", async () => {
  const w = await world();
  const input = await w.seller.mutation(api.traceability.declareLot, {
    materialCode: "PAPER-NEWS",
    state: "Source test",
    grams: 1001,
  });
  const transformation = await w.seller.mutation(api.traceability.transform, {
    inputLotId: input,
    inputGrams: 1001,
    contaminationGrams: 0,
    processLossGrams: 0,
    outputs: [
      { materialCode: "PAPER-NEWS", state: "Tested output", grams: 1001 },
    ],
  });
  const lot = await w.t.run((ctx) =>
    ctx.db
      .query("materialLots")
      .withIndex("by_parent_transformation", (q) =>
        q.eq("parentTransformationId", transformation),
      )
      .first(),
  );
  if (!lot) throw new Error("Missing output");
  const fields = {
    lotId: lot._id,
    specificationReference: "TEST-SPEC",
    specificationVersion: "1",
    sampleMethod: "Test sample",
    results: [{ parameter: "Moisture", unit: "%", value: "1" }],
  };
  const original = await w.seller.mutation(api.quality.recordInspection, {
    ...fields,
    decision: "accepted",
  });
  await w.t.run((ctx) =>
    ctx.db.patch("trades", w.tradeId, {
      specification: {
        grade: "TEST",
        specification: "TEST-SPEC",
        lotId: lot._id,
        source: "seller_declared",
      },
    }),
  );
  const allocationId = await declare(w);
  const correction = await w.seller.mutation(api.quality.proposeCorrection, {
    ...fields,
    supersedesInspectionId: original,
    reason: "Corrected failed test",
    decision: "rejected",
  });
  const before = await w.buyer.query(api.schemeClaims.mine, {});
  expect(before.rows[0].effectiveStatus).toBe("declared");
  await w.t.run(async (ctx) => {
    const profile = await ctx.db
      .query("profiles")
      .withIndex("by_phone", (q) => q.eq("phone", "+919000000102"))
      .unique();
    if (!profile) throw new Error("Missing profile");
    await ctx.db.insert("memberships", {
      profileId: profile._id,
      orgId: w.sellerOrgId,
      role: "owner",
      createdAt: Date.now(),
    });
    await ctx.db.patch("profiles", profile._id, { activeOrgId: w.sellerOrgId });
  });
  await w.buyer.mutation(api.quality.approveCorrection, {
    inspectionId: correction,
  });
  await w.t.run(async (ctx) => {
    const profile = await ctx.db
      .query("profiles")
      .withIndex("by_phone", (q) => q.eq("phone", "+919000000102"))
      .unique();
    if (!profile) throw new Error("Missing profile");
    await ctx.db.patch("profiles", profile._id, { activeOrgId: w.buyerOrgId });
  });
  const after = await w.buyer.query(api.schemeClaims.mine, {});
  expect(after.rows[0]).toMatchObject({
    effectiveStatus: "withdrawn",
    invalidReason: "SOURCE_NO_LONGER_ELIGIBLE",
  });
  expect(
    await w.buyer.mutation(api.schemeClaims.validate, { allocationId }),
  ).toBe(false);
  expect(
    await w.t.run((ctx) => ctx.db.get("lotInspections", original)),
  ).toMatchObject({ decision: "accepted" });
});

it("holds a received quality-disputed source against sale and claims while allowing its approved return", async () => {
  const w = await world();
  await w.t.run((ctx) =>
    ctx.db.patch("tradeFinancials", w.financialId, {
      state: "hold",
      holdReason: "buyer_quality_rejection",
    }),
  );
  await expect(
    w.buyer.mutation(api.market.createListing, {
      materialCode: "PAPER-NEWS",
      grams: 1,
      askPaisePerKg: 100,
    }),
  ).rejects.toThrow(/NOT_ENOUGH_STOCK/);
  await expect(declare(w)).rejects.toThrow(/SOURCE_FINANCIAL_HOLD/);
  const returnId = await propose(w);
  await w.seller.mutation(api.returns.review, { returnId, accept: true });
  await w.buyer.mutation(api.returns.dispatch, {
    returnId,
    grams: 1001,
    reference: "RETURN-HELD-SOURCE",
  });
  expect(
    await w.t.run((ctx) => ctx.db.get("materialReturns", returnId)),
  ).toMatchObject({ status: "in_transit" });
});
