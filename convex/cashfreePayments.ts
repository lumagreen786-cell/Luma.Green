import {
  paginationOptsValidator,
  paginationResultValidator,
} from "convex/server";
import { ConvexError, type Infer, v } from "convex/values";

import { cashfreeEnv } from "../src/lib/env";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import {
  internalMutation,
  internalQuery,
  mutation,
  type MutationCtx,
  query,
  type QueryCtx,
} from "./_generated/server";
import { requireAdmin, requireUser } from "./lib/access";
import {
  MAX_PAYMENT_PAISE,
  PAYMENT_LEASE_MS,
  VENDOR_FRESH_MS,
} from "./lib/cashfree";
import {
  collected,
  financial,
  hold,
  isLiveReady,
  selectedPolicy,
  setFinancial,
  terminalUnpaid,
} from "./lib/cashfreeLifecycle";
import {
  vAttempt,
  vCashfreeMode,
  vCashfreeOrder,
  vCheckout,
  vCollection,
} from "./lib/cashfreeSchema";
import { safePaiseFor } from "./lib/chain";
import { requireCurrentTradeMaterial } from "./lib/marketEligibility";
import { requireOrg } from "./lib/workspace";

type Order = Doc<"cashfreeOrders">;
function hasChangedIdentity(
  current: string | undefined,
  incoming: string | undefined,
) {
  return (
    current !== undefined && incoming !== undefined && current !== incoming
  );
}

async function audit(
  ctx: MutationCtx,
  entityTable: string,
  entityId: string,
  action: string,
  orgId?: Id<"orgs">,
) {
  await ctx.db.insert("auditLog", {
    entityTable,
    entityId,
    action,
    orgId,
    createdAt: Date.now(),
  });
}
async function issue(
  ctx: MutationCtx,
  mode: "sandbox" | "live",
  reason: string,
  providerOrderId?: string,
  providerPaymentId?: string,
  bodyHash?: string,
) {
  const key = `${mode}:${reason}:${providerOrderId ?? ""}:${providerPaymentId ?? bodyHash ?? ""}`;
  if (
    await ctx.db
      .query("cashfreeIssues")
      .withIndex("by_key", (q) => q.eq("key", key))
      .unique()
  )
    return;
  const id = await ctx.db.insert("cashfreeIssues", {
    key,
    mode,
    reason,
    providerOrderId,
    providerPaymentId,
    bodyHash,
    createdAt: Date.now(),
  });
  await audit(ctx, "cashfreeIssues", id, `payment.reconciliation.${reason}`);
}
async function isScopeValid(ctx: QueryCtx, order: Order) {
  const trade = await ctx.db.get("trades", order.tradeId);
  const buyer = await ctx.db.get("orgs", order.buyerOrgId);
  const seller = await ctx.db.get("orgs", order.sellerOrgId);
  const lifecycle = await financial(ctx, order.tradeId);
  return (
    (trade?.status === "accepted" ||
      (order.mode === "live" &&
        (trade?.status === "dispatched" || trade?.status === "completed") &&
        lifecycle?.orderId === order._id)) &&
    trade.buyerOrgId === order.buyerOrgId &&
    trade.sellerOrgId === order.sellerOrgId &&
    trade.totalPaise === order.totalPaise &&
    safePaiseFor(trade.grams, trade.paisePerKg) === order.totalPaise &&
    buyer?.status === "active" &&
    seller?.status === "active"
  );
}
async function ownedTrade(
  ctx: QueryCtx,
  tradeId: Id<"trades">,
  canRead = false,
) {
  const { org, profile, role } = await requireOrg(
    ctx,
    undefined,
    canRead ? "read" : "operate",
  );
  const trade = await ctx.db.get("trades", tradeId);
  if (
    !trade ||
    (trade.buyerOrgId !== org._id &&
      (!canRead || trade.sellerOrgId !== org._id))
  )
    throw new ConvexError("TRADE_NOT_FOUND");
  return { trade, org, profile, role };
}

const vendorRegistrationArgs = {
  orgId: v.id("orgs"),
  mode: vCashfreeMode,
  vendorId: v.string(),
};

