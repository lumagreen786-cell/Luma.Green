import { ConvexError, v } from "convex/values";

import { mutation, query } from "./_generated/server";
import { requireAdmin } from "./lib/access";
import { vApplicationKind, vApplicationStatus } from "./lib/drafts";
import {
  actor,
  organizationMember,
  organizationName,
  requireRecentSession,
  requireScope,
  teamAudit,
} from "./lib/organizations";
import { membershipFor } from "./lib/workspace";
import {
  canManageWorkspaceRole,
  MAX_WORKSPACE_MEMBERS,
  vWorkspaceRole,
  workspaceRole,
} from "./lib/workspaceRoles";

export const create = mutation({
  args: {
    name: v.string(),
    kind: v.union(v.literal("business"), v.literal("internal")),
    orgId: v.optional(v.id("orgs")),
  },
  returns: v.id("organizations"),
  handler: async (ctx, args) => {
    const { profile } = await actor(ctx);
    await requireRecentSession(ctx);
    if (args.kind === "internal") {
      await requireAdmin(ctx);
      if (args.orgId) throw new ConvexError("INVALID_SCOPE");
    } else {
      if (!args.orgId) throw new ConvexError("APPROVED_WORKSPACE_REQUIRED");
      await requireScope(ctx, { kind: "workspace", id: args.orgId }, "own");
      const site = await ctx.db.get("orgs", args.orgId);
      if (site?.organizationId)
        throw new ConvexError("WORKSPACE_ALREADY_GROUPED");
    }
    const memberships = await ctx.db
      .query("organizationMemberships")
      .withIndex("by_profile", (q) => q.eq("profileId", profile._id))
      .take(10);
    if (memberships.length >= 10) throw new ConvexError("TEAM_LIMIT");
    const now = Date.now();
    const id = await ctx.db.insert("organizations", {
      name: organizationName(args.name),
      kind: args.kind,
      createdAt: now,
      updatedAt: now,
      version: 1,
    });
    await ctx.db.insert("organizationMemberships", {
      organizationId: id,
      profileId: profile._id,
      role: "owner",
      createdAt: now,
    });
    if (args.orgId)
      await ctx.db.patch("orgs", args.orgId, {
        organizationId: id,
        updatedAt: now,
      });
    await teamAudit(
      ctx,
      profile._id,
      { kind: "organization", id },
      "organization.created",
      "organizations",
      id,
    );
    if (args.orgId)
      await teamAudit(
        ctx,
        profile._id,
        { kind: "workspace", id: args.orgId },
        "organization.workspace_linked",
        "organizations",
        id,
      );
    return id;
  },
});

export const list = query({
  args: {},
  returns: v.array(
    v.object({
      id: v.id("organizations"),
      name: v.string(),
      kind: v.union(v.literal("business"), v.literal("internal")),
      role: vWorkspaceRole,
      version: v.number(),
    }),
  ),
  handler: async (ctx) => {
    const { profile } = await actor(ctx);
    const memberships = await ctx.db
      .query("organizationMemberships")
      .withIndex("by_profile", (q) => q.eq("profileId", profile._id))
      .take(10);
    const result = [];
    for (const member of memberships) {
      const parent = await ctx.db.get("organizations", member.organizationId);
      if (parent)
        result.push({
          id: parent._id,
          name: parent.name,
          kind: parent.kind,
          role: member.role,
          version: parent.version,
        });
    }
    return result;
  },
});

