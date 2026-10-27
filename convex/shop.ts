import { ConvexError, v } from "convex/values";

import type { Doc, Id } from "./_generated/dataModel";
import {
  mutation,
  type MutationCtx,
  query,
  type QueryCtx,
} from "./_generated/server";
import {
  type BookingStatus,
  canMoveBooking,
  paiseFor,
  pointsFor,
} from "./lib/chain";
import { requireCollectionCapacity } from "./lib/collectionScheduling";
import { shiftDate } from "./lib/dates";
import {
  acceptOffer,
  advanceOffer,
  dispatchSettings as settingsFor,
} from "./lib/dispatch";
import { recordInventoryMovement } from "./lib/inventoryLedger";
import { isOrdinaryMaterial } from "./lib/materialEligibility";
import { queueBookingNotification } from "./lib/notifications";
import { indiaToday } from "./lib/onboarding";
import { maskPhone } from "./lib/phone";
import { isRateCurrent } from "./lib/rateValidity";
import { vBookingStatus } from "./lib/validators";
import { vBookingView, vMaterialRef } from "./lib/views";
import { materialIndex, requireOrg } from "./lib/workspace";
import { marketPriceOn } from "./stock";

/**
 * The kabadiwala's shop — docs/product/kabadiwala.md: household pickup
 * requests, weigh and pay, and the rate card. Every function starts with
 * `requireOrg(ctx, ["kabadiwala"])`, so a shop only ever sees and changes its
 * own bookings and prices.
 */

const SHOP = ["kabadiwala"] as const;

type Booking = Doc<"bookings">;
type Org = Doc<"orgs">;
type Materials = Awaited<ReturnType<typeof materialIndex>>;

/** No home pickup is bigger than this; a larger number is a typing slip. */
const MAX_LINE_GRAMS = 5_000_000;
const MAX_LINES = 30;
/** ₹10,000/kg — above any scrap price, below any typing slip. */
const MAX_RATE_PAISE = 1_000_000;
const DONE_SHOWN = 20;

const WINDOW_ORDER = { morning: 0, afternoon: 1, evening: 2 } as const;

// --- What a shop may see of a household -------------------------------------

/**
 * Accepting reveals the household's name, phone and address; until then the
 * shop sees a first name, a masked number and the area.
 */
function isRevealed(booking: Booking): boolean {
  return (
    booking.status === "accepted" ||
    booking.status === "on_the_way" ||
    booking.status === "completed" ||
    booking.timeline.some((step) => step.status === "accepted")
  );
}

/**
 * The area of an address: the last part before the city. "Flat 4B, Rose
 * Apartments, Yeshwanthpur, Bengaluru" → "Yeshwanthpur".
 */
function areaOf(address: string, city: string): string | undefined {
  const cityAt = address.toLowerCase().indexOf(`, ${city.toLowerCase()}`);
  const beforeCity = cityAt === -1 ? address : address.slice(0, cityAt);
  const parts = beforeCity
    .split(",")
    .map((part) => part.trim())
    .filter((part) => part !== "");
  return parts.at(-1);
}

function firstName(name: string | undefined): string | undefined {
  const first = name?.trim().split(/\s+/, 1)[0];
  return first === "" ? undefined : first;
}

function materialRef(materials: Materials, code: string) {
  const material = materials.get(code);
  return {
    code,
    names: material?.names ?? { en: code },
    family: material?.family ?? "other",
  };
}

function bookingView(booking: Booking, city: string, materials: Materials) {
  const canSee = isRevealed(booking);
  let address = booking.address;
  if (address !== undefined && !canSee) address = areaOf(address, city);
  return {
    id: booking._id,
    // The tracking link shows the address, so it waits for acceptance too.
    token: canSee ? booking.token : "",
    name: canSee ? booking.name : firstName(booking.name),
    phone: canSee ? booking.phone : maskPhone(booking.phone),
    address,
    mode: booking.mode,
    items: booking.items.map((item) => ({
      material: materialRef(materials, item.materialCode),
      estKg: item.estKg,
    })),
    estimatePaise: booking.estimatePaise,
    slotDate: booking.slotDate,
    slotWindow: booking.slotWindow,
    status: booking.status,
    receipt: booking.receipt && {
      lines: booking.receipt.lines.map((line) => ({
        material: materialRef(materials, line.materialCode),
        grams: line.grams,
        paisePerKg: line.paisePerKg,
        paise: line.paise,
      })),
      totalPaise: booking.receipt.totalPaise,
      method: booking.receipt.method,
      paidAt: booking.receipt.paidAt,
    },
    createdAt: booking.createdAt,
  };
}

