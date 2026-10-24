import { z } from "zod";

/**
 * Environment access, validated once.
 *
 * Rules:
 *  - Client vars MUST be read as literal `process.env.NEXT_PUBLIC_*` so Next
 *    can inline them at build time. Never index `process.env` dynamically.
 *  - Server vars are read lazily through `serverEnv()` so a server-only secret
 *    can never be pulled into a client bundle by an accidental import.
 *  - Everything is optional today: the repo must build and test green with an
 *    empty `.env`. Make a var required only once a feature depends on it.
 */

// An unset var and a var set to "" mean the same thing here: not configured.
const optionalUrl = z
  .url()
  .optional()
  .or(z.literal("").transform((): undefined => undefined));

const clientSchema = z.object({
  NEXT_PUBLIC_TURNSTILE_SITE_KEY: z.string().trim().optional(),
  NEXT_PUBLIC_SITE_URL: optionalUrl,
  NEXT_PUBLIC_CONVEX_URL: optionalUrl,
  NEXT_PUBLIC_CONVEX_SITE_URL: optionalUrl,
  NEXT_PUBLIC_TELEMETRY_ENABLED: z
    .enum(["true", "false", ""])
    .optional()
    .transform((value) => value === "true"),
  NEXT_PUBLIC_GA_MEASUREMENT_ID: z
    .string()
    .regex(/^G-[A-Z0-9]+$/)
    .optional()
    .or(z.literal("")),
  NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION: z.string().optional(),
  NEXT_PUBLIC_BING_SITE_VERIFICATION: z.string().optional(),
  NEXT_PUBLIC_POSTHOG_KEY: z.string().optional(),
  NEXT_PUBLIC_POSTHOG_HOST: optionalUrl,
  NEXT_PUBLIC_SENTRY_DSN: z.string().optional(),
});

export const clientEnv = clientSchema.parse({
  NEXT_PUBLIC_TURNSTILE_SITE_KEY: process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY,
  NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
  NEXT_PUBLIC_CONVEX_URL: process.env.NEXT_PUBLIC_CONVEX_URL,
  NEXT_PUBLIC_CONVEX_SITE_URL: process.env.NEXT_PUBLIC_CONVEX_SITE_URL,
  NEXT_PUBLIC_TELEMETRY_ENABLED: process.env.NEXT_PUBLIC_TELEMETRY_ENABLED,
  NEXT_PUBLIC_GA_MEASUREMENT_ID: process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID,
  NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION:
    process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION,
  NEXT_PUBLIC_BING_SITE_VERIFICATION:
    process.env.NEXT_PUBLIC_BING_SITE_VERIFICATION,
  NEXT_PUBLIC_POSTHOG_KEY: process.env.NEXT_PUBLIC_POSTHOG_KEY,
  NEXT_PUBLIC_POSTHOG_HOST: process.env.NEXT_PUBLIC_POSTHOG_HOST,
  NEXT_PUBLIC_SENTRY_DSN: process.env.NEXT_PUBLIC_SENTRY_DSN,
});

export type ClientEnv = z.infer<typeof clientSchema>;

const serverSchema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  CONVEX_DEPLOYMENT: z.string().optional(),
  CONVEX_DEPLOY_KEY: z.string().optional(),
  BETTER_AUTH_SECRET: z.preprocess(
    (value) =>
      typeof value === "string" && value.trim() === "" ? undefined : value,
    z.string().min(32).optional(),
  ),
  ADMIN_SETUP_TOKEN: z.preprocess(
    (value) =>
      typeof value === "string" && value.trim() === "" ? undefined : value,
    z.string().min(32).max(512).optional(),
  ),
  BETTER_AUTH_URL: optionalUrl,
  OPENROUTER_API_KEY: z.string().optional(),
  OPENROUTER_MODEL: z.string().optional(),
  PHOTO_ESTIMATE_DAILY_LIMIT: z.string().optional(),
  PHOTO_ESTIMATE_PROVIDER: z.string().optional(),
  PHOTO_ESTIMATE_ENDPOINT: z.string().optional(),
  PHOTO_ESTIMATE_API_KEY: z.string().optional(),
  PHOTO_ESTIMATE_MODEL: z.string().optional(),
  OSDIGITAL_API_KEY: z.string().optional(),
  OSDIGITAL_SENDER_ID: z.string().optional(),
  OSDIGITAL_ENTITY_ID: z.string().optional(),
  OSDIGITAL_TEMPLATE_ID: z.string().optional(),
  OSDIGITAL_OTP_MESSAGE: z.string().optional(),
  SUREPASS_API_TOKEN: z.string().optional(),
  SUREPASS_ENABLED: z.string().optional(),
  MSG91_AUTH_KEY: z.string().optional(),
  PUBLIC_DATA_ENABLED: z.string().optional(),
  MET_NORWAY_USER_AGENT: z.string().optional(),
  DATA_GOV_IN_API_KEY: z.string().optional(),
  DATA_GOV_IN_AIR_RESOURCE_ID: z.string().optional(),
  SENTRY_AUTH_TOKEN: z.string().optional(),
  SENTRY_ORG: z.string().optional(),
  SENTRY_PROJECT: z.string().optional(),
});

