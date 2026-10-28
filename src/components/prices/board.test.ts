import { describe, expect, it } from "vitest";

import {
  dayNumber,
  groupBoard,
  type PriceRow,
  seriesRange,
  trendOf,
} from "./board";

function row(
  code: string,
  family: PriceRow["family"],
  overrides: Partial<PriceRow> = {},
): PriceRow {
  return {
    code,
    family,
    stage: "scrap",
    names: { en: code },
    todayPaise: 1000,
    weekChangePct: 0,
    fallbackPaise: null,
    floorPaise: 800,
    series: [],
    ...overrides,
  };
}

describe("groupBoard", () => {
  it("groups scrap by family in reading order and drops empty families", () => {
    const { scrap } = groupBoard([
      row("METAL-IRON", "metal"),
      row("PAPER-NEWS", "paper"),
      row("PLASTIC-PET", "plastic"),
      row("PAPER-CARTON", "paper"),
    ]);

    expect(scrap.map((group) => group.family)).toEqual([
      "paper",
      "plastic",
      "metal",
    ]);
    expect(scrap[0]?.rows.map((r) => r.code)).toEqual([
      "PAPER-NEWS",
      "PAPER-CARTON",
    ]);
  });

  it("keeps recycled output out of the scrap families", () => {
    const { scrap, recycled } = groupBoard([
      row("PLASTIC-PET", "plastic"),
      row("RECYCLED-PET-FLAKE", "plastic", { stage: "recycled" }),
    ]);

    expect(scrap).toHaveLength(1);
    expect(scrap[0]?.rows.map((r) => r.code)).toEqual(["PLASTIC-PET"]);
    expect(recycled.map((r) => r.code)).toEqual(["RECYCLED-PET-FLAKE"]);
  });
});

describe("trendOf", () => {
  it("reads the week's change", () => {
    expect(trendOf(2.1)).toBe("up");
    expect(trendOf(-0.4)).toBe("down");
    expect(trendOf(0)).toBe("flat");
  });

  it("is unknown without a week of history", () => {
    expect(trendOf(null)).toBe("unknown");
    expect(trendOf(NaN)).toBe("unknown");
  });
});

describe("seriesRange", () => {
  it("finds the month's low and high", () => {
    expect(
      seriesRange([
        { date: "2026-09-27", paisePerKg: 1400 },
        { date: "2026-09-28", paisePerKg: 1350 },
        { date: "2026-09-29", paisePerKg: 1500 },
      ]),
    ).toEqual({ low: 1350, high: 1500 });
    expect(seriesRange([])).toBeNull();
  });
});

describe("dayNumber", () => {
  it("counts whole days, across a month end", () => {
    expect(dayNumber("2026-10-01") - dayNumber("2026-09-30")).toBe(1);
    expect(dayNumber("2026-09-29") - dayNumber("2026-08-31")).toBe(29);
  });
});
