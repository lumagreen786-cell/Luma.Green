import { v } from "convex/values";

import { query } from "./_generated/server";
import { searchIndustryReference } from "./lib/industryReference";
import {
  NATIONAL_INDUSTRY_LEVELS,
  NATIONAL_INDUSTRY_SOURCE,
  searchNationalIndustryReference,
} from "./lib/nationalIndustries";
import { requireOrg } from "./lib/workspace";

const vIndustryLevel = v.union(
  ...NATIONAL_INDUSTRY_LEVELS.map((level) => v.literal(level)),
);

/** Official activity discovery remains separate from workbook and permit review. */
export const nationalSearch = query({
  args: {
    search: v.string(),
    level: v.optional(vIndustryLevel),
    parentCode: v.optional(v.string()),
    offset: v.optional(v.number()),
  },
  returns: v.object({
    sourceVersion: v.literal("NIC-2025"),
    sourceQuality: v.literal("official_reference"),
    sourceLanguage: v.literal("en"),
    sourceWorkbookUrl: v.string(),
    sourcePublicationUrl: v.string(),
    total: v.number(),
    nextOffset: v.union(v.number(), v.null()),
    items: v.array(
      v.object({
        code: v.string(),
        title: v.string(),
        level: vIndustryLevel,
        parentCode: v.union(v.string(), v.null()),
        sectionCode: v.string(),
        divisionCode: v.union(v.string(), v.null()),
        groupCode: v.union(v.string(), v.null()),
        classCode: v.union(v.string(), v.null()),
        source: v.object({
          kind: v.union(v.literal("workbook"), v.literal("pdf")),
          sheet: v.union(v.string(), v.null()),
          row: v.union(v.number(), v.null()),
          printedPage: v.union(v.number(), v.null()),
        }),
      }),
    ),
  }),
  handler: async (ctx, args) => {
    await requireOrg(ctx, undefined, "read");
    return {
      ...searchNationalIndustryReference(args),
      sourceWorkbookUrl: NATIONAL_INDUSTRY_SOURCE.workbookUrl,
      sourcePublicationUrl: NATIONAL_INDUSTRY_SOURCE.pdfUrl,
    };
  },
});

export const search = query({
  args: {
    kind: v.union(
      v.literal("sectors"),
      v.literal("industries"),
      v.literal("lifecycles"),
      v.literal("byproducts"),
    ),
    search: v.string(),
    offset: v.optional(v.number()),
  },
  returns: v.object({
    sourceQuality: v.literal("workbook_unverified"),
    sourceLanguage: v.literal("en"),
    sourceWorkbook: v.string(),
    total: v.number(),
    nextOffset: v.union(v.number(), v.null()),
    items: v.array(
      v.object({
        id: v.string(),
        title: v.string(),
        subtitle: v.string(),
        sheet: v.string(),
        row: v.number(),
        details: v.array(v.object({ key: v.string(), value: v.string() })),
      }),
    ),
  }),
  handler: async (ctx, args) => {
    await requireOrg(ctx, undefined, "read");
    return searchIndustryReference(args.kind, args.search, args.offset);
  },
});
