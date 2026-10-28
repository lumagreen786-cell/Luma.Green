import { ConvexError } from "convex/values";

interface Balance {
  materialCode: string;
  grams: number;
  costPaise?: number | null;
}
interface Movement {
  materialCode: string;
  deltaGrams: number;
  costDeltaPaise: number | null;
}
function exact(value: number) {
  if (!Number.isSafeInteger(value) || value < 0)
    throw new ConvexError("INVALID_STOCK_TOTAL");
  return value;
}
function nextBalance(
  previous: { grams: number; costPaise: number | null },
  movement: Movement,
) {
  if (
    !Number.isSafeInteger(movement.deltaGrams) ||
    movement.deltaGrams === 0 ||
    !Number.isSafeInteger(movement.costDeltaPaise ?? 0)
  )
    throw new ConvexError("INVALID_STOCK_TOTAL");
  if (
    movement.deltaGrams > 0 &&
    movement.costDeltaPaise !== null &&
    movement.costDeltaPaise < 0
  )
    throw new ConvexError("INVALID_STOCK_TOTAL");
  const grams = exact(previous.grams + movement.deltaGrams);
  let costPaise: number | null = null;
  if (grams === 0) costPaise = 0;
  else if (previous.costPaise !== null && movement.costDeltaPaise !== null)
    costPaise = exact(previous.costPaise + movement.costDeltaPaise);
  return { grams, costPaise };
}
/** Movements retain each material's insertion order from the canonical index. */
export function closingSnapshot(inventory: Balance[], movements: Movement[]) {
  const balances = new Map<
    string,
    { grams: number; costPaise: number | null }
  >();
  for (const movement of movements) {
    const previous = balances.get(movement.materialCode) ?? {
      grams: 0,
      costPaise: 0,
    };
    balances.set(movement.materialCode, nextBalance(previous, movement));
  }
  const seen = new Set<string>();
  const lines = inventory
    .map((row) => {
      exact(row.grams);
      const costPaise = row.grams === 0 ? 0 : (row.costPaise ?? null);
      if (costPaise !== null) exact(costPaise);
      if (seen.has(row.materialCode))
        throw new ConvexError("STOCK_LEDGER_MISMATCH");
      seen.add(row.materialCode);
      const balance = balances.get(row.materialCode) ?? {
        grams: 0,
        costPaise: 0,
      };
      if (row.grams !== balance.grams || costPaise !== balance.costPaise)
        throw new ConvexError("STOCK_LEDGER_MISMATCH");
      return { materialCode: row.materialCode, grams: row.grams, costPaise };
    })
    .toSorted((a, b) => a.materialCode.localeCompare(b.materialCode));
  for (const [code, balance] of balances)
    if (!seen.has(code) && balance.grams !== 0)
      throw new ConvexError("STOCK_LEDGER_MISMATCH");
  let totalGrams = 0;
  let totalCostPaise: number | null = 0;
  for (const row of lines) {
    totalGrams = exact(totalGrams + row.grams);
    if (row.costPaise === null) totalCostPaise = null;
    else if (totalCostPaise !== null)
      totalCostPaise = exact(totalCostPaise + row.costPaise);
  }
  return { lines, totalGrams, totalCostPaise };
}
