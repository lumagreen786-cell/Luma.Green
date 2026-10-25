import { ConvexError } from "convex/values";

import { cashfreeEnv, cashfreePolicyVersion } from "../../src/lib/env";
import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import {
  FINANCIAL_REFERENCE_MAX,
  FINANCIAL_REFERENCE_MIN,
} from "./cashfreeLifecycleContract";
import { requireCurrentTradeMaterial } from "./marketEligibility";

export async function selectedPolicy(ctx: QueryCtx) {
  const version = cashfreePolicyVersion();
  return version
    ? ctx.db
        .query("cashfreePolicies")
        .withIndex("by_version", (q) => q.eq("version", version))
        .unique()
    : null;
}
export async function isLiveReady(ctx: QueryCtx) {
  const config = cashfreeEnv();
  return (
    config?.mode === "live" &&
    config.checkoutEnabled &&
    Boolean(await selectedPolicy(ctx))
  );
}
export function reference(value: string) {
  const result = value.trim();
  if (
    result.length < FINANCIAL_REFERENCE_MIN ||
    result.length > FINANCIAL_REFERENCE_MAX ||
    /[\u{0000}-\u{001F}]/u.test(result)
  )
    throw new ConvexError("INVALID_REFERENCE");
  return result;
}
export async function financial(ctx: QueryCtx, tradeId: Id<"trades">) {
  return ctx.db
    .query("tradeFinancials")
    .withIndex("by_trade", (q) => q.eq("tradeId", tradeId))
    .unique();
}
export async function log(
  ctx: MutationCtx,
  tradeId: Id<"trades">,
  action: string,
  metadata: Record<string, unknown> = {},
) {
  await ctx.db.insert("auditLog", {
    entityTable: "trades",
    entityId: tradeId,
    action: `financial.${action}`,
    metadata,
    createdAt: Date.now(),
  });
}
export async function setFinancial(
  ctx: MutationCtx,
  tradeId: Id<"trades">,
  change: Partial<
    Omit<
      Doc<"tradeFinancials">,
      "_id" | "_creationTime" | "tradeId" | "createdAt"
    >
  >,
) {
  const row = await financial(ctx, tradeId);
  if (row) {
    await ctx.db.patch("tradeFinancials", row._id, {
      ...change,
      updatedAt: Date.now(),
    });
    return row._id;
  }
  return ctx.db.insert("tradeFinancials", {
    tradeId,
    state: "awaiting_payment",
    collection: "pending",
    settlement: "pending",
    refund: "none",
    ...change,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  });
}
export async function hold(
  ctx: MutationCtx,
  tradeId: Id<"trades">,
  reason: string,
) {
  await setFinancial(ctx, tradeId, { state: "hold", holdReason: reason });
  await log(ctx, tradeId, "hold", { reason });
}
/** Called only after authenticated provider order and capture lookup, in the same transaction. */
export async function collected(
  ctx: MutationCtx,
  order: Doc<"cashfreeOrders">,
  isSafe: boolean,
  hasVerifiedCapture: boolean,
) {
  if (order.mode !== "live") return;
  const row = await financial(ctx, order.tradeId);
  // Replaying the same proved collection must not erase a refund/dispute hold.
  if (
    hasVerifiedCapture &&
    row?.orderId === order._id &&
    row.collection === "live_confirmed"
  )
    return;
  const trade = await ctx.db.get("trades", order.tradeId);
  await setFinancial(ctx, order.tradeId, {
    orderId: order._id,
    collection: hasVerifiedCapture ? "live_confirmed" : "review",
  });
  const policy = order.policyId
    ? await ctx.db.get("cashfreePolicies", order.policyId)
    : null;
  if (
    !hasVerifiedCapture ||
    !isSafe ||
    !policy ||
    !trade ||
    !order.policyId ||
    (row?.orderId && row.orderId !== order._id) ||
    row?.state === "cancelled" ||
    row?.state === "cancellation_pending" ||
    row?.state === "hold"
  ) {
    await hold(ctx, order.tradeId, "payment_requires_review");
    return;
  }
  if (trade.status !== "accepted") {
    await hold(ctx, trade._id, "trade_state_changed");
    return;
  }
  try {
    await requireCurrentTradeMaterial(ctx, trade);
  } catch (error) {
    if (!(error instanceof ConvexError)) throw error;
    await hold(ctx, trade._id, "material_eligibility_changed");
    return;
  }
  await setFinancial(ctx, trade._id, { state: "authorized" });
  await log(ctx, trade._id, "collection_confirmed", {
    orderId: order._id,
    totalPaise: order.totalPaise,
  });
}
/** Expiry alone is not evidence. The caller must have proved terminal status and no successful attempts. */
export async function terminalUnpaid(
  ctx: MutationCtx,
  order: Doc<"cashfreeOrders">,
) {
  if (order.mode !== "live") return;
  const row = await financial(ctx, order.tradeId);
  // Terminal order evidence cannot resolve an independent refund or review hold.
  if (row?.state === "hold") return;
  if (
    order.successPaymentId ||
    order.collection !== "pending" ||
    row?.collection === "live_confirmed"
  ) {
    await hold(ctx, order.tradeId, "terminal_payment_conflict");
    return;
  }
  const trade = await ctx.db.get("trades", order.tradeId);
  if (trade?.status !== "accepted") return;
  await setFinancial(ctx, trade._id, {
    orderId: order._id,
    state: "cancelled",
  });
  await ctx.db.patch("trades", trade._id, {
    status: "declined",
    timeline: [...trade.timeline, { status: "declined", at: Date.now() }],
    updatedAt: Date.now(),
  });
  await log(ctx, trade._id, "unpaid_cancelled", { orderId: order._id });
}
