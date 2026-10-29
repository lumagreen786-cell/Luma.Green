/** Local preparation only: no filing, verification, attachment read or mutation. */
export interface PreparationReference {
  id: string;
  orgId: string;
  tradeId?: string;
  kind: string;
  reference: string;
  issuerKind: string;
  issuerName: string;
  issuedAt?: number;
  supersedesId?: string;
  version: number;
  createdAt: number;
  verificationStatus: "reported_unverified";
}
export function evidencePreparationExport(input: {
  orgId: string;
  generatedAt: number;
  complete: boolean;
  references: readonly PreparationReference[];
}) {
  if (input.references.some((row) => row.orgId !== input.orgId))
    throw new Error("EVIDENCE_SCOPE_CHANGED");
  const integers = [
    input.generatedAt,
    ...input.references.flatMap((row) => [
      row.version,
      row.createdAt,
      ...(row.issuedAt === undefined ? [] : [row.issuedAt]),
    ]),
  ];
  if (integers.some((value) => !Number.isSafeInteger(value) || value < 0))
    throw new Error("INVALID_EVIDENCE_INTEGER");
  return JSON.stringify(
    {
      schemaVersion: 1,
      purpose: "unfiled_preparation",
      filingStatus: "not_government_filing",
      verificationStatus: "reported_unverified",
      generatedAt: input.generatedAt,
      workspaceId: input.orgId,
      loadedRowCount: input.references.length,
      coverage: input.complete
        ? "all_currently_available_rows"
        : "partial_loaded_rows",
      limitations:
        "Reported references only. No permit, certificate, filing or source verification is created. Previously downloaded copies cannot be revoked.",
      references: input.references.map((row) => ({
        id: row.id,
        orgId: row.orgId,
        tradeId: row.tradeId,
        kind: row.kind,
        reference: row.reference,
        issuerKind: row.issuerKind,
        issuerName: row.issuerName,
        issuedAt: row.issuedAt,
        supersedesId: row.supersedesId,
        version: row.version,
        createdAt: row.createdAt,
        verificationStatus: row.verificationStatus,
      })),
    },
    null,
    2,
  );
}

/** Quote every cell; prefix untrusted formula-like content for spreadsheet safety. */
function csvCell(value: string | number | undefined): string {
  let text = value === undefined ? "" : String(value);
  if (
    (typeof value === "number" && text.replace("-", "").length > 15) ||
    /^\s*[=+\-@\t\r]/u.test(text) ||
    /^[\t\r]/u.test(text)
  )
    text = `'${text}`;
  return `"${text.replaceAll('"', '""')}"`;
}
export function evidencePreparationCsv(
  input: Parameters<typeof evidencePreparationExport>[0],
) {
  // Shared validation and explicit field projection excludes private author IDs.
  evidencePreparationExport(input);
  const rows: (string | number | undefined)[][] = [
    [
      "Luma evidence list",
      "UNFILED",
      "REPORTED_UNVERIFIED",
      "NOT_GOVERNMENT_FILING",
    ],
    ["schemaVersion", 1, "generatedAt", input.generatedAt],
    ["workspaceId", input.orgId, "loadedRowCount", input.references.length],
    [
      "coverage",
      input.complete ? "all_currently_available_rows" : "partial_loaded_rows",
    ],
    [
      "id",
      "workspaceId",
      "tradeId",
      "kind",
      "reference",
      "issuerKind",
      "issuerName",
      "issuedAt",
      "supersedesId",
      "version",
      "createdAt",
      "verificationStatus",
    ],
    ...input.references.map((row) => [
      row.id,
      row.orgId,
      row.tradeId,
      row.kind,
      row.reference,
      row.issuerKind,
      row.issuerName,
      row.issuedAt,
      row.supersedesId,
      row.version,
      row.createdAt,
      row.verificationStatus,
    ]),
  ];
  return `\u{FEFF}${rows.map((row) => row.map((cell) => csvCell(cell)).join(",")).join("\r\n")}\r\n`;
}
