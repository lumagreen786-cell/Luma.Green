import type { BetterAuthPlugin } from "better-auth";
import {
  APIError,
  createAuthMiddleware,
  getAuthoritativeSessionFromCtx,
  isAPIError,
} from "better-auth/api";
import { twoFactor } from "better-auth/plugins";
import { z } from "zod";

import { isAdminEmail } from "./admin";
import { PHONE_EMAIL_DOMAIN, phoneEmail } from "./phone";

type Context = Parameters<typeof getAuthoritativeSessionFromCtx>[0];
const REAUTH_WINDOW_MS = 5 * 60_000;
const assuranceSchema = z.object({
  userId: z.string(),
  secondFactor: z.boolean(),
});

function isFactorEnabled(user: object): boolean {
  return "twoFactorEnabled" in user && user.twoFactorEnabled === true;
}

function assuranceId(sessionId: string): string {
  return `luma-security-${sessionId}`;
}

async function readAssurance(ctx: Context, sessionId: string, userId: string) {
  const record = await ctx.context.internalAdapter.findVerificationValue(
    assuranceId(sessionId),
  );
  if (!record) return null;
  // The Convex adapter serializes dates as epoch milliseconds even though
  // Better Auth's shared interface declares Date.
  const expiresAt = new Date(record.expiresAt);
  if (
    !Number.isFinite(expiresAt.getTime()) ||
    expiresAt.getTime() <= Date.now()
  )
    return null;
  try {
    const proof = assuranceSchema.safeParse(JSON.parse(record.value));
    return proof.success && proof.data.userId === userId
      ? { ...proof.data, expiresAt }
      : null;
  } catch {
    return null;
  }
}

async function saveAssurance(
  ctx: Context,
  sessionId: string,
  userId: string,
  hasSecondFactor: boolean,
  expiresAt = new Date(Date.now() + REAUTH_WINDOW_MS),
) {
  await ctx.context.internalAdapter.deleteVerificationByIdentifier(
    assuranceId(sessionId),
  );
  await ctx.context.internalAdapter.createVerificationValue({
    identifier: assuranceId(sessionId),
    value: JSON.stringify({ userId, secondFactor: hasSecondFactor }),
    expiresAt,
  });
}

function forbidden(code: string): never {
  throw new APIError("FORBIDDEN", {
    code,
    message: "Security change rejected.",
  });
}

function assertSupportedAction(ctx: Context) {
  const body: unknown = ctx.body;
  // Each policy flag must be checked independently: a malformed, unrelated
  // option must not disable a guard before the endpoint validates its body.
  const deviceTrust = z
    .object({ trustDevice: z.boolean().optional() })
    .safeParse(body);
  if (
    [
      "/phone-number/request-password-reset",
      "/phone-number/reset-password",
      "/sign-in/phone-number",
    ].includes(ctx.path)
  )
    forbidden("UNSUPPORTED_PHONE_ACCOUNT_CHANGE");
  if (
    ctx.path.startsWith("/two-factor/") &&
    deviceTrust.success &&
    deviceTrust.data.trustDevice
  )
    forbidden("TRUST_DEVICE_DISABLED");
}

function isPhoneBinding(ctx: { path?: string; body?: unknown }): boolean {
  return (
    ctx.path === "/phone-number/verify" &&
    z.object({ updatePhoneNumber: z.literal(true) }).safeParse(ctx.body).success
  );
}

/** Runs after the plugin validates the OTP, before it creates a sign-in session. */
export function assertPhoneVerificationIdentity(
  ctx: { path?: string; body?: unknown },
  user: { email: string },
  phone: string,
) {
  if (!isPhoneBinding(ctx) && user.email !== phoneEmail(phone))
    forbidden("UNSUPPORTED_PHONE_ACCOUNT_CHANGE");
}

/** Binding proves possession for the current email identity; it never signs in. */
async function requirePhoneBindingAssurance(ctx: Context) {
  const session = await getAuthoritativeSessionFromCtx(ctx);
  if (!session) forbidden("UNAUTHORIZED");
  if (
    !session.user.emailVerified ||
    isAdminEmail(session.user.email) ||
    session.user.email.endsWith(`@${PHONE_EMAIL_DOMAIN}`) ||
    ("phoneNumber" in session.user && Boolean(session.user.phoneNumber))
  )
    forbidden("UNSUPPORTED_PHONE_ACCOUNT_CHANGE");
  const proof = await readAssurance(ctx, session.session.id, session.user.id);
  if (!proof || (isFactorEnabled(session.user) && !proof.secondFactor))
    forbidden("SECURITY_REAUTH_REQUIRED");
}

/**
 * Better Auth 1.6.33 challenges credential sign-ins but not SMS verification.
 * Keep its one-use challenge handler and extend only the route matcher. This
 * plugin must precede Convex's JWT hook; integration tests defend that order.
 */
