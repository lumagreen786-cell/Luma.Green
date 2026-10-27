import { ConvexError } from "convex/values";

import type { Doc } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";
import { requireUser } from "./access";
import { findProfile } from "./applicationAccess";
import { verifiedIndianMobile } from "./phone";

export function isCollectionOpen(booking: Doc<"bookings">) {
  return !["completed", "cancelled", "declined"].includes(booking.status);
}

export async function collectionActor(ctx: QueryCtx) {
  const user = await requireUser(ctx);
  const profile = await findProfile(ctx, user._id);
  const phone = verifiedIndianMobile(
    user.phoneNumber,
    user.phoneNumberVerified,
  );
  if (!profile || !phone) throw new ConvexError("VERIFIED_PHONE_REQUIRED");
  return { profile, phone };
}

export async function collectionByToken(ctx: QueryCtx, token: string) {
  const booking = await ctx.db
    .query("bookings")
    .withIndex("by_token", (q) => q.eq("token", token.trim()))
    .unique();
  if (!booking) throw new ConvexError("NOT_FOUND");
  return booking;
}

export async function collectionGrants(
  ctx: QueryCtx,
  booking: Doc<"bookings">,
) {
  return ctx.db
    .query("collectionInvitations")
    .withIndex("by_booking", (q) => q.eq("bookingId", booking._id))
    .take(21);
}

export function isGrantActive(
  grant: Doc<"collectionInvitations">,
  booking: Doc<"bookings">,
) {
  return (
    isCollectionOpen(booking) &&
    grant.endedAt === undefined &&
    grant.expiresAt > Date.now()
  );
}
