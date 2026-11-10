import {
  paginationOptsValidator,
  paginationResultValidator,
} from "convex/server";
import { ConvexError, v } from "convex/values";

import type { Id } from "./_generated/dataModel";
import {
  mutation,
  type MutationCtx,
  query,
  type QueryCtx,
} from "./_generated/server";
import { requireAdmin } from "./lib/access";
import { findProfile } from "./lib/applicationAccess";
import {
  billingMonth,
  draftAmounts,
  isBillableBusinessSite,
  isBillingMonth,
  validateDraftPrice,
} from "./lib/draftBilling";
import { requireRecentSession } from "./lib/organizations";
import {
  siteEntitlement,
  type SubscriptionPlan,
  subscriptionPlans,
} from "./lib/subscriptions";
import {
  draftPriceBookFields,
  vSubscriptionPlan,
  vSubscriptionRequestState,
} from "./lib/subscriptionSchema";
import { requireOrg } from "./lib/workspace";

const MAX_USAGE_PER_DRAFT = 1000;
const PRICE_BOOK_VERSION = /^[a-zA-Z0-9][a-zA-Z0-9._-]{0,63}$/;
const vDraftSummary = v.object({
  id: v.id("businessBillingDrafts"),
  month: v.string(),
  plan: vSubscriptionPlan,
  priceBookVersion: v.string(),
  usageCount: v.number(),
  subtotalPaise: v.number(),
});
const vNullableNumber = v.union(v.number(), v.null());
const vPlan = v.object({
  id: vSubscriptionPlan,
  monthlyMinPaise: v.number(),
  monthlyMaxPaise: vNullableNumber,
  memberLimit: vNullableNumber,
  siteLimit: vNullableNumber,
  priceKind: v.union(
    v.literal("target"),
    v.literal("from"),
    v.literal("range"),
  ),
});
export const catalogue = query({
  args: {},
  returns: v.object({ version: v.literal(1), plans: v.array(vPlan) }),
  handler: () => ({
    version: 1 as const,
    plans: subscriptionPlans.map((plan) => ({ ...plan })),
  }),
});
async function access(ctx: QueryCtx, orgId: Id<"orgs">, canWrite = false) {
  const result = await requireOrg(ctx, undefined, canWrite ? "own" : "read");
  if (result.org._id !== orgId) throw new ConvexError("WORKSPACE_CHANGED");
  if (canWrite) await requireRecentSession(ctx);
  return result;
}
export const status = query({
  args: { orgId: v.id("orgs") },
  returns: v.object({
    billingAvailable: v.literal(false),
    canManage: v.boolean(),
    drafts: v.union(v.null(), v.array(vDraftSummary)),
    memberCount: v.number(),
    request: v.union(
      v.null(),
      v.object({
        selectedPlan: vSubscriptionPlan,
        requestState: vSubscriptionRequestState,
        version: v.number(),
        updatedAt: v.number(),
      }),
    ),
    entitlement: v.union(
      v.null(),
      v.object({
        plan: vSubscriptionPlan,
        memberLimit: v.number(),
        siteLimit: v.number(),
        validUntil: v.number(),
      }),
    ),
    events: v.array(
      v.object({
        action: v.union(
          v.literal("selected"),
          v.literal("changed"),
          v.literal("cancelled"),
        ),
        plan: vSubscriptionPlan,
        version: v.number(),
        createdAt: v.number(),
      }),
    ),
  }),
  handler: async (ctx, { orgId }) => {
    const who = await access(ctx, orgId);
    const [request, entitlement, members, events, drafts] = await Promise.all([
      ctx.db
        .query("businessSubscriptions")
        .withIndex("by_org", (q) => q.eq("orgId", orgId))
        .unique(),
      siteEntitlement(ctx, orgId),
      ctx.db
        .query("memberships")
        .withIndex("by_org", (q) => q.eq("orgId", orgId))
        .take(101),
      ctx.db
        .query("businessSubscriptionEvents")
        .withIndex("by_org", (q) => q.eq("orgId", orgId))
        .order("desc")
        .take(20),
      who.role === "owner"
        ? ctx.db
            .query("businessBillingDrafts")
            .withIndex("by_org_month", (q) => q.eq("orgId", orgId))
            .order("desc")
            .take(12)
        : null,
    ]);
    return {
      billingAvailable: false as const,
      canManage: who.role === "owner" && who.org.status === "active",
      memberCount: members.length,
      drafts:
        drafts?.map((draft) => ({
          id: draft._id,
          month: draft.month,
          plan: draft.plan,
          priceBookVersion: draft.priceBookVersion,
          usageCount: draft.usage.length,
          subtotalPaise: draft.subtotalPaise,
        })) ?? null,
      request: request
        ? {
            selectedPlan: request.selectedPlan,
            requestState: request.requestState,
            version: request.version,
            updatedAt: request.updatedAt,
          }
        : null,
      entitlement,
      events: events.map(({ action, plan, version, createdAt }) => ({
        action,
        plan,
        version,
        createdAt,
      })),
    };
  },
});
async function record(
  ctx: MutationCtx,
  orgId: Id<"orgs">,
  actorId: Id<"profiles">,
  plan: SubscriptionPlan,
  action: "selected" | "changed" | "cancelled",
  version: number,
  id: Id<"businessSubscriptions">,
) {
  const now = Date.now();
  await ctx.db.insert("businessSubscriptionEvents", {
    orgId,
    actorId,
    plan,
    action,
    version,
    createdAt: now,
  });
  await ctx.db.insert("auditLog", {
    orgId,
    actorProfileId: actorId,
    action: "subscription.request_" + action,
    entityTable: "businessSubscriptions",
    entityId: id,
    metadata: { plan, version },
    createdAt: now,
  });
}
function checkVersion(expected: number, actual: number) {
  if (expected !== actual || expected < 0 || !Number.isSafeInteger(expected))
    throw new ConvexError("STALE_VERSION");
}
export const selectPlan = mutation({
  args: {
    orgId: v.id("orgs"),
    plan: vSubscriptionPlan,
    expectedVersion: v.number(),
  },
  returns: v.number(),
  handler: async (ctx, args) => {
    const { profile } = await access(ctx, args.orgId, true);
    const row = await ctx.db
      .query("businessSubscriptions")
      .withIndex("by_org", (q) => q.eq("orgId", args.orgId))
      .unique();
    checkVersion(args.expectedVersion, row?.version ?? 0);
    if (row?.requestState === "selected" && row.selectedPlan === args.plan)
      return row.version;
    const now = Date.now(),
      version = (row?.version ?? 0) + 1;
    const id = row
      ? row._id
      : await ctx.db.insert("businessSubscriptions", {
          orgId: args.orgId,
          selectedPlan: args.plan,
          requestState: "selected",
          version,
          changedBy: profile._id,
          createdAt: now,
          updatedAt: now,
        });
    if (row)
      await ctx.db.patch("businessSubscriptions", row._id, {
        selectedPlan: args.plan,
        requestState: "selected",
        version,
        changedBy: profile._id,
        updatedAt: now,
      });
    await record(
      ctx,
      args.orgId,
      profile._id,
      args.plan,
      row?.requestState === "selected" ? "changed" : "selected",
      version,
      id,
    );
    return version;
  },
});
export const cancelRequest = mutation({
  args: { orgId: v.id("orgs"), expectedVersion: v.number() },
  returns: v.number(),
  handler: async (ctx, args) => {
    const { profile } = await access(ctx, args.orgId, true);
    const row = await ctx.db
      .query("businessSubscriptions")
      .withIndex("by_org", (q) => q.eq("orgId", args.orgId))
      .unique();
    if (!row) throw new ConvexError("SUBSCRIPTION_REQUEST_MISSING");
    checkVersion(args.expectedVersion, row.version);
    if (row.requestState === "cancelled") return row.version;
    const version = row.version + 1;
    await ctx.db.patch("businessSubscriptions", row._id, {
      requestState: "cancelled",
      version,
      changedBy: profile._id,
      updatedAt: Date.now(),
    });
    await record(
      ctx,
      args.orgId,
      profile._id,
      row.selectedPlan,
      "cancelled",
      version,
      row._id,
    );
    return version;
  },
});

