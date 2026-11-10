import { ConvexError, v } from "convex/values";

import { mutation, query } from "./_generated/server";
import { requireAdmin } from "./lib/access";
import {
  APARTMENT_PARTNERS,
  apartmentPartner,
} from "./lib/apartmentCollections";
import { reassignCollection } from "./lib/dispatch";
import { canonicalCity } from "./lib/geography";
import { apartmentCode } from "./lib/households";
import { indiaToday } from "./lib/onboarding";
import { requireRecentSession } from "./lib/organizations";
import { currentProfile } from "./lib/workspace";
export const board = query({
  args: {},
  returns: v.object({
    bookings: v.array(v.object({ id: v.id("bookings"), label: v.string() })),
  }),
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const requests = [];
    for (const status of ["requested", "accepted"] as const) {
      const rows = await ctx.db
        .query("bookings")
        .withIndex("by_status_createdAt", (q) => q.eq("status", status))
        .order("desc")
        .take(50);
      requests.push(
        ...rows.filter((row) => row.mode === "pickup" && !row.apartmentRouteId),
      );
    }
    return {
      bookings: requests.map((row) => ({
        id: row._id,
        label: `${row.slotDate} · ${row.slotWindow} · ${row.token.slice(-4)}`,
      })),
    };
  },
});
/** Derive locality from the selected private booking; never accept a caller city. */
export const shops = query({
  args: { bookingId: v.id("bookings") },
  returns: v.object({
    city: v.union(v.string(), v.null()),
    shops: v.array(v.object({ id: v.id("orgs"), label: v.string() })),
  }),
  handler: async (ctx, { bookingId }) => {
    await requireAdmin(ctx);
    const booking = await ctx.db.get("bookings", bookingId);
    if (
      booking?.mode !== "pickup" ||
      booking.apartmentRouteId ||
      !["requested", "accepted"].includes(booking.status)
    )
      return { city: null, shops: [] };
    const current = await ctx.db.get("orgs", booking.orgId);
    const city =
      current?.kind === "kabadiwala" ? canonicalCity(current.city) : null;
    if (!city) return { city: null, shops: [] };
    const candidates = await ctx.db
      .query("orgs")
      .withIndex("by_kind_city", (q) =>
        q.eq("kind", "kabadiwala").eq("city", city).eq("status", "active"),
      )
      .take(100);
    return {
      city,
      shops: candidates
        .filter((row) => row.offersPickup && row._id !== booking.orgId)
        .map((row) => ({ id: row._id, label: `${row.name} · ${row.area}` })),
    };
  },
});
export const reassign = mutation({
  args: {
    bookingId: v.id("bookings"),
    orgId: v.id("orgs"),
    reason: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const profile = await currentProfile(ctx);
    if (!profile) throw new ConvexError("NO_PROFILE");
    const reason = args.reason.trim();
    if (reason.length < 5 || reason.length > 500)
      throw new ConvexError("INVALID_REASON");
    const booking = await ctx.db.get("bookings", args.bookingId),
      org = await ctx.db.get("orgs", args.orgId);
    if (!booking || !org) throw new ConvexError("NOT_FOUND");
    await reassignCollection(
      ctx,
      booking,
      org,
      profile._id,
      reason,
      Date.now(),
    );
    return null;
  },
});

export const apartmentChoices = query({
  args: { city: v.string() },
  returns: v.object({
    partners: v.array(
      v.object({ id: v.id("stakeholderAccounts"), name: v.string() }),
    ),
    shops: v.array(v.object({ id: v.id("orgs"), name: v.string() })),
  }),
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const city = canonicalCity(args.city);
    if (!city) return { partners: [], shops: [] };
    const partners = [];
    for (const type of APARTMENT_PARTNERS) {
      const candidates = await ctx.db
        .query("stakeholderAccounts")
        .withIndex("by_status_participant_createdAt", (q) =>
          q.eq("status", "approved").eq("participantType", type),
        )
        .order("desc")
        .take(50);
      for (const candidate of candidates) {
        if (await apartmentPartner(ctx, candidate._id))
          partners.push({
            id: candidate._id,
            name: candidate.organizationName,
          });
      }
    }
    const shops = await ctx.db
      .query("orgs")
      .withIndex("by_kind_city_pickup", (q) =>
        q
          .eq("kind", "kabadiwala")
          .eq("city", city)
          .eq("status", "active")
          .eq("offersPickup", true),
      )
      .take(100);
    return {
      partners,
      shops: shops.map((org) => ({ id: org._id, name: org.name })),
    };
  },
});

