import { ConvexError } from "convex/values";

import { CATALOGUE, type Family } from "./catalogue";
import {
  SPECIALIST_REFERENCE_DEFINITIONS,
  specialistReference,
} from "./specialistReferences";

/**
 * Reference labels from the founder's PET example, not approved process recipes.
 * Keep this separate from CATALOGUE, which still contains prototype rate data.
 */
export const PET_REFERENCE_SOURCE =
  "docs/product/platform-refinement-interview.md: 4 October 2026 PET circular-plastics example; 6 October 2026 teammate PET workbook review (workbook_unverified)";
export const PET_REFERENCE_VERSION = "PET-reference-2026-10-27-v1";
export const MAX_FOUNDATION_DEFINITIONS = 100;

interface ReferenceDefinition {
  materialCode: string;
  name: string;
  family: Family;
  stage: "scrap" | "recycled";
  processingState: string;
  grade: string;
  version: string;
  specification: string;
  sourceReference: string;
}

const UNREVIEWED_SPECIFICATION =
  "Draft reference only. Composition, quality thresholds, test methods and receiver acceptance require review. Record measured integer grams and separate outputs and loss. This definition grants no hazard classification, handling permission, food-contact approval or environmental claim.";

function definition(
  materialCode: string,
  name: string,
  stage: "scrap" | "recycled",
  processingState: string,
  detail: string,
  family: Family = "plastic",
): ReferenceDefinition {
  return {
    materialCode,
    name,
    family,
    stage,
    processingState,
    grade: "Unspecified; draft reference",
    version: PET_REFERENCE_VERSION,
    specification: `${detail} ${UNREVIEWED_SPECIFICATION}`,
    sourceReference: PET_REFERENCE_SOURCE,
  };
}

export const PET_REFERENCE_DEFINITIONS: readonly ReferenceDefinition[] = [
  definition(
    "PLASTIC-PET",
    "PET bottles",
    "scrap",
    "Mixed bottle intake",
    "Record actual PET bottle intake. Do not assume cap, ring or label composition.",
  ),
  definition(
    "PLASTIC-PET-SORTED",
    "Sorted PET bottles",
    "scrap",
    "Sorted bottles",
    "Record sorting evidence and separate non-PET fractions before baling.",
  ),
  definition(
    "PLASTIC-PET-BALE",
    "PET bottle bales",
    "scrap",
    "Baled bottles",
    "Record the source sorted lots and measured bale mass. Bale quality gates remain unverified.",
  ),
  definition(
    "PLASTIC-PET-DEBALED",
    "Debaled PET bottles",
    "scrap",
    "Post-debale bottles",
    "Retain bale lineage and record removed contaminants as separate measured fractions.",
  ),
  definition(
    "PLASTIC-PET-RAW-FLAKE",
    "Raw PET flakes",
    "scrap",
    "Ground, unwashed flakes",
    "Record grinding outputs. This state does not claim washing or accepted recycled quality.",
  ),
  definition(
    "RECYCLED-PET-FLAKE",
    "Recycled PET flakes",
    "recycled",
    "Flakes; wash process unspecified",
    "Existing broad flake code. Do not infer cold wash, hot wash or a quality grade from this name.",
  ),
  definition(
    "RECYCLED-PET-COLD-FLAKE",
    "Cold-washed PET flakes",
    "recycled",
    "Cold-washed flakes",
    "Record actual cold-wash process and inspection evidence. No temperature or purity limit is prescribed.",
  ),
  definition(
    "RECYCLED-PET-HOT-FLAKE",
    "Hot-washed PET flakes",
    "recycled",
    "Hot-washed flakes",
    "Record actual hot-wash process and inspection evidence. No temperature or purity limit is prescribed.",
  ),
  definition(
    "RECYCLED-PET-PELLET",
    "Recycled PET pellets",
    "recycled",
    "Pelletised PET",
    "Record accepted flake inputs and measured pellet outputs with batch lineage.",
  ),
  definition(
    "RECYCLED-PET-FIBRE",
    "Recycled PET staple fibre",
    "recycled",
    "Polyester staple fibre (PSF)",
    "Record actual PET feedstock, fibre output and separate process fractions. Recycled content needs evidence.",
  ),
  definition(
    "RECYCLED-PET-YARN",
    "Recycled PET yarn",
    "recycled",
    "Spun yarn",
    "Record fibre inputs and any blends separately. This name does not certify recycled content.",
  ),
  definition(
    "RECYCLED-PET-FABRIC",
    "Recycled PET fabric",
    "recycled",
    "Fabric",
    "Record yarn inputs, blends and measured fabric outputs with lineage.",
  ),
  definition(
    "RECYCLED-PET-GARMENT",
    "Recycled PET garments",
    "recycled",
    "Garments",
    "Record fabric inputs, garment outputs and separate cutting residuals. No certificate is implied.",
  ),
  definition(
    "PLASTIC-PP-CAP",
    "Separated PP caps and rings",
    "scrap",
    "Separated caps and rings; PP declared",
    "Verify actual composition. Cap and neck-ring identity alone does not prove PP content.",
  ),
  definition(
    "PLASTIC-HDPE-CAP",
    "Separated HDPE caps and rings",
    "scrap",
    "Separated caps and rings; HDPE declared",
    "Verify actual composition. Cap and neck-ring identity alone does not prove HDPE content.",
  ),
  definition(
    "PLASTIC-PP-FLOAT",
    "PP float fraction",
    "scrap",
    "Separated float fraction; PP declared",
    "Record separation and composition evidence. Floating alone does not prove polymer identity.",
  ),
  definition(
    "PLASTIC-HDPE-FLOAT",
    "HDPE float fraction",
    "scrap",
    "Separated float fraction; HDPE declared",
    "Record separation and composition evidence. Floating alone does not prove polymer identity.",
  ),
  definition(
    "RECYCLED-PP-GROUND",
    "Ground recycled PP",
    "recycled",
    "Ground PP",
    "Record accepted PP fraction inputs and measured ground output. No granulation is inferred.",
  ),
  definition(
    "RECYCLED-HDPE-GROUND",
    "Ground recycled HDPE",
    "recycled",
    "Ground HDPE",
    "Record accepted HDPE fraction inputs and measured ground output. Keep distinct from HDPE granules.",
  ),
  definition(
    "PLASTIC-PET-LABEL",
    "Separated PET-chain labels",
    "scrap",
    "Separated labels; composition unknown",
    "PET-chain identifies origin only. Labels may contain different materials; verify composition and destination.",
    "other",
  ),
  definition(
    "OTHER-PET-RESIDUAL",
    "PET-chain residuals",
    "scrap",
    "Separated residuals; classification unknown",
    "Record measured rejects and contamination separately. Require destination and recovery or disposal evidence; do not assume saleability or non-hazardous status.",
    "other",
  ),
];

