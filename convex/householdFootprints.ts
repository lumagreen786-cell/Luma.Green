import { ConvexError, v } from "convex/values";

import {
  GRID_FACTOR_SOURCE,
  GRID_FACTOR_VERSION,
  GRID_GRAMS_CO2_PER_KWH,
} from "../src/lib/household-footprint";
import { mutation, query, type QueryCtx } from "./_generated/server";
import { requireUser } from "./lib/access";
import { findProfile } from "./lib/applicationAccess";
import { electricityLogInput } from "./lib/householdFootprints";
import { indiaToday } from "./lib/onboarding";

async function owner(ctx: QueryCtx) {
  const user = await requireUser(ctx);
  const profile = await findProfile(ctx, user._id);
  if (!profile || profile.closedAt !== undefined)
    throw new ConvexError("NO_PROFILE");
  return profile;
}

export const mine = query({
  args: {},
  returns: v.array(
    v.object({
      id: v.id("householdFootprints"),
      periodStart: v.string(),
      periodEnd: v.string(),
      wattHours: v.number(),
      milliGramsCO2: v.number(),
      factorVersion: v.string(),
      source: v.string(),
      createdAt: v.number(),
    }),
  ),
  handler: async (ctx) => {
    const profile = await owner(ctx);
    const rows = await ctx.db
      .query("householdFootprints")
      .withIndex("by_profile_created", (q) => q.eq("profileId", profile._id))
      .order("desc")
      .take(30);
    return rows.map(
      ({
        _id,
        periodStart,
        periodEnd,
        wattHours,
        milliGramsCO2,
        factorVersion,
        source,
        createdAt,
      }) => ({
        id: _id,
        periodStart,
        periodEnd,
        wattHours,
        milliGramsCO2,
        factorVersion,
        source,
        createdAt,
      }),
    );
  },
});

export const save = mutation({
  args: {
    operationKey: v.string(),
    periodStart: v.string(),
    periodEnd: v.string(),
    wattHours: v.number(),
    consent: v.literal(true),
  },
  returns: v.id("householdFootprints"),
  handler: async (ctx, args) => {
    const profile = await owner(ctx);
    const milliGramsCO2 = electricityLogInput(args, indiaToday(Date.now()));
    if (milliGramsCO2 === null || !/^[\da-f-]{36}$/i.test(args.operationKey))
      throw new ConvexError("INVALID_FOOTPRINT");
    const existing = await ctx.db
      .query("householdFootprints")
      .withIndex("by_profile_operation", (q) =>
        q.eq("profileId", profile._id).eq("operationKey", args.operationKey),
      )
      .unique();
    if (existing) {
      if (
        existing.wattHours !== args.wattHours ||
        existing.periodStart !== args.periodStart ||
        existing.periodEnd !== args.periodEnd
      )
        throw new ConvexError("OPERATION_CONFLICT");
      return existing._id;
    }
    const recent = await ctx.db
      .query("householdFootprints")
      .withIndex("by_profile_created", (q) =>
        q
          .eq("profileId", profile._id)
          .gte("createdAt", Date.now() - 86_400_000),
      )
      .take(21);
    if (recent.length >= 20) throw new ConvexError("FOOTPRINT_LIMIT");
    const id = await ctx.db.insert("householdFootprints", {
      profileId: profile._id,
      operationKey: args.operationKey,
      periodStart: args.periodStart,
      periodEnd: args.periodEnd,
      wattHours: args.wattHours,
      milliGramsCO2,
      factorGramsPerKwh: GRID_GRAMS_CO2_PER_KWH,
      factorVersion: GRID_FACTOR_VERSION,
      source: GRID_FACTOR_SOURCE,
      createdAt: Date.now(),
    });
    await ctx.db.insert("auditLog", {
      actorProfileId: profile._id,
      action: "household.footprint_saved",
      entityTable: "householdFootprints",
      entityId: id,
      createdAt: Date.now(),
    });
    return id;
  },
});

export const remove = mutation({
  args: { id: v.id("householdFootprints") },
  returns: v.null(),
  handler: async (ctx, { id }) => {
    const profile = await owner(ctx);
    const row = await ctx.db.get("householdFootprints", id);
    if (row?.profileId !== profile._id)
      throw new ConvexError("FOOTPRINT_UNAVAILABLE");
    await ctx.db.delete(id);
    await ctx.db.insert("auditLog", {
      actorProfileId: profile._id,
      action: "household.footprint_removed",
      entityTable: "householdFootprints",
      entityId: id,
      createdAt: Date.now(),
    });
    return null;
  },
});
