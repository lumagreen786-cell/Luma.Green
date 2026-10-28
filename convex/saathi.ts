import { ConvexError, type Infer, v } from "convex/values";

import type { Doc, Id } from "./_generated/dataModel";
import {
  mutation,
  type MutationCtx,
  query,
  type QueryCtx,
} from "./_generated/server";
import { shiftDate } from "./lib/dates";
import { vSaathiTime, vSaathiWork } from "./lib/drafts";
import { indiaToday } from "./lib/onboarding";
import { vOrgKind } from "./lib/validators";
import { requireSaathi } from "./lib/workspace";

/**
 * The Saathi app: paid jobs that businesses post. A job goes open → assigned
 * (to one Saathi) → done, and its pay counts as earned once it's done. The
 * money itself changes hands off the platform for now.
 */

/** Most jobs one list reads — a prototype bound; keep running totals past it. */
const MAX_JOBS = 500;
/** Finished jobs shown on screen, newest first. */
export const RECENT_DONE = 20;

const WINDOW_ORDER: Record<Doc<"jobs">["window"], number> = {
  morning: 0,
  afternoon: 1,
  evening: 2,
};

export const vJobView = v.object({
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
  /** The business that posted it; null for a job the team posted. */
  postedBy: v.union(v.null(), v.object({ name: v.string(), kind: vOrgKind })),
  /** In the Saathi's own area — shown first. */
  inMyArea: v.boolean(),
});

export type JobView = Infer<typeof vJobView>;

export const vEarnings = v.object({
  totalPaise: v.number(),
  jobsDone: v.number(),
  /** The last 7 days, today included, by the job's date. */
  weekPaise: v.number(),
  weekJobs: v.number(),
});

// --- Pure rules -------------------------------------------------------------

/** Jobs in time order: by day, then morning → afternoon → evening. */
export function bySchedule(
  a: Pick<Doc<"jobs">, "date" | "window">,
  b: Pick<Doc<"jobs">, "date" | "window">,
): number {
  return (
    a.date.localeCompare(b.date) ||
    WINDOW_ORDER[a.window] - WINDOW_ORDER[b.window]
  );
}

export function isSameArea(a: string, b: string): boolean {
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}

/** What a Saathi has earned: every finished job, and the last 7 days. */
export function earningsOf(
  done: readonly Pick<Doc<"jobs">, "date" | "payPaise">[],
  today: string,
): Infer<typeof vEarnings> {
  const weekStart = shiftDate(today, -6);
  let totalPaise = 0;
  let weekPaise = 0;
  let weekJobs = 0;
  for (const job of done) {
    totalPaise += job.payPaise;
    if (job.date < weekStart || job.date > today) continue;
    weekPaise += job.payPaise;
    weekJobs += 1;
  }
  return { totalPaise, jobsDone: done.length, weekPaise, weekJobs };
}

// --- Reading ------------------------------------------------------------------

/** A Saathi's own jobs, assigned and done — newest first. */
export async function jobsOf(
  ctx: QueryCtx,
  saathiId: Id<"saathiProfiles">,
): Promise<Doc<"jobs">[]> {
  return ctx.db
    .query("jobs")
    .withIndex("by_saathi", (q) => q.eq("saathiProfileId", saathiId))
    .order("desc")
    .take(MAX_JOBS);
}

/** The businesses behind a set of jobs, each read once. */
async function postersOf(
  ctx: QueryCtx,
  jobs: readonly Doc<"jobs">[],
): Promise<Map<Id<"orgs">, Doc<"orgs">>> {
  const posters = new Map<Id<"orgs">, Doc<"orgs">>();
  for (const job of jobs) {
    if (!job.orgId || posters.has(job.orgId)) continue;
    const org = await ctx.db.get("orgs", job.orgId);
    if (org) posters.set(job.orgId, org);
  }
  return posters;
}

function toView(
  job: Doc<"jobs">,
  poster: Doc<"orgs"> | undefined,
  myArea: string,
): JobView {
  return {
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
    postedBy: poster ? { name: poster.name, kind: poster.kind } : null,
    inMyArea: isSameArea(job.area, myArea),
  };
}

export async function jobViews(
  ctx: QueryCtx,
  jobs: readonly Doc<"jobs">[],
  myArea: string,
): Promise<JobView[]> {
  const posters = await postersOf(ctx, jobs);
  return jobs.map((job) =>
    toView(job, job.orgId ? posters.get(job.orgId) : undefined, myArea),
  );
}

/** Whether an open job is one this Saathi may see and take. */
function isOnOffer(
  job: Doc<"jobs">,
  poster: Doc<"orgs"> | undefined,
  saathi: Doc<"saathiProfiles">,
  today: string,
): boolean {
  if (
    job.status !== "open" ||
    job.cancelledAt !== undefined ||
    job.date < today
  )
    return false;
  if (!job.orgId) return true; // posted by the team, city-wide
  return (
    poster?.status === "active" && (job.city ?? poster.city) === saathi.city
  );
}

/**
 * The Saathi's home: open jobs in their city (their own area first), the jobs
 * they've taken, the ones they've finished, and what they've earned.
 */
