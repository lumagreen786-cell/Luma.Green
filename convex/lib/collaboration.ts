import { ConvexError, type Infer } from "convex/values";

import type { Id } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";
import type { vCollaborationRecord } from "./collaborationSchema";
import { actor, scopeRole, type TeamScope } from "./organizations";

export type CollaborationRecord = Infer<typeof vCollaborationRecord>;
/** Verify the record belongs to the supplied scope before testing membership. */
export async function canAccessRecord(
  ctx: QueryCtx,
  scope: TeamScope,
  record: CollaborationRecord,
  profileId: Id<"profiles">,
  isWrite = false,
): Promise<boolean> {
  if (scope.kind === "organization") {
    if (record.kind !== "internal" || record.id !== scope.id) return false;
    const parent = await ctx.db.get("organizations", scope.id);
    const role = await scopeRole(ctx, scope, profileId);
    return (
      parent?.kind === "internal" &&
      Boolean(role) &&
      (!isWrite || role !== "viewer")
    );
  }
  const site = await ctx.db.get("orgs", scope.id);
  if (site?.status !== "active") return false;
  let isBelongs = false;
  let isAssignedSaathi = false;
  switch (record.kind) {
    case "booking": {
      const row = await ctx.db.get("bookings", record.id);
      isBelongs = row?.orgId === scope.id;
      break;
    }
    case "trade": {
      const row = await ctx.db.get("trades", record.id);
      isBelongs = row?.sellerOrgId === scope.id || row?.buyerOrgId === scope.id;
      break;
    }
    case "inspection": {
      const row = await ctx.db.get("lotInspections", record.id);
      isBelongs = row?.orgId === scope.id;
      break;
    }
    case "job": {
      const row = await ctx.db.get("jobs", record.id);
      isBelongs = row?.orgId === scope.id && row.cancelledAt === undefined;
      const saathi = row?.saathiProfileId
        ? await ctx.db.get("saathiProfiles", row.saathiProfileId)
        : null;
      isAssignedSaathi =
        isBelongs &&
        saathi?.profileId === profileId &&
        saathi.status === "active";
      break;
    }
    case "internal": {
      return false;
    }
  }
  if (!isBelongs) return false;
  const role = await scopeRole(ctx, scope, profileId);
  return (Boolean(role) && (!isWrite || role !== "viewer")) || isAssignedSaathi;
}
export async function requireRecord(
  ctx: QueryCtx,
  scope: TeamScope,
  record: CollaborationRecord,
  isWrite = false,
) {
  const who = await actor(ctx);
  if (
    isWrite &&
    scope.kind === "workspace" &&
    who.profile.activeOrgId &&
    who.profile.activeOrgId !== scope.id
  )
    throw new ConvexError("WORKSPACE_CHANGED");
  if (!(await canAccessRecord(ctx, scope, record, who.profile._id, isWrite)))
    throw new ConvexError("RECORD_ACCESS_DENIED");
  return who;
}
export async function requireTask(
  ctx: QueryCtx,
  id: Id<"recordTasks">,
  isWrite = false,
) {
  const task = await ctx.db.get("recordTasks", id);
  if (!task) throw new ConvexError("RECORD_ACCESS_DENIED");
  const who = await requireRecord(ctx, task.scope, task.record, isWrite);
  return { ...who, task };
}
export function dueDate(value: number | undefined) {
  if (
    value !== undefined &&
    (!Number.isSafeInteger(value) || value < 0 || value > 8_640_000_000_000_000)
  )
    throw new ConvexError("INVALID_DUE_DATE");
  return value;
}
