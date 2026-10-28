import { defineTable } from "convex/server";
import { v } from "convex/values";

export const vReturnStatus = v.union(
  v.literal("proposed"),
  v.literal("rejected"),
  v.literal("approved"),
  v.literal("in_transit"),
  v.literal("received"),
  v.literal("reconciled"),
);
export const returnFields = {
  tradeId: v.id("trades"),
  sellerOrgId: v.id("orgs"),
  buyerOrgId: v.id("orgs"),
  proposedByOrgId: v.id("orgs"),
  destinationOrgId: v.id("orgs"),
  reference: v.string(),
  reason: v.string(),
  freightPayer: v.union(v.literal("buyer"), v.literal("seller")),
  grams: v.number(),
  status: vReturnStatus,
  proposedByProfileId: v.id("profiles"),
  approvedByProfileId: v.optional(v.id("profiles")),
  dispatchReference: v.optional(v.string()),
  receiptReference: v.optional(v.string()),
  rejectionReason: v.optional(v.string()),
  createdAt: v.number(),
  updatedAt: v.number(),
};
export const claimFields = {
  orgId: v.id("orgs"),
  sourceTradeId: v.id("trades"),
  schemeReference: v.string(),
  issuerReference: v.string(),
  operationReference: v.string(),
  grams: v.number(),
  evidenceScope: v.literal("reported_unverified"),
  status: v.union(v.literal("declared"), v.literal("withdrawn")),
  actorProfileId: v.id("profiles"),
  withdrawalReason: v.optional(v.string()),
  withdrawnAt: v.optional(v.number()),
  createdAt: v.number(),
};
export const returnClaimsTables = {
  materialReturns: defineTable(returnFields)
    .index("by_trade", ["tradeId"])
    .index("by_buyer_status", ["buyerOrgId", "status"])
    .index("by_seller_created", ["sellerOrgId", "createdAt"])
    .index("by_buyer_created", ["buyerOrgId", "createdAt"]),
  schemeAllocations: defineTable(claimFields)
    .index("by_org_created", ["orgId", "createdAt"])
    .index("by_source_scheme", ["sourceTradeId", "schemeReference"])
    .index("by_source", ["sourceTradeId"])
    .index("by_org_operation", ["orgId", "operationReference"]),
};
