import { ConvexError } from "convex/values";

import { remainingCost } from "./inventoryLedger";
import { positiveGrams } from "./lotEvidence";

const MAX_COST = BigInt(Number.MAX_SAFE_INTEGER);
// eslint-disable-next-line unicorn/prefer-bigint-literals -- The shared root TypeScript target predates BigInt literal syntax.
const ZERO = BigInt(0);
// eslint-disable-next-line unicorn/prefer-bigint-literals -- The shared root TypeScript target predates BigInt literal syntax.
const ONE = BigInt(1);

export function recordedCost(value: number | null | undefined): number | null {
  if (value === undefined || value === null) return null;
  if (!Number.isSafeInteger(value) || value < 0)
    throw new ConvexError("INVALID_PRICE");
  return value;
}

export function recordedCostReference(
  cost: number | null,
  reference: string | undefined,
): string | undefined {
  const text = reference?.trim() ?? "";
  if (text.length === 0) {
    if (cost !== null) throw new ConvexError("COST_REFERENCE_REQUIRED");
    return undefined;
  }
  if (text.length < 3 || text.length > 500)
    throw new ConvexError("COST_REFERENCE_REQUIRED");
  return text;
}

export function consumeRecordedCost(
  availableGrams: number,
  cost: number | null | undefined,
  grams: number,
) {
  positiveGrams(availableGrams);
  positiveGrams(grams);
  if (grams > availableGrams) throw new ConvexError("NOT_ENOUGH_LOT_GRAMS");
  const currentCost = recordedCost(cost);
  if (currentCost === null) return { consumed: null, remaining: null };
  const remaining = remainingCost(availableGrams, currentCost, -grams, null);
  if (remaining === null) throw new ConvexError("INVALID_PRICE");
  return { consumed: currentCost - remaining, remaining };
}

export function totalRecordedCost(
  costs: readonly (number | null | undefined)[],
): number | null {
  let sum = ZERO;
  let hasUnknown = false;
  for (const cost of costs) {
    const value = recordedCost(cost);
    if (value === null) hasUnknown = true;
    else sum += BigInt(value);
  }
  if (sum > MAX_COST) throw new ConvexError("COST_OVERFLOW");
  return hasUnknown ? null : Number(sum);
}

/** Largest remainder allocation. Stable output order breaks equal remainders. */
export function allocateRecordedCost(
  cost: number | null,
  outputGrams: readonly number[],
): (number | null)[] {
  recordedCost(cost);
  if (outputGrams.length === 0 || outputGrams.length > 10)
    throw new ConvexError("INVALID_OUTPUTS");
  let mass = ZERO;
  for (const grams of outputGrams) mass += BigInt(positiveGrams(grams));
  if (mass > MAX_COST) throw new ConvexError("INVALID_WEIGHT");
  if (cost === null) return outputGrams.map(() => null);
  const total = BigInt(cost);
  const shares = outputGrams.map((grams, index) => ({
    index,
    amount: (total * BigInt(grams)) / mass,
    remainder: (total * BigInt(grams)) % mass,
  }));
  const floorTotal = shares.reduce((sum, share) => sum + share.amount, ZERO);
  const order = shares.toSorted((a, b) => {
    if (a.remainder === b.remainder) return a.index - b.index;
    return a.remainder > b.remainder ? -1 : 1;
  });
  for (let index = 0; index < Number(total - floorTotal); index += 1) {
    const share = order[index];
    share.amount += ONE;
  }
  return shares.map(({ amount }) => Number(amount));
}

export function canRecordAcquisitionCost(lot: {
  status: string;
  sourceKind: string;
  availableGrams: number;
  initialGrams: number;
  costBasisGrams?: number;
  initialCostPaise?: number | null;
  isAcquisitionCostRecordable?: boolean;
}): boolean {
  return (
    lot.status === "available" &&
    lot.initialCostPaise == null &&
    lot.availableGrams === (lot.costBasisGrams ?? lot.initialGrams) &&
    (lot.isAcquisitionCostRecordable ?? lot.sourceKind === "self_declared")
  );
}
