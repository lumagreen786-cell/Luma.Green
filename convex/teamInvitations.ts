import { ConvexError, v } from "convex/values";

import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import {
  action,
  internalMutation,
  mutation,
  query,
  type QueryCtx,
} from "./_generated/server";
import { isPhoneGrantCurrent } from "./lib/accountClosure";
import { hashToken } from "./lib/integrations";
import {
  actor,
  organizationMember,
  requireRecentSession,
  requireScope,
  scopeRole,
  teamAudit,
} from "./lib/organizations";
import { vTeamScope } from "./lib/organizationsSchema";
import { normalizeIndianMobile } from "./lib/phone";
import { requireSubscriptionMemberCapacity } from "./lib/subscriptions";
import { membershipFor } from "./lib/workspace";
import {
  canManageWorkspaceRole,
  INVITATION_TTL_MS,
  MAX_WORKSPACE_MEMBERS,
  MAX_WORKSPACES,
  vInvitationRole,
} from "./lib/workspaceRoles";

const inviteArgs = {
  scope: vTeamScope,
  phone: v.string(),
  role: vInvitationRole,
};
const inviteResult = v.object({
  id: v.id("phoneTeamInvitations"),
  token: v.string(),
});
/** Return once to the inviter for direct sharing. Never log or persist the raw token. */
export const create = action({
  args: inviteArgs,
  returns: inviteResult,
  handler: async (
    ctx,
    args,
  ): Promise<{ id: Id<"phoneTeamInvitations">; token: string }> => {
    const token = Array.from(
      crypto.getRandomValues(new Uint8Array(32)),
      (byte) => byte.toString(16).padStart(2, "0"),
    ).join("");
    const id = await ctx.runMutation(internal.teamInvitations.persist, {
      ...args,
      token,
    });
    return { id, token };
  },
});

export const persist = internalMutation({
  args: { ...inviteArgs, token: v.string() },
  returns: v.id("phoneTeamInvitations"),
  handler: async (ctx, args) => {
    const { profile, role } = await requireScope(ctx, args.scope, "manage");
    await requireRecentSession(ctx);
    if (!canManageWorkspaceRole(role, args.role))
      throw new ConvexError("TEAM_ACCESS_DENIED");
    const phone = normalizeIndianMobile(args.phone);
    if (!phone || !/^[\da-f]{64}$/.test(args.token))
      throw new ConvexError("INVALID_INVITATION");
    const now = Date.now();
    const recent = await ctx.db
      .query("phoneTeamInvitations")
      .withIndex("by_scope_created", (q) =>
        q.eq("scope", args.scope).gt("createdAt", now - INVITATION_TTL_MS),
      )
      .take(100);
    if (
      recent.length >= 100 ||
      recent.filter((invite) => invite.createdAt > now - 3_600_000).length >= 20
    )
      throw new ConvexError("INVITATION_RATE_LIMITED");
    if (
      recent.some(
        (invite) =>
          invite.phone === phone &&
          invite.acceptedAt === undefined &&
          invite.revokedAt === undefined &&
          invite.expiresAt > now,
      )
    )
      throw new ConvexError("INVITATION_EXISTS");
    const id = await ctx.db.insert("phoneTeamInvitations", {
      scope: args.scope,
      phone,
      role: args.role,
      tokenHash: await hashToken(args.token),
      invitedBy: profile._id,
      createdAt: now,
      expiresAt: now + INVITATION_TTL_MS,
    });
    await teamAudit(
      ctx,
      profile._id,
      args.scope,
      "team.phone_invited",
      "phoneTeamInvitations",
      id,
    );
    return id;
  },
});

async function available(ctx: QueryCtx, token: string) {
  const { user, profile } = await actor(ctx);
  if (
    !/^[\da-f]{64}$/.test(token) ||
    !user.phoneNumberVerified ||
    !user.phoneNumber
  )
    throw new ConvexError("INVITATION_UNAVAILABLE");
  const tokenHash = await hashToken(token);
  const invite = await ctx.db
    .query("phoneTeamInvitations")
    .withIndex("by_hash", (q) => q.eq("tokenHash", tokenHash))
    .unique();
  if (
    invite?.phone !== user.phoneNumber ||
    invite.acceptedAt !== undefined ||
    invite.revokedAt !== undefined ||
    invite.expiresAt <= Date.now() ||
    !(await isPhoneGrantCurrent(ctx, user.phoneNumber, invite.createdAt))
  )
    throw new ConvexError("INVITATION_UNAVAILABLE");
  const inviterRole = await scopeRole(ctx, invite.scope, invite.invitedBy);
  if (!inviterRole || !canManageWorkspaceRole(inviterRole, invite.role))
    throw new ConvexError("INVITATION_UNAVAILABLE");
  return { invite, profile };
}

