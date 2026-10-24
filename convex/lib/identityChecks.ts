import { ConvexError } from "convex/values";
import { z } from "zod";

export const CHECK_TTL = 24 * 60 * 60 * 1000;
export const DAILY_CHECK_LIMIT = 20;
export const normalizeId = (value?: string) =>
  value?.trim().toUpperCase() ?? "";
export function identityInputs(draft?: {
  pan?: string;
  gstRegistered?: boolean;
  gstin?: string;
}) {
  const gst = draft?.gstRegistered ? normalizeId(draft.gstin) : "";
  if (
    draft?.gstRegistered &&
    !/^\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/.test(gst)
  )
    throw new ConvexError("VALIDATION_REQUIRED");
  return [...(gst ? [{ kind: "gst" as const, input: gst }] : [])];
}

const gstEnvelope = z.object({
  success: z.literal(true),
  status_code: z.literal(200),
  data: z.object({
    gstin: z.string(),
    gstin_status: z.literal("Active"),
    business_name: z.string().trim().max(500),
    legal_name: z.string().trim().min(1).max(500),
    address: z.string().trim().min(1).max(2000),
  }),
});

/** Retain only the registration details the applicant must confirm. */
export function gstBusiness(payload: unknown, input: string) {
  const parsed = gstEnvelope.safeParse(payload);
  if (!parsed.success || parsed.data.data.gstin !== input) return null;
  const data = parsed.data.data;
  const name = data.business_name || data.legal_name;
  if (!name) return null;
  return {
    gstin: input,
    businessName: name,
    legalName: data.legal_name,
    address: data.address,
  };
}
const envelope = z.object({
  success: z.literal(true),
  status_code: z.literal(200),
  data: z.object({
    pan_number: z.string(),
    gstin_list: z
      .array(z.object({ gstin: z.string(), active_status: z.string() }))
      .optional(),
  }),
});
export function providerVerified(
  payload: unknown,
  kind: "pan" | "gst",
  input: string,
) {
  const parsed = envelope.safeParse(payload);
  if (!parsed.success) return false;
  const data = parsed.data.data;
  if (data.pan_number !== (kind === "pan" ? input : input.slice(2, 12)))
    return false;
  if (kind === "pan") return true;
  const matches = data.gstin_list?.filter((row) => row.gstin === input) ?? [];
  return (
    matches.length > 0 && matches.every((row) => row.active_status === "Active")
  );
}
