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
  const pan = normalizeId(draft?.pan);
  const gst = draft?.gstRegistered ? normalizeId(draft.gstin) : "";
  if (
    (pan && !/^[A-Z]{5}\d{4}[A-Z]$/.test(pan)) ||
    (draft?.gstRegistered &&
      !/^\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/.test(gst)) ||
    (pan && gst && gst.slice(2, 12) !== pan)
  )
    throw new ConvexError("VALIDATION_REQUIRED");
  return [
    ...(pan ? [{ kind: "pan" as const, input: pan }] : []),
    ...(gst ? [{ kind: "gst" as const, input: gst }] : []),
  ];
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