export const preview = query({
  args: { token: v.string() },
  returns: v.union(
    v.null(),
    v.object({ scope: vTeamScope, name: v.string(), role: vInvitationRole }),
  ),
  handler: async (ctx, { token }) => {
    try {
      const { invite } = await available(ctx, token);
      const target =
        invite.scope.kind === "organization"
          ? await ctx.db.get("organizations", invite.scope.id)
          : await ctx.db.get("orgs", invite.scope.id);
      return target
        ? { scope: invite.scope, name: target.name, role: invite.role }
        : null;
    } catch (error) {
      if (error instanceof ConvexError) return null;
      throw error;
    }
  },
});

export const accept = mutation({
  args: { token: v.string() },
  returns: vTeamScope,
  handler: async (ctx, { token }) => {
    const { invite, profile } = await available(ctx, token);
    const scope = invite.scope;
    if (scope.kind === "organization") {
      const member = await organizationMember(ctx, scope.id, profile._id);
      if (!member) {
        const own = await ctx.db
          .query("organizationMemberships")
          .withIndex("by_profile", (q) => q.eq("profileId", profile._id))
          .take(10);
        const members = await ctx.db
          .query("organizationMemberships")
          .withIndex("by_organization", (q) => q.eq("organizationId", scope.id))
          .take(MAX_WORKSPACE_MEMBERS);
        if (own.length >= 10 || members.length >= MAX_WORKSPACE_MEMBERS)
          throw new ConvexError("TEAM_LIMIT");
        await ctx.db.insert("organizationMemberships", {
          organizationId: scope.id,
          profileId: profile._id,
          role: invite.role,
          createdAt: Date.now(),
        });
      }
    } else {
      const member = await membershipFor(ctx, profile._id, scope.id);
      if (!member) {
        const own = await ctx.db
          .query("memberships")
          .withIndex("by_profile", (q) => q.eq("profileId", profile._id))
          .take(MAX_WORKSPACES);
        const members = await ctx.db
          .query("memberships")
          .withIndex("by_org", (q) => q.eq("orgId", scope.id))
          .take(MAX_WORKSPACE_MEMBERS);
        if (
          own.length >= MAX_WORKSPACES ||
          members.length >= MAX_WORKSPACE_MEMBERS
        )
          throw new ConvexError("TEAM_LIMIT");
        await requireSubscriptionMemberCapacity(ctx, scope.id, members.length);
        await ctx.db.insert("memberships", {
          orgId: scope.id,
          profileId: profile._id,
          role: invite.role,
          createdAt: Date.now(),
        });
      }
    }
    await ctx.db.patch("phoneTeamInvitations", invite._id, {
      acceptedAt: Date.now(),
    });
    await teamAudit(
      ctx,
      profile._id,
      scope,
      "team.phone_invitation_accepted",
      "phoneTeamInvitations",
      invite._id,
    );
    return scope;
  },
});

export const list = query({
  args: { scope: vTeamScope },
  returns: v.array(
    v.object({
      id: v.id("phoneTeamInvitations"),
      phone: v.string(),
      role: vInvitationRole,
      expiresAt: v.number(),
      acceptedAt: v.optional(v.number()),
      revokedAt: v.optional(v.number()),
    }),
  ),
  handler: async (ctx, { scope }) => {
    await requireScope(ctx, scope, "manage");
    const invites = await ctx.db
      .query("phoneTeamInvitations")
      .withIndex("by_scope_created", (q) => q.eq("scope", scope))
      .order("desc")
      .take(100);
    return invites.map((invite) => ({
      id: invite._id,
      phone: invite.phone,
      role: invite.role,
      expiresAt: invite.expiresAt,
      acceptedAt: invite.acceptedAt,
      revokedAt: invite.revokedAt,
    }));
  },
});

export const revoke = mutation({
  args: { scope: vTeamScope, invitationId: v.id("phoneTeamInvitations") },
  returns: v.null(),
  handler: async (ctx, { scope, invitationId }) => {
    const { profile, role } = await requireScope(ctx, scope, "manage");
    const invite = await ctx.db.get("phoneTeamInvitations", invitationId);
    if (
      invite?.scope.kind !== scope.kind ||
      invite.scope.id !== scope.id ||
      !canManageWorkspaceRole(role, invite.role)
    )
      throw new ConvexError("TEAM_ACCESS_DENIED");
    if (invite.acceptedAt !== undefined)
      throw new ConvexError("INVITATION_USED");
    if (invite.revokedAt !== undefined) return null;
    await ctx.db.patch("phoneTeamInvitations", invitationId, {
      revokedAt: Date.now(),
    });
    await teamAudit(
      ctx,
      profile._id,
      scope,
      "team.phone_invitation_revoked",
      "phoneTeamInvitations",
      invitationId,
    );
    return null;
  },
});
