import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";

const commonEvidence = [
  "facility_permissions",
  "project_history",
  "baseline_and_additionality",
  "claim_rights_and_overlap",
  "monitoring_plan",
];

const recyclingMethod = "Verra VMR0007 + AMS-III.AJ.";
const recyclingEvidence = [
  "municipal_waste_origin",
  "mass_balance",
  "process_energy",
  "buyer_end_use",
];

const programs = {
  non_pet_plastics: {
    method: recyclingMethod,
    methodId: "verra_vmr0007",
    evidence: [...recyclingEvidence, "polymer_and_output_grade"],
  },
  container_glass: {
    method: recyclingMethod,
    methodId: "verra_vmr0007",
    evidence: [...recyclingEvidence, "container_glass_and_cullet_grade"],
  },
  metals: {
    method: recyclingMethod,
    methodId: "verra_vmr0007",
    evidence: [...recyclingEvidence, "aluminium_or_steel_grade_and_recovery"],
  },
  e_waste: {
    method: "Verra VMR0008 + AMS-III.BA.",
    methodId: "verra_vmr0008",
    evidence: [
      "equipment_categories",
      "custody_and_recovery",
      "process_energy",
      "residue_destination",
      "buyer_end_use",
    ],
  },
  compressed_biogas: {
    method: "BEE BM WA03.003",
    methodId: "bee_wa03_003",
    evidence: [
      "weighed_feedstock_by_type",
      "prior_waste_treatment",
      "gas_flow_and_methane",
      "methane_leakage",
      "process_energy",
      "digestate_and_offtake",
    ],
  },
  industrial_efficiency: {
    method: "BEE BM IN02.001",
    methodId: "bee_in02_001",
    evidence: [
      "equipment_and_commissioning",
      "meter_calibration",
      "before_and_after_energy",
      "comparable_output_and_feedstock",
    ],
  },
};

export function screenIndustryReadiness(program, evidenceReferences) {
  if (!Object.hasOwn(programs, program)) throw new Error("Unknown program.");
  if (
    !evidenceReferences ||
    Object.getPrototypeOf(evidenceReferences) !== Object.prototype
  ) {
    throw new Error("Expected an object of evidence references.");
  }

  const { method, methodId, evidence } = programs[program];
  const required = [...commonEvidence, ...evidence];
  for (const [kind, reference] of Object.entries(evidenceReferences)) {
    if (
      typeof reference !== "string" ||
      reference.length > 160 ||
      reference.trim().length === 0 ||
      !required.includes(kind)
    ) {
      throw new Error("Invalid evidence reference.");
    }
  }
  const missing = required.filter(
    (kind) => !Object.hasOwn(evidenceReferences, kind),
  );
  return {
    program,
    candidateMethod: method,
    methodId,
    status:
      missing.length > 0 ? "missing_evidence" : "ready_for_internal_review",
    evidenceStatus: "reported_unverified",
    missing,
  };
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  try {
    if (process.argv.length !== 3) throw new Error("Expected one intake file.");
    const { program, evidenceReferences } = JSON.parse(
      await readFile(process.argv[2], "utf8"),
    );
    const result = screenIndustryReadiness(program, evidenceReferences);
    process.stdout.write(JSON.stringify(result) + "\n");
    if (result.status === "missing_evidence") process.exitCode = 1;
  } catch {
    process.stderr.write(
      "Could not read or validate the industry evidence references.\n",
    );
    process.exitCode = 2;
  }
}
