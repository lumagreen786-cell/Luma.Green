import type { WithoutSystemFields } from "convex/server";
import { v } from "convex/values";

import type { Doc, Id } from "./_generated/dataModel";
import { internalMutation } from "./_generated/server";
import { CATALOGUE } from "./lib/catalogue";
import { shiftDate } from "./lib/dates";
import {
  DEMO_PRICE_ANCHOR,
  DEMO_PRICE_CITY,
  DEMO_PRICE_DAYS,
  demoPriceDate,
  demoPricePaise,
} from "./lib/demoPrices";

interface Snapshot<
  Table extends "materials" | "referencePrices" | "marketPrices",
> {
  id: Id<Table>;
  value: WithoutSystemFields<Doc<Table>>;
}

/**
 * Explicit operator-only sample-price import. No reset, patches, auth records,
 * operational records or provider calls. At most 26 + 26 + 780 insertions.
 * Existing keys win, including custom values. The audit manifest records only
 * new rows, with complete values for a separately reviewed future cleanup.
 */
export const seed = internalMutation({
  args: { asOf: v.string() },
  returns: v.object({
    materials: v.number(),
    referencePrices: v.number(),
    marketPrices: v.number(),
    auditId: v.union(v.id("auditLog"), v.null()),
  }),
  handler: async (ctx, { asOf }) => {
    const asOfTimestamp = demoPriceDate(asOf);
    const inserted = {
      materials: [] as Snapshot<"materials">[],
      referencePrices: [] as Snapshot<"referencePrices">[],
      marketPrices: [] as Snapshot<"marketPrices">[],
    };
    for (const [index, entry] of CATALOGUE.entries()) {
      const material = await ctx.db
        .query("materials")
        .withIndex("by_code", (q) => q.eq("code", entry.code))
        .first();
      if (!material) {
        const value = {
          code: entry.code,
          family: entry.family,
          stage: entry.stage,
          names: entry.names,
          co2eFactor: entry.co2eFactor,
          sortOrder: index,
          active: true,
        };
        inserted.materials.push({
          id: await ctx.db.insert("materials", value),
          value,
        });
      }
      const reference = await ctx.db
        .query("referencePrices")
        .withIndex("by_city_material", (q) =>
          q.eq("city", DEMO_PRICE_CITY).eq("materialCode", entry.code),
        )
        .first();
      if (!reference) {
        const value = {
          city: DEMO_PRICE_CITY,
          materialCode: entry.code,
          floorPaise: entry.floorPaise,
          fallbackPaise: entry.fallbackPaise,
          updatedAt: asOfTimestamp,
        };
        inserted.referencePrices.push({
          id: await ctx.db.insert("referencePrices", value),
          value,
        });
      }
      for (let offset = 1 - DEMO_PRICE_DAYS; offset <= 0; offset += 1) {
        const date = shiftDate(asOf, offset);
        const existing = await ctx.db
          .query("marketPrices")
          .withIndex("by_city_material_date", (q) =>
            q
              .eq("city", DEMO_PRICE_CITY)
              .eq("materialCode", entry.code)
              .eq("date", date),
          )
          .first();
        if (existing) continue;
        const value = {
          city: DEMO_PRICE_CITY,
          materialCode: entry.code,
          date,
          paisePerKg: demoPricePaise(entry.code, date),
          sourceLabel: "Synthetic demo reference — not a live market benchmark",
          observedAt: Date.parse(`${date}T00:00:00+05:30`),
        };
        inserted.marketPrices.push({
          id: await ctx.db.insert("marketPrices", value),
          value,
        });
      }
    }
    const counts = {
      materials: inserted.materials.length,
      referencePrices: inserted.referencePrices.length,
      marketPrices: inserted.marketPrices.length,
    };
    if (counts.materials + counts.referencePrices + counts.marketPrices === 0) {
      return { ...counts, auditId: null };
    }
    const auditId = await ctx.db.insert("auditLog", {
      action: "demo.prices.seeded",
      entityTable: "demoPrices",
      entityId: `${DEMO_PRICE_CITY}:${asOf}`,
      metadata: {
        version: 1,
        sampleData: true,
        city: DEMO_PRICE_CITY,
        asOf,
        anchor: DEMO_PRICE_ANCHOR,
        days: DEMO_PRICE_DAYS,
        inserted,
      },
      createdAt: Date.now(),
    });
    return { ...counts, auditId };
  },
});
