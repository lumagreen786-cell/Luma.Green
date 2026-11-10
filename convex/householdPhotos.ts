import { ConvexError, v } from "convex/values";

import { r2Env } from "../src/lib/env";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import {
  action,
  internalAction,
  internalMutation,
  internalQuery,
  query,
  type QueryCtx,
} from "./_generated/server";
import { requireUser } from "./lib/access";
import { isAdminEmail } from "./lib/admin";
import { findProfile } from "./lib/applicationAccess";
import {
  hasHouseholdPhotoBytes,
  MAX_HOUSEHOLD_PHOTO_BYTES,
} from "./lib/householdPhotos";
import { sniffContentType } from "./lib/onboarding";
import { vR2Reference } from "./lib/qualityFilesSchema";
import { deleteR2, getR2, putR2 } from "./lib/r2";
import { requireOrg } from "./lib/workspace";

async function owner(ctx: QueryCtx) {
  const user = await requireUser(ctx);
  const profile = await findProfile(ctx, user._id);
  if (!profile?.phone) throw new ConvexError("NO_PHONE");
  return profile;
}

const PHOTO_EXPIRY_MS = 24 * 60 * 60 * 1000;

export const reserve = internalMutation({
  args: {
    name: v.string(),
    contentType: v.string(),
    size: v.number(),
    r2: vR2Reference,
    sha256: v.string(),
  },
  returns: v.id("householdPhotos"),
  handler: async (ctx, args) => {
    const profile = await owner(ctx);
    const now = Date.now();
    const recent = await ctx.db
      .query("householdPhotos")
      .withIndex("by_profile_createdAt", (q) =>
        q.eq("profileId", profile._id).gte("createdAt", now - 60 * 60 * 1000),
      )
      .take(21);
    if (recent.length >= 20) throw new ConvexError("PHOTO_UPLOAD_LIMIT");
    const photoId = await ctx.db.insert("householdPhotos", {
      ...args,
      profileId: profile._id,
      createdAt: now,
    });
    await ctx.db.insert("auditLog", {
      actorProfileId: profile._id,
      action: "household.photo_reserved",
      entityTable: "householdPhotos",
      entityId: photoId,
      createdAt: now,
    });
    await ctx.scheduler.runAfter(
      PHOTO_EXPIRY_MS,
      internal.householdPhotos.expire,
      { photoId },
    );
    return photoId;
  },
});

export const finalize = internalMutation({
  args: { photoId: v.id("householdPhotos") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const profile = await owner(ctx);
    const photo = await ctx.db.get("householdPhotos", args.photoId);
    if (
      photo?.profileId !== profile._id ||
      !photo.r2 ||
      photo.bookingId ||
      photo.cleanupStartedAt !== undefined
    )
      throw new ConvexError("PHOTO_NOT_AVAILABLE");
    if (photo.uploadedAt !== undefined) return null;
    await ctx.db.patch("householdPhotos", photo._id, {
      uploadedAt: Date.now(),
    });
    await ctx.db.insert("auditLog", {
      actorProfileId: profile._id,
      action: "household.photo_uploaded",
      entityTable: "householdPhotos",
      entityId: photo._id,
      createdAt: Date.now(),
    });
    return null;
  },
});

/** Store bytes on the server: a caller can never claim another file's storage ID. */
export const upload = action({
  args: { adultConfirmed: v.literal(true), name: v.string(), bytes: v.bytes() },
  returns: v.id("householdPhotos"),
  handler: async (ctx, args): Promise<Id<"householdPhotos">> => {
    await requireUser(ctx);
    const size = args.bytes.byteLength;
    if (size === 0 || size > MAX_HOUSEHOLD_PHOTO_BYTES)
      throw new ConvexError("PHOTO_SIZE");
    const contentType = sniffContentType(new Uint8Array(args.bytes));
    if (
      !contentType ||
      !["image/jpeg", "image/png", "image/webp"].includes(contentType)
    )
      throw new ConvexError("PHOTO_TYPE");
    const settings = r2Env();
    if (settings.writes !== "on" || !settings.config) {
      throw new ConvexError("STORAGE_UNAVAILABLE");
    }
    const r2 = {
      accountId: settings.config.accountId,
      bucket: settings.config.bucket,
      key: `household/${crypto.randomUUID()}`,
    };
    const hash = new Uint8Array(
      await crypto.subtle.digest("SHA-256", args.bytes),
    );
    const sha256 = [...hash]
      .map((byte) => byte.toString(16).padStart(2, "0"))
      .join("");
    const photoId = await ctx.runMutation(internal.householdPhotos.reserve, {
      name: args.name.trim().slice(0, 120) || "photo",
      contentType,
      size,
      r2,
      sha256,
    });
    // Ambiguous uploads are cleaned by the reservation job, which cannot delete an attached photo.
    await putR2(r2, args.bytes, contentType);
    await ctx.runMutation(internal.householdPhotos.finalize, { photoId });
    return photoId;
  },
});

async function assertRead(ctx: QueryCtx, photoId: Id<"householdPhotos">) {
  const user = await requireUser(ctx);
  const photo = await ctx.db.get("householdPhotos", photoId);
  if (!photo || !hasHouseholdPhotoBytes(photo))
    throw new ConvexError("PHOTO_NOT_FOUND");
  const profile = await findProfile(ctx, user._id);
  if (isAdminEmail(user.email)) {
    if (user.twoFactorEnabled !== true)
      throw new ConvexError("TWO_FACTOR_REQUIRED");
    return photo;
  }
  if (profile?._id === photo.profileId) return photo;
  const booking = photo.bookingId
    ? await ctx.db.get("bookings", photo.bookingId)
    : null;
  const scope = await requireOrg(ctx, ["kabadiwala"], "read");
  if (booking?.orgId !== scope.org._id) throw new ConvexError("FORBIDDEN");
  return photo;
}

