import { defineTable } from "convex/server";
import { v } from "convex/values";

export const vPaperRow = v.object({
  dateText: v.string(),
  description: v.string(),
  quantityText: v.string(),
  unitText: v.string(),
  amountText: v.string(),
  referenceText: v.string(),
});
export const vPaperContent = v.object({
  text: v.string(),
  rows: v.array(vPaperRow),
});
export const vPaperStatus = v.union(
  v.literal("draft"),
  v.literal("extracting"),
  v.literal("confirmed"),
);
export const vExtractionStatus = v.union(
  v.literal("none"),
  v.literal("pending"),
  v.literal("succeeded"),
  v.literal("failed"),
);
export const paperTables = {
  paperSourceUsage: defineTable({
    orgId: v.id("orgs"),
    usedBytes: v.number(),
    sourceCount: v.number(),
  }).index("by_org", ["orgId"]),
  paperSourceChunks: defineTable({
    orgId: v.id("orgs"),
    draftId: v.id("paperDrafts"),
    position: v.number(),
    bytes: v.bytes(),
  }).index("by_draft", ["draftId"]),
  paperExtractionClaims: defineTable({
    orgId: v.id("orgs"),
    sha256: v.string(),
    createdAt: v.number(),
  }).index("by_org_hash", ["orgId", "sha256"]),
  paperDrafts: defineTable({
    orgId: v.id("orgs"),
    createdBy: v.id("profiles"),
    chunkIds: v.array(v.id("paperSourceChunks")),
    name: v.string(),
    contentType: v.string(),
    size: v.number(),
    sha256: v.string(),
    createdAt: v.number(),
    updatedAt: v.number(),
    expiresAt: v.number(),
    revision: v.number(),
    status: vPaperStatus,
    extractionStatus: vExtractionStatus,
    extractionStartedAt: v.optional(v.number()),
    attemptId: v.optional(v.string()),
    model: v.optional(v.string()),
    promptVersion: v.optional(v.string()),
    extractedContent: v.optional(vPaperContent),
    reviewedContent: v.optional(vPaperContent),
    confirmedAt: v.optional(v.number()),
    confirmedBy: v.optional(v.id("profiles")),
  })
    .index("by_org_created", ["orgId", "createdAt"])
    .index("by_org_status", ["orgId", "status"])
    .index("by_org_hash", ["orgId", "sha256"])
    .index("by_expiry", ["expiresAt"]),
  paperTranscriptionQuota: defineTable({
    day: v.string(),
    uploads: v.array(
      v.object({ profileId: v.id("profiles"), orgId: v.id("orgs") }),
    ),
    attempts: v.array(
      v.object({
        profileId: v.id("profiles"),
        orgId: v.id("orgs"),
        draftId: v.id("paperDrafts"),
      }),
    ),
  }).index("by_day", ["day"]),
};
