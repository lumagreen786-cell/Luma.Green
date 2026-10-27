import { v } from "convex/values";

import { internal } from "./_generated/api";
import { httpAction, internalQuery } from "./_generated/server";
import { openAuthUser } from "./lib/access";
import { isAdminEmail } from "./lib/admin";

/**
 * Private files — docs/architecture/auth.md#private-files. Certificates,
 * machine photos, IDs and selfies are never handed out as storage URLs. They
 * are served here, at `GET /files/{fileId}` on the deployment's `.convex.site`
 * URL, and only to the person who uploaded them or the admin with an
 * authenticator. The caller sends their Convex token as
 * `Authorization: Bearer <token>`.
 */

export const FILES_PATH = "/files/";

// --- Who may open a file --------------------------------------------------------

export type FileAccess = "allowed" | "signed_out" | "forbidden";

export interface FileCaller {
  /** The Better Auth user id. */
  id: string;
  email?: string | null;
  twoFactorEnabled?: boolean | null;
}

/**
 * The admin (with an authenticator enrolled) may open every file; anyone
 * else only their own uploads.
 */
export function fileAccess(
  caller: FileCaller | null | undefined,
  ownerAuthUserId: string | null | undefined,
  adminEmail: string | undefined = process.env.ADMIN_EMAIL,
): FileAccess {
  if (!caller) return "signed_out";
  if (isAdminEmail(caller.email, adminEmail)) {
    return caller.twoFactorEnabled === true ? "allowed" : "forbidden";
  }
  return ownerAuthUserId && caller.id === ownerAuthUserId
    ? "allowed"
    : "forbidden";
}

// --- CORS: the site calls this from the browser ---------------------------------

function originOf(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  if (!trimmed) return null;
  try {
    return new URL(trimmed).origin;
  } catch {
    return null;
  }
}

/** The site's origins, as Better Auth trusts them in convex/auth.ts. */
export function trustedOrigins(env: {
  SITE_URL?: string;
  EXTRA_TRUSTED_ORIGINS?: string;
}): string[] {
  return [env.SITE_URL, ...(env.EXTRA_TRUSTED_ORIGINS ?? "").split(",")]
    .map((origin) => originOf(origin))
    .filter((origin): origin is string => origin !== null);
}

function siteOrigins(): string[] {
  return trustedOrigins({
    SITE_URL: process.env.SITE_URL,
    EXTRA_TRUSTED_ORIGINS: process.env.EXTRA_TRUSTED_ORIGINS,
  });
}

/** CORS headers for a response: the origin is echoed only if trusted. */
export function corsHeaders(
  requestOrigin: string | null,
  trusted: readonly string[],
): Record<string, string> {
  const origin = originOf(requestOrigin);
  return origin && trusted.includes(origin)
    ? { "Access-Control-Allow-Origin": origin, Vary: "Origin" }
    : { Vary: "Origin" };
}

/** The answer to the browser's preflight before it sends the token. */
export function preflightResponse(
  requestOrigin: string | null,
  trusted: readonly string[],
): Response {
  const headers = corsHeaders(requestOrigin, trusted);
  if (!("Access-Control-Allow-Origin" in headers)) {
    return new Response(null, { status: 403, headers });
  }
  return new Response(null, {
    status: 204,
    headers: {
      ...headers,
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Authorization",
      "Access-Control-Max-Age": "600",
    },
  });
}

/** `inline`, with the name made safe for a header (and kept in UTF-8). */
export function contentDisposition(name: string): string {
  const ascii = name.replaceAll(/[^\u{20}-\u{7E}]|["\\]/gu, "_");
  return `inline; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(name)}`;
}

/** The file id in `/files/{fileId}`, or null if the path isn't one. */
export function fileIdFromPath(pathname: string): string | null {
  if (!pathname.startsWith(FILES_PATH)) return null;
  const id = pathname.slice(FILES_PATH.length);
  return /^[a-z\d]+$/i.test(id) ? id : null;
}

// --- The route ------------------------------------------------------------------

/**
 * What the route needs to know about a file. Internal: its only caller, the
 * HTTP action below, has already authenticated the request, and decides with
 * `fileAccess` whether this caller may have it.
 */
export const lookup = internalQuery({
  args: { fileId: v.string() },
  returns: v.union(
    v.null(),
    v.object({
      storageId: v.id("_storage"),
      name: v.string(),
      contentType: v.string(),
      ownerAuthUserId: v.union(v.string(), v.null()),
    }),
  ),
  handler: async (ctx, args) => {
    const id = ctx.db.normalizeId("applicationFiles", args.fileId);
    const file = id ? await ctx.db.get("applicationFiles", id) : null;
    if (!file) return null;
    const owner = await ctx.db.get("profiles", file.profileId);
    return {
      storageId: file.storageId,
      name: file.name,
      contentType: file.contentType,
      ownerAuthUserId: owner?.authUserId ?? null,
    };
  },
});

const ERROR_CODES = {
  401: "NOT_SIGNED_IN",
  403: "FORBIDDEN",
  404: "NOT_FOUND",
} as const;

/** A refusal: the status says it all; the body names it for the logs. */
function errorResponse(
  status: keyof typeof ERROR_CODES,
  cors: Record<string, string>,
): Response {
  return new Response(ERROR_CODES[status], {
    status,
    headers: {
      ...cors,
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}

/** `GET /files/{fileId}`: the file itself, if this caller may see it. */
export const serve = httpAction(async (ctx, request) => {
  const cors = corsHeaders(request.headers.get("Origin"), siteOrigins());

  let caller: FileCaller | null = null;
  try {
    const user = await openAuthUser(ctx);
    caller = user
      ? {
          id: user._id,
          email: user.email,
          twoFactorEnabled: user.twoFactorEnabled,
        }
      : null;
  } catch {
    caller = null; // A token that can't be checked is no token at all.
  }
  if (!caller) return errorResponse(401, cors);

  const fileId = fileIdFromPath(new URL(request.url).pathname);
  const file = fileId
    ? await ctx.runQuery(internal.files.lookup, { fileId })
    : null;
  if (!file) return errorResponse(404, cors);
  if (fileAccess(caller, file.ownerAuthUserId) !== "allowed") {
    return errorResponse(403, cors);
  }

  const blob = await ctx.storage.get(file.storageId);
  if (!blob) return errorResponse(404, cors);
  return new Response(blob, {
    status: 200,
    headers: {
      ...cors,
      "Content-Type": file.contentType,
      "Content-Disposition": contentDisposition(file.name),
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
});

/** `OPTIONS /files/{fileId}`: lets the site send the Authorization header. */
export const preflight = httpAction((_ctx, request) =>
  Promise.resolve(
    preflightResponse(request.headers.get("Origin"), siteOrigins()),
  ),
);
