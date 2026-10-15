import { defineTable } from "convex/server";
import { v } from "convex/values";

import { vTeamScope } from "./organizationsSchema";

export const vCollaborationRecord = v.union(
  v.object({ kind: v.literal("booking"), id: v.id("bookings") }),
  v.object({ kind: v.literal("trade"), id: v.id("trades") }),
  v.object({ kind: v.literal("inspection"), id: v.id("lotInspections") }),
  v.object({ kind: v.literal("job"), id: v.id("jobs") }),
  v.object({ kind: v.literal("internal"), id: v.id("organizations") }),
);
export const vTaskState = v.union(
  v.literal("open"),
  v.literal("in_progress"),
  v.literal("done"),
);
export const collaborationTables = {
  recordTasks: defineTable({
    scope: vTeamScope,
    record: vCollaborationRecord,
    title: v.string(),
    assignedTo: v.optional(v.id("profiles")),
    dueAt: v.optional(v.number()),
    state: vTaskState,
    version: v.number(),
    createdBy: v.id("profiles"),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_scope_record", ["scope", "record"])
    .index("by_scope_updated", ["scope", "updatedAt"]),
  recordComments: defineTable({
    taskId: v.id("recordTasks"),
    authorId: v.id("profiles"),
    body: v.string(),
    mentions: v.array(v.id("profiles")),
    version: v.number(),
    deleted: v.boolean(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_task_created", ["taskId", "createdAt"])
    .index("by_author_created", ["authorId", "createdAt"]),
  recordCommentRevisions: defineTable({
    commentId: v.id("recordComments"),
    body: v.string(),
    mentions: v.array(v.id("profiles")),
    version: v.number(),
    changedBy: v.id("profiles"),
    createdAt: v.number(),
  }).index("by_comment", ["commentId"]),
};