async function registerVendorMapping(
  ctx: MutationCtx,
  args: { orgId: Id<"orgs">; mode: "sandbox" | "live"; vendorId: string },
  adminUserId?: string,
) {
  if (!/^\w{1,100}$/.test(args.vendorId))
    throw new ConvexError("INVALID_VENDOR");
  const org = await ctx.db.get("orgs", args.orgId);
  if (org?.status !== "active") throw new ConvexError("NO_BUSINESS");
  const sameOrg = await ctx.db
    .query("cashfreeVendors")
    .withIndex("by_org_mode", (q) =>
      q.eq("orgId", args.orgId).eq("mode", args.mode),
    )
    .unique();
  const sameVendor = await ctx.db
    .query("cashfreeVendors")
    .withIndex("by_mode_vendor", (q) =>
      q.eq("mode", args.mode).eq("vendorId", args.vendorId),
    )
    .unique();
  if (sameOrg || sameVendor) {
    if (sameOrg?.vendorId === args.vendorId && sameVendor?.orgId === args.orgId)
      return null;
    throw new ConvexError("VENDOR_MAPPING_FROZEN");
  }
  const now = Date.now();
  const id = await ctx.db.insert("cashfreeVendors", {
    ...args,
    providerStatus: "UNVERIFIED",
    checkedAt: 0,
    createdAt: now,
    updatedAt: now,
  });
  await audit(
    ctx,
    "cashfreeVendors",
    id,
    "payment.vendor.registered",
    args.orgId,
  );
  if (adminUserId) {
    await ctx.db.insert("auditLog", {
      entityTable: "cashfreeVendors",
      entityId: id,
      action: "payment.vendor.admin_registered",
      orgId: args.orgId,
      metadata: { adminUserId, mode: args.mode },
      createdAt: now,
    });
  }
  return null;
}

/** Candidate registration cannot assert provider activation. IDs cannot be reassigned. */
export const registerVendor = internalMutation({
  args: vendorRegistrationArgs,
  returns: v.null(),
  handler: (ctx, args) => registerVendorMapping(ctx, args),
});

export const registerVendorForAdmin = mutation({
  args: vendorRegistrationArgs,
  returns: v.null(),
  handler: async (ctx, args) => {
    const admin = await requireAdmin(ctx);
    return registerVendorMapping(ctx, args, admin._id);
  },
});

const vendorSetupView = v.object({
  mode: vCashfreeMode,
  vendorId: v.string(),
  providerStatus: v.string(),
  checkedAt: v.number(),
});

export const setupConfigurationForAdmin = query({
  args: {},
  returns: v.object({
    mode: v.union(vCashfreeMode, v.null()),
    sandboxCheckout: v.boolean(),
  }),
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const config = cashfreeEnv();
    return {
      mode: config?.mode ?? null,
      sandboxCheckout: config?.mode === "sandbox" && config.checkoutEnabled,
    };
  },
});

/** Bounded admin roster. This returns references and provider evidence, never bank details or keys. */
export const vendorsForAdmin = query({
  args: { paginationOpts: paginationOptsValidator },
  returns: paginationResultValidator(
    v.object({
      orgId: v.id("orgs"),
      name: v.string(),
      active: v.boolean(),
      vendors: v.array(vendorSetupView),
    }),
  ),
  handler: async (ctx, { paginationOpts }) => {
    await requireAdmin(ctx);
    if (
      !Number.isSafeInteger(paginationOpts.numItems) ||
      paginationOpts.numItems < 1
    )
      throw new ConvexError("INVALID_PAGE_SIZE");
    const result = await ctx.db
      .query("orgs")
      .order("desc")
      .paginate({
        ...paginationOpts,
        numItems: Math.min(paginationOpts.numItems, 50),
        maximumRowsRead: 50,
      });
    const page = await Promise.all(
      result.page.map(async (org) => {
        const vendors = await Promise.all(
          (["sandbox", "live"] as const).map(async (mode) => {
            const vendor = await ctx.db
              .query("cashfreeVendors")
              .withIndex("by_org_mode", (q) =>
                q.eq("orgId", org._id).eq("mode", mode),
              )
              .unique();
            return vendor
              ? {
                  mode,
                  vendorId: vendor.vendorId,
                  providerStatus: vendor.providerStatus,
                  checkedAt: vendor.checkedAt,
                }
              : null;
          }),
        );
        return {
          orgId: org._id,
          name: org.name,
          active: org.status === "active",
          vendors: vendors.filter((vendor) => vendor !== null),
        };
      }),
    );
    return { ...result, page };
  },
});

