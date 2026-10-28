import { ConvexError } from "convex/values";
import { z } from "zod";

import { stripUploadMetadata } from "../../src/lib/upload-image-metadata";
import { sniffContentType } from "./onboarding";

export const PAPER_DAY_MS = 86_400_000;
export const PAPER_DRAFT_MS = 30 * PAPER_DAY_MS;
export const PAPER_PROMPT_VERSION = "paper-verbatim-v1";
export const paperRowSchema = z.strictObject({
  dateText: z.string().max(80),
  description: z.string().max(500),
  quantityText: z.string().max(80),
  unitText: z.string().max(40),
  amountText: z.string().max(80),
  referenceText: z.string().max(120),
});
export const paperContentSchema = z.strictObject({
  text: z.string().max(12_000),
  rows: z.array(paperRowSchema).max(30),
});
export type PaperContent = z.infer<typeof paperContentSchema>;
export function paperContent(input: unknown): PaperContent {
  const result = paperContentSchema.safeParse(input);
  if (
    !result.success ||
    new TextEncoder().encode(JSON.stringify(result.data)).length > 24_000
  )
    throw new ConvexError("PAPER_INVALID_CONTENT");
  return result.data;
}
export function hasPaperContent(content: PaperContent) {
  return Boolean(
    content.text.trim() ||
    content.rows.some((row) => Object.values(row).some((text) => text.trim())),
  );
}
export function paperDay(now: number) {
  return new Date(now + 19_800_000).toISOString().slice(0, 10);
}
export async function paperHash(bytes: ArrayBuffer) {
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)]
    .map((n) => n.toString(16).padStart(2, "0"))
    .join("");
}
function invalid(): never {
  throw new ConvexError("PAPER_INVALID_FILE");
}
function pngDimensions(b: Uint8Array, view: DataView) {
  if (
    String.fromCodePoint(...b.slice(12, 16)) !== "IHDR" ||
    view.getUint32(8) !== 13
  )
    invalid();
  let offset = 8;
  let hasData = false;
  while (offset + 12 <= b.length) {
    const length = view.getUint32(offset);
    if (length > b.length - offset - 12) invalid();
    const chunk = String.fromCodePoint(...b.slice(offset + 4, offset + 8));
    if (chunk === "acTL") invalid();
    else if (chunk === "IDAT") hasData = true;
    offset += length + 12;
    if (chunk === "IEND") {
      if (!hasData || length !== 0 || offset !== b.length) invalid();
      return { width: view.getUint32(16), height: view.getUint32(20) };
    }
  }
  return invalid();
}
function isFrame(marker: number) {
  return marker >= 192 && marker <= 207 && ![196, 200, 204].includes(marker);
}
function jpegDimensions(b: Uint8Array, view: DataView) {
  if (b.at(-2) !== 255 || b.at(-1) !== 217) invalid();
  let offset = 2;
  let width = 0;
  let height = 0;
  while (offset + 4 <= b.length) {
    if (b[offset] !== 255) invalid();
    const marker = b[offset + 1];
    offset += 2;
    if (marker === 218) return { width, height };
    const length = view.getUint16(offset);
    if (length < 2 || offset + length > b.length) invalid();
    if (isFrame(marker)) {
      if (length < 8) invalid();
      height = view.getUint16(offset + 3);
      width = view.getUint16(offset + 5);
    }
    offset += length;
  }
  return invalid();
}
/** Structure and dimensions only: this is not a full decoder or malware certification. */
export function validatePaperImage(bytes: ArrayBuffer, declaredType: string) {
  const b = new Uint8Array(bytes);
  if (b.length < 24 || b.length > 2 * 1024 * 1024) invalid();
  const type = sniffContentType(b);
  if (type !== declaredType || (type !== "image/png" && type !== "image/jpeg"))
    invalid();
  try {
    stripUploadMetadata(b, type);
  } catch {
    invalid();
  }
  const view = new DataView(bytes);
  const { width, height } =
    type === "image/png" ? pngDimensions(b, view) : jpegDimensions(b, view);
  if (
    width < 1 ||
    height < 1 ||
    width > 2400 ||
    height > 2400 ||
    width * height > 5_760_000
  )
    invalid();
  return type;
}
