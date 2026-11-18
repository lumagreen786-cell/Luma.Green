import { describe, expect, it } from "vitest";

import {
  getIndiaJurisdiction,
  INDIA_JURISDICTION_COVERAGE,
  INDIA_JURISDICTIONS,
} from "../data/indiaJurisdictions";
import { INDIA_STATES_AND_UTS } from "./geography";

describe("India jurisdiction reference", () => {
  it("covers every canonical geography name exactly once in its existing order", () => {
    const names = INDIA_JURISDICTIONS.map((entry) => entry.jurisdiction);
    expect(names).toEqual([...INDIA_STATES_AND_UTS]);
    expect(new Set(names).size).toBe(36);
    for (const entry of INDIA_JURISDICTIONS) {
      expect(getIndiaJurisdiction(entry.jurisdiction)).toBe(entry);
    }
  });

  it("retains official source locations and reference dates for every entry", () => {
    for (const entry of INDIA_JURISDICTIONS) {
      expect(new URL(entry.sourceUrl).hostname).toBe("cpcb.gov.in");
      expect(entry.sourceLocator.length).toBeGreaterThan(5);
      expect(entry.retrievedOn).toBe("2026-11-18");
      expect(entry.sourceAsOf).toMatch(/^2026-04-(?:01|27)$/u);
      for (const source of entry.supportingSources) {
        expect(new URL(source.url).hostname).toMatch(/\.(?:gov|nic)\.in$/u);
        expect(source.locator.length).toBeGreaterThan(5);
      }
    }
  });

  it("uses public HTTP(S) URLs without credentials and keeps reference status explicit", () => {
    for (const entry of INDIA_JURISDICTIONS) {
      expect(entry.authorityName).toBeTruthy();
      expect(entry.authorityUrl).toBeTruthy();
      for (const value of [entry.authorityUrl, entry.sourceUrl]) {
        if (value === null) continue;
        const url = new URL(value);
        expect(["http:", "https:"]).toContain(url.protocol);
        expect(url.hostname).not.toBe("localhost");
        expect(url.username).toBe("");
        expect(url.password).toBe("");
      }
      expect(["directory_listed", "needs_review"]).toContain(
        entry.reviewStatus,
      );
      expect(entry).not.toHaveProperty("dispatchAllowed");
      expect(entry).not.toHaveProperty("permitVerified");
    }
    expect(getIndiaJurisdiction("Assam")?.authorityUrl).toBe(
      // eslint-disable-next-line sonarjs/no-clear-text-protocols, unicorn/prefer-https -- Verify that a source-reported URL is preserved without inventing an HTTPS endpoint.
      "http://www.pcbassam.org",
    );
  });

  it("keeps unresolved official naming conflicts visible in the coverage count", () => {
    const unresolved = INDIA_JURISDICTIONS.filter(
      (entry) => entry.reviewStatus === "needs_review",
    );
    expect(INDIA_JURISDICTION_COVERAGE).toEqual({
      total: 36,
      directoryListed: 35,
      needsReview: 1,
    });
    expect(unresolved.map((entry) => entry.jurisdiction)).toEqual([
      "Jammu and Kashmir",
    ]);
    expect(unresolved[0]?.reviewNote).toContain("Committee");
    expect(unresolved[0]?.supportingSources.length).toBeGreaterThan(0);
  });

  it("keeps the merged territory and separate Ladakh authority without retired aliases", () => {
    const merged = getIndiaJurisdiction(
      "Dadra and Nagar Haveli and Daman and Diu",
    );
    expect(merged?.authorityUrl).toBe(
      "https://ddd.gov.in/pollution-control-committee/",
    );
    expect(merged?.reviewNote).toContain("merged");
    expect(getIndiaJurisdiction("Daman and Diu")).toBeNull();
    expect(getIndiaJurisdiction("Dadra and Nagar Haveli")).toBeNull();
    expect(getIndiaJurisdiction("Ladakh")).toMatchObject({
      authorityName: "Ladakh Pollution Control Committee",
      sourceUrl: "https://cpcb.gov.in/uploads/SPCB_Directory.pdf",
      sourceAsOf: "2026-04-01",
      reviewStatus: "directory_listed",
    });
    expect(getIndiaJurisdiction("Ladakh")?.authorityUrl).not.toBe(
      getIndiaJurisdiction("Jammu and Kashmir")?.authorityUrl,
    );
  });

  it.each(["", " ", "Atlantis", "karnataka", " Karnataka ", "Delhi, Delhi"])(
    "does not infer an authority for noncanonical input %s",
    (value) => {
      expect(getIndiaJurisdiction(value)).toBeNull();
    },
  );
});
