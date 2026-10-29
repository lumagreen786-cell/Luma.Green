import { createClient, type GenericCtx } from "@convex-dev/better-auth";
import { convex } from "@convex-dev/better-auth/plugins";
import {
  APIError,
  createAuthMiddleware,
  getAuthoritativeSessionFromCtx,
} from "better-auth/api";
import { betterAuth, type BetterAuthOptions } from "better-auth/minimal";
import { phoneNumber } from "better-auth/plugins";

import { authEmailEnv } from "../src/lib/env";
import { components, internal } from "./_generated/api";
import type { DataModel } from "./_generated/dataModel";
import authConfig from "./auth.config";
import authSchema from "./betterAuth/schema";
import { isAuthAccountClosed } from "./lib/accountClosure";
import { adminSessionExpiry, isAdminEmail } from "./lib/admin";
import { withAtomicAuthUpdates } from "./lib/authAtomic";
import { sendLocalPhoneCode } from "./lib/authEmail";
import { isIndianMobile, phoneEmail } from "./lib/phone";
import {
  assertPhoneVerificationIdentity,
  phoneTwoFactor,
} from "./lib/phoneTwoFactor";
import { securityAudit } from "./lib/securityAudit";
import { CODE_TTL_MINUTES, codeDelivery } from "./lib/sms";
import { smsPhoneHash } from "./lib/smsLimits";
import { verifyBotToken } from "./lib/turnstile";

/**
 * Sign-in for Luma.Green — docs/architecture/auth.md.
 *
 * - Everyone: phone number + 6-digit SMS code.
 * - The configured admin must also verify an authenticator-app code.
 *   ADMIN_EMAIL stores the internal phone identity, never an email login.
 */
export const authComponent: ReturnType<
  typeof createClient<DataModel, typeof authSchema>
> = createClient<DataModel, typeof authSchema>(
  components.betterAuth,
  // Our own copy of the component, with tables generated from the plugins
  // below (`pnpm auth:schema`) — the packaged default lags better-auth.
  {
    local: { schema: authSchema },
    authFunctions: internal.authEvents,
    triggers: securityAudit,
  },
);

/** Origins Better Auth accepts requests from: the site plus any extras. */
function trustedOrigins(): string[] {
  return [
    process.env.SITE_URL,
    ...(process.env.EXTRA_TRUSTED_ORIGINS ?? "").split(","),
  ]
    .map((origin) => origin?.trim())
    .filter((origin): origin is string => Boolean(origin));
}

/** Runs before code creation, so a rejected resend cannot invalidate a code. */
async function reserveCodeRequest(
  ctx: GenericCtx<DataModel>,
  requestBody: unknown,
) {
  const body = requestBody as { phoneNumber?: unknown } | undefined;
  const phone = typeof body?.phoneNumber === "string" ? body.phoneNumber : "";
  if (!isIndianMobile(phone)) return; // The plugin supplies its validation error.
  const delivery = codeDelivery({
    OSDIGITAL_API_KEY: process.env.OSDIGITAL_API_KEY,
    OSDIGITAL_SENDER_ID: process.env.OSDIGITAL_SENDER_ID,
    OSDIGITAL_ENTITY_ID: process.env.OSDIGITAL_ENTITY_ID,
    OSDIGITAL_TEMPLATE_ID: process.env.OSDIGITAL_TEMPLATE_ID,
    OSDIGITAL_OTP_MESSAGE: process.env.OSDIGITAL_OTP_MESSAGE,
    MSG91_AUTH_KEY: process.env.MSG91_AUTH_KEY,
    MSG91_OTP_TEMPLATE_ID: process.env.MSG91_OTP_TEMPLATE_ID,
    AUTH_DEV_MODE: process.env.AUTH_DEV_MODE,
  });
  if (delivery.kind === "off" && authEmailEnv()?.kind !== "local") {
    throw new APIError("SERVICE_UNAVAILABLE", {
      message: "SMS is not configured.",
    });
  }
  const secret = process.env.BETTER_AUTH_SECRET;
  if (!secret || !("runMutation" in ctx)) {
    throw new APIError("SERVICE_UNAVAILABLE", {
      message: "SMS limits are not configured.",
    });
  }
  const phoneHash = await smsPhoneHash(phone, secret);
  const allowance = await ctx.runMutation(internal.smsLimits.reserve, {
    phoneHash,
  });
  if (!allowance.allowed) {
    throw new APIError(
      "TOO_MANY_REQUESTS",
      {
        message: "Wait before requesting another code.",
      },
      { "Retry-After": String(allowance.retryAfterSeconds) },
    );
  }
}

/**
 * The options on their own, so the component (convex/betterAuth/adapter.ts)
 * and the schema generator (scripts/generate-auth-schema.mts) share them.
 */
