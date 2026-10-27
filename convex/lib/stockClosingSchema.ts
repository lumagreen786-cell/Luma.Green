import { defineTable } from "convex/server";
import { v } from "convex/values";

export const vClosingLine = v.object({
  materialCode: v.string(),
  grams: v.number(),
  costPaise: v.union(v.number(), v.null()),
});
export const stockClosingTables = {
  stockAdjustments: defineTable({
    orgId: v.id("orgs"),
    actorProfileId: v.id("profiles"),
    operationKey: v.string(),
    materialCode: v.string(),
    deltaGrams: v.number(),
    costPaise: v.union(v.number(), v.null()),
    reason: v.string(),
    evidenceReference: v.string(),
    createdAt: v.number(),
  })
    .index("by_org_operation", ["orgId", "operationKey"])
    .index("by_org_created", ["orgId", "createdAt"]),
  stockDailyClosings: defineTable({
    orgId: v.id("orgs"),
    actorProfileId: v.id("profiles"),
    operationKey: v.string(),
    day: v.string(),
    note: v.string(),
    lines: v.array(vClosingLine),
    totalGrams: v.number(),
    totalCostPaise: v.union(v.number(), v.null()),
    createdAt: v.number(),
  })
    .index("by_org_day", ["orgId", "day"])
    .index("by_org_operation", ["orgId", "operationKey"]),
  stockThresholds: defineTable({
    orgId: v.id("orgs"),
    materialCode: v.string(),
    enabled: v.boolean(),
    thresholdGrams: v.number(),
    below: v.boolean(),
    recipientProfileId: v.id("profiles"),
    updatedAt: v.number(),
  })
    .index("by_org_material", ["orgId", "materialCode"])
    .index("by_org", ["orgId"]),
  stockLowAlerts: defineTable({
    orgId: v.id("orgs"),
    materialCode: v.string(),
    recipientProfileId: v.id("profiles"),
    thresholdGrams: v.number(),
    grams: v.number(),
    movementId: v.id("inventoryMovements"),
    createdAt: v.number(),
  })
    .index("by_org_created", ["orgId", "createdAt"])
    .index("by_org_movement", ["orgId", "movementId"]),
};
