import { defineTable } from "convex/server";
import { v } from "convex/values";

export const vQualityFileKind = v.union(
  v.literal("coa"),
  v.literal("photo"),
  v.literal("sample_report"),
);
export const vBuyerQualityDecision = v.union(
  v.literal("accepted"),
  v.literal("rejected"),
  v.literal("conditional"),
);
export const vR2Reference = v.object({
  accountId: v.string(),
  bucket: v.string(),
  key: v.string(),
});
export const qualityFileTables = {
  qualityUploads: defineTable({
    orgId: v.id("orgs"),
    profileId: v.id("profiles"),
    inspectionId: v.id("lotInspections"),
    shareWithBuyer: v.boolean(),
    r2: vR2Reference,
    size: v.number(),
    sha256: v.string(),
    state: v.union(
      v.literal("pending"),
      v.literal("attached"),
      v.literal("deleting"),
    ),
    fileId: v.optional(v.id("qualityAttachments")),
    createdAt: v.number(),
    cleanupAt: v.number(),
    attempts: v.number(),
  })
    .index("by_profile_created", ["profileId", "createdAt"])
    .index("by_inspection_state", ["inspectionId", "state"])
    .index("by_state_cleanup", ["state", "cleanupAt"]),
  qualityAttachments: defineTable({
    orgId: v.id("orgs"),
    inspectionId: v.id("lotInspections"),
    buyerOrgId: v.optional(v.id("orgs")),
    kind: vQualityFileKind,
    name: v.string(),
    contentType: v.string(),
    size: v.number(),
    sha256: v.string(),
    storageId: v.optional(v.id("_storage")),
    r2: v.optional(vR2Reference),
    createdBy: v.id("profiles"),
    createdAt: v.number(),
    withdrawnAt: v.optional(v.number()),
  })
    .index("by_org", ["orgId"])
    .index("by_inspection", ["inspectionId"])
    .index("by_buyer", ["buyerOrgId"])
    .index("by_storage", ["storageId"]),
  qualityBuyerDecisions: defineTable({
    inspectionId: v.id("lotInspections"),
    inspectingOrgId: v.id("orgs"),
    buyerOrgId: v.id("orgs"),
    attachmentIds: v.array(v.id("qualityAttachments")),
    decision: vBuyerQualityDecision,
    note: v.string(),
    actorProfileId: v.id("profiles"),
    createdAt: v.number(),
  })
    .index("by_inspection", ["inspectionId"])
    .index("by_buyer", ["buyerOrgId"])
    .index("by_inspecting_org", ["inspectingOrgId"]),
};
