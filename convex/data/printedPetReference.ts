/**
 * Reference examples transcribed from the six printed PET pages shared on
 * 9 November 2026. The notes and tags describe the source, not a finding
 * about any actual lot, site, treatment process, or legal requirement.
 */

type Stream = readonly [name: string, use: string, treatment: string];
interface Stage {
  page: number;
  stage: string;
  streams: readonly Stream[];
}

export const printedPetSource = "Printed PET process notes · Page";

export const printedPetTags = [
  [
    "H",
    "Hazardous waste",
    "The notes specify an authorised treatment, storage and disposal facility or recycler.",
  ],
  [
    "E",
    "Extended producer responsibility stream",
    "Examples include used oil, electronics, batteries, tyres and plastics.",
  ],
  [
    "V",
    "Valuable by-product",
    "Examples include metals, glass cullet and flakes.",
  ],
  [
    "B",
    "Bulk, lower-value by-product",
    "Examples include ash, gypsum, bagasse, sand and aggregate.",
  ],
  [
    "O",
    "Organic stream",
    "Examples include compost, feed, digestate and rendering streams.",
  ],
  [
    "M",
    "Mixed stream",
    "The notes suggest separation at the source or receiving facility.",
  ],
  [
    "C",
    "Controlled, captive or excluded",
    "Examples include biomedical waste, explosives, radioactive waste and currency.",
  ],
  [
    "L",
    "Low or no hazard flagged",
    "This source tag leaves the actual material classification to review.",
  ],
] as const;

export const printedPetProcesses = [
  {
    page: 1,
    title: "Virgin PET feedstock from crude oil",
    inputs: "Crude oil and naphtha",
    route:
      "Distil crude oil, treat the naphtha and split it into streams for paraxylene production and ethylene production.",
  },
  {
    page: 2,
    title: "Virgin PET bottle manufacture",
    inputs: "Paraxylene and ethylene",
    route:
      "Make purified terephthalic acid (PTA) from paraxylene and monoethylene glycol (MEG) from ethylene. Combine PTA and MEG into virgin PET pellets, then injection-mould preforms and stretch-blow bottles.",
  },
  {
    page: 2,
    title: "Used PET bottles to garments",
    inputs: "Collected used PET bottles",
    route:
      "Sort and bale the bottles, then shred and wash them into flakes. Process flakes into recycled PET chips or melt, polyester staple fibre (PSF), yarn, fabric and garments.",
  },
  {
    page: 6,
    title: "End-of-life garment recovery",
    inputs: "Used garments and textile offcuts",
    route:
      "Reduce, reuse, repair, resell or donate, recycle, recover energy, then dispose. The available route depends on the composition and condition.",
  },
] as const;

