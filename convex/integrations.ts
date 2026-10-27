import { ConvexError, type Infer, v } from "convex/values";

import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import {
  action,
  internalMutation,
  mutation,
  query,
  type QueryCtx,
} from "./_generated/server";
import { requireUser } from "./lib/access";
import { paymentVerificationFor } from "./lib/chain";
import {
  hashToken,
  INTEGRATION_DAY_MS,
  INTEGRATION_MAX_KEYS,
  INTEGRATION_MAX_PAGE_SIZE,
  INTEGRATION_ORG_RATE_LIMIT,
  INTEGRATION_RATE_LIMIT,
  INTEGRATION_RATE_WINDOW_MS,
  type IntegrationReadBody,
  type IntegrationReadResult,
  type IntegrationResource,
  integrationResourceScopes,
  type IntegrationScope,
  integrationScopes,
  isInvalidIntegrationCursor,
  vIntegrationResource,
  vIntegrationScope,
} from "./lib/integrations";
import { requireOrg } from "./lib/workspace";

const keyArguments = {
  label: v.string(),
  scopes: v.array(vIntegrationScope),
  expiresInDays: v.number(),
};
const keySummary = v.object({
  id: v.id("integrationKeys"),
  label: v.string(),
  prefix: v.string(),
  scopes: v.array(vIntegrationScope),
  createdAt: v.number(),
  expiresAt: v.number(),
  revokedAt: v.optional(v.number()),
  lastUsedAt: v.optional(v.number()),
});

async function isOwner(
  ctx: QueryCtx,
  orgId: Id<"orgs">,
  profileId: Id<"profiles">,
): Promise<boolean> {
  const membership = await ctx.db
    .query("memberships")
    .withIndex("by_org_profile", (q) =>
      q.eq("orgId", orgId).eq("profileId", profileId),
    )
    .first();
  return membership?.role === "owner";
}

async function requireOwner(ctx: QueryCtx) {
  const { org, profile } = await requireOrg(ctx);
  if (!(await isOwner(ctx, org._id, profile._id)))
    throw new ConvexError("API_OWNER_REQUIRED");
  return { org, profile };
}

function validateKeyInput(args: {
  label: string;
  scopes: IntegrationScope[];
  expiresInDays: number;
}) {
  if (
    args.label.trim().length === 0 ||
    args.label.trim().length > 80 ||
    /[\u{0000}-\u{001F}\u{007F}]/u.test(args.label) ||
    args.scopes.length === 0 ||
    args.scopes.length > integrationScopes.length ||
    new Set(args.scopes).size !== args.scopes.length ||
    !Number.isSafeInteger(args.expiresInDays) ||
    args.expiresInDays < 1 ||
    args.expiresInDays > 90
  )
    throw new ConvexError("API_INVALID_KEY_SETTINGS");
}

interface KeyListResult {
  canManage: boolean;
  keys: Infer<typeof keySummary>[];
}

export const listKeys = query({
  args: {},
  returns: v.object({ canManage: v.boolean(), keys: v.array(keySummary) }),
  handler: async (ctx): Promise<KeyListResult> => {
    const { org, profile } = await requireOrg(ctx, undefined, "read");
    if (!(await isOwner(ctx, org._id, profile._id)))
      return { canManage: false, keys: [] };
    const active = await ctx.db
      .query("integrationKeys")
      .withIndex("by_org_revoked_expires", (q) =>
        q
          .eq("orgId", org._id)
          .eq("revokedAt", undefined)
          .gt("expiresAt", Date.now()),
      )
      .take(INTEGRATION_MAX_KEYS);
    const recent = await ctx.db
      .query("integrationKeys")
      .withIndex("by_org_created", (q) => q.eq("orgId", org._id))
      .order("desc")
      .take(50);
    const keys = [
      ...new Map([...active, ...recent].map((key) => [key._id, key])).values(),
    ]
      .toSorted((a, b) => b.createdAt - a.createdAt)
      .map((key) => ({
        id: key._id,
        label: key.label,
        prefix: key.prefix,
        scopes: key.scopes,
        createdAt: key.createdAt,
        expiresAt: key.expiresAt,
        revokedAt: key.revokedAt,
        lastUsedAt: key.lastUsedAt,
      }));
    return { canManage: org.status === "active", keys };
  },
});