export function phoneTwoFactor() {
  const plugin = twoFactor({ issuer: "Luma.Green", allowPasswordless: true });
  const signInPaths = new Set([
    "/phone-number/verify",
    "/sign-in/email",
    "/sign-up/email",
  ]);
  const managementPaths = new Set([
    "/two-factor/enable",
    "/two-factor/disable",
    "/two-factor/generate-backup-codes",
    "/two-factor/get-totp-uri",
  ]);
  return {
    ...plugin,
    hooks: {
      before: [
        {
          matcher: () => true,
          handler: createAuthMiddleware(async (ctx) => {
            assertSupportedAction(ctx);
            if (isPhoneBinding(ctx)) {
              await requirePhoneBindingAssurance(ctx);
              return;
            }

            const isFactorVerification =
              ctx.path === "/two-factor/verify-totp" ||
              ctx.path === "/two-factor/verify-backup-code";
            if (!isFactorVerification && !managementPaths.has(ctx.path)) return;
            const session = await getAuthoritativeSessionFromCtx(ctx);
            // A pending sign-in has no session. Let the original plugin check
            // its signed, expiring challenge and account-level attempt budget.
            if (!session && isFactorVerification) return;
            if (!session) forbidden("UNAUTHORIZED");
            const isEnabled = isFactorEnabled(session.user);
            if (
              (isEnabled && ctx.path === "/two-factor/enable") ||
              (ctx.path === "/two-factor/get-totp-uri" &&
                (isEnabled || !isAdminEmail(session.user.email))) ||
              (ctx.path === "/two-factor/disable" &&
                isAdminEmail(session.user.email)) ||
              (isFactorVerification &&
                (isEnabled || ctx.path === "/two-factor/verify-backup-code"))
            )
              forbidden("UNSUPPORTED_SECURITY_CHANGE");
            const proof = await readAssurance(
              ctx,
              session.session.id,
              session.user.id,
            );
            if (!proof || (isEnabled && !proof.secondFactor)) {
              forbidden("SECURITY_REAUTH_REQUIRED");
            }
          }),
        },
      ],
      after: [
        {
          matcher: (ctx) =>
            signInPaths.has(ctx.path ?? "") && !isPhoneBinding(ctx),
          handler: createAuthMiddleware(async (ctx) => {
            // A trusted-device cookie issued before this policy cannot skip
            // the factor. New trust-device requests are rejected above.
            const cookie = ctx.context.createAuthCookie("trust_device");
            const signed = await ctx.getSignedCookie(
              cookie.name,
              ctx.context.secret,
            );
            const identifier = signed ? signed.split("!", 2)[1] : undefined;
            if (identifier?.startsWith("trust-device-")) {
              await ctx.context.internalAdapter.deleteVerificationByIdentifier(
                identifier,
              );
            }
          }),
        },
        ...plugin.hooks.after.map((hook) => ({
          ...hook,
          matcher: (ctx: Parameters<typeof hook.matcher>[0]) =>
            hook.matcher(ctx) ||
            (ctx.path === "/phone-number/verify" && !isPhoneBinding(ctx)),
        })),
        {
          matcher: (ctx) =>
            signInPaths.has(ctx.path ?? "") ||
            ctx.path === "/two-factor/verify-totp" ||
            ctx.path === "/two-factor/verify-backup-code" ||
            ctx.path === "/two-factor/enable" ||
            ctx.path === "/two-factor/disable",
          handler: createAuthMiddleware(async (ctx) => {
            if (isAPIError(ctx.context.returned) || isPhoneBinding(ctx)) return;
            if (ctx.path === "/two-factor/enable") {
              const session = ctx.context.session;
              if (session && isAdminEmail(session.user.email)) {
                await saveAssurance(
                  ctx,
                  session.session.id,
                  session.user.id,
                  false,
                );
              }
              return;
            }
            const current = ctx.context.newSession;
            if (!current) return;
            if (signInPaths.has(ctx.path)) {
              await saveAssurance(
                ctx,
                current.session.id,
                current.user.id,
                false,
              );
              return;
            }
            const previous = ctx.context.session;
            if (previous) {
              // Enrollment and disable rotate sessions. Do not let that
              // rotation restart the five-minute primary-authentication clock.
              const proof = await readAssurance(
                ctx,
                previous.session.id,
                previous.user.id,
              );
              if (proof)
                await saveAssurance(
                  ctx,
                  current.session.id,
                  current.user.id,
                  isFactorEnabled(current.user),
                  proof.expiresAt,
                );
              if (
                !isFactorEnabled(previous.user) &&
                isFactorEnabled(current.user)
              ) {
                await ctx.context.adapter.deleteMany({
                  model: "session",
                  where: [
                    { field: "userId", value: current.user.id },
                    {
                      field: "id",
                      operator: "not_in",
                      value: [current.session.id],
                    },
                  ],
                });
              }
              return;
            }
            // The original plugin has consumed both the primary challenge and
            // the factor before it creates this new session.
            await saveAssurance(ctx, current.session.id, current.user.id, true);
          }),
        },
      ],
    },
  } satisfies BetterAuthPlugin;
}
