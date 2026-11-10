import { defineTable } from "convex/server";
import { v } from "convex/values";

import { vProcessKind } from "./industrialClassification";
import { vFamily } from "./validators";

export const definitionFields = {
  materialCode: v.string(),
  name: v.string(),
  family: vFamily,
  stage: v.union(v.literal("scrap"), v.literal("recycled")),
  processingState: v.string(),
  grade: v.string(),
  version: v.string(),
  specification: v.string(),
  sourceReference: v.string(),
};
export const vRecipeIngredient = v.object({
  name: v.string(),
  basisPoints: v.number(),
  additive: v.boolean(),
});
export const vProductionInput = v.object({
  lotId: v.id("materialLots"),
  grams: v.number(),
  recycledGrams: v.number(),
  evidenceReference: v.string(),
  additive: v.boolean(),
});
export const operationalTables = {
  operationalDefinitions: defineTable({
    ...definitionFields,
    status: v.union(
      v.literal("draft"),
      v.literal("active"),
      v.literal("retired"),
    ),
    reviewReference: v.optional(v.string()),
    reviewedAt: v.optional(v.number()),
    createdBy: v.string(),
    reviewedBy: v.optional(v.string()),
    createdAt: v.number(),
  })
    .index("by_material_version", ["materialCode", "version"])
    .index("by_status_created", ["status", "createdAt"])
    .index("by_created", ["createdAt"]),
  productionRecipes: defineTable({
    orgId: v.id("orgs"),
    reference: v.string(),
    version: v.string(),
    name: v.string(),
    ingredients: v.array(vRecipeIngredient),
    instructions: v.string(),
    actorProfileId: v.id("profiles"),
    createdAt: v.number(),
  })
    .index("by_org_reference_version", ["orgId", "reference", "version"])
    .index("by_org_created", ["orgId", "createdAt"]),
  productionDeclarations: defineTable({
    orgId: v.id("orgs"),
    reference: v.string(),
    recipeId: v.id("productionRecipes"),
    transformationId: v.id("lotTransformations"),
    inspectionId: v.id("lotInspections"),
    inputs: v.array(vProductionInput),
    inputGrams: v.number(),
    recycledInputGrams: v.number(),
    outputGrams: v.number(),
    recycledInputBasisPoints: v.number(),
    evidenceReference: v.string(),
    actorProfileId: v.id("profiles"),
    createdAt: v.number(),
  })
    .index("by_org_reference", ["orgId", "reference"])
    .index("by_transformation", ["transformationId"])
    .index("by_org_created", ["orgId", "createdAt"]),
  facilityScopeReviews: defineTable({
    facilityId: v.id("industrialFacilities"),
    orgId: v.id("orgs"),
    registrationId: v.id("facilityRegistrations"),
    facilityUpdatedAt: v.number(),
    facilityRevision: v.optional(v.number()),
    ordinaryTradeCustody: v.optional(v.literal(true)),
    materialCodes: v.array(v.string()),
    processes: v.array(vProcessKind),
    decision: v.union(
      v.literal("approved"),
      v.literal("rejected"),
      v.literal("revoked"),
    ),
    evidenceReference: v.string(),
    validUntil: v.string(),
    reviewerId: v.string(),
    createdAt: v.number(),
  })
    .index("by_facility_created", ["facilityId", "createdAt"])
    .index("by_org_created", ["orgId", "createdAt"]),
  controlledDestinations: defineTable({
    name: v.string(),
    siteReference: v.string(),
    materialCodes: v.array(v.string()),
    processes: v.array(vProcessKind),
    authorisationReference: v.string(),
    validUntil: v.string(),
    active: v.boolean(),
    createdBy: v.string(),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_active_updated", ["active", "updatedAt"]),
  controlledDestinationReviews: defineTable({
    destinationId: v.id("controlledDestinations"),
    active: v.boolean(),
    reason: v.string(),
    reviewerId: v.string(),
    createdAt: v.number(),
  }).index("by_destination_created", ["destinationId", "createdAt"]),
};