interface CreateKeyResult {
  token: string;
  keyId: Id<"integrationKeys">;
  expiresAt: number;
}

// Convex actions are callable RPC definitions.
// eslint-disable-next-line unicorn/no-non-function-verb-prefix -- this public RPC creates a key.
export const createKey = action({
  args: keyArguments,
  returns: v.object({
    token: v.string(),
    keyId: v.id("integrationKeys"),
    expiresAt: v.number(),
  }),
  handler: async (ctx, args): Promise<CreateKeyResult> => {
    await requireUser(ctx);
    validateKeyInput(args);
    const bytes = crypto.getRandomValues(new Uint8Array(32));
    const token = `lg_live_${Array.from(bytes, (byte) =>
      byte.toString(16).padStart(2, "0"),
    ).join("")}`;
    const persisted = await ctx.runMutation(internal.integrations.persistKey, {
      ...args,
      keyHash: await hashToken(token),
      prefix: token.slice(0, 16),
    });
    return { token, ...persisted };
  },
});

/** Recheck the live session and ownership inside the write transaction. */
export const persistKey = internalMutation({
  args: { ...keyArguments, keyHash: v.string(), prefix: v.string() },
  returns: v.object({ keyId: v.id("integrationKeys"), expiresAt: v.number() }),
  handler: async (ctx, args) => {
    const { org, profile } = await requireOwner(ctx);
    validateKeyInput(args);
    if (
      !/^[\da-f]{64}$/.test(args.keyHash) ||
      !/^lg_live_[\da-f]{8}$/.test(args.prefix)
    )
      throw new ConvexError("API_INVALID_KEY_SETTINGS");
    const now = Date.now();
    const active = await ctx.db
      .query("integrationKeys")
      .withIndex("by_org_revoked_expires", (q) =>
        q.eq("orgId", org._id).eq("revokedAt", undefined).gt("expiresAt", now),
      )
      .take(INTEGRATION_MAX_KEYS);
    if (active.length >= INTEGRATION_MAX_KEYS)
      throw new ConvexError("API_KEY_LIMIT");
    const duplicate = await ctx.db
      .query("integrationKeys")
      .withIndex("by_hash", (q) => q.eq("keyHash", args.keyHash))
      .unique();
    if (duplicate) throw new ConvexError("API_DUPLICATE_KEY");
    const expiresAt = now + args.expiresInDays * INTEGRATION_DAY_MS;
    const keyId = await ctx.db.insert("integrationKeys", {
      orgId: org._id,
      issuerProfileId: profile._id,
      label: args.label.trim(),
      prefix: args.prefix,
      keyHash: args.keyHash,
      scopes: args.scopes,
      createdAt: now,
      expiresAt,
      windowStartedAt: 0,
      requestsInWindow: 0,
    });
    await ctx.db.insert("auditLog", {
      orgId: org._id,
      actorProfileId: profile._id,
      action: "integration.key_created",
      entityTable: "integrationKeys",
      entityId: keyId,
      metadata: { keyId, scopes: args.scopes },
      createdAt: now,
    });
    return { keyId, expiresAt };
  },
});

export const revokeKey = mutation({
  args: { keyId: v.id("integrationKeys") },
  returns: v.null(),
  handler: async (ctx, { keyId }) => {
    const { org, profile } = await requireOwner(ctx);
    const key = await ctx.db.get("integrationKeys", keyId);
    if (key?.orgId !== org._id) throw new ConvexError("API_KEY_NOT_FOUND");
    if (key.revokedAt !== undefined) return null;
    const now = Date.now();
    await ctx.db.patch("integrationKeys", keyId, { revokedAt: now });
    await ctx.db.insert("auditLog", {
      orgId: org._id,
      actorProfileId: profile._id,
      action: "integration.key_revoked",
      entityTable: "integrationKeys",
      entityId: keyId,
      metadata: { keyId, scopes: key.scopes },
      createdAt: now,
    });
    return null;
  },
});

