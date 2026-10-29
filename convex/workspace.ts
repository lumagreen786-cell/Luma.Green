import { ConvexError, v } from "convex/values";

import { isLocale } from "../src/i18n/locales";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import {
  action,
  internalMutation,
  mutation,
  type MutationCtx,
  query,
  type QueryCtx,
} from "./_generated/server";
import { authComponent } from "./auth";
import { requireUser } from "./lib/access";
import { isPhoneGrantCurrent } from "./lib/accountClosure";
import { findApplication, findProfile } from "./lib/applicationAccess";
import { vApplicationKind, vApplicationStatus } from "./lib/drafts";
import { hashToken } from "./lib/integrations";
import { requireSubscriptionMemberCapacity } from "./lib/subscriptions";
import { vOrgSummary } from "./lib/views";
import {
  currentProfile,
  findSaathiFor,
  membershipFor,
  requireOrg,
  selectedMembership,
} from "./lib/workspace";
import {
  canManageWorkspaceRole,
  hasWorkspacePermission,
  INVITATION_TTL_MS,
  invitationEmail,
  MAX_WORKSPACE_MEMBERS,
  MAX_WORKSPACES,
  vInvitationRole,
  vWorkspaceRole,
  type WorkspaceRole,
  workspaceRole,
} from "./lib/workspaceRoles";

/**
 * Where the signed-in person works: their business, their Saathi profile, or
 * nothing yet (then the app sends them to their application). Null when
 * signed out.
 */
export const mine = query({
  args: {},
  returns: v.union(
    v.null(),
    v.object({
      kind: v.literal("org"),
      org: vOrgSummary,
      role: vWorkspaceRole,
    }),
    v.object({ kind: v.literal("selectionRequired") }),
    v.object({
      kind: v.literal("saathi"),
      saathi: v.object({
        name: v.string(),
        area: v.string(),
        city: v.string(),
      }),
    }),
    v.object({
      kind: v.literal("none"),
      application: v.union(
        v.null(),
        v.object({ kind: vApplicationKind, status: vApplicationStatus }),
      ),
    }),
  ),
  handler: async (ctx) => {
    const profile = await currentProfile(ctx);
    if (!profile) return null;
    const selected = await selectedMembership(ctx, profile._id, true);
    if (selected) {
      const { org, membership } = selected;
      return {
        kind: "org" as const,
        role:
          org.status === "suspended"
            ? ("viewer" as const)
            : workspaceRole(membership.role),
        org: {
          id: org._id,
          kind: org.kind,
          name: org.name,
          slug: org.slug,
          area: org.area,
          city: org.city,
          offersPickup: org.offersPickup,
          gstin: org.gstin,
        },
      };
    }
    // A removed or suspended selection must offer recovery, never silently switch.
    if (profile.activeOrgId) return { kind: "selectionRequired" as const };
    const saathi = await findSaathiFor(ctx, profile._id);
    if (saathi) {
      return {
        kind: "saathi" as const,
        saathi: { name: saathi.name, area: saathi.area, city: saathi.city },
      };
    }
    const application = await findApplication(ctx, profile._id);
    return {
      kind: "none" as const,
      application: application
        ? { kind: application.kind, status: application.status }
        : null,
    };
  },
});

const vWorkspaceSummary = v.object({
  org: vOrgSummary,
  role: vWorkspaceRole,
  selected: v.boolean(),
});

function orgSummary(org: Doc<"orgs">) {
  return {
    id: org._id,
    kind: org.kind,
    name: org.name,
    slug: org.slug,
    area: org.area,
    city: org.city,
    offersPickup: org.offersPickup,
    gstin: org.gstin,
  };
}

export const list = query({
  args: {},
  returns: v.array(vWorkspaceSummary),
  handler: async (ctx) => {
    const user = await requireUser(ctx);
    const profile = await findProfile(ctx, user._id);
    if (!profile) return [];
    const selected = await selectedMembership(ctx, profile._id);
    const memberships = await ctx.db
      .query("memberships")
      .withIndex("by_profile", (q) => q.eq("profileId", profile._id))
      .take(MAX_WORKSPACES + 1);
    if (memberships.length > MAX_WORKSPACES)
      throw new ConvexError("TOO_MANY_WORKSPACES");
    const rows = [];
    for (const membership of memberships) {
      const org = await ctx.db.get("orgs", membership.orgId);
      if (org?.status === "active")
        rows.push({
          org: orgSummary(org),
          role: workspaceRole(membership.role),
          selected: org._id === selected?.org._id,
        });
    }
    return rows;
  },
});

