import { expect, it } from "vitest";

import {
  type ComparableOffer,
  compareEligibleOffers,
  deliveredPrice,
} from "./marketRanking";
function offer(
  id: string,
  overrides: Partial<ComparableOffer> = {},
): ComparableOffer {
  return {
    id,
    material: { code: "PET" },
    specification: { grade: "TEST", specification: "TEST-SPEC" },
    askPaisePerKg: 100,
    createdAt: 1,
    ...overrides,
  };
}
it("never treats unknown freight as a zero quote", () => {
  expect(deliveredPrice(offer("unknown"))).toBeNull();
  expect(deliveredPrice(offer("explicit-zero", { freightPaisePerKg: 0 }))).toBe(
    100,
  );
  const rows = [
    offer("unknown", { askPaisePerKg: 1, distanceKm: 0 }),
    offer("expensive", { freightPaisePerKg: 100 }),
    offer("best", { freightPaisePerKg: 10 }),
  ];
  expect(rows.toSorted(compareEligibleOffers).map((row) => row.id)).toEqual([
    "best",
    "expensive",
    "unknown",
  ]);
});
it("uses distance then earliest recorded availability for comparable prices", () => {
  const rows = [
    offer("far", { freightPaisePerKg: 10, distanceKm: 10 }),
    offer("later", {
      freightPaisePerKg: 10,
      distanceKm: 1,
      deliveryAvailableAt: 3,
    }),
    offer("first", {
      freightPaisePerKg: 10,
      distanceKm: 1,
      deliveryAvailableAt: 2,
    }),
  ];
  expect(rows.toSorted(compareEligibleOffers).map((row) => row.id)).toEqual([
    "first",
    "later",
    "far",
  ]);
});
it("keeps incompatible grades separate rather than ranking their rates as substitutes", () => {
  const a = offer("a", {
      askPaisePerKg: 10_000,
      freightPaisePerKg: 0,
      specification: { grade: "A", specification: "BuyerA" },
    }),
    b = offer("b", {
      askPaisePerKg: 1,
      freightPaisePerKg: 0,
      specification: { grade: "B", specification: "BuyerB" },
    });
  expect(compareEligibleOffers(a, b)).toBeLessThan(0);
});
