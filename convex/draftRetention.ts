import { v } from "convex/values";

import { internal } from "./_generated/api";
import { internalMutation } from "./_generated/server";

export const expire = internalMutation({
  args: { cursor: v.optional(v.union(v.string(), v.null())) },
  returns: v.number(),
  handler: async (ctx, args) => {
    const now = Date.now(),
      cutoff = now - 30 * 24 * 60 * 60 * 1000;
    const page = await ctx.db
      .query("applications")
      .withIndex("by_status_updatedAt", (q) =>
        q.eq("status", "draft").lt("updatedAt", cutoff),
      )
      .paginate({ cursor: args.cursor ?? null, numItems: 100 });
    let removed = 0;
    for (const row of page.page) {
      if (row.version !== 0 || row.submittedAt !== undefined) continue;
      const linked = await ctx.db
        .query("supportRequests")
        .withIndex("by_source", (q) =>
          q.eq("source", { kind: "application", id: row._id }),
        )
        .take(100);
      if (linked.length === 100 || linked.some((r) => r.status === "open"))
        continue;
      const files = await ctx.db
        .query("applicationFiles")
        .withIndex("by_application", (q) => q.eq("applicationId", row._id))
        .take(100);
      if (files.length === 100) continue;
      for (const file of files) {
        await ctx.storage.delete(file.storageId);
        await ctx.db.delete("applicationFiles", file._id);
      }
      await ctx.db.delete("applications", row._id);
      await ctx.db.insert("auditLog", {
        action: "application.draft_expired",
        entityTable: "applications",
        entityId: row._id,
        createdAt: now,
      });
      removed++;
    }
    if (!page.isDone)
      await ctx.scheduler.runAfter(0, internal.draftRetention.expire, {
        cursor: page.continueCursor,
      });
    return removed;
  },
});
