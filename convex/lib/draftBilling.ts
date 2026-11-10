import { ConvexError } from "convex/values";

import type { Doc } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import { indiaToday } from "./onboarding";

const BASIS_POINTS = 10_000;
const BILLABLE_SITE_KINDS: ReadonlySet<string> = new Set([
  "kabadiwala",
  "yard",
  "recycler",
  "manufacturer",
]);

export function billingMonth(now: number) {
  return indiaToday(now).slice(0, 7);
}

export function isBillingMonth(month: string) {
  return /^[1-9]\d{3}-(?:0[1-9]|1[0-2])$/.test(month);
}

function isPaise(value: number) {
  return Number.isSafeInteger(value) && value >= 0;
}

export function validateDraftPrice(
  monthlyPaise: readonly number[],
  feeBps: number,
  feeCapPaise: number,
) {
  if (
    monthlyPaise.some((price) => !isPaise(price)) ||
    !isPaise(feeCapPaise) ||
    !Number.isSafeInteger(feeBps) ||
    feeBps < 0 ||
    feeBps > BASIS_POINTS
  )
    throw new ConvexError("INVALID_DRAFT_PRICE");
}

export function draftAmounts(
  monthlyPaise: number,
  orderValuesPaise: readonly number[],
  feeBps: number,
  feeCapPaise: number,
) {
  validateDraftPrice([monthlyPaise, ...orderValuesPaise], feeBps, feeCapPaise);
  const denominator = BigInt(BASIS_POINTS);
  const roundingOffset = BigInt(BASIS_POINTS / 2);
  const feesPaise = orderValuesPaise.map((value) => {
    const rounded =
      (BigInt(value) * BigInt(feeBps) + roundingOffset) / denominator;
    return Math.min(Number(rounded), feeCapPaise);
  });
  const subtotalPaise = feesPaise.reduce(
    (sum, fee) => sum + BigInt(fee),
    BigInt(monthlyPaise),
  );
  if (subtotalPaise > BigInt(Number.MAX_SAFE_INTEGER))
    throw new ConvexError("DRAFT_TOTAL_TOO_LARGE");
  return { feesPaise, subtotalPaise: Number(subtotalPaise) };
}

/** Individual households, Saathis and NGOs have no billable business site. */
export function isBillableBusinessSite(org: Pick<Doc<"orgs">, "kind">) {
  return BILLABLE_SITE_KINDS.has(org.kind);
}

/** Invoke only in the seller's direct-cash receipt transaction. */
export async function meterDirectCashReceipt(
  ctx: MutationCtx,
  trade: Pick<Doc<"trades">, "_id" | "buyerOrgId" | "totalPaise">,
  recordedAt: number,
) {
  const org = await ctx.db.get("orgs", trade.buyerOrgId);
  if (!org || !isBillableBusinessSite(org)) return;
  if (!isPaise(trade.totalPaise)) throw new ConvexError("INVALID_DRAFT_USAGE");

  const month = billingMonth(recordedAt);
  const prior = await ctx.db
    .query("businessBillingUsage")
    .withIndex("by_trade", (q) => q.eq("tradeId", trade._id))
    .unique();
  if (prior) {
    if (
      prior.orgId !== trade.buyerOrgId ||
      prior.materialPaise !== trade.totalPaise ||
      prior.recordedAt !== recordedAt
    )
      throw new ConvexError("DRAFT_USAGE_CONFLICT");
    return;
  }
  await ctx.db.insert("businessBillingUsage", {
    orgId: trade.buyerOrgId,
    tradeId: trade._id,
    kind: "direct_cash_order",
    materialPaise: trade.totalPaise,
    month,
    recordedAt,
  });
}
