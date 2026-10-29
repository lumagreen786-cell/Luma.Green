import { ConvexError, v } from "convex/values";

import { paperAssistanceEnv } from "../src/lib/env";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import {
  action,
  internalMutation,
  internalQuery,
  mutation,
  type MutationCtx,
  query,
  type QueryCtx,
} from "./_generated/server";
import { PAPER_DAY_MS, paperDay } from "./lib/paper";
import { ASSIST_PROMPT, assistInput, assistText } from "./lib/paperAssist";
import { requestPaperAssistance } from "./lib/paperAssistProvider";
import {
  vAssistAttempt,
  vAssistMode,
  vAssistStatus,
} from "./lib/paperAssistSchema";
import { requireOrg } from "./lib/workspace";
async function scope(ctx: QueryCtx, canWrite = false) {
  const actor = await requireOrg(ctx, undefined, canWrite ? "operate" : "read");
  if (actor.org.status !== "active")
    throw new ConvexError("PAPER_ASSIST_NOT_FOUND");
  return actor;
}
async function paper(
  ctx: QueryCtx,
  draftId: Id<"paperDrafts">,
  canWrite = false,
) {
  const actor = await scope(ctx, canWrite);
  const source = await ctx.db.get("paperDrafts", draftId);
  if (source?.orgId !== actor.org._id || source.status !== "confirmed")
    throw new ConvexError("PAPER_ASSIST_NOT_FOUND");
  return { ...actor, source };
}
async function accessible(
  ctx: QueryCtx,
  assistId: Id<"paperAssists">,
  canWrite = false,
) {
  const actor = await scope(ctx, canWrite);
  const row = await ctx.db.get("paperAssists", assistId);
  if (row?.orgId !== actor.org._id)
    throw new ConvexError("PAPER_ASSIST_NOT_FOUND");
  const source = await ctx.db.get("paperDrafts", row.paperId);
  if (
    source?.orgId !== actor.org._id ||
    source.status !== "confirmed" ||
    source.revision !== row.paperRevision ||
    source.sha256 !== row.sourceHash ||
    source.reviewedContent?.text !== row.sourceText
  )
    throw new ConvexError("PAPER_ASSIST_SOURCE_CHANGED");
  return { ...actor, row };
}
function revision(row: Doc<"paperAssists">, expected: number) {
  if (row.revision !== expected)
    throw new ConvexError("PAPER_ASSIST_REVISION_CONFLICT");
}
function editable(row: Doc<"paperAssists">, expected: number) {
  revision(row, expected);
  if (row.status === "confirmed")
    throw new ConvexError("PAPER_ASSIST_CONFIRMED");
  if (row.status === "pending") throw new ConvexError("PAPER_ASSIST_BUSY");
}
async function audit(
  ctx: MutationCtx,
  row: Doc<"paperAssists">,
  actor: Id<"profiles"> | undefined,
  event: string,
  toRevision = row.revision,
) {
  await ctx.db.insert("auditLog", {
    orgId: row.orgId,
    ...(actor !== undefined && { actorProfileId: actor }),
    action: `paper_assist.${event}`,
    entityTable: "paperAssists",
    entityId: row._id,
    createdAt: Date.now(),
    metadata: {
      revision: toRevision,
      fromRevision: row.revision,
      toRevision,
      ...(actor === undefined && { system: true }),
      mode: row.mode,
      locale: row.targetLocale,
    },
  });
}
const argsRevision = {
  assistId: v.id("paperAssists"),
  expectedRevision: v.number(),
};
const reply = v.object({
  assistId: v.id("paperAssists"),
  revision: v.number(),
});
const detail = v.object({
  id: v.id("paperAssists"),
  revision: v.number(),
  mode: vAssistMode,
  targetLocale: v.string(),
  sourceText: v.string(),
  modelText: v.optional(v.string()),
  reviewedText: v.string(),
  status: vAssistStatus,
  attemptStatus: vAssistAttempt,
});
export const availability = query({
  args: {},
  returns: v.object({ assisted: v.boolean(), canOperate: v.boolean() }),
  handler: async (ctx) => {
    const { role } = await scope(ctx);
    return {
      assisted: Boolean(paperAssistanceEnv()),
      canOperate: role !== "viewer",
    };
  },
});
export const list = query({
  args: { draftId: v.id("paperDrafts") },
  returns: v.array(detail),
  handler: async (ctx, args) => {
    const { org, source } = await paper(ctx, args.draftId);
    const rows = await ctx.db
      .query("paperAssists")
      .withIndex("by_org_paper", (q) =>
        q.eq("orgId", org._id).eq("paperId", args.draftId),
      )
      .take(10);
    if (
      rows.some(
        (row) =>
          row.paperRevision !== source.revision ||
          row.sourceHash !== source.sha256 ||
          row.sourceText !== source.reviewedContent?.text,
      )
    )
      throw new ConvexError("PAPER_ASSIST_SOURCE_CHANGED");
    return rows.map((row) => ({
      id: row._id,
      revision: row.revision,
      mode: row.mode,
      targetLocale: row.targetLocale,
      sourceText: row.sourceText,
      modelText: row.modelText,
      reviewedText: row.reviewedText,
      status: row.status,
      attemptStatus: row.attemptStatus,
    }));
  },
});
export const create = mutation({
  args: {
    draftId: v.id("paperDrafts"),
    expectedPaperRevision: v.number(),
    expectedOrgId: v.id("orgs"),
    mode: vAssistMode,
    targetLocale: v.string(),
  },
  returns: reply,
  handler: async (ctx, args) => {
    const { source, org, profile } = await paper(ctx, args.draftId, true);
    if (org._id !== args.expectedOrgId)
      throw new ConvexError("PAPER_WORKSPACE_CHANGED");
    if (source.revision !== args.expectedPaperRevision)
      throw new ConvexError("PAPER_ASSIST_SOURCE_CHANGED");
    const input = assistInput(args.mode, args.targetLocale);
    const sourceText = assistText(source.reviewedContent?.text);
    if (!sourceText.trim()) throw new ConvexError("PAPER_ASSIST_INVALID");
    const prior = await ctx.db
      .query("paperAssists")
      .withIndex("by_org_paper", (q) =>
        q.eq("orgId", org._id).eq("paperId", source._id),
      )
      .take(11);
    if (prior.length >= 10) throw new ConvexError("PAPER_ASSIST_CAPACITY");
    const assistId = await ctx.db.insert("paperAssists", {
      orgId: org._id,
      paperId: source._id,
      paperRevision: source.revision,
      sourceHash: source.sha256,
      sourceText,
      ...input,
      createdBy: profile._id,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      revision: 0,
      status: "draft",
      attemptStatus: "none",
      reviewedText: "",
    });
    const row = await ctx.db.get("paperAssists", assistId);
    if (!row) throw new ConvexError("PAPER_ASSIST_NOT_FOUND");
    await audit(ctx, row, profile._id, "created");
    return { assistId, revision: 0 };
  },
});
export const save = mutation({
  args: { ...argsRevision, text: v.string() },
  returns: reply,
  handler: async (ctx, args) => {
    const { row, profile } = await accessible(ctx, args.assistId, true);
    editable(row, args.expectedRevision);
    await ctx.db.patch(row._id, {
      reviewedText: assistText(args.text),
      revision: row.revision + 1,
      updatedAt: Date.now(),
    });
    await audit(ctx, row, profile._id, "saved", row.revision + 1);
    return { assistId: row._id, revision: row.revision + 1 };
  },
});
export const confirm = mutation({
  args: { ...argsRevision, text: v.string(), confirmed: v.literal(true) },
  returns: v.object({ ...reply.fields, status: v.literal("confirmed") }),
  handler: async (ctx, args) => {
    const { row, profile } = await accessible(ctx, args.assistId, true);
    editable(row, args.expectedRevision);
    const text = assistText(args.text);
    if (!text.trim()) throw new ConvexError("PAPER_ASSIST_INVALID");
    await ctx.db.patch(row._id, {
      reviewedText: text,
      revision: row.revision + 1,
      updatedAt: Date.now(),
      status: "confirmed",
      confirmedAt: Date.now(),
      confirmedBy: profile._id,
    });
    await audit(ctx, row, profile._id, "confirmed", row.revision + 1);
    return {
      assistId: row._id,
      revision: row.revision + 1,
      status: "confirmed" as const,
    };
  },
});
export const discard = mutation({
  args: argsRevision,
  returns: v.null(),
  handler: async (ctx, args) => {
    const { row, profile } = await accessible(ctx, args.assistId, true);
    editable(row, args.expectedRevision);
    await audit(ctx, row, profile._id, "discarded");
    await ctx.db.delete(row._id);
    return null;
  },
});
const reserveState = v.union(
  v.literal("reserved"),
  v.literal("unavailable"),
  v.literal("limited"),
  v.literal("busy"),
  v.literal("already_attempted"),
);
export const reserve = internalMutation({
  args: {
    ...argsRevision,
    expectedOrgId: v.id("orgs"),
    expectedModel: v.string(),
    expectedDailyLimit: v.number(),
    attemptId: v.string(),
  },
  returns: reserveState,
  handler: async (ctx, args) => {
    const { row, org, profile } = await accessible(ctx, args.assistId, true);
    if (org._id !== args.expectedOrgId)
      throw new ConvexError("PAPER_WORKSPACE_CHANGED");
    revision(row, args.expectedRevision);
    if (row.status === "pending") return "busy" as const;
    editable(row, args.expectedRevision);
    const config = paperAssistanceEnv();
    if (
      config?.model !== args.expectedModel ||
      config.dailyLimit !== args.expectedDailyLimit
    )
      return "unavailable" as const;
    const claim = await ctx.db
      .query("paperAssistClaims")
      .withIndex("by_tuple", (q) =>
        q
          .eq("orgId", org._id)
          .eq("paperId", row.paperId)
          .eq("mode", row.mode)
          .eq("targetLocale", row.targetLocale),
      )
      .first();
    if (claim || row.attemptStatus !== "none")
      return "already_attempted" as const;
    const day = paperDay(Date.now());
    const quota = await ctx.db
      .query("paperAssistQuota")
      .withIndex("by_day", (q) => q.eq("day", day))
      .unique();
    const attempts = quota?.attempts ?? [];
    if (
      attempts.length >= config.dailyLimit ||
      attempts.filter((a) => a.profileId === profile._id).length >= 3 ||
      attempts.filter((a) => a.orgId === org._id).length >= 10
    )
      return "limited" as const;
    await ctx.db.insert("paperAssistClaims", {
      orgId: org._id,
      paperId: row.paperId,
      mode: row.mode,
      targetLocale: row.targetLocale,
      createdAt: Date.now(),
    });
    const entry = { profileId: profile._id, orgId: org._id };
    if (quota)
      await ctx.db.patch(quota._id, { attempts: [...attempts, entry] });
    else {
      await ctx.db.insert("paperAssistQuota", { day, attempts: [entry] });
      await ctx.scheduler.runAfter(
        2 * PAPER_DAY_MS,
        internal.paperAssist.expireQuota,
        { day },
      );
    }
    await ctx.db.patch(row._id, {
      status: "pending",
      attemptStatus: "pending",
      attemptId: args.attemptId,
      startedAt: Date.now(),
      model: config.model,
      promptVersion: ASSIST_PROMPT,
    });
    await audit(ctx, row, profile._id, "reserved");
    await ctx.scheduler.runAfter(30_000, internal.paperAssist.failStale, {
      assistId: row._id,
      attemptId: args.attemptId,
    });
    return "reserved" as const;
  },
});
export const input = internalQuery({
  args: { assistId: v.id("paperAssists") },
  returns: v.object({
    orgId: v.id("orgs"),
    sourceText: v.string(),
    mode: vAssistMode,
    targetLocale: v.string(),
    revision: v.number(),
  }),
  handler: async (ctx, args) => {
    const { row, org } = await accessible(ctx, args.assistId, true);
    return {
      orgId: org._id,
      sourceText: row.sourceText,
      mode: row.mode,
      targetLocale: row.targetLocale,
      revision: row.revision,
    };
  },
});
export const finish = internalMutation({
  args: {
    ...argsRevision,
    expectedOrgId: v.id("orgs"),
    attemptId: v.string(),
    text: v.optional(v.string()),
  },
  returns: reply,
  handler: async (ctx, args) => {
    const { row, org, profile } = await accessible(ctx, args.assistId, true);
    if (org._id !== args.expectedOrgId)
      throw new ConvexError("PAPER_WORKSPACE_CHANGED");
    revision(row, args.expectedRevision);
    if (row.status !== "pending" || row.attemptId !== args.attemptId)
      throw new ConvexError("PAPER_ASSIST_REVISION_CONFLICT");
    const text = args.text === undefined ? undefined : assistText(args.text);
    await ctx.db.patch(row._id, {
      status: "draft",
      attemptStatus: text === undefined ? "failed" : "succeeded",
      modelText: text,
      revision: row.revision + 1,
      updatedAt: Date.now(),
    });
    await audit(
      ctx,
      row,
      profile._id,
      text === undefined ? "failed" : "generated",
      row.revision + 1,
    );
    return { assistId: row._id, revision: row.revision + 1 };
  },
});
const resultStatus = v.union(
  v.literal("unavailable"),
  v.literal("limited"),
  v.literal("busy"),
  v.literal("already_attempted"),
  v.literal("failed"),
);
export const generate = action({
  args: { ...argsRevision, consent: v.literal(true) },
  returns: v.union(
    v.object({ status: v.literal("ok"), ...reply.fields }),
    v.object({ status: resultStatus, assistId: v.id("paperAssists") }),
  ),
  handler: async (
    ctx,
    args,
  ): Promise<
    | { status: "ok"; assistId: Id<"paperAssists">; revision: number }
    | {
        status:
          "unavailable" | "limited" | "busy" | "already_attempted" | "failed";
        assistId: Id<"paperAssists">;
      }
  > => {
    const source = await ctx.runQuery(internal.paperAssist.input, {
      assistId: args.assistId,
    });
    const config = paperAssistanceEnv();
    if (!config) return { status: "unavailable", assistId: args.assistId };
    const attemptId = crypto.randomUUID();
    const state = await ctx.runMutation(internal.paperAssist.reserve, {
      assistId: args.assistId,
      expectedRevision: args.expectedRevision,
      expectedOrgId: source.orgId,
      expectedModel: config.model,
      expectedDailyLimit: config.dailyLimit,
      attemptId,
    });
    if (state !== "reserved") return { status: state, assistId: args.assistId };
    let text: string | undefined;
    try {
      text = await requestPaperAssistance(
        config,
        source.sourceText,
        source.mode,
        assistInput(source.mode, source.targetLocale).targetLocale,
      );
    } catch {
      /* Provider errors contain private content; preserve manual path without exposing them. */
    }
    const saved = await ctx.runMutation(internal.paperAssist.finish, {
      assistId: args.assistId,
      expectedRevision: args.expectedRevision,
      expectedOrgId: source.orgId,
      attemptId,
      ...(text !== undefined && { text }),
    });
    return text === undefined
      ? { status: "failed", assistId: args.assistId }
      : { status: "ok", ...saved };
  },
});
export const failStale = internalMutation({
  args: { assistId: v.id("paperAssists"), attemptId: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const row = await ctx.db.get("paperAssists", args.assistId);
    if (
      row?.status === "pending" &&
      row.attemptId === args.attemptId &&
      (row.startedAt ?? 0) + 30_000 <= Date.now()
    ) {
      await ctx.db.patch(row._id, {
        status: "draft",
        attemptStatus: "failed",
        revision: row.revision + 1,
        updatedAt: Date.now(),
      });
      await audit(ctx, row, undefined, "timed_out", row.revision + 1);
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
        .query("paperAssistQuota")
        .withIndex("by_day", (q) => q.eq("day", day))
        .unique();
      if (row) await ctx.db.delete(row._id);
    }
    return null;
  },
});
