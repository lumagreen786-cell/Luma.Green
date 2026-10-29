import {
  paginationOptsValidator,
  paginationResultValidator,
} from "convex/server";
import { ConvexError, v } from "convex/values";

import type { Doc, Id } from "./_generated/dataModel";
import {
  mutation,
  type MutationCtx,
  query,
  type QueryCtx,
} from "./_generated/server";
import {
  cleanEvidenceText,
  vEvidenceIssuerKind,
  vEvidenceKind,
} from "./lib/commercialEvidence";
import { requireOrg } from "./lib/workspace";

/**
 * User-reported references to external documents. A reference is not a
 * validated invoice, e-way bill, consent, or EPR certificate. Luma neither
 * creates the external document nor records payment through this API.
 */

const vEvidenceView = v.object({
  id: v.id("commercialEvidence"),
  orgId: v.id("orgs"),
  tradeId: v.optional(v.id("trades")),
  kind: vEvidenceKind,
  reference: v.string(),
  issuerKind: vEvidenceIssuerKind,
  issuerName: v.string(),
  issuedAt: v.optional(v.number()),
  supersedesId: v.optional(v.id("commercialEvidence")),
  recordedByProfileId: v.id("profiles"),
  version: v.number(),
  createdAt: v.number(),
  verificationStatus: v.literal("reported_unverified"),
});
const PAGE_SIZE = 100;

function pageSize(requested: number): number {
  if (!Number.isSafeInteger(requested) || requested < 1) {
    throw new ConvexError("INVALID_PAGE_SIZE");
  }
  return Math.min(requested, PAGE_SIZE);
}

function toView(row: Doc<"commercialEvidence">) {
  return {
    id: row._id,
    orgId: row.orgId,
    tradeId: row.tradeId,
    kind: row.kind,
    reference: row.reference,
    issuerKind: row.issuerKind,
    issuerName: row.issuerName,
    issuedAt: row.issuedAt,
    supersedesId: row.supersedesId,
    recordedByProfileId: row.recordedByProfileId,
    version: row.version,
    createdAt: row.createdAt,
    verificationStatus: "reported_unverified" as const,
  };
}

function isTradeParty(trade: Doc<"trades">, orgId: Id<"orgs">): boolean {
  return trade.buyerOrgId === orgId || trade.sellerOrgId === orgId;
}

async function requireTradeParticipant(
  ctx: QueryCtx,
  tradeId: Id<"trades">,
  orgId: Id<"orgs">,
): Promise<Doc<"trades">> {
  const trade = await ctx.db.get("trades", tradeId);
  if (!trade || !isTradeParty(trade, orgId)) {
    throw new ConvexError("TRADE_NOT_FOUND");
  }
  return trade;
}

async function issuerNameFor(
  ctx: QueryCtx,
  trade: Doc<"trades"> | null,
  issuerKind: Doc<"commercialEvidence">["issuerKind"],
  suppliedName: string | undefined,
): Promise<string> {
  if (issuerKind === "trade_seller" || issuerKind === "trade_buyer") {
    if (!trade || suppliedName !== undefined) {
      throw new ConvexError("INVALID_ISSUER");
    }
    const issuerId =
      issuerKind === "trade_seller" ? trade.sellerOrgId : trade.buyerOrgId;
    const issuer = await ctx.db.get("orgs", issuerId);
    if (!issuer) throw new ConvexError("INVALID_ISSUER");
    return issuer.name;
  }
  const name = cleanEvidenceText(suppliedName ?? "", 120);
  if (!name) throw new ConvexError("INVALID_ISSUER");
  return name;
}

function checkIssuedAt(issuedAt: number | undefined): void {
  if (
    issuedAt !== undefined &&
    (!Number.isSafeInteger(issuedAt) || issuedAt < 0 || issuedAt > Date.now())
  ) {
    throw new ConvexError("INVALID_ISSUE_DATE");
  }
}

