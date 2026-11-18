import { describe, expect, it } from "vitest";

import catalogue from "../data/nationalIndustries2025.json";
import {
  getNationalIndustry,
  NATIONAL_INDUSTRY_LEVELS,
  NATIONAL_INDUSTRY_SOURCE,
  searchNationalIndustryReference,
} from "./nationalIndustries";

describe("official national industry references", () => {
  it("retains every official subclass and the documented source disagreements", () => {
    expect(NATIONAL_INDUSTRY_SOURCE.version).toBe("NIC-2025");
    expect(NATIONAL_INDUSTRY_SOURCE.reportedCounts).toEqual({
      section: 22,
      division: 87,
      group: 257,
      class: 463,
      subclass: 1887,
    });
    expect(NATIONAL_INDUSTRY_SOURCE.workbookCounts).toEqual({
      section: 22,
      division: 86,
      group: 257,
      class: 463,
      subclass: 1887,
    });
    expect(NATIONAL_INDUSTRY_SOURCE.observedCounts).toEqual({
      section: 22,
      division: 87,
      group: 258,
      class: 463,
      subclass: 1887,
    });
    expect(catalogue.rows).toHaveLength(2717);
    expect(new Set(catalogue.rows.map((row) => row.code)).size).toBe(2717);
    for (const level of NATIONAL_INDUSTRY_LEVELS)
      expect(catalogue.rows.filter((row) => row.level === level)).toHaveLength(
        NATIONAL_INDUSTRY_SOURCE.observedCounts[level],
      );
    expect(NATIONAL_INDUSTRY_SOURCE.discrepancies.map((row) => row.id)).toEqual(
      [
        "workbook-missing-division-38",
        "workbook-missing-group-108",
        "release-group-count",
      ],
    );
  });

  it("keeps leading zeroes and verifies every ancestry and source locator", () => {
    expect(getNationalIndustry("011101")).toMatchObject({
      title: "Growing of wheat",
      parentCode: "0111",
      sectionCode: "A",
      divisionCode: "01",
      groupCode: "011",
      classCode: "0111",
      source: { kind: "workbook", sheet: "All", row: 7 },
    });
    for (const row of catalogue.rows) {
      expect(row.title.trim()).not.toBe("");
      expect(getNationalIndustry(row.sectionCode)?.level).toBe("section");
      if (row.parentCode) {
        expect(getNationalIndustry(row.parentCode)).not.toBeNull();
        if (row.level !== "division")
          expect(row.code.startsWith(row.parentCode)).toBe(true);
      }
      for (const ancestor of [row.divisionCode, row.groupCode, row.classCode])
        if (ancestor) expect(getNationalIndustry(ancestor)).not.toBeNull();
      if (row.source.kind === "workbook") {
        expect(row.source.sheet).toBe("All");
        expect(row.source.row).toBeGreaterThan(1);
        expect(row.source.row).toBeLessThanOrEqual(3150);
      } else {
        expect(["38", "108"]).toContain(row.code);
        expect(row.source.printedPage).not.toBeNull();
      }
    }
    expect(getNationalIndustry("108")).toMatchObject({
      parentCode: "10",
      source: { kind: "pdf", printedPage: 16 },
    });
    expect(getNationalIndustry("38")).toMatchObject({
      parentCode: "E",
      source: { kind: "pdf", printedPage: 20 },
    });
    expect(getNationalIndustry("381101")?.divisionCode).toBe("38");
    expect(getNationalIndustry("108001")?.groupCode).toBe("108");
    expect(getNationalIndustry("11101")).toBeNull();
    expect(getNationalIndustry("cpcb-2025-row-5")).toBeNull();
  });

  it("covers all 22 national sections without deriving waste permissions", () => {
    for (const letter of "ABCDEFGHIJKLMNOPQRSTUV") {
      expect(getNationalIndustry(letter)?.level).toBe("section");
      const results = searchNationalIndustryReference({
        search: "",
        parentCode: letter,
      });
      expect(results.total).toBeGreaterThan(0);
      expect(results.items.every((row) => row.sectionCode === letter)).toBe(
        true,
      );
      expect(results).toMatchObject({
        sourceVersion: "NIC-2025",
        sourceQuality: "official_reference",
        sourceLanguage: "en",
      });
      for (const row of results.items)
        for (const key of [
          "canTrade",
          "permitted",
          "hazardClass",
          "price",
          "co2eFactorPerKg",
          "nic2008Code",
        ])
          expect(row).not.toHaveProperty(key);
    }
  });

  it("searches activity codes, English titles and ancestors with all terms", () => {
    expect(
      searchNationalIndustryReference({ search: "  CaTtLe    feed  " }).items,
    ).toContainEqual(expect.objectContaining({ code: "108001" }));
    expect(
      searchNationalIndustryReference({ search: "C cattle" }).items,
    ).toContainEqual(expect.objectContaining({ code: "108001" }));
    expect(
      searchNationalIndustryReference({ search: "011101" }).items.map(
        (row) => row.code,
      ),
    ).toEqual(["011101"]);
    expect(
      searchNationalIndustryReference({
        search: "agriculture",
        level: "section",
      }).items.map((row) => row.code),
    ).toEqual(["A"]);
    expect(
      searchNationalIndustryReference({ search: "no-such-activity-551" }).items,
    ).toEqual([]);
  });

  it("filters descendants at each level and never reuses another parent", () => {
    expect(
      searchNationalIndustryReference({
        search: "",
        level: "division",
        parentCode: "A",
      }).items.map((row) => row.code),
    ).toEqual(["01", "02", "03"]);
    const waste = searchNationalIndustryReference({
      search: "",
      parentCode: "38",
    });
    expect(waste.total).toBe(22);
    expect(waste.items.every((row) => row.divisionCode === "38")).toBe(true);
    const feed = searchNationalIndustryReference({
      search: "",
      parentCode: "1080",
    });
    expect(feed.items.map((row) => row.code)).toEqual([
      "108001",
      "108002",
      "108003",
      "108099",
    ]);
    expect(
      searchNationalIndustryReference({
        search: "",
        parentCode: "011101",
      }).items,
    ).toEqual([]);
  });

  it("returns bounded non-overlapping pages and an explicit last page", () => {
    const first = searchNationalIndustryReference({ search: "" });
    const second = searchNationalIndustryReference({ search: "", offset: 25 });
    expect(first.total).toBe(1887);
    expect(first.items).toHaveLength(25);
    expect(first.nextOffset).toBe(25);
    expect(second.items).toHaveLength(25);
    expect(
      second.items.some((row) =>
        first.items.some((prior) => prior.code === row.code),
      ),
    ).toBe(false);
    const last = searchNationalIndustryReference({ search: "", offset: 1886 });
    expect(last.items).toHaveLength(1);
    expect(last.nextOffset).toBeNull();
    expect(
      searchNationalIndustryReference({ search: "", offset: 1887 }).items,
    ).toEqual([]);
  });

  it("rejects malformed input rather than silently selecting another scope", () => {
    for (const offset of [-1, 0.5, NaN, Infinity, 10_001])
      expect(() =>
        searchNationalIndustryReference({ search: "", offset }),
      ).toThrow("INVALID_REFERENCE_SEARCH");
    for (const parentCode of ["", "00", "c", " 01 ", "invalid", "11101"])
      expect(() =>
        searchNationalIndustryReference({ search: "", parentCode }),
      ).toThrow("INVALID_REFERENCE_SEARCH");
    expect(() =>
      searchNationalIndustryReference({ search: "x".repeat(201) }),
    ).toThrow("INVALID_REFERENCE_SEARCH");
    expect(() =>
      searchNationalIndustryReference({
        search: "",
        level: "unknown" as "subclass",
      }),
    ).toThrow("INVALID_REFERENCE_SEARCH");
  });
});
