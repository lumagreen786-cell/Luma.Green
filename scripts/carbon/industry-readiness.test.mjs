// @vitest-environment node
import { expect, test } from "vitest";

import { screenIndustryReadiness } from "./industry-readiness.mjs";

test.each([
  ["non_pet_plastics", "polymer_and_output_grade"],
  ["container_glass", "container_glass_and_cullet_grade"],
  ["metals", "aluminium_or_steel_grade_and_recovery"],
  ["e_waste", "custody_and_recovery"],
  ["compressed_biogas", "methane_leakage"],
  ["industrial_efficiency", "before_and_after_energy"],
])(
  "screens %s for its own evidence without confirming eligibility",
  (program, specificEvidence) => {
    const initial = screenIndustryReadiness(program, {});
    expect(initial.missing).toContain(specificEvidence);
    expect(initial.status).toBe("missing_evidence");

    const references = Object.fromEntries(
      initial.missing.map((kind) => [kind, "fixture-reference"]),
    );
    expect(screenIndustryReadiness(program, references)).toMatchObject({
      status: "ready_for_internal_review",
      evidenceStatus: "reported_unverified",
      missing: [],
    });
  },
);

test("rejects unsupported programs and evidence for a different activity", () => {
  expect(() => screenIndustryReadiness("toString", {})).toThrow(
    "Unknown program",
  );
  expect(() =>
    screenIndustryReadiness("metals", { methane_leakage: "x" }),
  ).toThrow("Invalid evidence");
  expect(() =>
    screenIndustryReadiness("metals", { claim_rights_and_overlap: " " }),
  ).toThrow("Invalid evidence");
});
