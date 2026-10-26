import { ConvexError, v } from "convex/values";

import { surepassEnv } from "../src/lib/env";
import { internal } from "./_generated/api";
import type { Doc } from "./_generated/dataModel";
import {
  action,
  internalMutation,
  internalQuery,
  mutation,
  query,
  type QueryCtx,
} from "./_generated/server";
import { requireUser } from "./lib/access";
import { requireEditableApplication } from "./lib/applicationAccess";
import { spendIdentityAttempt } from "./lib/identityCheckQuota";
import { CHECK_TTL, normalizeId } from "./lib/identityChecks";
import {
  discoveryValidator,
  registrationsFrom,
  registrationValidator,
} from "./lib/identityDiscovery";
import { isEditable } from "./lib/lifecycle";
async function eligible(
  ctx: QueryCtx,
  applicationId: Doc<"applications">["_id"],
) {
  const user = await requireUser(ctx);
  if (!user.phoneNumber || !user.phoneNumberVerified)
    throw new ConvexError("PHONE_REQUIRED");
  const owned = await requireEditableApplication(ctx, applicationId);
  const app = owned.application;
  const draft = app.kabadiwala ?? app.business;
  if (
    !["kabadiwala", "yard", "recycler", "manufacturer"].includes(app.kind) ||
    !draft?.gstRegistered
  )
    throw new ConvexError("VALIDATION_REQUIRED");
  const input = normalizeId(draft.pan);
  return { ...owned, draft, input };
}
function proof(row: Doc<"identityChecks"> | null, pan: string) {
  return row?.provider === "gstin_by_pan" &&
    row.status === "verified" &&
    row.input === pan &&
    row.expiresAt > Date.now() &&
    row.registrations
    ? { pan, registrations: row.registrations }
    : null;
}
async function rowFor(
  ctx: QueryCtx,
  applicationId: Doc<"applications">["_id"],
) {
  return ctx.db
    .query("identityChecks")
    .withIndex("by_application_kind", (q) =>
      q.eq("applicationId", applicationId).eq("kind", "pan"),
    )
    .unique();
}
export const current = query({
  args: { applicationId: v.id("applications") },
  returns: v.union(v.null(), discoveryValidator),
  handler: async (ctx, args) => {
    const { input } = await eligible(ctx, args.applicationId);
    return proof(await rowFor(ctx, args.applicationId), input);
  },
});
export const reserve = internalMutation({
  args: { applicationId: v.id("applications") },
  returns: v.object({
    id: v.id("identityChecks"),
    input: v.string(),
    createdAt: v.number(),
    cached: v.optional(discoveryValidator),
  }),
  handler: async (ctx, args) => {
    const { application, profile, input } = await eligible(
      ctx,
      args.applicationId,
    );
    if (!/^[A-Z]{5}\d{4}[A-Z]$/.test(input))
      throw new ConvexError("VALIDATION_REQUIRED");
    const previous = await rowFor(ctx, application._id);
    const now = Date.now();
    if (
      previous &&
      ((previous.status === "pending" && previous.expiresAt > now) ||
        (previous.status === "failed" && previous.createdAt + 60_000 > now))
    )
      throw new ConvexError("CHECK_PENDING");
    const cached = proof(previous, input);
    if (previous && cached)
      return { id: previous._id, input, createdAt: previous.createdAt, cached };
    if (!surepassEnv()) throw new ConvexError("CHECK_UNAVAILABLE");
    await spendIdentityAttempt(ctx, profile._id);
    if (!application.panDiscoveryRequired)
      await ctx.db.patch("applications", application._id, {
        panDiscoveryRequired: true,
      });
    const value = {
      applicationId: application._id,
      kind: "pan" as const,
      provider: "gstin_by_pan" as const,
      input,
      status: "pending" as const,
      createdAt: now,
      expiresAt: now + CHECK_TTL,
    };
    const id = previous?._id ?? (await ctx.db.insert("identityChecks", value));
    if (previous) await ctx.db.replace("identityChecks", id, value);
    await ctx.db.insert("auditLog", {
      action: "identity.discovery_reserved",
      entityTable: "applications",
      entityId: application._id,
      actorProfileId: profile._id,
      metadata: { provider: "gstin_by_pan" },
      createdAt: now,
    });
    return { id, input, createdAt: now };
  },
});
function matchesSavedDraft(
  application: Doc<"applications"> | null,
  input: string,
) {
  if (!application || !isEditable(application.status)) return false;
  const draft = application.kabadiwala ?? application.business;
  return (
    ["kabadiwala", "yard", "recycler", "manufacturer"].includes(
      application.kind,
    ) &&
    draft?.gstRegistered === true &&
    normalizeId(draft.pan) === input
  );
}