async function billingAdmin(ctx: MutationCtx) {
  const admin = await requireAdmin(ctx);
  await requireRecentSession(ctx);
  const profile = await findProfile(ctx, admin._id);
  return profile?._id;
}

/** Only explicit admin input creates a draft book. Catalogue targets are independent. */
export const recordDraftPriceBook = mutation({
  args: draftPriceBookFields,
  returns: v.id("businessBillingPriceBooks"),
  handler: async (ctx, args) => {
    const actorProfileId = await billingAdmin(ctx);
    if (
      !PRICE_BOOK_VERSION.test(args.version) ||
      !isBillingMonth(args.startsMonth) ||
      args.plans.length === 0 ||
      args.plans.length > subscriptionPlans.length ||
      new Set(args.plans.map(({ plan }) => plan)).size !== args.plans.length
    )
      throw new ConvexError("INVALID_DRAFT_PRICE_BOOK");
    validateDraftPrice(
      args.plans.map(({ monthlyPaise }) => monthlyPaise),
      args.feeBps,
      args.feeCapPaise,
    );
    const plans = args.plans.toSorted((a, b) =>
      a.plan.localeCompare(b.plan, "en"),
    );
    const prior = await ctx.db
      .query("businessBillingPriceBooks")
      .withIndex("by_version", (q) => q.eq("version", args.version))
      .unique();
    if (prior) {
      if (
        prior.startsMonth !== args.startsMonth ||
        prior.feeBps !== args.feeBps ||
        prior.feeCapPaise !== args.feeCapPaise ||
        prior.plans.length !== plans.length ||
        prior.plans.some(
          ({ plan, monthlyPaise }, index) =>
            plans[index]?.plan !== plan ||
            plans[index].monthlyPaise !== monthlyPaise,
        )
      )
        throw new ConvexError("DRAFT_PRICE_BOOK_CONFLICT");
      return prior._id;
    }
    const now = Date.now();
    const id = await ctx.db.insert("businessBillingPriceBooks", {
      ...args,
      plans,
      createdBy: actorProfileId,
      createdAt: now,
    });
    await ctx.db.insert("auditLog", {
      actorProfileId,
      action: "billing.draft_price_book_recorded",
      entityTable: "businessBillingPriceBooks",
      entityId: id,
      metadata: { version: args.version, startsMonth: args.startsMonth },
      createdAt: now,
    });
    return id;
  },
});