/** Actions authorize the current administrator and frozen org mapping before provider lookup. */
export const vendorForAdmin = internalQuery({
  args: { orgId: v.id("orgs"), mode: vCashfreeMode },
  returns: v.string(),
  handler: async (ctx, { orgId, mode }) => {
    await requireAdmin(ctx);
    const org = await ctx.db.get("orgs", orgId);
    if (org?.status !== "active") throw new ConvexError("NO_BUSINESS");
    const vendor = await ctx.db
      .query("cashfreeVendors")
      .withIndex("by_org_mode", (q) => q.eq("orgId", orgId).eq("mode", mode))
      .unique();
    if (!vendor) throw new ConvexError("PAYMENT_VENDOR_UNVERIFIED");
    return vendor.vendorId;
  },
});
export const recordVendor = internalMutation({
  args: { mode: vCashfreeMode, vendorId: v.string(), status: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const vendor = await ctx.db
      .query("cashfreeVendors")
      .withIndex("by_mode_vendor", (q) =>
        q.eq("mode", args.mode).eq("vendorId", args.vendorId),
      )
      .unique();
    if (!vendor) throw new ConvexError("INVALID_VENDOR");
    // Store a small status allowlist, not an arbitrary provider error/body.
    const status = [
      "ACTIVE",
      "BLOCKED",
      "DELETED",
      "IN_BENE_CREATION",
    ].includes(args.status)
      ? args.status
      : "UNVERIFIED";
    await ctx.db.patch("cashfreeVendors", vendor._id, {
      providerStatus: status,
      checkedAt: Date.now(),
      updatedAt: Date.now(),
    });
    await audit(
      ctx,
      "cashfreeVendors",
      vendor._id,
      "payment.vendor.checked",
      vendor.orgId,
    );
    return null;
  },
});

export const prepare = internalMutation({
  args: {
    tradeId: v.id("trades"),
    idempotencyKey: v.string(),
    mode: v.optional(vCashfreeMode),
  },
  returns: v.id("cashfreeOrders"),
  handler: async (ctx, args) => {
    const { trade, profile } = await ownedTrade(ctx, args.tradeId);
    const config = cashfreeEnv();
    if (
      !config?.checkoutEnabled ||
      config.mode !== (args.mode ?? "sandbox") ||
      (config.mode === "live" && !(await isLiveReady(ctx)))
    )
      throw new ConvexError("GATEWAY_REQUIRED");
    const currentFinancial = await financial(ctx, trade._id);
    if (
      trade.status !== "accepted" ||
      (currentFinancial?.state ?? "awaiting_payment") !== "awaiting_payment"
    )
      throw new ConvexError("INVALID_TRADE_STATE");
    await requireCurrentTradeMaterial(ctx, trade);
    const seller = await ctx.db.get("orgs", trade.sellerOrgId);
    if (seller?.status !== "active" || trade.sellerOrgId === trade.buyerOrgId)
      throw new ConvexError("INVALID_TRADE_STATE");
    const user = await requireUser(ctx);
    if (
      !profile.phone ||
      user.phoneNumberVerified !== true ||
      user.phoneNumber !== profile.phone ||
      !/^\+91[6-9]\d{9}$/.test(profile.phone)
    )
      throw new ConvexError("VERIFIED_PHONE_REQUIRED");
    const existing = await ctx.db
      .query("cashfreeOrders")
      .withIndex("by_trade_mode", (q) =>
        q.eq("tradeId", args.tradeId).eq("mode", config.mode),
      )
      .unique();
    if (existing) {
      if (!(await isScopeValid(ctx, existing)))
        throw new ConvexError("PAYMENT_SCOPE_CHANGED");
      return existing._id;
    }
    if (
      !/^[\da-f]{8}-(?:[\da-f]{4}-){3}[\da-f]{12}$/i.test(args.idempotencyKey)
    )
      throw new ConvexError("INVALID_PAYMENT_KEY");
    if (
      trade.totalPaise < 100 ||
      trade.totalPaise > MAX_PAYMENT_PAISE ||
      safePaiseFor(trade.grams, trade.paisePerKg) !== trade.totalPaise
    )
      throw new ConvexError("INVALID_PAYMENT_AMOUNT");
    const vendor = await ctx.db
      .query("cashfreeVendors")
      .withIndex("by_org_mode", (q) =>
        q.eq("orgId", trade.sellerOrgId).eq("mode", config.mode),
      )
      .unique();
    const now = Date.now();
    if (
      vendor?.providerStatus !== "ACTIVE" ||
      now - vendor.checkedAt > VENDOR_FRESH_MS
    )
      throw new ConvexError("PAYMENT_VENDOR_UNVERIFIED");
    const policy = await selectedPolicy(ctx);
    const id = await ctx.db.insert("cashfreeOrders", {
      tradeId: trade._id,
      buyerOrgId: trade.buyerOrgId,
      sellerOrgId: trade.sellerOrgId,
      mode: config.mode,
      ...(config.mode === "live" && {
        policyId: policy?._id,
      }),
      totalPaise: trade.totalPaise,
      currency: "INR",
      vendorId: vendor.vendorId,
      customerId: `luma_${trade.buyerOrgId}`,
      customerPhone: profile.phone.slice(3),
      providerOrderId: `luma_${config.mode === "sandbox" ? "s" : "l"}_${args.idempotencyKey.replaceAll("-", "")}`,
      idempotencyKey: args.idempotencyKey,
      expiresAt: Math.floor(now / 1000) * 1000 + 30 * 60_000,
      checkout: "prepared",
      collection: "pending",
      settlement: "blocked",
      refund: "blocked",
      lease: 0,
      leaseUntil: 0,
      attempts: 0,
      createdAt: now,
      updatedAt: now,
    });
    await audit(
      ctx,
      "cashfreeOrders",
      id,
      "payment.order.prepared",
      trade.buyerOrgId,
    );
    if (config.mode === "live")
      await setFinancial(ctx, trade._id, { orderId: id });
    await ctx.scheduler.runAfter(
      30 * 60_000 + 1000,
      internal.cashfreeActions.reconcile,
      { orderId: id },
    );
    return id;
  },
});

