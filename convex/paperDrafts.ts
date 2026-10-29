import {
  paginationOptsValidator,
  paginationResultValidator,
} from "convex/server";
import { ConvexError, v } from "convex/values";

import { paperTranscriptionEnv } from "../src/lib/env";
import { stripUploadMetadata } from "../src/lib/upload-image-metadata";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import {
  action,
  httpAction,
  internalMutation,
  internalQuery,
  mutation,
  type MutationCtx,
  query,
  type QueryCtx,
} from "./_generated/server";
import {
  contentDisposition,
  corsHeaders,
  preflightResponse,
  trustedOrigins,
} from "./files";
import { openAuthUser } from "./lib/access";
import {
  hasPaperContent,
  PAPER_DAY_MS,
  PAPER_DRAFT_MS,
  PAPER_PROMPT_VERSION,
  paperContent,
  paperDay,
  paperHash,
  validatePaperImage,
} from "./lib/paper";
import { requestPaperTranscription } from "./lib/paperProvider";
import {
  vExtractionStatus,
  vPaperContent,
  vPaperStatus,
} from "./lib/paperSchema";
import {
  readPaperSource,
  releasePaperSource,
  retainPaperSource,
} from "./lib/paperSources";
import { requireOrg } from "./lib/workspace";

async function scope(ctx: QueryCtx, canWrite = false) {
  const result = await requireOrg(
    ctx,
    undefined,
    canWrite ? "operate" : "read",
  );
  if (result.org.status !== "active") throw new ConvexError("PAPER_NOT_FOUND");
  return result;
}
async function accessible(
  ctx: QueryCtx,
  id: Id<"paperDrafts">,
  canWrite = false,
) {
  const actor = await scope(ctx, canWrite);
  const row = await ctx.db.get("paperDrafts", id);
  if (
    row?.orgId !== actor.org._id ||
    (row.status !== "confirmed" && row.expiresAt <= Date.now())
  )
    throw new ConvexError("PAPER_NOT_FOUND");
  return { ...actor, row };
}
async function audit(
  ctx: MutationCtx,
  row: Doc<"paperDrafts">,
  actor: Id<"profiles">,
  event: string,
) {
  await ctx.db.insert("auditLog", {
    orgId: row.orgId,
    actorProfileId: actor,
    action: `paper.${event}`,
    entityTable: "paperDrafts",
    entityId: row._id,
    createdAt: Date.now(),
    metadata: { revision: row.revision, sha256: row.sha256 },
  });
}
const summaryValidator = v.object({
  id: v.id("paperDrafts"),
  name: v.string(),
  contentType: v.string(),
  size: v.number(),
  sha256: v.string(),
  createdAt: v.number(),
  revision: v.number(),
  status: vPaperStatus,
  extractionStatus: vExtractionStatus,
});
function summary(row: Doc<"paperDrafts">) {
  return {
    id: row._id,
    name: row.name,
    contentType: row.contentType,
    size: row.size,
    sha256: row.sha256,
    createdAt: row.createdAt,
    revision: row.revision,
    status: row.status,
    extractionStatus: row.extractionStatus,
  };
}
const detailValidator = v.object({
  ...summaryValidator.fields,
  extractedContent: v.optional(vPaperContent),
  reviewedContent: v.optional(vPaperContent),
  confirmedAt: v.optional(v.number()),
});
const revisionArgs = {
  draftId: v.id("paperDrafts"),
  expectedRevision: v.number(),
};
const revisionReply = v.object({
  draftId: v.id("paperDrafts"),
  revision: v.number(),
});
function writable(row: Doc<"paperDrafts">, revision: number) {
  if (row.status === "confirmed") throw new ConvexError("PAPER_CONFIRMED");
  if (row.status === "extracting") throw new ConvexError("PAPER_BUSY");
  if (row.revision !== revision)
    throw new ConvexError("PAPER_REVISION_CONFLICT");
}
export const availability = query({
  args: {},
  returns: v.object({ assisted: v.boolean(), canOperate: v.boolean() }),
  handler: async (ctx) => {
    const { role } = await scope(ctx);
    return {
      assisted: Boolean(paperTranscriptionEnv()),
      canOperate: role !== "viewer",
    };
  },
});
export const currentScope = internalQuery({
  args: {},
  returns: v.object({ orgId: v.id("orgs"), profileId: v.id("profiles") }),
  handler: async (ctx) => {
    const { org, profile } = await scope(ctx, true);
    return { orgId: org._id, profileId: profile._id };
  },
});
export const list = query({
  args: { paginationOpts: paginationOptsValidator },
  returns: paginationResultValidator(summaryValidator),
  handler: async (ctx, args) => {
    const { org } = await scope(ctx);
    const result = await ctx.db
      .query("paperDrafts")
      .withIndex("by_org_created", (q) => q.eq("orgId", org._id))
      .order("desc")
      .paginate({
        ...args.paginationOpts,
        numItems: Math.max(1, Math.min(20, args.paginationOpts.numItems)),
        maximumRowsRead: 40,
      });
    return {
      ...result,
      page: result.page
        .filter(
          (row) => row.status === "confirmed" || row.expiresAt > Date.now(),
        )
        .map((row) => summary(row)),
    };
  },
});
export const get = query({
  args: { draftId: v.id("paperDrafts") },
  returns: detailValidator,
  handler: async (ctx, { draftId }) => {
    const { row } = await accessible(ctx, draftId);
    return {
      ...summary(row),
      extractedContent: row.extractedContent,
      reviewedContent: row.reviewedContent,
      confirmedAt: row.confirmedAt,
    };
  },
});
export const commitUpload = internalMutation({
  args: {
    orgId: v.id("orgs"),
    name: v.string(),
    contentType: v.string(),
    size: v.number(),
    sha256: v.string(),
    bytes: v.bytes(),
  },
  returns: revisionReply,
  handler: async (ctx, args) => {
    const { org, profile } = await scope(ctx, true);
    if (args.bytes.byteLength !== args.size)
      throw new ConvexError("PAPER_INVALID_FILE");
    if (org._id !== args.orgId) throw new ConvexError("PAPER_NOT_FOUND");
    const duplicate = await ctx.db
      .query("paperDrafts")
      .withIndex("by_org_hash", (q) =>
        q.eq("orgId", org._id).eq("sha256", args.sha256),
      )
      .first();
    if (duplicate) throw new ConvexError("PAPER_DUPLICATE_SOURCE");
    const open = await Promise.all(
      ["draft", "extracting"].map((status) =>
        ctx.db
          .query("paperDrafts")
          .withIndex("by_org_status", (q) =>
            q
              .eq("orgId", org._id)
              .eq("status", status as "draft" | "extracting"),
          )
          .take(30),
      ),
    );
    if (open.flat().length >= 30) throw new ConvexError("PAPER_UPLOAD_LIMIT");
    const day = paperDay(Date.now());
    const quota = await ctx.db
      .query("paperTranscriptionQuota")
      .withIndex("by_day", (q) => q.eq("day", day))
      .unique();
    const uploads = quota?.uploads ?? [];
    if (
      uploads.length >= 500 ||
      uploads.filter((a) => a.profileId === profile._id).length >= 10 ||
      uploads.filter((a) => a.orgId === org._id).length >= 20
    )
      throw new ConvexError("PAPER_UPLOAD_LIMIT");
    if (quota)
      await ctx.db.patch(quota._id, {
        uploads: [...uploads, { orgId: org._id, profileId: profile._id }],
      });
    else
      await ctx.db.insert("paperTranscriptionQuota", {
        day,
        uploads: [{ orgId: org._id, profileId: profile._id }],
        attempts: [],
      });
    const now = Date.now();
    const draftId = await ctx.db.insert("paperDrafts", {
      orgId: args.orgId,
      name: args.name,
      contentType: args.contentType,
      size: args.size,
      sha256: args.sha256,
      chunkIds: [],
      createdBy: profile._id,
      createdAt: now,
      updatedAt: now,
      expiresAt: now + PAPER_DRAFT_MS,
      revision: 1,
      status: "draft",
      extractionStatus: "none",
    });
    const chunkIds = await retainPaperSource(ctx, {
      draftId,
      orgId: org._id,
      bytes: args.bytes,
    });
    await ctx.db.patch(draftId, { chunkIds });
    const saved = await ctx.db.get("paperDrafts", draftId);
    if (!saved) throw new ConvexError("PAPER_NOT_FOUND");
    await audit(ctx, saved, profile._id, "uploaded");
    await ctx.scheduler.runAt(
      now + PAPER_DRAFT_MS,
      internal.paperDrafts.expire,
      {
        draftId,
      },
    );
    if (!quota)
      await ctx.scheduler.runAt(
        now + 2 * PAPER_DAY_MS,
        internal.paperDrafts.expireQuota,
        { day },
      );
    return { draftId, revision: 1 };
  },
});
export const upload = action({
  args: {
    expectedOrgId: v.id("orgs"),
    name: v.string(),
    contentType: v.string(),
    bytes: v.bytes(),
  },
  returns: revisionReply,
  handler: async (
    ctx,
    args,
  ): Promise<{ draftId: Id<"paperDrafts">; revision: number }> => {
    const caller = await ctx.runQuery(internal.paperDrafts.currentScope, {});
    if (caller.orgId !== args.expectedOrgId)
      throw new ConvexError("PAPER_WORKSPACE_CHANGED");
    const type = validatePaperImage(args.bytes, args.contentType);
    const name = args.name.trim();
    if (
      name.length === 0 ||
      name.length > 120 ||
      /[\u{0}-\u{1F}\u{7F}]/u.test(name) ||
      !(type === "image/png" ? /\.png$/i : /\.jpe?g$/i).test(name)
    )
      throw new ConvexError("PAPER_INVALID_FILE");
    return ctx.runMutation(internal.paperDrafts.commitUpload, {
      orgId: args.expectedOrgId,
      name,
      contentType: type,
      size: args.bytes.byteLength,
      sha256: await paperHash(args.bytes),
      bytes: args.bytes,
    });
  },
});
export const save = mutation({
  args: { ...revisionArgs, content: vPaperContent },
  returns: revisionReply,
  handler: async (ctx, args) => {
    const { row, profile } = await accessible(ctx, args.draftId, true);
    writable(row, args.expectedRevision);
    const content = paperContent(args.content);
    await ctx.db.patch(row._id, {
      reviewedContent: content,
      revision: row.revision + 1,
      updatedAt: Date.now(),
    });
    await audit(ctx, row, profile._id, "draft_saved");
    return { draftId: row._id, revision: row.revision + 1 };
  },
});
export const confirm = mutation({
  args: { ...revisionArgs, content: vPaperContent, confirmed: v.literal(true) },
  returns: v.object({
    ...revisionReply.fields,
    status: v.literal("confirmed"),
  }),
  handler: async (ctx, args) => {
    const { row, profile } = await accessible(ctx, args.draftId, true);
    const content = paperContent(args.content);
    if (!hasPaperContent(content))
      throw new ConvexError("PAPER_INVALID_CONTENT");
    if (
      row.status === "confirmed" &&
      JSON.stringify(row.reviewedContent) === JSON.stringify(content)
    )
      return {
        draftId: row._id,
        revision: row.revision,
        status: "confirmed" as const,
      };
    writable(row, args.expectedRevision);
    await ctx.db.patch(row._id, {
      reviewedContent: content,
      status: "confirmed",
      confirmedAt: Date.now(),
      confirmedBy: profile._id,
      revision: row.revision + 1,
      updatedAt: Date.now(),
    });
    await audit(ctx, row, profile._id, "confirmed");
    return {
      draftId: row._id,
      revision: row.revision + 1,
      status: "confirmed" as const,
    };
  },
});
export const discard = mutation({
  args: revisionArgs,
  returns: v.null(),
  handler: async (ctx, args) => {
    const { row, profile } = await accessible(ctx, args.draftId, true);
    writable(row, args.expectedRevision);
    await audit(ctx, row, profile._id, "discarded");
    await releasePaperSource(ctx, row);
    await ctx.db.delete(row._id);
    return null;
  },
});
const extractionState = v.union(
  v.literal("reserved"),
  v.literal("limited"),
  v.literal("busy"),
  v.literal("already_attempted"),
);
export const reserveExtraction = internalMutation({
  args: {
    ...revisionArgs,
    orgId: v.id("orgs"),
    model: v.string(),
    dailyLimit: v.number(),
    attemptId: v.string(),
  },
  returns: extractionState,
  handler: async (ctx, args) => {
    const { row, org, profile } = await accessible(ctx, args.draftId, true);
    if (org._id !== args.orgId) throw new ConvexError("PAPER_NOT_FOUND");
    if (row.status === "extracting") return "busy" as const;
    if (row.extractionStatus !== "none") return "already_attempted" as const;
    writable(row, args.expectedRevision);
    const config = paperTranscriptionEnv();
    if (config?.dailyLimit !== args.dailyLimit || config.model !== args.model)
      throw new ConvexError("PAPER_UNAVAILABLE");
    const prior = await ctx.db
      .query("paperExtractionClaims")
      .withIndex("by_org_hash", (q) =>
        q.eq("orgId", org._id).eq("sha256", row.sha256),
      )
      .first();
    if (prior) return "already_attempted" as const;
    const day = paperDay(Date.now());
    const quota = await ctx.db
      .query("paperTranscriptionQuota")
      .withIndex("by_day", (q) => q.eq("day", day))
      .unique();
    const attempts = quota?.attempts ?? [];
    if (
      attempts.length >= config.dailyLimit ||
      attempts.filter((a) => a.profileId === profile._id).length >= 3 ||
      attempts.filter((a) => a.orgId === org._id).length >= 10
    )
      return "limited" as const;
    const entry = { profileId: profile._id, orgId: org._id, draftId: row._id };
    await ctx.db.insert("paperExtractionClaims", {
      orgId: org._id,
      sha256: row.sha256,
      createdAt: Date.now(),
    });
    if (quota)
      await ctx.db.patch(quota._id, { attempts: [...attempts, entry] });
    else
      await ctx.db.insert("paperTranscriptionQuota", {
        day,
        uploads: [],
        attempts: [entry],
      });
    if (!quota)
      await ctx.scheduler.runAt(
        Date.now() + 2 * PAPER_DAY_MS,
        internal.paperDrafts.expireQuota,
        { day },
      );
    await ctx.db.patch(row._id, {
      status: "extracting",
      extractionStatus: "pending",
      extractionStartedAt: Date.now(),
      attemptId: args.attemptId,
      model: args.model,
      promptVersion: PAPER_PROMPT_VERSION,
    });
    await audit(ctx, row, profile._id, "extraction_reserved");
    await ctx.scheduler.runAfter(30_000, internal.paperDrafts.failStale, {
      draftId: row._id,
      attemptId: args.attemptId,
    });
    return "reserved" as const;
  },
});
export const readSource = internalQuery({
  args: { draftId: v.id("paperDrafts") },
  returns: v.object({
    bytes: v.bytes(),
    contentType: v.string(),
    name: v.string(),
    size: v.number(),
    sha256: v.string(),
    orgId: v.id("orgs"),
  }),
  handler: async (ctx, { draftId }) => {
    const { row } = await accessible(ctx, draftId);
    return {
      bytes: await readPaperSource(ctx, row),
      contentType: row.contentType,
      name: row.name,
      size: row.size,
      sha256: row.sha256,
      orgId: row.orgId,
    };
  },
});
export const finishExtraction = internalMutation({
  args: {
    ...revisionArgs,
    orgId: v.id("orgs"),
    attemptId: v.string(),
    content: v.optional(vPaperContent),
  },
  returns: v.number(),
  handler: async (ctx, args) => {
    const { row, profile } = await accessible(ctx, args.draftId, true);
    if (
      row.orgId !== args.orgId ||
      row.attemptId !== args.attemptId ||
      row.status !== "extracting" ||
      row.revision !== args.expectedRevision
    )
      throw new ConvexError("PAPER_REVISION_CONFLICT");
    const content =
      args.content === undefined ? undefined : paperContent(args.content);
    await ctx.db.patch(row._id, {
      status: "draft",
      extractionStatus: content ? "succeeded" : "failed",
      extractedContent: content,
      revision: row.revision + 1,
      updatedAt: Date.now(),
    });
    await audit(
      ctx,
      row,
      profile._id,
      content ? "extraction_succeeded" : "extraction_failed",
    );
    return row.revision + 1;
  },
});
const extractionReply = v.union(
  v.object({ status: v.literal("ok"), ...revisionReply.fields }),
  v.object({
    status: v.union(
      v.literal("unavailable"),
      v.literal("limited"),
      v.literal("busy"),
      v.literal("already_attempted"),
      v.literal("failed"),
    ),
    draftId: v.id("paperDrafts"),
  }),
);
export const extract = action({
  args: { ...revisionArgs, consent: v.literal(true) },
  returns: extractionReply,
  handler: async (
    ctx,
    args,
  ): Promise<
    | { status: "ok"; draftId: Id<"paperDrafts">; revision: number }
    | {
        status:
          "unavailable" | "limited" | "busy" | "already_attempted" | "failed";
        draftId: Id<"paperDrafts">;
      }
  > => {
    const caller = await ctx.runQuery(internal.paperDrafts.currentScope, {});
    const source = await ctx.runQuery(internal.paperDrafts.readSource, {
      draftId: args.draftId,
    });
    const config = paperTranscriptionEnv();
    if (!config) return { status: "unavailable", draftId: args.draftId };
    const bytes = source.bytes;
    validatePaperImage(bytes, source.contentType);
    if ((await paperHash(bytes)) !== source.sha256)
      throw new ConvexError("PAPER_INVALID_FILE");
    const clean = await stripUploadMetadata(
      new Uint8Array(bytes),
      source.contentType,
    ).arrayBuffer();
    validatePaperImage(clean, source.contentType);
    const attemptId = crypto.randomUUID();
    const state = await ctx.runMutation(
      internal.paperDrafts.reserveExtraction,
      {
        draftId: args.draftId,
        expectedRevision: args.expectedRevision,
        orgId: caller.orgId,
        model: config.model,
        dailyLimit: config.dailyLimit,
        attemptId,
      },
    );
    if (state !== "reserved") return { status: state, draftId: args.draftId };
    let content;
    try {
      const binary = Array.from(new Uint8Array(clean), (n) =>
        String.fromCodePoint(n),
      ).join("");
      content = await requestPaperTranscription(
        config,
        `data:${source.contentType};base64,${btoa(binary)}`,
      );
    } catch {
      await ctx.runMutation(internal.paperDrafts.finishExtraction, {
        draftId: args.draftId,
        expectedRevision: args.expectedRevision,
        orgId: caller.orgId,
        attemptId,
      });
      return { status: "failed", draftId: args.draftId };
    }
    const revision = await ctx.runMutation(
      internal.paperDrafts.finishExtraction,
      {
        draftId: args.draftId,
        expectedRevision: args.expectedRevision,
        orgId: caller.orgId,
        attemptId,
        content,
      },
    );
    return { status: "ok", draftId: args.draftId, revision };
  },
});
export const failStale = internalMutation({
  args: { draftId: v.id("paperDrafts"), attemptId: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const row = await ctx.db.get("paperDrafts", args.draftId);
    if (
      row?.status === "extracting" &&
      row.attemptId === args.attemptId &&
      (row.extractionStartedAt ?? 0) <= Date.now() - 30_000
    ) {
      await ctx.db.patch(row._id, {
        status: "draft",
        extractionStatus: "failed",
        revision: row.revision + 1,
      });
      await audit(ctx, row, row.createdBy, "extraction_expired");
    }
    return null;
  },
});
export const expire = internalMutation({
  args: { draftId: v.id("paperDrafts") },
  returns: v.null(),
  handler: async (ctx, { draftId }) => {
    const row = await ctx.db.get("paperDrafts", draftId);
    if (row && row.status !== "confirmed" && row.expiresAt <= Date.now()) {
      await releasePaperSource(ctx, row);
      await audit(ctx, row, row.createdBy, "expired");
      await ctx.db.delete(row._id);
    }
    return null;
  },
});
export const expireQuota = internalMutation({
  args: { day: v.string() },
  returns: v.null(),
  handler: async (ctx, { day }) => {
    if (day < paperDay(Date.now() - PAPER_DAY_MS)) {
      const row = await ctx.db
        .query("paperTranscriptionQuota")
        .withIndex("by_day", (q) => q.eq("day", day))
        .unique();
      if (row) await ctx.db.delete(row._id);
    }
    return null;
  },
});
const origins = () =>
  trustedOrigins({
    SITE_URL: process.env.SITE_URL,
    EXTRA_TRUSTED_ORIGINS: process.env.EXTRA_TRUSTED_ORIGINS,
  });
