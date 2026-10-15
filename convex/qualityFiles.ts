import { ConvexError, v } from "convex/values";

import { r2Env } from "../src/lib/env";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import {
  action,
  httpAction,
  internalAction,
  internalMutation,
  internalQuery,
  mutation,
  query,
  type QueryCtx,
} from "./_generated/server";
import { canReadAuditReport } from "./auditShares";
import { corsHeaders, preflightResponse, trustedOrigins } from "./files";
import { requireUser } from "./lib/access";
import { findProfile } from "./lib/applicationAccess";
import { qualityText, validateQualityContent } from "./lib/qualityContent";
import {
  vBuyerQualityDecision,
  vQualityFileKind,
  vR2Reference,
} from "./lib/qualityFilesSchema";
import { deleteR2, getR2, putR2 } from "./lib/r2";
import { requireOrg, selectedMembership } from "./lib/workspace";

export const vQualityFileView = v.object({
  id: v.id("qualityAttachments"),
  inspectionId: v.id("lotInspections"),
  name: v.string(),
  kind: vQualityFileKind,
  contentType: v.string(),
  size: v.number(),
  sha256: v.string(),
  createdAt: v.number(),
  withdrawnAt: v.optional(v.number()),
  sharedWithBuyer: v.boolean(),
});
export function qualityFileView(row: Doc<"qualityAttachments">) {
  return {
    id: row._id,
    inspectionId: row.inspectionId,
    name: row.name,
    kind: row.kind,
    contentType: row.contentType,
    size: row.size,
    sha256: row.sha256,
    createdAt: row.createdAt,
    withdrawnAt: row.withdrawnAt,
    sharedWithBuyer: Boolean(row.buyerOrgId),
  };
}
async function uploadScope(
  ctx: QueryCtx,
  inspectionId: Id<"lotInspections">,
  isSharedWithBuyer: boolean,
) {
  const scope = await requireOrg(ctx);
  const inspection = await ctx.db.get("lotInspections", inspectionId);
  const lot = inspection
    ? await ctx.db.get("materialLots", inspection.lotId)
    : null;
  if (inspection?.orgId !== scope.org._id || lot?.orgId !== scope.org._id)
    throw new ConvexError("INSPECTION_NOT_FOUND");
  if (isSharedWithBuyer) {
    const buyer = inspection.buyerOrgId
      ? await ctx.db.get("orgs", inspection.buyerOrgId)
      : null;
    if (buyer?.status !== "active" || buyer._id === scope.org._id)
      throw new ConvexError("BUYER_NOT_ACTIVE");
  }
  const attached = await ctx.db
    .query("qualityAttachments")
    .withIndex("by_inspection", (q) => q.eq("inspectionId", inspectionId))
    .take(21);
  if (attached.length >= 20) throw new ConvexError("FILE_LIMIT");
  return { ...scope, inspection };
}
export const checkUpload = internalQuery({
  args: { inspectionId: v.id("lotInspections"), shareWithBuyer: v.boolean() },
  returns: v.null(),
  handler: async (ctx, args) => {
    await uploadScope(ctx, args.inspectionId, args.shareWithBuyer);
    return null;
  },
});
export const recordUpload = internalMutation({
  args: {
    inspectionId: v.id("lotInspections"),
    shareWithBuyer: v.boolean(),
    kind: vQualityFileKind,
    name: v.string(),
    contentType: v.string(),
    size: v.number(),
    sha256: v.string(),
    storageId: v.optional(v.id("_storage")),
    uploadId: v.optional(v.id("qualityUploads")),
  },
  returns: v.id("qualityAttachments"),
  handler: async (ctx, args) => {
    const reservation = args.uploadId
      ? await ctx.db.get("qualityUploads", args.uploadId)
      : null;
    if (reservation?.state === "attached" && reservation.fileId) {
      const scope = await requireOrg(ctx);
      if (
        scope.profile._id !== reservation.profileId ||
        scope.org._id !== reservation.orgId
      )
        throw new ConvexError("FILE_NOT_FOUND");
      return reservation.fileId;
    }
    const { org, profile, inspection } = await uploadScope(
      ctx,
      args.inspectionId,
      args.shareWithBuyer,
    );
    if (Boolean(args.storageId) === Boolean(args.uploadId))
      throw new ConvexError("INVALID_STORAGE");
    if (args.storageId) {
      const metadata = await ctx.db.system.get("_storage", args.storageId);
      if (metadata?.size !== args.size) throw new ConvexError("FILE_NOT_FOUND");
      const used = await ctx.db
        .query("qualityAttachments")
        .withIndex("by_storage", (q) => q.eq("storageId", args.storageId))
        .first();
      if (used) throw new ConvexError("FILE_IN_USE");
    } else if (
      reservation?.state !== "pending" ||
      reservation.cleanupAt <= Date.now() ||
      reservation.profileId !== profile._id ||
      reservation.orgId !== org._id ||
      reservation.inspectionId !== args.inspectionId ||
      reservation.shareWithBuyer !== args.shareWithBuyer ||
      reservation.size !== args.size ||
      reservation.sha256 !== args.sha256
    ) {
      throw new ConvexError("INVALID_UPLOAD");
    }
    const now = Date.now();
    const id = await ctx.db.insert("qualityAttachments", {
      orgId: org._id,
      inspectionId: inspection._id,
      buyerOrgId: args.shareWithBuyer ? inspection.buyerOrgId : undefined,
      kind: args.kind,
      name: qualityText(args.name, 120),
      contentType: args.contentType,
      size: args.size,
      sha256: args.sha256,
      storageId: args.storageId,
      r2: reservation?.r2,
      createdBy: profile._id,
      createdAt: now,
    });
    if (reservation)
      await ctx.db.patch("qualityUploads", reservation._id, {
        state: "attached",
        fileId: id,
      });
    await ctx.db.insert("auditLog", {
      orgId: org._id,
      actorProfileId: profile._id,
      action: "quality.file_attached",
      entityTable: "qualityAttachments",
      entityId: id,
      createdAt: now,
      metadata: {
        inspectionId: inspection._id,
        sharedWithBuyer: args.shareWithBuyer,
        sha256: args.sha256,
      },
    });
    return id;
  },
});
export const discard = internalMutation({
  args: { storageId: v.id("_storage") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const used = await ctx.db
      .query("qualityAttachments")
      .withIndex("by_storage", (q) => q.eq("storageId", args.storageId))
      .first();
    if (!used) await ctx.storage.delete(args.storageId);
    return null;
  },
});
/** Server accepts bytes, never a client-chosen storage ID or public download URL. */
export const upload = action({
  args: {
    inspectionId: v.id("lotInspections"),
    shareWithBuyer: v.boolean(),
    kind: vQualityFileKind,
    name: v.string(),
    contentType: v.string(),
    bytes: v.bytes(),
  },
  returns: v.id("qualityAttachments"),
  handler: async (ctx, args): Promise<Id<"qualityAttachments">> => {
    await ctx.runQuery(internal.qualityFiles.checkUpload, {
      inspectionId: args.inspectionId,
      shareWithBuyer: args.shareWithBuyer,
    });
    const name = qualityText(args.name, 120);
    const contentType = validateQualityContent(args.bytes, args.contentType);
    if (contentType === "application/pdf" && args.kind === "photo")
      throw new ConvexError("INVALID_FILE_TYPE");
    const digest = await crypto.subtle.digest("SHA-256", args.bytes);
    const sha256 = [...new Uint8Array(digest)]
      .map((n) => n.toString(16).padStart(2, "0"))
      .join("");
    const settings = r2Env();
    if (settings.writes === "invalid")
      throw new ConvexError("STORAGE_UNAVAILABLE");
    if (settings.writes === "on" && settings.config) {
      const r2 = {
        accountId: settings.config.accountId,
        bucket: settings.config.bucket,
        key: `quality/${crypto.randomUUID()}`,
      };
      const uploadId = await ctx.runMutation(internal.qualityFiles.reserveR2, {
        inspectionId: args.inspectionId,
        shareWithBuyer: args.shareWithBuyer,
        r2,
        size: args.bytes.byteLength,
        sha256,
      });
      // Reservation survives action crashes and ambiguous provider responses.
      await putR2(r2, args.bytes, contentType);
      return ctx.runMutation(internal.qualityFiles.recordUpload, {
        inspectionId: args.inspectionId,
        shareWithBuyer: args.shareWithBuyer,
        kind: args.kind,
        name,
        contentType,
        size: args.bytes.byteLength,
        sha256,
        uploadId,
      });
    }
    const storageId = await ctx.storage.store(
      new Blob([args.bytes], { type: contentType }),
    );
    try {
      return await ctx.runMutation(internal.qualityFiles.recordUpload, {
        inspectionId: args.inspectionId,
        shareWithBuyer: args.shareWithBuyer,
        kind: args.kind,
        name,
        contentType,
        size: args.bytes.byteLength,
        sha256,
        storageId,
      });
    } catch (error) {
      await ctx.runMutation(internal.qualityFiles.discard, { storageId });
      throw error;
    }
  },
});
export const withdraw = mutation({
  args: { fileId: v.id("qualityAttachments") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { org, profile, role } = await requireOrg(ctx);
    if (role !== "owner") throw new ConvexError("OWNER_REQUIRED");
    const file = await ctx.db.get("qualityAttachments", args.fileId);
    if (file?.orgId !== org._id) throw new ConvexError("FILE_NOT_FOUND");
    if (file.withdrawnAt) return null;
    const now = Date.now();
    await ctx.db.patch("qualityAttachments", file._id, { withdrawnAt: now });
    await ctx.db.insert("auditLog", {
      orgId: org._id,
      actorProfileId: profile._id,
      action: "quality.file_withdrawn",
      entityTable: "qualityAttachments",
      entityId: file._id,
      createdAt: now,
    });
    return null;
  },
});
export const board = query({
  args: {},
  returns: v.object({
    orgId: v.id("orgs"),
    canOperate: v.boolean(),
    canWithdraw: v.boolean(),
    inspections: v.array(
      v.object({
        id: v.id("lotInspections"),
        label: v.string(),
        buyerName: v.optional(v.string()),
      }),
    ),
    own: v.array(vQualityFileView),
    incoming: v.array(vQualityFileView),
    decisions: v.array(
      v.object({
        id: v.id("qualityBuyerDecisions"),
        inspectionId: v.id("lotInspections"),
        decision: vBuyerQualityDecision,
        note: v.string(),
        createdAt: v.number(),
      }),
    ),
  }),
  handler: async (ctx) => {
    const { org, role } = await requireOrg(ctx, undefined, "read");
    const inspected = await ctx.db
      .query("lotInspections")
      .withIndex("by_org_created", (q) => q.eq("orgId", org._id))
      .order("desc")
      .take(100);
    const inspections = [];
    for (const row of inspected) {
      const lot = await ctx.db.get("materialLots", row.lotId);
      if (lot?.orgId !== org._id) continue;
      const buyer = row.buyerOrgId
        ? await ctx.db.get("orgs", row.buyerOrgId)
        : null;
      inspections.push({
        id: row._id,
        label: row.specificationReference + " · " + row.specificationVersion,
        buyerName: buyer?.name,
      });
    }
    const own = await ctx.db
      .query("qualityAttachments")
      .withIndex("by_org", (q) => q.eq("orgId", org._id))
      .order("desc")
      .take(100);
    const incoming = await ctx.db
      .query("qualityAttachments")
      .withIndex("by_buyer", (q) => q.eq("buyerOrgId", org._id))
      .order("desc")
      .take(100);
    const sellerDecisions = await ctx.db
      .query("qualityBuyerDecisions")
      .withIndex("by_inspecting_org", (q) => q.eq("inspectingOrgId", org._id))
      .order("desc")
      .take(100);
    const decisions = await ctx.db
      .query("qualityBuyerDecisions")
      .withIndex("by_buyer", (q) => q.eq("buyerOrgId", org._id))
      .order("desc")
      .take(100);
    return {
      orgId: org._id,
      canOperate: role !== "viewer",
      canWithdraw: role === "owner",
      inspections,
      own: own.map((row) => qualityFileView(row)),
      incoming: incoming
        .filter((f) => !f.withdrawnAt)
        .map((row) => qualityFileView(row)),
      decisions: [...decisions, ...sellerDecisions].map((d) => ({
        id: d._id,
        inspectionId: d.inspectionId,
        decision: d.decision,
        note: d.note,
        createdAt: d.createdAt,
      })),
    };
  },
});
export const decide = mutation({
  args: {
    inspectionId: v.id("lotInspections"),
    attachmentIds: v.array(v.id("qualityAttachments")),
    decision: vBuyerQualityDecision,
    note: v.string(),
  },
  returns: v.id("qualityBuyerDecisions"),
  handler: async (ctx, args) => {
    const { org, profile } = await requireOrg(ctx);
    const inspection = await ctx.db.get("lotInspections", args.inspectionId);
    if (inspection?.buyerOrgId !== org._id || inspection.orgId === org._id)
      throw new ConvexError("QUALITY_ACCESS_DENIED");
    if (
      args.attachmentIds.length === 0 ||
      args.attachmentIds.length > 20 ||
      new Set(args.attachmentIds).size !== args.attachmentIds.length
    )
      throw new ConvexError("INVALID_FILES");
    for (const id of args.attachmentIds) {
      const file = await ctx.db.get("qualityAttachments", id);
      if (
        file?.inspectionId !== inspection._id ||
        file.buyerOrgId !== org._id ||
        file.withdrawnAt
      )
        throw new ConvexError("QUALITY_ACCESS_DENIED");
    }
    const note = qualityText(args.note);
    const now = Date.now();
    const id = await ctx.db.insert("qualityBuyerDecisions", {
      ...args,
      note,
      inspectingOrgId: inspection.orgId,
      buyerOrgId: org._id,
      actorProfileId: profile._id,
      createdAt: now,
    });
    await ctx.db.insert("auditLog", {
      orgId: org._id,
      actorProfileId: profile._id,
      action: "quality.buyer_decision",
      entityTable: "qualityBuyerDecisions",
      entityId: id,
      createdAt: now,
    });
    return id;
  },
});
export const readFile = internalQuery({
  args: { fileId: v.string(), reportId: v.optional(v.string()) },
  returns: v.union(
    v.null(),
    v.object({
      storageId: v.optional(v.id("_storage")),
      r2: v.optional(vR2Reference),
      size: v.number(),
      sha256: v.string(),
      contentType: v.string(),
      name: v.string(),
    }),
  ),
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const profile = await findProfile(ctx, user._id);
    if (!profile) return null;
    const id = ctx.db.normalizeId("qualityAttachments", args.fileId);
    const file = id ? await ctx.db.get("qualityAttachments", id) : null;
    if (!file || file.withdrawnAt) return null;
    let isAllowed = false;
    if (args.reportId) {
      const reportId = ctx.db.normalizeId("auditReports", args.reportId);
      const report = reportId
        ? await ctx.db.get("auditReports", reportId)
        : null;
      isAllowed = Boolean(
        report &&
        report.attachmentIds.includes(file._id) &&
        (await canReadAuditReport(ctx, report, profile._id)),
      );
    } else {
      const selected = await selectedMembership(ctx, profile._id);
      isAllowed = Boolean(
        selected &&
        (selected.org._id === file.orgId ||
          selected.org._id === file.buyerOrgId),
      );
    }
    const source = await ctx.db.get("orgs", file.orgId);
    return isAllowed && source?.status === "active"
      ? {
          storageId: file.storageId,
          r2: file.r2,
          size: file.size,
          sha256: file.sha256,
          contentType: file.contentType,
          name: file.name,
        }
      : null;
  },
});
const origins = () =>
  trustedOrigins({
    SITE_URL: process.env.SITE_URL,
    EXTRA_TRUSTED_ORIGINS: process.env.EXTRA_TRUSTED_ORIGINS,
  });
