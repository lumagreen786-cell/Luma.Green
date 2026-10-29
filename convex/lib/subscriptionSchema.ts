import { defineTable } from "convex/server";
import { v } from "convex/values";

export const vSubscriptionPlan = v.union(
  v.literal("trader"),
  v.literal("centre"),
  v.literal("yard"),
  v.literal("processor"),
  v.literal("recycler"),
  v.literal("enterprise"),
  v.literal("institution"),
);
export const vSubscriptionRequestState = v.union(
  v.literal("selected"),
  v.literal("cancelled"),
);
export const businessSubscriptionTables = {
  businessSubscriptions: defineTable({
    orgId: v.id("orgs"),
    selectedPlan: vSubscriptionPlan,
    requestState: vSubscriptionRequestState,
    version: v.number(),
    changedBy: v.id("profiles"),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_org", ["orgId"]),
  businessSubscriptionEvents: defineTable({
    orgId: v.id("orgs"),
    actorId: v.id("profiles"),
    plan: vSubscriptionPlan,
    action: v.union(
      v.literal("selected"),
      v.literal("changed"),
      v.literal("cancelled"),
    ),
    version: v.number(),
    createdAt: v.number(),
  }).index("by_org", ["orgId"]),
  // No producer ships in this release. Future Cashfree adapter must verify signed
  // events, reconcile provider state and deduplicate before writing this owner.
  businessSubscriptionEntitlements: defineTable({
    orgId: v.id("orgs"),
    provider: v.literal("cashfree"),
    providerSubscriptionId: v.string(),
    providerEventId: v.string(),
    plan: vSubscriptionPlan,
    verifiedAt: v.number(),
    validFrom: v.number(),
    validUntil: v.number(),
    memberLimit: v.number(),
    siteLimit: v.number(),
  }).index("by_org", ["orgId"]),
};
