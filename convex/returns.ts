import { ConvexError, v } from "convex/values";

import type { Doc, Id } from "./_generated/dataModel";
import {
  mutation,
  type MutationCtx,
  query,
  type QueryCtx,
} from "./_generated/server";
import { financial, hold } from "./lib/cashfreeLifecycle";
import { recordInventoryMovement } from "./lib/inventoryLedger";
import { requiredLabel } from "./lib/lotEvidence";
import { requireCurrentTradeMaterial } from "./lib/marketEligibility";
import {
  activeTradeParty,
  requireFreeReturnStock,
  sourceEligibility,
  withdrawTradeClaims,
} from "./lib/returnClaims";
import { returnFields } from "./lib/returnClaimsSchema";
import { requireOrg } from "./lib/workspace";

async function audit(
  ctx: MutationCtx,
  row: Doc<"materialReturns">,
  actorProfileId: Id<"profiles">,
  action: string,
  metadata: Record<string, unknown> = {},
) {
  await ctx.db.insert("auditLog", {
    orgId: row.proposedByOrgId,
    actorProfileId,
    action: `material_return.${action}`,
    entityTable: "materialReturns",
    entityId: row._id,
    metadata: { tradeId: row.tradeId, ...metadata },
    createdAt: Date.now(),
  });
}
async function owned(
  ctx: QueryCtx,
  id: Id<"materialReturns">,
  orgId: Id<"orgs">,
) {
  const row = await ctx.db.get("materialReturns", id);
  if (!row) throw new ConvexError("RETURN_NOT_FOUND");
  const trade = await activeTradeParty(ctx, row.tradeId, orgId);
  if (row.destinationOrgId !== trade.sellerOrgId)
    throw new ConvexError("RETURN_DESTINATION_UNAVAILABLE");
  await requireCurrentTradeMaterial(ctx, trade);
  return { row, trade };
}
async function receivedOrigin(ctx: QueryCtx, trade: Doc<"trades">) {
  const payment = await financial(ctx, trade._id);
  const receipt = await ctx.db
    .query("inventoryMovements")
    .withIndex("by_org_source", (q) =>
      q
        .eq("orgId", trade.buyerOrgId)
        .eq("sourceKey", `trade:${trade._id}:receipt`),
    )
    .unique();
  if (
    trade.status !== "completed" ||
    payment?.collection !== "live_confirmed" ||
    receipt?.deltaGrams !== trade.grams
  )
    throw new ConvexError("RETURN_RECEIVED_ORDER_REQUIRED");
}
async function isMoneyReconciled(ctx: QueryCtx, tradeId: Id<"trades">) {
  const row = await financial(ctx, tradeId);
  if (
    row?.collection !== "live_confirmed" ||
    row.refund !== "refunded" ||
    row.settlement !== "reversed" ||
    !row.orderId
  )
    return false;
  const order = await ctx.db.get("cashfreeOrders", row.orderId);
  if (order?.mode !== "live" || order.collection !== "live_confirmed")
    return false;
  const refunds = await ctx.db
    .query("cashfreeRefunds")
    .withIndex("by_order", (q) => q.eq("orderId", order._id))
    .take(101);
  if (refunds.length > 100) return false;
  const refund = refunds.find(
    (value) =>
      value.status === "success" && value.amountPaise === order.totalPaise,
  );
  if (!refund) return false;
  const evidence = await ctx.db
    .query("cashfreeRefundEvidence")
    .withIndex("by_refund_fingerprint", (q) => q.eq("refundId", refund._id))
    .order("desc")
    .first();
  const settlement = await ctx.db
    .query("cashfreeSettlementEvidence")
    .withIndex("by_order", (q) => q.eq("orderId", order._id))
    .order("desc")
    .first();
  return (
    evidence?.status === "success" &&
    evidence.amountPaise === order.totalPaise &&
    settlement?.status === "reversed"
  );
}

export const propose = mutation({
  args: {
    tradeId: v.id("trades"),
    reference: v.string(),
    reason: v.string(),
    destinationOrgId: v.id("orgs"),
    freightPayer: v.union(v.literal("buyer"), v.literal("seller")),
  },
  returns: v.id("materialReturns"),
  handler: async (ctx, args) => {
    const { org, profile } = await requireOrg(ctx);
    const trade = await activeTradeParty(ctx, args.tradeId, org._id);
    await receivedOrigin(ctx, trade);
    await requireCurrentTradeMaterial(ctx, trade);
    if (args.destinationOrgId !== trade.sellerOrgId)
      throw new ConvexError("RETURN_DESTINATION_UNAVAILABLE");
    const reference = requiredLabel(args.reference),
      reason = requiredLabel(args.reason);
    const previous = await ctx.db
      .query("materialReturns")
      .withIndex("by_trade", (q) => q.eq("tradeId", trade._id))
      .take(101);
    if (previous.length > 100) throw new ConvexError("TOO_MANY_RETURNS");
    const same = previous.find((row) => row.reference === reference);
    if (same) {
      if (
        same.reason !== reason ||
        same.destinationOrgId !== args.destinationOrgId ||
        same.freightPayer !== args.freightPayer ||
        same.proposedByOrgId !== org._id
      )
        throw new ConvexError("RETURN_REFERENCE_CONFLICT");
      return same._id;
    }
    if (previous.some((row) => row.status !== "rejected"))
      throw new ConvexError("RETURN_ALREADY_EXISTS");
    const now = Date.now();
    const id = await ctx.db.insert("materialReturns", {
      tradeId: trade._id,
      sellerOrgId: trade.sellerOrgId,
      buyerOrgId: trade.buyerOrgId,
      proposedByOrgId: org._id,
      destinationOrgId: args.destinationOrgId,
      reference,
      reason,
      freightPayer: args.freightPayer,
      grams: trade.grams,
      status: "proposed",
      proposedByProfileId: profile._id,
      createdAt: now,
      updatedAt: now,
    });
    const row = await ctx.db.get("materialReturns", id);
    if (!row) throw new ConvexError("RETURN_NOT_FOUND");
    await audit(ctx, row, profile._id, "proposed");
    return id;
  },
});

