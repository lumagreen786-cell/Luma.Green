import { ConvexError } from "convex/values";

import type { Doc, Id } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";
import { isListingOfferCurrent } from "./rateValidity";

/** Current offers hold the lot; a completed sale still requires custody transfer. */
export async function requireUnreservedLot(
  ctx: QueryCtx,
  lot: Pick<Doc<"materialLots">, "_id" | "orgId">,
  acceptingListingId?: Id<"listings">,
) {
  const offers = await ctx.db
    .query("listings")
    .withIndex("by_lot_org_status", (q) =>
      q
        .eq("specification.lotId", lot._id)
        .eq("orgId", lot.orgId)
        .eq("status", "open"),
    )
    .take(101);
  if (offers.length > 100) throw new ConvexError("TOO_MANY_LOT_OFFERS");
  if (
    offers.some(
      (offer) =>
        offer._id !== acceptingListingId && isListingOfferCurrent(offer),
    )
  )
    throw new ConvexError("LOT_RESERVED");
  const reservations = await Promise.all(
    (["accepted", "paid_to_escrow", "dispatched", "completed"] as const).map(
      (status) =>
        ctx.db
          .query("trades")
          .withIndex("by_lot_seller_status", (q) =>
            q
              .eq("specification.lotId", lot._id)
              .eq("sellerOrgId", lot.orgId)
              .eq("status", status),
          )
          .first(),
    ),
  );
  if (reservations.some((trade) => trade !== null))
    throw new ConvexError("LOT_RESERVED");
}