export type ServerEnv = z.infer<typeof serverSchema>;

/** Convex-only gate. Partial or misspelled configuration must not bypass it. */
export function turnstileEnv() {
  const enabled = process.env.TURNSTILE_ENABLED?.trim();
  if (!enabled || enabled === "false") return { kind: "off" as const };
  const secret = process.env.TURNSTILE_SECRET_KEY?.trim();
  const hostnames = (process.env.TURNSTILE_HOSTNAMES ?? "")
    .split(",")
    .map((hostname) => hostname.trim().toLowerCase());
  return enabled !== "true" ||
    !secret ||
    secret.length > 512 ||
    /\s/.test(secret) ||
    /^[123]x0{10}/.test(secret) ||
    hostnames.length === 0 ||
    hostnames.some(
      (hostname) =>
        !/^(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,}$/.test(hostname),
    )
    ? { kind: "invalid" as const }
    : { kind: "on" as const, secret, hostnames };
}

/** Optional Convex admin-recovery email settings, validated on each request. */
export function adminRecoveryEnv() {
  const parsed = z
    .object({
      apiKey: z
        .string()
        .trim()
        .min(1)
        .max(4096)
        .regex(/^[^\r\n]+$/),
      from: z.email(),
      siteUrl: z.url().refine((value) => {
        const url = new URL(value);
        return url.protocol === "https:" && !url.username && !url.password;
      }),
    })
    .safeParse({
      apiKey: process.env.RESEND_API_KEY,
      from: process.env.ADMIN_RESET_FROM_EMAIL,
      siteUrl: process.env.SITE_URL,
    });
  return parsed.success ? parsed.data : null;
}

/** Local delivery needs the platform-owned backend origin as well as a local site. */
export function isLoopbackUrl(value: string | undefined): boolean {
  if (!value) return false;
  try {
    const url = new URL(value);
    return (
      url.protocol === "http:" &&
      ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname) &&
      !url.username &&
      !url.password
    );
  } catch {
    return false;
  }
}

/** Fails closed on every hosted Convex deployment, including cloud development. */
export function isLocalAuthTestMode(): boolean {
  return (
    process.env.AUTH_LOCAL_TEST_MODE === "true" &&
    isLoopbackUrl(process.env.CONVEX_SITE_URL) &&
    isLoopbackUrl(process.env.SITE_URL)
  );
}

/** Optional normal-user email transport. No public/browser switch can enable it. */
export function authEmailEnv() {
  const siteUrl = process.env.SITE_URL;
  const inboxUrl = process.env.AUTH_LOCAL_EMAIL_INBOX_URL;
  const inboxToken = process.env.AUTH_LOCAL_EMAIL_INBOX_TOKEN;
  if (
    siteUrl &&
    inboxUrl &&
    inboxToken &&
    isLocalAuthTestMode() &&
    isLoopbackUrl(inboxUrl) &&
    inboxToken.length >= 32 &&
    !/[\r\n]/.test(inboxToken)
  ) {
    return { kind: "local" as const, siteUrl, inboxUrl, inboxToken };
  }
  const live = z
    .object({
      apiKey: z
        .string()
        .trim()
        .min(1)
        .max(4096)
        .regex(/^[^\r\n]+$/),
      from: z.email(),
      siteUrl: z.url().refine((value) => {
        const url = new URL(value);
        return url.protocol === "https:" && !url.username && !url.password;
      }),
    })
    .safeParse({
      apiKey: process.env.RESEND_API_KEY,
      from: process.env.AUTH_FROM_EMAIL,
      siteUrl,
    });
  return live.success ? { kind: "resend" as const, ...live.data } : null;
}

// Held on an object rather than a bare `let` so the memo write is a property
// assignment, not a reassignment of module state from inside a function.
const memo: { value?: ServerEnv } = {};

/** Server-only. Throws if called from the browser. */
export function serverEnv(): ServerEnv {
  if (typeof window !== "undefined") {
    throw new Error("serverEnv() was called in the browser");
  }
  memo.value ??= serverSchema.parse(process.env);
  return memo.value;
}

