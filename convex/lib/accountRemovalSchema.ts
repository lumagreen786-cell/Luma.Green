import { defineTable } from "convex/server";
import { v } from "convex/values";

export const vRemovalState = v.union(
  v.literal("access_closed"),
  v.literal("cleanup_running"),
  v.literal("restricted_review"),
  v.literal("review_recorded"),
);
export const accountRemovalTables = {
  accountRemovals: defineTable({
    profileId: v.id("profiles"),
    authUserId: v.string(),
    operationKey: v.string(),
    state: vRemovalState,
    phase: v.number(),
    cursor: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
    lastError: v.optional(v.string()),
    reviewReference: v.optional(v.string()),
    reviewedBy: v.optional(v.id("profiles")),
    reviewedAt: v.optional(v.number()),
  })
    .index("by_profile", ["profileId"])
    .index("by_state_updatedAt", ["state", "updatedAt"]),
  accountRemovalPhoneBlocks: defineTable({
    phoneHash: v.string(),
    closedAt: v.number(),
  }).index("by_phoneHash", ["phoneHash"]),
};