export const finish = internalMutation({
  args: {
    id: v.id("identityChecks"),
    input: v.string(),
    createdAt: v.number(),
    registrations: v.union(v.null(), v.array(registrationValidator)),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const row = await ctx.db.get("identityChecks", args.id);
    if (
      row?.provider !== "gstin_by_pan" ||
      row.input !== args.input ||
      row.createdAt !== args.createdAt ||
      row.status !== "pending"
    )
      throw new ConvexError("CHECK_PENDING");
    // A trusted completion must settle its reservation even if the applicant
    // changed the draft or its status while the provider was responding.
    const application = await ctx.db.get("applications", row.applicationId);
    const canComplete = matchesSavedDraft(application, args.input);
    const isVerified = canComplete && (args.registrations?.length ?? 0) > 0;
    await ctx.db.patch("identityChecks", row._id, {
      status: isVerified ? "verified" : "failed",
      ...(isVerified &&
        args.registrations && { registrations: args.registrations }),
    });
    await ctx.db.insert("auditLog", {
      action: "identity.discovery_finished",
      entityTable: "applications",
      entityId: row.applicationId,
      metadata: {
        provider: "gstin_by_pan",
        verified: isVerified,
      },
      createdAt: Date.now(),
    });
    return null;
  },
});
export const lookup = action({
  args: { applicationId: v.id("applications"), consent: v.literal(true) },
  returns: discoveryValidator,
  handler: async (
    ctx,
    args,
  ): Promise<{
    pan: string;
    registrations: NonNullable<ReturnType<typeof registrationsFrom>>;
  }> => {
    const reserved = await ctx.runMutation(internal.identityDiscovery.reserve, {
      applicationId: args.applicationId,
    });
    if (reserved.cached) return reserved.cached;
    let registrations: ReturnType<typeof registrationsFrom> = null;
    let isAvailable = false;
    try {
      const response = await fetch(
        "https://kyc-api.surepass.app/api/v1/corporate/gstin-by-pan",
        {
          method: "POST",
          redirect: "error",
          headers: {
            Authorization: `Bearer ${surepassEnv()?.token ?? ""}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ id_number: reserved.input }),
          signal: AbortSignal.timeout(15_000),
        },
      );
      isAvailable = [200, 400, 422].includes(response.status);
      if (response.ok)
        registrations = registrationsFrom(
          await response.json(),
          reserved.input,
        );
    } catch {
      /* Failed attempts remain spent; no automatic retries. */
    }
    await ctx.runMutation(internal.identityDiscovery.finish, {
      id: reserved.id,
      input: reserved.input,
      createdAt: reserved.createdAt,
      registrations,
    });
    if (!registrations)
      throw new ConvexError(
        isAvailable ? "VALIDATION_REQUIRED" : "CHECK_UNAVAILABLE",
      );
    // Recheck the owned draft after transport so a late response cannot expose old data.
    const current = await ctx.runQuery(internal.identityDiscovery.result, {
      applicationId: args.applicationId,
    });
    if (registrations.length === 0) {
      const input = await ctx.runQuery(internal.identityDiscovery.savedPan, {
        applicationId: args.applicationId,
      });
      if (input !== reserved.input)
        throw new ConvexError("VALIDATION_REQUIRED");
      return { pan: input, registrations: [] };
    }
    if (current?.pan !== reserved.input)
      throw new ConvexError("VALIDATION_REQUIRED");
    return current;
  },
});
export const result = internalQuery({
  args: { applicationId: v.id("applications") },
  returns: v.union(v.null(), discoveryValidator),
  handler: async (ctx, args) => {
    const { input } = await eligible(ctx, args.applicationId);
    return proof(await rowFor(ctx, args.applicationId), input);
  },
});
export const select = mutation({
  args: { applicationId: v.id("applications"), gstin: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { application, input, draft, profile } = await eligible(
      ctx,
      args.applicationId,
    );
    const current = proof(await rowFor(ctx, application._id), input);
    if (
      !current?.registrations.some(
        (r) => r.gstin === args.gstin && r.status === "Active",
      )
    )
      throw new ConvexError("VALIDATION_REQUIRED");
    const discovery = await rowFor(ctx, application._id);
    if (!discovery) throw new ConvexError("VALIDATION_REQUIRED");
    await ctx.db.patch("identityChecks", discovery._id, {
      selectedGstin: args.gstin,
    });
    const section = application.kabadiwala ? "kabadiwala" : "business";
    await ctx.db.patch("applications", application._id, {
      [section]: { ...draft, gstin: args.gstin },
      updatedAt: Date.now(),
    });
    const detail = await ctx.db
      .query("identityChecks")
      .withIndex("by_application_kind", (q) =>
        q.eq("applicationId", application._id).eq("kind", "gst"),
      )
      .unique();
    if (detail)
      await ctx.db.patch("identityChecks", detail._id, {
        confirmedAt: undefined,
      });
    await ctx.db.insert("auditLog", {
      action: "identity.registration_selected",
      entityTable: "applications",
      entityId: application._id,
      actorProfileId: profile._id,
      metadata: { provider: "gstin_by_pan" },
      createdAt: Date.now(),
    });
    return null;
  },
});

export const savedPan = internalQuery({
  args: { applicationId: v.id("applications") },
  returns: v.string(),
  handler: async (ctx, args) => {
    const owned = await eligible(ctx, args.applicationId);
    return owned.input;
  },
});
