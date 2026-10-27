import { ConvexError } from "convex/values";

import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import { financial } from "./cashfreeLifecycle";
import { requireCurrentTradeMaterial } from "./marketEligibility";
import { requireTradeQualityRelease } from "./qualityRelease";
import { isListingOfferCurrent } from "./rateValidity";

export async function activeTradeParty(
  ctx: QueryCtx,
  tradeId: Id<"trades">,
  orgId: Id<"orgs">,
) {
  const trade = await ctx.db.get("trades", tradeId);
  if (!trade || (trade.buyerOrgId !== orgId && trade.sellerOrgId !== orgId))
    throw new ConvexError("TRADE_NOT_FOUND");
  const [seller, buyer] = await Promise.all([
    ctx.db.get("orgs", trade.sellerOrgId),
    ctx.db.get("orgs", trade.buyerOrgId),
  ]);
  if (seller?.status !== "active" || buyer?.status !== "active")
    throw new ConvexError("TRADE_PARTY_INACTIVE");
  return trade;
}

/** Pending returns and received sources on a financial/quality hold cannot be sold. */
export async function heldMaterialGrams(
  ctx: QueryCtx,
  orgId: Id<"orgs">,
  excludeSourceKey?: string,
  excludeTradeId?: Id<"trades">,
) {
  const returns = await ctx.db
    .query("materialReturns")
    .withIndex("by_buyer_created", (q) => q.eq("buyerOrgId", orgId))
    .take(1001);
  const purchases = await ctx.db
    .query("trades")
    .withIndex("by_buyer", (q) => q.eq("buyerOrgId", orgId))
    .take(1001);
  if (returns.length > 1000 || purchases.length > 1000)
    throw new ConvexError("TOO_MANY_RETURN_RESERVATIONS");
  const held = new Map<string, number>(),
    returnedSources = new Set<Id<"trades">>();
  const add = (code: string, grams: number) => {
    const total = (held.get(code) ?? 0) + grams;
    if (!Number.isSafeInteger(total)) throw new ConvexError("INVALID_WEIGHT");
    held.set(code, total);
  };
  for (const row of returns) {
    if (row.status === "proposed" || row.status === "rejected") continue;
    returnedSources.add(row.tradeId);
    if (
      row.status !== "approved" ||
      excludeSourceKey === `return:${row._id}:dispatch`
    )
      continue;
    const trade = await ctx.db.get("trades", row.tradeId);
    if (trade) add(trade.materialCode, row.grams);
  }
  for (const trade of purchases) {
    if (
      trade.status !== "completed" ||
      returnedSources.has(trade._id) ||
      trade._id === excludeTradeId
    )
      continue;
    const payment = await financial(ctx, trade._id);
    if (payment?.state !== "hold") continue;
    const receipt = await ctx.db
      .query("inventoryMovements")
      .withIndex("by_org_source", (q) =>
        q.eq("orgId", orgId).eq("sourceKey", `trade:${trade._id}:receipt`),
      )
      .unique();
    if (receipt?.deltaGrams === trade.grams)
      add(trade.materialCode, trade.grams);
  }
  return held;
}
export async function reservedReturnGrams(
  ctx: QueryCtx,
  orgId: Id<"orgs">,
  materialCode: string,
  excludeSourceKey?: string,
  excludeTradeId?: Id<"trades">,
) {
  const held = await heldMaterialGrams(
    ctx,
    orgId,
    excludeSourceKey,
    excludeTradeId,
  );
  return held.get(materialCode) ?? 0;
}

export async function requireFreeReturnStock(
  ctx: QueryCtx,
  trade: Doc<"trades">,
) {
  const stock = await ctx.db
    .query("inventory")
    .withIndex("by_org_material", (q) =>
      q.eq("orgId", trade.buyerOrgId).eq("materialCode", trade.materialCode),
    )
    .unique();
  const listings = await ctx.db
    .query("listings")
    .withIndex("by_org", (q) => q.eq("orgId", trade.buyerOrgId))
    .take(1001);
  const sales = await ctx.db
    .query("trades")
    .withIndex("by_seller", (q) => q.eq("sellerOrgId", trade.buyerOrgId))
    .take(1001);
  if (listings.length > 1000 || sales.length > 1000)
    throw new ConvexError("TOO_MANY_RESERVATIONS");
  let reserved = await reservedReturnGrams(
    ctx,
    trade.buyerOrgId,
    trade.materialCode,
    undefined,
    trade._id,
  );
  for (const listing of listings)
    if (
      listing.materialCode === trade.materialCode &&
      listing.status === "open" &&
      isListingOfferCurrent(listing)
    )
      reserved += listing.grams;
  for (const sale of sales)
    if (
      sale.materialCode === trade.materialCode &&
      (sale.status === "accepted" || sale.status === "paid_to_escrow")
    )
      reserved += sale.grams;
  if (
    !Number.isSafeInteger(reserved) ||
    !Number.isSafeInteger(stock?.grams) ||
    (stock?.grams ?? 0) - reserved < trade.grams
  )
    throw new ConvexError("RETURN_STOCK_NOT_FREE");
}

export async function sourceEligibility(ctx: QueryCtx, trade: Doc<"trades">) {
  if (trade.status !== "completed") return "SOURCE_NOT_RECEIVED";
  try {
    await requireCurrentTradeMaterial(ctx, trade);
    await requireTradeQualityRelease(ctx, trade);
  } catch (error) {
    if (error instanceof ConvexError) return "SOURCE_NO_LONGER_ELIGIBLE";
    throw error;
  }
  const payment = await financial(ctx, trade._id);
  if (
    payment?.collection !== "live_confirmed" ||
    payment.refund !== "none" ||
    payment.state !== "received"
  )
    return "SOURCE_FINANCIAL_HOLD";
  const movement = await ctx.db
    .query("inventoryMovements")
    .withIndex("by_org_source", (q) =>
      q
        .eq("orgId", trade.buyerOrgId)
        .eq("sourceKey", `trade:${trade._id}:receipt`),
    )
    .unique();
  if (movement?.deltaGrams !== trade.grams) return "SOURCE_RECEIPT_REQUIRED";
  const existing = await ctx.db
    .query("materialReturns")
    .withIndex("by_trade", (q) => q.eq("tradeId", trade._id))
    .take(101);
  return existing.length > 100 ||
    existing.some(
      (row) => row.status !== "proposed" && row.status !== "rejected",
    )
    ? "SOURCE_RETURNED"
    : null;
}

export async function withdrawTradeClaims(
  ctx: MutationCtx,
  tradeId: Id<"trades">,
  actorProfileId: Id<"profiles">,
  reason: string,
) {
  const claims = await ctx.db
    .query("schemeAllocations")
    .withIndex("by_source", (q) => q.eq("sourceTradeId", tradeId))
    .take(101);
  if (claims.length > 100) throw new ConvexError("TOO_MANY_SOURCE_CLAIMS");
  for (const claim of claims)
    if (claim.status === "declared") {
      await ctx.db.patch("schemeAllocations", claim._id, {
        status: "withdrawn",
        withdrawalReason: reason,
        withdrawnAt: Date.now(),
      });
      await ctx.db.insert("auditLog", {
        orgId: claim.orgId,
        actorProfileId,
        action: "scheme_allocation.withdrawn",
        entityTable: "schemeAllocations",
        entityId: claim._id,
        metadata: { sourceTradeId: tradeId, reason },
        createdAt: Date.now(),
      });
    }
}
