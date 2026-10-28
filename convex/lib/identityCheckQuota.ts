import { ConvexError } from "convex/values";

import type { Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import { canSpendAfterRemoval } from "./accountClosure";
import { DAILY_CHECK_LIMIT } from "./identityChecks";
import { indiaToday } from "./onboarding";

function hasAllowance(used: number) {
  return Number.isSafeInteger(used) && used >= 0 && used < DAILY_CHECK_LIMIT;
}
/** Authenticated profile owns the allowance across all of its applications. */
export async function spendIdentityAttempt(
  ctx: MutationCtx,
  profileId?: Id<"profiles">,
) {
  const day = indiaToday();
  const global = await ctx.db
    .query("identityCheckDays")
    .withIndex("by_day", (q) => q.eq("day", day))
    .unique();
  if (profileId) {
    const profile = await ctx.db.get("profiles", profileId);
    if (
      profile?.closedAt !== undefined ||
      (profile?.phone && !(await canSpendAfterRemoval(ctx, profile.phone)))
    )
      throw new ConvexError("CHECK_LIMIT");
    const person = await ctx.db
      .query("identityPersonCheckDays")
      .withIndex("by_profile_day", (q) =>
        q.eq("profileId", profileId).eq("day", day),
      )
      .unique();
    if (!hasAllowance(person?.used ?? 0)) throw new ConvexError("CHECK_LIMIT");
    if (person)
      await ctx.db.patch("identityPersonCheckDays", person._id, {
        used: person.used + 1,
      });
    else
      await ctx.db.insert("identityPersonCheckDays", {
        profileId,
        day,
        used: 1,
      });
  } else if (!hasAllowance(global?.operatorUsed ?? 0))
    throw new ConvexError("CHECK_LIMIT");
  const used = global?.used ?? 0;
  if (
    !Number.isSafeInteger(used) ||
    used < 0 ||
    used >= Number.MAX_SAFE_INTEGER
  )
    throw new ConvexError("CHECK_LIMIT");
  const operator = profileId
    ? {}
    : { operatorUsed: (global?.operatorUsed ?? 0) + 1 };
  if (global)
    await ctx.db.patch("identityCheckDays", global._id, {
      used: used + 1,
      ...operator,
    });
  else await ctx.db.insert("identityCheckDays", { day, used: 1, ...operator });
  return day;
}
