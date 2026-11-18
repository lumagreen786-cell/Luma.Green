import { ConvexError } from "convex/values";

import catalogue from "../data/nationalIndustries2025.json";

export const NATIONAL_INDUSTRY_LEVELS = [
  "section",
  "division",
  "group",
  "class",
  "subclass",
] as const;
export type NationalIndustryLevel = (typeof NATIONAL_INDUSTRY_LEVELS)[number];

export interface NationalIndustryRow {
  code: string;
  title: string;
  level: NationalIndustryLevel;
  parentCode: string | null;
  sectionCode: string;
  divisionCode: string | null;
  groupCode: string | null;
  classCode: string | null;
  source: {
    kind: "workbook" | "pdf";
    sheet: string | null;
    row: number | null;
    printedPage: number | null;
  };
}

const { rows: importedRows, ...source } = catalogue;
export const NATIONAL_INDUSTRY_SOURCE = source;
const rows: readonly NationalIndustryRow[] =
  importedRows as NationalIndustryRow[];
const byCode = new Map(rows.map((row) => [row.code, row]));
const searchable = rows.map((row) => ({
  row,
  text: [
    row.code,
    row.title,
    ...[
      row.sectionCode,
      row.divisionCode,
      row.groupCode,
      row.classCode,
    ].flatMap((code) => {
      const parent = code ? byCode.get(code) : undefined;
      return parent ? [parent.code, parent.title] : [];
    }),
  ]
    .join(" ")
    .toLowerCase(),
}));

export function getNationalIndustry(code: string): NationalIndustryRow | null {
  return byCode.get(code) ?? null;
}

/** Economic-activity reference only; never a facility or material permission. */
export function searchNationalIndustryReference(input: {
  search: string;
  level?: NationalIndustryLevel;
  parentCode?: string;
  offset?: number;
}) {
  const { search, parentCode } = input;
  const level = input.level ?? "subclass";
  const offset = input.offset ?? 0;
  if (
    typeof search !== "string" ||
    search.length > 200 ||
    !NATIONAL_INDUSTRY_LEVELS.includes(level) ||
    !Number.isSafeInteger(offset) ||
    offset < 0 ||
    offset > 10_000 ||
    (parentCode !== undefined && !byCode.has(parentCode))
  )
    throw new ConvexError("INVALID_REFERENCE_SEARCH");
  const terms = search.trim().toLowerCase().split(/\s+/u).filter(Boolean);
  const matches = searchable.filter(({ row, text }) => {
    if (row.level !== level) return false;
    if (
      parentCode !== undefined &&
      (row.code === parentCode ||
        ![
          row.sectionCode,
          row.divisionCode,
          row.groupCode,
          row.classCode,
        ].includes(parentCode))
    )
      return false;
    return terms.every((term) => text.includes(term));
  });
  return {
    sourceVersion: "NIC-2025" as const,
    sourceQuality: "official_reference" as const,
    sourceLanguage: "en" as const,
    total: matches.length,
    nextOffset: offset + 25 < matches.length ? offset + 25 : null,
    items: matches.slice(offset, offset + 25).map(({ row }) => row),
  };
}