/** Optional Convex scheduled sources. Credentials are never sent to the client. */
export function publicDataEnv() {
  const isEnabled = process.env.PUBLIC_DATA_ENABLED === "true";
  const userAgent = z
    .string()
    .trim()
    .min(12)
    .max(240)
    .regex(/^[^\r\n]+$/)
    .refine((value) =>
      value
        .split(" ")
        .some(
          (part) =>
            z.url({ protocol: /^https$/ }).safeParse(part).success ||
            z.email().safeParse(part).success,
        ),
    )
    .safeParse(process.env.MET_NORWAY_USER_AGENT);
  const apiKey = z
    .string()
    .trim()
    .min(1)
    .max(512)
    .regex(/^[\w-]+$/)
    .safeParse(process.env.DATA_GOV_IN_API_KEY);
  const resourceId = z
    .uuid()
    .safeParse(process.env.DATA_GOV_IN_AIR_RESOURCE_ID);
  return {
    weather:
      isEnabled && userAgent.success ? { userAgent: userAgent.data } : null,
    air:
      isEnabled && apiKey.success && resourceId.success
        ? { apiKey: apiKey.data, resourceId: resourceId.data }
        : null,
  };
}

/** Operator-controlled HTTPS gateway. Never accept an endpoint from an action argument. */
const photoEndpoint = z.url().refine((value) => {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return false;
  }
  return (
    url.protocol === "https:" &&
    !url.username &&
    !url.password &&
    !url.search &&
    !url.hash &&
    !value.includes("\\") &&
    url.pathname.endsWith("/v1/chat/completions") &&
    !url.hostname.startsWith("[") &&
    !/^[\d.]+$/.test(url.hostname) &&
    url.hostname.includes(".") &&
    !/\.(localhost|local|internal)$/.test(url.hostname)
  );
});

/** Convex action configuration, read on each request; blank or invalid means manual-only. */
export function photoEstimateEnv() {
  const quota = process.env.PHOTO_ESTIMATE_DAILY_LIMIT;
  const configuredProvider = process.env.PHOTO_ESTIMATE_PROVIDER?.trim();
  const provider =
    configuredProvider === ""
      ? "openrouter"
      : (configuredProvider ?? "openrouter");
  const isSelfHosted = provider === "self-hosted";
  const parsed = z
    .object({
      provider: z.enum(["openrouter", "self-hosted"]),
      endpoint: photoEndpoint,
      apiKey: z
        .string()
        .trim()
        .min(1)
        .max(4096)
        .regex(/^[^\r\n]+$/),
      model: z.string().trim().min(1).max(200),
      dailyLimit: z.coerce.number().int().min(1).max(1000),
    })
    .safeParse({
      provider,
      endpoint: isSelfHosted
        ? process.env.PHOTO_ESTIMATE_ENDPOINT
        : "https://openrouter.ai/api/v1/chat/completions",
      apiKey: isSelfHosted
        ? process.env.PHOTO_ESTIMATE_API_KEY
        : process.env.OPENROUTER_API_KEY,
      model: isSelfHosted
        ? process.env.PHOTO_ESTIMATE_MODEL
        : process.env.OPENROUTER_MODEL,
      dailyLimit: quota === undefined || quota.trim() === "" ? "100" : quota,
    });
  return parsed.success ? parsed.data : undefined;
}

/** Optional push channels. Convex owns these secrets; no public build flag is needed. */
export function pushEnv() {
  const parsed = z
    .object({
      subject: z
        .string()
        .max(300)
        .refine((value) =>
          value.startsWith("mailto:")
            ? z.email().safeParse(value.slice(7)).success
            : z.url({ protocol: /^https$/ }).safeParse(value).success,
        ),
      publicKey: z.string().regex(/^[A-Za-z0-9_-]{87}$/),
      privateKey: z.string().regex(/^[A-Za-z0-9_-]{43}$/),
    })
    .safeParse({
      subject: process.env.WEB_PUSH_SUBJECT,
      publicKey: process.env.WEB_PUSH_PUBLIC_KEY,
      privateKey: process.env.WEB_PUSH_PRIVATE_KEY,
    });
  return {
    web:
      process.env.WEB_PUSH_ENABLED === "true" && parsed.success
        ? parsed.data
        : null,
    expo:
      process.env.EXPO_PUSH_ENABLED === "true" &&
      Boolean(process.env.EXPO_PUSH_ACCESS_TOKEN?.trim()),
    expoAccessToken: process.env.EXPO_PUSH_ACCESS_TOKEN?.trim(),
  };
}

