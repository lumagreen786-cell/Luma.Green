import { ConvexError, v } from "convex/values";

import type { Doc, Id } from "./_generated/dataModel";
import { mutation, query, type QueryCtx } from "./_generated/server";
import { requireUser } from "./lib/access";
import { isProfileOpen, openStakeholders } from "./lib/accountClosure";
import { findProfile } from "./lib/applicationAccess";
import { vAuditSnapshot } from "./lib/auditSharesSchema";
import { qualityText } from "./lib/qualityContent";
import { requireOrg, selectedMembership } from "./lib/workspace";

/** Live grant check is also used by the authenticated byte download endpoint. */
export async function canReadAuditReport(
  ctx: QueryCtx,
  report: Doc<"auditReports">,
  profileId: Id<"profiles">,
) {
  if (
    report.revokedAt ||
    report.expiresAt <= Date.now() ||
    !(await isProfileOpen(ctx, report.createdBy)) ||
    !(await isProfileOpen(ctx, profileId))
  )
    return false;
  const source = await ctx.db.get("orgs", report.orgId);
  if (source?.status !== "active") return false;
  const selected = await selectedMembership(ctx, profileId);
  if (
    selected?.org._id === report.orgId &&
    selected.membership.role === "owner"
  )
    return true;
  const recipient = await ctx.db.get("stakeholderAccounts", report.recipientId);
  return (
    recipient?.status === "approved" &&
    recipient.ownerProfileId === profileId &&
    report.recipientProfileId === profileId
  );
}
/** Reports expose effective results, never pending or replaced corrections. */
async function inspectionShareError(
  ctx: QueryCtx,
  inspection: Doc<"lotInspections">,
) {
  const replacement = await ctx.db
    .query("lotInspectionApprovals")
    .withIndex("by_superseded", (q) =>
      q.eq("supersededInspectionId", inspection._id),
    )
    .first();
  if (replacement) return "INSPECTION_SUPERSEDED";
  if (inspection.supersedesInspectionId) {
    const approval = await ctx.db
      .query("lotInspectionApprovals")
      .withIndex("by_inspection", (q) => q.eq("inspectionId", inspection._id))
      .first();
    if (!approval) return "INSPECTION_NOT_APPROVED";
  }
  return null;
}
const vReportSummary = v.object({
  id: v.id("auditReports"),
  purpose: v.string(),
  createdAt: v.number(),
  expiresAt: v.number(),
  revokedAt: v.optional(v.number()),
});
function summary(row: Doc<"auditReports">) {
  return {
    id: row._id,
    purpose: row.purpose,
    createdAt: row.createdAt,
    expiresAt: row.expiresAt,
    revokedAt: row.revokedAt,
  };
}
export const board = query({
  args: {},
  returns: v.object({
    canCreate: v.boolean(),
    orgId: v.union(v.id("orgs"), v.null()),
    own: v.array(vReportSummary),
    received: v.array(vReportSummary),
    recipients: v.array(
      v.object({ id: v.id("stakeholderAccounts"), name: v.string() }),
    ),
    inspections: v.array(
      v.object({ id: v.id("lotInspections"), label: v.string() }),
    ),
    files: v.array(
      v.object({
        id: v.id("qualityAttachments"),
        inspectionId: v.id("lotInspections"),
        name: v.string(),
      }),
    ),
  }),
  handler: async (ctx) => {
    const user = await requireUser(ctx);
    const profile = await findProfile(ctx, user._id);
    if (!profile) throw new ConvexError("NO_PROFILE");
    const selected = await selectedMembership(ctx, profile._id);
    const canCreate = selected?.membership.role === "owner";
    const orgId = canCreate ? selected.org._id : null;
    const own = orgId
      ? await ctx.db
          .query("auditReports")
          .withIndex("by_org", (q) => q.eq("orgId", orgId))
          .order("desc")
          .take(100)
      : [];
    const receivedRows = await ctx.db
      .query("auditReports")
      .withIndex("by_recipient", (q) => q.eq("recipientProfileId", profile._id))
      .order("desc")
      .take(100);
    const received = [];
    for (const row of receivedRows)
      if (await canReadAuditReport(ctx, row, profile._id))
        received.push(summary(row));
    const accounts = orgId
      ? await ctx.db
          .query("stakeholderAccounts")
          .withIndex("by_status_createdAt", (q) => q.eq("status", "approved"))
          .take(100)
      : [];
    const openAccounts = await openStakeholders(ctx, accounts);
    const rows = orgId
      ? await ctx.db
          .query("lotInspections")
          .withIndex("by_org_created", (q) => q.eq("orgId", orgId))
          .order("desc")
          .take(100)
      : [];
    const inspections = [];
    for (const row of rows) {
      const lot = await ctx.db.get("materialLots", row.lotId);
      if (
        orgId &&
        lot?.orgId === orgId &&
        !(await inspectionShareError(ctx, row))
      )
        inspections.push({
          id: row._id,
          label: row.specificationReference + " · " + row.specificationVersion,
        });
    }
    const files = orgId
      ? await ctx.db
          .query("qualityAttachments")
          .withIndex("by_org", (q) => q.eq("orgId", orgId))
          .order("desc")
          .take(100)
      : [];
    return {
      canCreate,
      orgId,
      own: own.map((row) => summary(row)),
      received,
      recipients: openAccounts.map((a) => ({
        id: a._id,
        name: a.organizationName,
      })),
      inspections,
      files: files
        .filter((f) => !f.withdrawnAt)
        .map((f) => ({
          id: f._id,
          inspectionId: f.inspectionId,
          name: f.name,
        })),
    };
  },
});
export const create = mutation({
  args: {
    inspectionId: v.id("lotInspections"),
    recipientId: v.id("stakeholderAccounts"),
    purpose: v.string(),
    expiresAt: v.number(),
    attachmentIds: v.array(v.id("qualityAttachments")),
  },
  returns: v.id("auditReports"),
  handler: async (ctx, args) => {
    const { org, profile, role } = await requireOrg(ctx);
    if (role !== "owner") throw new ConvexError("OWNER_REQUIRED");
    const now = Date.now();
    if (
      !Number.isSafeInteger(args.expiresAt) ||
      args.expiresAt <= now ||
      args.expiresAt > now + 90 * 86_400_000
    )
      throw new ConvexError("INVALID_EXPIRY");
    const purpose = qualityText(args.purpose, 200);
    const recipient = await ctx.db.get("stakeholderAccounts", args.recipientId);
    if (
      recipient?.status !== "approved" ||
      !(await isProfileOpen(ctx, recipient.ownerProfileId))
    )
      throw new ConvexError("RECIPIENT_NOT_APPROVED");
    const inspection = await ctx.db.get("lotInspections", args.inspectionId);
    const lot = inspection
      ? await ctx.db.get("materialLots", inspection.lotId)
      : null;
    if (inspection?.orgId !== org._id || lot?.orgId !== org._id)
      throw new ConvexError("INSPECTION_NOT_FOUND");
    const shareError = await inspectionShareError(ctx, inspection);
    if (shareError) throw new ConvexError(shareError);
    if (
      args.attachmentIds.length > 20 ||
      new Set(args.attachmentIds).size !== args.attachmentIds.length
    )
      throw new ConvexError("INVALID_FILES");
    for (const id of args.attachmentIds) {
      const file = await ctx.db.get("qualityAttachments", id);
      if (
        file?.orgId !== org._id ||
        file.inspectionId !== inspection._id ||
        file.withdrawnAt
      )
        throw new ConvexError("QUALITY_ACCESS_DENIED");
    }
    // Deliberate whitelist: no source reference, contacts, custody graph, recipe or sibling IDs.
    const buyerDecisions = await ctx.db
      .query("qualityBuyerDecisions")
      .withIndex("by_inspection", (q) => q.eq("inspectionId", inspection._id))
      .order("desc")
      .take(100);
    const snapshot = {
      materialCode: lot.materialCode,
      state: lot.state,
      declaredGrams: lot.initialGrams,
      specificationReference: inspection.specificationReference,
      specificationVersion: inspection.specificationVersion,
      sampleMethod: inspection.sampleMethod,
      results: inspection.results,
      inspectingDecision: inspection.decision,
      buyerDecisions: buyerDecisions.map((row) => ({
        decision: row.decision,
        note: row.note,
        createdAt: row.createdAt,
      })),
      inspectionCreatedAt: inspection.createdAt,
    };
    const id = await ctx.db.insert("auditReports", {
      ...args,
      purpose,
      orgId: org._id,
      recipientProfileId: recipient.ownerProfileId,
      snapshot,
      createdBy: profile._id,
      createdAt: now,
    });
    await ctx.db.insert("auditLog", {
      orgId: org._id,
      actorProfileId: profile._id,
      action: "audit_report.granted",
      entityTable: "auditReports",
      entityId: id,
      createdAt: now,
      metadata: { recipientId: recipient._id, expiresAt: args.expiresAt },
    });
    return id;
  },
});
export const revoke = mutation({
  args: { reportId: v.id("auditReports") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { org, profile, role } = await requireOrg(ctx);
    if (role !== "owner") throw new ConvexError("OWNER_REQUIRED");
    const row = await ctx.db.get("auditReports", args.reportId);
    if (row?.orgId !== org._id) throw new ConvexError("REPORT_NOT_FOUND");
    if (row.revokedAt) return null;
    const now = Date.now();
    await ctx.db.patch("auditReports", row._id, { revokedAt: now });
    await ctx.db.insert("auditLog", {
      orgId: org._id,
      actorProfileId: profile._id,
      action: "audit_report.revoked",
      entityTable: "auditReports",
      entityId: row._id,
      createdAt: now,
    });
    return null;
  },
});
export const read = query({
  args: { reportId: v.id("auditReports") },
  returns: v.union(
    v.null(),
    v.object({
      purpose: v.string(),
      expiresAt: v.number(),
      snapshot: vAuditSnapshot,
      files: v.array(
        v.object({
          id: v.id("qualityAttachments"),
          name: v.string(),
          sha256: v.string(),
          available: v.boolean(),
        }),
      ),
    }),
  ),
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const profile = await findProfile(ctx, user._id);
    const report = await ctx.db.get("auditReports", args.reportId);
    if (
      !profile ||
      !report ||
      !(await canReadAuditReport(ctx, report, profile._id))
    )
      return null;
    const files = [];
    for (const id of report.attachmentIds) {
      const file = await ctx.db.get("qualityAttachments", id);
      if (file)
        files.push({
          id: file._id,
          name: file.name,
          sha256: file.sha256,
          available: !file.withdrawnAt,
        });
    }
    return {
      purpose: report.purpose,
      expiresAt: report.expiresAt,
      snapshot: report.snapshot,
      files,
    };
  },
});
