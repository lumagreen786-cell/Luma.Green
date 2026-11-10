import { v } from "convex/values";

import type { TradeAction } from "./chain";

/** No gateway provider or trusted webhook is configured in this release. */
const GATEWAY_ACTIONS: ReadonlySet<TradeAction> = new Set([
  "pay",
  "dispatch",
  "confirm",
]);

export function requiresGatewayEvent(action: TradeAction): boolean {
  return GATEWAY_ACTIONS.has(action);
}

export const vDirectCashReceipt = v.object({
  amountPaise: v.number(),
  reference: v.string(),
  recordedAt: v.number(),
});

export const vPaymentVerification = v.union(
  v.literal("not_applicable"),
  v.literal("gateway_required"),
  v.literal("reported_direct_cash"),
  v.literal("legacy_unverified"),
);
