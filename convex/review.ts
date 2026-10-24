import { ConvexError, v } from "convex/values";

import type { Doc, Id } from "./_generated/dataModel";
import { mutation, query, type QueryCtx } from "./_generated/server";
import { requireAdmin } from "./lib/access";
import { activeFiles, findProfile } from "./lib/applicationAccess";
import { activateApplication } from "./lib/applicationActivation";
import {
  draftSections,
  vApplicationKind,
  vApplicationStatus,
  vFileType,
} from "./lib/drafts";
import { canMove } from "./lib/lifecycle";
import { queueNotification } from "./lib/notifications";
import {
  areaFrom,
  changedFields,
  checkNote,
  DECISION_STATUS,
  hoursSince,
  slaFor,
} from "./lib/review";

/**
 * The admin's verification queue — docs/product/onboarding.md. Every
 * function here is for the admin alone, authenticator required.
 */

/** More than the pilot will ever hold; keeps every read bounded. */
const MAX_LISTED = 200;
const MAX_COUNTED = 1000;
const MAX_VERSIONS = 100;
const MAX_AUDIT_ROWS = 200;

const vSla = v.union(
  v.literal("ok"),
  v.literal("due_soon"),
  v.literal("overdue"),
);

const vQueueStatus = v.union(
  v.literal("submitted"),
  v.literal("changes_requested"),
);

const vDecision = v.union(
  v.literal("approve"),
  v.literal("changes"),
  v.literal("reject"),
);

/** The business's name, or the Saathi's own name. */
function displayName(application: Doc<"applications">): string {
  const name =
    application.kabadiwala?.shopName ??
    application.business?.businessName ??
    application.saathi?.name;
  return name?.trim() ? name.trim() : "Unnamed application";
}

function areaOf(application: Doc<"applications">): string | undefined {
  const { kabadiwala, business, saathi } = application;
  if (kabadiwala?.address) return areaFrom(kabadiwala.address);
  return business?.address
    ? areaFrom(business.address, business.locationTags)
    : saathi?.area?.trim();
}

/** When the application was last sent; old rows fall back to their update. */
function sentAt(application: Doc<"applications">): number {
  return application.submittedAt ?? application.updatedAt;
}

async function queueItem(
  ctx: QueryCtx,
  application: Doc<"applications">,
  status: "submitted" | "changes_requested",
  now: number,
) {
  const profile = await ctx.db.get("profiles", application.profileId);
  const files = await activeFiles(ctx, application._id);
  const submittedAt = sentAt(application);
  // In review, the clock runs from the submission; with the applicant, from
  // the admin's request for changes.
  const waitingSince =
    status === "submitted"
      ? submittedAt
      : (application.decidedAt ?? submittedAt);
  const hoursWaiting = hoursSince(waitingSince, now);
  return {
    id: application._id,
    kind: application.kind,
    status,
    name: displayName(application),
    contactName: application.kabadiwala?.ownerName,
    phone: profile?.phone,
    area: areaOf(application),
    submittedAt,
    waitingSince,
    hoursWaiting,
    sla: slaFor(hoursWaiting),
    fileCount: files.length,
    version: application.version,
  };
}

/**
 * Applications waiting on someone: first those in review (the admin's turn),
 * oldest first, then those sent back for changes (the applicant's turn).
 */
export const queue = query({
  args: {},
  returns: v.array(
    v.object({
      id: v.id("applications"),
      kind: vApplicationKind,
      status: vQueueStatus,
      name: v.string(),
      contactName: v.optional(v.string()),
      phone: v.optional(v.string()),
      area: v.optional(v.string()),
      submittedAt: v.number(),
      waitingSince: v.number(),
      hoursWaiting: v.number(),
      sla: vSla,
      fileCount: v.number(),
      version: v.number(),
    }),
  ),
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const now = Date.now();
    const items = [];
    for (const status of ["submitted", "changes_requested"] as const) {
      const applications = await ctx.db
        .query("applications")
        .withIndex("by_status_submittedAt", (q) => q.eq("status", status))
        .order("asc")
        .take(MAX_LISTED);
      for (const application of applications) {
        items.push(await queueItem(ctx, application, status, now));
      }
    }
    return items;
  },
});

