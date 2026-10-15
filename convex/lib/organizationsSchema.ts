import { defineTable } from "convex/server";
import { v } from "convex/values";

import { vInvitationRole, vWorkspaceRole } from "./workspaceRoles";

export const vTeamScope = v.union(
  v.object({ kind: v.literal("organization"), id: v.id("organizations") }),
  v.object({ kind: v.literal("workspace"), id: v.id("orgs") }),
);
export const organizationTables = {
  organizations: defineTable({
    name: v.string(),
    kind: v.union(v.literal("business"), v.literal("internal")),
    createdAt: v.number(),
    updatedAt: v.number(),
    version: v.number(),
  }),
  organizationMemberships: defineTable({
    organizationId: v.id("organizations"),
    profileId: v.id("profiles"),
    role: vWorkspaceRole,
    createdAt: v.number(),
  })
    .index("by_profile", ["profileId"])
    .index("by_organization", ["organizationId"])
    .index("by_organization_profile", ["organizationId", "profileId"]),
  phoneTeamInvitations: defineTable({
    scope: vTeamScope,
    phone: v.string(),
    role: vInvitationRole,
    tokenHash: v.string(),
    invitedBy: v.id("profiles"),
    createdAt: v.number(),
    expiresAt: v.number(),
    acceptedAt: v.optional(v.number()),
    revokedAt: v.optional(v.number()),
  })
    .index("by_hash", ["tokenHash"])
    .index("by_scope_created", ["scope", "createdAt"]),
};