/** Soonest slot first. */
function bySlot(a: Booking, b: Booking): number {
  return (
    a.slotDate.localeCompare(b.slotDate) ||
    WINDOW_ORDER[a.slotWindow] - WINDOW_ORDER[b.slotWindow] ||
    a.createdAt - b.createdAt
  );
}

// --- Prices -------------------------------------------------------------------

/** A scrap material in one of the shop's families: what it buys from homes. */
function isShopMaterial(
  org: Org,
  material: Doc<"materials"> | null | undefined,
): boolean {
  return (
    isOrdinaryMaterial(material) &&
    material.stage === "scrap" &&
    org.families.includes(material.family)
  );
}

async function myRate(ctx: QueryCtx, orgId: Id<"orgs">, materialCode: string) {
  return ctx.db
    .query("rateCards")
    .withIndex("by_org_material", (q) =>
      q.eq("orgId", orgId).eq("materialCode", materialCode),
    )
    .first();
}

async function referencePrice(
  ctx: QueryCtx,
  city: string,
  materialCode: string,
) {
  return ctx.db
    .query("referencePrices")
    .withIndex("by_city_material", (q) =>
      q.eq("city", city).eq("materialCode", materialCode),
    )
    .first();
}

/** What this shop pays per kg: its rate card, else the city's fallback. */
async function rateFor(
  ctx: QueryCtx,
  org: Org,
  materialCode: string,
): Promise<{ paisePerKg: number; source: "mine" | "city" } | null> {
  const mine = await myRate(ctx, org._id, materialCode);
  return mine && isRateCurrent(mine)
    ? { paisePerKg: mine.paisePerKg, source: "mine" }
    : null;
}

// --- Moving a booking -----------------------------------------------------------

/** One of this shop's bookings, or NOT_FOUND — never someone else's. */
async function myBooking(
  ctx: QueryCtx,
  org: Org,
  bookingId: Id<"bookings">,
): Promise<Booking> {
  const booking = await ctx.db.get("bookings", bookingId);
  if (booking?.orgId !== org._id) throw new ConvexError("NOT_FOUND");
  return booking;
}

/** A status change: checked against the chain, timelined and audited. */
async function moveBooking(
  ctx: MutationCtx,
  change: {
    booking: Booking;
    to: BookingStatus;
    actorProfileId: Id<"profiles">;
    now: number;
    patch?: Pick<Partial<Booking>, "receipt" | "points">;
    metadata?: Record<string, unknown>;
  },
) {
  const { booking, to, now } = change;
  if (!canMoveBooking(booking.status, to)) {
    throw new ConvexError("WRONG_STATUS");
  }
  await ctx.db.patch("bookings", booking._id, {
    ...change.patch,
    status: to,
    timeline: [...booking.timeline, { status: to, at: now }],
    updatedAt: now,
  });
  await ctx.db.insert("auditLog", {
    orgId: booking.orgId,
    actorProfileId: change.actorProfileId,
    action: `booking.${to}`,
    entityTable: "bookings",
    entityId: booking._id,
    metadata: { from: booking.status, to, ...change.metadata },
    createdAt: now,
  });
}

/** Weighed lines, one per material (repeats are added up), all checked. */
function weighedLines(
  lines: readonly { materialCode: string; grams: number }[],
): { materialCode: string; grams: number }[] {
  if (lines.length === 0) throw new ConvexError("NOTHING_WEIGHED");
  if (lines.length > MAX_LINES) throw new ConvexError("TOO_MANY_LINES");
  const byMaterial = new Map<string, number>();
  for (const line of lines) {
    if (!Number.isSafeInteger(line.grams) || line.grams <= 0) {
      throw new ConvexError("INVALID_WEIGHT");
    }
    const grams = (byMaterial.get(line.materialCode) ?? 0) + line.grams;
    if (grams > MAX_LINE_GRAMS) throw new ConvexError("INVALID_WEIGHT");
    byMaterial.set(line.materialCode, grams);
  }
  return [...byMaterial].map(([materialCode, grams]) => ({
    materialCode,
    grams,
  }));
}

// --- Queries ---------------------------------------------------------------------

/**
 * `/app/requests`: new requests, pickups under way, and the latest finished
 * ones. New and active are soonest first (a trip under way on top); done is
 * newest first.
 */
