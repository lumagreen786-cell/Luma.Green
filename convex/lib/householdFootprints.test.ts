import { expect, it } from "vitest";

import { electricityLogInput } from "./householdFootprints";

it("calculates exact milligrams and rejects invalid periods or unsafe quantities", () => {
  const input = {
    periodStart: "2026-11-01",
    periodEnd: "2026-11-16",
    wattHours: 10_500,
  };
  expect(electricityLogInput(input, "2026-11-16")).toBe(7_087_500);
  for (const wattHours of [
    -1,
    0.5,
    Infinity,
    Number.MAX_SAFE_INTEGER,
    1_000_000_001,
  ]) {
    expect(
      electricityLogInput({ ...input, wattHours }, "2026-11-16"),
    ).toBeNull();
  }
  for (const [periodStart, periodEnd] of [
    ["2026-02-30", "2026-03-01"],
    ["2026-11-17", "2026-11-16"],
    ["2026-11-01", "2026-11-17"],
    ["2024-01-01", "2026-11-16"],
  ]) {
    expect(
      electricityLogInput({ ...input, periodStart, periodEnd }, "2026-11-16"),
    ).toBeNull();
  }
  expect(electricityLogInput({ ...input, wattHours: 0 }, "2026-11-16")).toBe(0);
});
