import { defineTable } from "convex/server";
import { v } from "convex/values";

export const vCarbonMethod = v.union(
  v.literal("verra_vmr0007"),
  v.literal("bee_wa03_003"),
  v.literal("bee_in02_001"),
  v.literal("verra_vmr0008"),
);

export const requiredCarbonEvidence = [
  "baseline",
  "monitoring",
  "claim_rights",
  "verification_report",
] as const;

export const vCarbonEvidenceKind = v.union(
  v.literal("baseline"),
  v.literal("monitoring"),
  v.literal("claim_rights"),
  v.literal("verification_report"),
  v.literal("registry_project"),
  v.literal("registry_issuance"),
  v.literal("registry_transfer"),
  v.literal("registry_retirement"),
);

export const vCarbonProjectStatus = v.union(
  v.literal("draft"),
  v.literal("internally_reviewed"),
);

export const carbonEvidenceFields = {
  kind: vCarbonEvidenceKind,
  reference: v.string(),
  recordedAt: v.number(),
};

export const carbonReviewSnapshotFields = {
  projectId: v.id("carbonProjects"),
  facilityId: v.id("industrialFacilities"),
  method: vCarbonMethod,
  revision: v.number(),
  reviewedAt: v.number(),
  references: v.array(v.object(carbonEvidenceFields)),
  batches: v.array(
    v.object({
      transformationId: v.id("lotTransformations"),
      inputGrams: v.number(),
      recordedAt: v.number(),
    }),
  ),
};

export const carbonProjectTables = {
  carbonReviewSnapshots: defineTable(carbonReviewSnapshotFields).index(
    "by_project_revision",
    ["projectId", "revision"],
  ),
  carbonProjectBatches: defineTable({
    projectId: v.id("carbonProjects"),
    transformationId: v.id("lotTransformations"),
    inputGrams: v.number(),
    recordedAt: v.number(),
  })
    .index("by_project_recorded", ["projectId", "recordedAt"])
    .index("by_transformation", ["transformationId"]),
  carbonProjects: defineTable({
    orgId: v.id("orgs"),
    facilityId: v.id("industrialFacilities"),
    facilityName: v.string(),
    method: vCarbonMethod,
    name: v.string(),
    status: vCarbonProjectStatus,
    evidence: v.array(
      v.object({
        ...carbonEvidenceFields,
        revision: v.number(),
      }),
    ),
    revision: v.number(),
    snapshotRevision: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_org_updated", ["orgId", "updatedAt"])
    .index("by_org_facility_method_name", [
      "orgId",
      "facilityId",
      "method",
      "name",
    ]),
};