export const FOUNDATION_REFERENCE_DEFINITIONS = [
  ...PET_REFERENCE_DEFINITIONS,
  ...SPECIALIST_REFERENCE_DEFINITIONS,
];

interface FoundationMaterial {
  code: string;
  family: Family;
  stage: "scrap" | "recycled";
  names: Record<string, string>;
  active: boolean;
  specialistReference?: NonNullable<ReturnType<typeof specialistReference>>;
}

/** Bound and validate the fixed reference list before starting any writes. */
export function foundationMaterials(): FoundationMaterial[] {
  const materials: FoundationMaterial[] = CATALOGUE.map(
    ({ code, family, stage, names }) => ({
      code,
      family,
      stage,
      names: { ...names },
      active: specialistReference(code) === undefined,
      ...(specialistReference(code) && {
        specialistReference: specialistReference(code),
      }),
    }),
  );
  const codes = new Set(materials.map(({ code }) => code));
  const versions = new Set<string>();
  for (const definition of FOUNDATION_REFERENCE_DEFINITIONS) {
    const key = `${definition.materialCode}:${definition.version}`;
    if (versions.has(key)) throw new ConvexError("REFERENCE_SEED_COLLISION");
    versions.add(key);
    if (codes.has(definition.materialCode)) continue;
    materials.push({
      code: definition.materialCode,
      family: definition.family,
      stage: definition.stage,
      names: { en: definition.name },
      active: false,
      ...(specialistReference(definition.materialCode) && {
        specialistReference: specialistReference(definition.materialCode),
      }),
    });
    codes.add(definition.materialCode);
  }
  if (
    materials.length > MAX_FOUNDATION_DEFINITIONS ||
    FOUNDATION_REFERENCE_DEFINITIONS.length > MAX_FOUNDATION_DEFINITIONS ||
    codes.size !== materials.length
  )
    throw new ConvexError("INVALID_REFERENCE_SEED");
  return materials;
}