export const serve = httpAction(async (ctx, request) => {
  const headers = {
    ...corsHeaders(request.headers.get("Origin"), origins()),
    "Cache-Control": "private, no-store",
    "X-Content-Type-Options": "nosniff",
    "Content-Security-Policy": "sandbox; default-src 'none'",
  };
  const url = new URL(request.url);
  const fileId = url.pathname.slice("/quality-files/".length);
  let file;
  try {
    file = await ctx.runQuery(internal.qualityFiles.readFile, {
      fileId,
      reportId: url.searchParams.get("report") ?? undefined,
    });
  } catch {
    return new Response("UNAVAILABLE", { status: 403, headers });
  }
  if (!file) return new Response("UNAVAILABLE", { status: 404, headers });
  let blob: Blob | null;
  try {
    if (Boolean(file.r2) === Boolean(file.storageId))
      throw new Error("Invalid storage reference");
    blob = null;
    if (file.r2) blob = await getR2(file.r2, file.size, file.sha256);
    else if (file.storageId) blob = await ctx.storage.get(file.storageId);
  } catch {
    return new Response("UNAVAILABLE", { status: 503, headers });
  }
  if (!blob) return new Response("UNAVAILABLE", { status: 404, headers });
  return new Response(blob, {
    headers: {
      ...headers,
      "Content-Type": file.contentType,
      "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(file.name)}`,
    },
  });
});
export const preflight = httpAction((_ctx, request) =>
  Promise.resolve(preflightResponse(request.headers.get("Origin"), origins())),
);