export const select = mutation({
  args: { orgId: v.id("orgs") },
  returns: v.null(),
  handler: async (ctx, { orgId }) => {
    const user = await requireUser(ctx);
    const profile = await findProfile(ctx, user._id);
    if (!profile) throw new ConvexError("NO_PROFILE");
    const membership = await membershipFor(ctx, profile._id, orgId);
    const org = await ctx.db.get("orgs", orgId);
    if (!membership || org?.status !== "active")
      throw new ConvexError("WORKSPACE_PERMISSION_DENIED");
    await ctx.db.patch("profiles", profile._id, {
      activeOrgId: orgId,
      updatedAt: Date.now(),
    });
    await auditWorkspace(
      ctx,
      orgId,
      profile._id,
      workspaceRole(membership.role),
      "workspace.selected",
      "orgs",
      orgId,
    );
    return null;
  },
});

async function auditWorkspace(
  ctx: MutationCtx,
  orgId: Id<"orgs">,
  actorProfileId: Id<"profiles">,
  actorRole: WorkspaceRole,
  action: string,
  entityTable: string,
  entityId: string,
  metadata: { role?: WorkspaceRole; previousRole?: WorkspaceRole } = {},
) {
  await ctx.db.insert("auditLog", {
    orgId,
    actorProfileId,
    action,
    entityTable,
    entityId,
    metadata: { actorRole, ...metadata },
    createdAt: Date.now(),
  });
}

async function requireSelectedOrg(
  ctx: QueryCtx,
  orgId: Id<"orgs">,
  permission: "read" | "manage",
) {
  const access = await requireOrg(ctx, undefined, permission);
  if (access.org._id !== orgId) throw new ConvexError("WORKSPACE_CHANGED");
  return access;
}

const vRosterMember = v.object({
  id: v.id("memberships"),
  profileId: v.id("profiles"),
  name: v.string(),
  role: vWorkspaceRole,
  isSelf: v.boolean(),
  canManage: v.boolean(),
});
const vInviteSummary = v.object({
  id: v.id("workspaceInvitations"),
  email: v.string(),
  role: vInvitationRole,
  expiresAt: v.number(),
  delivery: v.union(
    v.literal("pending"),
    v.literal("accepted"),
    v.literal("failed"),
  ),
  canManage: v.boolean(),
});

export const team = query({
  args: { orgId: v.id("orgs") },
  returns: v.object({
    role: vWorkspaceRole,
    members: v.array(vRosterMember),
    invitations: v.array(vInviteSummary),
  }),
  handler: async (ctx, { orgId }) => {
    const access = await requireSelectedOrg(ctx, orgId, "read");
    const memberships = await ctx.db
      .query("memberships")
      .withIndex("by_org", (q) => q.eq("orgId", orgId))
      .take(MAX_WORKSPACE_MEMBERS + 1);
    if (memberships.length > MAX_WORKSPACE_MEMBERS)
      throw new ConvexError("TEAM_LIMIT");
    const members = await Promise.all(
      memberships.map(async (membership) => {
        const profile = await ctx.db.get("profiles", membership.profileId);
        const user = profile
          ? await authComponent.getAnyUserById(ctx, profile.authUserId)
          : null;
        const role = workspaceRole(membership.role);
        return {
          id: membership._id,
          profileId: membership.profileId,
          name: user?.name ?? "",
          role,
          isSelf: access.profile._id === membership.profileId,
          canManage: canManageWorkspaceRole(access.role, role),
        };
      }),
    );
    const invitations = [];
    if (hasWorkspacePermission(access.role, "manage")) {
      const recent = await ctx.db
        .query("workspaceInvitations")
        .withIndex("by_org_created", (q) => q.eq("orgId", orgId))
        .order("desc")
        .take(100);
      for (const invite of recent) {
        if (
          invite.acceptedAt !== undefined ||
          invite.revokedAt !== undefined ||
          invite.expiresAt <= Date.now()
        )
          continue;
        invitations.push({
          id: invite._id,
          email: invite.email,
          role: invite.role,
          expiresAt: invite.expiresAt,
          delivery: invite.delivery,
          canManage: canManageWorkspaceRole(access.role, invite.role),
        });
      }
    }
    return { role: access.role, members, invitations };
  },
});