export const createAuthOptions = (ctx: GenericCtx<DataModel>) =>
  ({
    appName: "Luma.Green",
    baseURL: process.env.SITE_URL,
    trustedOrigins: trustedOrigins(),
    // Keep the same origin/CSRF boundary in tests and production.
    advanced: { disableOriginCheck: false, disableCSRFCheck: false },
    database: withAtomicAuthUpdates(ctx, authComponent.adapter(ctx)),
    emailAndPassword: { enabled: false },
    // Kept in the database: in memory, each Convex request could start with a
    // clean slate. The plugins set the limits (phone: 10 a minute; two-factor:
    // 3 per 10 seconds), per client IP.
    rateLimit: {
      enabled: true,
      storage: "database",
      customRules: {
        "/convex/jwks": (request, rule) => request.method !== "GET" && rule,
        "/request-password-reset": { window: 15 * 60, max: 3 },
        "/reset-password": { window: 15 * 60, max: 5 },
      },
    },
    session: {
      expiresIn: 60 * 60 * 24 * 30,
      // A session lasts a fixed time from sign-in and is never extended.
      // Better Auth's refresh would otherwise stretch the admin's 12-hour
      // session (below) back to 30 days the first time it's used.
      disableSessionRefresh: true,
    },
    databaseHooks: {
      session: {
        create: {
          // Look the user up through the component: Better Auth's endpoint
          // context isn't available to hooks inside the Convex runtime.
          before: async (session) => {
            if (await isAuthAccountClosed(ctx, session.userId)) {
              throw new APIError("FORBIDDEN", {
                code: "ACCOUNT_CLOSED",
                message: "This account is closed.",
              });
            }
            const user = await authComponent.getAnyUserById(
              ctx,
              session.userId,
            );
            if (!isAdminEmail(user?.email)) return;
            return {
              data: {
                ...session,
                expiresAt: adminSessionExpiry(session.expiresAt, Date.now()),
              },
            };
          },
        },
      },
    },
    hooks: {
      before: createAuthMiddleware(async (hookCtx) => {
        // Sign-out remains available after domain access is withdrawn.
        if (hookCtx.path !== "/sign-out") {
          const session = await getAuthoritativeSessionFromCtx(hookCtx);
          if (session && (await isAuthAccountClosed(ctx, session.user.id))) {
            throw new APIError("UNAUTHORIZED", {
              code: "ACCOUNT_CLOSED",
              message: "This account is closed.",
            });
          }
        }
        if (["/delete-user", "/delete-user/callback"].includes(hookCtx.path)) {
          throw new APIError("FORBIDDEN", {
            code: "DOMAIN_REMOVAL_REQUIRED",
            message: "Use account removal.",
          });
        }
        if (
          hookCtx.path === "/update-user" &&
          hookCtx.body &&
          ("phoneNumber" in hookCtx.body ||
            "phoneNumberVerified" in hookCtx.body)
        ) {
          throw new APIError("FORBIDDEN", {
            code: "UNSUPPORTED_PHONE_ACCOUNT_CHANGE",
            message: "Use phone verification.",
          });
        }
        if (hookCtx.path === "/phone-number/send-otp") {
          await verifyBotToken(hookCtx.headers?.get("x-captcha-response"));
          await reserveCodeRequest(ctx, hookCtx.body);
          return;
        }
        if (
          [
            "/sign-in/email",
            "/sign-up/email",
            "/request-password-reset",
            "/reset-password",
            "/send-verification-email",
            "/verify-email",
            "/change-email",
            "/set-password",
            "/change-password",
          ].includes(hookCtx.path)
        ) {
          throw new APIError("FORBIDDEN", {
            code: "PHONE_LOGIN_REQUIRED",
            message: "Use phone verification to sign in.",
          });
        }
      }),
    },
    plugins: [
      phoneTwoFactor(),
      convex({ authConfig }),
      phoneNumber({
        otpLength: 6,
        expiresIn: CODE_TTL_MINUTES * 60,
        allowedAttempts: 5,
        phoneNumberValidator: isIndianMobile,
        callbackOnVerification: ({ user, phoneNumber: phone }, hookCtx) => {
          // Missing endpoint context cannot authorize an account binding.
          assertPhoneVerificationIdentity(hookCtx ?? {}, user, phone);
          return Promise.resolve();
        },
        // Hand the code to an action through the scheduler: the request
        // returns at once, and nothing is left as a dangling promise that
        // Convex could drop.
        sendOTP: async ({ phoneNumber: phone, code }) => {
          if (authEmailEnv()?.kind === "local") {
            await sendLocalPhoneCode(phone, code);
            return;
          }
          if (!("scheduler" in ctx)) {
            throw new Error("Sign-in codes can only be sent from an action.");
          }
          await ctx.scheduler.runAfter(0, internal.sms.sendCode, {
            phone,
            code,
          });
        },
        signUpOnVerification: {
          getTempEmail: phoneEmail,
          getTempName: (phone) => phone,
        },
      }),
    ],
  }) satisfies BetterAuthOptions;

export const createAuth = (ctx: GenericCtx<DataModel>) =>
  betterAuth(createAuthOptions(ctx));
