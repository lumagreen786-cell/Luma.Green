import type { GenericCtx } from "@convex-dev/better-auth";

import { internal } from "../_generated/api";
import type { DataModel, Doc, Id } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";
import { indiaToday } from "./onboarding";
import { smsPhoneHash } from "./smsLimits";

/** Reads closure without requiring the very access being checked. */
export async function isAuthAccountClosed(
  ctx: GenericCtx<DataModel>,
  authUserId: string,
): Promise<boolean> {
  if ("db" in ctx) {
    const profile = await ctx.db
      .query("profiles")
      .withIndex("by_authUserId", (q) => q.eq("authUserId", authUserId))
      .unique();
    return profile?.closedAt !== undefined;
  }
  return ctx.runQuery(internal.accountRemoval.closedForAuth, { authUserId });
}
export async function isProfileOpen(ctx: QueryCtx, profileId: Id<"profiles">) {
  const profile = await ctx.db.get("profiles", profileId);
  return Boolean(profile && profile.closedAt === undefined);
}
/** A new same-phone account cannot redeem a grant from before withdrawal. */
export async function isPhoneGrantCurrent(
  ctx: QueryCtx,
  phone: string,
  issuedAt: number,
) {
  const secret = process.env.BETTER_AUTH_SECRET;
  if (!secret)
    return (await ctx.db.query("accountRemovalPhoneBlocks").first()) === null;
  const phoneHash = await smsPhoneHash(phone, secret);
  const block = await ctx.db
    .query("accountRemovalPhoneBlocks")
    .withIndex("by_phoneHash", (q) => q.eq("phoneHash", phoneHash))
    .unique();
  return !block || issuedAt > block.closedAt;
}

/** Removal cannot reset a paid allowance by creating a new profile that day. */
export async function canSpendAfterRemoval(ctx: QueryCtx, phone: string) {
  const secret = process.env.BETTER_AUTH_SECRET;
  if (!secret)
    return (await ctx.db.query("accountRemovalPhoneBlocks").first()) === null;
  const phoneHash = await smsPhoneHash(phone, secret);
  const block = await ctx.db
    .query("accountRemovalPhoneBlocks")
    .withIndex("by_phoneHash", (q) => q.eq("phoneHash", phoneHash))
    .unique();
  return !block || indiaToday(block.closedAt) !== indiaToday();
}

/** An approval remains historical evidence after its sole person's closure. */
export async function openStakeholders(
  ctx: QueryCtx,
  rows: Doc<"stakeholderAccounts">[],
) {
  const candidates = await Promise.all(
    rows.map(async (row) =>
      (await isProfileOpen(ctx, row.ownerProfileId)) ? row : null,
    ),
  );
  return candidates.filter((row) => row !== null);
}
