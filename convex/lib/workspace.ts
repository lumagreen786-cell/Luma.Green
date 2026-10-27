import { ConvexError } from "convex/values";

import type { Doc, Id } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";
import { authComponent } from "../auth";
import { requireUser } from "./access";
import { findProfile } from "./applicationAccess";
import type { OrgKind } from "./chain";
import {
  hasWorkspacePermission,
  MAX_WORKSPACES,
  type WorkspacePermission,
  workspaceRole,
} from "./workspaceRoles";

/** Membership is the authority; a selected org ID is only a preference. */
export async function membershipFor(
  ctx: QueryCtx,
  profileId: Id<"profiles">,
  orgId: Id<"orgs">,
) {
  return ctx.db
    .query("memberships")
    .withIndex("by_profile_org", (q) =>
      q.eq("profileId", profileId).eq("orgId", orgId),
    )
    .unique();
}
function isWorkspaceReadable(org: Doc<"orgs">, canReadSuspended: boolean) {
  switch (org.status) {
    case "active": {
      return true;
    }
    case "suspended": {
      return canReadSuspended;
    }
  }
}
export async function selectedMembership(
  ctx: QueryCtx,
  profileId: Id<"profiles">,
  canReadSuspended = false,
) {
  const profile = await ctx.db.get("profiles", profileId);
  if (!profile) return null;
  if (profile.activeOrgId) {
    const membership = await membershipFor(ctx, profileId, profile.activeOrgId);
    if (!membership) return null;
    const org = await ctx.db.get("orgs", membership.orgId);
    return org && isWorkspaceReadable(org, canReadSuspended)
      ? { org, membership }
      : null;
  }
  const memberships = await ctx.db
    .query("memberships")
    .withIndex("by_profile", (q) => q.eq("profileId", profileId))
    .take(MAX_WORKSPACES + 1);
  if (memberships.length > MAX_WORKSPACES)
    throw new ConvexError("TOO_MANY_WORKSPACES");
  for (const membership of memberships) {
    const org = await ctx.db.get("orgs", membership.orgId);
    if (org && isWorkspaceReadable(org, canReadSuspended))
      return { org, membership };
  }
  return null;
}
export async function findOrgFor(
  ctx: QueryCtx,
  profileId: Id<"profiles">,
): Promise<Doc<"orgs"> | null> {
  const selected = await selectedMembership(ctx, profileId);
  return selected?.org ?? null;
}

export async function findSaathiFor(
  ctx: QueryCtx,
  profileId: Doc<"profiles">["_id"],
): Promise<Doc<"saathiProfiles"> | null> {
  const saathi = await ctx.db
    .query("saathiProfiles")
    .withIndex("by_profile", (q) => q.eq("profileId", profileId))
    .unique();
  return saathi?.status === "active" ? saathi : null;
}

/** The signed-in person's profile, or null (signed out, or none yet). */
export async function currentProfile(
  ctx: QueryCtx,
): Promise<Doc<"profiles"> | null> {
  const user = await authComponent.safeGetAuthUser(ctx);
  return user ? findProfile(ctx, user._id) : null;
}

/**
 * The caller's business, when it's one of `kinds`. Every business screen's
 * functions start here: a person only ever sees and changes their own.
 */
export async function requireOrg(
  ctx: QueryCtx,
  kinds?: readonly OrgKind[],
  permission: WorkspacePermission = "operate",
) {
  const user = await requireUser(ctx);
  const profile = await findProfile(ctx, user._id);
  if (!profile) throw new ConvexError("NO_PROFILE");
  const selected = await selectedMembership(
    ctx,
    profile._id,
    permission === "read",
  );
  if (!selected) throw new ConvexError("NO_BUSINESS");
  const { org, membership } = selected;
  const role = workspaceRole(membership.role);
  if (!hasWorkspacePermission(role, permission))
    throw new ConvexError("WORKSPACE_PERMISSION_DENIED");
  if (kinds && !kinds.includes(org.kind)) throw new ConvexError("WRONG_ROLE");
  return { profile, org, membership, role };
}

export async function requireSaathi(
  ctx: QueryCtx,
): Promise<{ profile: Doc<"profiles">; saathi: Doc<"saathiProfiles"> }> {
  const user = await requireUser(ctx);
  const profile = await findProfile(ctx, user._id);
  if (!profile) throw new ConvexError("NO_PROFILE");
  const saathi = await findSaathiFor(ctx, profile._id);
  if (!saathi) throw new ConvexError("NOT_A_SAATHI");
  return { profile, saathi };
}

/** Material names and CO2e factors by code, for joining into results. */
export async function materialIndex(ctx: QueryCtx) {
  const materials = await ctx.db
    .query("materials")
    .withIndex("by_sortOrder")
    .collect();
  return new Map(materials.map((material) => [material.code, material]));
}
