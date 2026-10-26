import { ConvexError, v } from "convex/values";

import { surepassEnv } from "../src/lib/env";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import {
  action,
  type ActionCtx,
  internalMutation,
  mutation,
  query,
  type QueryCtx,
} from "./_generated/server";
import { requireUser } from "./lib/access";
import {
  ownApplication,
  requireApplicationParent,
  requireEditableApplication,
  requireMember,
} from "./lib/applicationAccess";
import { spendIdentityAttempt } from "./lib/identityCheckQuota";
import {
  CHECK_TTL,
  gstBusiness,
  identityInputs,
  normalizeId,
} from "./lib/identityChecks";
import { requirePanSelection } from "./lib/identityDiscovery";

const fields = {
  gstin: v.string(),
  businessName: v.string(),
  legalName: v.string(),
  address: v.string(),
};
const detailsValidator = v.object(fields);
type Details = NonNullable<ReturnType<typeof gstBusiness>>;
interface Reservation {
  id: Id<"identityChecks">;
  input: string;
  createdAt: number;
  details?: Details;
}

async function requirePhone(ctx: QueryCtx) {
  const user = await requireUser(ctx);
  if (!user.phoneNumber || !user.phoneNumberVerified)
    throw new ConvexError("PHONE_REQUIRED");
}

function detailsFrom(row: Doc<"identityChecks"> | null): Details | null {
  if (
    row?.provider !== "gstin" ||
    row.status !== "verified" ||
    row.expiresAt <= Date.now() ||
    !row.businessName ||
    row.legalName === undefined ||
    row.address === undefined
  )
    return null;
  return {
    gstin: row.input,
    businessName: row.businessName,
    legalName: row.legalName,
    address: row.address,
  };
}

/** Reloading a form reuses its owned, current proof without a paid request. */
export const gst = query({
  args: { applicationId: v.id("applications") },
  returns: v.union(v.null(), v.object({ ...fields, confirmed: v.boolean() })),
  handler: async (ctx, args) => {
    await requirePhone(ctx);
    const profile = await requireMember(ctx);
    const application = await ownApplication(
      ctx,
      profile._id,
      args.applicationId,
    );
    if (!application) throw new ConvexError("NO_APPLICATION");
    await requireApplicationParent(ctx, application);
    const draft = application.kabadiwala ?? application.business;
    const input = draft?.gstRegistered ? normalizeId(draft.gstin) : "";
    const row = await ctx.db
      .query("identityChecks")
      .withIndex("by_application_kind", (q) =>
        q.eq("applicationId", application._id).eq("kind", "gst"),
      )
      .unique();
    const details = detailsFrom(row);
    return details?.gstin === input
      ? { ...details, confirmed: row?.confirmedAt !== undefined }
      : null;
  },
});

export const reserve = internalMutation({
  args: {
    applicationId: v.optional(v.id("applications")),
    kind: v.union(v.literal("pan"), v.literal("gst")),
  },
  returns: v.union(
    v.null(),
    v.object({
      id: v.id("identityChecks"),
      input: v.string(),
      createdAt: v.number(),
      details: v.optional(detailsValidator),
    }),
  ),
  handler: async (ctx, args): Promise<Reservation | null> => {
    await requirePhone(ctx);
    const { application, profile } = await requireEditableApplication(
      ctx,
      args.applicationId,
    );
    await requirePanSelection(ctx, application);
    // Old clients may still request PAN. Never send or spend for this retired field.
    if (args.kind === "pan") return null;
    const check = identityInputs(
      application.kabadiwala ?? application.business,
    ).at(0);
    if (!check) return null;
    const now = Date.now();
    const previous = await ctx.db
      .query("identityChecks")
      .withIndex("by_application_kind", (q) =>
        q.eq("applicationId", application._id).eq("kind", "gst"),
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
    const cached = detailsFrom(previous);
    if (previous && cached && previous.input === check.input)
      return {
        id: previous._id,
        input: previous.input,
        createdAt: previous.createdAt,
        details: cached,
      };
    if (!surepassEnv()) throw new ConvexError("CHECK_UNAVAILABLE");
    await spendIdentityAttempt(ctx, profile._id);
    const value = {
      applicationId: application._id,
      kind: "gst" as const,
      input: check.input,
      status: "pending" as const,
      provider: "gstin" as const,
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
      metadata: { kind: "gst", provider: "gstin" },
      createdAt: now,
    });
    return { id, input: check.input, createdAt: now };
  },
});