/** Reserve before external writes, so crashes cannot create untracked objects. */
export const reserveR2 = internalMutation({
  args: {
    inspectionId: v.id("lotInspections"),
    shareWithBuyer: v.boolean(),
    r2: vR2Reference,
    size: v.number(),
    sha256: v.string(),
  },
  returns: v.id("qualityUploads"),
  handler: async (ctx, args) => {
    const { org, profile } = await uploadScope(
      ctx,
      args.inspectionId,
      args.shareWithBuyer,
    );
    const now = Date.now();
    const recent = await ctx.db
      .query("qualityUploads")
      .withIndex("by_profile_created", (q) =>
        q.eq("profileId", profile._id).gt("createdAt", now - 3_600_000),
      )
      .take(60);
    if (recent.length >= 60) throw new ConvexError("UPLOAD_RATE_LIMITED");
    const pending = await ctx.db
      .query("qualityUploads")
      .withIndex("by_inspection_state", (q) =>
        q.eq("inspectionId", args.inspectionId).eq("state", "pending"),
      )
      .take(20);
    const attached = await ctx.db
      .query("qualityAttachments")
      .withIndex("by_inspection", (q) =>
        q.eq("inspectionId", args.inspectionId),
      )
      .take(20);
    if (pending.length + attached.length >= 20)
      throw new ConvexError("FILE_LIMIT");
    const id = await ctx.db.insert("qualityUploads", {
      ...args,
      orgId: org._id,
      profileId: profile._id,
      state: "pending",
      createdAt: now,
      cleanupAt: now + 3_600_000,
      attempts: 0,
    });
    await ctx.db.insert("auditLog", {
      orgId: org._id,
      actorProfileId: profile._id,
      action: "quality.upload_reserved",
      entityTable: "qualityUploads",
      entityId: id,
      createdAt: now,
    });
    return id;
  },
});