function failure(
  status: number,
  code: string,
  retryAfter: number | null = null,
): IntegrationReadResult {
  return {
    status,
    body: JSON.stringify({ error: { code } }),
    remaining: status === 429 ? 0 : null,
    retryAfter,
  };
}

function validateReadArguments(args: {
  resource: IntegrationResource;
  limit: number;
  cursor: string | null;
}): IntegrationReadResult | null {
  const maximum = args.resource === "news" ? 20 : INTEGRATION_MAX_PAGE_SIZE;
  if (
    !Number.isSafeInteger(args.limit) ||
    args.limit < 1 ||
    args.limit > maximum
  )
    return failure(400, "INVALID_REQUEST");
  return args.cursor !== null &&
    (args.cursor.length === 0 ||
      args.cursor.length > 4096 ||
      args.resource === "organization" ||
      args.resource === "news")
    ? failure(400, "INVALID_CURSOR")
    : null;
}

function requireExactAmounts(...amounts: number[]): void {
  if (amounts.some((amount) => !Number.isSafeInteger(amount) || amount < 0))
    throw new Error("INVALID_LEDGER_AMOUNT");
}

async function readResource(
  ctx: QueryCtx,
  org: Doc<"orgs">,
  args: {
    resource: IntegrationResource;
    limit: number;
    cursor: string | null;
    side: "buyer" | "seller";
  },
): Promise<IntegrationReadBody> {
  const pagination = { numItems: args.limit, cursor: args.cursor };
  switch (args.resource) {
    case "news": {
      return { data: { families: org.families } };
    }
    case "organization": {
      return {
        data: {
          id: org._id,
          name: org.name,
          kind: org.kind,
          city: org.city,
          families: org.families,
        },
      };
    }
    case "materials": {
      const result = await ctx.db
        .query("materials")
        .withIndex("by_sortOrder")
        .paginate(pagination);
      return {
        data: result.page
          .filter((row) => row.active)
          .map((row) => ({
            code: row.code,
            names: row.names,
            family: row.family,
            stage: row.stage,
          })),
        pagination: {
          nextCursor: result.isDone ? null : result.continueCursor,
          isDone: result.isDone,
        },
      };
    }
    case "inventory": {
      const result = await ctx.db
        .query("inventory")
        .withIndex("by_org", (q) => q.eq("orgId", org._id))
        .paginate(pagination);
      for (const row of result.page) requireExactAmounts(row.grams);
      return {
        data: result.page.map((row) => ({
          materialCode: row.materialCode,
          grams: row.grams,
          updatedAt: row.updatedAt,
        })),
        pagination: {
          nextCursor: result.isDone ? null : result.continueCursor,
          isDone: result.isDone,
        },
      };
    }
    case "trades": {
      const source =
        args.side === "buyer"
          ? ctx.db
              .query("trades")
              .withIndex("by_buyer", (q) => q.eq("buyerOrgId", org._id))
          : ctx.db
              .query("trades")
              .withIndex("by_seller", (q) => q.eq("sellerOrgId", org._id));
      const result = await source.order("desc").paginate(pagination);
      for (const row of result.page)
        requireExactAmounts(row.grams, row.paisePerKg, row.totalPaise);
      return {
        data: result.page.map((row) => ({
          id: row._id,
          side: args.side,
          materialCode: row.materialCode,
          grams: row.grams,
          paisePerKg: row.paisePerKg,
          totalPaise: row.totalPaise,
          status: row.status,
          createdAt: row.createdAt,
          updatedAt: row.updatedAt,
          invoiceNo: null,
          legacyReceiptNo: row.invoiceNo ?? null,
          paymentMode: "gateway_required" as const,
          paymentVerification: paymentVerificationFor(row.status),
          gatewayRequired: true as const,
        })),
        pagination: {
          nextCursor: result.isDone ? null : result.continueCursor,
          isDone: result.isDone,
        },
      };
    }
  }
}

