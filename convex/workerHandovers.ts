import { ConvexError, v } from "convex/values";

import type { Doc, Id } from "./_generated/dataModel";
import {
  mutation,
  type MutationCtx,
  query,
  type QueryCtx,
} from "./_generated/server";
import { requireUser } from "./lib/access";
import { findProfile } from "./lib/applicationAccess";
import { indiaToday } from "./lib/onboarding";
import { requireOrg } from "./lib/workspace";
import { hasWorkspacePermission, workspaceRole } from "./lib/workspaceRoles";

const vRow = v.object({
  id: v.id("workerHandovers"),
  jobId: v.id("jobs"),
  bookingId: v.id("bookings"),
  jobTitle: v.string(),
  jobDate: v.string(),
  bookingReference: v.string(),
  employerName: v.string(),
  collectedGrams: v.union(v.number(), v.null()),
  receivedGrams: v.union(v.number(), v.null()),
  varianceGrams: v.union(v.number(), v.null()),
  evidenceReference: v.union(v.string(), v.null()),
  varianceReason: v.union(v.string(), v.null()),
  boundByProfileId: v.id("profiles"),
  workerProfileId: v.id("profiles"),
  collectedByProfileId: v.union(v.id("profiles"), v.null()),
  acknowledgedByProfileId: v.union(v.id("profiles"), v.null()),
  collectedAt: v.union(v.number(), v.null()),
  acknowledgedAt: v.union(v.number(), v.null()),
  revoked: v.boolean(),
  canCollect: v.boolean(),
  canAcknowledge: v.boolean(),
  canRevoke: v.boolean(),
});
const choice = v.object({ id: v.id("jobs"), label: v.string() });
function key(value: string) {
  if (!/^[\w-]{8,80}$/.test(value))
    throw new ConvexError("INVALID_HANDOVER_REFERENCE");
  return value;
}
function text(value: string, min: number, max: number) {
  const clean = value.trim();
  if (clean.length < min || clean.length > max || /\p{Cc}/u.test(clean))
    throw new ConvexError("INVALID_HANDOVER_REFERENCE");
  return clean;
}
async function worker(ctx: QueryCtx, canReadSuspended = false) {
  const user = await requireUser(ctx),
    profile = await findProfile(ctx, user._id);
  if (!profile) throw new ConvexError("NO_PROFILE");
  const saathi = await ctx.db
    .query("saathiProfiles")
    .withIndex("by_profile", (q) => q.eq("profileId", profile._id))
    .unique();
  if (!saathi || (!canReadSuspended && saathi.status !== "active"))
    throw new ConvexError("NOT_A_SAATHI");
  return { profile, saathi };
}
async function source(ctx: QueryCtx, row: Doc<"workerHandovers">) {
  const [org, job, booking, saathi] = await Promise.all([
    ctx.db.get("orgs", row.orgId),
    ctx.db.get("jobs", row.jobId),
    ctx.db.get("bookings", row.bookingId),
    ctx.db.get("saathiProfiles", row.saathiProfileId),
  ]);
  if (
    !org ||
    !job ||
    !booking ||
    !saathi ||
    job.orgId !== row.orgId ||
    booking.orgId !== row.orgId ||
    booking.mode !== "pickup" ||
    job.kind !== "home_pickups"
  )
    return null;
  return {
    org,
    job,
    booking,
    saathi,
    assignmentMatches:
      job.saathiProfileId === row.saathiProfileId &&
      saathi.profileId === row.workerProfileId,
  };
}
function isCurrentAssignment(
  value: NonNullable<Awaited<ReturnType<typeof source>>>,
) {
  return (
    value.assignmentMatches &&
    value.job.cancelledAt === undefined &&
    (value.job.status === "assigned" || value.job.status === "done") &&
    value.job.date === value.booking.slotDate &&
    value.job.window === value.booking.slotWindow
  );
}
function isWritable(
  value: NonNullable<Awaited<ReturnType<typeof source>>>,
  row: Doc<"workerHandovers">,
) {
  return (
    row.revokedAt === undefined &&
    isCurrentAssignment(value) &&
    value.org.status === "active" &&
    value.saathi.status === "active" &&
    ["accepted", "on_the_way", "completed"].includes(value.booking.status)
  );
}
function receiptWeights(booking: Doc<"bookings">) {
  if (booking.status !== "completed" || !booking.receipt) return null;
  const receivedLines = booking.receipt.lines.map((line) => ({
    materialCode: line.materialCode,
    grams: line.grams,
  }));
  let receivedGrams = 0;
  for (const line of receivedLines) {
    if (!Number.isSafeInteger(line.grams) || line.grams <= 0) return null;
    receivedGrams += line.grams;
    if (!Number.isSafeInteger(receivedGrams)) return null;
  }
  return receivedGrams > 0 ? { receivedLines, receivedGrams } : null;
}
async function view(
  ctx: QueryCtx,
  row: Doc<"workerHandovers">,
  actor: "employer" | "worker",
  canOperate: boolean,
) {
  const value = await source(ctx, row);
  if (
    !value ||
    (actor === "worker" &&
      (!isCurrentAssignment(value) || row.revokedAt !== undefined))
  )
    return null;
  const canWrite = canOperate && isWritable(value, row);
  const receipt = receiptWeights(value.booking);
  const receivedGrams = row.receivedGrams ?? receipt?.receivedGrams ?? null;
  const varianceGrams =
    row.varianceGrams ??
    (receivedGrams !== null && row.collectedGrams !== undefined
      ? receivedGrams - row.collectedGrams
      : null);
  return {
    id: row._id,
    jobId: row.jobId,
    bookingId: row.bookingId,
    jobTitle: value.job.title,
    jobDate: value.job.date,
    bookingReference: `${value.booking.slotDate} · ${value.booking.slotWindow} · ${value.booking.token.slice(-4)}`,
    employerName: value.org.name,
    collectedGrams: row.collectedGrams ?? null,
    receivedGrams,
    varianceGrams,
    evidenceReference: row.evidenceReference ?? null,
    varianceReason: row.varianceReason ?? null,
    boundByProfileId: row.boundByProfileId,
    workerProfileId: row.workerProfileId,
    collectedByProfileId: row.collectedByProfileId ?? null,
    acknowledgedByProfileId: row.acknowledgedByProfileId ?? null,
    collectedAt: row.collectedAt ?? null,
    acknowledgedAt: row.acknowledgedAt ?? null,
    revoked: row.revokedAt !== undefined,
    canCollect:
      actor === "worker" && canWrite && row.collectedGrams === undefined,
    canAcknowledge:
      actor === "employer" &&
      canWrite &&
      row.collectedGrams !== undefined &&
      row.acknowledgedAt === undefined &&
      Boolean(receipt),
    canRevoke:
      actor === "employer" &&
      canOperate &&
      value.org.status === "active" &&
      row.revokedAt === undefined &&
      row.acknowledgedAt === undefined,
  };
}
async function audit(
  ctx: MutationCtx,
  row: Doc<"workerHandovers">,
  actor: Id<"profiles">,
  action: string,
  metadata: Record<string, unknown> = {},
) {
  await ctx.db.insert("auditLog", {
    orgId: row.orgId,
    actorProfileId: actor,
    action: `worker_handover.${action}`,
    entityTable: "workerHandovers",
    entityId: row._id,
    metadata: { jobId: row.jobId, bookingId: row.bookingId, ...metadata },
    createdAt: Date.now(),
  });
}
export const employerBoard = query({
  args: {},
  returns: v.object({
    canOperate: v.boolean(),
    rows: v.array(vRow),
    jobs: v.array(choice),
    bookings: v.array(v.object({ id: v.id("bookings"), label: v.string() })),
  }),
  handler: async (ctx) => {
    const { org, membership } = await requireOrg(ctx, undefined, "read");
    const canOperate =
      org.status === "active" &&
      org.kind === "kabadiwala" &&
      hasWorkspacePermission(workspaceRole(membership.role), "operate");
    const rows = await ctx.db
      .query("workerHandovers")
      .withIndex("by_org_created", (q) => q.eq("orgId", org._id))
      .order("desc")
      .take(100);
    const visible = await Promise.all(
      rows.map((row) => view(ctx, row, "employer", canOperate)),
    );
    const jobs = canOperate
      ? await ctx.db
          .query("jobs")
          .withIndex("by_org", (q) => q.eq("orgId", org._id))
          .order("desc")
          .take(100)
      : [];
    const bookings: Doc<"bookings">[] = [];
    if (canOperate)
      for (const status of ["accepted", "on_the_way", "completed"] as const) {
        const page = await ctx.db
          .query("bookings")
          .withIndex("by_org_status", (q) =>
            q.eq("orgId", org._id).eq("status", status),
          )
          .order("desc")
          .take(50);
        bookings.push(...page.filter((row) => row.mode === "pickup"));
      }
    return {
      canOperate,
      rows: visible.filter((row) => row !== null),
      jobs: jobs
        .filter(
          (job) =>
            job.saathiProfileId &&
            job.kind === "home_pickups" &&
            job.status === "assigned" &&
            job.cancelledAt === undefined,
        )
        .map((job) => ({ id: job._id, label: job.title })),
      bookings: bookings.map((booking) => ({
        id: booking._id,
        label: `${booking.slotDate} · ${booking.slotWindow} · ${booking.token.slice(-4)}`,
      })),
    };
  },
});
export const workerBoard = query({
  args: {},
  returns: v.array(vRow),
  handler: async (ctx) => {
    const { saathi } = await worker(ctx, true);
    const rows = await ctx.db
      .query("workerHandovers")
      .withIndex("by_worker_created", (q) =>
        q.eq("saathiProfileId", saathi._id),
      )
      .order("desc")
      .take(100);
    const visible = await Promise.all(
      rows.map((row) => view(ctx, row, "worker", saathi.status === "active")),
    );
    return visible.filter((row) => row !== null);
  },
});
export const bind = mutation({
  args: {
    jobId: v.id("jobs"),
    bookingId: v.id("bookings"),
    operationKey: v.string(),
  },
  returns: v.id("workerHandovers"),
  handler: async (ctx, args) => {
    const { org, profile } = await requireOrg(ctx, ["kabadiwala"]);
    key(args.operationKey);
    const previous = await ctx.db
      .query("workerHandovers")
      .withIndex("by_org_operation", (q) =>
        q.eq("orgId", org._id).eq("operationKey", args.operationKey),
      )
      .unique();
    if (previous) {
      if (
        previous.jobId !== args.jobId ||
        previous.bookingId !== args.bookingId
      )
        throw new ConvexError("HANDOVER_REFERENCE_CONFLICT");
      return previous._id;
    }
    const job = await ctx.db.get("jobs", args.jobId),
      booking = await ctx.db.get("bookings", args.bookingId);
    if (
      job?.orgId !== org._id ||
      !job.saathiProfileId ||
      job.kind !== "home_pickups" ||
      job.status !== "assigned" ||
      job.cancelledAt !== undefined
    )
      throw new ConvexError("ASSIGNED_PICKUP_REQUIRED");
    if (
      booking?.orgId !== org._id ||
      booking.mode !== "pickup" ||
      job.date !== booking.slotDate ||
      job.window !== booking.slotWindow ||
      !["accepted", "on_the_way", "completed"].includes(booking.status)
    )
      throw new ConvexError("HANDOVER_SOURCE_UNAVAILABLE");
    const saathi = await ctx.db.get("saathiProfiles", job.saathiProfileId);
    if (saathi?.status !== "active")
      throw new ConvexError("ASSIGNED_PICKUP_REQUIRED");
    const sources = await ctx.db
      .query("workerHandovers")
      .withIndex("by_booking", (q) => q.eq("bookingId", booking._id))
      .take(51);
    const jobRows = await ctx.db
      .query("workerHandovers")
      .withIndex("by_job", (q) => q.eq("jobId", job._id))
      .take(51);
    if (sources.length > 50 || jobRows.length >= 50)
      throw new ConvexError("HANDOVER_LIMIT");
    if (sources.some((row) => row.acknowledgedAt !== undefined))
      throw new ConvexError("HANDOVER_ALREADY_ACKNOWLEDGED");
    for (const prior of sources) {
      if (prior.revokedAt !== undefined) continue;
      const priorSource = await source(ctx, prior);
      if (priorSource && isCurrentAssignment(priorSource))
        throw new ConvexError("BOOKING_ALREADY_ASSIGNED");
      await ctx.db.patch("workerHandovers", prior._id, {
        revokedAt: Date.now(),
        revokedByProfileId: profile._id,
        revocationReason: "source_changed",
      });
      await audit(ctx, prior, profile._id, "source_retired");
    }
    const id = await ctx.db.insert("workerHandovers", {
      orgId: org._id,
      jobId: job._id,
      bookingId: booking._id,
      saathiProfileId: saathi._id,
      workerProfileId: saathi.profileId,
      operationKey: args.operationKey,
      boundByProfileId: profile._id,
      createdAt: Date.now(),
    });
    const row = await ctx.db.get("workerHandovers", id);
    if (!row) throw new ConvexError("HANDOVER_NOT_FOUND");
    await audit(ctx, row, profile._id, "bound");
    return id;
  },
});
export const recordCollected = mutation({
  args: {
    handoverId: v.id("workerHandovers"),
    operationKey: v.string(),
    collectedGrams: v.number(),
    evidenceReference: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { profile, saathi } = await worker(ctx);
    const row = await ctx.db.get("workerHandovers", args.handoverId);
    if (
      row?.saathiProfileId !== saathi._id ||
      row.workerProfileId !== profile._id
    )
      throw new ConvexError("HANDOVER_NOT_FOUND");
    const value = await source(ctx, row);
    if (!value || !isWritable(value, row))
      throw new ConvexError("HANDOVER_SOURCE_UNAVAILABLE");
    if (value.job.date > indiaToday()) throw new ConvexError("TOO_EARLY");
    key(args.operationKey);
    const evidenceReference = text(args.evidenceReference, 3, 200);
    if (!Number.isSafeInteger(args.collectedGrams) || args.collectedGrams <= 0)
      throw new ConvexError("INVALID_WEIGHT");
    if (row.collectedGrams !== undefined) {
      if (
        row.workerOperationKey !== args.operationKey ||
        row.collectedGrams !== args.collectedGrams ||
        row.evidenceReference !== evidenceReference
      )
        throw new ConvexError("HANDOVER_REFERENCE_CONFLICT");
      return null;
    }
    await ctx.db.patch("workerHandovers", row._id, {
      collectedGrams: args.collectedGrams,
      evidenceReference,
      workerOperationKey: args.operationKey,
      collectedByProfileId: profile._id,
      collectedAt: Date.now(),
    });
    await audit(ctx, row, profile._id, "collected", {
      grams: args.collectedGrams,
      evidenceReference,
    });
    return null;
  },
});
export const acknowledge = mutation({
  args: {
    handoverId: v.id("workerHandovers"),
    operationKey: v.string(),
    varianceReason: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { org, profile } = await requireOrg(ctx, ["kabadiwala"]);
    const row = await ctx.db.get("workerHandovers", args.handoverId);
    if (row?.orgId !== org._id) throw new ConvexError("HANDOVER_NOT_FOUND");
    const value = await source(ctx, row);
    if (!value || !isWritable(value, row))
      throw new ConvexError("HANDOVER_SOURCE_UNAVAILABLE");
    key(args.operationKey);
    const varianceReason = text(args.varianceReason, 0, 500);
    if (row.acknowledgedAt !== undefined) {
      if (
        row.employerOperationKey !== args.operationKey ||
        row.varianceReason !== varianceReason
      )
        throw new ConvexError("HANDOVER_REFERENCE_CONFLICT");
      return null;
    }
    if (
      row.collectedGrams === undefined ||
      value.booking.status !== "completed" ||
      !value.booking.receipt
    )
      throw new ConvexError("HANDOVER_RECEIPT_REQUIRED");
    const receipt = receiptWeights(value.booking);
    if (!receipt) throw new ConvexError("INVALID_WEIGHT");
    const { receivedLines, receivedGrams } = receipt;
    const varianceGrams = receivedGrams - row.collectedGrams;
    if (!Number.isSafeInteger(varianceGrams))
      throw new ConvexError("INVALID_WEIGHT");
    if (varianceGrams !== 0 && varianceReason.length < 5)
      throw new ConvexError("HANDOVER_VARIANCE_REASON_REQUIRED");
    const hash = await crypto.subtle.digest(
      "SHA-256",
      new TextEncoder().encode(
        JSON.stringify({ bookingId: value.booking._id, lines: receivedLines }),
      ),
    );
    const receiptFingerprint = [...new Uint8Array(hash)]
      .map((byte) => byte.toString(16).padStart(2, "0"))
      .join("");
    await ctx.db.patch("workerHandovers", row._id, {
      receivedGrams,
      receivedLines,
      varianceGrams,
      varianceReason,
      receiptFingerprint,
      employerOperationKey: args.operationKey,
      acknowledgedByProfileId: profile._id,
      acknowledgedAt: Date.now(),
    });
    await audit(ctx, row, profile._id, "acknowledged", {
      collectedGrams: row.collectedGrams,
      receivedGrams,
      varianceGrams,
      varianceReason,
      receiptFingerprint,
    });
    return null;
  },
});
export const revoke = mutation({
  args: { handoverId: v.id("workerHandovers"), reason: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { org, profile } = await requireOrg(ctx, ["kabadiwala"]);
    const row = await ctx.db.get("workerHandovers", args.handoverId);
    if (row?.orgId !== org._id) throw new ConvexError("HANDOVER_NOT_FOUND");
    const reason = text(args.reason, 5, 500);
    if (row.revokedAt !== undefined) {
      if (row.revocationReason !== reason)
        throw new ConvexError("HANDOVER_REFERENCE_CONFLICT");
      return null;
    }
    if (row.acknowledgedAt !== undefined)
      throw new ConvexError("HANDOVER_ALREADY_ACKNOWLEDGED");
    await ctx.db.patch("workerHandovers", row._id, {
      revokedAt: Date.now(),
      revocationReason: reason,
      revokedByProfileId: profile._id,
    });
    await audit(ctx, row, profile._id, "revoked", { reason });
    return null;
  },
});
