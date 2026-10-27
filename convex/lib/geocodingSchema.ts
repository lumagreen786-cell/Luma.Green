import { defineTable } from "convex/server";
import { v } from "convex/values";

/** Usage metadata only. Never persist Google content or raw coordinates. */
export const geocodingTables = {
  geocodingAccountDays: defineTable({
    profileId: v.id("profiles"),
    day: v.string(),
    used: v.number(),
    fingerprints: v.array(v.string()),
    lastAt: v.number(),
  }).index("by_profile_day", ["profileId", "day"]),
};