export const readAccess = internalQuery({
  args: { photoId: v.id("householdPhotos") },
  returns: v.object({
    storageId: v.optional(v.id("_storage")),
    r2: v.optional(vR2Reference),
    sha256: v.optional(v.string()),
    size: v.number(),
    contentType: v.string(),
    name: v.string(),
  }),
  handler: async (ctx, args) => {
    const photo = await assertRead(ctx, args.photoId);
    return {
      storageId: photo.storageId,
      r2: photo.r2,
      sha256: photo.sha256,
      size: photo.size,
      contentType: photo.contentType,
      name: photo.name,
    };
  },
});

/** Private bytes, never a reusable storage URL or public tracking-token grant. */
export const read = action({
  args: { photoId: v.id("householdPhotos") },
  returns: v.object({
    bytes: v.bytes(),
    contentType: v.string(),
    name: v.string(),
  }),
  handler: async (
    ctx,
    args,
  ): Promise<{ bytes: ArrayBuffer; contentType: string; name: string }> => {
    const access = await ctx.runQuery(
      internal.householdPhotos.readAccess,
      args,
    );
    let blob: Blob | null = null;
    if (access.r2 && access.sha256) {
      blob = await getR2(access.r2, access.size, access.sha256);
    } else if (access.storageId) {
      blob = await ctx.storage.get(access.storageId);
    }
    if (!blob || blob.size > MAX_HOUSEHOLD_PHOTO_BYTES)
      throw new ConvexError("PHOTO_NOT_FOUND");
    await ctx.runQuery(internal.householdPhotos.readAccess, args);
    return {
      bytes: await blob.arrayBuffer(),
      contentType: access.contentType,
      name: access.name,
    };
  },
});

export const list = query({
  args: { bookingId: v.id("bookings") },
  returns: v.array(
    v.object({
      id: v.id("householdPhotos"),
      name: v.string(),
      contentType: v.string(),
    }),
  ),
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const profile = await findProfile(ctx, user._id);
    const booking = await ctx.db.get("bookings", args.bookingId);
    if (!booking) throw new ConvexError("BOOKING_NOT_FOUND");
    const isOwner = profile?._id === booking.householdProfileId;
    const isAdmin = isAdminEmail(user.email);
    if (isAdmin && user.twoFactorEnabled !== true)
      throw new ConvexError("TWO_FACTOR_REQUIRED");
    if (!isOwner && !isAdmin) {
      const scope = await requireOrg(ctx, ["kabadiwala"], "read");
      if (booking.orgId !== scope.org._id) throw new ConvexError("FORBIDDEN");
    }
    const photos = await ctx.db
      .query("householdPhotos")
      .withIndex("by_booking", (q) => q.eq("bookingId", args.bookingId))
      .take(5);
    const rows = [];
    for (const photo of photos) {
      await assertRead(ctx, photo._id);
      rows.push({
        id: photo._id,
        name: photo.name,
        contentType: photo.contentType,
      });
    }
    return rows;
  },
});

/** Claim the reservation before network I/O so a booking cannot attach it mid-delete. */
export const claimExpiry = internalMutation({
  args: { photoId: v.id("householdPhotos") },
  returns: v.union(v.object({ r2: v.optional(vR2Reference) }), v.null()),
  handler: async (ctx, args) => {
    const photo = await ctx.db.get("householdPhotos", args.photoId);
    if (
      !photo ||
      photo.bookingId ||
      photo.createdAt > Date.now() - PHOTO_EXPIRY_MS
    )
      return null;
    if (photo.cleanupStartedAt === undefined) {
      await ctx.db.patch("householdPhotos", photo._id, {
        cleanupStartedAt: Date.now(),
      });
    }
    return { r2: photo.r2 };
  },
});

export const finishExpiry = internalMutation({
  args: { photoId: v.id("householdPhotos") },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const photo = await ctx.db.get("householdPhotos", args.photoId);
    if (!photo || photo.bookingId || photo.cleanupStartedAt === undefined)
      return false;
    if (photo.storageId) await ctx.storage.delete(photo.storageId);
    await ctx.db.delete("householdPhotos", photo._id);
    await ctx.db.insert("auditLog", {
      actorProfileId: photo.profileId,
      action: "household.photo_expired",
      entityTable: "householdPhotos",
      entityId: photo._id,
      createdAt: Date.now(),
    });
    return true;
  },
});

export const expire = internalAction({
  args: { photoId: v.id("householdPhotos"), attempt: v.optional(v.number()) },
  returns: v.boolean(),
  handler: async (ctx, { photoId, attempt = 1 }): Promise<boolean> => {
    const reservation = await ctx.runMutation(
      internal.householdPhotos.claimExpiry,
      { photoId },
    );
    if (!reservation) return false;
    try {
      if (reservation.r2) await deleteR2(reservation.r2);
      return await ctx.runMutation(internal.householdPhotos.finishExpiry, {
        photoId,
      });
    } catch (error) {
      if (attempt >= 5) throw error;
      await ctx.scheduler.runAfter(
        60 * 60 * 1000,
        internal.householdPhotos.expire,
        { photoId, attempt: attempt + 1 },
      );
      return false;
    }
  },
});
