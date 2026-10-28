import { ConvexError, v } from "convex/values";

import type { Id } from "./_generated/dataModel";
import { mutation, query } from "./_generated/server";
import { requireAdmin } from "./lib/access";
import { findProfile } from "./lib/applicationAccess";
import { canonicalCity } from "./lib/geography";
import { indiaToday } from "./lib/onboarding";
import { priceProblem } from "./lib/review";
import { vFamily } from "./lib/validators";
import { vNames } from "./lib/views";

/** Indicative city references only. They never change a business offer. */

const MAX_MATERIALS = 200;

function cityFrom(input: string): string {
  const city = canonicalCity(input);
  if (!city) throw new ConvexError("INVALID_CITY");
  return city;
}

/** Every material in catalogue order, with the city's floor and fallback. */
export const list = query({
  args: { city: v.string() },
  returns: v.array(
    v.object({
      code: v.string(),
      family: vFamily,
      stage: v.union(v.literal("scrap"), v.literal("recycled")),
      names: vNames,
      floorPaise: v.union(v.number(), v.null()),
      fallbackPaise: v.union(v.number(), v.null()),
      updatedAt: v.union(v.number(), v.null()),
    }),
  ),
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const city = cityFrom(args.city);
    const materials = await ctx.db
      .query("materials")
      .withIndex("by_sortOrder")
      .take(MAX_MATERIALS);
    const rows = [];
    for (const material of materials) {
      if (!material.active) continue;
      const price = await ctx.db
        .query("referencePrices")
        .withIndex("by_city_material", (q) =>
          q.eq("city", city).eq("materialCode", material.code),
        )
        .first();
      rows.push({
        code: material.code,
        family: material.family,
        stage: material.stage,
        names: material.names,
        floorPaise: price?.floorPaise ?? null,
        fallbackPaise: price?.fallbackPaise ?? null,
        updatedAt: price?.updatedAt ?? null,
      });
    }
    return rows;
  },
});

/** Set indicative reference bounds. The response retains a zero lifted count. */
export const set = mutation({
  args: {
    city: v.string(),
    materialCode: v.string(),
    floorPaise: v.number(),
    fallbackPaise: v.number(),
  },
  returns: v.object({ lifted: v.number() }),
  handler: async (ctx, args) => {
    const admin = await requireAdmin(ctx);
    const city = cityFrom(args.city);
    const problem = priceProblem(args.floorPaise, args.fallbackPaise);
    if (problem) throw new ConvexError(problem);
    const material = await ctx.db
      .query("materials")
      .withIndex("by_code", (q) => q.eq("code", args.materialCode))
      .first();
    if (!material) throw new ConvexError("UNKNOWN_MATERIAL");

    const adminProfile = await findProfile(ctx, admin._id);
    const actorProfileId = adminProfile?._id;
    const now = Date.now();
    const next = {
      floorPaise: args.floorPaise,
      fallbackPaise: args.fallbackPaise,
    };
    const current = await ctx.db
      .query("referencePrices")
      .withIndex("by_city_material", (q) =>
        q.eq("city", city).eq("materialCode", material.code),
      )
      .first();
    const isUnchanged =
      current?.floorPaise === next.floorPaise &&
      current.fallbackPaise === next.fallbackPaise;
    if (isUnchanged) return { lifted: 0 };

    // One row per city and material (the price board reads it as unique);
    // the audit log keeps every earlier value.
    let priceId: Id<"referencePrices">;
    if (current) {
      priceId = current._id;
      await ctx.db.patch("referencePrices", priceId, {
        ...next,
        updatedAt: now,
      });
    } else {
      priceId = await ctx.db.insert("referencePrices", {
        city,
        materialCode: material.code,
        ...next,
        updatedAt: now,
      });
    }

    const lifted = 0;

    await ctx.db.insert("auditLog", {
      actorProfileId,
      action: "referencePrice.updated",
      entityTable: "referencePrices",
      entityId: priceId,
      metadata: {
        city,
        materialCode: material.code,
        from: current
          ? {
              floorPaise: current.floorPaise,
              fallbackPaise: current.fallbackPaise,
            }
          : null,
        to: next,
        lifted,
      },
      createdAt: now,
    });
    return { lifted };
  },
});

/** A dated, source-labelled indication. It does not change any agreed order. */
export const recordMarket = mutation({
  args: {
    city: v.string(),
    materialCode: v.string(),
    date: v.string(),
    paisePerKg: v.number(),
    sourceLabel: v.string(),
    observedAt: v.number(),
    expiresAt: v.optional(v.number()),
  },
  returns: v.id("marketPrices"),
  handler: async (ctx, args) => {
    const admin = await requireAdmin(ctx);
    const city = cityFrom(args.city);
    const sourceLabel = args.sourceLabel.trim();
    if (!sourceLabel || sourceLabel.length > 200)
      throw new ConvexError("INVALID_REFERENCE");
    if (
      !Number.isSafeInteger(args.paisePerKg) ||
      args.paisePerKg <= 0 ||
      args.paisePerKg > 1_000_000
    )
      throw new ConvexError("INVALID_PRICE");
    const now = Date.now();
    if (
      !Number.isSafeInteger(args.observedAt) ||
      args.observedAt > now ||
      args.observedAt < 0 ||
      indiaToday(args.observedAt) !== args.date
    )
      throw new ConvexError("INVALID_DATE");
    if (
      args.expiresAt !== undefined &&
      (!Number.isSafeInteger(args.expiresAt) ||
        args.expiresAt <= args.observedAt)
    )
      throw new ConvexError("INVALID_DATE");
    const material = await ctx.db
      .query("materials")
      .withIndex("by_code", (q) => q.eq("code", args.materialCode))
      .unique();
    if (!material?.active) throw new ConvexError("UNKNOWN_MATERIAL");
    const actor = await findProfile(ctx, admin._id);
    const id = await ctx.db.insert("marketPrices", {
      ...args,
      city,
      sourceLabel,
    });
    await ctx.db.insert("auditLog", {
      actorProfileId: actor?._id,
      action: "marketPrice.recorded",
      entityTable: "marketPrices",
      entityId: id,
      metadata: {
        materialCode: args.materialCode,
        city,
        date: args.date,
        sourceLabel,
        observedAt: args.observedAt,
      },
      createdAt: now,
    });
    return id;
  },
});