export const requests = query({
  args: {},
  returns: v.object({
    new: v.array(vBookingView),
    active: v.array(vBookingView),
    done: v.array(vBookingView),
  }),
  handler: async (ctx) => {
    const { org } = await requireOrg(ctx, SHOP, "read");
    const materials = await materialIndex(ctx);
    const withStatus = (status: BookingStatus, limit: number) =>
      ctx.db
        .query("bookings")
        .withIndex("by_org_status", (q) =>
          q.eq("orgId", org._id).eq("status", status),
        )
        .order("desc")
        .take(limit);

    const fresh = await withStatus("requested", 100);
    const onTheWay = await withStatus("on_the_way", 100);
    const accepted = await withStatus("accepted", 100);
    const done = [
      ...(await withStatus("completed", DONE_SHOWN)),
      ...(await withStatus("declined", DONE_SHOWN)),
      ...(await withStatus("cancelled", DONE_SHOWN)),
    ]
      .toSorted((a, b) => b.updatedAt - a.updatedAt)
      .slice(0, DONE_SHOWN);

    const views = (bookings: Booking[]) =>
      bookings.map((booking) => bookingView(booking, org.city, materials));
    return {
      new: views(fresh.toSorted(bySlot)),
      active: views([
        ...onTheWay.toSorted(bySlot),
        ...accepted.toSorted(bySlot),
      ]),
      done: views(done),
    };
  },
});

/**
 * `/app/requests/[id]`: one of my bookings, with its timeline, what I pay per
 * kg for each item, and the points it earned. Null for an unknown id or
 * another shop's booking.
 */
export const get = query({
  args: { bookingId: v.string() },
  returns: v.union(
    v.null(),
    v.object({
      booking: vBookingView,
      timeline: v.array(v.object({ status: vBookingStatus, at: v.number() })),
      rates: v.array(
        v.object({
          materialCode: v.string(),
          paisePerKg: v.number(),
          source: v.union(v.literal("mine"), v.literal("city")),
        }),
      ),
      points: v.union(v.number(), v.null()),
    }),
  ),
  handler: async (ctx, args) => {
    const { org } = await requireOrg(ctx, SHOP, "read");
    const bookingId = ctx.db.normalizeId("bookings", args.bookingId);
    const booking = bookingId ? await ctx.db.get("bookings", bookingId) : null;
    if (booking?.orgId !== org._id) return null;

    const materials = await materialIndex(ctx);
    const rates = [];
    for (const item of booking.items) {
      const rate = await rateFor(ctx, org, item.materialCode);
      if (rate) rates.push({ materialCode: item.materialCode, ...rate });
    }
    return {
      booking: bookingView(booking, org.city, materials),
      timeline: booking.timeline,
      rates,
      points: booking.points ?? null,
    };
  },
});

/**
 * `/app/prices`: every scrap material the shop handles, with its price, the
 * admin's floor and fallback, and today's market price.
 */
export const rateCard = query({
  args: {},
  returns: v.object({
    city: v.string(),
    rows: v.array(
      v.object({
        material: vMaterialRef,
        /** Null when the shop hasn't set one: households get the fallback. */
        myPaise: v.union(v.number(), v.null()),
        offerUpdatedAt: v.optional(v.number()),
        offerExpiresAt: v.optional(v.number()),
        floorPaise: v.union(v.number(), v.null()),
        fallbackPaise: v.union(v.number(), v.null()),
        marketPaise: v.union(v.number(), v.null()),
        marketDate: v.union(v.string(), v.null()),
        marketSource: v.optional(v.string()),
      }),
    ),
  }),
  handler: async (ctx) => {
    const { org } = await requireOrg(ctx, SHOP, "read");
    const today = indiaToday();
    const materials = await ctx.db
      .query("materials")
      .withIndex("by_sortOrder")
      .take(500);
    const rows = [];
    for (const material of materials) {
      if (!isShopMaterial(org, material)) continue;
      const mine = await myRate(ctx, org._id, material.code);
      const reference = await referencePrice(ctx, org.city, material.code);
      const market = await marketPriceOn(ctx, org.city, material.code, today);
      rows.push({
        material: {
          code: material.code,
          names: material.names,
          family: material.family,
        },
        myPaise: mine && isRateCurrent(mine) ? mine.paisePerKg : null,
        ...(mine && {
          offerUpdatedAt: mine.updatedAt,
          offerExpiresAt: mine.expiresAt ?? mine.updatedAt + 86_400_000,
        }),
        floorPaise: reference?.floorPaise ?? null,
        fallbackPaise: reference?.fallbackPaise ?? null,
        marketPaise: market?.paisePerKg ?? null,
        marketDate: market?.date ?? null,
        ...(market && { marketSource: market.sourceLabel }),
      });
    }
    return { city: org.city, rows };
  },
});