/** Finance staff only. No provider data is used to select a draft site. */
export const draftSitesForAdmin = query({
  args: { paginationOpts: paginationOptsValidator },
  returns: paginationResultValidator(
    v.object({
      orgId: v.id("orgs"),
      name: v.string(),
      city: v.string(),
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
        numItems: Math.min(paginationOpts.numItems, 30),
        maximumRowsRead: 30,
      });
    return {
      ...result,
      page: result.page.map(({ _id, name, city }) => ({
        orgId: _id,
        name,
        city,
      })),
    };
  },
});

/** Freeze a reviewed period before tax. The draft is not a charge or entitlement. */
export const generateDraftInvoice = mutation({
  args: {
    orgId: v.id("orgs"),
    month: v.string(),
    plan: vSubscriptionPlan,
    priceBookVersion: v.string(),
  },
  returns: v.id("businessBillingDrafts"),
  handler: async (ctx, args) => {
    const actorProfileId = await billingAdmin(ctx);
    if (!isBillingMonth(args.month))
      throw new ConvexError("INVALID_DRAFT_PERIOD");
    if (!PRICE_BOOK_VERSION.test(args.priceBookVersion))
      throw new ConvexError("INVALID_DRAFT_PRICE_BOOK");
    const now = Date.now();
    if (args.month >= billingMonth(now))
      throw new ConvexError("DRAFT_PERIOD_OPEN");
    const org = await ctx.db.get("orgs", args.orgId);
    if (!org || !isBillableBusinessSite(org))
      throw new ConvexError("DRAFT_SITE_NOT_FOUND");

    const prior = await ctx.db
      .query("businessBillingDrafts")
      .withIndex("by_org_month", (q) =>
        q.eq("orgId", args.orgId).eq("month", args.month),
      )
      .unique();
    if (prior) {
      if (
        prior.plan !== args.plan ||
        prior.priceBookVersion !== args.priceBookVersion
      )
        throw new ConvexError("DRAFT_INVOICE_CONFLICT");
      return prior._id;
    }

    const book = await ctx.db
      .query("businessBillingPriceBooks")
      .withIndex("by_version", (q) => q.eq("version", args.priceBookVersion))
      .unique();
    const price = book?.plans.find(({ plan }) => plan === args.plan);
    if (!book || !price || book.startsMonth > args.month)
      throw new ConvexError("DRAFT_PRICE_BOOK_NOT_FOUND");

    const usage = await ctx.db
      .query("businessBillingUsage")
      .withIndex("by_org_month", (q) =>
        q.eq("orgId", args.orgId).eq("month", args.month),
      )
      .take(MAX_USAGE_PER_DRAFT + 1);
    if (usage.length > MAX_USAGE_PER_DRAFT)
      throw new ConvexError("DRAFT_USAGE_LIMIT");

    const { feesPaise, subtotalPaise } = draftAmounts(
      price.monthlyPaise,
      usage.map(({ materialPaise }) => materialPaise),
      book.feeBps,
      book.feeCapPaise,
    );
    const id = await ctx.db.insert("businessBillingDrafts", {
      ...args,
      monthlyPaise: price.monthlyPaise,
      usage: usage.map(({ _id }, index) => ({
        usageId: _id,
        feePaise: feesPaise[index],
      })),
      subtotalPaise,
      createdBy: actorProfileId,
      createdAt: now,
    });
    await ctx.db.insert("auditLog", {
      orgId: args.orgId,
      actorProfileId,
      action: "billing.draft_invoice_generated",
      entityTable: "businessBillingDrafts",
      entityId: id,
      metadata: { month: args.month, priceBookVersion: args.priceBookVersion },
      createdAt: now,
    });
    return id;
  },
});
