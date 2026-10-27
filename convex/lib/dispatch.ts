import { ConvexError } from "convex/values";

import { internal } from "../_generated/api";
import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import { kgToGrams, paiseFor } from "./chain";
import {
  availableCapacity,
  requireCollectionCapacity,
} from "./collectionScheduling";
import { distanceKm, isWindowOpen } from "./households";
import { queueBookingNotification } from "./notifications";
import { indiaToday } from "./onboarding";

export const OFFER_TIMEOUT_MS = 2 * 60 * 60 * 1000;
export const DEFAULT_PICKUP_RADIUS_KM = 5;

type Booking = Doc<"bookings">;
type Org = Doc<"orgs">;
interface Point {
  lat: number;
  lng: number;
}

/** The setting applies only to future offers, never to requests already open. */
export function dispatchSettings(org: Org) {
  return {
    autoAccept: org.autoAccept ?? false,
    pickupRadiusKm: org.pickupRadiusKm ?? DEFAULT_PICKUP_RADIUS_KM,
  };
}

/** A supplied collection point must lie inside the shop's declared pickup area. */
export function isPickupLocationEligible(
  org: Org,
  point: Point | undefined,
): boolean {
  return (
    !point ||
    Boolean(
      org.location &&
      distanceKm(point, org.location) <= dispatchSettings(org).pickupRadiusKm,
    )
  );
}
function knownCollectionPoint(booking: Booking): Point | undefined {
  return booking.dispatch?.approximateLocation
    ? undefined
    : booking.dispatch?.origin;
}
async function offerEvent(
  ctx: MutationCtx,
  booking: Booking,
  event: "offered" | "accepted" | "declined" | "timed_out",
  now: number,
) {
  await ctx.db.insert("bookingOffers", {
    bookingId: booking._id,
    orgId: booking.orgId,
    attempt: booking.dispatch?.attempt ?? 1,
    event,
    createdAt: now,
  });
}

async function audit(
  ctx: MutationCtx,
  booking: Booking,
  action: string,
  now: number,
  metadata: Record<string, unknown>,
  actorProfileId?: Id<"profiles">,
) {
  await ctx.db.insert("auditLog", {
    orgId: booking.orgId,
    actorProfileId,
    action,
    entityTable: "bookings",
    entityId: booking._id,
    metadata,
    createdAt: now,
  });
}

/** Acceptance and the offer history commit together with the booking. */
export async function acceptOffer(
  ctx: MutationCtx,
  booking: Booking,
  now: number,
  actorProfileId?: Id<"profiles">,
): Promise<void> {
  // A queued expiry can run late. The deadline must also hold at acceptance.
  if (
    booking.status !== "requested" ||
    (booking.dispatch !== undefined &&
      (booking.dispatch.expiresAt === undefined ||
        booking.dispatch.expiresAt <= now ||
        (booking.dispatch.deadlineAt ?? booking.createdAt + OFFER_TIMEOUT_MS) <=
          now))
  )
    throw new ConvexError("WRONG_STATUS");
  const org = await ctx.db.get("orgs", booking.orgId);
  if (!org || (booking.mode === "pickup" && !org.offersPickup))
    throw new ConvexError("SHOP_NOT_FOUND");
  if (
    booking.mode === "pickup" &&
    !isPickupLocationEligible(org, knownCollectionPoint(booking))
  )
    throw new ConvexError("OUTSIDE_PICKUP_RADIUS");
  await requireCollectionCapacity(
    ctx,
    org,
    booking.slotDate,
    booking.slotWindow,
    booking._id,
  );
  await ctx.db.patch("bookings", booking._id, {
    status: "accepted",
    dispatch: booking.dispatch && { ...booking.dispatch, expiresAt: undefined },
    timeline: [...booking.timeline, { status: "accepted", at: now }],
    updatedAt: now,
  });
  await offerEvent(ctx, booking, "accepted", now);
  await queueBookingNotification(ctx, booking, "booking_accepted");
  await audit(
    ctx,
    booking,
    "booking.accepted",
    now,
    {
      from: "requested",
      to: "accepted",
      automatic: actorProfileId === undefined,
      attempt: booking.dispatch?.attempt,
    },
    actorProfileId,
  );
}

function canAutoAccept(booking: Booking, org: Org): boolean {
  const dispatch = booking.dispatch;
  if (!dispatch?.origin || dispatch.approximateLocation || !org.location)
    return false;
  const settings = dispatchSettings(org);
  return (
    settings.autoAccept &&
    distanceKm(dispatch.origin, org.location) <= settings.pickupRadiusKm
  );
}

async function openOffer(
  ctx: MutationCtx,
  booking: Booking,
  org: Org,
  now: number,
): Promise<void> {
  await offerEvent(ctx, booking, "offered", now);
  if (org.ownerProfileId)
    await queueBookingNotification(
      ctx,
      booking,
      "booking_offer",
      org.ownerProfileId,
    );
  if (canAutoAccept(booking, org)) {
    await acceptOffer(ctx, booking, now);
  } else if (booking.dispatch?.expiresAt !== undefined) {
    await ctx.scheduler.runAt(
      booking.dispatch.expiresAt,
      internal.dispatch.expireOffer,
      {
        bookingId: booking._id,
        attempt: booking.dispatch.attempt,
      },
    );
  }
}

