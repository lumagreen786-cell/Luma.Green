import { ConvexError, v } from "convex/values";

export const REPORT_TTL = 30 * 60_000;
export const MAX_REPORT_ROWS = 500;
export const MAX_REPORT_BYTES = 128 * 1024;
export const vStockRow = v.object({
  materialCode: v.string(),
  grams: v.number(),
});
export const vReportStatus = v.union(
  v.literal("queued"),
  v.literal("running"),
  v.literal("complete"),
  v.literal("failed"),
  v.literal("expired"),
);

export function stockCsv(
  rows: readonly { materialCode: string; grams: number }[],
): string {
  if (rows.length > MAX_REPORT_ROWS) throw new ConvexError("REPORT_TOO_LARGE");
  const lines = rows
    .toSorted((a, b) => {
      if (a.materialCode === b.materialCode) return 0;
      return a.materialCode < b.materialCode ? -1 : 1;
    })
    .map((row) => {
      // Codes are identifiers, not free text. This also blocks CSV formula injection.
      if (
        !/^[A-Z0-9][A-Z0-9_-]{0,79}$/.test(row.materialCode) ||
        !Number.isSafeInteger(row.grams) ||
        row.grams < 0
      )
        throw new ConvexError("INVALID_REPORT_SOURCE");
      return `${row.materialCode},${String(row.grams)}`;
    });
  const csv = `material_code,grams\n${lines.join("\n")}\n`;
  if (new TextEncoder().encode(csv).byteLength > MAX_REPORT_BYTES)
    throw new ConvexError("REPORT_TOO_LARGE");
  return csv;
}