async function targetMember(
  ctx: MutationCtx,
  orgId: Id<"orgs">,
  membershipId: Id<"memberships">,
) {
  const access = await requireSelectedOrg(ctx, orgId, "manage");
  const target = await ctx.db.get("memberships", membershipId);
  if (target?.orgId !== orgId)
    throw new ConvexError("WORKSPACE_PERMISSION_DENIED");
  if (!canManageWorkspaceRole(access.role, workspaceRole(target.role)))
    throw new ConvexError("WORKSPACE_PERMISSION_DENIED");
  return { ...access, target };
}

async function protectOwner(
  ctx: MutationCtx,
  org: Doc<"orgs">,
  target: Doc<"memberships">,
) {
  if (target.role !== "owner") return;
  const members = await ctx.db
    .query("memberships")
    .withIndex("by_org", (q) => q.eq("orgId", org._id))
    .take(MAX_WORKSPACE_MEMBERS + 1);
  if (members.length > MAX_WORKSPACE_MEMBERS)
    throw new ConvexError("TEAM_LIMIT");
  const successor = members.find(
    (member) => member.role === "owner" && member._id !== target._id,
  );
  if (!successor) throw new ConvexError("LAST_OWNER_REQUIRED");
  // The contact pointer is derived from membership; it cannot preserve former access.
  if (org.ownerProfileId === target.profileId)
    await ctx.db.patch("orgs", org._id, {
      ownerProfileId: successor.profileId,
      updatedAt: Date.now(),
    });
}

export const changeRole = mutation({
  args: {
    orgId: v.id("orgs"),
    membershipId: v.id("memberships"),
    role: vWorkspaceRole,
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { profile, org, role, target } = await targetMember(
      ctx,
      args.orgId,
      args.membershipId,
    );
    if (!canManageWorkspaceRole(role, args.role))
      throw new ConvexError("WORKSPACE_PERMISSION_DENIED");
    if (workspaceRole(target.role) === args.role) return null;
    if (args.role !== "owner") await protectOwner(ctx, org, target);
    await ctx.db.patch("memberships", target._id, { role: args.role });
    await auditWorkspace(
      ctx,
      org._id,
      profile._id,
      role,
      "workspace.role_changed",
      "memberships",
      target._id,
      { previousRole: workspaceRole(target.role), role: args.role },
    );
    return null;
  },
});

// eslint-disable-next-line unicorn/no-non-function-verb-prefix -- Convex registrations are callable mutations.
export const removeMember = mutation({
  args: { orgId: v.id("orgs"), membershipId: v.id("memberships") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { profile, org, role, target } = await targetMember(
      ctx,
      args.orgId,
      args.membershipId,
    );
    await protectOwner(ctx, org, target);
    await ctx.db.delete("memberships", target._id);
    // Keep stale selection in place. The next access fails closed until the user chooses another workspace.
    await auditWorkspace(
      ctx,
      org._id,
      profile._id,
      role,
      "workspace.member_removed",
      "memberships",
      target._id,
      { previousRole: workspaceRole(target.role) },
    );
    return null;
  },
});

const invitationArgs = {
  orgId: v.id("orgs"),
  email: v.string(),
  role: vInvitationRole,
  locale: v.string(),
};
export const invite = action({
  args: invitationArgs,
  returns: v.id("workspaceInvitations"),
  handler: async (ctx, args): Promise<Id<"workspaceInvitations">> => {
    await requireUser(ctx);
    const token = Array.from(
      crypto.getRandomValues(new Uint8Array(32)),
      (byte) => byte.toString(16).padStart(2, "0"),
    ).join("");
    return ctx.runMutation(internal.workspace.persistInvitation, {
      ...args,
      email: invitationEmail(args.email),
      token,
    });
  },
});