// Four durable recovery runs per order. Manual reconciliation remains possible
// after exhaustion; it cannot reset the automatic budget or release live funds.
const RECOVERY_LIMIT = 4;
function requiresRecovery(order: Order) {
  return (
    order.collection !== "sandbox_confirmed" &&
    order.collection !== "reconciliation_required" &&
    order.checkout !== "closed" &&
    !(order.checkout === "ready" && order.collection === "pending")
  );
}
async function scheduleRecovery(ctx: MutationCtx, order: Order, delay: number) {
  const recoveryAt = Date.now() + delay;
  await ctx.db.patch("cashfreeOrders", order._id, { recoveryAt });
  await audit(
    ctx,
    "cashfreeOrders",
    order._id,
    "payment.recovery.scheduled",
    order.buyerOrgId,
  );
  await ctx.scheduler.runAfter(delay, internal.cashfreeActions.reconcile, {
    orderId: order._id,
    recoveryAt,
  });
}
async function queueRecovery(
  ctx: MutationCtx,
  orderId: Id<"cashfreeOrders">,
  canReportExhaustion = true,
) {
  const order = await ctx.db.get("cashfreeOrders", orderId);
  if (!order || !requiresRecovery(order) || order.recoveryAt !== undefined)
    return;
  const attempts = order.recoveryAttempts ?? 0;
  if (attempts >= RECOVERY_LIMIT) {
    if (canReportExhaustion)
      await issue(
        ctx,
        order.mode,
        "automatic_recovery_exhausted",
        order.providerOrderId,
      );
    return;
  }
  const delay = Math.max(
    5000 * 2 ** attempts,
    order.leaseUntil - Date.now() + 1000,
  );
  await scheduleRecovery(ctx, order, delay);
}
export const requestRecovery = internalMutation({
  args: { orderId: v.id("cashfreeOrders") },
  returns: v.null(),
  handler: async (ctx, { orderId }) => {
    await queueRecovery(ctx, orderId);
    return null;
  },
});
export const beginRecovery = internalMutation({
  args: { orderId: v.id("cashfreeOrders"), recoveryAt: v.number() },
  returns: v.boolean(),
  handler: async (ctx, { orderId, recoveryAt }) => {
    const order = await ctx.db.get("cashfreeOrders", orderId);
    if (order?.recoveryAt !== recoveryAt || Date.now() < recoveryAt)
      return false;
    await ctx.db.patch("cashfreeOrders", orderId, { recoveryAt: undefined });
    await audit(
      ctx,
      "cashfreeOrders",
      orderId,
      "payment.recovery.started",
      order.buyerOrgId,
    );
    if (!requiresRecovery(order)) return false;
    const attempts = order.recoveryAttempts ?? 0;
    if (attempts >= RECOVERY_LIMIT) {
      await issue(
        ctx,
        order.mode,
        "automatic_recovery_exhausted",
        order.providerOrderId,
      );
      return false;
    }
    await ctx.db.patch("cashfreeOrders", orderId, {
      recoveryAttempts: attempts + 1,
    });
    // Keep a durable successor before the action starts. On the fourth run this
    // successor only records unresolved exhaustion; it cannot call the provider.
    await scheduleRecovery(
      ctx,
      order,
      Math.max(5000 * 2 ** attempts, PAYMENT_LEASE_MS + 1000),
    );
    return true;
  },
});

