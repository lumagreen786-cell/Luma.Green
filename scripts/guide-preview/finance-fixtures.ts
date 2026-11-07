import type { FunctionReturnType } from "convex/server";

import type { api } from "../../convex/_generated/api";

type FinancialSnapshot = NonNullable<
  FunctionReturnType<typeof api.cashfreeLifecycle.status>
>;

/** Explicit interface examples only. Never used by the application backend. */
export function financeFixture(args: unknown): FinancialSnapshot | null {
  if (
    args !== null &&
    typeof args === "object" &&
    "tradeId" in args &&
    args.tradeId === "guide-pet-trade" &&
    window.location.pathname.endsWith("/app/trades") &&
    new URLSearchParams(window.location.search).get("procurement") === "pet"
  ) {
    return {
      state: "received",
      collection: "live_confirmed",
      settlement: "settled",
      refund: "none",
      actions: [],
      policyReady: true,
      totalPaise: 150_000,
      grams: 100_000,
    };
  }
  if (
    args === null ||
    typeof args !== "object" ||
    !("tradeId" in args) ||
    args.tradeId !== "guide-finance-example" ||
    !window.location.pathname.endsWith("/app/finance-example")
  )
    return null;
  const scenario = new URLSearchParams(window.location.search).get("scenario");
  if (scenario === "authorized-dispatch")
    return {
      state: "authorized",
      collection: "live_confirmed",
      settlement: "pending",
      refund: "none",
      actions: ["dispatch"],
      policyReady: true,
      totalPaise: 1250,
      grams: 1000,
    };
  if (scenario === "financial-hold")
    return {
      state: "hold",
      collection: "review",
      settlement: "pending",
      refund: "none",
      actions: [],
      policyReady: true,
      totalPaise: 1250,
      grams: 1000,
      holdReason: "synthetic_documentation_example",
    };
  throw new Error("Choose an explicit synthetic financial scenario.");
}
