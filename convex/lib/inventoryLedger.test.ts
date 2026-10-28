import { describe, expect, it } from "vitest";

import { remainingCost } from "./inventoryLedger";

describe("recorded stock cost", () => {
  it("keeps each remainder until final consumption", () => {
    expect(remainingCost(3, 10, -1, null)).toBe(7);
    expect(remainingCost(2, 7, -1, null)).toBe(4);
    expect(remainingCost(1, 4, -1, null)).toBe(0);
  });
  it("does not invent cost for unknown intakes", () => {
    expect(remainingCost(0, 0, 100, null)).toBeNull();
    expect(remainingCost(100, null, 1, 10)).toBeNull();
    expect(remainingCost(100, null, -50, null)).toBeNull();
  });
  it("uses exact arithmetic near the safe integer boundary", () => {
    expect(remainingCost(3, Number.MAX_SAFE_INTEGER, -2, null)).toBe(
      3_002_399_751_580_331,
    );
    expect(() => remainingCost(1, Number.MAX_SAFE_INTEGER, 1, 1)).toThrow();
    expect(() => remainingCost(1, 0, -2, null)).toThrow();
  });
});
