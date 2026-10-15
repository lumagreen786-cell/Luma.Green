import { paginationOptsValidator } from "convex/server";
import { ConvexError, v } from "convex/values";

import { internal } from "./_generated/api";
import { mutation, query } from "./_generated/server";
import {
  canAccessRecord,
  dueDate,
  requireRecord,
  requireTask,
} from "./lib/collaboration";
import { vCollaborationRecord, vTaskState } from "./lib/collaborationSchema";
import { messageText, supportSubject } from "./lib/messaging";
import { requireScope, scopeRole, teamAudit } from "./lib/organizations";
import { vTeamScope } from "./lib/organizationsSchema";
import { queueInbox } from "./lib/push";

const taskView = v.object({
  id: v.id("recordTasks"),
  title: v.string(),
  state: vTaskState,
  assignedTo: v.optional(v.id("profiles")),
  dueAt: v.optional(v.number()),
  version: v.number(),
  updatedAt: v.number(),
});
export const tasks = query({
  args: { scope: vTeamScope, record: vCollaborationRecord },
  returns: v.array(taskView),
  handler: async (ctx, args) => {
    await requireRecord(ctx, args.scope, args.record);
    const tasks = await ctx.db
      .query("recordTasks")
      .withIndex("by_scope_record", (q) =>
        q.eq("scope", args.scope).eq("record", args.record),
      )
      .take(100);
    return tasks.map((task) => ({
      id: task._id,
      title: task.title,
      state: task.state,
      assignedTo: task.assignedTo,
      dueAt: task.dueAt,
      version: task.version,
      updatedAt: task.updatedAt,
    }));
  },
});

// eslint-disable-next-line unicorn/no-non-function-verb-prefix -- Convex registrations are callable mutations.
export const createTask = mutation({
  args: {
    scope: vTeamScope,
    record: vCollaborationRecord,
    title: v.string(),
    assignedTo: v.optional(v.id("profiles")),
    dueAt: v.optional(v.number()),
  },
  returns: v.id("recordTasks"),
  handler: async (ctx, args) => {
    const { profile } = await requireRecord(ctx, args.scope, args.record, true);
    // Assigned workers can discuss a job, but only workspace operators create tasks.
    await requireScope(ctx, args.scope, "operate");
    if (
      args.assignedTo &&
      !(await canAccessRecord(
        ctx,
        args.scope,
        args.record,
        args.assignedTo,
        true,
      ))
    )
      throw new ConvexError("INVALID_ASSIGNEE");
    const tasks = await ctx.db
      .query("recordTasks")
      .withIndex("by_scope_record", (q) =>
        q.eq("scope", args.scope).eq("record", args.record),
      )
      .take(100);
    if (tasks.length >= 100) throw new ConvexError("TASK_LIMIT");
    const now = Date.now();
    const id = await ctx.db.insert("recordTasks", {
      ...args,
      title: supportSubject(args.title),
      dueAt: dueDate(args.dueAt),
      state: "open",
      version: 1,
      createdBy: profile._id,
      createdAt: now,
      updatedAt: now,
    });
    await teamAudit(
      ctx,
      profile._id,
      args.scope,
      "collaboration.task_created",
      "recordTasks",
      id,
    );
    if (args.assignedTo && args.assignedTo !== profile._id)
      await queueInbox(ctx, {
        profileId: args.assignedTo,
        event: "collaboration_updated",
        taskId: id,
        dedupKey: `task_update:${id}:1`,
      });
    if (args.assignedTo && args.dueAt !== undefined)
      await ctx.scheduler.runAt(
        Math.max(now, args.dueAt),
        internal.collaborationReminders.due,
        { taskId: id, version: 1 },
      );
    return id;
  },
});

