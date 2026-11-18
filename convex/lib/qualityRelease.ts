import { ConvexError } from "convex/values";

import type { Doc, Id } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";

async function isEffectiveInspection(
  ctx: QueryCtx,
  inspection: Doc<"lotInspections">,
) {
  if (inspection.supersedesInspectionId) {
    const approval = await ctx.db
      .query("lotInspectionApprovals")
      .withIndex("by_inspection", (q) => q.eq("inspectionId", inspection._id))
      .unique();
    if (!approval) return false;
  }
  const replacement = await ctx.db
    .query("lotInspectionApprovals")
    .withIndex("by_superseded", (q) =>
      q.eq("supersededInspectionId", inspection._id),
    )
    .first();
  return !replacement;
}

export async function isCurrentAcceptedInspection(
  ctx: QueryCtx,
  inspection: Doc<"lotInspections">,
) {
  if (
    inspection.decision !== "accepted" ||
    inspection.results.length === 0 ||
    !inspection.specificationReference.trim() ||
    !inspection.specificationVersion.trim() ||
    !inspection.sampleMethod.trim() ||
    !(await isEffectiveInspection(ctx, inspection))
  )
    return false;
  for (const decision of ["rejected", "conditional"] as const) {
    const holds = await ctx.db
      .query("lotInspections")
      .withIndex("by_lot_org_specification", (q) =>
        q
          .eq("lotId", inspection.lotId)
          .eq("orgId", inspection.orgId)
          .eq("specificationReference", inspection.specificationReference)
          .eq("specificationVersion", inspection.specificationVersion)
          .eq("buyerOrgId", inspection.buyerOrgId)
          .eq("decision", decision),
      )
      .take(101);
    if (holds.length > 100) return false;
    for (const result of holds) {
      // Another passing result cannot clear an unresolved failure in this scope.
      if (await isEffectiveInspection(ctx, result)) return false;
    }
  }
  return true;
}

/** Transformed evidence cannot proceed until its holder records accepted tests. */
export async function hasQualityRelease(
  ctx: QueryCtx,
  lot: Doc<"materialLots">,
  inspectionId?: Id<"lotInspections">,
) {
  const inspections = inspectionId
    ? [await ctx.db.get("lotInspections", inspectionId)]
    : await ctx.db
        .query("lotInspections")
        .withIndex("by_lot_created", (q) => q.eq("lotId", lot._id))
        .order("desc")
        .take(100);
  let hasHolderInspection = false;
  for (const inspection of inspections) {
    if (inspection?.lotId !== lot._id || inspection.orgId !== lot.orgId)
      continue;
    hasHolderInspection = true;
    if (await isCurrentAcceptedInspection(ctx, inspection)) return true;
  }
  return (
    !inspectionId && lot.sourceKind !== "transformed" && !hasHolderInspection
  );
}

export async function requireQualityRelease(
  ctx: QueryCtx,
  lot: Doc<"materialLots">,
  inspectionId?: Id<"lotInspections">,
) {
  if (!(await hasQualityRelease(ctx, lot, inspectionId)))
    throw new ConvexError("QUALITY_RELEASE_REQUIRED");
}

/** Recheck the linked process evidence before provider-authorised movement. */
export async function requireTradeQualityRelease(
  ctx: QueryCtx,
  trade: Doc<"trades">,
) {
  const listing = await ctx.db.get("listings", trade.listingId);
  const lotId = trade.specification?.lotId ?? listing?.specification?.lotId;
  if (!lotId) return;
  const lot = await ctx.db.get("materialLots", lotId);
  if (lot?.orgId !== trade.sellerOrgId)
    throw new ConvexError("LOT_NOT_ELIGIBLE");
  await requireQualityRelease(ctx, lot);
}