export const review = mutation({
  args: {
    returnId: v.id("materialReturns"),
    accept: v.boolean(),
    rejectionReason: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { org, profile } = await requireOrg(ctx, undefined, "manage");
    const { row, trade } = await owned(ctx, args.returnId, org._id);
    if (row.proposedByOrgId === org._id)
      throw new ConvexError("COUNTERPARTY_REVIEW_REQUIRED");
    const target = args.accept ? "approved" : "rejected";
    if (row.status === target) {
      if (
        !args.accept &&
        row.rejectionReason !== requiredLabel(args.rejectionReason ?? "")
      )
        throw new ConvexError("RETURN_REFERENCE_CONFLICT");
      return null;
    }
    if (args.accept && row.approvedByProfileId && row.status !== "rejected")
      return null;
    if (row.status !== "proposed") throw new ConvexError("RETURN_WRONG_STATUS");
    const rejectionReason = args.accept
      ? undefined
      : requiredLabel(args.rejectionReason ?? "");
    if (args.accept) {
      await requireFreeReturnStock(ctx, trade);
      await withdrawTradeClaims(
        ctx,
        trade._id,
        profile._id,
        "accepted_full_return",
      );
      await hold(ctx, trade._id, "accepted_full_return");
    }
    await ctx.db.patch("materialReturns", row._id, {
      status: target,
      approvedByProfileId: profile._id,
      rejectionReason,
      updatedAt: Date.now(),
    });
    await audit(ctx, row, profile._id, target, { rejectionReason });
    return null;
  },
});

