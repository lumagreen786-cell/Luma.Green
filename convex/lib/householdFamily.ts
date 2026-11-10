import type { Doc, Id } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";
import { openAuthUser } from "./access";
import { isPhoneGrantCurrent, isProfileOpen } from "./accountClosure";
import { findProfile } from "./applicationAccess";
import { verifiedIndianMobile } from "./phone";
import { smsPhoneHash } from "./smsLimits";

export const MAX_FAMILY_GRANTS = 10;

export async function familyActor(ctx: QueryCtx) {
  const user = await openAuthUser(ctx);
  if (!user) return null;
  const phone = verifiedIndianMobile(
    user.phoneNumber,
    user.phoneNumberVerified,
  );
  const secret = process.env.BETTER_AUTH_SECRET;
  if (!phone || !secret) return null;
  const profile = await findProfile(ctx, user._id);
  if (!profile) return null;
  return {
    profileId: profile._id,
    phone,
    phoneHash: await smsPhoneHash(phone, secret),
  };
}

export async function isCurrentFamilyGrant(
  ctx: QueryCtx,
  grant: Doc<"householdFamilyGrants">,
  actor: NonNullable<Awaited<ReturnType<typeof familyActor>>>,
) {
  return (
    grant.memberProfileId === actor.profileId &&
    grant.phoneHash === actor.phoneHash &&
    (await isProfileOpen(ctx, grant.ownerProfileId)) &&
    (await isPhoneGrantCurrent(ctx, actor.phone, grant.createdAt))
  );
}

export async function canFamilyRead(
  ctx: QueryCtx,
  booking: Doc<"bookings">,
  viewerId: Id<"profiles">,
) {
  if (!booking.sharedWithFamily || !booking.householdProfileId) return false;
  const ownerId = booking.householdProfileId;
  const grants = await ctx.db
    .query("householdFamilyGrants")
    .withIndex("by_member_owner_revoked", (q) =>
      q
        .eq("memberProfileId", viewerId)
        .eq("ownerProfileId", ownerId)
        .eq("revokedAt", undefined),
    )
    .take(MAX_FAMILY_GRANTS);
  if (grants.length === 0) return false;
  const actor = await familyActor(ctx);
  if (!actor) return false;
  for (const grant of grants) {
    if (await isCurrentFamilyGrant(ctx, grant, actor)) return true;
  }
  return false;
}
