import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";

import { buildFilingEvidenceManifest } from "./evidence-manifest.mjs";
import { screenIndustryReadiness } from "./industry-readiness.mjs";

const workspaceIndustries = {
  pet: "pet_plastics",
  non_pet_plastics: null,
  container_glass: null,
  metals: "metals_recycling",
  e_waste: "e_waste_recovery",
  compressed_biogas: "compressed_biogas",
  industrial_efficiency: "industrial_manufacturing",
};

/** Assemble a local preparation pack. The additional references need their own review. */
export function buildFilingPack(directory, source) {
  const readiness = screenIndustryReadiness(
    source.program,
    source.evidenceReferences,
  );
  const { manifest, workspaceIndustryStatus } = buildFilingEvidenceManifest(
    directory,
    source.files,
    readiness.methodId,
    workspaceIndustries[readiness.program],
  );

  return {
    schemaVersion: 1,
    purpose: "internal_filing_preparation",
    status:
      readiness.status === "missing_evidence"
        ? "missing_evidence"
        : "requires_filing_review",
    readiness,
    workspaceIndustryStatus,
    reviewedWorkspaceEvidence: manifest,
    evidenceReferences: source.evidenceReferences,
  };
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  try {
    const [directory, indexPath] = process.argv.slice(2);
    if (!directory || !indexPath || process.argv.length !== 4) {
      throw new Error("Expected a private directory and an index file.");
    }
    const source = JSON.parse(await readFile(indexPath, "utf8"));
    const pack = buildFilingPack(directory, source);
    process.stdout.write(JSON.stringify(pack, null, 2) + "\n");
    if (pack.status === "missing_evidence") process.exitCode = 1;
  } catch {
    process.stderr.write("Could not prepare the private filing pack.\n");
    process.exitCode = 2;
  }
}