export const claim = internalMutation({
  args: { orderId: v.id("cashfreeOrders") },
  returns: v.union(v.null(), vCashfreeOrder),
  handler: async (ctx, { orderId }) => {
    const order = await ctx.db.get("cashfreeOrders", orderId);
    if (!order || order.leaseUntil > Date.now()) return null;
    const config = cashfreeEnv();
    if (config?.mode !== order.mode) return null;
    // A scope change prevents checkout, but must not prevent reconciliation of funds already collected.
    const change = {
      lease: order.lease + 1,
      leaseUntil: Date.now() + PAYMENT_LEASE_MS,
      attempts: order.attempts + 1,
      checkout: "creating" as const,
      updatedAt: Date.now(),
    };
    await ctx.db.patch("cashfreeOrders", order._id, change);
    // A durable watchdog also covers an action crash before finish() can run.
    await queueRecovery(ctx, order._id, false);
    await audit(
      ctx,
      "cashfreeOrders",
      order._id,
      "payment.order.claimed",
      order.buyerOrgId,
    );
    return { ...order, ...change };
  },
});
export const scope = internalQuery({
  args: { orderId: v.id("cashfreeOrders") },
  returns: v.boolean(),
  handler: async (ctx, { orderId }) => {
    const order = await ctx.db.get("cashfreeOrders", orderId);
    const lifecycle = order ? await financial(ctx, order.tradeId) : null;
    return order
      ? (await isScopeValid(ctx, order)) &&
          (lifecycle?.state ?? "awaiting_payment") === "awaiting_payment"
      : false;
  },
});
/** Lookup evidence uses the same unique payment identity as webhook evidence. */
async function didRecordProviderAttempt(
  ctx: MutationCtx,
  order: Order,
  paymentId: string,
): Promise<boolean> {
  const prior = await ctx.db
    .query("cashfreeAttempts")
    .withIndex("by_mode_payment", (q) =>
      q.eq("mode", order.mode).eq("providerPaymentId", paymentId),
    )
    .unique();
  if (
    prior &&
    (prior.providerOrderId !== order.providerOrderId ||
      prior.paymentPaise !== order.totalPaise ||
      prior.currency !== "INR")
  ) {
    await issue(
      ctx,
      order.mode,
      "payment_identity_collision",
      order.providerOrderId,
      paymentId,
    );
    return false;
  }
  if (prior?.status === "SUCCESS") return true;
  const fields = {
    mode: order.mode,
    providerPaymentId: paymentId,
    providerOrderId: order.providerOrderId,
    orderId: order._id,
    status: "SUCCESS" as const,
    paymentPaise: order.totalPaise,
    currency: "INR",
    source: "provider_lookup" as const,
    updatedAt: Date.now(),
  };
  const id = prior
    ? prior._id
    : await ctx.db.insert("cashfreeAttempts", {
        ...fields,
        createdAt: Date.now(),
      });
  if (prior) await ctx.db.patch("cashfreeAttempts", id, fields);
  await audit(
    ctx,
    "cashfreeAttempts",
    id,
    "payment.attempt.confirmed",
    order.buyerOrgId,
  );
  return true;
}
function collectionAfter(
  order: Order,
  isUnsafe: boolean,
  canConfirm: boolean,
): Order["collection"] {
  if (isUnsafe || order.collection === "reconciliation_required")
    return "reconciliation_required";
  if (!canConfirm) return order.collection;
  return order.mode === "sandbox" ? "sandbox_confirmed" : "live_confirmed";
}