export const rename = mutation({
  args: {
    organizationId: v.id("organizations"),
    name: v.string(),
    expectedVersion: v.number(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const scope = { kind: "organization" as const, id: args.organizationId };
    const { profile } = await requireScope(ctx, scope, "manage");
    const parent = await ctx.db.get("organizations", scope.id);
    if (parent?.version !== args.expectedVersion)
      throw new ConvexError("STALE_VERSION");
    await ctx.db.patch("organizations", scope.id, {
      name: organizationName(args.name),
      version: parent.version + 1,
      updatedAt: Date.now(),
    });
    await teamAudit(
      ctx,
      profile._id,
      scope,
      "organization.renamed",
      "organizations",
      scope.id,
    );
    return null;
  },
});

export const attachWorkspace = mutation({
  args: { organizationId: v.id("organizations"), orgId: v.id("orgs") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const scope = { kind: "organization" as const, id: args.organizationId };
    const { profile } = await requireScope(ctx, scope, "own");
    await requireScope(ctx, { kind: "workspace", id: args.orgId }, "own");
    await requireRecentSession(ctx);
    const parent = await ctx.db.get("organizations", scope.id);
    const site = await ctx.db.get("orgs", args.orgId);
    if (!site || parent?.kind !== "business")
      throw new ConvexError("INVALID_SCOPE");
    if (site.organizationId === scope.id) return null;
    if (site.organizationId) throw new ConvexError("WORKSPACE_ALREADY_GROUPED");
    const sites = await ctx.db
      .query("orgs")
      .withIndex("by_organization", (q) => q.eq("organizationId", scope.id))
      .take(100);
    if (sites.length >= 100) throw new ConvexError("TEAM_LIMIT");
    await ctx.db.patch("orgs", site._id, {
      organizationId: scope.id,
      updatedAt: Date.now(),
    });
    await teamAudit(
      ctx,
      profile._id,
      { kind: "workspace", id: site._id },
      "organization.workspace_linked",
      "organizations",
      scope.id,
    );
    return null;
  },
});

/** Governance exposes site names, never operational totals or private documents. */
export const workspaces = query({
  args: { organizationId: v.id("organizations") },
  returns: v.array(
    v.object({
      id: v.id("orgs"),
      name: v.string(),
      status: v.union(v.literal("active"), v.literal("suspended")),
      role: v.union(vWorkspaceRole, v.null()),
    }),
  ),
  handler: async (ctx, { organizationId }) => {
    const { profile } = await requireScope(ctx, {
      kind: "organization",
      id: organizationId,
    });
    const sites = await ctx.db
      .query("orgs")
      .withIndex("by_organization", (q) =>
        q.eq("organizationId", organizationId),
      )
      .take(100);
    return Promise.all(
      sites.map(async (site) => {
        const member = await membershipFor(ctx, profile._id, site._id);
        return {
          id: site._id,
          name: site.name,
          status: site.status,
          role: member ? workspaceRole(member.role) : null,
        };
      }),
    );
  },
});

export const team = query({
  args: { organizationId: v.id("organizations") },
  returns: v.array(
    v.object({
      id: v.id("organizationMemberships"),
      profileId: v.id("profiles"),
      role: vWorkspaceRole,
    }),
  ),
  handler: async (ctx, { organizationId }) => {
    await requireScope(ctx, { kind: "organization", id: organizationId });
    const members = await ctx.db
      .query("organizationMemberships")
      .withIndex("by_organization", (q) =>
        q.eq("organizationId", organizationId),
      )
      .take(MAX_WORKSPACE_MEMBERS);
    return members.map((member) => ({
      id: member._id,
      profileId: member.profileId,
      role: member.role,
    }));
  },
});

/** Null removes parent membership only; each site keeps its independent roster. */
export const changeMember = mutation({
  args: {
    organizationId: v.id("organizations"),
    profileId: v.id("profiles"),
    expectedRole: vWorkspaceRole,
    role: v.union(vWorkspaceRole, v.null()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const scope = { kind: "organization" as const, id: args.organizationId };
    const { profile, role } = await requireScope(ctx, scope, "manage");
    await requireRecentSession(ctx);
    const member = await organizationMember(ctx, scope.id, args.profileId);
    if (member?.role !== args.expectedRole)
      throw new ConvexError("STALE_VERSION");
    if (
      !canManageWorkspaceRole(role, member.role) ||
      (args.role && !canManageWorkspaceRole(role, args.role))
    )
      throw new ConvexError("TEAM_ACCESS_DENIED");
    if (member.role === args.role) return null;
    if (member.role === "owner") {
      const members = await ctx.db
        .query("organizationMemberships")
        .withIndex("by_organization", (q) => q.eq("organizationId", scope.id))
        .take(MAX_WORKSPACE_MEMBERS);
      if (
        members.every(
          (other) => other._id === member._id || other.role !== "owner",
        )
      )
        throw new ConvexError("LAST_OWNER");
    }
    if (args.role)
      await ctx.db.patch("organizationMemberships", member._id, {
        role: args.role,
      });
    else await ctx.db.delete("organizationMemberships", member._id);
    await teamAudit(
      ctx,
      profile._id,
      scope,
      args.role ? "organization.role_changed" : "organization.member_removed",
      "organizationMemberships",
      member._id,
    );
    return null;
  },
});

/** Governance sees request status, not another applicant's identity documents. */
export const siteRequests = query({
  args: { organizationId: v.id("organizations") },
  returns: v.array(
    v.object({
      id: v.id("applications"),
      applicantProfileId: v.id("profiles"),
      kind: vApplicationKind,
      status: vApplicationStatus,
      version: v.number(),
      createdAt: v.number(),
    }),
  ),
  handler: async (ctx, { organizationId }) => {
    await requireScope(
      ctx,
      { kind: "organization", id: organizationId },
      "manage",
    );
    const requests = await ctx.db
      .query("applications")
      .withIndex("by_organization_created", (q) =>
        q.eq("organizationId", organizationId),
      )
      .order("desc")
      .take(100);
    return requests.map((request) => ({
      id: request._id,
      applicantProfileId: request.profileId,
      kind: request.kind,
      status: request.status,
      version: request.version,
      createdAt: request.createdAt,
    }));
  },
});
