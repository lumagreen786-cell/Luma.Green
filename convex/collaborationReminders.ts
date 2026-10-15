import { v } from "convex/values";

import { internalMutation } from "./_generated/server";
import { queueInbox } from "./lib/push";

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
      task.dueAt <= Date.now()
    ) {
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
