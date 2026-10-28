import type { FunctionReturnType } from "convex/server";

import type { api } from "../../../convex/_generated/api";

/** What `catalogue.priceBoard` returns, and its parts. */
export type PriceBoardData = FunctionReturnType<
  typeof api.catalogue.priceBoard
>;
export type PriceRow = PriceBoardData["rows"][number];
export type PricePoint = PriceRow["series"][number];
export type Family = PriceRow["family"];

/** Families in the order people look for them: paper and plastic first. */
export const FAMILY_ORDER = [
  "paper",
  "plastic",
  "metal",
  "glass",
  "ewaste",
  "other",
] as const satisfies readonly Family[];

export interface FamilyGroup {
  family: Family;
  rows: PriceRow[];
}

/**
 * Household scrap grouped by family (empty families dropped), and recycled
 * output kept apart for the factory-gate section. Rows keep the catalogue's
 * order inside each group.
 */
export function groupBoard(rows: readonly PriceRow[]): {
  scrap: FamilyGroup[];
  recycled: PriceRow[];
} {
  const scrap = FAMILY_ORDER.map((family) => ({
    family,
    rows: rows.filter((row) => row.stage === "scrap" && row.family === family),
  })).filter((group) => group.rows.length > 0);
  const recycled = rows.filter((row) => row.stage === "recycled");
  return { scrap, recycled };
}

export type Trend = "up" | "down" | "flat" | "unknown";

/** Which way a price moved over the week; unknown without a week of history. */
export function trendOf(changePct: number | null): Trend {
  if (changePct === null || !Number.isFinite(changePct)) return "unknown";
  if (changePct > 0) return "up";
  return changePct < 0 ? "down" : "flat";
}

/** Lowest and highest price in a series; null for an empty one. */
export function seriesRange(
  series: readonly PricePoint[],
): { low: number; high: number } | null {
  if (series.length === 0) return null;
  const prices = series.map((point) => point.paisePerKg);
  return { low: Math.min(...prices), high: Math.max(...prices) };
}

/** Whole days since 1970 for a `YYYY-MM-DD` date: an x-axis that skips no day. */
export function dayNumber(date: string): number {
  const [year = 1970, month = 1, day = 1] = date.split("-").map(Number);
  return Math.round(Date.UTC(year, month - 1, day) / 86_400_000);
}
