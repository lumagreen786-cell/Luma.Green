import { ConvexError, v } from "convex/values";
import { z } from "zod";

import { components, internal } from "./_generated/api";
import type { Doc } from "./_generated/dataModel";
import {
  internalMutation,
  internalQuery,
  mutation,
  type MutationCtx,
  query,
  type QueryCtx,
} from "./_generated/server";
import { authComponent } from "./auth";
import { requireAdmin } from "./lib/access";
import { isProfileOpen } from "./lib/accountClosure";
import { vRemovalState } from "./lib/accountRemovalSchema";
import { isAdminEmail } from "./lib/admin";
import { findProfile } from "./lib/applicationAccess";
import { smsPhoneHash } from "./lib/smsLimits";

const BATCH = 100;
const proofSchema = z.object({ userId: z.string(), secondFactor: z.boolean() });
const sessionSchema = z.object({
  userId: z.string(),
  createdAt: z.number(),
  expiresAt: z.number(),
});
const verificationSchema = z.object({
  value: z.string(),
  expiresAt: z.number(),
});
async function hasRecentFullAuth(
  ctx: QueryCtx,
  userId: string,
  hasFactor: boolean,
) {
  const identity = await ctx.auth.getUserIdentity();
  if (typeof identity?.sessionId !== "string") return false;
  const session = sessionSchema.safeParse(
    await ctx.runQuery(components.betterAuth.adapter.findOne, {
      model: "session",
      where: [{ field: "_id", value: identity.sessionId }],
    }),
  );
  if (
    !session.success ||
    session.data.userId !== userId ||
    session.data.expiresAt <= Date.now() ||
    session.data.createdAt > Date.now() ||
    Date.now() - session.data.createdAt > 5 * 60_000
  )
    return false;
  const stored = verificationSchema.safeParse(
    await ctx.runQuery(components.betterAuth.adapter.findOne, {
      model: "verification",
      where: [
        { field: "identifier", value: `luma-security-${identity.sessionId}` },
      ],
    }),
  );
  if (
    !stored.success ||
    stored.data.expiresAt <= Date.now() ||
    stored.data.expiresAt > Date.now() + 5 * 60_000
  )
    return false;
  try {
    const proof = proofSchema.safeParse(JSON.parse(stored.data.value));
    return (
      proof.success &&
      proof.data.userId === userId &&
      (!hasFactor || proof.data.secondFactor)
    );
  } catch {
    return false;
  }
}
async function hasOtherOpenOwner(
  ctx: QueryCtx,
  profileId: Doc<"profiles">["_id"],
  row: Doc<"organizationMemberships">,
) {
  const members = await ctx.db
    .query("organizationMemberships")
    .withIndex("by_organization", (q) =>
      q.eq("organizationId", row.organizationId),
    )
    .take(101);
  for (const member of members) {
    if (
      member.profileId !== profileId &&
      member.role === "owner" &&
      (await isProfileOpen(ctx, member.profileId))
    )
      return true;
  }
  return false;
}
async function hasSoleParentOwnership(
  ctx: QueryCtx,
  profileId: Doc<"profiles">["_id"],
  rows: Doc<"organizationMemberships">[],
) {
  for (const row of rows) {
    if (row.role === "owner" && !(await hasOtherOpenOwner(ctx, profileId, row)))
      return true;
  }
  return false;
}
async function heldReasons(
  ctx: QueryCtx,
  profile: Doc<"profiles">,
  email: string,
) {
  if (isAdminEmail(email) || profile.kind === "admin")
    return ["admin_replacement"];
  const reasons: string[] = [];
  const [sites, parents, bookings, worker] = await Promise.all([
    ctx.db
      .query("orgs")
      .withIndex("by_owner", (q) => q.eq("ownerProfileId", profile._id))
      .take(101),
    ctx.db
      .query("organizationMemberships")
      .withIndex("by_profile", (q) => q.eq("profileId", profile._id))
      .take(101),
    Promise.all(
      (["requested", "accepted", "on_the_way"] as const).map((status) =>
        ctx.db
          .query("bookings")
          .withIndex("by_household_status", (q) =>
            q.eq("householdProfileId", profile._id).eq("status", status),
          )
          .first(),
      ),
    ),
    ctx.db
      .query("saathiProfiles")
      .withIndex("by_profile", (q) => q.eq("profileId", profile._id))
      .unique(),
  ]);
  if (
    sites.length > 0 ||
    (await hasSoleParentOwnership(ctx, profile._id, parents))
  )
    reasons.push("business_owner");
  if (bookings.some((booking) => booking !== null))
    reasons.push("active_collection");
  if (sites.length > 100 || parents.length > 100) reasons.push("review_limit");
  if (worker) {
    const job = await ctx.db
      .query("jobs")
      .withIndex("by_saathi_status", (q) =>
        q
          .eq("saathiProfileId", worker._id)
          .eq("status", "assigned")
          .eq("cancelledAt", undefined),
      )
      .first();
    const handover = await ctx.db
      .query("workerHandovers")
      .withIndex("by_worker_pending", (q) =>
        q
          .eq("saathiProfileId", worker._id)
          .eq("acknowledgedAt", undefined)
          .eq("revokedAt", undefined),
      )
      .first();
    if (job || handover) reasons.push("assigned_work");
  }
  return [...new Set(reasons)];
}
export const closedForAuth = internalQuery({
  args: { authUserId: v.string() },
  returns: v.boolean(),
  handler: async (ctx, { authUserId }) => {
    const profile = await findProfile(ctx, authUserId);
    return profile?.closedAt !== undefined;
  },
});
export const status = query({
  args: {},
  returns: v.object({
    recentAuth: v.boolean(),
    heldReasons: v.array(v.string()),
    state: v.union(v.literal("open"), vRemovalState),
  }),
  handler: async (ctx) => {
    const user = await authComponent.safeGetAuthUser(ctx);
    if (!user) throw new ConvexError("NOT_SIGNED_IN");
    const profile = await findProfile(ctx, user._id);
    if (!profile) throw new ConvexError("NO_PROFILE");
    const request = await ctx.db
      .query("accountRemovals")
      .withIndex("by_profile", (q) => q.eq("profileId", profile._id))
      .unique();
    return profile.closedAt === undefined
      ? {
          recentAuth: await hasRecentFullAuth(
            ctx,
            user._id,
            user.twoFactorEnabled === true,
          ),
          heldReasons: await heldReasons(ctx, profile, user.email),
          state: "open" as const,
        }
      : {
          recentAuth: false,
          heldReasons: [],
          state: request?.state ?? ("access_closed" as const),
        };
  },
});
export const close = mutation({
  args: { operationKey: v.string(), confirm: v.literal(true) },
  returns: v.object({
    state: v.union(v.literal("held"), v.literal("access_closed")),
    reasons: v.array(v.string()),
  }),
  handler: async (ctx, args) => {
    if (!/^[\w-]{8,80}$/.test(args.operationKey))
      throw new ConvexError("INVALID_OPERATION_KEY");
    const user = await authComponent.safeGetAuthUser(ctx);
    if (!user) throw new ConvexError("NOT_SIGNED_IN");
    const profile = await findProfile(ctx, user._id);
    if (!profile) throw new ConvexError("NO_PROFILE");
    const old = await ctx.db
      .query("accountRemovals")
      .withIndex("by_profile", (q) => q.eq("profileId", profile._id))
      .unique();
    if (old) {
      if (old.operationKey !== args.operationKey)
        throw new ConvexError("OPERATION_CONFLICT");
      return { state: "access_closed" as const, reasons: [] };
    }
    if (
      !(await hasRecentFullAuth(ctx, user._id, user.twoFactorEnabled === true))
    )
      throw new ConvexError("RECENT_FULL_AUTH_REQUIRED");
    const reasons = await heldReasons(ctx, profile, user.email);
    if (reasons.length > 0) return { state: "held" as const, reasons };
    const secret = process.env.BETTER_AUTH_SECRET;
    if (!secret) throw new ConvexError("REMOVAL_UNAVAILABLE");
    const now = Date.now();
    if (user.phoneNumber) {
      const phoneHash = await smsPhoneHash(user.phoneNumber, secret);
      const block = await ctx.db
        .query("accountRemovalPhoneBlocks")
        .withIndex("by_phoneHash", (q) => q.eq("phoneHash", phoneHash))
        .unique();
      if (block) await ctx.db.patch(block._id, { closedAt: now });
      else
        await ctx.db.insert("accountRemovalPhoneBlocks", {
          phoneHash,
          closedAt: now,
        });
    }
    const id = await ctx.db.insert("accountRemovals", {
      profileId: profile._id,
      authUserId: user._id,
      operationKey: args.operationKey,
      state: "access_closed",
      phase: 0,
      createdAt: now,
      updatedAt: now,
    });
    await ctx.db.patch(profile._id, {
      closedAt: now,
      removalRequestId: id,
      phone: undefined,
      activeOrgId: undefined,
      locale: "en",
      updatedAt: now,
    });
    await ctx.db.insert("auditLog", {
      action: "account.access_closed",
      entityTable: "accountRemovals",
      entityId: id,
      actorProfileId: profile._id,
      createdAt: now,
    });
    await ctx.scheduler.runAfter(0, internal.accountRemoval.cleanup, {
      requestId: id,
    });
    return { state: "access_closed" as const, reasons: [] };
  },
});

