import type { GenericCtx } from "@convex-dev/better-auth";
import { ConvexError } from "convex/values";

import type { DataModel } from "../_generated/dataModel";
import { authComponent } from "../auth";
import { isAuthAccountClosed } from "./accountClosure";
import { isAdminEmail } from "./admin";

/**
 * The caller's Better Auth user, validated against their session. Never trust
 * `ctx.auth.getUserIdentity()` alone — it doesn't validate the session.
 */
export async function openAuthUser(ctx: GenericCtx<DataModel>) {
  const user = await authComponent.safeGetAuthUser(ctx);
  return user && !(await isAuthAccountClosed(ctx, user._id)) ? user : null;
}

export async function requireUser(ctx: GenericCtx<DataModel>) {
  const user = await openAuthUser(ctx);
  if (!user) throw new ConvexError("NOT_SIGNED_IN");
  return user;
}

/**
 * The admin, with an authenticator enrolled. `allowWithoutTwoFactor` is only
 * for the setup steps that come before enrolment.
 */
export async function requireAdmin(
  ctx: GenericCtx<DataModel>,
  { allowWithoutTwoFactor = false }: { allowWithoutTwoFactor?: boolean } = {},
) {
  const user = await requireUser(ctx);
  if (!isAdminEmail(user.email)) throw new ConvexError("NOT_ADMIN");
  if (!allowWithoutTwoFactor && user.twoFactorEnabled !== true) {
    throw new ConvexError("TWO_FACTOR_REQUIRED");
  }
  return user;
}
