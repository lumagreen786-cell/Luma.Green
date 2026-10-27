import { expect, it } from "vitest";

import { closingSnapshot } from "./stockClosingSnapshot";

it("retains exact paise after proportional removals and keeps unknown cost unknown", () => {
  const known = closingSnapshot(
    [{ materialCode: "A", grams: 2, costPaise: 2 }],
    [
      { materialCode: "A", deltaGrams: 3, costDeltaPaise: 2 },
      { materialCode: "A", deltaGrams: -1, costDeltaPaise: 0 },
    ],
  );
  expect(known.totalCostPaise).toBe(2);
  expect(
    closingSnapshot(
      [{ materialCode: "A", grams: 1, costPaise: null }],
      [{ materialCode: "A", deltaGrams: 1, costDeltaPaise: null }],
    ).totalCostPaise,
  ).toBeNull();
});
it("starts a fresh known balance after unknown stock is fully consumed", () => {
  expect(
    closingSnapshot(
      [{ materialCode: "A", grams: 2, costPaise: 5 }],
      [
        { materialCode: "A", deltaGrams: 1, costDeltaPaise: null },
        { materialCode: "A", deltaGrams: -1, costDeltaPaise: null },
        { materialCode: "A", deltaGrams: 2, costDeltaPaise: 5 },
      ],
    ).totalCostPaise,
  ).toBe(5);
});
it("refuses projection drift, negative balances and unsafe totals rather than saving partial figures", () => {
  expect(() =>
    closingSnapshot([{ materialCode: "A", grams: 2, costPaise: 0 }], []),
  ).toThrow("STOCK_LEDGER_MISMATCH");
  expect(() =>
    closingSnapshot(
      [],
      [{ materialCode: "A", deltaGrams: -1, costDeltaPaise: 0 }],
    ),
  ).toThrow("INVALID_STOCK_TOTAL");
  expect(() =>
    closingSnapshot(
      [{ materialCode: "A", grams: 1, costPaise: 1 }],
      [{ materialCode: "A", deltaGrams: 1, costDeltaPaise: 2 }],
    ),
  ).toThrow("STOCK_LEDGER_MISMATCH");
  const rows = [
    { materialCode: "A", grams: Number.MAX_SAFE_INTEGER, costPaise: 0 },
    { materialCode: "B", grams: 1, costPaise: 0 },
  ];
  expect(() =>
    closingSnapshot(
      rows,
      rows.map((row) => ({
        materialCode: row.materialCode,
        deltaGrams: row.grams,
        costDeltaPaise: 0,
      })),
    ),
  ).toThrow("INVALID_STOCK_TOTAL");
});
