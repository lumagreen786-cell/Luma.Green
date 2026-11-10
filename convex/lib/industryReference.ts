import { ConvexError } from "convex/values";

import workbook from "../data/industryWorkbook.json";
import {
  printedPetProcesses,
  printedPetSource,
  printedPetStages,
  printedPetTags,
} from "../data/printedPetReference";
import systemDesign from "../data/systemDesignReference.json";

const sectorMappings: ReadonlyMap<
  string,
  (typeof systemDesign.sectors)[keyof typeof systemDesign.sectors]
> = new Map(Object.entries(systemDesign.sectors));

export const REFERENCE_KINDS = [
  "sectors",
  "industries",
  "lifecycles",
  "byproducts",
] as const;
export type ReferenceKind = (typeof REFERENCE_KINDS)[number];

/** Row identity is intentional: even annexure + code is not unique in the source. */
export function getIndustrySector(id: string) {
  return workbook.sectors.find((sector) => sector.id === id) ?? null;
}

function referenceRows(kind: ReferenceKind) {
  switch (kind) {
    case "sectors": {
      return workbook.sectors.map((row) => {
        const mapping = sectorMappings.get(row.id);
        return {
          id: row.id,
          title: row.name,
          subtitle: `${row.code} · ${row.category}`,
          sheet: row.sheet,
          row: row.row,
          details: [
            { key: "annexure", value: row.annexure },
            { key: "category", value: row.category },
            { key: "division", value: row.division },
            { key: "industryGroup", value: row.analysis.industryGroup },
            { key: "inputs", value: row.analysis.inputs },
            { key: "products", value: row.analysis.products },
            {
              key: "byproducts",
              value: mapping?.saleable ?? row.analysis.byproducts,
            },
            {
              key: "recoverableWaste",
              value: mapping?.recoverable ?? row.analysis.recoverableWaste,
            },
            {
              key: "residualWaste",
              value: mapping?.residual ?? row.analysis.residualWaste,
            },
            {
              key: "nextUser",
              value: mapping?.nextUser ?? row.analysis.nextUser,
            },
            { key: "suggestedFlow", value: row.analysis.suggestedFlow },
            { key: "route", value: mapping?.route ?? "" },
            { key: "materialState", value: mapping?.families ?? "" },
          ],
        };
      });
    }
    case "industries": {
      return workbook.industries.map((row) => ({
        id: row.id,
        title: row.name,
        subtitle: row.group,
        sheet: row.sheet,
        row: row.row,
        details: [
          { key: "inputs", value: row.inputs },
          { key: "products", value: row.products },
          { key: "byproducts", value: row.byproducts },
          { key: "recoverableWaste", value: row.recoverableWaste },
          { key: "residualWaste", value: row.residualWaste },
          { key: "nextUser", value: row.nextUser },
          { key: "materialState", value: row.materialState },
          { key: "note", value: row.note },
        ],
      }));
    }
    case "lifecycles": {
      return [
        ...workbook.lifecycles.map((row) => ({
          id: row.id,
          title: row.grade,
          subtitle: row.family,
          sheet: row.sheet,
          row: row.row,
          details: [
            { key: "materialState", value: row.state },
            { key: "route", value: row.route },
            { key: "products", value: row.soldAs },
            { key: "nextUser", value: row.nextUser },
            { key: "qualityAttributes", value: row.qualityAttributes },
          ],
        })),
        ...systemDesign.chains.map((row) => ({
          id: row.id,
          title: row.output,
          subtitle: row.family,
          sheet: `${systemDesign.workbook} · ${row.sheet}`,
          row: row.row,
          details: [
            { key: "inputs", value: row.inputs },
            { key: "industryGroup", value: row.role },
            { key: "suggestedFlow", value: row.process },
            { key: "qualityAttributes", value: row.quality },
            { key: "byproducts", value: row.byproducts },
            { key: "nextUser", value: row.nextUser },
          ],
        })),
        ...printedPetProcesses.map((process, index) => ({
          id: `printed-pet-process-${String(index + 1)}`,
          title: process.title,
          subtitle: "Printed PET process notes",
          sheet: printedPetSource,
          row: process.page,
          details: [
            { key: "inputs", value: process.inputs },
            { key: "route", value: process.route },
          ],
        })),
      ];
    }
    case "byproducts": {
      return [
        ...workbook.byproducts.map((row) => ({
          id: row.id,
          title: row.name,
          subtitle: row.generatedBy,
          sheet: row.sheet,
          row: row.row,
          details: [
            {
              key: "reportedCommercialStatus",
              value: row.reportedCommercialStatus,
            },
            { key: "nextUser", value: row.potentialBuyer },
            { key: "qualityAttributes", value: row.qualityAttributes },
          ],
        })),
        ...systemDesign.byproducts.map((row) => ({
          id: row.id,
          title: row.material,
          subtitle: `Paracetamol · ${row.step}`,
          sheet: systemDesign.pharmaDocument,
          row: row.row,
          details: [
            { key: "recoverableWaste", value: row.recovery },
            { key: "suggestedFlow", value: row.treatment },
          ],
        })),
        ...printedPetStages.flatMap(({ page, stage, streams }, stageIndex) =>
          streams.map(([name, use, treatment], streamIndex) => ({
            id: `printed-pet-stream-${String(stageIndex + 1)}-${String(streamIndex + 1)}`,
            title: name,
            subtitle: stage,
            sheet: printedPetSource,
            row: page,
            details: [
              { key: "note", value: use },
              { key: "route", value: treatment },
            ],
          })),
        ),
        ...printedPetTags.map(([tag, meaning, examples]) => ({
          id: `printed-pet-tag-${tag}`,
          title: meaning,
          subtitle: `PET source tag ${tag}`,
          sheet: printedPetSource,
          row: 1,
          details: [{ key: "note", value: examples }],
        })),
      ];
    }
  }
}

/** Reference discovery never returns a permission, a price or a compliance decision. */
export function searchIndustryReference(
  kind: ReferenceKind,
  search: string,
  offset = 0,
) {
  if (
    search.length > 200 ||
    !Number.isSafeInteger(offset) ||
    offset < 0 ||
    offset > 10_000
  )
    throw new ConvexError("INVALID_REFERENCE_SEARCH");
  const terms = search.trim().toLowerCase().split(/\s+/u).filter(Boolean);
  const rows = referenceRows(kind).filter((row) => {
    const text = [
      row.title,
      row.subtitle,
      ...row.details.map((detail) => detail.value),
    ]
      .join(" ")
      .toLowerCase();
    return terms.every((term) => text.includes(term));
  });
  return {
    sourceQuality: "workbook_unverified" as const,
    sourceLanguage: "en" as const,
    sourceWorkbook: workbook.sourceWorkbook,
    total: rows.length,
    nextOffset: offset + 25 < rows.length ? offset + 25 : null,
    items: rows.slice(offset, offset + 25),
  };
}
