import { ConvexError, v } from "convex/values";

import type { Doc } from "./_generated/dataModel";
import { mutation, type MutationCtx, query } from "./_generated/server";
import { positiveGrams, requiredLabel } from "./lib/lotEvidence";
import { activeTradeParty, sourceEligibility } from "./lib/returnClaims";
import { claimFields } from "./lib/returnClaimsSchema";
import { requireOrg } from "./lib/workspace";

async function withdraw(
  ctx: MutationCtx,
  row: Doc<"schemeAllocations">,
  actorProfileId: Doc<"profiles">["_id"],
  reason: string,
) {
  if (row.status === "withdrawn") return;
  await ctx.db.patch("schemeAllocations", row._id, {
    status: "withdrawn",
    withdrawalReason: reason,
    withdrawnAt: Date.now(),
  });
  await ctx.db.insert("auditLog", {
    orgId: row.orgId,
    actorProfileId,
    action: "scheme_allocation.withdrawn",
    entityTable: "schemeAllocations",
    entityId: row._id,
    metadata: { reason, sourceTradeId: row.sourceTradeId },
    createdAt: Date.now(),
  });
}
export const declare = mutation({
  args: {
    sourceTradeId: v.id("trades"),
    schemeReference: v.string(),
    issuerReference: v.string(),
    operationReference: v.string(),
    grams: v.number(),
  },
  returns: v.id("schemeAllocations"),
  handler: async (ctx, args) => {
    const { org, profile } = await requireOrg(ctx, undefined, "manage");
    const trade = await activeTradeParty(ctx, args.sourceTradeId, org._id);
    if (trade.buyerOrgId !== org._id) throw new ConvexError("SOURCE_NOT_OWNED");
    const problem = await sourceEligibility(ctx, trade);
    if (problem) throw new ConvexError(problem);
    const schemeReference = requiredLabel(args.schemeReference)
        .normalize("NFKC")
        .toUpperCase(),
      issuerReference = requiredLabel(args.issuerReference),
      operationReference = requiredLabel(args.operationReference),
      grams = positiveGrams(args.grams);
    const previous = await ctx.db
      .query("schemeAllocations")
      .withIndex("by_org_operation", (q) =>
        q.eq("orgId", org._id).eq("operationReference", operationReference),
      )
      .unique();
    if (previous) {
      if (
        previous.sourceTradeId !== trade._id ||
        previous.schemeReference !== schemeReference ||
        previous.issuerReference !== issuerReference ||
        previous.grams !== grams
      )
        throw new ConvexError("ALLOCATION_REFERENCE_CONFLICT");
      return previous._id;
    }
    const rows = await ctx.db
      .query("schemeAllocations")
      .withIndex("by_source_scheme", (q) =>
        q.eq("sourceTradeId", trade._id).eq("schemeReference", schemeReference),
      )
      .take(101);
    if (rows.length > 100) throw new ConvexError("TOO_MANY_SOURCE_CLAIMS");
    let allocated = grams;
    for (const row of rows)
      if (row.status === "declared") allocated += row.grams;
    if (!Number.isSafeInteger(allocated) || allocated > trade.grams)
      throw new ConvexError("SOURCE_QUANTITY_ALREADY_ALLOCATED");
    const id = await ctx.db.insert("schemeAllocations", {
      orgId: org._id,
      sourceTradeId: trade._id,
      schemeReference,
      issuerReference,
      operationReference,
      grams,
      evidenceScope: "reported_unverified",
      status: "declared",
      actorProfileId: profile._id,
      createdAt: Date.now(),
    });
    await ctx.db.insert("auditLog", {
      orgId: org._id,
      actorProfileId: profile._id,
      action: "scheme_allocation.declared",
      entityTable: "schemeAllocations",
      entityId: id,
      metadata: {
        sourceTradeId: trade._id,
        grams,
        schemeReference,
        evidenceScope: "reported_unverified",
      },
      createdAt: Date.now(),
    });
    return id;
  },
});
export const withdrawDeclaration = mutation({
  args: { allocationId: v.id("schemeAllocations"), reason: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { org, profile } = await requireOrg(ctx, undefined, "manage");
    const row = await ctx.db.get("schemeAllocations", args.allocationId);
    if (row?.orgId !== org._id) throw new ConvexError("ALLOCATION_NOT_FOUND");
    await withdraw(ctx, row, profile._id, requiredLabel(args.reason));
    return null;
  },
});
export const validate = mutation({
  args: { allocationId: v.id("schemeAllocations") },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const { org, profile } = await requireOrg(ctx, undefined, "manage");
    const row = await ctx.db.get("schemeAllocations", args.allocationId);
    if (row?.orgId !== org._id) throw new ConvexError("ALLOCATION_NOT_FOUND");
    if (row.status === "withdrawn") return false;
    const trade = await ctx.db.get("trades", row.sourceTradeId);
    const reason = trade
      ? await sourceEligibility(ctx, trade)
      : "SOURCE_NOT_FOUND";
    if (reason) {
      await withdraw(ctx, row, profile._id, reason);
      return false;
    }
    return true;
  },
});
export const mine = query({
  args: {},
  returns: v.object({
    rows: v.array(
      v.object({
        id: v.id("schemeAllocations"),
        ...claimFields,
        effectiveStatus: v.union(v.literal("declared"), v.literal("withdrawn")),
        invalidReason: v.union(v.string(), v.null()),
      }),
    ),
    hasMore: v.boolean(),
  }),
  handler: async (ctx) => {
    const { org } = await requireOrg(ctx, undefined, "read");
    const rows = await ctx.db
      .query("schemeAllocations")
      .withIndex("by_org_created", (q) => q.eq("orgId", org._id))
      .order("desc")
      .take(51);
    return {
      rows: await Promise.all(
        rows.slice(0, 50).map(async (row) => {
          const trade = await ctx.db.get("trades", row.sourceTradeId);
          let invalidReason: string | null = null;
          if (row.status !== "withdrawn")
            invalidReason = trade
              ? await sourceEligibility(ctx, trade)
              : "SOURCE_NOT_FOUND";
          const { _id, _creationTime, ...fields } = row;
          return {
            id: _id,
            ...fields,
            effectiveStatus: invalidReason
              ? ("withdrawn" as const)
              : row.status,
            invalidReason,
          };
        }),
      ),
      hasMore: rows.length > 50,
    };
  },
});