export const apartmentRoutes = query({
  args: {},
  returns: v.array(
    v.object({
      id: v.id("apartmentCollectionRoutes"),
      city: v.string(),
      code: v.string(),
      validUntil: v.string(),
      collector: v.string(),
    }),
  ),
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const rows = await ctx.db
      .query("apartmentCollectionRoutes")
      .withIndex("by_active_created", (q) => q.eq("active", true))
      .order("desc")
      .take(100);
    return Promise.all(
      rows.map(async (row) => {
        const org = await ctx.db.get("orgs", row.orgId);
        return {
          id: row._id,
          city: row.city,
          code: row.code,
          validUntil: row.validUntil,
          collector: org?.name ?? "",
        };
      }),
    );
  },
});

export const publishApartmentRoute = mutation({
  args: {
    city: v.string(),
    code: v.string(),
    orgId: v.id("orgs"),
    partnerId: v.id("stakeholderAccounts"),
    reviewReference: v.string(),
    validUntil: v.string(),
  },
  returns: v.id("apartmentCollectionRoutes"),
  handler: async (ctx, args) => {
    const admin = await requireAdmin(ctx);
    await requireRecentSession(ctx);
    const city = canonicalCity(args.city);
    const code = apartmentCode(args.code);
    const reference = args.reviewReference.trim();
    const parsedDate = new Date(args.validUntil + "T00:00:00Z");
    if (
      !city ||
      !code ||
      reference.length < 5 ||
      reference.length > 200 ||
      !/^\d{4}-\d{2}-\d{2}$/.test(args.validUntil) ||
      !Number.isFinite(parsedDate.getTime()) ||
      parsedDate.toISOString().slice(0, 10) !== args.validUntil ||
      args.validUntil < indiaToday()
    )
      throw new ConvexError("INVALID_APARTMENT_ROUTE");
    const org = await ctx.db.get("orgs", args.orgId);
    if (
      org?.kind !== "kabadiwala" ||
      org.status !== "active" ||
      org.city !== city ||
      !org.offersPickup ||
      !(await apartmentPartner(ctx, args.partnerId))
    )
      throw new ConvexError("APARTMENT_ROUTE_UNAVAILABLE");
    const existing = await ctx.db
      .query("apartmentCollectionRoutes")
      .withIndex("by_city_code_active", (q) =>
        q.eq("city", city).eq("code", code).eq("active", true),
      )
      .first();
    if (existing) throw new ConvexError("APARTMENT_ROUTE_EXISTS");
    const now = Date.now();
    const id = await ctx.db.insert("apartmentCollectionRoutes", {
      city,
      code,
      reviewReference: reference,
      orgId: org._id,
      partnerId: args.partnerId,
      validUntil: args.validUntil,
      reviewedBy: admin._id,
      active: true,
      createdAt: now,
    });
    const profile = await currentProfile(ctx);
    await ctx.db.insert("auditLog", {
      actorProfileId: profile?._id,
      orgId: org._id,
      action: "apartment.route_published",
      entityTable: "apartmentCollectionRoutes",
      entityId: id,
      createdAt: now,
    });
    return id;
  },
});

export const revokeApartmentRoute = mutation({
  args: { id: v.id("apartmentCollectionRoutes") },
  returns: v.boolean(),
  handler: async (ctx, { id }) => {
    await requireAdmin(ctx);
    const route = await ctx.db.get("apartmentCollectionRoutes", id);
    if (!route?.active) return false;
    await ctx.db.patch(id, { active: false });
    const profile = await currentProfile(ctx);
    await ctx.db.insert("auditLog", {
      actorProfileId: profile?._id,
      orgId: route.orgId,
      action: "apartment.route_revoked",
      entityTable: "apartmentCollectionRoutes",
      entityId: id,
      createdAt: Date.now(),
    });
    return true;
  },
});
