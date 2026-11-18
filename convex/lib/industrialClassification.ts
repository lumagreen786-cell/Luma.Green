import { ConvexError, v } from "convex/values";

import { indiaToday } from "./onboarding";

export const PROCESS_KINDS = [
  "sorting",
  "baling",
  "shredding",
  "stripping",
  "washing",
  "granulating",
  "compounding",
  "recovery",
  "manufacturing",
  "residual_handling",
] as const;
export const STREAM_CLASSES = [
  "unspecified",
  "main_product",
  "saleable_byproduct",
  "recoverable_waste",
  "residual_waste",
] as const;
export const HANDLING_CLASSES = [
  "unassessed",
  "non_hazardous",
  "controlled",
] as const;
export const vProcessKind = v.union(
  v.literal("sorting"),
  v.literal("baling"),
  v.literal("shredding"),
  v.literal("stripping"),
  v.literal("washing"),
  v.literal("granulating"),
  v.literal("compounding"),
  v.literal("recovery"),
  v.literal("manufacturing"),
  v.literal("residual_handling"),
);
export const vStreamClass = v.union(
  v.literal("unspecified"),
  v.literal("main_product"),
  v.literal("saleable_byproduct"),
  v.literal("recoverable_waste"),
  v.literal("residual_waste"),
);
export const vHandlingClass = v.union(
  v.literal("unassessed"),
  v.literal("non_hazardous"),
  v.literal("controlled"),
);
export const vSectorSnapshot = v.object({
  id: v.string(),
  code: v.string(),
  name: v.string(),
  category: v.string(),
  annexure: v.string(),
  workbookSha256: v.string(),
  sheet: v.string(),
  row: v.number(),
  sourceQuality: v.literal("workbook_unverified"),
});

/** Official economic activity only; selection grants no operating permission. */
export const vIndustryActivitySnapshot = v.object({
  code: v.string(),
  title: v.string(),
  sourceVersion: v.literal("NIC-2025"),
  sourceQuality: v.literal("official_reference"),
  workbookSha256: v.string(),
  pdfSha256: v.string(),
});

/** These declarations never feed marketplace approval or a legal determination. */
export function requiresControlledRoute(lot: {
  streamClass?: string;
  handlingClass?: string;
}) {
  return (
    lot.streamClass === "residual_waste" || lot.handlingClass === "controlled"
  );
}
export function assertOrdinaryRoute(lot: {
  streamClass?: string;
  handlingClass?: string;
}) {
  if (requiresControlledRoute(lot))
    throw new ConvexError("CONTROLLED_ROUTE_REQUIRED");
}

export const REGISTRATION_KINDS = [
  "consent_to_operate",
  "consent_to_establish",
  "epr_registration",
  "waste_authorisation",
  "other",
] as const;
export const vRegistrationKind = v.union(
  ...REGISTRATION_KINDS.map((kind) => v.literal(kind)),
);

export function registrationDates(issuedAt: string, validUntil: string) {
  for (const value of [issuedAt, validUntil]) {
    if (!/^\d{4}-\d{2}-\d{2}$/u.test(value))
      throw new ConvexError("INVALID_REGISTRATION_DATES");
    const time = Date.parse(`${value}T00:00:00.000Z`);
    if (
      !Number.isFinite(time) ||
      new Date(time).toISOString().slice(0, 10) !== value
    )
      throw new ConvexError("INVALID_REGISTRATION_DATES");
  }
  if (validUntil < issuedAt)
    throw new ConvexError("INVALID_REGISTRATION_DATES");
}
export function registrationDateStatus(
  issuedAt: string,
  validUntil: string,
  now: number,
) {
  const today = indiaToday(now);
  if (issuedAt > today) return "not_yet_current" as const;
  return validUntil < today ? ("expired" as const) : ("current" as const);
}
