import { describe, expect, it } from "vitest";

import {
  evidencePreparationCsv,
  evidencePreparationExport,
} from "./evidence-preparation-export";
const reference = {
  id: "synthetic-evidence",
  orgId: "workspace-one",
  kind: "gst_invoice",
  reference: '=HYPERLINK("https://example.invalid")',
  issuerKind: "external_organization",
  issuerName: "Synthetic issuer, with\nnew line",
  version: 1,
  createdAt: 1_793_250_000_000,
  verificationStatus: "reported_unverified" as const,
};
const input = {
  orgId: reference.orgId,
  generatedAt: 1_793_250_000_001,
  complete: false,
  references: [reference],
};
describe("unfiled evidence preparation", () => {
  it("labels loaded rows partial and unverified without copying private author IDs", () => {
    const recordedReference = {
      ...reference,
      recordedByProfileId: "private-author",
    };
    const value = evidencePreparationExport({
      ...input,
      references: [recordedReference],
    });
    expect(JSON.parse(value)).toMatchObject({
      filingStatus: "not_government_filing",
      coverage: "partial_loaded_rows",
      loadedRowCount: 1,
      references: [{ createdAt: 1_793_250_000_000 }],
    });
    expect(value).not.toContain("private-author");
  });
  it("rejects stale rows from another selected workspace", () => {
    expect(() =>
      evidencePreparationCsv({ ...input, orgId: "workspace-two" }),
    ).toThrow("EVIDENCE_SCOPE_CHANGED");
  });
  it.each(["=1+1", "+cmd", "-cmd", "@SUM(A1)", "\tcmd", "\rcmd", "  =1+1"])(
    "neutralizes spreadsheet formula prefix %j",
    (referenceValue) => {
      const csv = evidencePreparationCsv({
        ...input,
        references: [{ ...reference, reference: referenceValue }],
      });
      expect(csv).toContain(`"'${referenceValue}"`);
      expect(csv).toContain(
        '"UNFILED","REPORTED_UNVERIFIED","NOT_GOVERNMENT_FILING"',
      );
      expect(csv).toContain('"Synthetic issuer, with\nnew line"');
    },
  );
  it("preserves quoted text and exact safe integers in complete lists", () => {
    const csv = evidencePreparationCsv({
      ...input,
      complete: true,
      references: [
        { ...reference, reference: 'a"b', version: Number.MAX_SAFE_INTEGER },
      ],
    });
    expect(csv).toContain('"a""b"');
    expect(csv).toContain('"\'9007199254740991"');
    expect(csv).toContain('"all_currently_available_rows"');
  });
  it("rejects unsafe integer evidence instead of rounding it in an export", () => {
    expect(() =>
      evidencePreparationExport({
        ...input,
        references: [{ ...reference, version: Number.MAX_SAFE_INTEGER + 1 }],
      }),
    ).toThrow("INVALID_EVIDENCE_INTEGER");
  });
});