export const finish = internalMutation({
  args: {
    id: v.id("identityChecks"),
    input: v.string(),
    createdAt: v.number(),
    details: v.union(v.null(), detailsValidator),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const row = await ctx.db.get("identityChecks", args.id);
    if (
      row?.input !== args.input ||
      row.status !== "pending" ||
      row.createdAt !== args.createdAt ||
      row.provider !== "gstin"
    )
      throw new ConvexError("CHECK_PENDING");
    if (args.details && args.details.gstin !== args.input)
      throw new ConvexError("VALIDATION_REQUIRED");
    await ctx.db.patch("identityChecks", row._id, {
      status: args.details ? "verified" : "failed",
      businessName: args.details?.businessName,
      legalName: args.details?.legalName,
      address: args.details?.address,
    });
    await ctx.db.insert("auditLog", {
      action: "identity.check_finished",
      entityTable: "applications",
      entityId: row.applicationId,
      metadata: {
        kind: "gst",
        verified: args.details !== null,
        provider: "gstin",
      },
      createdAt: Date.now(),
    });
    return null;
  },
});

async function lookup(
  ctx: ActionCtx,
  applicationId: Id<"applications">,
): Promise<Details | null> {
  const reserved = await ctx.runMutation(internal.identityChecks.reserve, {
    applicationId,
    kind: "gst",
  });
  if (!reserved) return null;
  if (reserved.details) return reserved.details;
  let details: Details | null = null;
  let isAvailable = false;
  try {
    const response = await fetch(
      "https://kyc-api.surepass.app/api/v1/corporate/gstin-advanced",
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
      details = gstBusiness(await response.json(), reserved.input);
  } catch {
    // Every failed attempt remains spent. The caller must choose any retry.
  }
  await ctx.runMutation(internal.identityChecks.finish, {
    id: reserved.id,
    input: reserved.input,
    createdAt: reserved.createdAt,
    details,
  });
  if (!details)
    throw new ConvexError(
      isAvailable ? "VALIDATION_REQUIRED" : "CHECK_UNAVAILABLE",
    );
  return details;
}

export const lookupGst = action({
  args: { applicationId: v.id("applications"), consent: v.literal(true) },
  returns: detailsValidator,
  handler: async (ctx, args): Promise<Details> => {
    const details = await lookup(ctx, args.applicationId);
    if (!details) throw new ConvexError("VALIDATION_REQUIRED");
    return details;
  },
});

export const confirmGst = mutation({
  args: { applicationId: v.id("applications"), gstin: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requirePhone(ctx);
    const { application, profile } = await requireEditableApplication(
      ctx,
      args.applicationId,
    );
    await requirePanSelection(ctx, application);
    const input = identityInputs(
      application.kabadiwala ?? application.business,
    )[0]?.input;
    const row = await ctx.db
      .query("identityChecks")
      .withIndex("by_application_kind", (q) =>
        q.eq("applicationId", application._id).eq("kind", "gst"),
      )
      .unique();
    const details = detailsFrom(row);
    if (
      !row ||
      !details ||
      input !== normalizeId(args.gstin) ||
      details.gstin !== input
    )
      throw new ConvexError("VALIDATION_REQUIRED");
    if (row.confirmedAt !== undefined) return null;
    const now = Date.now();
    const address =
      details.address.length >= 5 && details.address.length <= 200
        ? { address: details.address }
        : {};
    if (application.kabadiwala)
      await ctx.db.patch("applications", application._id, {
        kabadiwala: {
          ...application.kabadiwala,
          shopName: details.businessName.slice(0, 80),
          ...address,
        },
        updatedAt: now,
      });
    else if (application.business)
      await ctx.db.patch("applications", application._id, {
        business: {
          ...application.business,
          businessName: details.businessName.slice(0, 120),
          ...address,
        },
        updatedAt: now,
      });
    await ctx.db.patch("identityChecks", row._id, { confirmedAt: now });
    await ctx.db.insert("auditLog", {
      action: "identity.business_confirmed",
      entityTable: "applications",
      entityId: application._id,
      actorProfileId: profile._id,
      metadata: { provider: "gstin" },
      createdAt: now,
    });
    return null;
  },
});

/** Compatibility for an older tab: lookup never bypasses explicit confirmation. */
export const verify = action({
  args: { applicationId: v.id("applications"), consent: v.literal(true) },
  returns: v.null(),
  handler: async (ctx, args): Promise<null> => {
    await lookup(ctx, args.applicationId);
    return null;
  },
});
