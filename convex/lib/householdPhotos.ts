import { ConvexError } from "convex/values";

import type { Id } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";

export const MAX_HOUSEHOLD_PHOTOS = 5;
export const MAX_HOUSEHOLD_PHOTO_BYTES = 2 * 1024 * 1024;

export async function checkedPhotos(
  ctx: QueryCtx,
  profileId: Id<"profiles">,
  photoIds: readonly Id<"householdPhotos">[],
) {
  if (
    photoIds.length > MAX_HOUSEHOLD_PHOTOS ||
    new Set(photoIds).size !== photoIds.length
  )
    throw new ConvexError("INVALID_PHOTOS");
  for (const id of photoIds) {
    const photo = await ctx.db.get("householdPhotos", id);
    if (photo?.profileId !== profileId || !photo.storageId || photo.bookingId)
      throw new ConvexError("PHOTO_NOT_AVAILABLE");
    if (!(await ctx.db.system.get("_storage", photo.storageId)))
      throw new ConvexError("PHOTO_NOT_AVAILABLE");
  }
}

interface PhotoRequest {
  orgId: Id<"orgs">;
  items: readonly { materialCode: string; kg: number }[];
  photoIds?: Id<"householdPhotos">[];
  mode: "pickup" | "dropoff";
  slotDate: string;
  slotWindow: string;
  address?: string;
  location?: { lat: number; lng: number };
  name: string;
}

export async function preparePhotoRequest(
  ctx: QueryCtx,
  profileId: Id<"profiles">,
  args: PhotoRequest,
) {
  const photoIds = args.photoIds ?? [];
  if (
    photoIds.length > MAX_HOUSEHOLD_PHOTOS ||
    new Set(photoIds).size !== photoIds.length
  )
    throw new ConvexError("INVALID_PHOTOS");
  const isPhotosOnly = args.items.length === 0;
  if (isPhotosOnly && photoIds.length === 0)
    throw new ConvexError("PHOTOS_REQUIRED");
  const photoRequestKey = isPhotosOnly
    ? JSON.stringify({
        orgId: args.orgId,
        mode: args.mode,
        slotDate: args.slotDate,
        slotWindow: args.slotWindow,
        address: args.address,
        location: args.location,
        name: args.name,
        photoIds: photoIds.toSorted((a, b) => a.localeCompare(b)),
      })
    : undefined;
  const first = photoIds[0]
    ? await ctx.db.get("householdPhotos", photoIds[0])
    : null;
  const existing = first?.bookingId
    ? await ctx.db.get("bookings", first.bookingId)
    : null;
  if (
    photoRequestKey !== undefined &&
    existing?.householdProfileId === profileId &&
    existing.photoRequestKey === photoRequestKey
  )
    return {
      photoIds,
      isPhotosOnly,
      photoRequestKey,
      existingToken: existing.token,
    };
  await checkedPhotos(ctx, profileId, photoIds);
  return { photoIds, isPhotosOnly, photoRequestKey, existingToken: undefined };
}