interface FinishEvidenceInput {
  outcome: "ready" | "paid" | "closed" | "uncertain" | "mismatch";
  paymentId?: string;
  cfOrderId?: string;
}
async function finishEvidence(
  ctx: MutationCtx,
  order: Order,
  args: FinishEvidenceInput,
) {
  const hasValidScope = await isScopeValid(ctx, order);
  const hasPaymentCollision =
    args.outcome === "paid" && args.paymentId
      ? !(await didRecordProviderAttempt(ctx, order, args.paymentId))
      : false;
  const isIdentityChanged = hasChangedIdentity(order.cfOrderId, args.cfOrderId);
  const isDuplicateSuccess = hasChangedIdentity(
    order.successPaymentId,
    args.paymentId,
  );
  const isUnsafe =
    (args.outcome === "paid" &&
      order.collection !== "sandbox_confirmed" &&
      order.collection !== "live_confirmed" &&
      Date.now() > order.expiresAt) ||
    hasPaymentCollision ||
    !hasValidScope ||
    isIdentityChanged ||
    isDuplicateSuccess ||
    args.outcome === "mismatch";
  const isVerifiedCapture =
    args.outcome === "paid" &&
    args.paymentId !== undefined &&
    !hasPaymentCollision &&
    !isIdentityChanged &&
    !isDuplicateSuccess;
  const collection =
    isVerifiedCapture && order.mode === "live"
      ? "live_confirmed"
      : collectionAfter(
          order,
          isUnsafe,
          args.outcome === "paid" && args.paymentId !== undefined,
        );
  return {
    isUnsafe,
    isVerifiedCapture,
    isIdentityChanged,
    collection,
    hasSubstantiveMismatch:
      hasPaymentCollision ||
      isIdentityChanged ||
      isDuplicateSuccess ||
      args.outcome === "mismatch",
  };
}
export const finish = internalMutation({
  args: {
    orderId: v.id("cashfreeOrders"),
    lease: v.number(),
    outcome: v.union(
      v.literal("ready"),
      v.literal("paid"),
      v.literal("closed"),
      v.literal("uncertain"),
      v.literal("mismatch"),
    ),
    sessionId: v.optional(v.string()),
    cfOrderId: v.optional(v.string()),
    paymentId: v.optional(v.string()),
    unpaidTerminal: v.optional(v.boolean()),
  },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const order = await ctx.db.get("cashfreeOrders", args.orderId);
    if (order?.lease !== args.lease) return false;
    const {
      isUnsafe,
      isVerifiedCapture,
      isIdentityChanged,
      collection,
      hasSubstantiveMismatch,
    } = await finishEvidence(ctx, order, args);
    if (isUnsafe)
      await issue(
        ctx,
        order.mode,
        "scope_or_provider_mismatch",
        order.providerOrderId,
        args.paymentId,
      );
    let checkout: Order["checkout"] =
      args.outcome === "ready" ? "ready" : "uncertain";
    if (isUnsafe || args.outcome === "closed" || args.outcome === "paid")
      checkout = "closed";
    if (args.outcome === "uncertain")
      await issue(
        ctx,
        order.mode,
        "provider_unavailable",
        order.providerOrderId,
      );
    await ctx.db.patch("cashfreeOrders", order._id, {
      checkout,
      collection,
      leaseUntil: 0,
      updatedAt: Date.now(),
      sessionId:
        checkout === "ready" && collection === "pending"
          ? args.sessionId
          : undefined,
      ...(args.cfOrderId &&
        !isIdentityChanged && { cfOrderId: args.cfOrderId }),
      ...(args.paymentId &&
        !order.successPaymentId &&
        (!isUnsafe || (isVerifiedCapture && order.mode === "live")) && {
          successPaymentId: args.paymentId,
        }),
    });
    await audit(
      ctx,
      "cashfreeOrders",
      order._id,
      `payment.order.${checkout}`,
      order.buyerOrgId,
    );
    if (hasSubstantiveMismatch && order.mode === "live")
      await hold(ctx, order.tradeId, "provider_evidence_mismatch");
    if (args.outcome === "paid")
      await collected(ctx, order, !isUnsafe, isVerifiedCapture);
    if (!isUnsafe && args.unpaidTerminal) await terminalUnpaid(ctx, order);
    return true;
  },
});

export const recordMalformed = internalMutation({
  args: { mode: vCashfreeMode, bodyHash: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    await issue(
      ctx,
      args.mode,
      "unsupported_signed_event",
      undefined,
      undefined,
      args.bodyHash,
    );
    return null;
  },
});
const vObservation = v.object({
  mode: vCashfreeMode,
  providerOrderId: v.string(),
  providerPaymentId: v.string(),
  status: vAttempt,
  orderPaise: v.number(),
  paymentPaise: v.number(),
  currency: v.string(),
  orderCurrency: v.string(),
  customerId: v.string(),
  timestamp: v.number(),
  bodyHash: v.string(),
});
type Observation = Infer<typeof vObservation>;