export const claimCleanup = internalMutation({
  args: {},
  returns: v.array(v.object({ id: v.id("qualityUploads"), r2: vR2Reference })),
  handler: async (ctx) => {
    const now = Date.now();
    const pending = await ctx.db
      .query("qualityUploads")
      .withIndex("by_state_cleanup", (q) =>
        q.eq("state", "pending").lte("cleanupAt", now),
      )
      .take(10);
    const retry = await ctx.db
      .query("qualityUploads")
      .withIndex("by_state_cleanup", (q) =>
        q.eq("state", "deleting").lte("cleanupAt", now),
      )
      .take(10);
    const rows = [...pending, ...retry];
    for (const row of rows)
      await ctx.db.patch("qualityUploads", row._id, {
        state: "deleting",
        attempts: row.attempts + 1,
        cleanupAt: now + 3_600_000,
      });
    return rows.map((row) => ({ id: row._id, r2: row.r2 }));
  },
});
export const finishCleanup = internalMutation({
  args: { id: v.id("qualityUploads") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const row = await ctx.db.get("qualityUploads", args.id);
    if (row?.state === "deleting") {
      await ctx.db.insert("auditLog", {
        orgId: row.orgId,
        actorProfileId: row.profileId,
        action: "quality.upload_discarded",
        entityTable: "qualityUploads",
        entityId: row._id,
        createdAt: Date.now(),
      });
      await ctx.db.delete("qualityUploads", row._id);
    }
    return null;
  },
});
export const cleanupR2 = internalAction({
  args: {},
  returns: v.object({ deleted: v.number(), failed: v.number() }),
  handler: async (ctx): Promise<{ deleted: number; failed: number }> => {
    const rows = await ctx.runMutation(internal.qualityFiles.claimCleanup, {});
    let deleted = 0;
    let failed = 0;
    for (const row of rows) {
      try {
        await deleteR2(row.r2);
        await ctx.runMutation(internal.qualityFiles.finishCleanup, {
          id: row.id,
        });
        deleted++;
      } catch {
        failed++;
      }
    }
    if (failed > 0) console.error("R2 cleanup incomplete", { failed });
    return { deleted, failed };
  },
});
