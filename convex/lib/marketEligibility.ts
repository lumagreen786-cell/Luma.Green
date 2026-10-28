import { ConvexError } from "convex/values";

import type { Doc, Id } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";
import { isOrdinaryMaterial } from "./materialEligibility";
/** A past listing never overrides current material restrictions or buyer scope. */
export async function requireOrdinaryTradeMaterial(
  ctx: QueryCtx,
  listing: Doc<"listings">,
  buyerId: Id<"orgs">,
) {
  const material = await ctx.db
    .query("materials")
    .withIndex("by_code", (q) => q.eq("code", listing.materialCode))
    .unique();
  const seller = await ctx.db.get("orgs", listing.orgId);
  const buyer = await ctx.db.get("orgs", buyerId);
  if (
    !material ||
    !isOrdinaryMaterial(material) ||
    seller?.status !== "active" ||
    buyer?.status !== "active" ||
    !seller.families.includes(material.family) ||
    !buyer.families.includes(material.family)
  )
    throw new ConvexError("MATERIAL_NOT_ELIGIBLE");
}

/** Rechecked at request and acceptance; a past approval is not current access. */
export async function requireEligibleByproduct(
  ctx: QueryCtx,
  listing: Doc<"listings">,
  seller: Doc<"orgs"> | null,
  buyer: Doc<"orgs"> | null,
) {
  const material = await ctx.db
    .query("materials")
    .withIndex("by_code", (q) => q.eq("code", listing.materialCode))
    .unique();
  if (
    seller?.status !== "active" ||
    seller.kind !== "manufacturer" ||
    seller.kind !== listing.sellerKind ||
    buyer?.status !== "active" ||
    !isOrdinaryMaterial(material) ||
    material.stage !== "scrap" ||
    material.byproductEligibility?.hazardStatus !== "non_hazardous" ||
    !seller.families.includes(material.family) ||
    !buyer.families.includes(material.family)
  )
    throw new ConvexError("BYPRODUCT_NOT_ELIGIBLE");
}

export async function requireCurrentTradeMaterial(
  ctx: QueryCtx,
  trade: Doc<"trades">,
) {
  const listing = await ctx.db.get("listings", trade.listingId);
  if (
    listing?.orgId !== trade.sellerOrgId ||
    listing.materialCode !== trade.materialCode
  )
    throw new ConvexError("MATERIAL_NOT_ELIGIBLE");
  if (listing.origin === "manufacturer_byproduct") {
    await requireEligibleByproduct(
      ctx,
      listing,
      await ctx.db.get("orgs", trade.sellerOrgId),
      await ctx.db.get("orgs", trade.buyerOrgId),
    );
  } else await requireOrdinaryTradeMaterial(ctx, listing, trade.buyerOrgId);
}