async function recordSuccess(
  ctx: MutationCtx,
  order: Order,
  args: Observation,
  isDuplicate: boolean,
) {
  // A replay of the already verified payment cannot undo collection after expiry.
  if (
    (order.collection === "sandbox_confirmed" ||
      order.collection === "live_confirmed") &&
    order.successPaymentId === args.providerPaymentId
  )
    return;
  const isUnsafe = Boolean(
    !(await isScopeValid(ctx, order)) ||
    Date.now() > order.expiresAt ||
    args.timestamp > Date.now() + 5 * 60_000 ||
    (order.successPaymentId &&
      order.successPaymentId !== args.providerPaymentId),
  );
  let collection: Order["collection"] =
    order.collection === "sandbox_confirmed" ||
    order.collection === "live_confirmed"
      ? order.collection
      : "success_observed";
  if (isUnsafe || order.collection === "reconciliation_required")
    collection = "reconciliation_required";
  if (isUnsafe)
    await issue(
      ctx,
      order.mode,
      "late_or_duplicate_success",
      order.providerOrderId,
      args.providerPaymentId,
    );
  if (!isDuplicate || order.collection !== collection) {
    await ctx.db.patch("cashfreeOrders", order._id, {
      collection,
      sessionId: undefined,
      successPaymentId: order.successPaymentId ?? args.providerPaymentId,
      updatedAt: Date.now(),
    });
    await audit(
      ctx,
      "cashfreeOrders",
      order._id,
      "payment.success.observed",
      order.buyerOrgId,
    );
  }
  if (isUnsafe && order.mode === "live")
    await hold(ctx, order.tradeId, "late_or_duplicate_success");
  if (
    !isDuplicate &&
    order.collection !== "sandbox_confirmed" &&
    order.collection !== "live_confirmed"
  )
    await queueRecovery(ctx, order._id);
}

export const observe = internalMutation({
  args: vObservation,
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const order = await ctx.db
      .query("cashfreeOrders")
      .withIndex("by_mode_order", (q) =>
        q.eq("mode", args.mode).eq("providerOrderId", args.providerOrderId),
      )
      .unique();
    const previous = await ctx.db
      .query("cashfreeAttempts")
      .withIndex("by_mode_payment", (q) =>
        q.eq("mode", args.mode).eq("providerPaymentId", args.providerPaymentId),
      )
      .unique();
    const isCollision = Boolean(
      previous &&
      (previous.providerOrderId !== args.providerOrderId ||
        previous.paymentPaise !== args.paymentPaise ||
        previous.currency !== args.currency),
    );
    const isMismatch =
      !order ||
      isCollision ||
      args.orderPaise !== order.totalPaise ||
      args.paymentPaise !== order.totalPaise ||
      args.currency !== "INR" ||
      args.orderCurrency !== "INR" ||
      args.customerId !== order.customerId;
    if (isMismatch) {
      await issue(
        ctx,
        args.mode,
        isCollision
          ? "payment_identity_collision"
          : "orphan_or_amount_mismatch",
        args.providerOrderId,
        args.providerPaymentId,
        args.bodyHash,
      );
      if (order) {
        await ctx.db.patch("cashfreeOrders", order._id, {
          collection: "reconciliation_required",
          sessionId: undefined,
          updatedAt: Date.now(),
        });
        await audit(
          ctx,
          "cashfreeOrders",
          order._id,
          "payment.order.mismatch",
          order.buyerOrgId,
        );
        if (order.mode === "live")
          await hold(ctx, order.tradeId, "provider_evidence_mismatch");
      }
      return false;
    }
    const isDuplicate =
      previous?.status === args.status || previous?.status === "SUCCESS";
    if (!isDuplicate) {
      const fields = {
        mode: args.mode,
        providerPaymentId: args.providerPaymentId,
        providerOrderId: args.providerOrderId,
        orderId: order._id,
        status: args.status,
        paymentPaise: args.paymentPaise,
        currency: args.currency,
        bodyHash: args.bodyHash,
        source: "webhook" as const,
        updatedAt: Date.now(),
      };
      const id = previous
        ? previous._id
        : await ctx.db.insert("cashfreeAttempts", {
            ...fields,
            createdAt: Date.now(),
          });
      if (previous) await ctx.db.patch("cashfreeAttempts", id, fields);
      await audit(
        ctx,
        "cashfreeAttempts",
        id,
        `payment.attempt.${args.status.toLowerCase()}`,
        order.buyerOrgId,
      );
    }
    if (args.status === "SUCCESS")
      await recordSuccess(ctx, order, args, isDuplicate);
    return true;
  },
});

const safeStatus = v.object({
  mode: vCashfreeMode,
  checkout: vCheckout,
  collection: vCollection,
  settlement: v.literal("blocked"),
  refund: v.literal("blocked"),
  totalPaise: v.number(),
  currency: v.literal("INR"),
});
function statusOf(order: Order) {
  return {
    mode: order.mode,
    checkout: order.checkout,
    collection: order.collection,
    settlement: order.settlement,
    refund: order.refund,
    totalPaise: order.totalPaise,
    currency: order.currency,
  };
}
export const status = query({
  args: { tradeId: v.id("trades") },
  returns: v.array(safeStatus),
  handler: async (ctx, { tradeId }) => {
    await ownedTrade(ctx, tradeId, true);
    const orders = await ctx.db
      .query("cashfreeOrders")
      .withIndex("by_trade_mode", (q) => q.eq("tradeId", tradeId))
      .take(2);
    return orders.map((order) => statusOf(order));
  },
});

