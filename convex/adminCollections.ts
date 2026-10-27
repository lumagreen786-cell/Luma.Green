import { ConvexError, v } from "convex/values";

import { mutation, query } from "./_generated/server";
import { requireAdmin } from "./lib/access";
import { reassignCollection } from "./lib/dispatch";
import { PILOT_CITY } from "./lib/households";
import { currentProfile } from "./lib/workspace";
export const board = query({
  args: {},
  returns: v.object({
    bookings: v.array(v.object({ id: v.id("bookings"), label: v.string() })),
    shops: v.array(v.object({ id: v.id("orgs"), label: v.string() })),
  }),
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const requests = [];
    for (const status of ["requested", "accepted"] as const) {
      const rows = await ctx.db
        .query("bookings")
        .withIndex("by_status_createdAt", (q) => q.eq("status", status))
        .order("desc")
        .take(50);
      requests.push(...rows.filter((row) => row.mode === "pickup"));
    }
    const shops = await ctx.db
      .query("orgs")
      .withIndex("by_kind_city", (q) =>
        q
          .eq("kind", "kabadiwala")
          .eq("city", PILOT_CITY)
          .eq("status", "active"),
      )
      .take(100);
    return {
      bookings: requests.map((row) => ({
        id: row._id,
        label: `${row.slotDate} · ${row.slotWindow} · ${row.token.slice(-4)}`,
      })),
      shops: shops
        .filter((row) => row.offersPickup)
        .map((row) => ({ id: row._id, label: `${row.name} · ${row.area}` })),
    };
  },
});
export const reassign = mutation({
  args: {
    bookingId: v.id("bookings"),
    orgId: v.id("orgs"),
    reason: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const profile = await currentProfile(ctx);
    if (!profile) throw new ConvexError("NO_PROFILE");
    const reason = args.reason.trim();
    if (reason.length < 5 || reason.length > 500)
      throw new ConvexError("INVALID_REASON");
    const booking = await ctx.db.get("bookings", args.bookingId),
      org = await ctx.db.get("orgs", args.orgId);
    if (!booking || !org) throw new ConvexError("NOT_FOUND");
    await reassignCollection(
      ctx,
      booking,
      org,
      profile._id,
      reason,
      Date.now(),
    );
    return null;
  },
});
