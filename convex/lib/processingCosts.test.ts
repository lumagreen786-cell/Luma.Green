import { expect, it } from "vitest";

import {
  allocateRecordedCost,
  consumeRecordedCost,
  recordedCost,
  recordedCostReference,
  totalRecordedCost,
} from "./processingCosts";

it("keeps partial cost remainders and consumes the final paise exactly", () => {
  expect(consumeRecordedCost(9, 10, 4)).toEqual({ consumed: 4, remaining: 6 });
  expect(consumeRecordedCost(5, 6, 5)).toEqual({ consumed: 6, remaining: 0 });
  expect(consumeRecordedCost(3, 2, 1)).toEqual({ consumed: 0, remaining: 2 });
  expect(consumeRecordedCost(2, 2, 1)).toEqual({ consumed: 1, remaining: 1 });
  expect(consumeRecordedCost(1, 1, 1)).toEqual({ consumed: 1, remaining: 0 });
});
it("allocates every paise by output mass with stable largest-remainder ties", () => {
  expect(allocateRecordedCost(7, [2, 1])).toEqual([5, 2]);
  expect(allocateRecordedCost(2, [1, 1, 1])).toEqual([1, 1, 0]);
  expect(allocateRecordedCost(5, [1, 2])).toEqual([2, 3]);
  const maximum = Number.MAX_SAFE_INTEGER;
  const shares = allocateRecordedCost(maximum, [maximum - 1, 1]);
  expect(shares).toEqual([maximum - 1, 1]);
});
it("distinguishes unknown costs from explicitly recorded zero", () => {
  expect(recordedCost(undefined)).toBeNull();
  expect(consumeRecordedCost(1, null, 1)).toEqual({
    consumed: null,
    remaining: null,
  });
  expect(totalRecordedCost([1, null, 2])).toBeNull();
  expect(totalRecordedCost([0, 0])).toBe(0);
  expect(allocateRecordedCost(null, [1, 2])).toEqual([null, null]);
  expect(allocateRecordedCost(0, [1, 2])).toEqual([0, 0]);
  expect(() => recordedCostReference(0, "")).toThrow("COST_REFERENCE_REQUIRED");
});
it("rejects invalid costs and overflow without using unsafe multiplication", () => {
  for (const cost of [-1, 0.1, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1])
    expect(() => recordedCost(cost)).toThrow("INVALID_PRICE");
  expect(() => totalRecordedCost([Number.MAX_SAFE_INTEGER, 1])).toThrow(
    "COST_OVERFLOW",
  );
  expect(() => totalRecordedCost([null, Number.MAX_SAFE_INTEGER, 1])).toThrow(
    "COST_OVERFLOW",
  );
  expect(() => consumeRecordedCost(1, 1, 2)).toThrow("NOT_ENOUGH_LOT_GRAMS");
});
