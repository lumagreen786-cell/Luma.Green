import { ConvexError } from "convex/values";

import type { Doc } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";

/** Cancellation releases the lot. A completed sale still requires custody transfer. */
export async function requireUnreservedLot(
  ctx: QueryCtx,
  lot: Pick<Doc<"materialLots">, "_id" | "orgId">,
) {
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
