import { ConvexError } from "convex/values";
import { z } from "zod";

import { locales } from "../../src/i18n/locales";
export const ASSIST_PROMPT = "paper-assistance-v1";
export const assistMode = z.enum(["summary", "translation"]);
export const assistLocale = z.enum(locales);
export const assistOutput = z.strictObject({
  text: z
    .string()
    .max(12_000)
    .refine((text) => new TextEncoder().encode(text).length <= 24_000),
});
export function assistText(value: unknown) {
  const result = assistOutput.safeParse({ text: value });
  if (!result.success) throw new ConvexError("PAPER_ASSIST_INVALID");
  return result.data.text;
}
export function assistInput(mode: unknown, targetLocale: unknown) {
  const result = z
    .object({ mode: assistMode, targetLocale: assistLocale })
    .safeParse({ mode, targetLocale });
  if (!result.success) throw new ConvexError("PAPER_ASSIST_INVALID");
  return result.data;
}