/** Opt in new pickups only. Old records and shop-specific drop-offs stay valid. */
export async function beginDispatch(
  ctx: MutationCtx,
  booking: Booking,
  org: Org,
  now: number,
  location?: Point,
): Promise<void> {
  if (booking.mode !== "pickup") return;
  const origin = location ?? knownCollectionPoint(booking);
  if (!isPickupLocationEligible(org, origin))
    throw new ConvexError("OUTSIDE_PICKUP_RADIUS");
  const dispatch = {
    attempt: (booking.dispatch?.attempt ?? 0) + 1,
    offeredAt: now,
    expiresAt: now + OFFER_TIMEOUT_MS,
    deadlineAt: now + OFFER_TIMEOUT_MS,
    attemptedOrgIds: [org._id],
    origin: origin ?? org.location,
    approximateLocation: origin === undefined,
  };
  await ctx.db.patch("bookings", booking._id, { dispatch });
  await openOffer(ctx, { ...booking, dispatch }, org, now);
}

/** A replacement must handle the full basket and honour or improve its quote. */
async function candidateQuote(
  ctx: QueryCtx,
  booking: Booking,
  org: Org,
): Promise<number | null> {
  let totalPaise = 0;
  for (const item of booking.items) {
    const material = await ctx.db
      .query("materials")
      .withIndex("by_code", (q) => q.eq("code", item.materialCode))
      .first();
    if (
      !material?.active ||
      material.stage !== "scrap" ||
      !org.families.includes(material.family)
    )
      return null;
    const rate = await ctx.db
      .query("rateCards")
      .withIndex("by_org_material", (q) =>
        q.eq("orgId", org._id).eq("materialCode", item.materialCode),
      )
      .order("desc")
      .first();
    const fallback = rate
      ? null
      : await ctx.db
          .query("referencePrices")
          .withIndex("by_city_material", (q) =>
            q.eq("city", org.city).eq("materialCode", item.materialCode),
          )
          .order("desc")
          .first();
    const price = rate?.paisePerKg ?? fallback?.fallbackPaise;
    if (price === undefined || !Number.isSafeInteger(price) || price <= 0)
      return null;
    totalPaise += paiseFor(kgToGrams(item.estKg), price);
  }
  return Number.isSafeInteger(totalPaise) &&
    totalPaise >= (booking.estimatePaise ?? 0)
    ? totalPaise
    : null;
}

async function nextShop(
  ctx: QueryCtx,
  booking: Booking,
): Promise<{ org: Org; estimatePaise: number | undefined } | null> {
  const dispatch = booking.dispatch;
  const current = await ctx.db.get("orgs", booking.orgId);
  const origin = dispatch?.origin;
  if (!dispatch || !origin || !current) return null;
  const shops = await ctx.db
    .query("orgs")
    .withIndex("by_kind_city_pickup", (q) =>
      q
        .eq("kind", "kabadiwala")
        .eq("city", current.city)
        .eq("status", "active")
        .eq("offersPickup", true),
    )
    // Compare every pickup shop in the pilot city. Truncating before distance
    // sorting can wrongly conclude that no eligible shop exists. A larger-city
    // launch needs a spatial index before this reaches Convex read limits.
    .take(5001);
  if (shops.length > 5000)
    throw new ConvexError("DISPATCH_CAPACITY_UNAVAILABLE");
  const candidates = shops
    .flatMap((org) => {
      if (
        !org.offersPickup ||
        !org.location ||
        dispatch.attemptedOrgIds.includes(org._id)
      )
        return [];
      const distance = distanceKm(origin, org.location);
      return distance <= dispatchSettings(org).pickupRadiusKm
        ? [{ org, distance }]
        : [];
    })
    .toSorted(
      (a, b) => a.distance - b.distance || a.org._id.localeCompare(b.org._id),
    );
  for (const { org } of candidates) {
    if (
      (await availableCapacity(
        ctx,
        org,
        booking.slotDate,
        booking.slotWindow,
      )) < 1
    )
      continue;
    if (booking.requestKind === "photo_request")
      return { org, estimatePaise: undefined };
    const estimatePaise = await candidateQuote(ctx, booking, org);
    if (estimatePaise !== null) return { org, estimatePaise };
  }
  return null;
}