async function checkCorrection(
  ctx: MutationCtx,
  supersedesId: Id<"commercialEvidence"> | undefined,
  orgId: Id<"orgs">,
  tradeId: Id<"trades"> | undefined,
  kind: Doc<"commercialEvidence">["kind"],
): Promise<void> {
  if (!supersedesId) return;
  const previous = await ctx.db.get("commercialEvidence", supersedesId);
  if (
    previous?.orgId !== orgId ||
    previous.tradeId !== tradeId ||
    previous.kind !== kind
  ) {
    throw new ConvexError("INVALID_CORRECTION");
  }
  const correction = await ctx.db
    .query("commercialEvidence")
    .withIndex("by_supersedes", (q) => q.eq("supersedesId", supersedesId))
    .first();
  if (correction) throw new ConvexError("ALREADY_CORRECTED");
}

export const recordExternal = mutation({
  args: {
    tradeId: v.optional(v.id("trades")),
    kind: vEvidenceKind,
    reference: v.string(),
    issuerKind: vEvidenceIssuerKind,
    /** Required for external issuers; trade-party names come from the trade. */
    issuerName: v.optional(v.string()),
    issuedAt: v.optional(v.number()),
    supersedesId: v.optional(v.id("commercialEvidence")),
  },
  returns: v.id("commercialEvidence"),
  handler: async (ctx, args) => {
    const { org, profile } = await requireOrg(ctx);
    const trade = args.tradeId
      ? await requireTradeParticipant(ctx, args.tradeId, org._id)
      : null;
    const reference = cleanEvidenceText(args.reference, 120);
    if (!reference) throw new ConvexError("INVALID_REFERENCE");

    const issuerName = await issuerNameFor(
      ctx,
      trade,
      args.issuerKind,
      args.issuerName,
    );
    checkIssuedAt(args.issuedAt);
    await checkCorrection(
      ctx,
      args.supersedesId,
      org._id,
      args.tradeId,
      args.kind,
    );

    const createdAt = Date.now();
    const id = await ctx.db.insert("commercialEvidence", {
      orgId: org._id,
      tradeId: args.tradeId,
      kind: args.kind,
      reference,
      issuerKind: args.issuerKind,
      issuerName,
      issuedAt: args.issuedAt,
      supersedesId: args.supersedesId,
      recordedByProfileId: profile._id,
      version: 1,
      createdAt,
    });
    await ctx.db.insert("auditLog", {
      orgId: org._id,
      actorProfileId: profile._id,
      action: args.supersedesId
        ? "commercial_evidence.corrected"
        : "commercial_evidence.recorded",
      entityTable: "commercialEvidence",
      entityId: id,
      metadata: {
        kind: args.kind,
        tradeId: args.tradeId,
        supersedesId: args.supersedesId,
      },
      createdAt,
    });
    return id;
  },
});

/** The two trade parties may read references linked to that trade. */
export const forTrade = query({
  args: {
    tradeId: v.id("trades"),
    paginationOpts: paginationOptsValidator,
  },
  returns: paginationResultValidator(vEvidenceView),
  handler: async (ctx, args) => {
    const { org } = await requireOrg(ctx, undefined, "read");
    await requireTradeParticipant(ctx, args.tradeId, org._id);
    const result = await ctx.db
      .query("commercialEvidence")
      .withIndex("by_trade_created", (q) => q.eq("tradeId", args.tradeId))
      .order("desc")
      .paginate({
        ...args.paginationOpts,
        numItems: pageSize(args.paginationOpts.numItems),
        maximumRowsRead: PAGE_SIZE,
      });
    return { ...result, page: result.page.map((row) => toView(row)) };
  },
});

/** An organisation can read only the references its own people reported. */
export const mine = query({
  args: {
    paginationOpts: paginationOptsValidator,
    expectedOrgId: v.optional(v.id("orgs")),
  },
  returns: paginationResultValidator(vEvidenceView),
  handler: async (ctx, args) => {
    const { org } = await requireOrg(ctx, undefined, "read");
    if (args.expectedOrgId !== undefined && args.expectedOrgId !== org._id)
      throw new ConvexError("EVIDENCE_SCOPE_CHANGED");
    const result = await ctx.db
      .query("commercialEvidence")
      .withIndex("by_org_created", (q) => q.eq("orgId", org._id))
      .order("desc")
      .paginate({
        ...args.paginationOpts,
        numItems: pageSize(args.paginationOpts.numItems),
        maximumRowsRead: PAGE_SIZE,
      });
    return { ...result, page: result.page.map((row) => toView(row)) };
  },
});
