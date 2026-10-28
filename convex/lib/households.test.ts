import { describe, expect, it } from "vitest";

import {
  basketError,
  basketPaise,
  bookableDates,
  canHouseholdCancel,
  cleanAddress,
  distanceKm,
  isBookableDate,
  isOpenBooking,
  isValidAddress,
  isValidName,
  isValidPoint,
  isWindowOpen,
} from "./households";

const item = (materialCode: string, kg: number) => ({ materialCode, kg });

/** A moment on 29 Sep 2026, India time (UTC+5:30). */
function indiaTime(hours: number, minutes = 0): number {
  return Date.UTC(2026, 8, 29, hours, minutes) - 5.5 * 60 * 60 * 1000;
}

describe("a basket", () => {
  it("holds 1 to 20 different materials, each over 0 and up to 500 kg", () => {
    expect(basketError([item("PAPER-NEWS", 0.5)])).toBeNull();
    expect(basketError([item("PAPER-NEWS", 500)])).toBeNull();
    const twenty = Array.from({ length: 20 }, (_, index) =>
      item(`M-${String(index)}`, 1),
    );
    expect(basketError(twenty)).toBeNull();
    expect(basketError([...twenty, item("M-20", 1)])).toBe("TOO_MANY_ITEMS");
  });

  it("can't be empty, except when only comparing shops", () => {
    expect(basketError([])).toBe("EMPTY_BASKET");
    expect(basketError([], { allowEmpty: true })).toBeNull();
  });

  it("lists each material once", () => {
    expect(basketError([item("PAPER-NEWS", 1), item("PAPER-NEWS", 2)])).toBe(
      "DUPLICATE_ITEM",
    );
  });

  it("refuses weights that are zero, negative, too heavy or not numbers", () => {
    for (const kg of [0, -1, 500.5, NaN, Infinity, 0.0004]) {
      expect(basketError([item("PAPER-NEWS", kg)])).toBe("INVALID_KG");
    }
  });
});

describe("what a basket is worth", () => {
  it("prices each material per kg, in whole paise", () => {
    const prices: Record<string, number> = {
      "PAPER-NEWS": 1400,
      "PLASTIC-PET": 2000,
    };
    // 12 kg × ₹14 + 3 kg × ₹20 = ₹228
    expect(
      basketPaise(
        [item("PAPER-NEWS", 12), item("PLASTIC-PET", 3)],
        (code) => prices[code],
      ),
    ).toBe(22_800);
  });

  it("never drifts on weights that don't divide evenly", () => {
    // 1.001 kg at ₹14/kg is 1401.4 paise: rounded once, at the line.
    expect(basketPaise([item("PAPER-NEWS", 1.001)], () => 1400)).toBe(1401);
    expect(
      Number.isSafeInteger(basketPaise([item("X", 0.333)], () => 777)),
    ).toBe(true);
  });

  it("counts a material without a price as nothing, not a guess", () => {
    expect(
      basketPaise([item("PAPER-NEWS", 2), item("UNKNOWN", 5)], (code) =>
        code === "PAPER-NEWS" ? 1000 : undefined,
      ),
    ).toBe(2000);
  });
});

describe("when a booking can be for", () => {
  it("offers exactly seven dates, including today", () => {
    const dates = bookableDates("2026-09-29");
    expect(dates).toHaveLength(7);
    expect(dates[0]).toBe("2026-09-29");
    expect(dates.at(-1)).toBe("2026-10-05");
  });

  it("accepts today up to six days ahead, and real dates only", () => {
    const today = "2026-09-29";
    expect(isBookableDate("2026-09-29", today)).toBe(true);
    expect(isBookableDate("2026-10-05", today)).toBe(true);
    expect(isBookableDate("2026-09-28", today)).toBe(false);
    expect(isBookableDate("2026-10-07", today)).toBe(false);
    expect(isBookableDate("2026-09-31", today)).toBe(false);
    expect(isBookableDate("tomorrow", today)).toBe(false);
  });

  it("closes today's window an hour before it ends", () => {
    const today = "2026-09-29";
    expect(isWindowOpen(today, "morning", today, indiaTime(9, 59))).toBe(true);
    expect(isWindowOpen(today, "morning", today, indiaTime(10))).toBe(false);
    expect(isWindowOpen(today, "afternoon", today, indiaTime(11))).toBe(true);
    expect(isWindowOpen(today, "evening", today, indiaTime(19, 30))).toBe(
      false,
    );
  });

  it("keeps every window open on a later day, and none on a past day", () => {
    const today = "2026-09-29";
    const late = indiaTime(23, 30);
    expect(isWindowOpen("2026-09-30", "morning", today, late)).toBe(true);
    expect(isWindowOpen("2026-09-28", "evening", today, indiaTime(9))).toBe(
      false,
    );
  });
});

describe("what people type", () => {
  it("needs a name of 2 to 60 characters", () => {
    expect(isValidName("  Priya  ")).toBe(true);
    expect(isValidName("P")).toBe(false);
    expect(isValidName("x".repeat(61))).toBe(false);
  });

  it("keeps an address on one line, one part per line typed", () => {
    expect(cleanAddress("Flat 4B,\n  Rose   Apartments\n\nYeshwanthpur ")).toBe(
      "Flat 4B, Rose Apartments, Yeshwanthpur",
    );
    expect(isValidAddress("Flat 4B, Rose Apartments")).toBe(true);
    expect(isValidAddress("Flat 4B")).toBe(false);
  });
});

describe("where", () => {
  it("measures the straight-line distance in km", () => {
    const yeshwanthpur = { lat: 13.028, lng: 77.5409 };
    const malleshwaram = { lat: 13.0035, lng: 77.571 };
    expect(distanceKm(yeshwanthpur, yeshwanthpur)).toBe(0);
    const km = distanceKm(yeshwanthpur, malleshwaram);
    expect(km).toBeGreaterThan(4);
    expect(km).toBeLessThan(4.5);
    expect(distanceKm(malleshwaram, yeshwanthpur)).toBe(km);
  });

  it("only takes points on the globe", () => {
    expect(isValidPoint({ lat: 12.97, lng: 77.59 })).toBe(true);
    expect(isValidPoint({ lat: 91, lng: 77.59 })).toBe(false);
    expect(isValidPoint({ lat: 12.97, lng: NaN })).toBe(false);
  });
});

describe("after booking", () => {
  it("can be cancelled until the kabadiwala is on the way", () => {
    expect(canHouseholdCancel("requested")).toBe(true);
    expect(canHouseholdCancel("accepted")).toBe(true);
    expect(canHouseholdCancel("on_the_way")).toBe(false);
    expect(canHouseholdCancel("completed")).toBe(false);
    expect(canHouseholdCancel("cancelled")).toBe(false);
  });

  it("counts a booking as open until it's done, declined or cancelled", () => {
    expect(isOpenBooking("on_the_way")).toBe(true);
    expect(isOpenBooking("completed")).toBe(false);
    expect(isOpenBooking("declined")).toBe(false);
  });
});
