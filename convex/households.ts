import { ConvexError, type Infer, v } from "convex/values";

import type { Doc, Id } from "./_generated/dataModel";
import { mutation, query, type QueryCtx } from "./_generated/server";
import { requireUser } from "./lib/access";
import { findProfile } from "./lib/applicationAccess";
import { bookingToken, canMoveBooking, kgToGrams } from "./lib/chain";
import { beginDispatch } from "./lib/dispatch";
import { vSaathiTime } from "./lib/drafts";
import { preparePhotoRequest } from "./lib/householdPhotos";
import {
  basketError,
  type BasketItem,
  basketPaise,
  canHouseholdCancel,
  cleanAddress,
  cleanText,
  distanceKm,
  isBookableDate,
  isValidAddress,
  isValidName,
  isValidPoint,
  isWindowOpen,
  MAX_OPEN_BOOKINGS,
  OPEN_BOOKING_STATUSES,
  PILOT_CITY,
} from "./lib/households";
import { queueBookingNotification } from "./lib/notifications";
import { indiaToday } from "./lib/onboarding";
import { vBookingStatus } from "./lib/validators";
import { vMaterialRef, vReceipt } from "./lib/views";
import { currentProfile, materialIndex } from "./lib/workspace";

/**
 * Households selling scrap — docs/product/household.md. A household never
 * registers: they compare shops in public, confirm their phone with an SMS
 * code when they book, and follow the booking at /t/{token}.
 */

const vMode = v.union(v.literal("pickup"), v.literal("dropoff"));
const vItem = v.object({ materialCode: v.string(), kg: v.number() });
const vHours = v.object({ opens: v.string(), closes: v.string() });

/** More shops than the pilot will have; keeps the query bounded. */
const MAX_SHOPS = 200;

type Materials = Awaited<ReturnType<typeof materialIndex>>;

// --- Prices -------------------------------------------------------------------

/**
 * Every material must be one households sell (scrap, still in the
 * catalogue) — not a recycler's output, and not a code we don't know.
 */
async function checkedBasket(
  ctx: QueryCtx,
  items: readonly BasketItem[],
  options?: { allowEmpty?: boolean },
): Promise<Materials> {
  const error = basketError(items, options);
  if (error) throw new ConvexError(error);
  const materials = await materialIndex(ctx);
  for (const item of items) {
    const material = materials.get(item.materialCode);
    if (!material?.active || material.stage !== "scrap") {
      throw new ConvexError("UNKNOWN_MATERIAL");
    }
  }
  return materials;
}

/** The city's fallback price per material, for shops that set none. */
async function fallbackPrices(
  ctx: QueryCtx,
  city: string,
  codes: readonly string[],
): Promise<Map<string, number>> {
  const prices = new Map<string, number>();
  for (const code of codes) {
    const newest = await ctx.db
      .query("referencePrices")
      .withIndex("by_city_material", (q) =>
        q.eq("city", city).eq("materialCode", code),
      )
      .order("desc")
      .first();
    if (newest) prices.set(code, newest.fallbackPaise);
  }
  return prices;
}

/** One shop's own prices, newest row per material. */
async function rateCard(
  ctx: QueryCtx,
  orgId: Id<"orgs">,
): Promise<Map<string, number>> {
  const rows = await ctx.db
    .query("rateCards")
    .withIndex("by_org_material", (q) => q.eq("orgId", orgId))
    .take(500);
  const oldestFirst = rows.toSorted((a, b) => a.updatedAt - b.updatedAt);
  return new Map(oldestFirst.map((row) => [row.materialCode, row.paisePerKg]));
}

/** What a shop would pay for the basket: its rates, the fallback for gaps. */
function offerFor(
  items: readonly BasketItem[],
  rates: ReadonlyMap<string, number>,
  fallback: ReadonlyMap<string, number>,
) {
  return {
    estimatePaise: basketPaise(
      items,
      (code) => rates.get(code) ?? fallback.get(code),
    ),
    fallbackCodes: items
      .filter((item) => !rates.has(item.materialCode))
      .map((item) => item.materialCode),
  };
}

