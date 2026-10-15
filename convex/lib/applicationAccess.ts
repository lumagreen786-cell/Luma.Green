import { ConvexError } from "convex/values";

import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import { requireUser } from "./access";
import { isEditable } from "./lifecycle";
import type { FileType } from "./onboarding";

export async function findProfile(ctx: QueryCtx, authUserId: string) {
  return ctx.db
    .query("profiles")
    .withIndex("by_authUserId", (q) => q.eq("authUserId", authUserId))
    .unique();
}

/** Personal onboarding remains separate from company site applications. */
export async function findApplication(
  ctx: QueryCtx,
  profileId: Id<"profiles">,
) {
  return ctx.db
    .query("applications")
    .withIndex("by_profile_organization", (q) =>
      q.eq("profileId", profileId).eq("organizationId", undefined),
    )
    .unique();
}

/** The signed-in person's profile. Only members apply — never the admin. */
export async function requireMember(ctx: QueryCtx) {
  const user = await requireUser(ctx);
  const profile = await findProfile(ctx, user._id);
  if (!profile) throw new ConvexError("NO_PROFILE");
  if (profile.kind !== "member") throw new ConvexError("NOT_A_MEMBER");
  return profile;
}

/** Explicit IDs never authorize access to another applicant's identity documents. */
export async function ownApplication(
  ctx: QueryCtx,
  profileId: Id<"profiles">,
  applicationId?: Id<"applications">,
) {
  if (!applicationId) return findApplication(ctx, profileId);
  const application = await ctx.db.get("applications", applicationId);
  if (application?.profileId !== profileId)
    throw new ConvexError("NO_APPLICATION");
  return application;
}

export async function requireApplicationParent(
  ctx: QueryCtx,
  application: Doc<"applications">,
) {
  const organizationId = application.organizationId;
  if (!organizationId) return;
  const parent = await ctx.db.get("organizations", organizationId);
  const member = await ctx.db
    .query("organizationMemberships")
    .withIndex("by_organization_profile", (q) =>
      q
        .eq("organizationId", organizationId)
        .eq("profileId", application.profileId),
    )
    .unique();
  if (
    !member ||
    parent?.kind !== "business" ||
    (member.role !== "owner" && member.role !== "admin")
  )
    throw new ConvexError("TEAM_ACCESS_DENIED");
}

/** The caller's own application, while they're still allowed to change it. */
export async function requireEditableApplication(
  ctx: QueryCtx,
  applicationId?: Id<"applications">,
) {
  const profile = await requireMember(ctx);
  const application = await ownApplication(ctx, profile._id, applicationId);
  if (!application) throw new ConvexError("NO_APPLICATION");
  await requireApplicationParent(ctx, application);
  if (!isEditable(application.status)) throw new ConvexError("NOT_EDITABLE");
  return { profile, application };
}

/** Uploads still attached (removed ones stay only for earlier versions). */
export async function activeFiles(
  ctx: QueryCtx,
  applicationId: Id<"applications">,
): Promise<Doc<"applicationFiles">[]> {
  const files = await ctx.db
    .query("applicationFiles")
    .withIndex("by_application", (q) => q.eq("applicationId", applicationId))
    .collect();
  return files.filter((file) => file.removedAt === undefined);
}

export function countByType(
  files: readonly Doc<"applicationFiles">[],
): Partial<Record<FileType, number>> {
  const counts: Partial<Record<FileType, number>> = {};
  for (const file of files) counts[file.type] = (counts[file.type] ?? 0) + 1;
  return counts;
}

/**
 * Takes a file off an application. One that was part of a submitted version
 * is only marked removed; one never sent is deleted with its stored bytes.
 */
export async function removeFile(
  ctx: MutationCtx,
  file: Doc<"applicationFiles">,
): Promise<void> {
  if (file.firstSubmittedVersion === undefined) {
    await ctx.storage.delete(file.storageId);
    await ctx.db.delete("applicationFiles", file._id);
  } else {
    await ctx.db.patch("applicationFiles", file._id, { removedAt: Date.now() });
  }
}