/** Updating a task never updates the underlying operational record. */
export const updateTask = mutation({
  args: {
    taskId: v.id("recordTasks"),
    expectedVersion: v.number(),
    title: v.string(),
    state: vTaskState,
    assignedTo: v.optional(v.id("profiles")),
    dueAt: v.optional(v.number()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { profile, task } = await requireTask(ctx, args.taskId, true);
    await requireScope(ctx, task.scope, "operate");
    if (task.version !== args.expectedVersion)
      throw new ConvexError("STALE_VERSION");
    if (
      args.assignedTo &&
      !(await canAccessRecord(
        ctx,
        task.scope,
        task.record,
        args.assignedTo,
        true,
      ))
    )
      throw new ConvexError("INVALID_ASSIGNEE");
    await ctx.db.patch("recordTasks", task._id, {
      title: supportSubject(args.title),
      state: args.state,
      assignedTo: args.assignedTo,
      dueAt: dueDate(args.dueAt),
      version: task.version + 1,
      updatedAt: Date.now(),
    });
    await teamAudit(
      ctx,
      profile._id,
      task.scope,
      "collaboration.task_updated",
      "recordTasks",
      task._id,
      {
        previousState: task.state,
        state: args.state,
        previousAssignee: task.assignedTo ?? "none",
        assignedTo: args.assignedTo ?? "none",
        previousDueAt: task.dueAt ?? "none",
        dueAt: args.dueAt ?? "none",
        version: task.version + 1,
      },
    );
    if (args.assignedTo && args.assignedTo !== profile._id)
      await queueInbox(ctx, {
        profileId: args.assignedTo,
        event: "collaboration_updated",
        taskId: task._id,
        dedupKey: `task_update:${task._id}:${String(task.version + 1)}`,
      });
    if (args.state !== "done" && args.assignedTo && args.dueAt !== undefined)
      await ctx.scheduler.runAt(
        Math.max(Date.now(), args.dueAt),
        internal.collaborationReminders.due,
        { taskId: task._id, version: task.version + 1 },
      );
    return null;
  },
});

export const comment = mutation({
  args: {
    taskId: v.id("recordTasks"),
    body: v.string(),
    mentions: v.array(v.id("profiles")),
  },
  returns: v.id("recordComments"),
  handler: async (ctx, args) => {
    const { profile, task } = await requireTask(ctx, args.taskId, true);
    const mentions = [...new Set(args.mentions)];
    if (mentions.length > 10) throw new ConvexError("MENTION_LIMIT");
    for (const mentioned of mentions) {
      if (!(await canAccessRecord(ctx, task.scope, task.record, mentioned)))
        throw new ConvexError("INVALID_MENTION");
    }
    const now = Date.now();
    const recent = await ctx.db
      .query("recordComments")
      .withIndex("by_author_created", (q) =>
        q.eq("authorId", profile._id).gt("createdAt", now - 60_000),
      )
      .take(12);
    if (recent.length >= 12) throw new ConvexError("COMMENT_RATE_LIMITED");
    const id = await ctx.db.insert("recordComments", {
      taskId: task._id,
      authorId: profile._id,
      body: messageText(args.body),
      mentions,
      version: 1,
      deleted: false,
      createdAt: now,
      updatedAt: now,
    });
    await teamAudit(
      ctx,
      profile._id,
      task.scope,
      "collaboration.comment_created",
      "recordComments",
      id,
    );
    const recipients = new Set([
      ...mentions,
      task.createdBy,
      ...(task.assignedTo ? [task.assignedTo] : []),
    ]);
    for (const recipient of recipients) {
      if (recipient !== profile._id)
        await queueInbox(ctx, {
          profileId: recipient,
          event: "collaboration_updated",
          taskId: task._id,
          dedupKey: `task_comment:${id}:${recipient}`,
        });
    }
    return id;
  },
});

export const editComment = mutation({
  args: {
    commentId: v.id("recordComments"),
    expectedVersion: v.number(),
    body: v.union(v.string(), v.null()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const comment = await ctx.db.get("recordComments", args.commentId);
    if (!comment) throw new ConvexError("RECORD_ACCESS_DENIED");
    const { profile, task } = await requireTask(ctx, comment.taskId, true);
    const role = await scopeRole(ctx, task.scope, profile._id);
    const isMayModerate =
      args.body === null && (role === "owner" || role === "admin");
    if (!isMayModerate && comment.authorId !== profile._id)
      throw new ConvexError("RECORD_ACCESS_DENIED");
    if (comment.version !== args.expectedVersion || comment.deleted)
      throw new ConvexError("STALE_VERSION");
    // Keep prior text in a separate, non-public revision table; audit never copies it.
    await ctx.db.insert("recordCommentRevisions", {
      commentId: comment._id,
      body: comment.body,
      mentions: comment.mentions,
      version: comment.version,
      changedBy: profile._id,
      createdAt: Date.now(),
    });
    await ctx.db.patch("recordComments", comment._id, {
      body: args.body === null ? "" : messageText(args.body),
      mentions: args.body === null ? [] : comment.mentions,
      deleted: args.body === null,
      version: comment.version + 1,
      updatedAt: Date.now(),
    });
    await teamAudit(
      ctx,
      profile._id,
      task.scope,
      args.body === null
        ? "collaboration.comment_deleted"
        : "collaboration.comment_edited",
      "recordComments",
      comment._id,
    );
    return null;
  },
});

const commentView = v.object({
  id: v.id("recordComments"),
  authorId: v.id("profiles"),
  body: v.string(),
  mentions: v.array(v.id("profiles")),
  deleted: v.boolean(),
  version: v.number(),
  createdAt: v.number(),
  updatedAt: v.number(),
});
export const comments = query({
  args: {
    taskId: v.id("recordTasks"),
    paginationOpts: paginationOptsValidator,
  },
  returns: v.object({
    page: v.array(commentView),
    continueCursor: v.string(),
    isDone: v.boolean(),
  }),
  handler: async (ctx, args) => {
    await requireTask(ctx, args.taskId);
    const rows = await ctx.db
      .query("recordComments")
      .withIndex("by_task_created", (q) => q.eq("taskId", args.taskId))
      .order("desc")
      .paginate({
        ...args.paginationOpts,
        numItems: Math.max(1, Math.min(50, args.paginationOpts.numItems)),
      });
    return {
      continueCursor: rows.continueCursor,
      isDone: rows.isDone,
      page: rows.page.map((row) => ({
        id: row._id,
        authorId: row.authorId,
        body: row.body,
        mentions: row.mentions,
        deleted: row.deleted,
        version: row.version,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
      })),
    };
  },
});

export const activity = query({
  args: { taskId: v.id("recordTasks") },
  returns: v.array(
    v.object({
      action: v.string(),
      actorProfileId: v.optional(v.id("profiles")),
      createdAt: v.number(),
    }),
  ),
  handler: async (ctx, { taskId }) => {
    await requireTask(ctx, taskId);
    const rows = await ctx.db
      .query("auditLog")
      .withIndex("by_entity", (q) =>
        q.eq("entityTable", "recordTasks").eq("entityId", taskId),
      )
      .order("desc")
      .take(50);
    return rows.map((row) => ({
      action: row.action,
      actorProfileId: row.actorProfileId,
      createdAt: row.createdAt,
    }));
  },
});