// --- Shops ----------------------------------------------------------------------

const vShopOffer = v.object({
  id: v.id("orgs"),
  name: v.string(),
  area: v.string(),
  address: v.string(),
  offersPickup: v.boolean(),
  hours: v.optional(vHours),
  /** Only when the household shared where they are. */
  distanceKm: v.optional(v.number()),
  /** What this shop would pay for the basket, from its own rate card. */
  estimatePaise: v.optional(v.number()),
  /** Basket materials this shop has no price for: the city fallback is used. */
  fallbackCodes: v.array(v.string()),
});

type ShopOffer = Infer<typeof vShopOffer>;

function byName(a: ShopOffer, b: ShopOffer): number {
  return a.name.localeCompare(b.name);
}

/** Nearest first when we know where they are; otherwise the best offer. */
function sortShops(rows: ShopOffer[], isNearGiven: boolean): ShopOffer[] {
  return rows.toSorted((a, b) => {
    if (isNearGiven) {
      const gap = (a.distanceKm ?? Infinity) - (b.distanceKm ?? Infinity);
      if (gap !== 0 && !Number.isNaN(gap)) return gap;
    }
    return (b.estimatePaise ?? 0) - (a.estimatePaise ?? 0) || byName(a, b);
  });
}

/**
 * The kabadiwalas a household can sell to, each with its offer for the
 * basket. Public: comparing shops needs no sign-in, and `near` is used for
 * the distance only — it is never stored.
 */
export const shops = query({
  args: {
    items: v.array(vItem),
    near: v.optional(v.object({ lat: v.number(), lng: v.number() })),
  },
  returns: v.array(vShopOffer),
  handler: async (ctx, args) => {
    await checkedBasket(ctx, args.items, { allowEmpty: true });
    const near = args.near;
    if (near && !isValidPoint(near)) throw new ConvexError("INVALID_LOCATION");

    const orgs = await ctx.db
      .query("orgs")
      .withIndex("by_kind_city", (q) =>
        q
          .eq("kind", "kabadiwala")
          .eq("city", PILOT_CITY)
          .eq("status", "active"),
      )
      .take(MAX_SHOPS);
    const fallback = await fallbackPrices(
      ctx,
      PILOT_CITY,
      args.items.map((item) => item.materialCode),
    );

    const rows: ShopOffer[] = [];
    for (const org of orgs) {
      const offer =
        args.items.length === 0
          ? { fallbackCodes: [] }
          : offerFor(args.items, await rateCard(ctx, org._id), fallback);
      rows.push({
        id: org._id,
        name: org.name,
        area: org.area,
        address: org.address,
        offersPickup: org.offersPickup,
        hours: org.hours,
        distanceKm:
          near && org.location ? distanceKm(near, org.location) : undefined,
        ...offer,
      });
    }
    return sortShops(rows, near !== undefined);
  },
});

// --- Booking ----------------------------------------------------------------------

/** A tracking token no other booking has. */
async function uniqueToken(ctx: QueryCtx): Promise<string> {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const token = bookingToken(Math.random);
    const taken = await ctx.db
      .query("bookings")
      .withIndex("by_token", (q) => q.eq("token", token))
      .first();
    if (!taken) return token;
  }
  throw new ConvexError("TRY_AGAIN");
}

/**
 * Books a pickup or a drop-off with one kabadiwala. The household has just
 * confirmed their phone with an SMS code, so the booking is theirs: it's
 * tied to their profile and phone, and they follow it at /t/{token}.
 */
function checkLocation(location: { lat: number; lng: number } | undefined) {
  if (location && !isValidPoint(location))
    throw new ConvexError("INVALID_LOCATION");
}