/** Authenticated bytes only. The browser creates a revocable in-memory preview. */
export const read = action({
  args: { draftId: v.id("paperDrafts") },
  returns: v.object({ bytes: v.bytes(), contentType: v.string() }),
  handler: async (
    ctx,
    args,
  ): Promise<{ bytes: ArrayBuffer; contentType: string }> => {
    const source = await ctx.runQuery(internal.paperDrafts.readSource, args);
    return { bytes: source.bytes, contentType: source.contentType };
  },
});
export const serve = httpAction(async (ctx, request) => {
  const headers = {
    ...corsHeaders(request.headers.get("Origin"), origins()),
    "Cache-Control": "private, no-store",
    "X-Content-Type-Options": "nosniff",
    "Content-Security-Policy": "sandbox; default-src 'none'",
  };
  const raw = new URL(request.url).pathname.slice("/paper-files/".length);
  let source;
  try {
    if (!(await openAuthUser(ctx)))
      return new Response("UNAVAILABLE", { status: 401, headers });
  } catch {
    return new Response("UNAVAILABLE", { status: 401, headers });
  }
  try {
    source = await ctx.runQuery(internal.paperDrafts.readSource, {
      draftId: raw as Id<"paperDrafts">,
    });
  } catch (error) {
    const status =
      error instanceof ConvexError && error.data === "PAPER_SOURCE_INTEGRITY"
        ? 503
        : 404;
    return new Response("UNAVAILABLE", { status, headers });
  }
  return new Response(source.bytes, {
    headers: {
      ...headers,
      "Content-Type": source.contentType,
      "Content-Disposition": contentDisposition(source.name),
    },
  });
});
export const preflight = httpAction((_ctx, request) =>
  Promise.resolve(preflightResponse(request.headers.get("Origin"), origins())),
);