/** The only machine-data entry point. Authorisation, metering and audit commit together. */
export const read = internalMutation({
  args: {
    keyHash: v.string(),
    resource: vIntegrationResource,
    limit: v.number(),
    cursor: v.union(v.string(), v.null()),
    side: v.union(v.literal("buyer"), v.literal("seller")),
  },
  returns: v.object({
    status: v.number(),
    body: v.string(),
    remaining: v.union(v.number(), v.null()),
    retryAfter: v.union(v.number(), v.null()),
  }),
  handler: async (ctx, args): Promise<IntegrationReadResult> => {
    if (!/^[\da-f]{64}$/.test(args.keyHash))
      return failure(401, "INVALID_API_KEY");
    const key = await ctx.db
      .query("integrationKeys")
      .withIndex("by_hash", (q) => q.eq("keyHash", args.keyHash))
      .unique();
    const now = Date.now();
    if (!key || key.revokedAt !== undefined || key.expiresAt <= now)
      return failure(401, "INVALID_API_KEY");
    const org = await ctx.db.get("orgs", key.orgId);
    const issuer = await ctx.db.get("profiles", key.issuerProfileId);
    if (!issuer || issuer.closedAt !== undefined || org?.status !== "active")
      return failure(403, "ACCESS_DENIED");
    if (!(await isOwner(ctx, org._id, issuer._id)))
      return failure(403, "ACCESS_DENIED");
    const scope = integrationResourceScopes[args.resource];
    if (!key.scopes.includes(scope)) return failure(403, "INSUFFICIENT_SCOPE");
    const invalidArguments = validateReadArguments(args);
    if (invalidArguments) return invalidArguments;
    const windowStartedAt =
      Math.floor(now / INTEGRATION_RATE_WINDOW_MS) * INTEGRATION_RATE_WINDOW_MS;
    const keyCount =
      key.windowStartedAt === windowStartedAt ? key.requestsInWindow : 0;
    const usage = await ctx.db
      .query("integrationUsage")
      .withIndex("by_org", (q) => q.eq("orgId", org._id))
      .unique();
    const orgCount =
      usage?.windowStartedAt === windowStartedAt ? usage.requestsInWindow : 0;
    if (
      keyCount >= INTEGRATION_RATE_LIMIT ||
      orgCount >= INTEGRATION_ORG_RATE_LIMIT
    )
      return failure(
        429,
        "RATE_LIMITED",
        Math.ceil((windowStartedAt + INTEGRATION_RATE_WINDOW_MS - now) / 1000),
      );
    let body: IntegrationReadBody;
    try {
      body = await readResource(ctx, org, args);
    } catch (error) {
      if (isInvalidIntegrationCursor(error))
        return failure(400, "INVALID_CURSOR");
      throw error;
    }
    await ctx.db.patch("integrationKeys", key._id, {
      lastUsedAt: now,
      windowStartedAt,
      requestsInWindow: keyCount + 1,
    });
    const usageFields = { windowStartedAt, requestsInWindow: orgCount + 1 };
    if (usage) await ctx.db.patch("integrationUsage", usage._id, usageFields);
    else
      await ctx.db.insert("integrationUsage", {
        orgId: org._id,
        ...usageFields,
      });
    await ctx.db.insert("auditLog", {
      orgId: org._id,
      actorProfileId: key.issuerProfileId,
      action:
        args.resource === "news"
          ? "integration.news_requested"
          : "integration.read",
      entityTable: "integrationKeys",
      entityId: key._id,
      metadata: { keyId: key._id, scope },
      createdAt: now,
    });
    return {
      status: 200,
      body: JSON.stringify(body),
      remaining: Math.min(
        INTEGRATION_RATE_LIMIT - keyCount - 1,
        INTEGRATION_ORG_RATE_LIMIT - orgCount - 1,
      ),
      retryAfter: null,
    };
  },
});