/** What the shop paid households today and over the last seven days. */
export const payouts = query({
  args: {},
  returns: v.object({
    todayPaise: v.number(),
    todayCount: v.number(),
    weekPaise: v.number(),
    weekCount: v.number(),
  }),
  handler: async (ctx) => {
    const { org } = await requireOrg(ctx, SHOP, "read");
    const today = indiaToday();
    const weekStart = shiftDate(today, -6);
    const completed = await ctx.db
      .query("bookings")
      .withIndex("by_org_status", (q) =>
        q.eq("orgId", org._id).eq("status", "completed"),
      )
      .order("desc")
      .take(500);

    const totals = { todayPaise: 0, todayCount: 0, weekPaise: 0, weekCount: 0 };
    for (const { receipt } of completed) {
      if (!receipt) continue;
      const day = indiaToday(receipt.paidAt);
      if (day < weekStart || day > today) continue;
      totals.weekPaise += receipt.totalPaise;
      totals.weekCount += 1;
      if (day !== today) continue;
      totals.todayPaise += receipt.totalPaise;
      totals.todayCount += 1;
    }
    return totals;
  },
});

// --- Mutations -------------------------------------------------------------------

/** Accept or decline a new request. Accepting reveals who and where. */
export const respond = mutation({
  args: { bookingId: v.id("bookings"), accept: v.boolean() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { profile, org } = await requireOrg(ctx, SHOP);
    const booking = await myBooking(ctx, org, args.bookingId);
    if (args.accept)
      await requireCollectionCapacity(
        ctx,
        org,
        booking.slotDate,
        booking.slotWindow,
        booking._id,
      );
    if (booking.dispatch) {
      if (args.accept) await acceptOffer(ctx, booking, Date.now(), profile._id);
      else
        await advanceOffer(ctx, booking, "declined", Date.now(), profile._id);
    } else {
      await moveBooking(ctx, {
        booking,
        to: args.accept ? "accepted" : "declined",
        actorProfileId: profile._id,
        now: Date.now(),
      });
      if (args.accept)
        await queueBookingNotification(ctx, booking, "booking_accepted");
    }
    return null;
  },
});

/** "I'm on the way" — the household's tracking page shows it. */
export const startTrip = mutation({
  args: { bookingId: v.id("bookings") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { profile, org } = await requireOrg(ctx, SHOP);
    const booking = await myBooking(ctx, org, args.bookingId);
    if (booking.mode !== "pickup") throw new ConvexError("NOT_A_PICKUP");
    await moveBooking(ctx, {
      booking,
      to: "on_the_way",
      actorProfileId: profile._id,
      now: Date.now(),
    });
    return null;
  },
});

/**
 * Weigh and pay. Each line is priced at the shop's rate card (the city's
 * fallback where it has none), the receipt keeps the rate used, the household
 * earns points, and the weighed grams go into the shop's stock — the weight,
 * never the estimate, is the truth.
 */
export const complete = mutation({
  args: {
    bookingId: v.id("bookings"),
    lines: v.array(v.object({ materialCode: v.string(), grams: v.number() })),
    method: v.union(v.literal("cash"), v.literal("upi")),
  },
  returns: v.object({ totalPaise: v.number(), points: v.number() }),
  handler: async (ctx, args) => {
    const { profile, org } = await requireOrg(ctx, SHOP);
    const booking = await myBooking(ctx, org, args.bookingId);
    if (!canMoveBooking(booking.status, "completed")) {
      throw new ConvexError("WRONG_STATUS");
    }

    const materials = await materialIndex(ctx);
    const lines = [];
    for (const line of weighedLines(args.lines)) {
      const material = materials.get(line.materialCode);
      if (!isOrdinaryMaterial(material) || material.stage !== "scrap") {
        throw new ConvexError("INVALID_MATERIAL");
      }
      const rate = await rateFor(ctx, org, line.materialCode);
      if (!rate) throw new ConvexError("NO_PRICE");
      lines.push({
        materialCode: line.materialCode,
        grams: line.grams,
        paisePerKg: rate.paisePerKg,
        paise: paiseFor(line.grams, rate.paisePerKg),
      });
    }
    const totalPaise = lines.reduce((sum, line) => sum + line.paise, 0);
    const points = pointsFor(totalPaise);
    const now = Date.now();

    await moveBooking(ctx, {
      booking,
      to: "completed",
      actorProfileId: profile._id,
      now,
      patch: {
        receipt: {
          lines,
          totalPaise,
          method: args.method,
          paidAt: now,
          declaredByProfileId: profile._id,
          recipientProfileId: booking.householdProfileId,
        },
        points,
      },
      metadata: {
        totalPaise,
        method: args.method,
        points,
        lines: lines.map(({ materialCode, grams, paisePerKg }) => ({
          materialCode,
          grams,
          paisePerKg,
        })),
      },
    });
    for (const line of lines)
      await recordInventoryMovement(ctx, {
        orgId: org._id,
        actorProfileId: profile._id,
        materialCode: line.materialCode,
        deltaGrams: line.grams,
        addedCostPaise: line.paise,
        sourceKey: `booking:${booking._id}:${line.materialCode}`,
        createdAt: now,
      });
    return { totalPaise, points };
  },
});

