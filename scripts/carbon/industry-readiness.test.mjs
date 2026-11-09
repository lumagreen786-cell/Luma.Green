// @vitest-environment node
import { expect, test } from "vitest";

import { screenIndustryReadiness } from "./industry-readiness.mjs";

test("screens a PET facility using the combined Verra method and keeps evidence unverified", () => {
  const references = {
    facility_permissions: "facility-permit",
    project_history: "project-start-and-history",
    baseline_and_additionality: "baseline-and-additionality-report",
    claim_rights_and_overlap: "claim-rights-agreement",
    monitoring_plan: "project-monitoring-plan",
    municipal_waste_origin: "municipal-origin-and-baseline-stream",
    mass_balance: "input-output-and-reject-ledger",
    process_energy: "metered-electricity-and-fuel",
    buyer_end_use: "identified-manufacturer-and-production-record",
    collection_scope_and_selective_exclusion: "collection-route-and-scope",
    dry_mass_and_pet_output_grade: "dry-weight-and-grade-tests",
    virgin_displacement: "comparable-virgin-product-and-displacement",
    scenario_and_capacity: "applicable-case-and-capacity-evidence",
  };

  expect(screenIndustryReadiness("pet", {})).toEqual({
    program: "pet",
    candidateMethod: "Verra VMR0007 + AMS-III.AJ.",
    methodId: "verra_vmr0007",
    status: "missing_evidence",
    evidenceStatus: "reported_unverified",
    missing: Object.keys(references),
  });

  const withoutCollectionScope = { ...references };
  delete withoutCollectionScope.collection_scope_and_selective_exclusion;
  expect(screenIndustryReadiness("pet", withoutCollectionScope)).toMatchObject({
    status: "missing_evidence",
    evidenceStatus: "reported_unverified",
    missing: ["collection_scope_and_selective_exclusion"],
  });

  expect(screenIndustryReadiness("pet", references)).toMatchObject({
    status: "ready_for_internal_review",
    evidenceStatus: "reported_unverified",
    missing: [],
  });
});

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
