import { ConvexError, v } from "convex/values";

import { surepassExampleEnv } from "../src/lib/env";
import { internal } from "./_generated/api";
import { internalAction, internalMutation } from "./_generated/server";
import { spendIdentityAttempt } from "./lib/identityCheckQuota";
import { providerVerified } from "./lib/identityChecks";
import { indiaToday } from "./lib/onboarding";

const kind = v.union(v.literal("pan"), v.literal("gst"));
const example = "EKRPR1234F"; // Surepass's published example; never an applicant input.
export const reserve = internalMutation({
  args: { kind },
  returns: v.null(),
  handler: async (ctx, args) => {
    if (!surepassExampleEnv()) throw new ConvexError("CHECK_UNAVAILABLE");
    const quota = await ctx.db
      .query("identityCheckDays")
      .withIndex("by_day", (q) => q.eq("day", indiaToday()))
      .unique();
    if (args.kind === "pan" ? quota?.examplePan : quota?.exampleGst)
      throw new ConvexError("CHECK_LIMIT");
    const day = await spendIdentityAttempt(ctx);
    const updated = await ctx.db
      .query("identityCheckDays")
      .withIndex("by_day", (q) => q.eq("day", day))
      .unique();
    if (!updated) throw new ConvexError("CHECK_LIMIT");
    await ctx.db.patch(
      "identityCheckDays",
      updated._id,
      args.kind === "pan" ? { examplePan: true } : { exampleGst: true },
    );
    await ctx.db.insert("auditLog", {
      action: "identity.operator_example",
      entityTable: "identityCheckDays",
      entityId: updated._id,
      metadata: { kind: args.kind },
      createdAt: Date.now(),
    });
    return null;
  },
});
/** Internal, temporarily enabled, one documented example/kind/day; no applicant proof. */
export const run = internalAction({
  args: { kind },
  returns: v.object({
    httpStatus: v.number(),
    available: v.boolean(),
    verified: v.boolean(),
  }),
  handler: async (
    ctx,
    args,
  ): Promise<{ httpStatus: number; available: boolean; verified: boolean }> => {
    const config = surepassExampleEnv();
    if (!config) throw new ConvexError("CHECK_UNAVAILABLE");
    await ctx.runMutation(internal.identityExample.reserve, args);
    try {
      const path =
        args.kind === "pan"
          ? "pan/pan-comprehensive"
          : "corporate/gstin-by-pan";
      const response = await fetch(
        `https://kyc-api.surepass.app/api/v1/${path}`,
        {
          method: "POST",
          redirect: "error",
          headers: {
            Authorization: `Bearer ${config.token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(
            args.kind === "pan"
              ? { id_number: example, masked_aadhaar_variant: "empty" }
              : { id_number: example },
          ),
          signal: AbortSignal.timeout(15_000),
        },
      );
      const payload: unknown = await response.json();
      return {
        httpStatus: response.status,
        available: response.ok,
        verified:
          args.kind === "pan" && providerVerified(payload, "pan", example),
      };
    } catch {
      return { httpStatus: 0, available: false, verified: false };
    }
  },
});
