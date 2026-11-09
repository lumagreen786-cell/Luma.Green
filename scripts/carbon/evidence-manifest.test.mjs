// @vitest-environment node
import { mkdtempSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterEach, beforeEach, expect, test } from "vitest";

import {
  buildEvidenceManifest,
  verifyEvidenceManifest,
} from "./evidence-manifest.mjs";

const source = {
  snapshot: "review.json",
  baseline: "private-baseline.txt",
  monitoring: "private-monitoring.txt",
  claim_rights: "private-claim-rights.txt",
  verification_report: "private-verification.txt",
};
const snapshot = {
  schemaVersion: 1,
  purpose: "internal_carbon_review",
  evidenceStatus: "reported_unverified",
  projectId: "fixture-project",
  revision: 12,
  references: [
    { kind: "baseline", reference: "fixture-baseline" },
    { kind: "monitoring", reference: "fixture-monitoring" },
    { kind: "claim_rights", reference: "fixture-rights" },
    { kind: "verification_report", reference: "fixture-report" },
  ],
};
const fixture = { directory: "" };

beforeEach(() => {
  fixture.directory = mkdtempSync(path.join(tmpdir(), "luma-evidence-"));
  for (const [kind, file] of Object.entries(source)) {
    writeFileSync(
      path.join(fixture.directory, file),
      kind === "snapshot" ? JSON.stringify(snapshot) : `Synthetic ${kind}`,
    );
  }
});

afterEach(() => {
  rmSync(fixture.directory, { recursive: true, force: true });
});

test("produces a reproducible manifest without paths or document contents", () => {
  const manifest = buildEvidenceManifest(fixture.directory, source);
  expect(manifest).toMatchObject({
    evidenceStatus: "reported_unverified",
    revision: 12,
    documents: [
      { kind: "baseline" },
      { kind: "monitoring" },
      { kind: "claim_rights" },
      { kind: "verification_report" },
    ],
  });
  expect(JSON.stringify(manifest)).not.toMatch(
    /private-|Synthetic|fixture-rights/u,
  );
  expect(verifyEvidenceManifest(fixture.directory, source, manifest)).toBe(
    true,
  );
});

test("detects a changed file even when its size is unchanged", () => {
  const manifest = buildEvidenceManifest(fixture.directory, source);
  writeFileSync(
    path.join(fixture.directory, source.baseline),
    "Synthetic Baseline",
  );
  expect(verifyEvidenceManifest(fixture.directory, source, manifest)).toBe(
    false,
  );
});

test("rejects references missing from the review and files outside the package", () => {
  symlinkSync(
    path.join(fixture.directory, ".."),
    path.join(fixture.directory, "outside"),
  );
  expect(() =>
    buildEvidenceManifest(fixture.directory, {
      ...source,
      baseline: "outside",
    }),
  ).toThrow(/outside/u);
  expect(() =>
    buildEvidenceManifest(fixture.directory, {
      ...source,
      baseline: "../outside",
    }),
  ).toThrow();
  writeFileSync(
    path.join(fixture.directory, source.snapshot),
    JSON.stringify({ ...snapshot, references: snapshot.references.slice(1) }),
  );
  expect(() => buildEvidenceManifest(fixture.directory, source)).toThrow(
    /reference/u,
  );
});

test("rejects an empty file or a directory in place of a document", () => {
  writeFileSync(path.join(fixture.directory, source.baseline), "");
  expect(() => buildEvidenceManifest(fixture.directory, source)).toThrow(
    /nonempty/u,
  );
  expect(() =>
    buildEvidenceManifest(fixture.directory, { ...source, baseline: "." }),
  ).toThrow(/nonempty/u);
});

test("checks a filing pack against the method in the reviewed snapshot", async () => {
  const { buildFilingPack } = await import("./filing-pack.mjs");
  const { screenIndustryReadiness } = await import("./industry-readiness.mjs");
  writeFileSync(
    path.join(fixture.directory, source.snapshot),
    JSON.stringify({
      ...snapshot,
      method: "verra_vmr0007",
    }),
  );
  const references = Object.fromEntries(
    screenIndustryReadiness("metals", {}).missing.map((kind) => [
      kind,
      "internal-id",
    ]),
  );
  expect(
    buildFilingPack(fixture.directory, {
      program: "metals",
      evidenceReferences: references,
      files: source,
    }),
  ).toMatchObject({
    status: "requires_filing_review",
    workspaceIndustryStatus: "unassigned",
    reviewedWorkspaceEvidence: { revision: 12 },
  });
  expect(() =>
    buildFilingPack(fixture.directory, {
      program: "e_waste",
      evidenceReferences: {},
      files: source,
    }),
  ).toThrow("method does not match");
});

test.each([
  ["pet", "pet_plastics", "metals_recycling"],
  ["metals", "metals_recycling", "pet_plastics"],
])(
  "checks the frozen workspace industry for %s even when the method matches",
  async (program, matchingIndustry, otherIndustry) => {
    const { buildFilingPack } = await import("./filing-pack.mjs");
    const { screenIndustryReadiness } =
      await import("./industry-readiness.mjs");
    const evidenceReferences = Object.fromEntries(
      screenIndustryReadiness(program, {}).missing.map((kind) => [
        kind,
        "internal-id",
      ]),
    );
    const packSource = { program, evidenceReferences, files: source };
    const snapshotPath = path.join(fixture.directory, source.snapshot);
    const reviewed = { ...snapshot, method: "verra_vmr0007" };

    writeFileSync(
      snapshotPath,
      JSON.stringify({ ...reviewed, industry: otherIndustry }),
    );
    expect(() => buildFilingPack(fixture.directory, packSource)).toThrow(
      "industry does not match",
    );

    writeFileSync(
      snapshotPath,
      JSON.stringify({ ...reviewed, industry: matchingIndustry }),
    );
    const pack = buildFilingPack(fixture.directory, packSource);
    expect(pack).toMatchObject({
      status: "requires_filing_review",
      workspaceIndustryStatus: "matched",
    });
    expect(
      verifyEvidenceManifest(
        fixture.directory,
        source,
        pack.reviewedWorkspaceEvidence,
      ),
    ).toBe(true);
  },
);