/** Set what the shop pays per kg for one material — with no compulsory platform minimum. */
// eslint-disable-next-line unicorn/no-non-function-verb-prefix -- a Convex mutation, which clients call as a function; its name is the API contract
export const setRate = mutation({
  args: {
    materialCode: v.string(),
    paisePerKg: v.number(),
    expiresAt: v.optional(v.number()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { profile, org } = await requireOrg(ctx, SHOP);
    const { materialCode, paisePerKg } = args;
    if (
      !Number.isSafeInteger(paisePerKg) ||
      paisePerKg <= 0 ||
      paisePerKg > MAX_RATE_PAISE
    ) {
      throw new ConvexError("INVALID_PRICE");
    }
    const material = await ctx.db
      .query("materials")
      .withIndex("by_code", (q) => q.eq("code", materialCode))
      .first();
    if (!isShopMaterial(org, material)) {
      throw new ConvexError("NOT_MY_MATERIAL");
    }
    const now = Date.now();
    if (
      args.expiresAt !== undefined &&
      (!Number.isSafeInteger(args.expiresAt) || args.expiresAt <= now)
    )
      throw new ConvexError("INVALID_PRICE");
    const existing = await myRate(ctx, org._id, materialCode);
    let rateCardId: Id<"rateCards">;
    if (existing) {
      rateCardId = existing._id;
      await ctx.db.patch("rateCards", rateCardId, {
        paisePerKg,
        expiresAt: args.expiresAt,
        updatedAt: now,
      });
    } else {
      rateCardId = await ctx.db.insert("rateCards", {
        orgId: org._id,
        materialCode,
        paisePerKg,
        expiresAt: args.expiresAt,
        updatedAt: now,
      });
    }
    await ctx.db.insert("auditLog", {
      orgId: org._id,
      actorProfileId: profile._id,
      action: "rateCard.set",
      entityTable: "rateCards",
      entityId: rateCardId,
      metadata: {
        materialCode,
        fromPaise: existing?.paisePerKg ?? null,
        toPaise: paisePerKg,
      },
      createdAt: now,
    });
    return null;
  },
});

/** Current dispatch preferences. Existing shops default to manual acceptance. */
export const dispatchSettings = query({
  args: {},
  returns: v.object({
    autoAccept: v.boolean(),
    pickupRadiusKm: v.number(),
    canManage: v.boolean(),
    canAutoAccept: v.boolean(),
  }),
  handler: async (ctx) => {
    const { org, role } = await requireOrg(ctx, SHOP, "read");
    return {
      ...settingsFor(org),
      canManage: role === "owner",
      canAutoAccept: org.offersPickup && org.location !== undefined,
    };
  },
});

/** Only the owner can authorise automatic acceptance for future pickup offers. */
export const configureDispatch = mutation({
  args: { autoAccept: v.boolean(), pickupRadiusKm: v.number() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { profile, org, role } = await requireOrg(ctx, SHOP);
    if (role !== "owner") throw new ConvexError("OWNER_REQUIRED");
    if (
      !Number.isSafeInteger(args.pickupRadiusKm) ||
      args.pickupRadiusKm < 1 ||
      args.pickupRadiusKm > 50
    ) {
      throw new ConvexError("INVALID_RADIUS");
    }
    if (args.autoAccept && (!org.offersPickup || !org.location))
      throw new ConvexError("PICKUP_LOCATION_REQUIRED");
    const before = settingsFor(org);
    if (
      before.autoAccept === args.autoAccept &&
      before.pickupRadiusKm === args.pickupRadiusKm
    )
      return null;
    const now = Date.now();
    await ctx.db.patch("orgs", org._id, { ...args, updatedAt: now });
    await ctx.db.insert("auditLog", {
      orgId: org._id,
      actorProfileId: profile._id,
      action: "shop.dispatch_configured",
      entityTable: "orgs",
      entityId: org._id,
      metadata: { before, after: args },
      createdAt: now,
    });
    return null;
  },
});