/** A rejected or unanswered offer advances once; previous shops are not retried. */
export async function advanceOffer(
  ctx: MutationCtx,
  booking: Booking,
  event: "declined" | "timed_out",
  now: number,
  actorProfileId?: Id<"profiles">,
): Promise<void> {
  if (booking.status !== "requested" || !booking.dispatch)
    throw new ConvexError("WRONG_STATUS");
  await offerEvent(ctx, booking, event, now);
  await audit(
    ctx,
    booking,
    `booking.offer_${event}`,
    now,
    { attempt: booking.dispatch.attempt },
    actorProfileId,
  );
  const isWindowOpenNow = isWindowOpen(
    booking.slotDate,
    booking.slotWindow,
    indiaToday(now),
    now,
  );
  const replacement =
    isWindowOpenNow &&
    now < (booking.dispatch.deadlineAt ?? booking.createdAt + OFFER_TIMEOUT_MS)
      ? await nextShop(ctx, booking)
      : null;
  if (!replacement) {
    await ctx.db.patch("bookings", booking._id, {
      status: "requested",
      dispatch: { ...booking.dispatch, expiresAt: undefined },
      timeline: [...booking.timeline, { status: "requested", at: now }],
      updatedAt: now,
    });
    await audit(
      ctx,
      booking,
      "booking.declined",
      now,
      { reason: isWindowOpenNow ? "dispatch_exhausted" : "slot_passed" },
      actorProfileId,
    );
    return;
  }
  const { org, estimatePaise } = replacement;
  const dispatch = {
    ...booking.dispatch,
    attempt: booking.dispatch.attempt + 1,
    offeredAt: now,
    expiresAt:
      booking.dispatch.deadlineAt ?? booking.createdAt + OFFER_TIMEOUT_MS,
    attemptedOrgIds: [...booking.dispatch.attemptedOrgIds, org._id],
  };
  const timeline = [
    ...booking.timeline,
    { status: "requested" as const, at: now },
  ];
  await ctx.db.patch("bookings", booking._id, {
    orgId: org._id,
    estimatePaise,
    dispatch,
    timeline,
    updatedAt: now,
  });
  const reassigned = {
    ...booking,
    orgId: org._id,
    estimatePaise,
    dispatch,
    timeline,
    updatedAt: now,
  };
  await audit(ctx, reassigned, "booking.reassigned", now, {
    fromOrgId: booking.orgId,
    attempt: dispatch.attempt,
    estimatePaise,
    approximateLocation: dispatch.approximateLocation,
  });
  await queueBookingNotification(ctx, reassigned, "booking_reassigned");
  await openOffer(ctx, reassigned, org, now);
}

/** Admin changes the offer owner; only the destination shop can accept it. */
export async function reassignCollection(
  ctx: MutationCtx,
  booking: Booking,
  org: Org,
  actorProfileId: Id<"profiles">,
  reason: string,
  now: number,
): Promise<void> {
  if (
    booking.mode !== "pickup" ||
    !["requested", "accepted"].includes(booking.status)
  )
    throw new ConvexError("WRONG_STATUS");
  const current = await ctx.db.get("orgs", booking.orgId);
  if (
    org._id === booking.orgId ||
    org.kind !== "kabadiwala" ||
    org.status !== "active" ||
    !org.offersPickup ||
    org.city !== current?.city
  )
    throw new ConvexError("SHOP_NOT_FOUND");
  if (!isPickupLocationEligible(org, knownCollectionPoint(booking)))
    throw new ConvexError("OUTSIDE_PICKUP_RADIUS");
  await requireCollectionCapacity(
    ctx,
    org,
    booking.slotDate,
    booking.slotWindow,
    booking._id,
  );
  const estimatePaise =
    booking.requestKind === "photo_request"
      ? undefined
      : await candidateQuote(ctx, booking, org);
  if (estimatePaise === null)
    throw new ConvexError("SHOP_CANNOT_SERVE_REQUEST");
  const dispatch = {
    attempt: (booking.dispatch?.attempt ?? 0) + 1,
    offeredAt: now,
    expiresAt: now + OFFER_TIMEOUT_MS,
    deadlineAt: now + OFFER_TIMEOUT_MS,
    attemptedOrgIds: [
      ...(booking.dispatch?.attemptedOrgIds ?? [booking.orgId]),
      org._id,
    ],
    origin: booking.dispatch?.origin,
    approximateLocation: booking.dispatch?.approximateLocation ?? true,
  };
  const reassigned = {
    ...booking,
    orgId: org._id,
    estimatePaise,
    status: "requested" as const,
    dispatch,
    timeline: [...booking.timeline, { status: "requested" as const, at: now }],
    updatedAt: now,
  };
  await ctx.db.patch("bookings", booking._id, {
    orgId: reassigned.orgId,
    estimatePaise,
    status: reassigned.status,
    dispatch,
    timeline: reassigned.timeline,
    updatedAt: now,
  });
  await audit(
    ctx,
    reassigned,
    "booking.admin_reassigned",
    now,
    { fromOrgId: booking.orgId, reason, attempt: dispatch.attempt },
    actorProfileId,
  );
  await offerEvent(ctx, reassigned, "offered", now);
  if (org.ownerProfileId)
    await queueBookingNotification(
      ctx,
      reassigned,
      "booking_offer",
      org.ownerProfileId,
    );
  await queueBookingNotification(ctx, reassigned, "booking_reassigned");
  await ctx.scheduler.runAt(dispatch.expiresAt, internal.dispatch.expireOffer, {
    bookingId: booking._id,
    attempt: dispatch.attempt,
  });
}
