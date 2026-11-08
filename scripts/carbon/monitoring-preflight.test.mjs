import { expect, test } from "vitest";

import { monitoringPreflight } from "./monitoring-preflight.mjs";

function fixture() {
  return {
    facility: "fixture-site",
    methodVersion: "fixture-method-v1",
    calculationVersion: "fixture-sheet-v1",
    claimRightsReference: "fixture-rights",
    start: "2026-10-01",
    endExclusive: "2026-11-01",
    baseline: { gramsCO2e: 3000, reference: "fixture-baseline" },
    project: { gramsCO2e: 3700, reference: "fixture-project" },
    leakage: { gramsCO2e: 100, reference: "fixture-leakage" },
    allocationsAlreadyClaimed: ["fixture-allocated"],
    batches: [
      {
        id: "fixture-batch",
        sourceAllocations: ["fixture-source"],
        recordedOn: "2026-10-31",
        inputGrams: 1000,
        eligibleOutputGrams: 900,
        otherOutputGrams: 50,
        rejectsGrams: 30,
        lossGrams: 20,
        massEvidence: "fixture-scale",
      },
    ],
  };
}

test("balances measured grams and preserves a negative net result", () => {
  expect(monitoringPreflight(fixture())).toEqual({
    status: "preflight_only_unverified",
    facility: "fixture-site",
    methodVersion: "fixture-method-v1",
    calculationVersion: "fixture-sheet-v1",
    eligibleOutputGrams: "900",
    netGramsCO2e: "-800",
  });
});

test("holds on duplicate allocations, an unbalanced batch or a date outside the period", () => {
  const sample = fixture();
  sample.batches.push({
    ...sample.batches[0],
    sourceAllocations: ["fixture-allocated"],
    recordedOn: sample.endExclusive,
    lossGrams: 21,
  });
  expect(monitoringPreflight(sample)).toEqual({
    status: "hold",
    problems: [
      "REPEATED_BATCH",
      "BATCH_OUTSIDE_PERIOD",
      "MASS_MISMATCH",
      "OVERLAPPING_ALLOCATION",
    ],
  });
});

test("rejects fractional mass, impossible dates and missing evidence", () => {
  const sample = fixture();
  sample.batches[0].inputGrams = 1.5;
  expect(() => monitoringPreflight(sample)).toThrow();
  expect(() =>
    monitoringPreflight({ ...fixture(), start: "2026-02-30" }),
  ).toThrow();
  expect(() =>
    monitoringPreflight({ ...fixture(), claimRightsReference: " " }),
  ).toThrow();
});
