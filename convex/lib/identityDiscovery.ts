import { ConvexError, v } from "convex/values";
import { z } from "zod";

import type { Doc } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";
export const registrationValidator = v.object({
  gstin: v.string(),
  state: v.string(),
  stateCode: v.string(),
  status: v.string(),
});
export const discoveryValidator = v.object({
  pan: v.string(),
  registrations: v.array(registrationValidator),
});
const envelope = z.object({
  success: z.literal(true),
  status_code: z.literal(200),
  data: z.object({
    pan_number: z.string(),
    gstin_list: z
      .array(
        z.object({
          gstin: z.string().regex(/^\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/),
          state: z.string().trim().min(1).max(100),
          state_code: z.string().regex(/^\d{2}$/),
          active_status: z.string().trim().min(1).max(50),
        }),
      )
      .max(100),
  }),
});
export function registrationsFrom(payload: unknown, pan: string) {
  const parsed = envelope.safeParse(payload);
  if (!parsed.success || parsed.data.data.pan_number !== pan) return null;
  const seen = new Map<
    string,
    { gstin: string; state: string; stateCode: string; status: string }
  >();
  for (const row of parsed.data.data.gstin_list) {
    if (
      row.gstin.slice(2, 12) !== pan ||
      row.gstin.slice(0, 2) !== row.state_code
    )
      return null;
    const value = {
      gstin: row.gstin,
      state: row.state,
      stateCode: row.state_code,
      status: row.active_status,
    };
    const previous = seen.get(row.gstin);
    if (previous && JSON.stringify(previous) !== JSON.stringify(value))
      return null;
    seen.set(row.gstin, value);
  }
  return [...seen.values()];
}

/** New PAN paths require an explicit selection; historical direct-GST paths remain valid. */
export async function requirePanSelection(
  ctx: QueryCtx,
  application: Doc<"applications">,
) {
  if (!application.panDiscoveryRequired) return;
  const draft = application.kabadiwala ?? application.business;
  const pan = draft?.pan?.trim().toUpperCase();
  if (!pan || !draft?.gstRegistered) return;
  const row = await ctx.db
    .query("identityChecks")
    .withIndex("by_application_kind", (q) =>
      q.eq("applicationId", application._id).eq("kind", "pan"),
    )
    .unique();
  const gstin = draft.gstin?.trim().toUpperCase();
  if (
    row?.provider !== "gstin_by_pan" ||
    row.status !== "verified" ||
    row.input !== pan ||
    row.expiresAt <= Date.now() ||
    row.selectedGstin !== gstin ||
    gstin?.slice(2, 12) !== pan ||
    !row.registrations?.some((r) => r.gstin === gstin && r.status === "Active")
  )
    throw new ConvexError("VALIDATION_REQUIRED");
}
