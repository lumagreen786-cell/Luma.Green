import { v } from "convex/values";

import { internal } from "./_generated/api";
import { internalMutation } from "./_generated/server";
import { canAccessRecord } from "./lib/collaboration";
import { queueInbox } from "./lib/push";
import { nextReminderTime } from "./lib/reminderHours";

/** A stale timer cannot notify a former assignee or resurrect a finished task. */
export const due = internalMutation({
  args: { taskId: v.id("recordTasks"), version: v.number() },
  returns: v.null(),
  handler: async (ctx, { taskId, version }) => {
    const task = await ctx.db.get("recordTasks", taskId);
    if (
      task?.version === version &&
      task.state !== "done" &&
      task.assignedTo &&
      task.dueAt !== undefined &&
      task.dueAt <= Date.now() &&
      (await canAccessRecord(
        ctx,
        task.scope,
        task.record,
        task.assignedTo,
        false,
      ))
    ) {
      const nextAt = nextReminderTime(Date.now());
      if (nextAt > Date.now()) {
        await ctx.scheduler.runAt(nextAt, internal.collaborationReminders.due, {
          taskId,
          version,
        });
      } else
        await queueInbox(ctx, {
          profileId: task.assignedTo,
          event: "collaboration_updated",
          taskId,
          dedupKey: `task_due:${taskId}:${String(version)}`,
        });
    }
    return null;
  },
});
