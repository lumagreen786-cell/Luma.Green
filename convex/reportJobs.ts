import { ConvexError, v } from "convex/values";

import { triggerJobsConfig } from "../src/lib/env";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import {
  action,
  internalMutation,
  internalQuery,
  mutation,
  type MutationCtx,
  query,
} from "./_generated/server";
import { hashToken } from "./lib/integrations";
import {
  MAX_REPORT_BYTES,
  MAX_REPORT_ROWS,
  REPORT_TTL,
  stockCsv,
  vReportStatus,
  vStockRow,
} from "./lib/reportJobs";
import { membershipFor, requireOrg } from "./lib/workspace";

async function audit(ctx: MutationCtx, job: Doc<"reportJobs">, event: string) {
  await ctx.db.insert("auditLog", {
    orgId: job.orgId,
    actorProfileId: job.ownerProfileId,
    action: `report.${event}`,
    entityTable: "reportJobs",
    entityId: job._id,
    createdAt: Date.now(),
  });
}
async function workerJob(
  ctx: MutationCtx,
  jobId: Doc<"reportJobs">["_id"],
  capability: string,
) {
  if (!/^[\da-f]{64}$/.test(capability))
    throw new ConvexError("INVALID_JOB_CAPABILITY");
  const job = await ctx.db.get("reportJobs", jobId);
  if ((await hashToken(capability)) !== job?.capabilityHash)
    throw new ConvexError("INVALID_JOB_CAPABILITY");
  if (job.expiresAt <= Date.now() || job.status === "expired")
    throw new ConvexError("JOB_EXPIRED");
  const org = await ctx.db.get("orgs", job.orgId);
  if (
    org?.status !== "active" ||
    !(await membershipFor(ctx, job.ownerProfileId, job.orgId))
  )
    throw new ConvexError("JOB_ACCESS_REVOKED");
  if (job.status === "failed") throw new ConvexError("JOB_FAILED");
  return job;
}
export const request = action({
  args: { operationKey: v.string() },
  returns: v.id("reportJobs"),
  handler: async (ctx, args): Promise<Id<"reportJobs">> => {
    const bytes = crypto.getRandomValues(new Uint8Array(32));
    const capability = Array.from(bytes, (b) =>
      b.toString(16).padStart(2, "0"),
    ).join("");
    return ctx.runMutation(internal.reportJobs.reserve, {
      ...args,
      capability,
      capabilityHash: await hashToken(capability),
    });
  },
});
export const reserve = internalMutation({
  args: {
    operationKey: v.string(),
    capability: v.string(),
    capabilityHash: v.string(),
  },
  returns: v.id("reportJobs"),
  handler: async (ctx, args) => {
    const { org, profile } = await requireOrg(ctx, undefined, "read");
    if (!/^[\w-]{8,80}$/.test(args.operationKey))
      throw new ConvexError("INVALID_OPERATION_KEY");
    const existing = await ctx.db
      .query("reportJobs")
      .withIndex("by_owner_org_key", (q) =>
        q
          .eq("ownerProfileId", profile._id)
          .eq("orgId", org._id)
          .eq("operationKey", args.operationKey),
      )
      .unique();
    if (existing) return existing._id;
    if (!triggerJobsConfig()) throw new ConvexError("JOBS_UNAVAILABLE");
    for (const status of ["queued", "running"] as const) {
      const pending = await ctx.db
        .query("reportJobs")
        .withIndex("by_org_status_expiry", (q) =>
          q
            .eq("orgId", org._id)
            .eq("status", status)
            .gt("expiresAt", Date.now()),
        )
        .take(1);
      if (pending.some((job) => job.expiresAt > Date.now()))
        throw new ConvexError("JOB_ALREADY_PENDING");
    }
    const recent = await ctx.db
      .query("reportJobs")
      .withIndex("by_owner_org_created", (q) =>
        q
          .eq("ownerProfileId", profile._id)
          .eq("orgId", org._id)
          .gte("createdAt", Date.now() - 24 * 60 * 60_000),
      )
      .take(10);
    if (recent.length >= 10) throw new ConvexError("JOB_DAILY_LIMIT");
    const inventory = await ctx.db
      .query("inventory")
      .withIndex("by_org", (q) => q.eq("orgId", org._id))
      .take(MAX_REPORT_ROWS + 1);
    const snapshot = inventory.map(({ materialCode, grams }) => ({
      materialCode,
      grams,
    }));
    stockCsv(snapshot);
    const now = Date.now();
    const jobId = await ctx.db.insert("reportJobs", {
      orgId: org._id,
      ownerProfileId: profile._id,
      operationKey: args.operationKey,
      capabilityHash: args.capabilityHash,
      status: "queued",
      snapshot,
      createdAt: now,
      expiresAt: now + REPORT_TTL,
    });
    const job = await ctx.db.get("reportJobs", jobId);
    if (!job) throw new ConvexError("JOB_NOT_FOUND");
    await audit(ctx, job, "queued");
    await ctx.scheduler.runAfter(0, internal.reportJobDispatch.dispatch, {
      jobId,
      capability: args.capability,
    });
    await ctx.scheduler.runAfter(REPORT_TTL, internal.reportJobs.expire, {
      jobId,
    });
    return jobId;
  },
});
export const get = query({
  args: { jobId: v.id("reportJobs") },
  returns: v.object({
    id: v.id("reportJobs"),
    status: vReportStatus,
    progress: v.number(),
    createdAt: v.number(),
    expiresAt: v.number(),
    result: v.union(v.string(), v.null()),
    errorCode: v.union(v.string(), v.null()),
  }),
  handler: async (ctx, { jobId }) => {
    const { org } = await requireOrg(ctx, undefined, "read");
    const job = await ctx.db.get("reportJobs", jobId);
    if (job?.orgId !== org._id) throw new ConvexError("JOB_NOT_FOUND");
    const status = job.expiresAt <= Date.now() ? "expired" : job.status;
    let progress = 0;
    if (status === "complete") progress = 100;
    else if (status === "running") progress = 50;
    return {
      id: job._id,
      status,
      progress,
      createdAt: job.createdAt,
      expiresAt: job.expiresAt,
      result: status === "complete" ? (job.result ?? null) : null,
      errorCode: job.errorCode ?? null,
    };
  },
});
export const start = mutation({
  args: { jobId: v.id("reportJobs"), capability: v.string() },
  returns: v.array(vStockRow),
  handler: async (ctx, args) => {
    const job = await workerJob(ctx, args.jobId, args.capability);
    if (job.status === "queued") {
      await ctx.db.patch("reportJobs", job._id, { status: "running" });
      await audit(ctx, job, "running");
    }
    return job.snapshot;
  },
});
export const complete = mutation({
  args: {
    jobId: v.id("reportJobs"),
    capability: v.string(),
    result: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const job = await workerJob(ctx, args.jobId, args.capability);
    if (
      new TextEncoder().encode(args.result).byteLength > MAX_REPORT_BYTES ||
      args.result !== stockCsv(job.snapshot)
    )
      throw new ConvexError("INVALID_JOB_RESULT");
    if (job.status === "complete") return null;
    if (job.status !== "running") throw new ConvexError("INVALID_JOB_STATE");
    await ctx.db.patch("reportJobs", job._id, {
      status: "complete",
      result: args.result,
    });
    await audit(ctx, job, "complete");
    return null;
  },
});
export const dispatchAllowed = internalQuery({
  args: { jobId: v.id("reportJobs"), capability: v.string() },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const job = await ctx.db.get("reportJobs", args.jobId);
    if (
      job?.status !== "queued" ||
      job.expiresAt <= Date.now() ||
      (await hashToken(args.capability)) !== job.capabilityHash
    )
      return false;
    const org = await ctx.db.get("orgs", job.orgId);
    return (
      org?.status === "active" &&
      Boolean(await membershipFor(ctx, job.ownerProfileId, job.orgId))
    );
  },
});
export const rejectDispatch = internalMutation({
  args: { jobId: v.id("reportJobs") },
  returns: v.null(),
  handler: async (ctx, { jobId }) => {
    const job = await ctx.db.get("reportJobs", jobId);
    if (job?.status === "queued") {
      await ctx.db.patch("reportJobs", jobId, {
        status: "failed",
        snapshot: [],
        errorCode: "JOB_DISPATCH_REJECTED",
      });
      await audit(ctx, job, "failed");
    }
    return null;
  },
});
export const expire = internalMutation({
  args: { jobId: v.id("reportJobs") },
  returns: v.null(),
  handler: async (ctx, { jobId }) => {
    const job = await ctx.db.get("reportJobs", jobId);
    if (job && job.expiresAt <= Date.now() && job.status !== "expired") {
      await ctx.db.patch("reportJobs", jobId, {
        status: "expired",
        snapshot: [],
        result: undefined,
        capabilityHash: "",
      });
      await audit(ctx, job, "expired");
    }
    return null;
  },
});
