import { defineTable } from "convex/server";
import { v } from "convex/values";

export const vAuditSnapshot = v.object({
  materialCode: v.string(),
  state: v.string(),
  declaredGrams: v.number(),
  specificationReference: v.string(),
  specificationVersion: v.string(),
  sampleMethod: v.string(),
  results: v.array(
    v.object({ parameter: v.string(), unit: v.string(), value: v.string() }),
  ),
  inspectingDecision: v.string(),
  buyerDecisions: v.array(
    v.object({ decision: v.string(), note: v.string(), createdAt: v.number() }),
  ),
  inspectionCreatedAt: v.number(),
});
export const auditShareTables = {
  auditReports: defineTable({
    orgId: v.id("orgs"),
    recipientId: v.id("stakeholderAccounts"),
    recipientProfileId: v.id("profiles"),
    purpose: v.string(),
    expiresAt: v.number(),
    snapshot: vAuditSnapshot,
    attachmentIds: v.array(v.id("qualityAttachments")),
    inspectionId: v.id("lotInspections"),
    createdBy: v.id("profiles"),
    createdAt: v.number(),
    revokedAt: v.optional(v.number()),
  })
    .index("by_org", ["orgId"])
    .index("by_recipient", ["recipientProfileId"])
    .index("by_creator", ["createdBy"]),
};