/** Safe UI hint only. Checkout repeats every authorization and provider check. */
export const availability = query({
  args: { tradeId: v.id("trades") },
  returns: v.object({
    sandboxEnabled: v.boolean(),
    canCheckout: v.boolean(),
    liveCanCheckout: v.optional(v.boolean()),
  }),
  handler: async (
    ctx,
    { tradeId },
  ): Promise<{
    sandboxEnabled: boolean;
    canCheckout: boolean;
    liveCanCheckout?: boolean;
  }> => {
    const { trade, org, profile, role } = await ownedTrade(ctx, tradeId, true);
    const config = cashfreeEnv();
    const lifecycle = await financial(ctx, tradeId);
    const isSandboxEnabled =
      config?.mode === "sandbox" && config.checkoutEnabled;
    const disabled = { sandboxEnabled: isSandboxEnabled, canCheckout: false };
    if (
      role === "viewer" ||
      !config?.checkoutEnabled ||
      trade.buyerOrgId !== org._id ||
      trade.status !== "accepted" ||
      (lifecycle?.state ?? "awaiting_payment") !== "awaiting_payment" ||
      (config.mode === "live" && !(await isLiveReady(ctx)))
    )
      return disabled;
    const order = await ctx.db
      .query("cashfreeOrders")
      .withIndex("by_trade_mode", (q) =>
        q.eq("tradeId", tradeId).eq("mode", config.mode),
      )
      .unique();
    if (
      order &&
      (order.checkout === "closed" ||
        order.collection !== "pending" ||
        order.expiresAt <= Date.now())
    )
      return disabled;
    const user = await requireUser(ctx);
    const seller = await ctx.db.get("orgs", trade.sellerOrgId);
    const vendor = await ctx.db
      .query("cashfreeVendors")
      .withIndex("by_org_mode", (q) =>
        q.eq("orgId", trade.sellerOrgId).eq("mode", config.mode),
      )
      .unique();
    const isAllowed =
      seller?.status === "active" &&
      trade.sellerOrgId !== org._id &&
      user.phoneNumberVerified === true &&
      user.phoneNumber === profile.phone &&
      /^\+91[6-9]\d{9}$/.test(profile.phone ?? "") &&
      vendor?.providerStatus === "ACTIVE" &&
      vendor.checkedAt <= Date.now() &&
      Date.now() - vendor.checkedAt <= VENDOR_FRESH_MS &&
      trade.totalPaise >= 100 &&
      trade.totalPaise <= MAX_PAYMENT_PAISE &&
      safePaiseFor(trade.grams, trade.paisePerKg) === trade.totalPaise;
    return config.mode === "sandbox"
      ? { sandboxEnabled: isSandboxEnabled, canCheckout: isAllowed }
      : { ...disabled, ...(isAllowed && { liveCanCheckout: true }) };
  },
});

async function isVendorReady(ctx: QueryCtx, order: Order): Promise<boolean> {
  const vendor = await ctx.db
    .query("cashfreeVendors")
    .withIndex("by_org_mode", (q) =>
      q.eq("orgId", order.sellerOrgId).eq("mode", order.mode),
    )
    .unique();
  return (
    vendor?.vendorId === order.vendorId &&
    vendor.providerStatus === "ACTIVE" &&
    vendor.checkedAt <= Date.now() &&
    Date.now() - vendor.checkedAt <= VENDOR_FRESH_MS
  );
}

export const checkoutResult = internalQuery({
  args: { orderId: v.id("cashfreeOrders") },
  returns: v.object({
    status: safeStatus,
    paymentSessionId: v.union(v.string(), v.null()),
  }),
  handler: async (ctx, { orderId }) => {
    const order = await ctx.db.get("cashfreeOrders", orderId);
    if (!order) throw new ConvexError("TRADE_NOT_FOUND");
    await ownedTrade(ctx, order.tradeId);
    const config = cashfreeEnv();
    const lifecycle = await financial(ctx, order.tradeId);
    const allowed =
      config?.checkoutEnabled &&
      config.mode === order.mode &&
      (order.mode === "sandbox" || (await isLiveReady(ctx))) &&
      (lifecycle?.state ?? "awaiting_payment") === "awaiting_payment" &&
      (await isScopeValid(ctx, order)) &&
      (await isVendorReady(ctx, order)) &&
      Date.now() < order.expiresAt;
    return {
      status: statusOf(order),
      paymentSessionId:
        allowed && order.checkout === "ready" && order.collection === "pending"
          ? (order.sessionId ?? null)
          : null,
    };
  },
});