/** The numbers on the console home and in the menu. */
export const summary = query({
  args: {},
  returns: v.object({
    waiting: v.number(),
    dueSoon: v.number(),
    overdue: v.number(),
    withApplicant: v.number(),
    openSupport: v.number(),
  }),
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const now = Date.now();
    const inReview = await ctx.db
      .query("applications")
      .withIndex("by_status_submittedAt", (q) => q.eq("status", "submitted"))
      .take(MAX_COUNTED);
    let dueSoon = 0;
    let overdue = 0;
    for (const application of inReview) {
      const sla = slaFor(hoursSince(sentAt(application), now));
      if (sla === "due_soon") dueSoon += 1;
      else if (sla === "overdue") overdue += 1;
    }
    const withApplicant = await ctx.db
      .query("applications")
      .withIndex("by_status_submittedAt", (q) =>
        q.eq("status", "changes_requested"),
      )
      .take(MAX_COUNTED);
    const openSupport = await ctx.db
      .query("supportRequests")
      .withIndex("by_status", (q) => q.eq("status", "open"))
      .take(MAX_COUNTED);
    // Both support channels share the existing count and total read bound.
    const remaining = MAX_COUNTED - openSupport.length;
    const openConversations =
      remaining > 0
        ? await ctx.db
            .query("conversations")
            .withIndex("by_kind_status_updatedAt", (q) =>
              q.eq("kind", "support").eq("status", "open"),
            )
            .take(remaining)
        : [];
    return {
      waiting: inReview.length,
      dueSoon,
      overdue,
      withApplicant: withApplicant.length,
      openSupport: openSupport.length + openConversations.length,
    };
  },
});

const vFileSummary = v.object({
  id: v.id("applicationFiles"),
  type: vFileType,
  name: v.string(),
  contentType: v.string(),
  size: v.number(),
});

const vAuditEntry = v.object({
  id: v.id("auditLog"),
  action: v.string(),
  at: v.number(),
  by: v.union(v.literal("applicant"), v.literal("admin"), v.literal("system")),
  from: v.optional(v.string()),
  to: v.optional(v.string()),
  note: v.optional(v.string()),
  version: v.optional(v.number()),
});

/** One field of an audit row's free-form metadata, if it has that type. */
function metadataField<T extends "string" | "number">(
  metadata: unknown,
  key: string,
  type: T,
): (T extends "string" ? string : number) | undefined {
  if (typeof metadata !== "object" || metadata === null) return undefined;
  const value: unknown = (metadata as Record<string, unknown>)[key];
  return typeof value === type
    ? (value as T extends "string" ? string : number)
    : undefined;
}

async function auditTrail(ctx: QueryCtx, application: Doc<"applications">) {
  const rows = await ctx.db
    .query("auditLog")
    .withIndex("by_entity", (q) =>
      q.eq("entityTable", "applications").eq("entityId", application._id),
    )
    .take(MAX_AUDIT_ROWS);
  const kinds = new Map<Id<"profiles">, Doc<"profiles">["kind"] | null>();
  const trail = [];
  for (const row of rows) {
    const actor = row.actorProfileId;
    if (actor && !kinds.has(actor)) {
      const profile = await ctx.db.get("profiles", actor);
      kinds.set(actor, profile?.kind ?? null);
    }
    let by: "applicant" | "admin" | "system" = "system";
    if (actor === application.profileId) by = "applicant";
    else if (actor && kinds.get(actor) === "admin") by = "admin";
    const metadata: unknown = row.metadata;
    trail.push({
      id: row._id,
      action: row.action,
      at: row.createdAt,
      by,
      from: metadataField(metadata, "from", "string"),
      to: metadataField(metadata, "to", "string"),
      note: metadataField(metadata, "note", "string"),
      version: metadataField(metadata, "version", "number"),
    });
  }
  return trail;
}

/** Form fields (and `files`) that changed since the version before. */
function changesSincePrevious(
  snapshots: readonly Doc<"applicationSnapshots">[],
  version: number,
): string[] {
  const current = snapshots.find((snapshot) => snapshot.version === version);
  const previous = snapshots.find(
    (snapshot) => snapshot.version === version - 1,
  );
  if (!current || !previous) return [];
  const changes = changedFields(previous, current);
  const fileList = (snapshot: Doc<"applicationSnapshots">) =>
    JSON.stringify(snapshot.fileIds.toSorted((a, b) => a.localeCompare(b)));
  const hasSameFiles = fileList(previous) === fileList(current);
  return hasSameFiles ? changes : [...changes, "files"];
}

