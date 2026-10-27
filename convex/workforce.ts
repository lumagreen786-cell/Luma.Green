import { ConvexError, v } from "convex/values";
import { z } from "zod";

import { internalMutation, mutation, query } from "./_generated/server";
import { shiftDate } from "./lib/dates";
import { vSaathiTime, vSaathiWork } from "./lib/drafts";
import {
  ECOSYSTEM_PAGE,
  scheduleBounds,
  workforceSchema,
} from "./lib/ecosystem";
import { requireOrg } from "./lib/workspace";

const vJob = v.object({
  id: v.id("jobs"),
  kind: vSaathiWork,
  title: v.string(),
  area: v.string(),
  date: v.string(),
  window: vSaathiTime,
  payPaise: v.number(),
  paymentDueDate: v.optional(v.string()),
  employerPaidAt: v.optional(v.number()),
  workerAcknowledgedAt: v.optional(v.number()),
  status: v.union(v.literal("open"), v.literal("assigned"), v.literal("done")),
  cancelledAt: v.optional(v.number()),
});

export const board = query({
  args: {},
  returns: v.object({
    today: v.string(),
    maxDate: v.string(),
    jobs: v.array(vJob),
    truncated: v.boolean(),
    summary: v.object({
      open: v.number(),
      assigned: v.number(),
      done: v.number(),
    }),
  }),
  handler: async (ctx) => {
    const { org } = await requireOrg(ctx, undefined, "read");
    const rows = await ctx.db
      .query("jobs")
      .withIndex("by_org", (q) => q.eq("orgId", org._id))
      .order("desc")
      .take(ECOSYSTEM_PAGE + 1);
    const jobs = rows.slice(0, ECOSYSTEM_PAGE).map((job) => ({
      id: job._id,
      kind: job.kind,
      title: job.title,
      area: job.area,
      date: job.date,
      window: job.window,
      payPaise: job.payPaise,
      paymentDueDate: job.paymentDueDate,
      employerPaidAt: job.employerPaidAt,
      workerAcknowledgedAt: job.workerAcknowledgedAt,
      status: job.status,
      cancelledAt: job.cancelledAt,
    }));
    const { today, maxDate } = scheduleBounds();
    return {
      today,
      maxDate,
      jobs,
      truncated: rows.length > ECOSYSTEM_PAGE,
      summary: {
        open: jobs.filter(
          (job) =>
            job.status === "open" &&
            job.cancelledAt === undefined &&
            job.date >= today,
        ).length,
        assigned: jobs.filter((job) => job.status === "assigned").length,
        done: jobs.filter((job) => job.status === "done").length,
      },
    };
  },
});

export const post = mutation({
  args: {
    kind: vSaathiWork,
    title: v.string(),
    area: v.string(),
    date: v.string(),
    window: vSaathiTime,
    payPaise: v.number(),
  },
  returns: v.id("jobs"),
  handler: async (ctx, args) => {
    const { org, profile } = await requireOrg(ctx);
    const parsed = workforceSchema.safeParse(args);
    if (!parsed.success) throw new ConvexError("INVALID_JOB");
    const recent = await ctx.db
      .query("jobs")
      .withIndex("by_org", (q) => q.eq("orgId", org._id))
      .order("desc")
      .take(1);
    const now = Date.now();
    if (recent[0] && now - recent[0].createdAt < 10_000)
      throw new ConvexError("TRY_LATER");
    const id = await ctx.db.insert("jobs", {
      ...parsed.data,
      paymentDueDate: shiftDate(parsed.data.date, 7),
      orgId: org._id,
      city: org.city,
      createdBy: profile._id,
      status: "open",
      createdAt: now,
      updatedAt: now,
    });
    await ctx.db.insert("auditLog", {
      orgId: org._id,
      actorProfileId: profile._id,
      action: "job.posted",
      entityTable: "jobs",
      entityId: id,
      createdAt: now,
    });
    return id;
  },
});

export const cancel = mutation({
  args: { jobId: v.id("jobs") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { org, profile } = await requireOrg(ctx);
    const job = await ctx.db.get("jobs", args.jobId);
    if (job?.orgId !== org._id) throw new ConvexError("JOB_NOT_FOUND");
    if (job.status !== "open" || job.saathiProfileId)
      throw new ConvexError("JOB_ALREADY_ASSIGNED");
    if (job.cancelledAt !== undefined) return null;
    const now = Date.now();
    await ctx.db.patch("jobs", job._id, { cancelledAt: now, updatedAt: now });
    await ctx.db.insert("auditLog", {
      orgId: org._id,
      actorProfileId: profile._id,
      action: "job.cancelled",
      entityTable: "jobs",
      entityId: job._id,
      createdAt: now,
    });
    return null;
  },
});

/** Deploy the optional city field first, then run every page before serving legacy jobs. */
export const backfillJobCities = internalMutation({
  args: { cursor: v.union(v.string(), v.null()) },
  returns: v.object({
    cursor: v.string(),
    isDone: v.boolean(),
    updated: v.number(),
    unresolved: v.number(),
  }),
  handler: async (ctx, args) => {
    const result = await ctx.db
      .query("jobs")
      .withIndex("by_creation_time")
      .paginate({ cursor: args.cursor, numItems: 100, maximumRowsRead: 100 });
    let updated = 0;
    let unresolved = 0;
    for (const job of result.page) {
      if (job.city !== undefined || !job.orgId) continue;
      const org = await ctx.db.get("orgs", job.orgId);
      if (!org) {
        unresolved += 1;
        continue;
      }
      const now = Date.now();
      await ctx.db.patch("jobs", job._id, { city: org.city, updatedAt: now });
      await ctx.db.insert("auditLog", {
        orgId: org._id,
        action: "job.cityBackfilled",
        entityTable: "jobs",
        entityId: job._id,
        createdAt: now,
      });
      updated += 1;
    }
    return {
      cursor: result.continueCursor,
      isDone: result.isDone,
      updated,
      unresolved,
    };
  },
});

export const declarePayment = mutation({
  args: { jobId: v.id("jobs"), dueDate: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { org, profile } = await requireOrg(ctx);
    const job = await ctx.db.get("jobs", args.jobId);
    if (job?.orgId !== org._id) throw new ConvexError("JOB_NOT_FOUND");
    if (job.status !== "done") throw new ConvexError("WRONG_STATUS");
    if (
      !z.iso.date().safeParse(args.dueDate).success ||
      args.dueDate < job.date
    )
      throw new ConvexError("INVALID_DATE");
    if (job.employerPaidAt !== undefined) return null;
    const now = Date.now();
    await ctx.db.patch("jobs", job._id, {
      paymentDueDate: args.dueDate,
      employerPaidAt: now,
      updatedAt: now,
    });
    await ctx.db.insert("auditLog", {
      orgId: org._id,
      actorProfileId: profile._id,
      action: "job.payment_declared",
      entityTable: "jobs",
      entityId: job._id,
      createdAt: now,
    });
    return null;
  },
});