export const board = query({
  args: {},
  returns: v.object({
    /** Today in India, YYYY-MM-DD — so the screen splits days the same way. */
    today: v.string(),
    open: v.array(vJobView),
    mine: v.array(vJobView),
    done: v.array(vJobView),
    earnings: vEarnings,
  }),
  handler: async (ctx) => {
    const { saathi } = await requireSaathi(ctx);
    const today = indiaToday();

    const [cityJobs, teamJobs] = await Promise.all([
      ctx.db
        .query("jobs")
        .withIndex("by_city_status_cancelledAt_date", (q) =>
          q
            .eq("city", saathi.city)
            .eq("status", "open")
            .eq("cancelledAt", undefined)
            .gte("date", today),
        )
        .take(MAX_JOBS),
      ctx.db
        .query("jobs")
        .withIndex("by_org_status_cancelledAt_date", (q) =>
          q
            .eq("orgId", undefined)
            .eq("status", "open")
            .eq("cancelledAt", undefined)
            .gte("date", today),
        )
        .take(MAX_JOBS),
    ]);
    const openRows = [
      ...new Map(
        [...cityJobs, ...teamJobs].map((job) => [job._id, job]),
      ).values(),
    ];
    const posters = await postersOf(ctx, openRows);
    const open = openRows
      .flatMap((job) => {
        const poster = job.orgId ? posters.get(job.orgId) : undefined;
        return isOnOffer(job, poster, saathi, today)
          ? [toView(job, poster, saathi.area)]
          : [];
      })
      .toSorted(
        (a, b) => Number(b.inMyArea) - Number(a.inMyArea) || bySchedule(a, b),
      );

    const own = await jobsOf(ctx, saathi._id);
    const assigned = own
      .filter((job) => job.status === "assigned")
      .toSorted(bySchedule);
    const done = own
      .filter((job) => job.status === "done")
      .toSorted((a, b) => bySchedule(b, a));

    return {
      today,
      open,
      mine: await jobViews(ctx, assigned, saathi.area),
      done: await jobViews(ctx, done.slice(0, RECENT_DONE), saathi.area),
      earnings: earningsOf(done, today),
    };
  },
});

// --- Changing -------------------------------------------------------------------

async function audit(
  ctx: MutationCtx,
  job: Doc<"jobs">,
  actorProfileId: Id<"profiles">,
  action: "job.taken" | "job.done" | "job.payment_acknowledged",
) {
  await ctx.db.insert("auditLog", {
    orgId: job.orgId,
    actorProfileId,
    action,
    entityTable: "jobs",
    entityId: job._id,
    metadata: { date: job.date, window: job.window, payPaise: job.payPaise },
    createdAt: Date.now(),
  });
}

/** Takes an open job: it becomes this Saathi's, and no one else's. */
export const take = mutation({
  args: { jobId: v.id("jobs") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { profile, saathi } = await requireSaathi(ctx);
    const job = await ctx.db.get("jobs", args.jobId);
    if (!job) throw new ConvexError("JOB_NOT_FOUND");
    if (job.status !== "open") throw new ConvexError("JOB_TAKEN");

    const today = indiaToday();
    if (job.date < today) throw new ConvexError("JOB_EXPIRED");
    const poster = job.orgId ? await ctx.db.get("orgs", job.orgId) : null;
    if (!isOnOffer(job, poster ?? undefined, saathi, today)) {
      throw new ConvexError("JOB_NOT_FOUND");
    }

    // One job at a time: nobody can be at two places in the same slot.
    const conflict = await ctx.db
      .query("jobs")
      .withIndex("by_saathi", (q) => q.eq("saathiProfileId", saathi._id))
      .filter((q) =>
        q.and(
          q.eq(q.field("status"), "assigned"),
          q.eq(q.field("date"), job.date),
          q.eq(q.field("window"), job.window),
        ),
      )
      .first();
    if (conflict) throw new ConvexError("SLOT_BUSY");

    await ctx.db.patch("jobs", job._id, {
      status: "assigned",
      saathiProfileId: saathi._id,
    });
    await audit(ctx, job, profile._id, "job.taken");
    return null;
  },
});

/** Marks one of this Saathi's jobs done — on or after its day, never before. */
export const finish = mutation({
  args: { jobId: v.id("jobs") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { profile, saathi } = await requireSaathi(ctx);
    const job = await ctx.db.get("jobs", args.jobId);
    if (!job) throw new ConvexError("JOB_NOT_FOUND");
    if (job.saathiProfileId !== saathi._id) {
      throw new ConvexError("NOT_YOUR_JOB");
    }
    if (job.status === "done") throw new ConvexError("ALREADY_DONE");
    if (job.date > indiaToday()) throw new ConvexError("TOO_EARLY");

    await ctx.db.patch("jobs", job._id, { status: "done" });
    await audit(ctx, job, profile._id, "job.done");
    return null;
  },
});

export const acknowledgePayment = mutation({
  args: { jobId: v.id("jobs") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { profile, saathi } = await requireSaathi(ctx);
    const job = await ctx.db.get("jobs", args.jobId);
    if (job?.saathiProfileId !== saathi._id)
      throw new ConvexError("NOT_YOUR_JOB");
    if (job.status !== "done" || job.employerPaidAt === undefined)
      throw new ConvexError("PAYMENT_NOT_DECLARED");
    if (job.workerAcknowledgedAt !== undefined) return null;
    const now = Date.now();
    await ctx.db.patch("jobs", job._id, {
      workerAcknowledgedAt: now,
      updatedAt: now,
    });
    await audit(ctx, job, profile._id, "job.payment_acknowledged");
    return null;
  },
});
