import { ConvexError, v } from "convex/values";

import { surepassEnv } from "../src/lib/env";
import { internal } from "./_generated/api";
import { action, internalMutation } from "./_generated/server";
import { requireUser } from "./lib/access";
import { requireEditableApplication } from "./lib/applicationAccess";
import {
  CHECK_TTL,
  DAILY_CHECK_LIMIT,
  identityInputs,
  providerVerified,
} from "./lib/identityChecks";
import { indiaToday } from "./lib/onboarding";

const endpoints = {
  pan: "pan/pan-comprehensive",
  gst: "corporate/gstin-by-pan",
};

const kind = v.union(v.literal("pan"), v.literal("gst"));
export const reserve = internalMutation({
  args: { applicationId: v.optional(v.id("applications")), kind },
  returns: v.union(
    v.null(),
    v.object({ id: v.id("identityChecks"), input: v.string() }),
  ),
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    if (!user.phoneNumber || !user.phoneNumberVerified)
      throw new ConvexError("PHONE_REQUIRED");
    const { application, profile } = await requireEditableApplication(
      ctx,
      args.applicationId,
    );
    const checks = identityInputs(
      application.kabadiwala ?? application.business,
    );
    const check = checks.find((entry) => entry.kind === args.kind);
    if (!check) return null;
    const now = Date.now();
    const previous = await ctx.db
      .query("identityChecks")
      .withIndex("by_application_kind", (q) =>
        q.eq("applicationId", application._id).eq("kind", args.kind),
      )
      .unique();
    if (previous && previous.expiresAt > now && previous.status === "pending")
      throw new ConvexError("CHECK_PENDING");
    if (
      previous &&
      previous.createdAt + 60_000 > now &&
      previous.status === "failed"
    )
      throw new ConvexError("CHECK_PENDING");
    if (
      previous?.input === check.input &&
      previous.expiresAt > now &&
      previous.status === "verified"
    )
      return null;
    const env = surepassEnv();
    if (!env) throw new ConvexError("CHECK_UNAVAILABLE");
    const day = indiaToday();
    const quota = await ctx.db
      .query("identityCheckDays")
      .withIndex("by_day", (q) => q.eq("day", day))
      .unique();
    if (
      quota &&
      (!Number.isSafeInteger(quota.used) ||
        quota.used < 0 ||
        quota.used >= DAILY_CHECK_LIMIT)
    )
      throw new ConvexError("CHECK_LIMIT");
    if (quota)
      await ctx.db.patch("identityCheckDays", quota._id, {
        used: quota.used + 1,
      });
    else await ctx.db.insert("identityCheckDays", { day, used: 1 });
    const value = {
      applicationId: application._id,
      kind: args.kind,
      input: check.input,
      status: "pending" as const,
      createdAt: now,
      expiresAt: now + CHECK_TTL,
    };
    const id = previous
      ? previous._id
      : await ctx.db.insert("identityChecks", value);
    if (previous) await ctx.db.replace("identityChecks", id, value);
    await ctx.db.insert("auditLog", {
      action: "identity.check_reserved",
      entityTable: "applications",
      entityId: application._id,
      actorProfileId: profile._id,
      metadata: { kind: args.kind },
      createdAt: now,
    });
    return { id, input: check.input };
  },
});

export const finish = internalMutation({
  args: {
    id: v.id("identityChecks"),
    input: v.string(),
    verified: v.boolean(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const row = await ctx.db.get("identityChecks", args.id);
    if (row?.input !== args.input || row.status !== "pending")
      throw new ConvexError("CHECK_PENDING");
    await ctx.db.patch("identityChecks", row._id, {
      status: args.verified ? "verified" : "failed",
    });
    await ctx.db.insert("auditLog", {
      action: "identity.check_finished",
      entityTable: "applications",
      entityId: row.applicationId,
      metadata: { kind: row.kind, verified: args.verified },
      createdAt: Date.now(),
    });
    return null;
  },
});

export const verify = action({
  args: {
    applicationId: v.id("applications"),
    consent: v.literal(true),
  },
  returns: v.null(),
  handler: async (ctx, args): Promise<null> => {
    for (const checkKind of ["pan", "gst"] as const) {
      const reserved = await ctx.runMutation(internal.identityChecks.reserve, {
        applicationId: args.applicationId,
        kind: checkKind,
      });
      if (!reserved) continue;
      let isVerified = false;
      let isAvailable = false;
      try {
        const response = await fetch(
          `https://kyc-api.surepass.app/api/v1/${endpoints[checkKind]}`,
          {
            method: "POST",
            redirect: "error",
            headers: {
              Authorization: `Bearer ${surepassEnv()?.token ?? ""}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify(
              checkKind === "pan"
                ? { id_number: reserved.input, masked_aadhaar_variant: "empty" }
                : { id_number: reserved.input.slice(2, 12) },
            ),
            signal: AbortSignal.timeout(15_000),
          },
        );
        isAvailable = response.ok;
        if (response.ok)
          isVerified = providerVerified(
            await response.json(),
            checkKind,
            reserved.input,
          );
      } catch {
        /* The reservation stays spent after any transport failure. */
      }
      await ctx.runMutation(internal.identityChecks.finish, {
        ...reserved,
        verified: isVerified,
      });
      if (!isVerified)
        throw new ConvexError(
          isAvailable ? "VALIDATION_REQUIRED" : "CHECK_UNAVAILABLE",
        );
    }
    return null;
  },
});