async function bookableShop(
  ctx: QueryCtx,
  orgId: Id<"orgs">,
  mode: "pickup" | "dropoff",
) {
  const org = await ctx.db.get("orgs", orgId);
  if (org?.kind !== "kabadiwala" || org.status !== "active")
    throw new ConvexError("SHOP_NOT_FOUND");
  if (mode === "pickup" && !org.offersPickup)
    throw new ConvexError("SHOP_NO_PICKUP");
  return org;
}

export const book = mutation({
  args: {
    photoIds: v.optional(v.array(v.id("householdPhotos"))),
    orgId: v.id("orgs"),
    mode: vMode,
    items: v.array(vItem),
    slotDate: v.string(),
    slotWindow: vSaathiTime,
    address: v.optional(v.string()),
    location: v.optional(v.object({ lat: v.number(), lng: v.number() })),
    name: v.string(),
  },
  returns: v.string(),
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const profile = await findProfile(ctx, user._id);
    if (!profile) throw new ConvexError("NO_PROFILE");
    const phone = profile.phone;
    if (!phone) throw new ConvexError("NO_PHONE");

    const { photoIds, isPhotosOnly, photoRequestKey, existingToken } =
      await preparePhotoRequest(ctx, profile._id, args);
    if (existingToken) return existingToken;
    await checkedBasket(ctx, args.items, { allowEmpty: isPhotosOnly });
    checkLocation(args.location);
    const org = await bookableShop(ctx, args.orgId, args.mode);

    const now = Date.now();
    const today = indiaToday(now);
    if (!isBookableDate(args.slotDate, today)) {
      throw new ConvexError("INVALID_DATE");
    }
    if (!isWindowOpen(args.slotDate, args.slotWindow, today, now)) {
      throw new ConvexError("SLOT_PASSED");
    }
    const name = cleanText(args.name);
    if (!isValidName(name)) throw new ConvexError("INVALID_NAME");
    const address =
      args.mode === "pickup" ? cleanAddress(args.address ?? "") : undefined;
    if (address === "") throw new ConvexError("ADDRESS_REQUIRED");
    if (address !== undefined && !isValidAddress(address)) {
      throw new ConvexError("INVALID_ADDRESS");
    }

    const open = await ctx.db
      .query("bookings")
      .withIndex("by_household", (q) => q.eq("householdProfileId", profile._id))
      .filter((q) =>
        q.or(
          ...OPEN_BOOKING_STATUSES.map((status) =>
            q.eq(q.field("status"), status),
          ),
        ),
      )
      .take(MAX_OPEN_BOOKINGS);
    if (open.length >= MAX_OPEN_BOOKINGS)
      throw new ConvexError("TOO_MANY_OPEN");

    const fallback = await fallbackPrices(
      ctx,
      org.city,
      args.items.map((item) => item.materialCode),
    );
    const estimatePaise = isPhotosOnly
      ? undefined
      : offerFor(args.items, await rateCard(ctx, org._id), fallback)
          .estimatePaise;
    const token = await uniqueToken(ctx);
    const bookingId = await ctx.db.insert("bookings", {
      token,
      requestKind: isPhotosOnly ? "photo_request" : undefined,
      photoRequestKey,
      householdProfileId: profile._id,
      phone,
      name,
      mode: args.mode,
      items: args.items.map((item) => ({
        materialCode: item.materialCode,
        estKg: kgToGrams(item.kg) / 1000,
      })),
      estimatePaise,
      orgId: org._id,
      slotDate: args.slotDate,
      slotWindow: args.slotWindow,
      address,
      status: "requested",
      timeline: [{ status: "requested", at: now }],
      createdAt: now,
      updatedAt: now,
    });
    for (const photoId of photoIds)
      await ctx.db.patch("householdPhotos", photoId, { bookingId });
    await ctx.db.insert("auditLog", {
      orgId: org._id,
      actorProfileId: profile._id,
      action: "booking.requested",
      entityTable: "bookings",
      entityId: bookingId,
      metadata: {
        mode: args.mode,
        items: args.items.length,
        photoCount: photoIds.length,
        estimatePaise,
      },
      createdAt: now,
    });
    const booking = await ctx.db.get("bookings", bookingId);
    if (!booking) throw new ConvexError("NOT_FOUND");
    await queueBookingNotification(ctx, booking, "booking_confirmed");
    await beginDispatch(ctx, booking, org, now, args.location);
    return token;
  },
});

