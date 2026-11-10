import { ConvexError } from "convex/values";

import type { Doc, Id } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";
import { isProfileOpen } from "./accountClosure";
import { indiaToday } from "./onboarding";

export const APARTMENT_PARTNERS = [
  "society_partner",
  "community_champion",
] as const;

export async function apartmentPartner(
  ctx: QueryCtx,
  partnerId: Id<"stakeholderAccounts">,
) {
  const partner = await ctx.db.get("stakeholderAccounts", partnerId);
  const kind = partner?.participantType;
  return partner?.kind === "participant_applicant" &&
    partner.status === "approved" &&
    (kind === "society_partner" || kind === "community_champion") &&
    (await isProfileOpen(ctx, partner.ownerProfileId))
    ? kind
    : null;
}

export async function eligibleApartmentRoute(
  ctx: QueryCtx,
  route: Doc<"apartmentCollectionRoutes">,
  date = indiaToday(),
) {
  if (
    !route.active ||
    route.validUntil < indiaToday() ||
    route.validUntil < date
  )
    return null;
  const org = await ctx.db.get("orgs", route.orgId);
  if (
    org?.kind !== "kabadiwala" ||
    org.status !== "active" ||
    !org.offersPickup ||
    org.city !== route.city
  )
    return null;
  const partner = await apartmentPartner(ctx, route.partnerId);
  return partner ? { org, kind: partner } : null;
}

export async function requireApartmentCollection(
  ctx: QueryCtx,
  routeId: Id<"apartmentCollectionRoutes"> | undefined,
  orgId: Id<"orgs">,
  date: string,
) {
  if (!routeId) return;
  const route = await ctx.db.get("apartmentCollectionRoutes", routeId);
  if (
    route?.orgId !== orgId ||
    !(await eligibleApartmentRoute(ctx, route, date))
  )
    throw new ConvexError("APARTMENT_ROUTE_UNAVAILABLE");
}
