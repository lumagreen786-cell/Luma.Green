import { ConvexError } from "convex/values";

import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import { requireApplicationParent } from "./applicationAccess";
import { orgDraftFrom, PILOT_CITY, saathiDraftFrom, slugify } from "./review";
import { MAX_WORKSPACES } from "./workspaceRoles";

const MAX_SLUG_TRIES = 50;
const MAX_MATERIALS = 200;

/** A slug no other business has: `name`, then `name-2`, `name-3`, … */
async function uniqueSlug(
  ctx: MutationCtx,
  name: string,
  fallback: string,
): Promise<string> {
  const base = slugify(name) || fallback;
  for (let attempt = 1; attempt <= MAX_SLUG_TRIES; attempt += 1) {
    const slug = attempt === 1 ? base : `${base}-${String(attempt)}`;
    const taken = await ctx.db
      .query("orgs")
      .withIndex("by_slug", (q) => q.eq("slug", slug))
      .first();
    if (!taken) return slug;
  }
  throw new ConvexError("SLUG_TAKEN");
}

/**
 * A new kabadiwala starts with the city's fallback price for every scrap
 * material it buys, so households see prices from day one.
 */
async function startRateCard(
  ctx: MutationCtx,
  orgId: Id<"orgs">,
  families: Doc<"orgs">["families"],
  now: number,
): Promise<number> {
  const materials = await ctx.db
    .query("materials")
    .withIndex("by_sortOrder")
    .take(MAX_MATERIALS);
  let added = 0;
  for (const material of materials) {
    const isBought =
      material.active &&
      material.stage === "scrap" &&
      families.includes(material.family);
    if (!isBought) continue;
    const reference = await ctx.db
      .query("referencePrices")
      .withIndex("by_city_material", (q) =>
        q.eq("city", PILOT_CITY).eq("materialCode", material.code),
      )
      .first();
    if (!reference) continue;
    await ctx.db.insert("rateCards", {
      orgId,
      materialCode: material.code,
      paisePerKg: reference.fallbackPaise,
      updatedAt: now,
    });
    added += 1;
  }
  return added;
}

/**
 * The business behind an approved application: its `orgs` row, the
 * applicant as owner, and a starting rate card for a kabadiwala. Approving a
 * suspended application switches its business back on instead.
 */
async function openBusiness(
  ctx: MutationCtx,
  application: Doc<"applications">,
  actorProfileId: Id<"profiles"> | undefined,
  now: number,
): Promise<Id<"orgs">> {
  await requireApplicationParent(ctx, application);
  const draft = orgDraftFrom(application);
  if (!draft) throw new ConvexError("INCOMPLETE_APPLICATION");

  // The application identifies the business even after its owner changes.
  const existing = await ctx.db
    .query("orgs")
    .withIndex("by_application", (q) => q.eq("applicationId", application._id))
    .unique();
  if (existing) {
    await ctx.db.patch("orgs", existing._id, {
      status: "active",
      updatedAt: now,
    });
    return existing._id;
  }

  const memberships = await ctx.db
    .query("memberships")
    .withIndex("by_profile", (q) => q.eq("profileId", application.profileId))
    .take(MAX_WORKSPACES);
  if (memberships.length >= MAX_WORKSPACES) throw new ConvexError("TEAM_LIMIT");
  if (application.organizationId) {
    const sites = await ctx.db
      .query("orgs")
      .withIndex("by_organization", (q) =>
        q.eq("organizationId", application.organizationId),
      )
      .take(100);
    if (sites.length >= 100) throw new ConvexError("TEAM_LIMIT");
  }
  const slug = await uniqueSlug(ctx, draft.name, draft.kind);
  const orgId = await ctx.db.insert("orgs", {
    ...draft,
    organizationId: application.organizationId,
    slug,
    status: "active",
    ownerProfileId: application.profileId,
    applicationId: application._id,
    createdAt: now,
    updatedAt: now,
  });
  await ctx.db.insert("memberships", {
    profileId: application.profileId,
    orgId,
    role: "owner",
    createdAt: now,
  });
  const rateCardItems =
    draft.kind === "kabadiwala"
      ? await startRateCard(ctx, orgId, draft.families, now)
      : 0;
  await ctx.db.insert("auditLog", {
    orgId,
    actorProfileId,
    action: "org.created",
    entityTable: "orgs",
    entityId: orgId,
    metadata: {
      applicationId: application._id,
      kind: draft.kind,
      slug,
      rateCardItems,
    },
    createdAt: now,
  });
  return orgId;
}

/** The Saathi profile behind an approved Saathi application. */
async function openSaathi(
  ctx: MutationCtx,
  application: Doc<"applications">,
  actorProfileId: Id<"profiles"> | undefined,
  now: number,
): Promise<Id<"saathiProfiles">> {
  const draft = saathiDraftFrom(application);
  if (!draft) throw new ConvexError("INCOMPLETE_APPLICATION");

  const existing = await ctx.db
    .query("saathiProfiles")
    .withIndex("by_profile", (q) => q.eq("profileId", application.profileId))
    .unique();
  if (existing) {
    await ctx.db.patch("saathiProfiles", existing._id, { status: "active" });
    return existing._id;
  }

  const saathiProfileId = await ctx.db.insert("saathiProfiles", {
    ...draft,
    profileId: application.profileId,
    applicationId: application._id,
    status: "active",
    createdAt: now,
  });
  await ctx.db.insert("auditLog", {
    actorProfileId,
    action: "saathi.created",
    entityTable: "saathiProfiles",
    entityId: saathiProfileId,
    metadata: { applicationId: application._id },
    createdAt: now,
  });
  return saathiProfileId;
}

/** One provisioning owner for automatic onboarding and existing admin recovery. */
export async function activateApplication(
  ctx: MutationCtx,
  application: Doc<"applications">,
  actorProfileId: Id<"profiles"> | undefined,
  now: number,
): Promise<{ orgId?: Id<"orgs">; saathiProfileId?: Id<"saathiProfiles"> }> {
  return application.kind === "saathi"
    ? {
        saathiProfileId: await openSaathi(
          ctx,
          application,
          actorProfileId,
          now,
        ),
      }
    : { orgId: await openBusiness(ctx, application, actorProfileId, now) };
}