export const persistInvitation = internalMutation({
  args: { ...invitationArgs, token: v.string() },
  returns: v.id("workspaceInvitations"),
  handler: async (ctx, args) => {
    const { org, profile, role } = await requireSelectedOrg(
      ctx,
      args.orgId,
      "manage",
    );
    if (!canManageWorkspaceRole(role, args.role))
      throw new ConvexError("WORKSPACE_PERMISSION_DENIED");
    if (!isLocale(args.locale) || !/^[\da-f]{64}$/.test(args.token))
      throw new ConvexError("INVALID_INVITATION");
    const email = invitationEmail(args.email);
    const now = Date.now();
    const recent = await ctx.db
      .query("workspaceInvitations")
      .withIndex("by_org_created", (q) =>
        q.eq("orgId", org._id).gt("createdAt", now - INVITATION_TTL_MS),
      )
      .take(101);
    if (
      recent.length >= 100 ||
      recent.filter((invite) => invite.createdAt > now - 60 * 60 * 1000)
        .length >= 20
    )
      throw new ConvexError("INVITATION_RATE_LIMITED");
    if (
      recent.some(
        (invite) =>
          invite.email === email &&
          invite.acceptedAt === undefined &&
          invite.revokedAt === undefined &&
          invite.expiresAt > now,
      )
    )
      throw new ConvexError("INVITATION_EXISTS");
    const id = await ctx.db.insert("workspaceInvitations", {
      orgId: org._id,
      email,
      role: args.role,
      tokenHash: await hashToken(args.token),
      invitedBy: profile._id,
      createdAt: now,
      expiresAt: now + INVITATION_TTL_MS,
      delivery: "pending",
    });
    await auditWorkspace(
      ctx,
      org._id,
      profile._id,
      role,
      "workspace.invited",
      "workspaceInvitations",
      id,
      { role: args.role },
    );
    await ctx.scheduler.runAfter(0, internal.workspaceEmail.sendInvitation, {
      invitationId: id,
      token: args.token,
      locale: args.locale,
    });
    return id;
  },
});

export const revokeInvitation = mutation({
  args: { orgId: v.id("orgs"), invitationId: v.id("workspaceInvitations") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { org, profile, role } = await requireSelectedOrg(
      ctx,
      args.orgId,
      "manage",
    );
    const invite = await ctx.db.get("workspaceInvitations", args.invitationId);
    if (invite?.orgId !== org._id || !canManageWorkspaceRole(role, invite.role))
      throw new ConvexError("WORKSPACE_PERMISSION_DENIED");
    if (invite.acceptedAt !== undefined)
      throw new ConvexError("INVITATION_USED");
    if (invite.revokedAt !== undefined) return null;
    await ctx.db.patch("workspaceInvitations", invite._id, {
      revokedAt: Date.now(),
    });
    await auditWorkspace(
      ctx,
      org._id,
      profile._id,
      role,
      "workspace.invitation_revoked",
      "workspaceInvitations",
      invite._id,
    );
    return null;
  },
});

async function activeInvitation(ctx: QueryCtx, token: string) {
  if (!/^[\da-f]{64}$/.test(token))
    throw new ConvexError("INVITATION_UNAVAILABLE");
  const tokenHash = await hashToken(token);
  const invite = await ctx.db
    .query("workspaceInvitations")
    .withIndex("by_hash", (q) => q.eq("tokenHash", tokenHash))
    .unique();
  if (
    !invite ||
    invite.acceptedAt !== undefined ||
    invite.revokedAt !== undefined ||
    invite.expiresAt <= Date.now()
  )
    throw new ConvexError("INVITATION_UNAVAILABLE");
  const org = await ctx.db.get("orgs", invite.orgId);
  const inviter = await membershipFor(ctx, invite.invitedBy, invite.orgId);
  if (
    !inviter ||
    org?.status !== "active" ||
    !canManageWorkspaceRole(workspaceRole(inviter.role), invite.role)
  )
    throw new ConvexError("INVITATION_UNAVAILABLE");
  return { invite, org };
}

export const invitation = query({
  args: { token: v.string() },
  returns: v.union(
    v.object({ status: v.literal("verifyEmail") }),
    v.object({ status: v.literal("unavailable") }),
    v.object({
      status: v.literal("ready"),
      orgName: v.string(),
      role: vInvitationRole,
    }),
  ),
  handler: async (ctx, { token }) => {
    try {
      const user = await requireUser(ctx);
      if (!user.emailVerified) return { status: "verifyEmail" as const };
      const { invite, org } = await activeInvitation(ctx, token);
      if (
        user.phoneNumber &&
        !(await isPhoneGrantCurrent(ctx, user.phoneNumber, invite.createdAt))
      )
        throw new ConvexError("INVITATION_UNAVAILABLE");
      return invitationEmail(user.email) === invite.email
        ? { status: "ready" as const, orgName: org.name, role: invite.role }
        : { status: "unavailable" as const };
    } catch (error) {
      if (error instanceof ConvexError)
        return { status: "unavailable" as const };
      throw error;
    }
  },
});

