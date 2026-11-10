export const carbonFrameworkIds = [
  "verra",
  "gold_standard",
  "car",
  "puro",
  "acr",
  "ccts",
  "ghg_protocol",
] as const;

export type CarbonFrameworkId = (typeof carbonFrameworkIds)[number];

export const carbonGateIds = [
  "method_and_version",
  "site_and_operator",
  "baseline_and_additionality",
  "claim_rights_and_overlap",
  "monitoring_and_calculation",
  "validation",
  "registration",
  "verification",
  "issuance",
  "transfer_and_settlement",
  "retirement",
  "municipal_waste_origin",
  "collection_scope",
  "material_and_mass_balance",
  "process_energy",
  "buyer_end_use",
  "virgin_material_displacement",
  "indian_entity_and_authorized_venue",
  "safeguards_and_consultation",
  "jurisdiction",
  "durable_removal_and_storage",
  "inventory_boundary_and_scopes",
  "scenario_and_capacity",
  "dry_mass_and_pet_grade",
  "recovered_metal_and_grade",
  "equipment_categories_and_custody",
  "residue_destination",
  "feedstock_and_prior_treatment",
  "gas_metering_and_methane_leakage",
  "digestate_and_offtake",
  "equipment_and_commissioning",
  "meter_calibration",
  "comparable_output_and_feedstock",
] as const;

export type CarbonGateId = (typeof carbonGateIds)[number];

export const carbonGateStates = ["supported", "contradicted"] as const;

interface Framework {
  name: string;
  kind: "crediting" | "accounting";
  petFit:
    | "candidate"
    | "unconfirmed"
    | "no_listed_method"
    | "out_of_scope"
    | "accounting_only";
  source: string;
  lifecycleSource: string;
  gates: readonly CarbonGateId[];
}

const projectDesign = [
  "method_and_version",
  "site_and_operator",
  "baseline_and_additionality",
  "claim_rights_and_overlap",
] as const;

const creditLifecycle = [
  "validation",
  "registration",
  "monitoring_and_calculation",
  "verification",
  "issuance",
  "transfer_and_settlement",
  "retirement",
] as const;

const registerAfterVerification = [
  "validation",
  "monitoring_and_calculation",
  "verification",
  "registration",
  "issuance",
  "transfer_and_settlement",
  "retirement",
] as const;

export const carbonFrameworks: Record<CarbonFrameworkId, Framework> = {
  verra: {
    name: "Verra VCS",
    kind: "crediting",
    petFit: "candidate",
    source:
      "https://verra.org/methodologies/vmr0007-revision-to-ams-iii-aj-recovery-and-recycling-of-materials-from-solid-wastes-v1-0/",
    lifecycleSource:
      "https://verra.org/programs/verified-carbon-standard/develop-a-vcs-project/",
    gates: [
      ...projectDesign,
      "safeguards_and_consultation",
      ...creditLifecycle,
    ],
  },
  gold_standard: {
    name: "Gold Standard",
    kind: "crediting",
    petFit: "unconfirmed",
    source: "https://globalgoals.goldstandard.org/documents/methodology/",
    lifecycleSource:
      "https://www.goldstandard.org/publications/certification-process-stepbystep",
    gates: [
      ...projectDesign,
      "safeguards_and_consultation",
      ...creditLifecycle,
    ],
  },
  car: {
    name: "Climate Action Reserve (CAR)",
    kind: "crediting",
    petFit: "no_listed_method",
    source: "https://climateactionreserve.org/how/protocols2/",
    lifecycleSource:
      "https://climateactionreserve.org/how/voluntary-offset-program/register/",
    gates: [...projectDesign, "jurisdiction", ...registerAfterVerification],
  },
  puro: {
    name: "Puro.earth",
    kind: "crediting",
    petFit: "out_of_scope",
    source: "https://puro.earth/cdr-infrastructure/methodologies/",
    lifecycleSource:
      "https://puro.earth/cdr-infrastructure/carbon-credit-certification/",
    gates: [
      ...projectDesign,
      "durable_removal_and_storage",
      "validation",
      "monitoring_and_calculation",
      "verification",
      "issuance",
      "transfer_and_settlement",
      "retirement",
    ],
  },
  acr: {
    name: "ACR",
    kind: "crediting",
    petFit: "no_listed_method",
    source: "https://acrcarbon.org/methodologies/approved-methodologies/",
    lifecycleSource:
      "https://acrcarbon.org/resources/infographic-life-cycle-of-acr-carbon-credits/",
    gates: [
      ...projectDesign,
      "safeguards_and_consultation",
      ...registerAfterVerification,
    ],
  },
  ccts: {
    name: "India CCTS",
    kind: "crediting",
    petFit: "no_listed_method",
    source: "https://beeindia.gov.in/view_content.php?lang=1&lid=571",
    lifecycleSource:
      "https://beeindia.gov.in/sites/default/files/Detailed%20Procedure%20for%20Offset%20Mechanism_CCTS.pdf",
    gates: [
      ...projectDesign,
      "indian_entity_and_authorized_venue",
      "safeguards_and_consultation",
      ...creditLifecycle,
    ],
  },
  ghg_protocol: {
    name: "GHG Protocol",
    kind: "accounting",
    petFit: "accounting_only",
    source: "https://ghgprotocol.org/standards",
    lifecycleSource: "https://ghgprotocol.org/project-protocol",
    gates: [
      "method_and_version",
      "site_and_operator",
      "inventory_boundary_and_scopes",
      "monitoring_and_calculation",
    ],
  },
};