export const printedPetStages: readonly Stage[] = [
  {
    page: 1,
    stage: "Virgin PET · Naphtha processing",
    streams: [
      [
        "Spent catalysts",
        "Catalysts may contain nickel, cobalt, molybdenum, platinum or alumina.",
        "Specialist metal recovery where suitable.",
      ],
      [
        "Sulfur compounds",
        "Hydrotreating can remove them for conversion into elemental sulfur.",
        "Potential feedstock for sulfuric acid, fertiliser or chemicals.",
      ],
      [
        "Oily sludge and tank-bottom sludge",
        "May contain oil, water, rust, sediment and heavy hydrocarbons.",
        "Recover oil where feasible and send the remaining hazardous residue for controlled treatment.",
      ],
    ],
  },
  {
    page: 1,
    stage: "Virgin PET · Ethylene, paraxylene, PTA and MEG",
    streams: [
      ["Hydrogen", "Hydrotreating or fuel.", "Recover for reuse."],
      [
        "Methane and fuel gas",
        "Process heaters and boilers.",
        "Energy recovery.",
      ],
      [
        "Propylene, butadiene, benzene, toluene and xylene streams",
        "Petrochemical feedstocks.",
        "Recover separately as useful products.",
      ],
    ],
  },
  {
    page: 2,
    stage: "Virgin PET · Ethylene, paraxylene, PTA and MEG",
    streams: [
      [
        "Heavy aromatic oils and pyrolysis fuel oil",
        "Fuel or further processing.",
        "Often recoverable.",
      ],
      [
        "Acetic acid from PTA production",
        "Process solvent.",
        "Recover and recirculate on site where possible.",
      ],
      [
        "Water and condensate",
        "Process or cooling water.",
        "Treat before reuse.",
      ],
      [
        "Ethylene glycol residues",
        "Potential process recovery.",
        "Recover or recycle where technically feasible.",
      ],
      [
        "Off-gases and volatile organic compounds (VOCs)",
        "Potential process fuel or recoverable compounds.",
        "Capture and recover where possible, or treat in a flare or thermal oxidiser.",
      ],
      [
        "Spent catalysts and filter media",
        "Potential specialist recovery.",
        "Refer for specialist recovery or hazardous-waste treatment.",
      ],
    ],
  },
  {
    page: 3,
    stage: "Recycled PET · Bottles to flakes",
    streams: [
      [
        "Clean PET flakes",
        "Feedstock for fibre, yarn, sheets, straps or bottles.",
        "Use directly where suitable or process into recycled PET chips.",
      ],
      [
        "PP and HDPE caps and rings",
        "Crates, bins, pipes, household goods and caps.",
        "Separate by density before recycling.",
      ],
      [
        "Plastic and paper labels",
        "Potential low-grade products or energy recovery.",
        "Recycle only clean, polymer-sorted material. PVC labels can contaminate the stream.",
      ],
      [
        "Metal pieces",
        "Steel or aluminium recycling.",
        "Separate with magnets and eddy-current equipment.",
      ],
      [
        "Paper, dirt, sand and food residue",
        "Limited material value.",
        "Remove as a solid residue for suitable energy recovery or controlled disposal.",
      ],
      [
        "PET wash water",
        "Potential reuse in washing.",
        "Screen, filter, separate oil and treat before reuse or discharge.",
      ],
      [
        "Adhesive and detergent residues",
        "Little direct use.",
        "Remove during wastewater treatment and manage the resulting sludge as an industrial stream.",
      ],
      [
        "Coloured PET flakes",
        "Dark fibre, straps, sheets and nonwovens.",
        "Recycle separately from clear bottle feedstock.",
      ],
    ],
  },
  {
    page: 3,
    stage: "Recycled PET · Flakes to chips or melt",
    streams: [
      [
        "Recycled PET (rPET) melt or chips",
        "Raw material for staple fibre and yarn.",
        "Feed into fibre spinning.",
      ],
      [
        "Melt-filter contaminants",
        "May contain mixed polymers, paper, aluminium and degraded PET.",
        "Consider energy recovery where suitable or use controlled disposal.",
      ],
      [
        "PET fines and dust",
        "Potential return to the process.",
        "Reuse clean fines when quality permits and collect the rest for treatment.",
      ],
      [
        "Moisture and drying exhaust",
        "Process emission.",
        "Condense or filter and treat the air before release.",
      ],
      [
        "Off-specification pellets",
        "Lower-grade fibre, straps, sheets and moulded articles.",
        "Reprocess where feasible.",
      ],
    ],
  },
  {
    page: 4,
    stage: "Recycled PET · Flakes to chips or melt",
    streams: [
      [
        "Degraded PET",
        "Potential downcycling or chemical recycling.",
        "Suitable chemical processes can return material to monomers or oligomers.",
      ],
    ],
  },
  {
    page: 4,
    stage: "Recycled PET · Staple fibre to yarn",
    streams: [
      [
        "Recycled PET spun yarn",
        "Woven or knitted fabric, thread and home textiles.",
        "Main product.",
      ],
      [
        "Carding waste and fly",
        "Nonwovens, felt, padding and insulation.",
        "Recycle when sufficiently clean.",
      ],
      [
        "Comber noil",
        "Lower-grade yarn, nonwovens and padding.",
        "Reuse or downcycle when the process includes combing.",
      ],
      [
        "Yarn waste and cone ends",
        "Respinnable material, recycled fibre and nonwovens.",
        "Mechanically recycle where suitable.",
      ],
      [
        "Dust and fibre lint",
        "Possible low-grade filling if clean.",
        "Capture with filtration.",
      ],
      [
        "Lubricant and machine oil waste",
        "No direct textile use.",
        "Collect and treat as an industrial oily waste stream.",
      ],
      [
        "Packaging cones and plastic wrap",
        "Potential reuse or recycling.",
        "Separate by material.",
      ],
    ],
  },
  {
    page: 4,
    stage: "Recycled PET · Yarn to fabric",
    streams: [
      [
        "Greige fabric",
        "Undyed or unfinished fabric.",
        "Send to finishing as an intermediate product.",
      ],
      [
        "Fabric edge trim and selvedge",
        "Nonwovens, wiping cloths and recycled fibre.",
        "Collect separately for recycling.",
      ],
    ],
  },
  {
    page: 5,
    stage: "Recycled PET · Yarn to fabric",
    streams: [
      [
        "Defective fabric",
        "Rework, seconds or recovered fibre.",
        "Reuse or downcycle.",
      ],
      [
        "Sizing chemicals",
        "Aid weaving.",
        "Recover where feasible or remove during wastewater treatment.",
      ],
      [
        "Dye-bath residue",
        "Potential dye-bath reuse.",
        "Treat wastewater after reuse is no longer feasible.",
      ],
      [
        "Dye, salt and surfactant wastewater",
        "Process water.",
        "Use suitable filtration, biological treatment, coagulation or advanced treatment.",
      ],
      [
        "Heat from dryers and stenters",
        "Process energy.",
        "Recover heat for incoming air or water.",
      ],
      [
        "Fabric dust and lint",
        "Low-value fibre residue.",
        "Capture and manage safely.",
      ],
    ],
  },
  {
    page: 5,
    stage: "Recycled PET · Fabric to garments",
    streams: [
      [
        "Finished garment",
        "Main product.",
        "Reuse, resell, repair, donate or recycle after use where suitable.",
      ],
      [
        "Cutting scraps",
        "Nonwovens, stuffing, insulation and recovered fibre.",
        "Separate by colour and fibre composition.",
      ],
      [
        "Sewing-thread waste",
        "Limited recycling value for mixed threads.",
        "Collect with textile waste for suitable downcycling.",
      ],
      [
        "Defective garments",
        "Repair, seconds, donation or fibre recovery.",
        "Prefer reuse and recycle material that cannot be used.",
      ],
      [
        "Paper patterns and cardboard",
        "Patterns and packaging.",
        "Reuse or recycle with paper.",
      ],
      [
        "Polybags and plastic packaging",
        "Packaging.",
        "Separate and recycle where collection is available.",
      ],
    ],
  },
  {
    page: 6,
    stage: "Recycled PET · Fabric to garments",
    streams: [
      [
        "Metal zippers, buttons and snaps",
        "Scrap metal recovery.",
        "Remove before textile recycling where feasible.",
      ],
      [
        "Mixed trims, prints, coatings and elastic",
        "Can make textile recycling harder.",
        "Consider removal, downcycling, energy recovery or specialist chemical recycling.",
      ],
    ],
  },
  {
    page: 6,
    stage: "Textile recovery · End-of-life garments",
    streams: [
      [
        "100% polyester garment",
        "Fibre, filling or PET feedstock.",
        "Consider mechanical or chemical recycling.",
      ],
      [
        "100% PET bottle-based polyester garment",
        "Potential remelt feedstock.",
        "Shred and remelt when clean and suitable.",
      ],
      [
        "Polyester and cotton blend",
        "Recovery depends on available technology.",
        "May need fibre separation or chemical recycling.",
      ],
      [
        "Polyester with elastane or spandex",
        "Elastane can contaminate polyester recovery.",
        "Review fibre composition and specialist acceptance.",
      ],
      [
        "Garments with zippers, buttons, coatings, prints or labels",
        "Textile recovery after suitable preparation.",
        "Remove trims before recycling where possible.",
      ],
      [
        "Clean reusable garment",
        "Repair, resale, donation or reuse.",
        "Prefer continued use where suitable.",
      ],
      [
        "Contaminated or non-recyclable textile",
        "Limited recovery.",
        "Consider available energy recovery or controlled disposal.",
      ],
    ],
  },
];
