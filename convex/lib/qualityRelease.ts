import { ConvexError } from "convex/values";

import type { Doc, Id } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";

export async function isCurrentAcceptedInspection(
  ctx: QueryCtx,
  inspection: Doc<"lotInspections">,
) {
  if (
    inspection.decision !== "accepted" ||
    inspection.results.length === 0 ||
    !inspection.specificationReference.trim() ||
    !inspection.specificationVersion.trim() ||
    !inspection.sampleMethod.trim()
  )
    return false;
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

/** Transformed evidence cannot proceed until its holder records accepted tests. */
export async function hasQualityRelease(
  ctx: QueryCtx,
  lot: Doc<"materialLots">,
  inspectionId?: Id<"lotInspections">,
) {
  if (!inspectionId && lot.sourceKind !== "transformed") return true;
  const inspections = inspectionId
    ? [await ctx.db.get("lotInspections", inspectionId)]
    : await ctx.db
        .query("lotInspections")
        .withIndex("by_lot_created", (q) => q.eq("lotId", lot._id))
        .order("desc")
        .take(100);
  for (const inspection of inspections) {
    if (
      inspection?.lotId === lot._id &&
      inspection.orgId === lot.orgId &&
      (await isCurrentAcceptedInspection(ctx, inspection))
    )
      return true;
  }
  return false;
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
