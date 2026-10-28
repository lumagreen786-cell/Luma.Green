import { expect, it } from "vitest";

import { paperContent, paperDay, validatePaperImage } from "./paper";
const png = Uint8Array.from(
  atob(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=",
  ),
  (c) => c.codePointAt(0) ?? 0,
);
it("accepts a complete raster but rejects MIME lies, truncated images and huge dimensions", () => {
  expect(validatePaperImage(png.buffer, "image/png")).toBe("image/png");
  expect(() => validatePaperImage(png.buffer, "image/jpeg")).toThrow();
  expect(() =>
    validatePaperImage(png.slice(0, -12).buffer, "image/png"),
  ).toThrow();
  const huge = new Uint8Array(png);
  new DataView(huge.buffer).setUint32(16, 40_000);
  expect(() => validatePaperImage(huge.buffer, "image/png")).toThrow();
});
it("keeps quantities as untrusted text and rejects invented operational fields", () => {
  expect(paperContent({ text: "12? kg", rows: [] })).toEqual({
    text: "12? kg",
    rows: [],
  });
  expect(() =>
    paperContent({ text: "x", rows: [], stockGrams: 12_000 }),
  ).toThrow();
  expect(() => paperContent({ text: "x".repeat(12_001), rows: [] })).toThrow();
});

it("resets quotas at midnight India time, not browser or UTC midnight", () => {
  expect(paperDay(Date.parse("2026-10-28T18:29:59Z"))).toBe("2026-10-28");
  expect(paperDay(Date.parse("2026-10-28T18:30:00Z"))).toBe("2026-10-29");
});
