// @vitest-environment node
import { readFileSync } from "node:fs";
import path from "node:path";

import { expect, it } from "vitest";

import coverage from "../docs/product/foundation-seed-coverage.json";
import { LOCAL_ACCEPTANCE_PERSONAS } from "./lib/localAcceptance";
import { PET_REFERENCE_DEFINITIONS } from "./lib/referenceDefinitions";

function readProjectFile(relative: string) {
  expect(path.isAbsolute(relative)).toBe(false);
  expect(relative.split("/")).not.toContain("..");
  return readFileSync(path.join(process.cwd(), relative), "utf8");
}

it("accounts for every source audit group with an existing local suite or an explicit scope or external gate", () => {
  const source = readProjectFile(coverage.sourceAudit);
  const ids = [...source.matchAll(/^\| (R\d{3})\b/gm)].map((match) => match[1]);
  expect(ids).toHaveLength(84);
  expect(coverage.capabilities.map(({ id }) => id)).toEqual(ids);
  expect(new Set(coverage.capabilities.map(({ id }) => id)).size).toBe(84);
  for (const entry of coverage.capabilities) {
    expect(entry.sourceLocator).not.toBe("");
    expect(entry.acceptanceLimit).not.toBe("");
    if (entry.disposition === "local_suite_linked")
      expect(entry.testSuites.length).toBeGreaterThan(0);
    else
      expect([
        "not_applicable_to_first_version",
        "provider_or_external_evidence_block",
        "device_or_operational_evidence_block",
      ]).toContain(entry.disposition);
    for (const suite of entry.testSuites) {
      expect(suite).toMatch(/\.test\.tsx?$/);
      expect(readProjectFile(suite)).toMatch(/\b(?:it|test)(?:\.\w+)?\s*\(/);
    }
  }
});

it("keeps all participant and PET-state fixtures linked to their actual acceptance tests", () => {
  expect(coverage.participants.map(({ key }) => key)).toEqual(
    LOCAL_ACCEPTANCE_PERSONAS.map(({ key }) => key),
  );
  expect(
    coverage.materialStates.map(({ materialCode }) => materialCode),
  ).toEqual(PET_REFERENCE_DEFINITIONS.map(({ materialCode }) => materialCode));
  for (const entry of [
    ...coverage.linkedScenarios,
    ...coverage.participants,
    ...coverage.materialStates,
  ]) {
    expect(readProjectFile(entry.testSuite)).toContain(entry.testTitle);
  }
  expect(
    coverage.productionReferenceInitialization.syntheticFixtureWrites,
  ).toBe(false);
  expect(coverage.productionReferenceInitialization.rateOrFactorWrites).toBe(
    false,
  );
  expect(coverage.productionReferenceInitialization.newPetMaterialsActive).toBe(
    false,
  );
  expect(coverage.offlineFixtureBoundary.providerResults).toContain(
    "fetch throws",
  );
});
