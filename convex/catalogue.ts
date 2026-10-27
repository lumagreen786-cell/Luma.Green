import { ConvexError, v } from "convex/values";

import { mutation, query } from "./_generated/server";
import { requireAdmin } from "./lib/access";
import { findProfile } from "./lib/applicationAccess";
import { CATALOGUE } from "./lib/catalogue";
import { shiftDate } from "./lib/dates";
import { indiaToday } from "./lib/onboarding";
import {
  foundationMaterials,
  PET_REFERENCE_DEFINITIONS,
  PET_REFERENCE_SOURCE,
} from "./lib/referenceDefinitions";
import { vFamily } from "./lib/validators";
import { vNames } from "./lib/views";

/** The material catalogue — public: it's the shared code list. */
export const materials = query({
  args: {},
  returns: v.array(
    v.object({
      code: v.string(),
      family: vFamily,
      stage: v.union(v.literal("scrap"), v.literal("recycled")),
      names: vNames,
      co2eFactor: v.union(v.number(), v.null()),
    }),
  ),
  handler: async (ctx) => {
    const rows = await ctx.db
      .query("materials")
      .withIndex("by_sortOrder")
      .collect();
    return rows
      .filter((row) => row.active)
      .map((row) => ({
        code: row.code,
        family: row.family,
        stage: row.stage,
        names: row.names,
        co2eFactor: row.co2eFactor ?? null,
      }));
  },
});

/** Add canonical definitions only. Existing materials and all operational data stay intact. */
export const initializeDefinitions = mutation({
  args: {},
  returns: v.object({
    inserted: v.number(),
    definitionsInserted: v.number(),
    materialsSkipped: v.number(),
    definitionsSkipped: v.number(),
  }),
  handler: async (ctx) => {
    const admin = await requireAdmin(ctx);
    const profile = await findProfile(ctx, admin._id);
    // Static, bounded input; never scan or replace the live catalogue.
    const materials = foundationMaterials();
    let inserted = 0;
    let definitionsInserted = 0;
    const now = Date.now();
    for (const [sortOrder, entry] of materials.entries()) {
      const existing = await ctx.db
        .query("materials")
        .withIndex("by_code", (q) => q.eq("code", entry.code))
        .unique();
      if (existing) {
        if (existing.family !== entry.family || existing.stage !== entry.stage)
          throw new ConvexError("MATERIAL_DEFINITION_CONFLICT");
        continue;
      }
      // Deliberately select fields: the source also contains prototype prices
      // and indicative factors, neither of which is a production input.
      const definition = {
        code: entry.code,
        family: entry.family,
        stage: entry.stage,
        names: entry.names,
        sortOrder,
        active: entry.active,
      };
      const id = await ctx.db.insert("materials", definition);
      await ctx.db.insert("auditLog", {
        actorProfileId: profile?._id,
        action: "material.definitionInitialized",
        entityTable: "materials",
        entityId: id,
        metadata: {
          adminUserId: admin._id,
          definition,
          factorStatus: "unknown",
          sourceReference: PET_REFERENCE_DEFINITIONS.some(
            ({ materialCode }) => materialCode === entry.code,
          )
            ? PET_REFERENCE_SOURCE
            : "convex/lib/catalogue.ts: canonical material labels only",
          hazardApprovalGranted: false,
        },
        createdAt: now,
      });
      inserted += 1;
    }
    for (const definition of PET_REFERENCE_DEFINITIONS) {
      const existing = await ctx.db
        .query("operationalDefinitions")
        .withIndex("by_material_version", (q) =>
          q
            .eq("materialCode", definition.materialCode)
            .eq("version", definition.version),
        )
        .unique();
      if (existing) {
        if (
          existing.family !== definition.family ||
          existing.stage !== definition.stage
        )
          throw new ConvexError("MATERIAL_DEFINITION_CONFLICT");
        // Preserve drafts and all later reviewed or retired content exactly.
        continue;
      }
      const id = await ctx.db.insert("operationalDefinitions", {
        ...definition,
        status: "draft",
        createdBy: admin._id,
        createdAt: now,
      });
      await ctx.db.insert("auditLog", {
        actorProfileId: profile?._id,
        action: "catalogue.definitionDrafted",
        entityTable: "operationalDefinitions",
        entityId: id,
        metadata: {
          adminUserId: admin._id,
          ...definition,
          initialization: true,
          hazardApprovalGranted: false,
        },
        createdAt: now,
      });
      definitionsInserted += 1;
    }
    return {
      inserted,
      definitionsInserted,
      materialsSkipped: materials.length - inserted,
      definitionsSkipped:
        PET_REFERENCE_DEFINITIONS.length - definitionsInserted,
    };
  },
});

/**
 * Small, reactive quotes for forms. Household estimates use only the admin's
 * fallback; listing suggestions use the latest market quote in the board's
 * 30-day window. Neither caller needs chart history or translated names.
 */
