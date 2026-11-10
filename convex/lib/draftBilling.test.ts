import { describe, expect, it } from "vitest";

import { billingMonth, draftAmounts } from "./draftBilling";

describe("draft billing calculations", () => {
  it("uses the India billing month at the UTC boundary", () => {
    expect(billingMonth(Date.UTC(2026, 9, 31, 18, 29))).toBe("2026-10");
    expect(billingMonth(Date.UTC(2026, 9, 31, 18, 30))).toBe("2026-11");
  });

  it("rounds and caps each order separately before adding the base", () => {
    expect(draftAmounts(10_000, [99, 100, 2_000_000], 50, 400)).toEqual({
      feesPaise: [0, 1, 400],
      subtotalPaise: 10_401,
    });
  });

  it("rejects fractional, negative and overflowing amounts", () => {
    expect(() => draftAmounts(10, [1.5], 50, 400)).toThrow(
      "INVALID_DRAFT_PRICE",
    );
    expect(() => draftAmounts(10, [10], -1, 400)).toThrow(
      "INVALID_DRAFT_PRICE",
    );
    expect(() => draftAmounts(Number.MAX_SAFE_INTEGER, [100], 50, 400)).toThrow(
      "DRAFT_TOTAL_TOO_LARGE",
    );
  });
});
