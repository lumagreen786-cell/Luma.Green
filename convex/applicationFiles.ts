import { ConvexError, v } from "convex/values";

import { isLocalAuthTestMode, r2Env } from "../src/lib/env";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import {
  action,
  httpAction,
  internalAction,
  internalMutation,
  internalQuery,
  mutation,
  type QueryCtx,
} from "./_generated/server";
import { corsHeaders, trustedOrigins } from "./files";
import { openAuthUser } from "./lib/access";
import {
  activeFiles,
  removeFile,
  requireEditableApplication,
  requireMember,
} from "./lib/applicationAccess";
import { vFileType } from "./lib/drafts";
import {
  FILE_RULES,
  FILE_TYPES,
  fileProblem,
  type FileType,
  fileTypesFor,
  sniffContentType,
} from "./lib/onboarding";
import { teamAudit } from "./lib/organizations";
import { vR2Reference } from "./lib/qualityFilesSchema";
import { deleteR2, putR2 } from "./lib/r2";

const MAX_NAME_LENGTH = 120;
const UPLOAD_EXPIRY_MS = 60 * 60 * 1000;
const MAX_UPLOAD_ATTEMPTS = 30;
export const APPLICATION_UPLOAD_PATH = "/application-uploads";

function assertLocalLegacyUpload() {
  if (!isLocalAuthTestMode() || r2Env().writes !== "off")
    throw new ConvexError("STORAGE_UNAVAILABLE");
}

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
    assertLocalLegacyUpload();
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
    assertLocalLegacyUpload();
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
    assertLocalLegacyUpload();
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

async function uploadScope(ctx: QueryCtx, type: FileType, rawId?: string) {
  const applicationId = rawId
    ? ctx.db.normalizeId("applications", rawId)
    : null;
  if (rawId && !applicationId) throw new ConvexError("NO_APPLICATION");
  const scope = await requireEditableApplication(
    ctx,
    applicationId ?? undefined,
  );
  if (!fileTypesFor(scope.application.kind).includes(type))
    throw new ConvexError("WRONG_FILE_TYPE");
  return scope;
}

/** Reserve work against the verified profile before reading the body. */
export const reserveR2Attempt = internalMutation({
  args: { type: vFileType, rawId: v.optional(v.string()) },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const { profile } = await uploadScope(ctx, args.type, args.rawId);
    const now = Date.now();
    const row = await ctx.db
      .query("applicationUploadLimits")
      .withIndex("by_profile", (q) => q.eq("profileId", profile._id))
      .unique();
    const attemptedAt = (row?.attemptedAt ?? []).filter(
      (at) => at > now - UPLOAD_EXPIRY_MS,
    );
    if (attemptedAt.length >= MAX_UPLOAD_ATTEMPTS) return false;
    attemptedAt.push(now);
    if (row) {
      await ctx.db.patch("applicationUploadLimits", row._id, { attemptedAt });
    } else {
      const id = await ctx.db.insert("applicationUploadLimits", {
        profileId: profile._id,
        attemptedAt,
      });
      await ctx.scheduler.runAfter(
        UPLOAD_EXPIRY_MS,
        internal.applicationFiles.expireR2Attempts,
        { id },
      );
    }
    return true;
  },
});

export const expireR2Attempts = internalMutation({
  args: { id: v.id("applicationUploadLimits") },
  returns: v.boolean(),
  handler: async (ctx, { id }) => {
    const row = await ctx.db.get("applicationUploadLimits", id);
    if (!row) return false;
    const expiresAt = Math.max(0, ...row.attemptedAt) + UPLOAD_EXPIRY_MS;
    const remaining = expiresAt - Date.now();
    if (remaining <= 0) {
      await ctx.db.delete("applicationUploadLimits", id);
      return true;
    }
    await ctx.scheduler.runAfter(
      remaining,
      internal.applicationFiles.expireR2Attempts,
      { id },
    );
    return false;
  },
});

