import { describe, expect, it } from "vitest";

import { compareToMarket, effectivePaise, pickPriceCheck } from "./prices";

function row(
  code: string,
  prices: {
    myPaise?: number | null;
    fallbackPaise?: number | null;
    marketPaise?: number | null;
  } = {},
) {
  const { myPaise = 1000, fallbackPaise = 1000, marketPaise = 1100 } = prices;
  return { material: { code }, myPaise, fallbackPaise, marketPaise };
}

describe("compareToMarket", () => {
  it("says where the shop's price sits", () => {
    expect(compareToMarket(1500, 1400)).toBe("above");
    expect(compareToMarket(1300, 1400)).toBe("below");
    expect(compareToMarket(1400, 1400)).toBe("same");
  });
});

describe("effectivePaise", () => {
  it("uses only the current shop offer", () => {
    expect(effectivePaise({ myPaise: 1450, fallbackPaise: 1400 })).toBe(1450);
    expect(effectivePaise({ myPaise: null, fallbackPaise: 1400 })).toBeNull();
    expect(effectivePaise({ myPaise: null, fallbackPaise: null })).toBeNull();
  });
});

describe("pickPriceCheck", () => {
  it("shows what the shop holds most of, in rate-card order otherwise", () => {
    const rows = [row("A"), row("B"), row("C"), row("D"), row("E")];
    const stock = new Map([
      ["D", 50_000],
      ["B", 90_000],
    ]);
    expect(pickPriceCheck(rows, stock).map((r) => r.material.code)).toEqual([
      "B",
      "D",
      "A",
    ]);
  });

  it("skips materials without a market price or any price", () => {
    const rows = [
      row("A", { marketPaise: null }),
      row("B", { myPaise: null, fallbackPaise: null }),
      row("C"),
    ];
    expect(pickPriceCheck(rows, new Map()).map((r) => r.material.code)).toEqual(
      ["C"],
    );
  });
});
