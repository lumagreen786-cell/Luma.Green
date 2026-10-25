import { ConvexError, v } from "convex/values";

import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import {
  action,
  internalMutation,
  internalQuery,
  mutation,
  type QueryCtx,
} from "./_generated/server";
import {
  activeFiles,
  removeFile,
  requireEditableApplication,
  requireMember,
} from "./lib/applicationAccess";
import { vFileType } from "./lib/drafts";
import {
  FILE_RULES,
  fileProblem,
  type FileType,
  fileTypesFor,
  sniffContentType,
} from "./lib/onboarding";
import { teamAudit } from "./lib/organizations";

const MAX_NAME_LENGTH = 120;

/** Storage IDs are shared across domains; every saved reference protects bytes. */
async function isAttached(ctx: QueryCtx, storageId: Id<"_storage">) {
  const references = await Promise.all([
    ctx.db
      .query("applicationFiles")
      .withIndex("by_storageId", (q) => q.eq("storageId", storageId))
      .first(),
    ctx.db
      .query("householdPhotos")
      .withIndex("by_storage", (q) => q.eq("storageId", storageId))
      .first(),
    ctx.db
      .query("qualityAttachments")
      .withIndex("by_storage", (q) => q.eq("storageId", storageId))
      .first(),
  ]);
  return references.some((reference) => reference !== null);
}

type AttachResult =
  { ok: true; fileId: Id<"applicationFiles"> } | { ok: false; error: string };

/** A one-time URL to upload a file to, for the caller's own application. */
export const generateUploadUrl = mutation({
  args: { applicationId: v.optional(v.id("applications")) },
  returns: v.string(),
  handler: async (ctx, args) => {
    await requireEditableApplication(ctx, args.applicationId);
    return ctx.storage.generateUploadUrl();
  },
});

/** Throws unless the caller may attach this upload as this type right now. */
async function assertCanAttach(
  ctx: QueryCtx,
  storageId: Id<"_storage">,
  type: FileType,
  applicationId?: Id<"applications">,
) {
  const found = await requireEditableApplication(ctx, applicationId);
  if (!fileTypesFor(found.application.kind).includes(type)) {
    throw new ConvexError("WRONG_FILE_TYPE");
  }
  // An upload already attached anywhere is never touched again.
  if (await isAttached(ctx, storageId)) throw new ConvexError("FILE_IN_USE");
  return found;
}

export const checkAttach = internalQuery({
  args: {
    storageId: v.id("_storage"),
    type: vFileType,
    applicationId: v.optional(v.id("applications")),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await assertCanAttach(ctx, args.storageId, args.type, args.applicationId);
    return null;
  },
});

/** A failed attachment must not delete a concurrent request's saved file. */
export const discardUnattached = internalMutation({
  args: { storageId: v.id("_storage") },
  returns: v.null(),
  handler: async (ctx, args) => {
    if (!(await isAttached(ctx, args.storageId)))
      await ctx.storage.delete(args.storageId);
    return null;
  },
});

export const record = internalMutation({
  args: {
    applicationId: v.optional(v.id("applications")),
    storageId: v.id("_storage"),
    type: vFileType,
    name: v.string(),
    contentType: v.string(),
    size: v.number(),
  },
  returns: v.id("applicationFiles"),
  handler: async (ctx, args) => {
    const { profile, application } = await assertCanAttach(
      ctx,
      args.storageId,
      args.type,
      args.applicationId,
    );
    // Cleanup may have won the race after checkAttach. Never save a missing file.
    const stored = await ctx.db.system.get("_storage", args.storageId);
    if (!stored) throw new ConvexError("FILE_NOT_FOUND");
    const attached = await activeFiles(ctx, application._id);
    const sameType = attached.filter((file) => file.type === args.type);
    const { max } = FILE_RULES[args.type];
    if (max === 1) {
      // Certificate, ID and selfie hold one file: a new one replaces it.
      for (const file of sameType) await removeFile(ctx, file);
    } else if (sameType.length >= max) {
      throw new ConvexError("TOO_MANY_FILES");
    }
    const fileId = await ctx.db.insert("applicationFiles", {
      applicationId: application._id,
      profileId: profile._id,
      type: args.type,
      storageId: args.storageId,
      name: args.name.trim().slice(0, MAX_NAME_LENGTH) || args.type,
      contentType: args.contentType,
      size: args.size,
      createdAt: Date.now(),
    });
    if (application.organizationId)
      await teamAudit(
        ctx,
        profile._id,
        { kind: "organization", id: application.organizationId },
        "application.file_attached",
        "applicationFiles",
        fileId,
      );
    return fileId;
  },
});

/**
 * Attaches an uploaded file to the caller's application after checking its
 * real type (from its first bytes) and size. A file that fails is deleted
 * straight away — an action, so the delete isn't rolled back with the error.
 */
export const attach = action({
  args: {
    applicationId: v.optional(v.id("applications")),
    storageId: v.id("_storage"),
    type: vFileType,
    name: v.string(),
  },
  returns: v.union(
    v.object({ ok: v.literal(true), fileId: v.id("applicationFiles") }),
    v.object({ ok: v.literal(false), error: v.string() }),
  ),
  // Annotated: this module calls itself through `internal`, which TypeScript
  // can't infer on its own.
  handler: async (ctx, args): Promise<AttachResult> => {
    await ctx.runQuery(internal.applicationFiles.checkAttach, {
      storageId: args.storageId,
      type: args.type,
      applicationId: args.applicationId,
    });

    const blob = await ctx.storage.get(args.storageId);
    if (!blob) return { ok: false, error: "FILE_NOT_FOUND" };
    const head = new Uint8Array(await blob.slice(0, 16).arrayBuffer());
    const contentType = sniffContentType(head);
    const problem = fileProblem(args.type, { contentType, size: blob.size });
    if (problem || !contentType) {
      await ctx.runMutation(internal.applicationFiles.discardUnattached, {
        storageId: args.storageId,
      });
      return { ok: false, error: problem ?? "fileType" };
    }

    try {
      const fileId: Id<"applicationFiles"> = await ctx.runMutation(
        internal.applicationFiles.record,
        {
          storageId: args.storageId,
          applicationId: args.applicationId,
          type: args.type,
          name: args.name,
          contentType,
          size: blob.size,
        },
      );
      return { ok: true, fileId };
    } catch (error) {
      await ctx.runMutation(internal.applicationFiles.discardUnattached, {
        storageId: args.storageId,
      });
      throw error;
    }
  },
});

/** Takes one of the caller's own files off their application. */
export const remove = mutation({
  args: { fileId: v.id("applicationFiles") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const member = await requireMember(ctx);
    const file = await ctx.db.get("applicationFiles", args.fileId);
    if (file?.profileId !== member._id) throw new ConvexError("FILE_NOT_FOUND");
    const { profile, application } = await requireEditableApplication(
      ctx,
      file.applicationId,
    );
    if (
      file.applicationId !== application._id ||
      file.removedAt !== undefined
    ) {
      throw new ConvexError("FILE_NOT_FOUND");
    }
    await removeFile(ctx, file);
    if (application.organizationId)
      await teamAudit(
        ctx,
        profile._id,
        { kind: "organization", id: application.organizationId },
        "application.file_removed",
        "applicationFiles",
        file._id,
      );
    return null;
  },
});
