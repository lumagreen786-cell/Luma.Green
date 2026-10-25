import {
  paginationOptsValidator,
  paginationResultValidator,
} from "convex/server";
import { ConvexError, v } from "convex/values";

import { cashfreeEnv, cashfreePolicyVersion } from "../src/lib/env";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import {
  internalMutation,
  internalQuery,
  mutation,
  query,
  type QueryCtx,
} from "./_generated/server";
import { requireAdmin } from "./lib/access";
import {
  financial,
  hold,
  isLiveReady,
  log,
  reference,
  selectedPolicy,
  setFinancial,
} from "./lib/cashfreeLifecycle";
import { PAYMENT_POLICY_VERSION_MAX } from "./lib/cashfreeLifecycleContract";
import {
  policyFields,
  vFinancialCollection,
  vFinancialState,
  vRefund,
  vSettlement,
} from "./lib/cashfreeLifecycleSchema";
import { stockGramsAfter } from "./lib/inventory";
import { requireCurrentTradeMaterial } from "./lib/marketEligibility";
import { requireOrg } from "./lib/workspace";
const policyView = v.object({ ...policyFields, createdAt: v.number() });
export const policyForAdmin = query({
  args: {},
  returns: v.object({
    configuredVersion: v.union(v.string(), v.null()),
    liveEnabled: v.boolean(),
    policy: v.union(policyView, v.null()),
  }),
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const p = await selectedPolicy(ctx);
    return {
      configuredVersion: cashfreePolicyVersion(),
      liveEnabled: await isLiveReady(ctx),
      policy: p
        ? {
            version: p.version,
            feePayer: p.feePayer,
            refundFunder: p.refundFunder,
            refundAuthority: p.refundAuthority,
            settlementTermsReference: p.settlementTermsReference,
            providerAcceptanceReference: p.providerAcceptanceReference,
            createdAt: p.createdAt,
          }
        : null,
    };
  },
});
export const savePolicyForAdmin = mutation({
  args: policyFields,
  returns: v.id("cashfreePolicies"),
  handler: async (ctx, args) => {
    const admin = await requireAdmin(ctx);
    if (
      !/^[A-Za-z0-9_-]+$/.test(args.version) ||
      args.version.length > PAYMENT_POLICY_VERSION_MAX
    )
      throw new ConvexError("INVALID_POLICY");
    const input = {
      ...args,
      settlementTermsReference: reference(args.settlementTermsReference),
      providerAcceptanceReference: reference(args.providerAcceptanceReference),
    };
    const existing = await ctx.db
      .query("cashfreePolicies")
      .withIndex("by_version", (q) => q.eq("version", args.version))
      .unique();
    if (existing) {
      if (
        Object.entries(input).some(
          ([k, value]) => existing[k as keyof typeof input] !== value,
        )
      )
        throw new ConvexError("POLICY_IMMUTABLE");
      return existing._id;
    }
    const id = await ctx.db.insert("cashfreePolicies", {
      ...input,
      actorId: admin._id,
      createdAt: Date.now(),
    });
    await ctx.db.insert("auditLog", {
      entityTable: "cashfreePolicies",
      entityId: id,
      action: "payment.policy.approved",
      metadata: { actorId: admin._id, version: args.version },
      createdAt: Date.now(),
    });
    return id;
  },
});
const vAction = v.union(
  v.literal("dispatch"),
  v.literal("receive"),
  v.literal("cancel"),
);
const statusFields = {
  state: vFinancialState,
  collection: vFinancialCollection,
  settlement: vSettlement,
  refund: vRefund,
  actions: v.array(vAction),
  policyReady: v.boolean(),
  totalPaise: v.number(),
  grams: v.number(),
  holdReason: v.optional(v.string()),
};
async function owned(ctx: QueryCtx, tradeId: Id<"trades">, canWrite = false) {
  const scope = await requireOrg(ctx, undefined, canWrite ? "operate" : "read");
  const trade = await ctx.db.get("trades", tradeId);
  if (
    !trade ||
    (trade.buyerOrgId !== scope.org._id && trade.sellerOrgId !== scope.org._id)
  )
    throw new ConvexError("TRADE_NOT_FOUND");
  return { ...scope, trade };
}
function permittedActions(
  trade: Doc<"trades">,
  row: Doc<"tradeFinancials"> | null,
  orgId: Id<"orgs"> | undefined,
  isViewer: boolean,
  isPolicyReady: boolean,
  hasFrozenPolicy: boolean,
): ("dispatch" | "receive" | "cancel")[] {
  if (isViewer) return [];
  if (!row || row.state === "awaiting_payment") return ["cancel"];
  if (
    row.collection !== "live_confirmed" ||
    row.refund !== "none" ||
    row.settlement === "reversed" ||
    row.settlement === "review"
  )
    return [];
  if (
    isPolicyReady &&
    row.state === "authorized" &&
    orgId === trade.sellerOrgId
  )
    return ["dispatch"];
  return hasFrozenPolicy &&
    row.state === "dispatched" &&
    orgId === trade.buyerOrgId
    ? ["receive"]
    : [];
}
async function view(
  ctx: QueryCtx,
  trade: Doc<"trades">,
  orgId?: Id<"orgs">,
  isViewer = true,
) {
  const row = await financial(ctx, trade._id);
  if (!row && trade.status !== "accepted") return null;
  const isPolicyReady = await isLiveReady(ctx);
  const state = row?.state ?? "awaiting_payment";
  const frozenOrder = row?.orderId
    ? await ctx.db.get("cashfreeOrders", row.orderId)
    : null;
  const frozenPolicy = frozenOrder?.policyId
    ? await ctx.db.get("cashfreePolicies", frozenOrder.policyId)
    : null;
  const actions = permittedActions(
    trade,
    row,
    orgId,
    isViewer,
    isPolicyReady,
    frozenPolicy !== null,
  );
  return {
    state,
    collection: row?.collection ?? ("pending" as const),
    settlement: row?.settlement ?? ("pending" as const),
    refund: row?.refund ?? ("none" as const),
    actions,
    policyReady: isPolicyReady,
    totalPaise: trade.totalPaise,
    grams: trade.grams,
    ...(row?.holdReason && { holdReason: row.holdReason }),
  };
}
export const status = query({
  args: { tradeId: v.id("trades") },
  returns: v.union(v.object(statusFields), v.null()),
  handler: async (ctx, { tradeId }) => {
    const { trade, org, role } = await owned(ctx, tradeId);
    return view(ctx, trade, org._id, role === "viewer");
  },
});
export const act = mutation({
  args: {
    tradeId: v.id("trades"),
    action: v.union(v.literal("dispatch"), v.literal("receive")),
    reference: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { trade, org, profile } = await owned(ctx, args.tradeId, true);
    const ref = reference(args.reference);
    const prior = await ctx.db
      .query("financialMovements")
      .withIndex("by_trade_kind", (q) =>
        q.eq("tradeId", trade._id).eq("kind", args.action),
      )
      .unique();
    if (prior) {
      if (prior.orgId !== org._id || prior.reference !== ref)
        throw new ConvexError("MOVEMENT_CONFLICT");
      return null;
    }
    const current = await view(ctx, trade, org._id, false);
    if (!current?.actions.includes(args.action))
      throw new ConvexError("GATEWAY_REQUIRED");
    const other = await ctx.db.get(
      "orgs",
      org._id === trade.sellerOrgId ? trade.buyerOrgId : trade.sellerOrgId,
    );
    if (other?.status !== "active")
      throw new ConvexError("TRADE_NOT_AVAILABLE");
    try {
      await requireCurrentTradeMaterial(ctx, trade);
    } catch (error) {
      if (!(error instanceof ConvexError)) throw error;
      await hold(ctx, trade._id, "material_eligibility_changed");
      return null;
    }
    const inventory = await ctx.db
      .query("inventory")
      .withIndex("by_org_material", (q) =>
        q.eq("orgId", org._id).eq("materialCode", trade.materialCode),
      )
      .unique();
    const delta = args.action === "dispatch" ? -trade.grams : trade.grams;
    if (!Number.isSafeInteger(trade.grams) || trade.grams <= 0)
      throw new ConvexError("INVALID_WEIGHT");
    const grams = stockGramsAfter(inventory?.grams ?? 0, delta);
    if (inventory)
      await ctx.db.patch("inventory", inventory._id, {
        grams,
        updatedAt: Date.now(),
      });
    else
      await ctx.db.insert("inventory", {
        orgId: org._id,
        materialCode: trade.materialCode,
        grams,
        updatedAt: Date.now(),
      });
    await ctx.db.insert("financialMovements", {
      tradeId: trade._id,
      kind: args.action,
      orgId: org._id,
      grams: delta,
      reference: ref,
      actorProfileId: profile._id,
      createdAt: Date.now(),
    });
    const state = args.action === "dispatch" ? "dispatched" : "received";
    const tradeState = args.action === "dispatch" ? "dispatched" : "completed";
    await setFinancial(ctx, trade._id, { state });
    await ctx.db.patch("trades", trade._id, {
      status: tradeState,
      timeline: [...trade.timeline, { status: tradeState, at: Date.now() }],
      updatedAt: Date.now(),
    });
    await log(ctx, trade._id, args.action, {
      orgId: org._id,
      grams: delta,
      reference: ref,
    });
    return null;
  },
});
export const requestCancellation = mutation({
  args: { tradeId: v.id("trades"), reason: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { trade } = await owned(ctx, args.tradeId, true);
    const reason = reference(args.reason);
    const row = await financial(ctx, trade._id);
    if (row?.state === "cancelled" || row?.state === "cancellation_pending")
      return null;
    if (
      trade.status !== "accepted" ||
      row?.collection === "live_confirmed" ||
      row?.state === "hold"
    )
      throw new ConvexError("REVIEW_REQUIRED");
    const orders = await ctx.db
      .query("cashfreeOrders")
      .withIndex("by_trade_mode", (q) =>
        q.eq("tradeId", trade._id).eq("mode", "live"),
      )
      .take(2);
    if (orders.length > 0) {
      await setFinancial(ctx, trade._id, { state: "cancellation_pending" });
      for (const order of orders)
        await ctx.scheduler.runAfter(0, internal.cashfreeActions.reconcile, {
          orderId: order._id,
        });
    } else {
      await setFinancial(ctx, trade._id, { state: "cancelled" });
      await ctx.db.patch("trades", trade._id, {
        status: "declined",
        timeline: [...trade.timeline, { status: "declined", at: Date.now() }],
        updatedAt: Date.now(),
      });
    }
    await log(ctx, trade._id, "cancellation_requested", { reason });
    return null;
  },
});
const adminRow = v.object({
  tradeId: v.id("trades"),
  sellerName: v.string(),
  buyerName: v.string(),
  totalPaise: v.number(),
  grams: v.number(),
  state: vFinancialState,
  collection: vFinancialCollection,
  settlement: vSettlement,
  refund: vRefund,
  canRefund: v.boolean(),
  refundablePaise: v.number(),
  canReconcile: v.boolean(),
});
export const adminList = query({
  args: { paginationOpts: paginationOptsValidator },
  returns: paginationResultValidator(adminRow),
  handler: async (ctx, { paginationOpts }) => {
    await requireAdmin(ctx);
    const result = await ctx.db
      .query("tradeFinancials")
      .order("desc")
      .paginate({
        ...paginationOpts,
        numItems: Math.min(50, Math.max(1, paginationOpts.numItems)),
      });
    const page = [];
    for (const row of result.page) {
      const trade = await ctx.db.get("trades", row.tradeId);
      if (!trade) continue;
      const buyer = await ctx.db.get("orgs", trade.buyerOrgId);
      const seller = await ctx.db.get("orgs", trade.sellerOrgId);
      const order = row.orderId
        ? await ctx.db.get("cashfreeOrders", row.orderId)
        : null;
      const policy = order?.policyId
        ? await ctx.db.get("cashfreePolicies", order.policyId)
        : null;
      page.push({
        tradeId: trade._id,
        sellerName: seller?.name ?? "",
        buyerName: buyer?.name ?? "",
        totalPaise: trade.totalPaise,
        grams: trade.grams,
        state: row.state,
        collection: row.collection,
        settlement: row.settlement,
        refund: row.refund,
        refundablePaise: row.refund === "none" ? trade.totalPaise : 0,
        canRefund:
          cashfreeEnv()?.mode === "live" &&
          policy?.refundAuthority === "platform_admin" &&
          row.collection === "live_confirmed" &&
          row.refund === "none",
        canReconcile: Boolean(row.orderId) && Boolean(cashfreeEnv()),
      });
    }
    return { ...result, page };
  },
});
export const orderForAdmin = internalQuery({
  args: { tradeId: v.id("trades") },
  returns: v.union(v.id("cashfreeOrders"), v.null()),
  handler: async (ctx, { tradeId }) => {
    await requireAdmin(ctx);
    const row = await financial(ctx, tradeId);
    return row?.orderId ?? null;
  },
});
export const review = internalMutation({
  args: { tradeId: v.id("trades"), reason: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    await hold(ctx, args.tradeId, args.reason);
    return null;
  },
});

export const lookupUnavailable = internalMutation({
  args: { tradeId: v.id("trades"), kind: v.literal("settlement") },
  returns: v.null(),
  handler: async (ctx, args) => {
    await log(ctx, args.tradeId, "settlement_lookup_unavailable");
    return null;
  },
});
