import type { Id } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";
import { isOrdinaryMaterial } from "./materialEligibility";
import { indiaToday } from "./onboarding";

/** Only the latest explicit admin review can open ordinary custody at this site. */
export async function currentOrdinaryCustodyReview(
  ctx: QueryCtx,
  args: {
    facilityId: Id<"industrialFacilities">;
    orgId: Id<"orgs">;
    materialCode: string;
  },
) {
  const facility = await ctx.db.get("industrialFacilities", args.facilityId);
  if (facility?.orgId !== args.orgId) return null;
  const review = await ctx.db
    .query("facilityScopeReviews")
    .withIndex("by_facility_created", (q) =>
      q.eq("facilityId", args.facilityId),
    )
    .order("desc")
    .first();
  const today = indiaToday();
  if (
    review?.orgId !== args.orgId ||
    review.decision !== "approved" ||
    review.ordinaryTradeCustody !== true ||
    review.validUntil < today ||
    review.facilityRevision !== (facility.revision ?? 0) ||
    review.facilityUpdatedAt !== facility.updatedAt ||
    !review.materialCodes.includes(args.materialCode)
  )
    return null;

  const registration = await ctx.db.get(
    "facilityRegistrations",
    review.registrationId,
  );
  if (
    registration?.kind !== "consent_to_operate" ||
    registration.orgId !== args.orgId ||
    registration.facilityId !== args.facilityId ||
    registration.issuedAt > today ||
    registration.validUntil < review.validUntil
  )
    return null;
  const successor = await ctx.db
    .query("facilityRegistrations")
    .withIndex("by_supersedes", (q) =>
      q.eq("supersedesId", review.registrationId),
    )
    .first();
  if (successor) return null;
  const org = await ctx.db.get("orgs", args.orgId);
  const material = await ctx.db
    .query("materials")
    .withIndex("by_code", (q) => q.eq("code", args.materialCode))
    .unique();
  return org?.status !== "active" ||
    !isOrdinaryMaterial(material) ||
    !org.families.includes(material.family)
    ? null
    : review;
}
