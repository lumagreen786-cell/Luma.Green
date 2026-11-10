import { ConvexError, v } from "convex/values";

import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import {
  action,
  internalMutation,
  mutation,
  type MutationCtx,
  query,
  type QueryCtx,
} from "./_generated/server";
import { isPhoneGrantCurrent, isProfileOpen } from "./lib/accountClosure";
import { collectionByToken } from "./lib/collectionAccess";
import { vSaathiTime } from "./lib/drafts";
import {
  familyActor,
  isCurrentFamilyGrant,
  MAX_FAMILY_GRANTS,
} from "./lib/householdFamily";
import { hashToken } from "./lib/integrations";
import {
  actor as authenticatedActor,
  requireRecentSession,
} from "./lib/organizations";
import { normalizeIndianMobile } from "./lib/phone";
import { smsPhoneHash } from "./lib/smsLimits";
import { vBookingStatus } from "./lib/validators";
import { currentProfile } from "./lib/workspace";
import { INVITATION_TTL_MS } from "./lib/workspaceRoles";

const vPermission = v.literal("shared_collection_progress");
const validToken = /^[\da-f]{64}$/;
const INVITE_ATTEMPTS_PER_DAY = 20;
const ONE_DAY_MS = 24 * 60 * 60 * 1000;

async function requireFamilyActor(ctx: QueryCtx) {
  const actor = await familyActor(ctx);
  if (!actor) throw new ConvexError("VERIFIED_PHONE_REQUIRED");
  return actor;
}

async function auditGrant(
  ctx: MutationCtx,
  actorProfileId: Id<"profiles">,
  id: Id<"householdFamilyGrants">,
  action: string,
) {
  await ctx.db.insert("auditLog", {
    actorProfileId,
    action,
    entityTable: "householdFamilyGrants",
    entityId: id,
    createdAt: Date.now(),
  });
}

async function endGrant(
  ctx: MutationCtx,
  actorProfileId: Id<"profiles">,
  id: Id<"householdFamilyGrants">,
) {
  await ctx.db.patch(id, {
    revokedAt: Date.now(),
    tokenHash: undefined,
    phoneHash: undefined,
    phoneLastFour: undefined,
  });
  await auditGrant(ctx, actorProfileId, id, "household.family_ended");
}

async function ownerGrants(ctx: QueryCtx, ownerId: Id<"profiles">) {
  return ctx.db
    .query("householdFamilyGrants")
    .withIndex("by_owner_revoked", (q) =>
      q.eq("ownerProfileId", ownerId).eq("revokedAt", undefined),
    )
    .order("desc")
    .take(MAX_FAMILY_GRANTS);
}

/** Only the inviter receives the code. They share it directly. */
export const invite = action({
  args: {
    phone: v.string(),
    permission: vPermission,
    adultConfirmed: v.literal(true),
  },
  returns: v.string(),
  handler: async (ctx, args): Promise<string> => {
    const token = Array.from(
      crypto.getRandomValues(new Uint8Array(32)),
      (byte) => byte.toString(16).padStart(2, "0"),
    ).join("");
    await ctx.runMutation(internal.householdFamily.persist, { ...args, token });
    return token;
  },
});