/**
 * One application in full, for the admin's review: the form, the files, how
 * many versions came before, what changed since the last one, and its trail.
 * Null when there is no such application.
 */
export const get = query({
  args: { applicationId: v.string() },
  returns: v.union(
    v.null(),
    v.object({
      id: v.id("applications"),
      kind: vApplicationKind,
      status: vApplicationStatus,
      version: v.number(),
      locale: v.string(),
      name: v.string(),
      phone: v.optional(v.string()),
      submittedAt: v.optional(v.number()),
      decidedAt: v.optional(v.number()),
      note: v.optional(v.string()),
      ...draftSections,
      files: v.array(vFileSummary),
      earlierVersions: v.number(),
      changes: v.array(v.string()),
      audit: v.array(vAuditEntry),
    }),
  ),
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const id = ctx.db.normalizeId("applications", args.applicationId);
    const application = id ? await ctx.db.get("applications", id) : null;
    if (!application) return null;

    const profile = await ctx.db.get("profiles", application.profileId);
    const files = await activeFiles(ctx, application._id);
    const snapshots = await ctx.db
      .query("applicationSnapshots")
      .withIndex("by_application_version", (q) =>
        q.eq("applicationId", application._id),
      )
      .order("desc")
      .take(MAX_VERSIONS);

    return {
      id: application._id,
      kind: application.kind,
      status: application.status,
      version: application.version,
      locale: application.locale,
      name: displayName(application),
      phone: profile?.phone,
      submittedAt: application.submittedAt,
      decidedAt: application.decidedAt,
      note: application.note,
      kabadiwala: application.kabadiwala,
      business: application.business,
      documents: application.documents,
      saathi: application.saathi,
      files: files.map((file) => ({
        id: file._id,
        type: file.type,
        name: file.name,
        contentType: file.contentType,
        size: file.size,
      })),
      earlierVersions: snapshots.filter(
        (snapshot) => snapshot.version < application.version,
      ).length,
      changes: changesSincePrevious(snapshots, application.version),
      audit: await auditTrail(ctx, application),
    };
  },
});

// --- Decide -------------------------------------------------------------------

/**
 * The admin's decision on an application in review. Approving creates the
 * business (or Saathi); asking for changes and rejecting need a note, which
 * the applicant sees. Every decision lands in the audit log.
 */
export const decide = mutation({
  args: {
    applicationId: v.id("applications"),
    decision: vDecision,
    note: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const admin = await requireAdmin(ctx);
    const adminProfile = await findProfile(ctx, admin._id);
    const application = await ctx.db.get("applications", args.applicationId);
    if (!application) throw new ConvexError("NOT_FOUND");

    const to = DECISION_STATUS[args.decision];
    if (!canMove(application.status, to)) throw new ConvexError("WRONG_STATE");
    const checked = checkNote(args.decision, args.note);
    if (!checked.ok) throw new ConvexError(checked.error);

    const now = Date.now();
    const actorProfileId = adminProfile?._id;
    const created =
      to === "approved"
        ? await activateApplication(ctx, application, actorProfileId, now)
        : {};

    await ctx.db.patch("applications", application._id, {
      status: to,
      decidedAt: now,
      decidedBy: actorProfileId,
      // The note is for the applicant to act on; an approval clears it.
      note: to === "approved" ? undefined : checked.note,
      updatedAt: now,
    });
    await ctx.db.insert("auditLog", {
      orgId: created.orgId,
      actorProfileId,
      action: `application.${to}`,
      entityTable: "applications",
      entityId: application._id,
      metadata: {
        from: application.status,
        to,
        note: checked.note,
        version: application.version,
        ...created,
      },
      createdAt: now,
    });
    await queueNotification(ctx, {
      event: `application_${to}`,
      dedupKey: `application_${to}:${application._id}:${String(application.version)}`,
      profileId: application.profileId,
      applicationId: application._id,
      locale: application.locale,
      revision: application.version,
    });
    return null;
  },
});