export const acceptInvitation = mutation({
  args: { token: v.string() },
  returns: v.id("orgs"),
  handler: async (ctx, { token }) => {
    const user = await requireUser(ctx);
    if (!user.emailVerified) throw new ConvexError("VERIFIED_EMAIL_REQUIRED");
    const profile = await findProfile(ctx, user._id);
    if (profile?.kind !== "member") throw new ConvexError("NO_PROFILE");
    const { invite, org } = await activeInvitation(ctx, token);
    if (
      user.phoneNumber &&
      !(await isPhoneGrantCurrent(ctx, user.phoneNumber, invite.createdAt))
    )
      throw new ConvexError("INVITATION_UNAVAILABLE");
    if (invitationEmail(user.email) !== invite.email)
      throw new ConvexError("INVITATION_UNAVAILABLE");
    let membership = await membershipFor(ctx, profile._id, org._id);
    if (!membership) {
      const [workspaces, members] = await Promise.all([
        ctx.db
          .query("memberships")
          .withIndex("by_profile", (q) => q.eq("profileId", profile._id))
          .take(MAX_WORKSPACES),
        ctx.db
          .query("memberships")
          .withIndex("by_org", (q) => q.eq("orgId", org._id))
          .take(MAX_WORKSPACE_MEMBERS),
      ]);
      if (
        workspaces.length >= MAX_WORKSPACES ||
        members.length >= MAX_WORKSPACE_MEMBERS
      )
        throw new ConvexError("TEAM_LIMIT");
      await requireSubscriptionMemberCapacity(ctx, org._id, members.length);
      const id = await ctx.db.insert("memberships", {
        profileId: profile._id,
        orgId: org._id,
        role: invite.role,
        createdAt: Date.now(),
      });
      membership = await ctx.db.get("memberships", id);
    }
    if (!membership) throw new ConvexError("INVITATION_UNAVAILABLE");
    await ctx.db.patch("workspaceInvitations", invite._id, {
      acceptedAt: Date.now(),
      acceptedBy: profile._id,
    });
    await ctx.db.patch("profiles", profile._id, {
      activeOrgId: org._id,
      updatedAt: Date.now(),
    });
    await auditWorkspace(
      ctx,
      org._id,
      profile._id,
      workspaceRole(membership.role),
      "workspace.invitation_accepted",
      "workspaceInvitations",
      invite._id,
      { role: workspaceRole(membership.role) },
    );
    return org._id;
  },
});

/** Scheduled transport claims once. Tokens are never returned by a public API. */
export const claimInvitationEmail = internalMutation({
  args: { invitationId: v.id("workspaceInvitations"), token: v.string() },
  returns: v.union(
    v.null(),
    v.object({ email: v.string(), orgName: v.string() }),
  ),
  handler: async (ctx, { invitationId, token }) => {
    const invitation = await ctx.db.get("workspaceInvitations", invitationId);
    if (!invitation || invitation.attemptedAt !== undefined) return null;
    try {
      const { invite, org } = await activeInvitation(ctx, token);
      if (invite._id !== invitationId) return null;
      await ctx.db.patch("workspaceInvitations", invitationId, {
        attemptedAt: Date.now(),
      });
      return { email: invite.email, orgName: org.name };
    } catch (error) {
      if (error instanceof ConvexError) return null;
      throw error;
    }
  },
});

export const recordInvitationDelivery = internalMutation({
  args: { invitationId: v.id("workspaceInvitations"), accepted: v.boolean() },
  returns: v.null(),
  handler: async (ctx, { invitationId, accepted }) => {
    const invite = await ctx.db.get("workspaceInvitations", invitationId);
    if (invite?.attemptedAt !== undefined && invite.delivery === "pending") {
      await ctx.db.patch("workspaceInvitations", invitationId, {
        delivery: accepted ? "accepted" : "failed",
      });
      await ctx.db.insert("auditLog", {
        orgId: invite.orgId,
        action: accepted
          ? "workspace.email_accepted"
          : "workspace.email_failed",
        entityTable: "workspaceInvitations",
        entityId: invitationId,
        createdAt: Date.now(),
      });
    }
    return null;
  },
});