// --- Tracking ------------------------------------------------------------------------

function materialRef(materials: Materials, code: string) {
  const material = materials.get(code);
  return {
    code,
    names: material?.names ?? { en: code },
    family: material?.family ?? ("other" as const),
  };
}

/** The shop's number for the household: its listed phone, else its owner's. */
async function shopPhone(
  ctx: QueryCtx,
  org: Doc<"orgs">,
): Promise<string | undefined> {
  const listed = org.phones[0]?.number;
  if (listed) return listed;
  if (!org.ownerProfileId) return undefined;
  const owner = await ctx.db.get("profiles", org.ownerProfileId);
  return owner?.phone;
}

async function findBooking(ctx: QueryCtx, token: string) {
  const clean = token.trim();
  const isPlausible = clean.length > 0 && clean.length <= 32;
  return isPlausible
    ? ctx.db
        .query("bookings")
        .withIndex("by_token", (q) => q.eq("token", clean))
        .first()
    : null;
}

const vTrackView = v.object({
  token: v.string(),
  status: vBookingStatus,
  mode: vMode,
  slotDate: v.string(),
  slotWindow: vSaathiTime,
  timeline: v.array(v.object({ status: vBookingStatus, at: v.number() })),
  items: v.array(v.object({ material: vMaterialRef, estKg: v.number() })),
  estimatePaise: v.optional(v.number()),
  receipt: v.optional(vReceipt),
  points: v.optional(v.number()),
  shop: v.object({
    name: v.string(),
    area: v.string(),
    address: v.string(),
    phone: v.optional(v.string()),
    hours: v.optional(vHours),
  }),
  /** Whether the signed-in person is the household that booked it. */
  isMine: v.boolean(),
  /** Whether the booking can still be cancelled (by the household). */
  canCancel: v.boolean(),
  dispatch: v.optional(
    v.object({
      attempt: v.number(),
      offeredAt: v.number(),
      expiresAt: v.optional(v.number()),
      approximateLocation: v.boolean(),
    }),
  ),
  createdAt: v.number(),
});

/**
 * A booking as its household sees it at /t/{token}. Public: the unguessable
 * token is the key. It never carries the household's phone or address —
 * anyone holding the link sees this.
 */
export const track = query({
  args: { token: v.string() },
  returns: v.union(v.null(), vTrackView),
  handler: async (ctx, args): Promise<Infer<typeof vTrackView> | null> => {
    const booking = await findBooking(ctx, args.token);
    if (!booking) return null;
    const org = await ctx.db.get("orgs", booking.orgId);
    if (!org) return null;
    const materials = await materialIndex(ctx);
    const viewer = await currentProfile(ctx);
    const receipt = booking.receipt;

    return {
      token: booking.token,
      dispatch: booking.dispatch && {
        attempt: booking.dispatch.attempt,
        offeredAt: booking.dispatch.offeredAt,
        expiresAt: booking.dispatch.expiresAt,
        approximateLocation: booking.dispatch.approximateLocation,
      },
      status: booking.status,
      mode: booking.mode,
      slotDate: booking.slotDate,
      slotWindow: booking.slotWindow,
      timeline: booking.timeline,
      items: booking.items.map((item) => ({
        material: materialRef(materials, item.materialCode),
        estKg: item.estKg,
      })),
      estimatePaise: booking.estimatePaise,
      receipt: receipt && {
        lines: receipt.lines.map((line) => ({
          material: materialRef(materials, line.materialCode),
          grams: line.grams,
          paisePerKg: line.paisePerKg,
          paise: line.paise,
        })),
        totalPaise: receipt.totalPaise,
        method: receipt.method,
        paidAt: receipt.paidAt,
      },
      points: booking.points,
      shop: {
        name: org.name,
        area: org.area,
        address: org.address,
        phone: await shopPhone(ctx, org),
        hours: org.hours,
      },
      isMine: viewer !== null && booking.householdProfileId === viewer._id,
      canCancel: canHouseholdCancel(booking.status),
      createdAt: booking.createdAt,
    };
  },
});

