/// <reference types="vite/client" />
// @vitest-environment edge-runtime
import { convexTest } from "convex-test";
import { afterEach, expect, it, vi } from "vitest";

import { api, internal } from "./_generated/api";
import {
  convexModules,
  registerAuth,
  seedDemo,
  signIn,
  signInAs,
} from "./lib/auth.testing";
import schema from "./schema";
const modules = convexModules(import.meta.glob("./**/*.*s"));
const key = "00000000-0000-4000-8000-000000000001";
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});
async function world(feePayer: "platform" | "seller" = "platform") {
  vi.useFakeTimers();
  vi.stubEnv("AUTH_DEV_MODE", "true");
  vi.stubEnv("CASHFREE_MODE", "live");
  vi.stubEnv("CASHFREE_LIVE_CLIENT_ID", "test-id");
  vi.stubEnv("CASHFREE_LIVE_CLIENT_SECRET", "test-secret");
  vi.stubEnv("CASHFREE_LIVE_CHECKOUT_ENABLED", "true");
  const t = convexTest(schema, modules);
  registerAuth(t);
  await seedDemo(t);
  vi.stubEnv("ADMIN_EMAIL", "admin@example.test");
  vi.stubEnv("CASHFREE_LIVE_POLICY_VERSION", "test-v1");
  const admin = await signIn(t, {
    email: "admin@example.test",
    twoFactorEnabled: true,
  });
  await admin.mutation(api.cashfreeLifecycle.savePolicyForAdmin, {
    version: "test-v1",
    feePayer,
    refundFunder: "seller",
    refundAuthority: "platform_admin",
    settlementTermsReference: "Approved test settlement terms",
    providerAcceptanceReference: "Injected test approval only",
  });
  const buyer = await signInAs(t, "+919000000102");
  const seller = await signInAs(t, "+919000000101");
  const outsider = await signInAs(t, "+919000000103");
  const scope = await t.run(async (ctx) => {
    const buyerOrg = await ctx.db
      .query("orgs")
      .withIndex("by_slug", (q) => q.eq("slug", "peenya-yard"))
      .unique();
    const listing = await ctx.db.query("listings").first();
    const sellerOrg = await ctx.db
      .query("orgs")
      .withIndex("by_kind_city", (q) => q.eq("kind", "kabadiwala"))
      .first();
    // Pick by actual memberships to avoid assumptions about demonstration slugs.
    const profile = await ctx.db
      .query("profiles")
      .withIndex("by_phone", (q) => q.eq("phone", "+919000000102"))
      .unique();
    const membership = profile
      ? await ctx.db
          .query("memberships")
          .withIndex("by_profile", (q) => q.eq("profileId", profile._id))
          .first()
      : null;
    const buyerId = buyerOrg?._id ?? membership?.orgId;
    if (!buyerId || !listing || !sellerOrg)
      throw new Error("missing test world");
    const tradeId = await ctx.db.insert("trades", {
      listingId: listing._id,
      buyerOrgId: buyerId,
      sellerOrgId: sellerOrg._id,
      materialCode: listing.materialCode,
      grams: 1000,
      paisePerKg: 17_001,
      totalPaise: 17_001,
      status: "accepted",
      timeline: [{ status: "accepted", at: Date.now() }],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
    return { tradeId, sellerOrgId: sellerOrg._id };
  });
  await t.mutation(internal.cashfreePayments.registerVendor, {
    orgId: scope.sellerOrgId,
    mode: "live",
    vendorId: "test_seller",
  });
  await t.mutation(internal.cashfreePayments.recordVendor, {
    mode: "live",
    vendorId: "test_seller",
    status: "ACTIVE",
  });
  return { t, buyer, seller, outsider, admin, ...scope };
}
async function prepare(w: Awaited<ReturnType<typeof world>>) {
  const id = await w.buyer.mutation(internal.cashfreePayments.prepare, {
    tradeId: w.tradeId,
    idempotencyKey: key,
    mode: "live",
  });
  const order = await w.t.run((ctx) => ctx.db.get("cashfreeOrders", id));
  if (!order) throw new Error("missing order");
  return order;
}
async function collect(w: Awaited<ReturnType<typeof world>>) {
  const order = await prepare(w);
  const claimed = await w.t.mutation(internal.cashfreePayments.claim, {
    orderId: order._id,
  });
  if (!claimed) throw new Error("Missing claim");
  await w.t.mutation(internal.cashfreePayments.finish, {
    orderId: order._id,
    lease: claimed.lease,
    outcome: "paid",
    cfOrderId: "123",
    paymentId: "456",
  });
  return order;
}
it("requires explicit live mode, activation and an approved policy", async () => {
  const w = await world();
  await expect(
    w.buyer.mutation(internal.cashfreePayments.prepare, {
      tradeId: w.tradeId,
      idempotencyKey: key,
    }),
  ).rejects.toThrow("GATEWAY_REQUIRED");
  vi.stubEnv("CASHFREE_LIVE_CHECKOUT_ENABLED", "false");
  await expect(prepare(w)).rejects.toThrow("GATEWAY_REQUIRED");
  vi.stubEnv("CASHFREE_LIVE_CHECKOUT_ENABLED", "true");
  vi.stubEnv("CASHFREE_LIVE_POLICY_VERSION", "missing");
  await expect(prepare(w)).rejects.toThrow("GATEWAY_REQUIRED");
});
it("freezes policy versions and denies nonadmin and missing TOTP policy changes", async () => {
  const w = await world();
  const policy = {
    version: "test-v1",
    feePayer: "platform" as const,
    refundFunder: "seller" as const,
    refundAuthority: "platform_admin" as const,
    settlementTermsReference: "Approved test settlement terms",
    providerAcceptanceReference: "Injected test approval only",
  };
  const before = await w.admin.mutation(
    api.cashfreeLifecycle.savePolicyForAdmin,
    policy,
  );
  expect(
    await w.admin.mutation(api.cashfreeLifecycle.savePolicyForAdmin, policy),
  ).toBe(before);
  await expect(
    w.admin.mutation(api.cashfreeLifecycle.savePolicyForAdmin, {
      ...policy,
      refundFunder: "platform",
    }),
  ).rejects.toThrow("POLICY_IMMUTABLE");
  await expect(
    w.buyer.mutation(api.cashfreeLifecycle.savePolicyForAdmin, policy),
  ).rejects.toThrow("NOT_ADMIN");
  vi.stubEnv("ADMIN_EMAIL", "new-admin@example.test");
  const unverified = await signIn(w.t, { email: "new-admin@example.test" });
  await expect(
    unverified.mutation(api.cashfreeLifecycle.savePolicyForAdmin, policy),
  ).rejects.toThrow("TWO_FACTOR_REQUIRED");
});
it("authorizes once without moving stock, then dispatches and receives exactly once", async () => {
  const w = await world();
  const stock = () => w.t.run((ctx) => ctx.db.query("inventory").collect());
  const before = await stock();
  const order = await collect(w);
  expect(await stock()).toEqual(before);
  const observed1 = await w.seller.query(api.cashfreeLifecycle.status, {
    tradeId: w.tradeId,
  });
  expect(observed1?.actions).toEqual(["dispatch"]);
  await Promise.all([
    w.seller.mutation(api.cashfreeLifecycle.act, {
      tradeId: w.tradeId,
      action: "dispatch",
      reference: "LOAD-001",
    }),
    w.seller.mutation(api.cashfreeLifecycle.act, {
      tradeId: w.tradeId,
      action: "dispatch",
      reference: "LOAD-001",
    }),
  ]);
  await w.buyer.mutation(api.cashfreeLifecycle.act, {
    tradeId: w.tradeId,
    action: "receive",
    reference: "GRN-001",
  });
  await w.buyer.mutation(api.cashfreeLifecycle.act, {
    tradeId: w.tradeId,
    action: "receive",
    reference: "GRN-001",
  });
  const movements = await w.t.run((ctx) =>
    ctx.db.query("financialMovements").collect(),
  );
  expect(movements.map((x) => x.grams).toSorted((a, b) => a - b)).toEqual([
    -1000, 1000,
  ]);
  const observed2 = await w.buyer.query(api.cashfreeLifecycle.status, {
    tradeId: w.tradeId,
  });
  const inventoryMovements = await w.t.run((ctx) =>
    ctx.db.query("inventoryMovements").collect(),
  );
  const orderMovements = inventoryMovements.filter((row) =>
    row.sourceKey.startsWith(`trade:${w.tradeId}:`),
  );
  expect(orderMovements).toHaveLength(2);
  expect(
    orderMovements
      .map((row) => row.deltaGrams)
      .reduce((sum, grams) => sum + grams, 0),
  ).toBe(0);
  expect(observed2?.state).toBe("received");
  const claim = await w.t.mutation(internal.cashfreePayments.claim, {
    orderId: order._id,
  });
  if (!claim) throw new Error("claim");
  await w.t.mutation(internal.cashfreePayments.finish, {
    orderId: order._id,
    lease: claim.lease,
    outcome: "paid",
    cfOrderId: "123",
    paymentId: "456",
  });
  const observed3 = await w.buyer.query(api.cashfreeLifecycle.status, {
    tradeId: w.tradeId,
  });
  expect(observed3?.state).toBe("received");
});
it("denies wrong party, outsider, legacy states and inconsistent movement retries", async () => {
  const w = await world();
  await collect(w);
  await expect(
    w.buyer.mutation(api.cashfreeLifecycle.act, {
      tradeId: w.tradeId,
      action: "dispatch",
      reference: "LOAD-001",
    }),
  ).rejects.toThrow("GATEWAY_REQUIRED");
  await expect(
    w.outsider.query(api.cashfreeLifecycle.status, { tradeId: w.tradeId }),
  ).rejects.toThrow("TRADE_NOT_FOUND");
  await w.seller.mutation(api.cashfreeLifecycle.act, {
    tradeId: w.tradeId,
    action: "dispatch",
    reference: "LOAD-001",
  });
  await expect(
    w.seller.mutation(api.cashfreeLifecycle.act, {
      tradeId: w.tradeId,
      action: "dispatch",
      reference: "DIFFERENT",
    }),
  ).rejects.toThrow("MOVEMENT_CONFLICT");
});
it("releases a no-order cancellation once and holds late payment after cancellation request", async () => {
  const w = await world();
  await w.buyer.mutation(api.cashfreeLifecycle.requestCancellation, {
    tradeId: w.tradeId,
    reason: "No order required",
  });
  const observed4 = await w.buyer.query(api.cashfreeLifecycle.status, {
    tradeId: w.tradeId,
  });
  expect(observed4?.state).toBe("cancelled");
  await expect(prepare(w)).rejects.toThrow("INVALID_TRADE_STATE");
  const second = await world();
  const order = await prepare(second);
  await second.buyer.mutation(api.cashfreeLifecycle.requestCancellation, {
    tradeId: second.tradeId,
    reason: "Cancel this accepted purchase",
  });
  const claim = await second.t.mutation(internal.cashfreePayments.claim, {
    orderId: order._id,
  });
  if (!claim) throw new Error("claim");
  await second.t.mutation(internal.cashfreePayments.finish, {
    orderId: order._id,
    lease: claim.lease,
    outcome: "paid",
    paymentId: "456",
  });
  const observed5 = await second.buyer.query(api.cashfreeLifecycle.status, {
    tradeId: second.tradeId,
  });
  expect(observed5?.state).toBe("hold");
  const observed6 = await second.t.run((ctx) =>
    ctx.db.get("trades", second.tradeId),
  );
  expect(observed6?.status).toBe("accepted");
});
it("expiry without terminal proof does not release reservation; terminal unpaid proof does", async () => {
  const w = await world();
  const order = await prepare(w);
  await w.t.run((ctx) =>
    ctx.db.patch("cashfreeOrders", order._id, { expiresAt: Date.now() - 1 }),
  );
  let claimed = await w.t.mutation(internal.cashfreePayments.claim, {
    orderId: order._id,
  });
  if (!claimed) throw new Error("claim");
  await w.t.mutation(internal.cashfreePayments.finish, {
    orderId: order._id,
    lease: claimed.lease,
    outcome: "closed",
  });
  const observed7 = await w.t.run((ctx) => ctx.db.get("trades", w.tradeId));
  expect(observed7?.status).toBe("accepted");
  claimed = await w.t.mutation(internal.cashfreePayments.claim, {
    orderId: order._id,
  });
  if (!claimed) throw new Error("claim");
  await w.t.mutation(internal.cashfreePayments.finish, {
    orderId: order._id,
    lease: claimed.lease,
    outcome: "closed",
    unpaidTerminal: true,
  });
  const observed8 = await w.buyer.query(api.cashfreeLifecycle.status, {
    tradeId: w.tradeId,
  });
  expect(observed8?.state).toBe("cancelled");
});
it.each(["request", "terminal"])(
  "preserves an external-refund review hold during %s cancellation",
  async (kind) => {
    const w = await world();
    const order = await prepare(w);
    await w.t.mutation(internal.cashfreeRefunds.notify, {
      mode: "live",
      providerOrderId: order.providerOrderId,
      providerRefundId: "unknown-provider-refund",
      bodyHash: "external-refund",
    });
    if (kind === "request") {
      await expect(
        w.buyer.mutation(api.cashfreeLifecycle.requestCancellation, {
          tradeId: w.tradeId,
          reason: "Cancel this accepted purchase",
        }),
      ).rejects.toThrow("REVIEW_REQUIRED");
    } else {
      const claimed = await w.t.mutation(internal.cashfreePayments.claim, {
        orderId: order._id,
      });
      if (!claimed) throw new Error("Missing claim");
      await w.t.mutation(internal.cashfreePayments.finish, {
        orderId: order._id,
        lease: claimed.lease,
        outcome: "closed",
        unpaidTerminal: true,
      });
    }
    expect(
      await w.buyer.query(api.cashfreeLifecycle.status, { tradeId: w.tradeId }),
    ).toMatchObject({
      state: "hold",
      holdReason: "external_refund_requires_review",
      actions: [],
    });
    expect(
      await w.t.run((ctx) => ctx.db.get("trades", w.tradeId)),
    ).toMatchObject({
      status: "accepted",
    });
  },
);
it("holds verified funds when a later signed payment conflicts, before stock can move", async () => {
  const w = await world();
  const order = await collect(w);
  const before = await w.t.run((ctx) => ctx.db.query("inventory").collect());
  await w.t.mutation(internal.cashfreePayments.observe, {
    mode: "live",
    providerOrderId: order.providerOrderId,
    providerPaymentId: "789",
    status: "SUCCESS",
    orderPaise: order.totalPaise,
    paymentPaise: order.totalPaise - 1,
    currency: "INR",
    orderCurrency: "INR",
    customerId: order.customerId,
    timestamp: Date.now(),
    bodyHash: "conflicting-success",
  });
  expect(
    await w.seller.query(api.cashfreeLifecycle.status, { tradeId: w.tradeId }),
  ).toMatchObject({ state: "hold", collection: "live_confirmed", actions: [] });
  await expect(
    w.seller.mutation(api.cashfreeLifecycle.act, {
      tradeId: w.tradeId,
      action: "dispatch",
      reference: "LOAD-CONFLICT",
    }),
  ).rejects.toThrow("GATEWAY_REQUIRED");
  expect(await w.t.run((ctx) => ctx.db.query("inventory").collect())).toEqual(
    before,
  );
});
it.each([
  { action: "dispatch" as const, stockGrams: Number.MAX_SAFE_INTEGER + 1 },
  { action: "receive" as const, stockGrams: -1 },
])(
  "rejects an invalid existing stock balance before $action",
  async ({ action, stockGrams }) => {
    const w = await world();
    await collect(w);
    if (action === "receive")
      await w.seller.mutation(api.cashfreeLifecycle.act, {
        tradeId: w.tradeId,
        action: "dispatch",
        reference: "LOAD-001",
      });
    const operator = action === "dispatch" ? w.seller : w.buyer;
    const inventoryId = await w.t.run(async (ctx) => {
      const trade = await ctx.db.get("trades", w.tradeId);
      if (!trade) throw new Error("Missing trade");
      const inventory = await ctx.db
        .query("inventory")
        .withIndex("by_org_material", (q) =>
          q
            .eq(
              "orgId",
              action === "dispatch" ? trade.sellerOrgId : trade.buyerOrgId,
            )
            .eq("materialCode", trade.materialCode),
        )
        .unique();
      if (!inventory) throw new Error("Missing stock");
      await ctx.db.patch("inventory", inventory._id, { grams: stockGrams });
      return inventory._id;
    });
    await expect(
      operator.mutation(api.cashfreeLifecycle.act, {
        tradeId: w.tradeId,
        action,
        reference: "MOVEMENT-INVALID-STOCK",
      }),
    ).rejects.toThrow("INVALID_WEIGHT");
    expect(
      await w.t.run((ctx) => ctx.db.get("inventory", inventoryId)),
    ).toMatchObject({
      grams: stockGrams,
    });
    expect(
      await w.t.run((ctx) =>
        ctx.db
          .query("financialMovements")
          .withIndex("by_trade_kind", (q) =>
            q.eq("tradeId", w.tradeId).eq("kind", action),
          )
          .unique(),
      ),
    ).toBeNull();
  },
);
it("persists one full refund identity and never creates a second refund or returns physical stock", async () => {
  const w = await world();
  await collect(w);
  const stock = await w.t.run((ctx) => ctx.db.query("inventory").collect());
  const args = {
    tradeId: w.tradeId,
    reference: "REF-001",
    reason: "Approved full cancellation",
    key,
  };
  const refundId = await w.admin.mutation(
    internal.cashfreeRefunds.prepare,
    args,
  );
  expect(await w.admin.mutation(internal.cashfreeRefunds.prepare, args)).toBe(
    refundId,
  );
  await expect(
    w.admin.mutation(internal.cashfreeRefunds.prepare, {
      ...args,
      reference: "REF-002",
    }),
  ).rejects.toThrow("REFUND_UNAVAILABLE");
  const claimed = await w.admin.mutation(internal.cashfreeRefunds.claim, {
    refundId,
    manual: true,
  });
  if (!claimed) throw new Error("claim");
  expect(claimed.refund.amountPaise).toBe(17_001);
  await w.t.mutation(internal.cashfreeRefunds.finish, {
    refundId,
    lease: claimed.refund.lease,
    outcome: "success",
    providerRefundId: claimed.refund.providerRefundId,
    amountPaise: 17_001,
    fingerprint: "test-full-refund",
  });
  expect(await w.t.run((ctx) => ctx.db.query("inventory").collect())).toEqual(
    stock,
  );
  const observed9 = await w.buyer.query(api.cashfreeLifecycle.status, {
    tradeId: w.tradeId,
  });
  expect(observed9?.refund).toBe("refunded");
  const observed10 = await w.buyer.query(api.cashfreeLifecycle.status, {
    tradeId: w.tradeId,
  });
  expect(observed10?.actions).toEqual([]);
});
it("rejects mismatched refund amount without confirming a refund", async () => {
  const w = await world();
  await collect(w);
  const refundId = await w.admin.mutation(internal.cashfreeRefunds.prepare, {
    tradeId: w.tradeId,
    reference: "REF-001",
    reason: "Approved refund",
    key,
  });
  const claimed = await w.admin.mutation(internal.cashfreeRefunds.claim, {
    refundId,
    manual: true,
  });
  if (!claimed) throw new Error("claim");
  await w.t.mutation(internal.cashfreeRefunds.finish, {
    refundId,
    lease: claimed.refund.lease,
    outcome: "success",
    providerRefundId: claimed.refund.providerRefundId,
    amountPaise: 17_000,
    fingerprint: "partial",
  });
  const observed11 = await w.buyer.query(api.cashfreeLifecycle.status, {
    tradeId: w.tradeId,
  });
  expect(observed11?.refund).toBe("review");
});
it("requires matching order allocation plus signed vendor success and preserves reversals", async () => {
  const w = await world();
  const order = await collect(w);
  const record = {
    orderId: order._id,
    settlementId: "settle-1",
    vendorId: "test_seller",
    allocationPaise: 17_001,
    feePaise: 0,
    fingerprint: "lookup-1",
    matches: true,
  };
  await w.t.mutation(internal.cashfreeSettlements.record, record);
  const observed12 = await w.buyer.query(api.cashfreeLifecycle.status, {
    tradeId: w.tradeId,
  });
  expect(observed12?.settlement).toBe("pending");
  const event = {
    mode: "live" as const,
    vendorId: "test_seller",
    settlementId: "settle-1",
    status: "SUCCESS" as const,
    amountPaise: 17_001,
    settlementPaise: 17_001,
    grossPaise: 17_001,
    feePaise: 0,
    adjustmentPaise: 0,
    eventAt: Date.now(),
    bodyHash: "a".repeat(64),
  };
  await w.t.mutation(internal.cashfreeSettlements.observe, event);
  await w.t.mutation(internal.cashfreeSettlements.record, record);
  const observed13 = await w.buyer.query(api.cashfreeLifecycle.status, {
    tradeId: w.tradeId,
  });
  expect(observed13?.settlement).toBe("settled");
  await w.t.mutation(internal.cashfreeSettlements.observe, {
    ...event,
    status: "REVERSED",
    bodyHash: "b".repeat(64),
  });
  await w.t.mutation(internal.cashfreeSettlements.record, record);
  const observed14 = await w.buyer.query(api.cashfreeLifecycle.status, {
    tradeId: w.tradeId,
  });
  expect(observed14?.settlement).toBe("reversed");
  await w.t.mutation(internal.cashfreeSettlements.observe, {
    ...event,
    bodyHash: "c".repeat(64),
  });
  await w.t.mutation(internal.cashfreeSettlements.record, record);
  const observed15 = await w.buyer.query(api.cashfreeLifecycle.status, {
    tradeId: w.tradeId,
  });
  expect(observed15?.settlement).toBe("reversed");
});
it.each(["pending", "refunded", "settlement"])(
  "keeps confirmed collection and independent %s hold across replay",
  async (kind) => {
    const w = await world();
    const order = await collect(w);
    await w.t.run(async (ctx) => {
      const row = await ctx.db
        .query("tradeFinancials")
        .withIndex("by_trade", (q) => q.eq("tradeId", w.tradeId))
        .unique();
      if (!row) throw new Error("row");
      await ctx.db.patch("tradeFinancials", row._id, {
        state: "hold",
        holdReason: "independent_hold",
        refund: (
          {
            settlement: "none",
            refunded: "refunded",
            pending: "pending",
          } as const
        )[kind as "settlement" | "refunded" | "pending"],
      });
    });
    const claim = await w.t.mutation(internal.cashfreePayments.claim, {
      orderId: order._id,
    });
    if (!claim) throw new Error("claim");
    await w.t.mutation(internal.cashfreePayments.finish, {
      orderId: order._id,
      lease: claim.lease,
      outcome: "paid",
      paymentId: "456",
      cfOrderId: "123",
    });
    expect(
      await w.buyer.query(api.cashfreeLifecycle.status, { tradeId: w.tradeId }),
    ).toMatchObject({
      collection: "live_confirmed",
      state: "hold",
      holdReason: "independent_hold",
      actions: [],
    });
  },
);
it("holds revoked material at dispatch without changing confirmed funds or stock", async () => {
  const w = await world();
  await collect(w);
  const before = await w.t.run((ctx) => ctx.db.query("inventory").collect());
  await w.t.run(async (ctx) => {
    const trade = await ctx.db.get("trades", w.tradeId);
    if (!trade) throw new Error("trade");
    const material = await ctx.db
      .query("materials")
      .withIndex("by_code", (q) => q.eq("code", trade.materialCode))
      .unique();
    if (!material) throw new Error("material");
    await ctx.db.patch("materials", material._id, { active: false });
  });
  await w.seller.mutation(api.cashfreeLifecycle.act, {
    tradeId: w.tradeId,
    action: "dispatch",
    reference: "LOAD-001",
  });
  expect(await w.t.run((ctx) => ctx.db.query("inventory").collect())).toEqual(
    before,
  );
  expect(
    await w.buyer.query(api.cashfreeLifecycle.status, { tradeId: w.tradeId }),
  ).toMatchObject({
    collection: "live_confirmed",
    state: "hold",
    holdReason: "material_eligibility_changed",
  });
});
it("does not treat sandbox funds as an obligation when cancelling the real trade", async () => {
  const w = await world();
  vi.stubEnv("CASHFREE_MODE", "sandbox");
  vi.stubEnv("CASHFREE_SANDBOX_CLIENT_ID", "sandbox-id");
  vi.stubEnv("CASHFREE_SANDBOX_CLIENT_SECRET", "sandbox-secret");
  vi.stubEnv("CASHFREE_SANDBOX_CHECKOUT_ENABLED", "true");
  await w.t.mutation(internal.cashfreePayments.registerVendor, {
    orgId: w.sellerOrgId,
    mode: "sandbox",
    vendorId: "sandbox_seller",
  });
  await w.t.mutation(internal.cashfreePayments.recordVendor, {
    mode: "sandbox",
    vendorId: "sandbox_seller",
    status: "ACTIVE",
  });
  const orderId = await w.buyer.mutation(internal.cashfreePayments.prepare, {
    tradeId: w.tradeId,
    idempotencyKey: key,
  });
  await w.t.run((ctx) =>
    ctx.db.patch("cashfreeOrders", orderId, {
      collection: "sandbox_confirmed",
      checkout: "closed",
    }),
  );
  await w.buyer.mutation(api.cashfreeLifecycle.requestCancellation, {
    tradeId: w.tradeId,
    reason: "Cancel real trade",
  });
  expect(
    await w.buyer.query(api.cashfreeLifecycle.status, { tradeId: w.tradeId }),
  ).toMatchObject({ state: "cancelled", collection: "pending" });
});
it("late but fully proved captured payment can be refunded while delivery stays held", async () => {
  const w = await world();
  const order = await prepare(w);
  await w.t.run((ctx) =>
    ctx.db.patch("cashfreeOrders", order._id, { expiresAt: Date.now() - 1 }),
  );
  const claim = await w.t.mutation(internal.cashfreePayments.claim, {
    orderId: order._id,
  });
  if (!claim) throw new Error("claim");
  await w.t.mutation(internal.cashfreePayments.finish, {
    orderId: order._id,
    lease: claim.lease,
    outcome: "paid",
    cfOrderId: "123",
    paymentId: "456",
  });
  expect(
    await w.buyer.query(api.cashfreeLifecycle.status, { tradeId: w.tradeId }),
  ).toMatchObject({ collection: "live_confirmed", state: "hold", actions: [] });
  await expect(
    w.admin.mutation(internal.cashfreeRefunds.prepare, {
      tradeId: w.tradeId,
      reference: "LATE-REFUND",
      reason: "Refund late captured payment",
      key,
    }),
  ).resolves.toBeTruthy();
});
it("a new signed refund trigger permits one lookup after automatic retry exhaustion", async () => {
  const w = await world();
  const order = await collect(w);
  const refundId = await w.admin.mutation(internal.cashfreeRefunds.prepare, {
    tradeId: w.tradeId,
    reference: "REF-001",
    reason: "Full refund",
    key,
  });
  await w.t.run((ctx) =>
    ctx.db.patch("cashfreeRefunds", refundId, { attempts: 4 }),
  );
  expect(
    await w.t.mutation(internal.cashfreeRefunds.claim, { refundId }),
  ).toBeNull();
  const refund = await w.t.run((ctx) =>
    ctx.db.get("cashfreeRefunds", refundId),
  );
  if (!refund) throw new Error("refund");
  await w.t.mutation(internal.cashfreeRefunds.notify, {
    mode: "live",
    providerOrderId: order.providerOrderId,
    providerRefundId: refund.providerRefundId,
    bodyHash: "d".repeat(64),
  });
  const trigger = await w.t.run((ctx) =>
    ctx.db.query("cashfreeRefundTriggers").first(),
  );
  if (!trigger) throw new Error("trigger");
  expect(
    await w.t.mutation(internal.cashfreeRefunds.claim, {
      refundId,
      triggerId: trigger._id,
    }),
  ).not.toBeNull();
  await w.t.run((ctx) =>
    ctx.db.patch("cashfreeRefunds", refundId, { leaseUntil: 0 }),
  );
  expect(
    await w.t.mutation(internal.cashfreeRefunds.claim, {
      refundId,
      triggerId: trigger._id,
    }),
  ).toBeNull();
});
it.each(["fee", "adjustment"])(
  "holds unsupported aggregate %s discrepancy instead of silently pending",
  async (kind) => {
    const w = await world();
    const order = await collect(w);
    await w.t.mutation(internal.cashfreeSettlements.observe, {
      mode: "live",
      vendorId: "test_seller",
      settlementId: "settle-review",
      status: "SUCCESS",
      amountPaise: 16_001,
      settlementPaise: 16_001,
      grossPaise: 17_001,
      feePaise: kind === "fee" ? 1000 : 0,
      adjustmentPaise: kind === "adjustment" ? 1000 : 0,
      eventAt: Date.now(),
      bodyHash: "e".repeat(64),
    });
    await w.t.mutation(internal.cashfreeSettlements.record, {
      orderId: order._id,
      settlementId: "settle-review",
      vendorId: "test_seller",
      allocationPaise: 17_001,
      feePaise: 0,
      fingerprint: "net-mismatch",
      matches: true,
    });
    expect(
      await w.buyer.query(api.cashfreeLifecycle.status, { tradeId: w.tradeId }),
    ).toMatchObject({ settlement: "review", state: "hold" });
  },
);

it("keeps revoked material on hold when collection arrives", async () => {
  const w = await world();
  const order = await prepare(w);
  await w.t.run(async (ctx) => {
    const trade = await ctx.db.get("trades", order.tradeId);
    if (!trade) throw new Error("trade");
    const material = await ctx.db
      .query("materials")
      .withIndex("by_code", (q) => q.eq("code", trade.materialCode))
      .unique();
    if (!material) throw new Error("material");
    await ctx.db.patch("materials", material._id, { active: false });
  });
  const claim = await w.t.mutation(internal.cashfreePayments.claim, {
    orderId: order._id,
  });
  if (!claim) throw new Error("claim");
  await w.t.mutation(internal.cashfreePayments.finish, {
    orderId: order._id,
    lease: claim.lease,
    outcome: "paid",
    cfOrderId: "123",
    paymentId: "456",
  });
  expect(
    await w.buyer.query(api.cashfreeLifecycle.status, { tradeId: w.tradeId }),
  ).toMatchObject({ collection: "live_confirmed", state: "hold", actions: [] });
  const movements = await w.t.run((ctx) =>
    ctx.db.query("financialMovements").collect(),
  );
  expect(movements).toEqual([]);
});
it("reconciles exact seller-paid provider fees from net and gross evidence", async () => {
  const w = await world("seller");
  const order = await collect(w);
  await w.t.mutation(internal.cashfreeSettlements.observe, {
    mode: "live",
    vendorId: "test_seller",
    settlementId: "net-seller",
    status: "SUCCESS",
    amountPaise: 16_001,
    settlementPaise: 16_001,
    grossPaise: 17_001,
    feePaise: 1000,
    adjustmentPaise: 0,
    eventAt: Date.now(),
    bodyHash: "f".repeat(64),
  });
  await w.t.mutation(internal.cashfreeSettlements.record, {
    orderId: order._id,
    settlementId: "net-seller",
    vendorId: "test_seller",
    allocationPaise: 16_001,
    feePaise: 1000,
    fingerprint: "net-seller-proof",
    matches: true,
  });
  expect(
    await w.buyer.query(api.cashfreeLifecycle.status, { tradeId: w.tradeId }),
  ).toMatchObject({ settlement: "settled", state: "authorized" });
});