export const reserveR2 = internalMutation({
  args: {
    type: vFileType,
    rawId: v.optional(v.string()),
    name: v.string(),
    contentType: v.string(),
    size: v.number(),
    r2: vR2Reference,
    sha256: v.string(),
  },
  returns: v.id("applicationFiles"),
  handler: async (ctx, args) => {
    const { profile, application } = await uploadScope(
      ctx,
      args.type,
      args.rawId,
    );
    const now = Date.now();
    const fileId = await ctx.db.insert("applicationFiles", {
      type: args.type,
      name: args.name,
      contentType: args.contentType,
      size: args.size,
      r2: args.r2,
      sha256: args.sha256,
      applicationId: application._id,
      profileId: profile._id,
      createdAt: now,
    });
    await ctx.scheduler.runAfter(
      UPLOAD_EXPIRY_MS,
      internal.applicationFiles.expireR2,
      { fileId },
    );
    return fileId;
  },
});

export const finalizeR2 = internalMutation({
  args: { fileId: v.id("applicationFiles") },
  returns: v.null(),
  handler: async (ctx, { fileId }) => {
    const file = await ctx.db.get("applicationFiles", fileId);
    if (!file?.r2 || file.removedAt !== undefined)
      throw new ConvexError("FILE_NOT_FOUND");
    const { profile, application } = await uploadScope(
      ctx,
      file.type,
      file.applicationId,
    );
    if (file.profileId !== profile._id) throw new ConvexError("FILE_NOT_FOUND");
    if (file.uploadedAt !== undefined) return null;

    const attached = await activeFiles(ctx, application._id);
    const sameType = attached.filter((item) => item.type === file.type);
    const { max } = FILE_RULES[file.type];
    if (max === 1) {
      for (const previous of sameType) await removeFile(ctx, previous);
    } else if (sameType.length >= max) {
      throw new ConvexError("TOO_MANY_FILES");
    }
    await ctx.db.patch("applicationFiles", file._id, {
      uploadedAt: Date.now(),
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
    return null;
  },
});

export const claimR2Expiry = internalMutation({
  args: { fileId: v.id("applicationFiles") },
  returns: v.union(v.null(), vR2Reference),
  handler: async (ctx, { fileId }) => {
    const file = await ctx.db.get("applicationFiles", fileId);
    if (!file?.r2 || file.firstSubmittedVersion !== undefined) return null;
    // A removed pending reservation can still have a PUT in flight.
    if (
      file.uploadedAt === undefined &&
      file.createdAt > Date.now() - UPLOAD_EXPIRY_MS
    )
      return null;
    if (file.removedAt === undefined) {
      if (file.uploadedAt !== undefined) return null;
      await ctx.db.patch("applicationFiles", file._id, {
        removedAt: Date.now(),
      });
    }
    return file.r2;
  },
});

export const finishR2Expiry = internalMutation({
  args: { fileId: v.id("applicationFiles") },
  returns: v.null(),
  handler: async (ctx, { fileId }) => {
    const file = await ctx.db.get("applicationFiles", fileId);
    if (
      file?.r2 &&
      file.removedAt !== undefined &&
      file.firstSubmittedVersion === undefined
    )
      await ctx.db.delete("applicationFiles", fileId);
    return null;
  },
});

export const expireR2 = internalAction({
  args: { fileId: v.id("applicationFiles"), attempt: v.optional(v.number()) },
  returns: v.boolean(),
  handler: async (ctx, { fileId, attempt = 1 }): Promise<boolean> => {
    const ref = await ctx.runMutation(internal.applicationFiles.claimR2Expiry, {
      fileId,
    });
    if (!ref) return false;
    try {
      await deleteR2(ref);
      await ctx.runMutation(internal.applicationFiles.finishR2Expiry, {
        fileId,
      });
      return true;
    } catch (error) {
      if (attempt >= 5) throw error;
      await ctx.scheduler.runAfter(
        UPLOAD_EXPIRY_MS,
        internal.applicationFiles.expireR2,
        { fileId, attempt: attempt + 1 },
      );
      return false;
    }
  },
});

function uploadCors(request: Request) {
  return corsHeaders(
    request.headers.get("Origin"),
    trustedOrigins({
      SITE_URL: process.env.SITE_URL,
      EXTRA_TRUSTED_ORIGINS: process.env.EXTRA_TRUSTED_ORIGINS,
    }),
  );
}

export const preflightR2 = httpAction((_ctx, request) => {
  const headers = uploadCors(request);
  if (!("Access-Control-Allow-Origin" in headers))
    return Promise.resolve(new Response(null, { status: 403, headers }));
  return Promise.resolve(
    new Response(null, {
      status: 204,
      headers: {
        ...headers,
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers":
          "Authorization, Content-Type, X-Luma-File-Name, X-Luma-File-Size",
        "Access-Control-Max-Age": "600",
      },
    }),
  );
});

async function boundedBytes(request: Request, size: number) {
  const reader = request.body?.getReader();
  if (!reader) return null;
  const bytes = new Uint8Array(size);
  let offset = 0;
  try {
    for (;;) {
      const chunk = await reader.read();
      if (chunk.done) return offset === size ? bytes : null;
      if (offset + chunk.value.byteLength > size) {
        await reader.cancel();
        return null;
      }
      bytes.set(chunk.value, offset);
      offset += chunk.value.byteLength;
    }
  } finally {
    reader.releaseLock();
  }
}

/** Use raw HTTP bytes to retain the existing 20 MiB video limit. */
export const uploadR2 = httpAction(async (ctx, request) => {
  const cors = uploadCors(request);
  const headers = { ...cors, "Cache-Control": "no-store" };
  const fail = (status: number, error = "uploadFailed") =>
    Response.json({ ok: false, error }, { status, headers });
  if (request.headers.has("Origin") && !("Access-Control-Allow-Origin" in cors))
    return fail(403);
  try {
    if (!(await openAuthUser(ctx))) return fail(401);
  } catch {
    return fail(401);
  }

  const params = new URL(request.url).searchParams;
  const rawId = params.get("applicationId") ?? undefined;
  const type = FILE_TYPES.find((value) => value === params.get("type"));
  const encodedName = request.headers.get("X-Luma-File-Name") ?? "";
  if (!type || encodedName.length > 1500 || (rawId?.length ?? 0) > 128)
    return fail(400);
  const size = Number(request.headers.get("X-Luma-File-Size"));
  const maxBytes = Math.max(
    ...FILE_RULES[type].accept.map((rule) => rule.maxBytes),
  );
  if (!Number.isSafeInteger(size) || size <= 0 || size > maxBytes)
    return fail(400, "fileTooBig");

  const settings = r2Env();
  if (settings.writes !== "on" || !settings.config)
    return fail(503, "uploadUnavailable");
  let isAllowed: boolean;
  try {
    isAllowed = await ctx.runMutation(
      internal.applicationFiles.reserveR2Attempt,
      {
        type,
        rawId,
      },
    );
  } catch {
    return fail(403);
  }
  if (!isAllowed) return fail(429);
  try {
    const name =
      decodeURIComponent(encodedName).trim().slice(0, MAX_NAME_LENGTH) || type;
    const bytes = await boundedBytes(request, size);
    if (!bytes) return fail(400);
    const contentType = sniffContentType(bytes.subarray(0, 16));
    const problem = fileProblem(type, { contentType, size });
    if (problem || !contentType) return fail(400, problem ?? "fileType");

    const r2 = {
      accountId: settings.config.accountId,
      bucket: settings.config.bucket,
      key: `application/${crypto.randomUUID()}`,
    };
    const hash = new Uint8Array(await crypto.subtle.digest("SHA-256", bytes));
    const sha256 = [...hash]
      .map((byte) => byte.toString(16).padStart(2, "0"))
      .join("");
    const fileId = await ctx.runMutation(internal.applicationFiles.reserveR2, {
      type,
      rawId,
      name,
      contentType,
      size,
      r2,
      sha256,
    });
    await putR2(r2, bytes.buffer, contentType, sha256);
    await ctx.runMutation(internal.applicationFiles.finalizeR2, { fileId });
    return Response.json({ ok: true, fileId }, { status: 201, headers });
  } catch {
    return fail(503);
  }
});
