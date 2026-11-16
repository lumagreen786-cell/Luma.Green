import { defineTable } from "convex/server";
import { v } from "convex/values";

export const householdFootprintTables = {
  householdFootprints: defineTable({
    profileId: v.id("profiles"),
    operationKey: v.string(),
    periodStart: v.string(),
    periodEnd: v.string(),
    wattHours: v.number(),
    milliGramsCO2: v.number(),
    factorGramsPerKwh: v.number(),
    factorVersion: v.string(),
    source: v.string(),
    createdAt: v.number(),
  })
    .index("by_profile_created", ["profileId", "createdAt"])
    .index("by_profile_operation", ["profileId", "operationKey"]),
};