export const carbonIndustryIds = [
  "pet_plastics",
  "metals_recycling",
  "e_waste_recovery",
  "compressed_biogas",
  "industrial_manufacturing",
] as const;

export type CarbonIndustryId = (typeof carbonIndustryIds)[number];

interface Industry {
  method: "verra_vmr0007" | "verra_vmr0008" | "bee_wa03_003" | "bee_in02_001";
  framework: CarbonFrameworkId;
  source: string;
  gates: readonly CarbonGateId[];
}

const municipalRecycling = [
  "municipal_waste_origin",
  "collection_scope",
  "material_and_mass_balance",
  "process_energy",
  "buyer_end_use",
  "virgin_material_displacement",
  "scenario_and_capacity",
] as const;

export const carbonIndustries: Record<CarbonIndustryId, Industry> = {
  pet_plastics: {
    method: "verra_vmr0007",
    framework: "verra",
    source: carbonFrameworks.verra.source,
    gates: [...municipalRecycling, "dry_mass_and_pet_grade"],
  },
  metals_recycling: {
    method: "verra_vmr0007",
    framework: "verra",
    source: carbonFrameworks.verra.source,
    gates: [...municipalRecycling, "recovered_metal_and_grade"],
  },
  e_waste_recovery: {
    method: "verra_vmr0008",
    framework: "verra",
    source:
      "https://verra.org/methodologies/vmr0008-revision-to-ams-iii-ba-recovery-and-recycling-of-materials-from-e-waste-v1-0/",
    gates: [
      "equipment_categories_and_custody",
      "material_and_mass_balance",
      "process_energy",
      "residue_destination",
      "buyer_end_use",
      "virgin_material_displacement",
    ],
  },
  compressed_biogas: {
    method: "bee_wa03_003",
    framework: "ccts",
    source:
      "https://beeindia.gov.in/WriteReadData/RTF1984/RTF-PDF-56f665ac470e0ca1_1783087085.pdf",
    gates: [
      "feedstock_and_prior_treatment",
      "gas_metering_and_methane_leakage",
      "process_energy",
      "digestate_and_offtake",
    ],
  },
  industrial_manufacturing: {
    method: "bee_in02_001",
    framework: "ccts",
    source:
      "https://beeindia.gov.in/WriteReadData/RTF1984/RTF-PDF-ab06743897d11b58_1776061202.pdf",
    gates: [
      "equipment_and_commissioning",
      "meter_calibration",
      "process_energy",
      "comparable_output_and_feedstock",
    ],
  },
};

export function carbonGatesForProject(
  framework: CarbonFrameworkId,
  industry?: CarbonIndustryId,
): readonly CarbonGateId[] {
  const { gates } = carbonFrameworks[framework];
  const candidate = industry ? carbonIndustries[industry] : undefined;
  return candidate?.framework === framework
    ? [...gates, ...candidate.gates]
    : gates;
}