const vMyBooking = v.object({
  token: v.string(),
  status: vBookingStatus,
  mode: vMode,
  slotDate: v.string(),
  slotWindow: vSaathiTime,
  shopName: v.string(),
  itemCount: v.number(),
  /** The estimated weight of everything, in grams. */
  estGrams: v.number(),
  estimatePaise: v.optional(v.number()),
  /** What was actually paid, once the pickup is done. */
  paidPaise: v.optional(v.number()),
  createdAt: v.number(),
});

/**
 * The signed-in household's own bookings, newest first. Null when signed
 * out: a household only ever sees theirs.
 */
export const mine = query({
  args: {},
  returns: v.union(v.null(), v.array(vMyBooking)),
  handler: async (ctx) => {
    const profile = await currentProfile(ctx);
    if (!profile) return null;
    const rows = await ctx.db
      .query("bookings")
      .withIndex("by_household", (q) => q.eq("householdProfileId", profile._id))
      .order("desc")
      .take(50);

    const shopNames = new Map<Id<"orgs">, string>();
    const result: Infer<typeof vMyBooking>[] = [];
    const newestFirst = rows.toSorted((a, b) => b.createdAt - a.createdAt);
    for (const row of newestFirst) {
      let shopName = shopNames.get(row.orgId);
      if (shopName === undefined) {
        const org = await ctx.db.get("orgs", row.orgId);
        shopName = org?.name ?? "";
        shopNames.set(row.orgId, shopName);
      }
      result.push({
        token: row.token,
        status: row.status,
        mode: row.mode,
        slotDate: row.slotDate,
        slotWindow: row.slotWindow,
        shopName,
        itemCount: row.items.length,
        estGrams: row.items.reduce(
          (sum, item) => sum + kgToGrams(item.estKg),
          0,
        ),
        estimatePaise: row.estimatePaise,
        paidPaise: row.receipt?.totalPaise,
        createdAt: row.createdAt,
      });
    }
    return result;
  },
});

/**
 * The household calls off their own booking — free until the kabadiwala is
 * on the way.
 */
export const cancel = mutation({
  args: { token: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const profile = await findProfile(ctx, user._id);
    if (!profile) throw new ConvexError("NO_PROFILE");
    const booking = await findBooking(ctx, args.token);
    if (!booking) throw new ConvexError("NOT_FOUND");
    if (booking.householdProfileId !== profile._id) {
      throw new ConvexError("NOT_YOURS");
    }
    if (
      !canHouseholdCancel(booking.status) ||
      !canMoveBooking(booking.status, "cancelled")
    ) {
      throw new ConvexError("CANNOT_CANCEL");
    }

    const now = Date.now();
    await ctx.db.patch("bookings", booking._id, {
      status: "cancelled",
      dispatch: booking.dispatch && {
        ...booking.dispatch,
        expiresAt: undefined,
      },
      timeline: [...booking.timeline, { status: "cancelled", at: now }],
      updatedAt: now,
    });
    await ctx.db.insert("auditLog", {
      orgId: booking.orgId,
      actorProfileId: profile._id,
      action: "booking.cancelled",
      entityTable: "bookings",
      entityId: booking._id,
      metadata: { from: booking.status },
      createdAt: now,
    });
    return null;
  },
});
