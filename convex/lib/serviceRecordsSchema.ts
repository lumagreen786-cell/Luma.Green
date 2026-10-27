import { defineTable } from "convex/server";
import { v } from "convex/values";
export const SERVICE_KINDS = [
  "equipment",
  "staffing",
  "transport",
  "environment",
  "accounting",
  "solar",
  "scales",
  "voice",
  "society",
  "welfare",
  "donation",
  "reward",
  "finance",
  "insurance",
  "attendance",
  "wet_service",
  "other",
] as const;
export const vServiceKind = v.union(
  v.literal("equipment"),
  v.literal("staffing"),
  v.literal("transport"),
  v.literal("environment"),
  v.literal("accounting"),
  v.literal("solar"),
  v.literal("scales"),
  v.literal("voice"),
  v.literal("society"),
  v.literal("welfare"),
  v.literal("donation"),
  v.literal("reward"),
  v.literal("finance"),
  v.literal("insurance"),
  v.literal("attendance"),
  v.literal("wet_service"),
  v.literal("other"),
);
export const COMMERCIAL_MODELS = [
  "partner_service",
  "materials_sale_reference",
  "toll_jobwork",
  "paid_collection",
  "generator_paid_treatment",
] as const;
export const vCommercialModel = v.union(
  v.literal("partner_service"),
  v.literal("materials_sale_reference"),
  v.literal("toll_jobwork"),
  v.literal("paid_collection"),
  v.literal("generator_paid_treatment"),
);
export const vPaymentDirection = v.union(
  v.literal("not_applicable"),
  v.literal("buyer_to_seller"),
  v.literal("principal_to_processor"),
  v.literal("customer_to_service"),
  v.literal("generator_to_handler"),
);
export const serviceCommercialFields = {
  commercialModel: vCommercialModel,
  paymentDirection: vPaymentDirection,
  principalParty: v.string(),
  materialLotId: v.optional(v.id("materialLots")),
  materialSnapshot: v.optional(
    v.object({ materialCode: v.string(), declaredGrams: v.number() }),
  ),
};
export const vServiceState = v.union(
  v.literal("draft"),
  v.literal("enquiry"),
  v.literal("closed"),
);
export const programmeAggregateFields = {
  area: v.string(),
  startsOn: v.string(),
  endsOn: v.string(),
  stream: v.string(),
  coverageCount: v.number(),
  trips: v.number(),
  centreHandovers: v.number(),
  quantityGrams: v.number(),
  groupIncomePaise: v.number(),
  sourceQuality: v.literal("reported_unverified"),
};
export const serviceRecordsTables = {
  serviceKindDefinitions: defineTable({
    code: vServiceKind,
    nameKey: v.string(),
    active: v.boolean(),
  }).index("by_code", ["code"]),
  serviceEnquiries: defineTable({
    requesterProfileId: v.id("profiles"),
    orgId: v.optional(v.id("orgs")),
    recipientId: v.optional(v.id("stakeholderAccounts")),
    recipientProfileId: v.optional(v.id("profiles")),
    operationKey: v.string(),
    creationFingerprint: v.optional(v.string()),
    ...serviceCommercialFields,
    kind: vServiceKind,
    submittedOnCreate: v.boolean(),
    title: v.string(),
    details: v.string(),
    state: vServiceState,
    version: v.number(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_requester_operation", ["requesterProfileId", "operationKey"])
    .index("by_requester_updated", ["requesterProfileId", "updatedAt"])
    .index("by_state_updated", ["state", "updatedAt"])
    .index("by_recipient_updated", ["recipientProfileId", "updatedAt"]),
  programmeRecords: defineTable({
    requesterProfileId: v.id("profiles"),
    orgId: v.optional(v.id("orgs")),
    operationKey: v.string(),
    creationFingerprint: v.optional(v.string()),
    title: v.string(),
    evidenceReference: v.string(),
    ...programmeAggregateFields,
    state: v.union(v.literal("draft"), v.literal("closed")),
    version: v.number(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_requester_operation", ["requesterProfileId", "operationKey"])
    .index("by_requester_updated", ["requesterProfileId", "updatedAt"])
    .index("by_state_updated", ["state", "updatedAt"]),
  programmeAggregateReports: defineTable({
    requesterProfileId: v.id("profiles"),
    programmeId: v.id("programmeRecords"),
    recipientId: v.id("stakeholderAccounts"),
    recipientProfileId: v.id("profiles"),
    operationKey: v.string(),
    purpose: v.string(),
    ...programmeAggregateFields,
    expiresAt: v.number(),
    revokedAt: v.optional(v.number()),
    createdAt: v.number(),
  })
    .index("by_requester_operation", ["requesterProfileId", "operationKey"])
    .index("by_programme", ["programmeId"])
    .index("by_requester_created", ["requesterProfileId", "createdAt"])
    .index("by_recipient_created", ["recipientProfileId", "createdAt"]),
};