/** News is optional, server-side and off unless explicitly enabled by the operator. */
export function industryNewsEnv() {
  if (process.env.INDUSTRY_NEWS_ENABLED !== "true") return null;
  const dailyLimit = process.env.INDUSTRY_NEWS_DAILY_LIMIT?.trim();
  const parsed = z
    .object({
      apiKey: z
        .string()
        .trim()
        .min(1)
        .max(256)
        .regex(/^[a-zA-Z0-9_-]+$/),
      dailyLimit: z.coerce.number().int().min(1).max(1000),
    })
    .safeParse({
      apiKey: process.env.INDUSTRY_NEWS_API_KEY,
      dailyLimit: dailyLimit === "" ? "100" : (dailyLimit ?? "100"),
    });
  return parsed.success ? parsed.data : null;
}

/** Cashfree secrets stay on Convex. Invalid or absent configuration fails closed. */
export function cashfreeEnv(): {
  mode: "sandbox" | "live";
  clientId: string;
  clientSecret: string;
  baseUrl: string;
  checkoutEnabled: boolean;
} | null {
  if (typeof document !== "undefined") return null;
  const mode = process.env.CASHFREE_MODE;
  if (mode !== "sandbox" && mode !== "live") return null;
  const sandboxId = process.env.CASHFREE_SANDBOX_CLIENT_ID?.trim();
  const sandboxSecret = process.env.CASHFREE_SANDBOX_CLIENT_SECRET?.trim();
  const liveId = process.env.CASHFREE_LIVE_CLIENT_ID?.trim();
  const liveSecret = process.env.CASHFREE_LIVE_CLIENT_SECRET?.trim();
  if (
    (sandboxId && sandboxId === liveId) ||
    (sandboxSecret && sandboxSecret === liveSecret)
  )
    return null;
  const clientId = mode === "sandbox" ? sandboxId : liveId;
  const clientSecret = mode === "sandbox" ? sandboxSecret : liveSecret;
  if (
    !clientId ||
    !clientSecret ||
    clientId.length > 512 ||
    clientSecret.length > 512
  )
    return null;
  return {
    mode,
    clientId,
    clientSecret,
    baseUrl:
      mode === "sandbox"
        ? "https://sandbox.cashfree.com/pg"
        : "https://api.cashfree.com/pg",
    // Live mode additionally requires an immutable approved policy in the backend.
    checkoutEnabled:
      (mode === "sandbox"
        ? process.env.CASHFREE_SANDBOX_CHECKOUT_ENABLED
        : process.env.CASHFREE_LIVE_CHECKOUT_ENABLED) === "true",
  };
}

/** The selected policy is an approval reference, never payment proof. */
export function cashfreePolicyVersion(): string | null {
  if (typeof document !== "undefined") return null;
  const value = process.env.CASHFREE_LIVE_POLICY_VERSION?.trim();
  return value && /^[A-Za-z0-9_-]{1,80}$/.test(value) ? value : null;
}

/** One-time operator import configuration; never exposed to browser settings. */
export function investorDemoImportEnv() {
  return {
    targetUrl: process.env.INVESTOR_DEMO_TARGET_URL,
    expiresAt: process.env.INVESTOR_DEMO_IMPORT_EXPIRES_AT,
  };
}

/** Server-only R2 settings. Reads remain configured when new writes are off. */
export function r2Env() {
  const enabled = process.env.R2_ENABLED?.trim();
  const parsed = z
    .object({
      accountId: z.string().regex(/^[a-f0-9]{32}$/),
      bucket: z.string().regex(/^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]$/),
      accessKeyId: z.string().min(1).max(256).regex(/^\S+$/),
      secretAccessKey: z.string().min(1).max(256).regex(/^\S+$/),
    })
    .safeParse({
      accountId: process.env.R2_ACCOUNT_ID?.trim(),
      bucket: process.env.R2_BUCKET_NAME?.trim(),
      accessKeyId: process.env.R2_ACCESS_KEY_ID?.trim(),
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY?.trim(),
    });
  let writes: "off" | "on" | "invalid" = "invalid";
  if (!enabled || enabled === "false") writes = "off";
  else if (enabled === "true" && parsed.success) writes = "on";
  return { writes, config: parsed.success ? parsed.data : null };
}

/** Convex-only paid identity provider configuration; read on every action. */
export function surepassEnv() {
  const token = process.env.SUREPASS_API_TOKEN?.trim();
  return token &&
    process.env.SUREPASS_ENABLED === "true" &&
    /^[A-Za-z0-9_.-]+$/.test(token)
    ? { token }
    : null;
}

/** Temporary operator switch, never needed for applicant checks. */
export function surepassExampleEnv() {
  return process.env.SUREPASS_EXAMPLE_TEST_ENABLED === "true"
    ? surepassEnv()
    : null;
}
