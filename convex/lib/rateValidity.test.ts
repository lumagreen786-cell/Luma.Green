import { expect, it } from "vitest";

import { isRateCurrent } from "./rateValidity";

it("expires an ordinary offer at 24 hours and honours explicit validity", () => {
  expect(isRateCurrent({ updatedAt: 1 }, 86_400_000)).toBe(true);
  expect(isRateCurrent({ updatedAt: 1 }, 86_400_001)).toBe(false);
  expect(
    isRateCurrent({ updatedAt: 1, expiresAt: 90_000_000 }, 86_400_001),
  ).toBe(true);
  expect(isRateCurrent({ updatedAt: 2 }, 1)).toBe(false);
});
