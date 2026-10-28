import type { Family } from "./catalogue";

export const SPECIALIST_REFERENCE_SOURCE =
  "docs/product/platform-refinement-interview.md: stakeholder workbook review, D28 / R050 adopted specialist reference labels (workbook_unverified)";
export const SPECIALIST_REFERENCE_VERSION =
  "specialist-reference-2026-10-28-v1";

export const SPECIALIST_CATEGORIES = [
  "textile",
  "electronics",
  "battery",
  "tyre",
  "used_cooking_oil",
  "used_lubricating_oil",
  "industrial_residue",
  "end_of_life_vehicle",
] as const;
type Category = (typeof SPECIALIST_CATEGORIES)[number];
interface SpecialistLabel {
  code: string;
  name: string;
  category: Category;
  family: Family;
}

export const SPECIALIST_LABELS: readonly SpecialistLabel[] = [
  {
    code: "OTHER-CLOTHES",
    name: "Textiles and used clothing",
    category: "textile",
    family: "other",
  },
  {
    code: "EWASTE-SMALL",
    name: "Small electronic equipment",
    category: "electronics",
    family: "ewaste",
  },
  {
    code: "EWASTE-PHONE",
    name: "Discarded phones",
    category: "electronics",
    family: "ewaste",
  },
  {
    code: "EWASTE-CABLE",
    name: "Discarded electronic cables",
    category: "electronics",
    family: "ewaste",
  },
  {
    code: "EWASTE-BATTERY",
    name: "Legacy combined e-waste / battery reference; identity unresolved",
    category: "battery",
    family: "ewaste",
  },
  {
    code: "BATTERY-UNSPECIFIED",
    name: "Discarded batteries; chemistry unspecified",
    category: "battery",
    family: "ewaste",
  },
  { code: "TYRE-USED", name: "Used tyres", category: "tyre", family: "other" },
  {
    code: "UCO-USED",
    name: "Used cooking oil",
    category: "used_cooking_oil",
    family: "other",
  },
  {
    code: "LUBRICATING-OIL-USED",
    name: "Used lubricating oil",
    category: "used_lubricating_oil",
    family: "other",
  },
  {
    code: "INDUSTRIAL-RESIDUE-UNCLASSIFIED",
    name: "Industrial residues; classification unverified",
    category: "industrial_residue",
    family: "other",
  },
  {
    code: "ELV-UNASSESSED",
    name: "End-of-life vehicles; assessment unavailable",
    category: "end_of_life_vehicle",
    family: "other",
  },
];

export function specialistReference(code: string) {
  const label = SPECIALIST_LABELS.find((entry) => entry.code === code);
  return label
    ? {
        category: label.category,
        routeStatus: "unavailable" as const,
        classificationStatus: "unverified" as const,
        sourceReference: SPECIALIST_REFERENCE_SOURCE,
      }
    : undefined;
}

/** These references have no route owner, regardless of a mutable activity flag. */
export function isSpecialistMaterial(material: {
  code: string;
  family: Family;
  specialistReference?: unknown;
}) {
  return (
    material.family === "ewaste" ||
    material.specialistReference !== undefined ||
    SPECIALIST_LABELS.some(({ code }) => code === material.code)
  );
}

export const SPECIALIST_REFERENCE_DEFINITIONS = SPECIALIST_LABELS.map(
  (label) => ({
    materialCode: label.code,
    name: label.name,
    family: label.family,
    stage: "scrap" as const,
    processingState:
      "Unassessed specialist intake reference; route unavailable",
    grade: "Unspecified; draft reference",
    version: SPECIALIST_REFERENCE_VERSION,
    specification:
      "Draft reference only. Composition, quality thresholds, test methods and hazard classification are unverified. This definition grants no hazard classification, handling permission, permit or treatment proof. Specialist collection, trade, stock intake and treatment routes are unavailable until a verified route owner exists. Legacy combined battery references do not identify chemistry or authorize classification.",
    sourceReference: SPECIALIST_REFERENCE_SOURCE,
  }),
);
