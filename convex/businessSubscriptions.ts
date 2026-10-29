import { ConvexError, v } from "convex/values";

import type { Id } from "./_generated/dataModel";
import {
  mutation,
  type MutationCtx,
  query,
  type QueryCtx,
} from "./_generated/server";
import { requireRecentSession } from "./lib/organizations";
import {
  siteEntitlement,
  type SubscriptionPlan,
  subscriptionPlans,
} from "./lib/subscriptions";
import {
  vSubscriptionPlan,
  vSubscriptionRequestState,
} from "./lib/subscriptionSchema";
import { requireOrg } from "./lib/workspace";

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
    const [request, entitlement, members, events] = await Promise.all([
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
    ]);
    return {
      billingAvailable: false as const,
      canManage: who.role === "owner" && who.org.status === "active",
      memberCount: members.length,
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
