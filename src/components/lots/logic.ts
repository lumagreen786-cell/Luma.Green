import { ConvexError } from "convex/values";
import { z } from "zod";

import { asciiDigits } from "@/lib/number-input";

import {
  HANDLING_CLASSES,
  STREAM_CLASSES,
} from "../../../convex/lib/industrialClassification";

/** Gram entry is deliberately ungrouped and integral, including native digits. */
export function parseGrams(value: string): number | null {
  const text = asciiDigits(value.trim());
  if (!/^\d+$/.test(text)) return null;
  const result = Number(text);
  return Number.isSafeInteger(result) ? result : null;
}
const label = z.string().trim().min(1).max(120);
const reference = z.string().trim().max(500);
const optionalCost = z
  .string()
  .refine((value) => value.trim() === "" || parseGrams(value) !== null)
  .optional();
const costReference = reference
  .refine((value) => value === "" || value.length >= 3)
  .optional();
export const acquisitionCostSchema = z.object({
  costPaise: z.string().refine((value) => parseGrams(value) !== null),
  costReference: reference.min(3),
});
const grams = (isZeroAllowed = false) =>
  z.string().refine((value) => {
    const parsed = parseGrams(value);
    return parsed !== null && parsed >= (isZeroAllowed ? 0 : 1);
  });
export const declareSchema = z
  .object({
    materialCode: label,
    state: label,
    grams: grams(),
    sourceReference: reference,
    acquisitionCostPaise: optionalCost,
    costReference,
    streamClass: z.enum(STREAM_CLASSES).optional(),
    handlingClass: z.enum(HANDLING_CLASSES).optional(),
  })
  .refine(
    (value) =>
      !value.acquisitionCostPaise?.trim() ||
      Boolean(value.costReference && value.costReference.length >= 3),
    { path: ["costReference"] },
  );
const outputSchema = z.object({
  materialCode: label,
  state: label,
  grams: grams(),
  streamClass: z.enum(STREAM_CLASSES).optional(),
  handlingClass: z.enum(HANDLING_CLASSES).optional(),
});
const inputAllocationSchema = z.object({
  lotId: z.string().min(1),
  grams: grams(),
});
export const transformSchema = z
  .object({
    inputGrams: grams(),
    additionalInputs: z.array(inputAllocationSchema).max(19).optional(),
    contaminationGrams: grams(true),
    processLossGrams: grams(true),
    processingCostPaise: optionalCost,
    costReference,
    outputs: z.array(outputSchema).min(1).max(10),
  })
  .refine(
    (value) =>
      !value.processingCostPaise?.trim() ||
      Boolean(value.costReference && value.costReference.length >= 3),
    { path: ["costReference"] },
  );
export const dispositionSchema = z.object({
  grams: grams(),
  destinationReference: reference.min(1),
  authorisationReference: reference.min(1),
  manifestReference: reference.min(1),
});
export const inspectionSchema = z.object({
  specificationReference: label,
  specificationVersion: label,
  sampleMethod: label,
  results: z
    .array(z.object({ parameter: label, unit: label, value: label }))
    .min(1)
    .max(30),
  decision: z
    .enum(["", "accepted", "rejected", "conditional"])
    .refine((value) => value !== ""),
  evidenceReference: reference,
  reason: z.string().trim().max(120),
});
export function accountedGrams(
  values: z.infer<typeof transformSchema>,
): number | null {
  const parts = [
    values.contaminationGrams,
    values.processLossGrams,
    ...values.outputs.map((row) => row.grams),
  ].map((value) => parseGrams(value));
  if (parts.includes(null)) return null;
  const total = parts.reduce<number>((sum, value) => sum + (value ?? 0), 0);
  return Number.isSafeInteger(total) ? total : null;
}
export type LotErrorKey =
  | "balanceError"
  | "weightDispute"
  | "approvalError"
  | "accessChanged"
  | "invalidInput"
  | "genericError";
export function lotError(error: unknown): LotErrorKey {
  const code: unknown = error instanceof ConvexError ? error.data : undefined;
  if (code === "MASS_BALANCE_MISMATCH") return "balanceError";
  if (code === "WEIGHT_DISPUTE") return "weightDispute";
  if (code === "SELF_APPROVAL_FORBIDDEN" || code === "OWNER_REQUIRED")
    return "approvalError";
  if (
    [
      "LOT_NOT_FOUND",
      "LOT_NOT_AVAILABLE",
      "LOT_NOT_PENDING_FOR_ORG",
      "WORKSPACE_PERMISSION_DENIED",
      "NO_BUSINESS",
      "RECEIVER_NOT_ACTIVE",
      "INSPECTION_SUPERSEDED",
    ].includes(String(code))
  )
    return "accessChanged";
  if (
    [
      "INVALID_WEIGHT",
      "INVALID_LABEL",
      "INVALID_REFERENCE",
      "NOT_ENOUGH_LOT_GRAMS",
      "INVALID_OUTPUTS",
      "INVALID_INPUTS",
      "INVALID_RESULTS",
      "CORRECTION_SCOPE_CHANGED",
    ].includes(String(code))
  )
    return "invalidInput";
  return "genericError";
}

/** Field-array indices are numbers; retain their typed path after explicit string conversion. */
export function formIndex(index: number): `${number}` {
  return String(index) as `${number}`;
}

export function combinedInputGrams(
  values: Pick<
    z.infer<typeof transformSchema>,
    "inputGrams" | "additionalInputs"
  >,
): number | null {
  const parts = [
    values.inputGrams,
    ...(values.additionalInputs ?? []).map((row) => row.grams),
  ].map((value) => parseGrams(value));
  if (parts.some((value) => value === null || value <= 0)) return null;
  const total = parts.reduce<number>((sum, value) => sum + (value ?? 0), 0);
  return Number.isSafeInteger(total) ? total : null;
}
