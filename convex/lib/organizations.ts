import { ConvexError, type Infer } from "convex/values";
import { z } from "zod";

import { components } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import { requireUser } from "./access";
import { isProfileOpen } from "./accountClosure";
import { findProfile } from "./applicationAccess";
import type { vTeamScope } from "./organizationsSchema";
import { membershipFor } from "./workspace";
import {
  hasWorkspacePermission,
  type WorkspacePermission,
  workspaceRole,
} from "./workspaceRoles";

export type TeamScope = Infer<typeof vTeamScope>;
export async function actor(ctx: QueryCtx) {
  const user = await requireUser(ctx);
  const profile = await findProfile(ctx, user._id);
  if (!profile) throw new ConvexError("NO_PROFILE");
  return { user, profile };
}
export async function organizationMember(
  ctx: QueryCtx,
  organizationId: Id<"organizations">,
  profileId: Id<"profiles">,
) {
  return (await isProfileOpen(ctx, profileId))
    ? ctx.db
        .query("organizationMemberships")
        .withIndex("by_organization_profile", (q) =>
          q.eq("organizationId", organizationId).eq("profileId", profileId),
        )
        .unique()
    : null;
}
export async function scopeRole(
  ctx: QueryCtx,
  scope: TeamScope,
  profileId: Id<"profiles">,
) {
  if (scope.kind === "organization") {
    const parent = await ctx.db.get("organizations", scope.id);
    const member = await organizationMember(ctx, scope.id, profileId);
    return parent && member ? member.role : null;
  }
  const site = await ctx.db.get("orgs", scope.id);
  const member = await membershipFor(ctx, profileId, scope.id);
  return member && site?.status === "active"
    ? workspaceRole(member.role)
    : null;
}
export async function requireScope(
  ctx: QueryCtx,
  scope: TeamScope,
  permission: WorkspacePermission = "read",
) {
  const who = await actor(ctx);
  if (
    permission !== "read" &&
    scope.kind === "workspace" &&
    who.profile.activeOrgId &&
    who.profile.activeOrgId !== scope.id
  )
    throw new ConvexError("WORKSPACE_CHANGED");
  const role = await scopeRole(ctx, scope, who.profile._id);
  if (!role || !hasWorkspacePermission(role, permission))
    throw new ConvexError("TEAM_ACCESS_DENIED");
  return { ...who, role };
}
/** Session creation follows all required factors. Refresh time is not reauthentication. */
export async function requireRecentSession(ctx: QueryCtx) {
  const user = await requireUser(ctx);
  const identity = await ctx.auth.getUserIdentity();
  const sessionId = identity?.sessionId;
  if (typeof sessionId !== "string")
    throw new ConvexError("RECENT_AUTH_REQUIRED");
  const stored: unknown = await ctx.runQuery(
    components.betterAuth.adapter.findOne,
    {
      model: "session",
      where: [{ field: "_id", value: sessionId }],
    },
  );
  const session = z
    .object({
      userId: z.string(),
      createdAt: z.number(),
      expiresAt: z.number(),
    })
    .safeParse(stored);
  if (
    !session.success ||
    session.data.userId !== user._id ||
    session.data.expiresAt <= Date.now() ||
    session.data.createdAt > Date.now() ||
    Date.now() - session.data.createdAt > 10 * 60 * 1000
  ) {
    throw new ConvexError("RECENT_AUTH_REQUIRED");
  }
}
export async function teamAudit(
  ctx: MutationCtx,
  profileId: Id<"profiles">,
  scope: TeamScope,
  action: string,
  entityTable: string,
  entityId: string,
  details: Record<string, string | number | boolean> = {},
) {
  await ctx.db.insert("auditLog", {
    actorProfileId: profileId,
    orgId: scope.kind === "workspace" ? scope.id : undefined,
    action,
    entityTable,
    entityId,
    metadata: { scope, ...details },
    createdAt: Date.now(),
  });
}
export function organizationName(value: string) {
  const name = value.trim();
  if (name.length < 2 || name.length > 120)
    throw new ConvexError("INVALID_ORGANIZATION_NAME");
  return name;
}