interface BatchPagination {
  cursor: string | null;
  numItems: number;
}
interface BatchResult {
  done: boolean;
  cursor?: string;
}
type CleanupUser = { phoneNumber?: string | null; email?: string } | null;
async function deleteAuthBatch(
  ctx: MutationCtx,
  phase: number,
  userId: string,
  phone: string,
  pagination: BatchPagination,
) {
  let result: unknown;
  switch (phase) {
    case 0: {
      result = await ctx.runMutation(components.betterAuth.adapter.deleteMany, {
        input: {
          model: "session",
          where: [{ field: "userId", value: userId }],
        },
        paginationOpts: pagination,
      });
      break;
    }
    case 19: {
      result = await ctx.runMutation(components.betterAuth.adapter.deleteMany, {
        input: {
          model: "account",
          where: [{ field: "userId", value: userId }],
        },
        paginationOpts: pagination,
      });
      break;
    }
    case 20: {
      result = await ctx.runMutation(components.betterAuth.adapter.deleteMany, {
        input: {
          model: "twoFactor",
          where: [{ field: "userId", value: userId }],
        },
        paginationOpts: pagination,
      });
      break;
    }
    case 21: {
      result = await ctx.runMutation(components.betterAuth.adapter.deleteMany, {
        input: {
          model: "verification",
          where: [{ field: "identifier", value: phone }],
        },
        paginationOpts: pagination,
      });
      break;
    }
    default: {
      result = await ctx.runMutation(components.betterAuth.adapter.deleteMany, {
        input: { model: "user", where: [{ field: "_id", value: userId }] },
        paginationOpts: pagination,
      });
    }
  }
  return z
    .object({ isDone: z.boolean(), continueCursor: z.string() })
    .parse(result);
}
async function cleanupBatch0(
  ctx: MutationCtx,
  r: Doc<"accountRemovals">,
  pagination: BatchPagination,
  user: CleanupUser,
): Promise<BatchResult> {
  if (r.phase === 21 && !user?.phoneNumber) return { done: true };
  const result = await deleteAuthBatch(
    ctx,
    r.phase,
    r.authUserId,
    user?.phoneNumber ?? "",
    pagination,
  );
  return {
    done: result.isDone,
    cursor: result.isDone ? undefined : result.continueCursor,
  };
}
async function cleanupBatch1(
  ctx: MutationCtx,
  r: Doc<"accountRemovals">,
  pagination: BatchPagination,
  _user: CleanupUser,
): Promise<BatchResult> {
  const p = await ctx.db
    .query("pushDevices")
    .withIndex("by_profile", (q) => q.eq("profileId", r.profileId))
    .paginate(pagination);
  for (const row of p.page) await ctx.db.delete(row._id);
  return { done: p.isDone, cursor: p.isDone ? undefined : p.continueCursor };
}
async function cleanupBatch2(
  ctx: MutationCtx,
  r: Doc<"accountRemovals">,
  pagination: BatchPagination,
  _user: CleanupUser,
): Promise<BatchResult> {
  const p = await ctx.db
    .query("memberships")
    .withIndex("by_profile", (q) => q.eq("profileId", r.profileId))
    .paginate(pagination);
  for (const row of p.page) await ctx.db.delete(row._id);
  return { done: p.isDone, cursor: p.isDone ? undefined : p.continueCursor };
}
async function cleanupBatch3(
  ctx: MutationCtx,
  r: Doc<"accountRemovals">,
  pagination: BatchPagination,
  _user: CleanupUser,
): Promise<BatchResult> {
  const p = await ctx.db
    .query("organizationMemberships")
    .withIndex("by_profile", (q) => q.eq("profileId", r.profileId))
    .paginate(pagination);
  for (const row of p.page) await ctx.db.delete(row._id);
  return { done: p.isDone, cursor: p.isDone ? undefined : p.continueCursor };
}
async function cleanupBatch4(
  ctx: MutationCtx,
  r: Doc<"accountRemovals">,
  pagination: BatchPagination,
  user: CleanupUser,
): Promise<BatchResult> {
  if (r.phase === 6 && !user?.phoneNumber) return { done: true };
  const now = Date.now();
  let source = ctx.db
    .query("collectionInvitations")
    .withIndex("by_owner", (q) => q.eq("ownerProfileId", r.profileId));
  if (r.phase === 5)
    source = ctx.db
      .query("collectionInvitations")
      .withIndex("by_helper", (q) => q.eq("helperProfileId", r.profileId));
  else if (r.phase === 6)
    source = ctx.db
      .query("collectionInvitations")
      .withIndex("by_phone", (q) => q.eq("phone", user?.phoneNumber ?? ""));
  const p = await source.paginate(pagination);
  for (const row of p.page)
    if (
      row.endedAt === undefined &&
      (r.phase !== 6 || row.createdAt <= r.createdAt)
    )
      await ctx.db.patch(row._id, { endedAt: now });
  return { done: p.isDone, cursor: p.isDone ? undefined : p.continueCursor };
}
async function cleanupBatch7(
  ctx: MutationCtx,
  r: Doc<"accountRemovals">,
  pagination: BatchPagination,
  user: CleanupUser,
): Promise<BatchResult> {
  if (r.phase === 8 && !user?.phoneNumber) return { done: true };
  const now = Date.now();
  const source =
    r.phase === 7
      ? ctx.db
          .query("phoneTeamInvitations")
          .withIndex("by_inviter", (q) => q.eq("invitedBy", r.profileId))
      : ctx.db
          .query("phoneTeamInvitations")
          .withIndex("by_phone", (q) => q.eq("phone", user?.phoneNumber ?? ""));
  const p = await source.paginate(pagination);
  for (const row of p.page)
    if (
      row.revokedAt === undefined &&
      (r.phase === 7 || row.createdAt <= r.createdAt)
    )
      await ctx.db.patch(row._id, { revokedAt: now });
  return { done: p.isDone, cursor: p.isDone ? undefined : p.continueCursor };
}
async function cleanupBatch9(
  ctx: MutationCtx,
  r: Doc<"accountRemovals">,
  pagination: BatchPagination,
  user: CleanupUser,
): Promise<BatchResult> {
  if (r.phase === 10 && !user?.email) return { done: true };
  const now = Date.now();
  const source =
    r.phase === 9
      ? ctx.db
          .query("workspaceInvitations")
          .withIndex("by_inviter", (q) => q.eq("invitedBy", r.profileId))
      : ctx.db
          .query("workspaceInvitations")
          .withIndex("by_email", (q) => q.eq("email", user?.email ?? ""));
  const p = await source.paginate(pagination);
  for (const row of p.page)
    if (
      row.revokedAt === undefined &&
      (r.phase === 9 || row.createdAt <= r.createdAt)
    )
      await ctx.db.patch(row._id, { revokedAt: now });
  return { done: p.isDone, cursor: p.isDone ? undefined : p.continueCursor };
}
async function cleanupBatch11(
  ctx: MutationCtx,
  r: Doc<"accountRemovals">,
  pagination: BatchPagination,
  _user: CleanupUser,
): Promise<BatchResult> {
  const now = Date.now();

  const source =
    r.phase === 11
      ? ctx.db
          .query("auditReports")
          .withIndex("by_creator", (q) => q.eq("createdBy", r.profileId))
      : ctx.db
          .query("auditReports")
          .withIndex("by_recipient", (q) =>
            q.eq("recipientProfileId", r.profileId),
          );
  const p = await source.paginate(pagination);
  for (const row of p.page)
    if (row.revokedAt === undefined)
      await ctx.db.patch(row._id, { revokedAt: now });
  return { done: p.isDone, cursor: p.isDone ? undefined : p.continueCursor };
}
async function cleanupBatch13(
  ctx: MutationCtx,
  r: Doc<"accountRemovals">,
  pagination: BatchPagination,
  _user: CleanupUser,
): Promise<BatchResult> {
  const now = Date.now();

  const source =
    r.phase === 13
      ? ctx.db
          .query("programmeAggregateReports")
          .withIndex("by_requester_created", (q) =>
            q.eq("requesterProfileId", r.profileId),
          )
      : ctx.db
          .query("programmeAggregateReports")
          .withIndex("by_recipient_created", (q) =>
            q.eq("recipientProfileId", r.profileId),
          );
  const p = await source.paginate(pagination);
  for (const row of p.page)
    if (row.revokedAt === undefined)
      await ctx.db.patch(row._id, { revokedAt: now });
  return { done: p.isDone, cursor: p.isDone ? undefined : p.continueCursor };
}
async function cleanupBatch15(
  ctx: MutationCtx,
  r: Doc<"accountRemovals">,
  pagination: BatchPagination,
  _user: CleanupUser,
): Promise<BatchResult> {
  const source =
    r.phase === 15
      ? ctx.db
          .query("serviceEnquiries")
          .withIndex("by_requester_updated", (q) =>
            q.eq("requesterProfileId", r.profileId),
          )
      : ctx.db
          .query("serviceEnquiries")
          .withIndex("by_recipient_updated", (q) =>
            q.eq("recipientProfileId", r.profileId),
          );
  const p = await source.paginate(pagination);
  for (const row of p.page)
    if (row.recipientProfileId !== undefined)
      await ctx.db.patch(row._id, {
        recipientId: undefined,
        recipientProfileId: undefined,
      });
  return { done: p.isDone, cursor: p.isDone ? undefined : p.continueCursor };
}
async function cleanupBatch17(
  ctx: MutationCtx,
  r: Doc<"accountRemovals">,
  pagination: BatchPagination,
  _user: CleanupUser,
): Promise<BatchResult> {
  const now = Date.now();

  const p = await ctx.db
    .query("integrationKeys")
    .withIndex("by_issuer", (q) => q.eq("issuerProfileId", r.profileId))
    .paginate(pagination);
  for (const row of p.page)
    if (row.revokedAt === undefined)
      await ctx.db.patch(row._id, { revokedAt: now });
  return { done: p.isDone, cursor: p.isDone ? undefined : p.continueCursor };
}
async function cleanupBatch18(
  ctx: MutationCtx,
  r: Doc<"accountRemovals">,
  pagination: BatchPagination,
  _user: CleanupUser,
): Promise<BatchResult> {
  const now = Date.now();

  const p = await ctx.db
    .query("recurringCollections")
    .withIndex("by_household", (q) => q.eq("householdProfileId", r.profileId))
    .paginate(pagination);
  for (const row of p.page)
    if (row.active)
      await ctx.db.patch(row._id, { active: false, updatedAt: now });
  return { done: p.isDone, cursor: p.isDone ? undefined : p.continueCursor };
}
async function runBatch(
  ctx: MutationCtx,
  r: Doc<"accountRemovals">,
  pagination: BatchPagination,
  user: CleanupUser,
): Promise<BatchResult> {
  switch (r.phase) {
    case 0: {
      return cleanupBatch0(ctx, r, pagination, user);
    }
    case 19: {
      return cleanupBatch0(ctx, r, pagination, user);
    }
    case 20: {
      return cleanupBatch0(ctx, r, pagination, user);
    }
    case 21: {
      return cleanupBatch0(ctx, r, pagination, user);
    }
    case 22: {
      return cleanupBatch0(ctx, r, pagination, user);
    }
    case 1: {
      return cleanupBatch1(ctx, r, pagination, user);
    }
    case 2: {
      return cleanupBatch2(ctx, r, pagination, user);
    }
    case 3: {
      return cleanupBatch3(ctx, r, pagination, user);
    }
    case 4: {
      return cleanupBatch4(ctx, r, pagination, user);
    }
    case 5: {
      return cleanupBatch4(ctx, r, pagination, user);
    }
    case 6: {
      return cleanupBatch4(ctx, r, pagination, user);
    }
    case 7: {
      return cleanupBatch7(ctx, r, pagination, user);
    }
    case 8: {
      return cleanupBatch7(ctx, r, pagination, user);
    }
    case 9: {
      return cleanupBatch9(ctx, r, pagination, user);
    }
    case 10: {
      return cleanupBatch9(ctx, r, pagination, user);
    }
    case 11: {
      return cleanupBatch11(ctx, r, pagination, user);
    }
    case 12: {
      return cleanupBatch11(ctx, r, pagination, user);
    }
    case 13: {
      return cleanupBatch13(ctx, r, pagination, user);
    }
    case 14: {
      return cleanupBatch13(ctx, r, pagination, user);
    }
    case 15: {
      return cleanupBatch15(ctx, r, pagination, user);
    }
    case 16: {
      return cleanupBatch15(ctx, r, pagination, user);
    }
    case 17: {
      return cleanupBatch17(ctx, r, pagination, user);
    }
    case 18: {
      return cleanupBatch18(ctx, r, pagination, user);
    }
    default: {
      throw new ConvexError("INVALID_CLEANUP_PHASE");
    }
  }
}
export const cleanup = internalMutation({
  args: { requestId: v.id("accountRemovals") },
  returns: v.null(),
  handler: async (ctx, { requestId }) => {
    const r = await ctx.db.get("accountRemovals", requestId);
    if (!r || r.state === "restricted_review" || r.state === "review_recorded")
      return null;
    const profile = await ctx.db.get("profiles", r.profileId);
    if (profile?.closedAt === undefined || profile.removalRequestId !== r._id)
      throw new ConvexError("REMOVAL_NOT_CLOSED");
    const cursor = r.cursor ?? null,
      pagination = { cursor, numItems: BATCH },
      now = Date.now();
    try {
      if (r.phase >= 23) {
        await ctx.db.patch(r._id, {
          state: "restricted_review",
          updatedAt: now,
          cursor: undefined,
          lastError: undefined,
        });
        await ctx.db.insert("auditLog", {
          action: "account.cleanup_completed",
          entityTable: "accountRemovals",
          entityId: r._id,
          actorProfileId: r.profileId,
          createdAt: now,
        });
        return null;
      }
      const user = await authComponent.getAnyUserById(ctx, r.authUserId);
      const result = await runBatch(ctx, r, pagination, user);
      await ctx.db.patch(r._id, {
        state: "cleanup_running",
        phase: result.done ? r.phase + 1 : r.phase,
        cursor: result.cursor,
        updatedAt: now,
        lastError: undefined,
      });
      await ctx.db.insert("auditLog", {
        action: "account.cleanup_batch",
        entityTable: "accountRemovals",
        entityId: r._id,
        actorProfileId: r.profileId,
        metadata: { phase: r.phase },
        createdAt: now,
      });
      await ctx.scheduler.runAfter(0, internal.accountRemoval.cleanup, {
        requestId: r._id,
      });
    } catch {
      await ctx.db.patch(r._id, {
        state: "cleanup_running",
        lastError: "CLEANUP_RETRY_REQUIRED",
        updatedAt: now,
      });
      await ctx.db.insert("auditLog", {
        action: "account.cleanup_failed",
        entityTable: "accountRemovals",
        entityId: r._id,
        actorProfileId: r.profileId,
        createdAt: now,
      });
    }
    return null;
  },
});
export const reviewQueue = query({
  args: {},
  returns: v.array(
    v.object({
      id: v.id("accountRemovals"),
      state: vRemovalState,
      createdAt: v.number(),
      lastError: v.optional(v.string()),
    }),
  ),
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const groups = await Promise.all(
      ["access_closed", "cleanup_running", "restricted_review"].map((state) =>
        ctx.db
          .query("accountRemovals")
          .withIndex("by_state_updatedAt", (q) =>
            q.eq(
              "state",
              state as
                "access_closed" | "cleanup_running" | "restricted_review",
            ),
          )
          .take(20),
      ),
    );
    return groups.flat().map((r) => ({
      id: r._id,
      state: r.state,
      createdAt: r.createdAt,
      lastError: r.lastError,
    }));
  },
});
export const recordReview = mutation({
  args: { requestId: v.id("accountRemovals"), reference: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const user = await requireAdmin(ctx),
      profile = await findProfile(ctx, user._id);
    if (!profile) throw new ConvexError("NO_PROFILE");
    const ref = args.reference.trim();
    if (ref.length < 8 || ref.length > 200)
      throw new ConvexError("INVALID_REVIEW_REFERENCE");
    const row = await ctx.db.get("accountRemovals", args.requestId);
    if (row?.state === "review_recorded" && row.reviewReference === ref)
      return null;
    if (row?.state !== "restricted_review")
      throw new ConvexError("REVIEW_NOT_READY");
    await ctx.db.patch(row._id, {
      state: "review_recorded",
      reviewReference: ref,
      reviewedBy: profile._id,
      reviewedAt: Date.now(),
      updatedAt: Date.now(),
    });
    await ctx.db.insert("auditLog", {
      action: "account.retention_review_recorded",
      entityTable: "accountRemovals",
      entityId: row._id,
      actorProfileId: profile._id,
      createdAt: Date.now(),
    });
    return null;
  },
});
export const retryCleanup = mutation({
  args: { requestId: v.id("accountRemovals") },
  returns: v.null(),
  handler: async (ctx, { requestId }) => {
    await requireAdmin(ctx);
    const row = await ctx.db.get("accountRemovals", requestId);
    if (row?.state !== "cleanup_running" || !row.lastError)
      throw new ConvexError("RETRY_NOT_READY");
    await ctx.db.patch(row._id, {
      lastError: undefined,
      updatedAt: Date.now(),
    });
    await ctx.scheduler.runAfter(0, internal.accountRemoval.cleanup, {
      requestId,
    });
    return null;
  },
});
