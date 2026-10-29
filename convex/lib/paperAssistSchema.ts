import { defineTable } from "convex/server";
import { v } from "convex/values";
export const vAssistMode = v.union(
  v.literal("summary"),
  v.literal("translation"),
);
export const vAssistStatus = v.union(
  v.literal("draft"),
  v.literal("pending"),
  v.literal("confirmed"),
);
export const vAssistAttempt = v.union(
  v.literal("none"),
  v.literal("pending"),
  v.literal("succeeded"),
  v.literal("failed"),
);
export const paperAssistTables = {
  paperAssists: defineTable({
    orgId: v.id("orgs"),
    paperId: v.id("paperDrafts"),
    paperRevision: v.number(),
    sourceHash: v.string(),
    sourceText: v.string(),
    mode: vAssistMode,
    targetLocale: v.string(),
    createdBy: v.id("profiles"),
    createdAt: v.number(),
    updatedAt: v.number(),
    revision: v.number(),
    status: vAssistStatus,
    attemptStatus: vAssistAttempt,
    attemptId: v.optional(v.string()),
    startedAt: v.optional(v.number()),
    model: v.optional(v.string()),
    promptVersion: v.optional(v.string()),
    modelText: v.optional(v.string()),
    reviewedText: v.string(),
    confirmedBy: v.optional(v.id("profiles")),
    confirmedAt: v.optional(v.number()),
  }).index("by_org_paper", ["orgId", "paperId"]),
  paperAssistClaims: defineTable({
    orgId: v.id("orgs"),
    paperId: v.id("paperDrafts"),
    mode: vAssistMode,
    targetLocale: v.string(),
    createdAt: v.number(),
  }).index("by_tuple", ["orgId", "paperId", "mode", "targetLocale"]),
  paperAssistQuota: defineTable({
    day: v.string(),
    attempts: v.array(
      v.object({ profileId: v.id("profiles"), orgId: v.id("orgs") }),
    ),
  }).index("by_day", ["day"]),
};
