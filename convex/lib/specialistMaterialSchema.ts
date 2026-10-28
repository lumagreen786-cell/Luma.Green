import { v } from "convex/values";

export const specialistMaterialFields = {
  specialistReference: v.optional(
    v.object({
      category: v.union(
        v.literal("textile"),
        v.literal("electronics"),
        v.literal("battery"),
        v.literal("tyre"),
        v.literal("used_cooking_oil"),
        v.literal("used_lubricating_oil"),
        v.literal("industrial_residue"),
        v.literal("end_of_life_vehicle"),
      ),
      routeStatus: v.literal("unavailable"),
      classificationStatus: v.literal("unverified"),
      sourceReference: v.string(),
    }),
  ),
};
