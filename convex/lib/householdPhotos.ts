import { ConvexError } from "convex/values";

import type { Doc, Id } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";

export const MAX_HOUSEHOLD_PHOTOS = 5;
export const MAX_HOUSEHOLD_PHOTO_BYTES = 2 * 1024 * 1024;

export function hasHouseholdPhotoBytes(photo: Doc<"householdPhotos">) {
  if (photo.cleanupStartedAt !== undefined) return false;
  return photo.r2
    ? photo.sha256 !== undefined && photo.uploadedAt !== undefined
    : photo.storageId !== undefined;
}

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
    if (
      photo?.profileId !== profileId ||
      !hasHouseholdPhotoBytes(photo) ||
      photo.bookingId
    )
      throw new ConvexError("PHOTO_NOT_AVAILABLE");
    if (
      photo.storageId &&
      !(await ctx.db.system.get("_storage", photo.storageId))
    )
      throw new ConvexError("PHOTO_NOT_AVAILABLE");
  }
}

interface PhotoRequest {
  apartmentRouteId?: Id<"apartmentCollectionRoutes">;
  orgId: Id<"orgs">;
  items: readonly { materialCode: string; kg: number }[];
  photoIds?: Id<"householdPhotos">[];
  operationKey?: string;
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
): Promise<{
  photoIds: Id<"householdPhotos">[];
  requestKind: Doc<"bookings">["requestKind"];
  photoRequestKey: string | undefined;
  existingToken: string | undefined;
}> {
  const photoIds = args.photoIds ?? [];
  if (
    photoIds.length > MAX_HOUSEHOLD_PHOTOS ||
    new Set(photoIds).size !== photoIds.length
  )
    throw new ConvexError("INVALID_PHOTOS");
  const isUnweighed = args.items.length === 0;
  const kind = photoIds.length > 0 ? "photo_request" : "unweighed_request";
  const requestKind: Doc<"bookings">["requestKind"] = isUnweighed
    ? kind
    : undefined;
  if (
    args.operationKey &&
    (!isUnweighed ||
      !/^[a-f\d]{8}(?:-[a-f\d]{4}){3}-[a-f\d]{12}$/u.test(args.operationKey))
  )
    throw new ConvexError("INVALID_REQUEST");
  if (isUnweighed && photoIds.length === 0 && !args.operationKey)
    throw new ConvexError("PHOTOS_REQUIRED");
  const photoRequestKey = isUnweighed
    ? JSON.stringify({
        orgId: args.orgId,
        apartmentRouteId: args.apartmentRouteId,
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
  const byOperation = args.operationKey
    ? await ctx.db
        .query("bookings")
        .withIndex("by_household_operation", (q) =>
          q
            .eq("householdProfileId", profileId)
            .eq("householdOperationKey", args.operationKey),
        )
        .unique()
    : null;
  if (byOperation && byOperation.photoRequestKey !== photoRequestKey)
    throw new ConvexError("INVALID_REQUEST");
  const existing =
    byOperation ??
    (first?.bookingId ? await ctx.db.get("bookings", first.bookingId) : null);
  if (
    photoRequestKey !== undefined &&
    existing?.householdProfileId === profileId &&
    existing.photoRequestKey === photoRequestKey
  )
    return {
      photoIds,
      requestKind,
      photoRequestKey,
      existingToken: existing.token,
    };
  await checkedPhotos(ctx, profileId, photoIds);
  return { photoIds, requestKind, photoRequestKey, existingToken: undefined };
}
