import { describe, expect, it } from "vitest";

import workbook from "../data/industryWorkbook.json";
import {
  getIndustrySector,
  searchIndustryReference,
} from "./industryReference";

describe("workbook reference boundaries", () => {
  it("keeps all distinct source rows and preserves repeated codes without overwriting sectors", () => {
    expect(workbook.sectors).toHaveLength(419);
    expect(new Set(workbook.sectors.map((row) => row.id)).size).toBe(419);
    const sameCodes = workbook.sectors.filter(
      (row) => row.annexure.startsWith("Annexure II ") && row.code === "1.1",
    );
    expect(sameCodes).toHaveLength(2);
    expect(getIndustrySector(sameCodes[0]?.id ?? "")?.name).not.toBe(
      getIndustrySector(sameCodes[1]?.id ?? "")?.name,
    );
    expect(getIndustrySector("not-a-source-row")).toBeNull();
  });

  it("preserves the four source-name disagreements instead of silently treating inferred corrections as official", () => {
    expect(
      workbook.sectors.filter((row) => !row.analysis.nameMatchesSource),
    ).toHaveLength(4);
    expect(getIndustrySector("cpcb-2025-row-393")?.name).not.toBe(
      getIndustrySector("cpcb-2025-row-393")?.analysis.reportedSectorName,
    );
    expect(workbook.sourceQuality).toBe("workbook_unverified");
  });

  it("uses actual records rather than header-inclusive dashboard formulas", () => {
    expect(searchIndustryReference("industries", "").total).toBe(99);
    expect(searchIndustryReference("lifecycles", "").total).toBe(90);
    expect(searchIndustryReference("byproducts", "").total).toBe(105);
  });

  it("bounds pages, searches material attributes and exposes reference status without trading permission", () => {
    const first = searchIndustryReference("sectors", "");
    expect(first.items).toHaveLength(25);
    expect(first.nextOffset).toBe(25);
    expect(searchIndustryReference("sectors", "", 400).items).toHaveLength(19);
    expect(searchIndustryReference("sectors", "", 400).nextOffset).toBeNull();
    const results = searchIndustryReference("lifecycles", "hot washed");
    expect(results.items.map((row) => row.title)).toContain(
      "Hot-washed PET flakes",
    );
    expect(results.sourceQuality).toBe("workbook_unverified");
    expect(results).not.toHaveProperty("canTrade");
    expect(
      searchIndustryReference("byproducts", "no-such-material").items,
    ).toEqual([]);
  });

  it("links the supplied sector mappings without changing sector IDs", () => {
    const rows = searchIndustryReference(
      "sectors",
      "paint-booth & phosphating sludge",
    );
    expect(rows.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "cpcb-2025-row-5", row: 5 }),
      ]),
    );
  });

  it("finds pharmaceutical streams as unverified references only", () => {
    const result = searchIndustryReference(
      "byproducts",
      "paracetamol spent catalyst",
    );
    expect(result.sourceQuality).toBe("workbook_unverified");
    expect(result.items).toEqual([
      expect.objectContaining({ title: "Spent catalyst (Pd/C, Raney nickel)" }),
    ]);
  });

  it("keeps printed virgin feedstock and used-bottle routes distinct", () => {
    expect(
      searchIndustryReference("lifecycles", "virgin PET bottle").items,
    ).toContainEqual(
      expect.objectContaining({
        title: "Virgin PET bottle manufacture",
        row: 2,
      }),
    );
    expect(
      searchIndustryReference("lifecycles", "used PET bottles").items,
    ).toContainEqual(
      expect.objectContaining({
        title: "Used PET bottles to garments",
        row: 2,
      }),
    );
  });

  it("exposes the printed end-of-life examples and tags as references only", () => {
    const recovery = searchIndustryReference(
      "byproducts",
      "polyester elastane",
    );
    expect(recovery.items).toContainEqual(
      expect.objectContaining({
        title: "Polyester with elastane or spandex",
        row: 6,
        sheet: "Printed PET process notes · Page",
      }),
    );
    const tags = searchIndustryReference("byproducts", "PET source tag");
    expect(tags.items.map((item) => item.id)).toEqual(
      ["H", "E", "V", "B", "O", "M", "C", "L"].map(
        (tag) => `printed-pet-tag-${tag}`,
      ),
    );
    expect(tags.sourceQuality).toBe("workbook_unverified");
    expect(tags.items[0]?.details).toEqual([
      expect.objectContaining({ key: "note" }),
    ]);
  });

  it("rejects invalid pagination and unbounded search input", () => {
    for (const offset of [-1, 0.5, NaN, 10_001])
      expect(() => searchIndustryReference("sectors", "", offset)).toThrow(
        "INVALID_REFERENCE_SEARCH",
      );
    expect(() => searchIndustryReference("sectors", "x".repeat(201))).toThrow(
      "INVALID_REFERENCE_SEARCH",
    );
  });
});
