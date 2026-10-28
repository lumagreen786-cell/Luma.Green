import { ConvexError, v } from "convex/values";
import { z } from "zod";

import type { Doc, Id } from "./_generated/dataModel";
import type { MutationCtx } from "./_generated/server";
import { internalMutation, mutation, query } from "./_generated/server";
import { isProfileOpen } from "./lib/accountClosure";
import {
  availableCapacity,
  canServeCollection,
  DEFAULT_WINDOW_CAPACITY,
  requireCollectionCapacity,
} from "./lib/collectionScheduling";
import { shiftDate } from "./lib/dates";
import { beginDispatch, isPickupLocationEligible } from "./lib/dispatch";
import { vSaathiTime } from "./lib/drafts";
import { canHouseholdCancel, SLOT_WINDOWS } from "./lib/households";
import { indiaToday } from "./lib/onboarding";
import { currentProfile, requireOrg } from "./lib/workspace";

export const availability = query({
  args: { orgId: v.id("orgs"), date: v.string() },
  returns: v.array(v.object({ window: vSaathiTime, remaining: v.number() })),
  handler: async (ctx, args) => {
    const org = await ctx.db.get("orgs", args.orgId);
    if (org?.kind !== "kabadiwala" || org.status !== "active") return [];
    return Promise.all(
      SLOT_WINDOWS.map(async (window) => ({
        window,
        remaining: await availableCapacity(ctx, org, args.date, window),
      })),
    );
  },
});
export const settings = query({
  args: {},
  returns: v.object({
    capacityPerWindow: v.number(),
    holidayDates: v.array(v.string()),
    enabledWindows: v.array(vSaathiTime),
    canManage: v.boolean(),
  }),
  handler: async (ctx) => {
    const { org, role } = await requireOrg(ctx, ["kabadiwala"], "read");
    const row = await ctx.db
      .query("collectionAvailability")
      .withIndex("by_org", (q) => q.eq("orgId", org._id))
      .unique();
    return {
      canManage: role === "owner" || role === "admin",
      capacityPerWindow: row?.capacityPerWindow ?? DEFAULT_WINDOW_CAPACITY,
      holidayDates: row?.holidayDates ?? [],
      enabledWindows: row?.enabledWindows ?? [...SLOT_WINDOWS],
    };
  },
});
export const saveAvailability = mutation({
  args: {
    capacityPerWindow: v.number(),
    holidayDates: v.array(v.string()),
    enabledWindows: v.array(vSaathiTime),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { org, profile } = await requireOrg(ctx, ["kabadiwala"], "manage");
    if (
      !Number.isSafeInteger(args.capacityPerWindow) ||
      args.capacityPerWindow < 1 ||
      args.capacityPerWindow > 1000 ||
      args.holidayDates.length > 60 ||
      args.holidayDates.some((d) => !z.iso.date().safeParse(d).success) ||
      new Set(args.enabledWindows).size !== args.enabledWindows.length
    )
      throw new ConvexError("INVALID_AVAILABILITY");
    const row = await ctx.db
      .query("collectionAvailability")
      .withIndex("by_org", (q) => q.eq("orgId", org._id))
      .unique();
    const values = { ...args, orgId: org._id, updatedAt: Date.now() };
    if (row) await ctx.db.patch("collectionAvailability", row._id, values);
    else await ctx.db.insert("collectionAvailability", values);
    await ctx.db.insert("auditLog", {
      orgId: org._id,
      actorProfileId: profile._id,
      action: "collection.availability_updated",
      entityTable: "orgs",
      entityId: org._id,
      createdAt: Date.now(),
    });
    return null;
  },
});
export const reschedule = mutation({
  args: { bookingId: v.id("bookings"), date: v.string(), window: vSaathiTime },
  returns: v.union(v.literal("changed"), v.literal("requested")),
  handler: async (ctx, args) => {
    const profile = await currentProfile(ctx);
    const booking = await ctx.db.get("bookings", args.bookingId);
    if (!profile || booking?.householdProfileId !== profile._id)
      throw new ConvexError("NOT_FOUND");
    const now = Date.now();
    const org = await ctx.db.get("orgs", booking.orgId);
    if (!org || (booking.mode === "pickup" && !org.offersPickup))
      throw new ConvexError("NOT_FOUND");
    await requireCollectionCapacity(
      ctx,
      org,
      args.date,
      args.window,
      booking._id,
    );
    if (booking.status === "on_the_way") {
      await ctx.db.patch("bookings", booking._id, {
        rescheduleRequest: {
          slotDate: args.date,
          slotWindow: args.window,
          requestedAt: now,
        },
        updatedAt: now,
      });
    } else {
      if (!canHouseholdCancel(booking.status))
        throw new ConvexError("WRONG_STATUS");
      await ctx.db.patch("bookings", booking._id, {
        slotDate: args.date,
        slotWindow: args.window,
        rescheduleRequest: undefined,
        updatedAt: now,
      });
      if (booking.status === "requested") {
        const changed = await ctx.db.get("bookings", booking._id);
        if (changed) await beginDispatch(ctx, changed, org, now);
      }
    }
    await ctx.db.insert("auditLog", {
      orgId: org._id,
      actorProfileId: profile._id,
      action:
        booking.status === "on_the_way"
          ? "booking.reschedule_requested"
          : "booking.rescheduled",
      entityTable: "bookings",
      entityId: booking._id,
      createdAt: now,
    });
    return booking.status === "on_the_way" ? "requested" : "changed";
  },
});
export const failedVisit = mutation({
  args: { bookingId: v.id("bookings"), reason: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { org, profile } = await requireOrg(ctx, ["kabadiwala"]);
    const booking = await ctx.db.get("bookings", args.bookingId);
    if (booking?.orgId !== org._id) throw new ConvexError("NOT_FOUND");
    if (booking.status !== "accepted" && booking.status !== "on_the_way")
      throw new ConvexError("WRONG_STATUS");
    const reason = args.reason.trim();
    if (reason.length < 5 || reason.length > 500)
      throw new ConvexError("INVALID_REASON");
    const now = Date.now();
    await ctx.db.patch("bookings", booking._id, {
      status: "cancelled",
      failedVisitReason: reason,
      timeline: [...booking.timeline, { status: "cancelled", at: now }],
      updatedAt: now,
    });
    await ctx.db.insert("auditLog", {
      orgId: org._id,
      actorProfileId: profile._id,
      action: "booking.visit_failed",
      entityTable: "bookings",
      entityId: booking._id,
      metadata: { reason },
      createdAt: now,
    });
    return null;
  },
});
export const repeat = mutation({
  args: {
    bookingId: v.id("bookings"),
    everyDays: v.union(v.literal(7), v.literal(14), v.literal(30)),
  },
  returns: v.id("recurringCollections"),
  handler: async (ctx, args) => {
    const profile = await currentProfile(ctx);
    const booking = await ctx.db.get("bookings", args.bookingId);
    if (!profile || booking?.householdProfileId !== profile._id)
      throw new ConvexError("NOT_FOUND");
    const rows = await ctx.db
      .query("recurringCollections")
      .withIndex("by_household", (q) => q.eq("householdProfileId", profile._id))
      .take(20);
    const existing = rows.find((r) => r.bookingId === booking._id);
    const now = Date.now();
    let nextDate = shiftDate(booking.slotDate, args.everyDays);
    while (nextDate <= indiaToday(now))
      nextDate = shiftDate(nextDate, args.everyDays);
    const values = {
      bookingId: booking._id,
      householdProfileId: profile._id,
      everyDays: args.everyDays,
      nextDate,
      active: true,
      updatedAt: now,
    };
    let id;
    if (existing) {
      await ctx.db.patch("recurringCollections", existing._id, values);
      id = existing._id;
    } else {
      if (rows.length >= 20) throw new ConvexError("TOO_MANY_SCHEDULES");
      id = await ctx.db.insert("recurringCollections", {
        ...values,
        createdAt: now,
      });
    }
    await ctx.db.insert("auditLog", {
      actorProfileId: profile._id,
      action: "collection.repeat_saved",
      entityTable: "recurringCollections",
      entityId: id,
      createdAt: now,
    });
    return id;
  },
});
export const schedules = query({
  args: {},
  returns: v.array(
    v.object({
      id: v.id("recurringCollections"),
      bookingId: v.id("bookings"),
      everyDays: v.number(),
      nextDate: v.string(),
      active: v.boolean(),
    }),
  ),
  handler: async (ctx) => {
    const p = await currentProfile(ctx);
    if (!p) throw new ConvexError("UNAUTHENTICATED");
    const rows = await ctx.db
      .query("recurringCollections")
      .withIndex("by_household", (q) => q.eq("householdProfileId", p._id))
      .take(20);
    return rows.map((r) => ({
      id: r._id,
      bookingId: r.bookingId,
      everyDays: r.everyDays,
      nextDate: r.nextDate,
      active: r.active,
    }));
  },
});
export const stopRepeating = mutation({
  args: { id: v.id("recurringCollections") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const p = await currentProfile(ctx);
    const row = await ctx.db.get("recurringCollections", args.id);
    if (!p || row?.householdProfileId !== p._id)
      throw new ConvexError("NOT_FOUND");
    await ctx.db.patch("recurringCollections", row._id, {
      active: false,
      updatedAt: Date.now(),
    });
    await ctx.db.insert("auditLog", {
      actorProfileId: p._id,
      action: "collection.repeat_stopped",
      entityTable: "recurringCollections",
      entityId: row._id,
      createdAt: Date.now(),
    });
    return null;
  },
});
/** One scheduler owner; cursor and operation key commit with each dated request. */
async function openRecurrences(
  ctx: MutationCtx,
  rows: Doc<"recurringCollections">[],
  now: number,
) {
  const active: Doc<"recurringCollections">[] = [];
  for (const row of rows) {
    if (await isProfileOpen(ctx, row.householdProfileId)) active.push(row);
    else await ctx.db.patch(row._id, { active: false, updatedAt: now });
  }
  return active;
}
export const generate = internalMutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    const now = Date.now(),
      today = indiaToday(now),
      horizon = shiftDate(today, 6);
    const rows = await ctx.db
      .query("recurringCollections")
      .withIndex("by_active_nextDate", (q) =>
        q.eq("active", true).lte("nextDate", horizon),
      )
      .take(50);
    const openRows = await openRecurrences(ctx, rows, now);
    for (const row of openRows) {
      const template = await ctx.db.get("bookings", row.bookingId);
      const org = template ? await ctx.db.get("orgs", template.orgId) : null;
      let date = row.nextDate;
      for (let count = 0; count < 7 && date <= horizon; count++) {
        const key = `${row._id}:${date}`;
        const existing = await ctx.db
          .query("bookings")
          .withIndex("by_recurring_date", (q) => q.eq("recurringDateKey", key))
          .unique();
        const origin = template?.dispatch?.approximateLocation
          ? undefined
          : template?.dispatch?.origin;
        const eligible =
          template &&
          org &&
          canServeCollection(org, template.mode) &&
          isPickupLocationEligible(org, origin);
        const isDatedEligible = !existing && date >= today;
        if (
          eligible &&
          isDatedEligible &&
          (await availableCapacity(ctx, org, date, template.slotWindow)) > 0
        ) {
          const id = await ctx.db.insert("bookings", {
            token: crypto.randomUUID().replaceAll("-", "").slice(0, 24),
            requestKind: template.requestKind,
            householdProfileId: row.householdProfileId,
            phone: template.phone,
            name: template.name,
            mode: template.mode,
            items: [],
            orgId: org._id,
            slotDate: date,
            slotWindow: template.slotWindow,
            address: template.address,
            status: "requested",
            timeline: [{ status: "requested", at: now }],
            recurringCollectionId: row._id,
            recurringDateKey: key,
            createdAt: now,
            updatedAt: now,
          });
          await dispatchGenerated(ctx, id, org, now, origin);
          await ctx.db.insert("auditLog", {
            actorProfileId: row.householdProfileId,
            orgId: org._id,
            action: "collection.repeat_generated",
            entityTable: "bookings",
            entityId: id,
            createdAt: now,
          });
        }
        date = shiftDate(date, row.everyDays);
      }
      await ctx.db.patch("recurringCollections", row._id, {
        nextDate: date,
        updatedAt: now,
      });
    }
    return null;
  },
});
export const myRequests = query({
  args: {},
  returns: v.array(
    v.object({
      id: v.id("bookings"),
      date: v.string(),
      window: vSaathiTime,
      token: v.string(),
      status: v.string(),
      unassigned: v.boolean(),
    }),
  ),
  handler: async (ctx) => {
    const p = await currentProfile(ctx);
    if (!p) return [];
    const rows = await ctx.db
      .query("bookings")
      .withIndex("by_household", (q) => q.eq("householdProfileId", p._id))
      .order("desc")
      .take(20);
    return rows
      .filter((r) => ["requested", "accepted", "on_the_way"].includes(r.status))
      .map((r) => ({
        id: r._id,
        date: r.slotDate,
        window: r.slotWindow,
        token: r.token,
        status: r.status,
        unassigned:
          r.status === "requested" && r.dispatch?.expiresAt === undefined,
      }));
  },
});
export const operatorRequests = query({
  args: {},
  returns: v.array(
    v.object({
      id: v.id("bookings"),
      date: v.string(),
      window: vSaathiTime,
      rescheduleDate: v.optional(v.string()),
      rescheduleWindow: v.optional(vSaathiTime),
    }),
  ),
  handler: async (ctx) => {
    const { org } = await requireOrg(ctx, ["kabadiwala"], "read");
    const rows = await ctx.db
      .query("bookings")
      .withIndex("by_org_date_window", (q) => q.eq("orgId", org._id))
      .order("desc")
      .take(100);
    return rows
      .filter((r) => ["accepted", "on_the_way"].includes(r.status))
      .map((r) => ({
        id: r._id,
        date: r.slotDate,
        window: r.slotWindow,
        rescheduleDate: r.rescheduleRequest?.slotDate,
        rescheduleWindow: r.rescheduleRequest?.slotWindow,
      }));
  },
});
export const approveReschedule = mutation({
  args: { bookingId: v.id("bookings") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { org, profile } = await requireOrg(ctx, ["kabadiwala"]);
    const booking = await ctx.db.get("bookings", args.bookingId);
    if (booking?.orgId !== org._id) throw new ConvexError("NOT_FOUND");
    if (!booking.rescheduleRequest || booking.status !== "on_the_way")
      throw new ConvexError("WRONG_STATUS");
    const request = booking.rescheduleRequest;
    await requireCollectionCapacity(
      ctx,
      org,
      request.slotDate,
      request.slotWindow,
      booking._id,
    );
    const now = Date.now();
    await ctx.db.patch("bookings", booking._id, {
      slotDate: request.slotDate,
      slotWindow: request.slotWindow,
      rescheduleRequest: undefined,
      status: "accepted",
      timeline: [...booking.timeline, { status: "accepted", at: now }],
      updatedAt: now,
    });
    await ctx.db.insert("auditLog", {
      orgId: org._id,
      actorProfileId: profile._id,
      action: "booking.reschedule_approved",
      entityTable: "bookings",
      entityId: booking._id,
      createdAt: now,
    });
    return null;
  },
});

async function dispatchGenerated(
  ctx: MutationCtx,
  id: Id<"bookings">,
  org: Doc<"orgs">,
  now: number,
  origin: { lat: number; lng: number } | undefined,
) {
  const booking = await ctx.db.get("bookings", id);
  if (booking) await beginDispatch(ctx, booking, org, now, origin);
}
