import { describe, expect, it } from "vitest";

import { canonicalCity, INDIA_STATES_AND_UTS } from "./geography";

describe("explicit operational city", () => {
  it.each([
    [" BENGALURU ", "Bengaluru"],
    ["new   DELHI, delhi", "New Delhi, Delhi"],
    ["MUMBAI, maharashtra", "Mumbai, Maharashtra"],
    ["मुम्बई, Maharashtra", "मुम्बई, Maharashtra"],
    ["مدينة, Karnataka", "مدينة, Karnataka"],
  ])("normalizes %s without changing its spelling", (input, expected) => {
    expect(canonicalCity(input)).toBe(expected);
  });
  it.each([
    undefined,
    "",
    " ",
    "X",
    "12345",
    "Mumbai 400001",
    "https://city.invalid",
    "A".repeat(61),
  ])("rejects invalid city %s", (input) => {
    expect(canonicalCity(input)).toBeNull();
  });
});

it("requires state qualification and isolates same-name cities", () => {
  expect(canonicalCity("Mumbai")).toBeNull();
  expect(canonicalCity("Bilaspur, Chhattisgarh")).toBe(
    "Bilaspur, Chhattisgarh",
  );
  expect(canonicalCity("Bilaspur, Himachal Pradesh")).toBe(
    "Bilaspur, Himachal Pradesh",
  );
  expect(canonicalCity("Bilaspur, Unknown State")).toBeNull();
  expect(canonicalCity("Bengaluru, Karnataka")).toBe("Bengaluru");
  expect(canonicalCity("Bengaluru, Maharashtra")).toBe(
    "Bengaluru, Maharashtra",
  );
});

it("contains exactly the current 28 states and 8 union territories without retired split UTs", () => {
  expect(INDIA_STATES_AND_UTS).toHaveLength(36);
  expect(new Set(INDIA_STATES_AND_UTS).size).toBe(36);
  expect(INDIA_STATES_AND_UTS).toContain(
    "Dadra and Nagar Haveli and Daman and Diu",
  );
  expect(INDIA_STATES_AND_UTS).not.toContain("Daman and Diu");
  expect(INDIA_STATES_AND_UTS).not.toContain("Dadra and Nagar Haveli");
});