export const dispatch = mutation({
  args: {
    returnId: v.id("materialReturns"),
    reference: v.string(),
    grams: v.number(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { org, profile } = await requireOrg(ctx);
    const { row, trade } = await owned(ctx, args.returnId, org._id);
    if (org._id !== row.buyerOrgId)
      throw new ConvexError("RETURN_BUYER_REQUIRED");
    const reference = requiredLabel(args.reference);
    if (args.grams !== row.grams || !Number.isSafeInteger(args.grams))
      throw new ConvexError("RETURN_FULL_QUANTITY_REQUIRED");
    if (row.dispatchReference) {
      if (row.dispatchReference !== reference)
        throw new ConvexError("RETURN_REFERENCE_CONFLICT");
      return null;
    }
    if (row.status !== "approved") throw new ConvexError("RETURN_WRONG_STATUS");
    await recordInventoryMovement(ctx, {
      orgId: org._id,
      actorProfileId: profile._id,
      materialCode: trade.materialCode,
      deltaGrams: -row.grams,
      addedCostPaise: null,
      sourceKey: `return:${row._id}:dispatch`,
      createdAt: Date.now(),
    });
    await ctx.db.patch("materialReturns", row._id, {
      status: "in_transit",
      dispatchReference: reference,
      updatedAt: Date.now(),
    });
    await audit(ctx, row, profile._id, "dispatched", {
      grams: row.grams,
      reference,
    });
    return null;
  },
});

export const receive = mutation({
  args: {
    returnId: v.id("materialReturns"),
    reference: v.string(),
    grams: v.number(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { org, profile } = await requireOrg(ctx);
    const { row, trade } = await owned(ctx, args.returnId, org._id);
    if (org._id !== row.destinationOrgId)
      throw new ConvexError("RETURN_DESTINATION_REQUIRED");
    const reference = requiredLabel(args.reference);
    if (args.grams !== row.grams || !Number.isSafeInteger(args.grams))
      throw new ConvexError("RETURN_FULL_QUANTITY_REQUIRED");
    if (row.receiptReference) {
      if (row.receiptReference !== reference)
        throw new ConvexError("RETURN_REFERENCE_CONFLICT");
      return null;
    }
    if (row.status !== "in_transit")
      throw new ConvexError("RETURN_WRONG_STATUS");
    const original = await ctx.db
      .query("inventoryMovements")
      .withIndex("by_org_source", (q) =>
        q.eq("orgId", org._id).eq("sourceKey", `trade:${trade._id}:dispatch`),
      )
      .unique();
    const cost = original?.costDeltaPaise;
    await recordInventoryMovement(ctx, {
      orgId: org._id,
      actorProfileId: profile._id,
      materialCode: trade.materialCode,
      deltaGrams: row.grams,
      addedCostPaise: cost === undefined || cost === null ? null : -cost,
      sourceKey: `return:${row._id}:receipt`,
      createdAt: Date.now(),
    });
    await ctx.db.patch("materialReturns", row._id, {
      status: "received",
      receiptReference: reference,
      updatedAt: Date.now(),
    });
    await audit(ctx, row, profile._id, "received", {
      grams: row.grams,
      reference,
    });
    return null;
  },
});

export const reconcile = mutation({
  args: { returnId: v.id("materialReturns") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { org, profile } = await requireOrg(ctx, undefined, "manage");
    const { row } = await owned(ctx, args.returnId, org._id);
    if (row.status === "reconciled") return null;
    if (row.status !== "received")
      throw new ConvexError("RETURN_PHYSICAL_RECEIPT_REQUIRED");
    if (!(await isMoneyReconciled(ctx, row.tradeId)))
      throw new ConvexError("RETURN_PROVIDER_RECONCILIATION_REQUIRED");
    await withdrawTradeClaims(
      ctx,
      row.tradeId,
      profile._id,
      "reconciled_full_return",
    );
    await ctx.db.patch("materialReturns", row._id, {
      status: "reconciled",
      updatedAt: Date.now(),
    });
    await audit(ctx, row, profile._id, "reconciled");
    return null;
  },
});

export const mine = query({
  args: {},
  returns: v.object({
    rows: v.array(
      v.object({
        id: v.id("materialReturns"),
        ...returnFields,
        materialCode: v.string(),
        isMoneyReconciled: v.boolean(),
      }),
    ),
    hasMore: v.boolean(),
  }),
  handler: async (ctx) => {
    const { org } = await requireOrg(ctx, undefined, "read");
    const [sold, bought] = await Promise.all([
      ctx.db
        .query("materialReturns")
        .withIndex("by_seller_created", (q) => q.eq("sellerOrgId", org._id))
        .order("desc")
        .take(51),
      ctx.db
        .query("materialReturns")
        .withIndex("by_buyer_created", (q) => q.eq("buyerOrgId", org._id))
        .order("desc")
        .take(51),
    ]);
    const rows = [...sold, ...bought].toSorted(
      (a, b) => b.createdAt - a.createdAt,
    );
    return {
      rows: await Promise.all(
        rows.slice(0, 100).map(async (row) => {
          const { _id, _creationTime, ...fields } = row;
          const trade = await ctx.db.get("trades", row.tradeId);
          return {
            id: _id,
            ...fields,
            materialCode: trade?.materialCode ?? "",
            isMoneyReconciled: await isMoneyReconciled(ctx, row.tradeId),
          };
        }),
      ),
      hasMore: sold.length > 50 || bought.length > 50,
    };
  },
});

export const options = query({
  args: {},
  returns: v.array(
    v.object({
      tradeId: v.id("trades"),
      materialCode: v.string(),
      grams: v.number(),
      sellerOrgId: v.id("orgs"),
      sellerName: v.string(),
      buyerName: v.string(),
      isBuyer: v.boolean(),
      canClaim: v.boolean(),
      canReturn: v.boolean(),
    }),
  ),
  handler: async (ctx) => {
    const { org } = await requireOrg(ctx, undefined, "read");
    const [buying, selling] = await Promise.all([
      ctx.db
        .query("trades")
        .withIndex("by_buyer", (q) => q.eq("buyerOrgId", org._id))
        .order("desc")
        .take(100),
      ctx.db
        .query("trades")
        .withIndex("by_seller", (q) => q.eq("sellerOrgId", org._id))
        .order("desc")
        .take(100),
    ]);
    const result = [];
    for (const trade of [...buying, ...selling]) {
      if (trade.status !== "completed") continue;
      try {
        await activeTradeParty(ctx, trade._id, org._id);
        await receivedOrigin(ctx, trade);
        await requireCurrentTradeMaterial(ctx, trade);
      } catch (error) {
        if (error instanceof ConvexError) continue;
        throw error;
      }
      const seller = await ctx.db.get("orgs", trade.sellerOrgId),
        buyer = await ctx.db.get("orgs", trade.buyerOrgId);
      const previous = await ctx.db
        .query("materialReturns")
        .withIndex("by_trade", (q) => q.eq("tradeId", trade._id))
        .take(101);
      result.push({
        canReturn:
          previous.length <= 100 &&
          previous.every((row) => row.status === "rejected"),
        tradeId: trade._id,
        materialCode: trade.materialCode,
        grams: trade.grams,
        sellerOrgId: trade.sellerOrgId,
        sellerName: seller?.name ?? "",
        buyerName: buyer?.name ?? "",
        isBuyer: org._id === trade.buyerOrgId,
        canClaim:
          org._id === trade.buyerOrgId &&
          !(await sourceEligibility(ctx, trade)),
      });
    }
    return result;
  },
});