export const priceQuotes = query({
  args: {
    city: v.string(),
    source: v.union(v.literal("fallback"), v.literal("market")),
  },
  returns: v.object({
    rows: v.array(
      v.object({
        code: v.string(),
        paisePerKg: v.union(v.number(), v.null()),
      }),
    ),
  }),
  handler: async (ctx, args) => {
    const materials = await ctx.db
      .query("materials")
      .withIndex("by_sortOrder")
      .collect();
    const since = shiftDate(indiaToday(), -29);
    const rows = [];
    for (const material of materials) {
      if (!material.active) continue;
      if (args.source === "fallback") {
        const reference = await ctx.db
          .query("referencePrices")
          .withIndex("by_city_material", (q) =>
            q.eq("city", args.city).eq("materialCode", material.code),
          )
          .unique();
        rows.push({
          code: material.code,
          paisePerKg: reference?.fallbackPaise ?? null,
        });
      } else {
        const latest = await ctx.db
          .query("marketPrices")
          .withIndex("by_city_material_date", (q) =>
            q
              .eq("city", args.city)
              .eq("materialCode", material.code)
              .gte("date", since),
          )
          .order("desc")
          .first();
        rows.push({
          code: material.code,
          paisePerKg: latest?.paisePerKg ?? null,
        });
      }
    }
    return { rows };
  },
});

/**
 * The public price board for a city: today's price per material, the change
 * over a week, the admin's floor, and 30 days of history for the chart.
 */
export const priceBoard = query({
  args: { city: v.string() },
  returns: v.object({
    city: v.string(),
    date: v.union(v.string(), v.null()),
    rows: v.array(
      v.object({
        code: v.string(),
        family: vFamily,
        stage: v.union(v.literal("scrap"), v.literal("recycled")),
        names: vNames,
        todayPaise: v.union(v.number(), v.null()),
        weekChangePct: v.union(v.number(), v.null()),
        floorPaise: v.union(v.number(), v.null()),
        fallbackPaise: v.union(v.number(), v.null()),
        series: v.array(v.object({ date: v.string(), paisePerKg: v.number() })),
      }),
    ),
  }),
  handler: async (ctx, args) => {
    const materials = await ctx.db
      .query("materials")
      .withIndex("by_sortOrder")
      .collect();
    const since = shiftDate(indiaToday(), -29);
    let latest: string | null = null;
    const rows = [];
    for (const material of materials) {
      if (!material.active) continue;
      const series = await ctx.db
        .query("marketPrices")
        .withIndex("by_city_material_date", (q) =>
          q
            .eq("city", args.city)
            .eq("materialCode", material.code)
            .gte("date", since),
        )
        .collect();
      const reference = await ctx.db
        .query("referencePrices")
        .withIndex("by_city_material", (q) =>
          q.eq("city", args.city).eq("materialCode", material.code),
        )
        .unique();
      const last = series.at(-1);
      const weekAgo = series.at(-8);
      if (last && (latest === null || last.date > latest)) latest = last.date;
      rows.push({
        code: material.code,
        family: material.family,
        stage: material.stage,
        names: material.names,
        todayPaise: last?.paisePerKg ?? null,
        weekChangePct:
          last && weekAgo
            ? Math.round(
                ((last.paisePerKg - weekAgo.paisePerKg) / weekAgo.paisePerKg) *
                  1000,
              ) / 10
            : null,
        floorPaise: reference?.floorPaise ?? null,
        fallbackPaise: reference?.fallbackPaise ?? null,
        series: series.map((point) => ({
          date: point.date,
          paisePerKg: point.paisePerKg,
        })),
      });
    }
    return { city: args.city, date: latest, rows };
  },
});

/** Fill missing translations without changing existing names or material data. */
export const fillMissingNames = mutation({
  args: {},
  returns: v.object({ updated: v.number() }),
  handler: async (ctx) => {
    const admin = await requireAdmin(ctx);
    const profile = await findProfile(ctx, admin._id);
    let updated = 0;
    // This is bounded by the 26 canonical codes, with one indexed lookup each.
    // Unknown codes and absent materials are deliberately left untouched.
    for (const entry of CATALOGUE) {
      const material = await ctx.db
        .query("materials")
        .withIndex("by_code", (q) => q.eq("code", entry.code))
        .unique();
      if (!material) continue;
      const missing = Object.entries(entry.names).filter(
        ([locale]) => !Object.hasOwn(material.names, locale),
      );
      if (missing.length === 0) continue;
      const names = { ...Object.fromEntries(missing), ...material.names };
      await ctx.db.patch(material._id, { names });
      await ctx.db.insert("auditLog", {
        actorProfileId: profile?._id,
        action: "material.namesFilled",
        entityTable: "materials",
        entityId: material._id,
        metadata: {
          adminUserId: admin._id,
          code: material.code,
          addedLocales: missing.map(([locale]) => locale),
          from: material.names,
          to: names,
        },
        createdAt: Date.now(),
      });
      updated += 1;
    }
    return { updated };
  },
});