export const persist = internalMutation({
  args: {
    phone: v.string(),
    permission: vPermission,
    adultConfirmed: v.literal(true),
    token: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const actor = await requireFamilyActor(ctx);
    await requireRecentSession(ctx);
    const phone = normalizeIndianMobile(args.phone);
    const secret = process.env.BETTER_AUTH_SECRET;
    if (
      !phone ||
      !secret ||
      phone === actor.phone ||
      !validToken.test(args.token)
    )
      throw new ConvexError("INVALID_INVITATION");

    const now = Date.now();
    const recent = await ctx.db
      .query("householdFamilyGrants")
      .withIndex("by_owner_created", (q) =>
        q
          .eq("ownerProfileId", actor.profileId)
          .gt("createdAt", now - ONE_DAY_MS),
      )
      .take(INVITE_ATTEMPTS_PER_DAY);
    if (recent.length >= INVITE_ATTEMPTS_PER_DAY)
      throw new ConvexError("INVITATION_RATE_LIMITED");

    const phoneHash = await smsPhoneHash(phone, secret);
    const existing = await ownerGrants(ctx, actor.profileId);
    let activeCount = 0;
    for (const grant of existing) {
      const isExpired =
        grant.acceptedAt === undefined && grant.expiresAt <= now;
      const closed =
        grant.memberProfileId &&
        !(await isProfileOpen(ctx, grant.memberProfileId));
      const isReplaced =
        grant.phoneHash === phoneHash &&
        !(await isPhoneGrantCurrent(ctx, phone, grant.createdAt));
      if (isExpired || closed || isReplaced) {
        await endGrant(ctx, actor.profileId, grant._id);
        continue;
      }
      if (grant.phoneHash === phoneHash)
        throw new ConvexError("INVITATION_EXISTS");
      activeCount++;
    }
    if (activeCount >= MAX_FAMILY_GRANTS) throw new ConvexError("TEAM_LIMIT");
    const id = await ctx.db.insert("householdFamilyGrants", {
      ownerProfileId: actor.profileId,
      phoneHash,
      phoneLastFour: phone.slice(-4),
      tokenHash: await hashToken(args.token),
      createdAt: now,
      expiresAt: now + INVITATION_TTL_MS,
    });
    await auditGrant(ctx, actor.profileId, id, "household.family_invited");
    return null;
  },
});

export const accept = mutation({
  args: { token: v.string(), adultConfirmed: v.literal(true) },
  returns: v.null(),
  handler: async (ctx, { token }) => {
    const actor = await requireFamilyActor(ctx);
    await requireRecentSession(ctx);
    if (!validToken.test(token))
      throw new ConvexError("INVITATION_UNAVAILABLE");
    const tokenHash = await hashToken(token);
    const grant = await ctx.db
      .query("householdFamilyGrants")
      .withIndex("by_token_hash", (q) => q.eq("tokenHash", tokenHash))
      .unique();
    if (
      grant?.phoneHash !== actor.phoneHash ||
      grant.ownerProfileId === actor.profileId ||
      grant.acceptedAt !== undefined ||
      grant.revokedAt !== undefined ||
      grant.expiresAt <= Date.now() ||
      !(await isProfileOpen(ctx, grant.ownerProfileId)) ||
      !(await isPhoneGrantCurrent(ctx, actor.phone, grant.createdAt))
    )
      throw new ConvexError("INVITATION_UNAVAILABLE");

    const incoming = await memberGrants(ctx, actor.profileId);
    for (const previous of incoming) {
      if (!(await isCurrentFamilyGrant(ctx, previous, actor))) {
        await endGrant(ctx, actor.profileId, previous._id);
      }
    }
    const remaining = await memberGrants(ctx, actor.profileId);
    if (remaining.length >= MAX_FAMILY_GRANTS)
      throw new ConvexError("TEAM_LIMIT");
    await ctx.db.patch(grant._id, {
      acceptedAt: Date.now(),
      memberProfileId: actor.profileId,
      tokenHash: undefined,
    });
    await auditGrant(
      ctx,
      actor.profileId,
      grant._id,
      "household.family_accepted",
    );
    return null;
  },
});

async function memberGrants(ctx: QueryCtx, profileId: Id<"profiles">) {
  return ctx.db
    .query("householdFamilyGrants")
    .withIndex("by_member_revoked", (q) =>
      q.eq("memberProfileId", profileId).eq("revokedAt", undefined),
    )
    .take(MAX_FAMILY_GRANTS);
}

