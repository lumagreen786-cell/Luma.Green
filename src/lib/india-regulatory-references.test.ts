import { describe, expect, it } from "vitest";

import {
  INDIA_REGULATORY_REFERENCES,
  isOfficialReferenceUrl,
} from "./india-regulatory-references";

describe("India reference boundaries", () => {
  it("separates final trading law, procedural records and unverified portal operation", () => {
    const regulation = INDIA_REGULATORY_REFERENCES.find(
      (r) => r.id === "carbon-trading-regulation-2026",
    );
    expect(regulation).toMatchObject({
      status: "notified",
      documentDate: "2026-02-27 notification",
    });
    expect(regulation?.effectiveDate).toBeUndefined();
    const proceedings = INDIA_REGULATORY_REFERENCES.find(
      (r) => r.id === "carbon-trading-proceedings-2026-10-23",
    );
    expect(proceedings?.status).toBe("guidance");
    expect(proceedings?.title).toContain("not market approval");
    expect(proceedings?.effectiveDate).toBeUndefined();
    const currentPortal = INDIA_REGULATORY_REFERENCES.find(
      (r) => r.id === "common-epr-current",
    );
    expect(currentPortal?.url).toBe("https://epr.cpcb.gov.in/");
    expect(currentPortal?.limits).toContain("not independently verified");
  });

  it("keeps dated official evidence separate from a draft", () => {
    const solid = INDIA_REGULATORY_REFERENCES.find((r) => r.id === "swm-2026");
    expect(solid).toMatchObject({
      status: "notified",
      effectiveDate: "2026-04-01",
    });
    const draft = INDIA_REGULATORY_REFERENCES.find(
      (r) => r.id === "carbon-transactions-draft",
    );
    expect(draft).toMatchObject({ status: "draft", reviewedOn: "2026-10-28" });
    expect(draft?.effectiveDate).toBeUndefined();
    expect(new Set(INDIA_REGULATORY_REFERENCES.map((r) => r.id)).size).toBe(
      INDIA_REGULATORY_REFERENCES.length,
    );
    for (const r of INDIA_REGULATORY_REFERENCES) {
      expect(isOfficialReferenceUrl(r.url)).toBe(true);
      expect(r.publisher).not.toBe("");
      expect(r.evidence.length).toBeGreaterThan(0);
      expect(r.limits).not.toBe("");
    }
  });

  it.each([
    // eslint-disable-next-line sonarjs/no-clear-text-protocols, unicorn/prefer-https -- Verify insecure references are rejected.
    "http://beeindia.gov.in/file.pdf",
    "https://beeindia.gov.in.evil.example/file.pdf",
    "https://evil.beeindia.gov.in/file.pdf",
    "https://cercind.gov.in.evil.example/file.pdf",
    "https://evil.epr.cpcb.gov.in/",
    "https://user@beeindia.gov.in/file.pdf",
    "https://beeindia.gov.in:8443/file.pdf",
    "javascript:alert(1)",
    "not a URL",
  ])("rejects an unapproved external reference: %s", (url) => {
    expect(isOfficialReferenceUrl(url)).toBe(false);
  });
});
