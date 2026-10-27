/** How a shop's price sits against today's market. */
export type MarketSide = "above" | "below" | "same";

export function compareToMarket(mine: number, market: number): MarketSide {
  if (mine > market) return "above";
  return mine < market ? "below" : "same";
}

/** What a household is paid: the shop's own price, else the city fallback. */
export function effectivePaise(row: {
  myPaise: number | null;
  fallbackPaise: number | null;
}): number | null {
  return row.myPaise;
}

/**
 * The few materials the home screen's price check shows: those with the most
 * stock first (what the shop actually buys), in rate-card order otherwise.
 * Only materials with both a price and a market price.
 */
export function pickPriceCheck<
  T extends {
    material: { code: string };
    myPaise: number | null;
    fallbackPaise: number | null;
    marketPaise: number | null;
  },
>(rows: readonly T[], stockGrams: ReadonlyMap<string, number>, count = 3): T[] {
  return rows
    .filter((row) => effectivePaise(row) !== null && row.marketPaise !== null)
    .map((row, index) => ({
      row,
      index,
      grams: stockGrams.get(row.material.code) ?? 0,
    }))
    .toSorted((a, b) => b.grams - a.grams || a.index - b.index)
    .slice(0, count)
    .map(({ row }) => row);
}