export const mine = query({
  args: {},
  returns: v.union(
    v.null(),
    v.object({
      canInvite: v.boolean(),
      invited: v.array(
        v.object({
          id: v.id("householdFamilyGrants"),
          phoneLastFour: v.string(),
          accepted: v.boolean(),
        }),
      ),
      joined: v.array(
        v.object({
          id: v.id("householdFamilyGrants"),
          acceptedAt: v.number(),
        }),
      ),
    }),
  ),
  handler: async (ctx) => {
    const profile = await currentProfile(ctx);
    if (!profile) return null;
    const owned = await ownerGrants(ctx, profile._id);
    const invited = owned.flatMap((row) =>
      row.phoneLastFour &&
      (row.acceptedAt !== undefined || row.expiresAt > Date.now())
        ? [
            {
              id: row._id,
              phoneLastFour: row.phoneLastFour,
              accepted: row.acceptedAt !== undefined,
            },
          ]
        : [],
    );
    // Keep a way to leave after a phone change, without revealing the owner.
    const memberships = await memberGrants(ctx, profile._id);
    const joined = memberships.flatMap((row) =>
      row.acceptedAt === undefined
        ? []
        : [{ id: row._id, acceptedAt: row.acceptedAt }],
    );
    return { canInvite: Boolean(await familyActor(ctx)), invited, joined };
  },
});

export const revoke = mutation({
  args: { id: v.id("householdFamilyGrants") },
  returns: v.null(),
  handler: async (ctx, { id }) => {
    const { profile } = await authenticatedActor(ctx);
    const grant = await ctx.db.get("householdFamilyGrants", id);
    if (
      !grant ||
      (grant.ownerProfileId !== profile._id &&
        grant.memberProfileId !== profile._id)
    )
      throw new ConvexError("NOT_YOURS");
    if (grant.revokedAt !== undefined) return null;
    await endGrant(ctx, profile._id, id);
    return null;
  },
});

export const shareCollection = mutation({
  args: { token: v.string(), share: v.boolean() },
  returns: v.null(),
  handler: async (ctx, { token, share }) => {
    const { profile } = await authenticatedActor(ctx);
    const booking = await collectionByToken(ctx, token);
    if (booking.householdProfileId !== profile._id)
      throw new ConvexError("NOT_YOURS");
    if (Boolean(booking.sharedWithFamily) === share) return null;
    if (share) {
      await requireFamilyActor(ctx);
      await requireRecentSession(ctx);
    }
    await ctx.db.patch(booking._id, { sharedWithFamily: share });
    await ctx.db.insert("auditLog", {
      actorProfileId: profile._id,
      action: share
        ? "household.collection_shared"
        : "household.collection_private",
      entityTable: "bookings",
      entityId: booking._id,
      createdAt: Date.now(),
    });
    return null;
  },
});

export const collections = query({
  args: {},
  returns: v.array(
    v.object({
      token: v.string(),
      shopName: v.string(),
      status: vBookingStatus,
      slotDate: v.string(),
      slotWindow: vSaathiTime,
      createdAt: v.number(),
    }),
  ),
  handler: async (ctx) => {
    const actor = await familyActor(ctx);
    if (!actor) return [];
    const grants = await memberGrants(ctx, actor.profileId);
    const result = [];
    for (const grant of grants) {
      if (!(await isCurrentFamilyGrant(ctx, grant, actor))) continue;
      const rows = await ctx.db
        .query("bookings")
        .withIndex("by_household_family", (q) =>
          q
            .eq("householdProfileId", grant.ownerProfileId)
            .eq("sharedWithFamily", true),
        )
        .order("desc")
        .take(10);
      for (const row of rows) {
        const shop = await ctx.db.get("orgs", row.orgId);
        if (shop)
          result.push({
            token: row.token,
            shopName: shop.name,
            status: row.status,
            slotDate: row.slotDate,
            slotWindow: row.slotWindow,
            createdAt: row.createdAt,
          });
      }
    }
    return result.toSorted((a, b) => b.createdAt - a.createdAt).slice(0, 10);
  },
});
