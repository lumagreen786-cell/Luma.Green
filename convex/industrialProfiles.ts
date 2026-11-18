import { ConvexError, v } from "convex/values";

import type { Doc } from "./_generated/dataModel";
import { mutation, query } from "./_generated/server";
import {
  registrationDates,
  registrationDateStatus,
  vIndustryActivitySnapshot,
  vProcessKind,
  vRegistrationKind,
  vSectorSnapshot,
} from "./lib/industrialClassification";
import { getIndustrySector } from "./lib/industryReference";
import { optionalReference, requiredLabel } from "./lib/lotEvidence";
import {
  getNationalIndustry,
  NATIONAL_INDUSTRY_SOURCE,
} from "./lib/nationalIndustries";
import { requireOrg } from "./lib/workspace";

export const mine = query({
  args: {},
  returns: v.array(
    v.object({
      _id: v.id("industrialFacilities"),
      name: v.string(),
      siteReference: v.string(),
      sectorId: v.optional(v.string()),
      sector: v.optional(vSectorSnapshot),
      industryActivity: v.optional(vIndustryActivitySnapshot),
      capabilities: v.array(vProcessKind),
      createdAt: v.number(),
      updatedAt: v.number(),
    }),
  ),
  handler: async (ctx) => {
    const { org } = await requireOrg(ctx, undefined, "read");
    const rows = await ctx.db
      .query("industrialFacilities")
      .withIndex("by_org_created", (q) => q.eq("orgId", org._id))
      .take(100);
    return rows.map(
      ({
        _id,
        name,
        siteReference,
        sectorId,
        sector,
        industryActivity,
        capabilities,
        createdAt,
        updatedAt,
      }) => ({
        _id,
        name,
        siteReference,
        sectorId,
        sector,
        industryActivity,
        capabilities,
        createdAt,
        updatedAt,
      }),
    );
  },
});

function nextRevision(previous: number | undefined) {
  const revision = (previous ?? 0) + 1;
  if (!Number.isSafeInteger(revision))
    throw new ConvexError("FACILITY_REVISION_LIMIT");
  return revision;
}

function resolveIndustryActivity(
  code: string | null | undefined,
  current: Doc<"industrialFacilities">["industryActivity"],
) {
  if (code === undefined) return current;
  if (code === null) return;
  const activity = getNationalIndustry(code);
  if (activity?.level !== "subclass") throw new ConvexError("SECTOR_NOT_FOUND");
  return {
    code: activity.code,
    title: activity.title,
    sourceVersion: "NIC-2025" as const,
    sourceQuality: "official_reference" as const,
    workbookSha256: NATIONAL_INDUSTRY_SOURCE.workbookSha256,
    pdfSha256: NATIONAL_INDUSTRY_SOURCE.pdfSha256,
  };
}

export const save = mutation({
  args: {
    facilityId: v.optional(v.id("industrialFacilities")),
    name: v.string(),
    siteReference: v.string(),
    sectorId: v.optional(v.string()),
    industryActivityCode: v.optional(v.union(v.string(), v.null())),
    capabilities: v.array(vProcessKind),
  },
  returns: v.id("industrialFacilities"),
  handler: async (ctx, args) => {
    const { org, profile } = await requireOrg(ctx, undefined, "manage");
    const existing = args.facilityId
      ? await ctx.db.get("industrialFacilities", args.facilityId)
      : null;
    if (args.facilityId && existing?.orgId !== org._id)
      throw new ConvexError("FACILITY_NOT_FOUND");
    const name = requiredLabel(args.name);
    const siteReference = optionalReference(args.siteReference);
    if (!siteReference) throw new ConvexError("INVALID_REFERENCE");
    const capabilities = [...new Set(args.capabilities)];
    if (capabilities.length === 0 || args.capabilities.length > 10)
      throw new ConvexError("INVALID_CAPABILITIES");
    const reference = args.sectorId
      ? getIndustrySector(args.sectorId)
      : undefined;
    const sector = reference
      ? {
          id: reference.id,
          code: reference.code,
          name: reference.name,
          category: reference.category,
          annexure: reference.annexure,
          workbookSha256: reference.workbookSha256,
          sheet: reference.sheet,
          row: reference.row,
          sourceQuality: "workbook_unverified" as const,
        }
      : undefined;
    if (!sector && args.sectorId) throw new ConvexError("SECTOR_NOT_FOUND");
    const industryActivity = resolveIndustryActivity(
      args.industryActivityCode,
      existing?.industryActivity,
    );
    if (!existing) {
      const rows = await ctx.db
        .query("industrialFacilities")
        .withIndex("by_org_created", (q) => q.eq("orgId", org._id))
        .take(100);
      if (rows.length >= 100) throw new ConvexError("FACILITY_LIMIT_REACHED");
    }
    const now = Date.now();
    const fields = {
      revision: nextRevision(existing?.revision),
      name,
      siteReference,
      sectorId: sector?.id,
      sector: sector ?? undefined,
      industryActivity,
      capabilities,
      updatedByProfileId: profile._id,
      updatedAt: now,
    };
    const id =
      existing?._id ??
      (await ctx.db.insert("industrialFacilities", {
        orgId: org._id,
        ...fields,
        createdByProfileId: profile._id,
        createdAt: now,
      }));
    if (existing) await ctx.db.patch("industrialFacilities", id, fields);
    await ctx.db.insert("auditLog", {
      orgId: org._id,
      actorProfileId: profile._id,
      action: existing
        ? "industrial_facility.updated"
        : "industrial_facility.declared",
      entityTable: "industrialFacilities",
      entityId: id,
      metadata: {
        before: existing
          ? {
              name: existing.name,
              siteReference: existing.siteReference,
              sectorId: existing.sectorId,
              industryActivity: existing.industryActivity,
              capabilities: existing.capabilities,
            }
          : null,
        after: {
          name,
          siteReference,
          sectorId: sector?.id,
          industryActivity,
          capabilities,
        },
        scope: "self_declared",
      },
      createdAt: now,
    });
    return id;
  },
});

/** Documents are reported references, not independently verified registrations. */
export const recordRegistration = mutation({
  args: {
    facilityId: v.id("industrialFacilities"),
    kind: vRegistrationKind,
    reference: v.string(),
    issuedAt: v.string(),
    validUntil: v.string(),
    supersedesId: v.optional(v.id("facilityRegistrations")),
  },
  returns: v.id("facilityRegistrations"),
  handler: async (ctx, args) => {
    const { org, profile } = await requireOrg(ctx);
    const facility = await ctx.db.get("industrialFacilities", args.facilityId);
    if (facility?.orgId !== org._id)
      throw new ConvexError("FACILITY_NOT_FOUND");
    registrationDates(args.issuedAt, args.validUntil);
    const reference = optionalReference(args.reference);
    if (!reference) throw new ConvexError("INVALID_REFERENCE");
    if (args.supersedesId) {
      const previous = await ctx.db.get(
        "facilityRegistrations",
        args.supersedesId,
      );
      if (
        previous?.facilityId !== facility._id ||
        previous.orgId !== org._id ||
        previous.kind !== args.kind
      )
        throw new ConvexError("REGISTRATION_NOT_FOUND");
      const successor = await ctx.db
        .query("facilityRegistrations")
        .withIndex("by_supersedes", (q) =>
          q.eq("supersedesId", args.supersedesId),
        )
        .first();
      if (successor) throw new ConvexError("REGISTRATION_ALREADY_SUPERSEDED");
    }
    const now = Date.now();
    const id = await ctx.db.insert("facilityRegistrations", {
      ...args,
      reference,
      orgId: org._id,
      actorProfileId: profile._id,
      recordedAt: now,
      sourceQuality: "reported_unverified",
    });
    await ctx.db.insert("auditLog", {
      orgId: org._id,
      actorProfileId: profile._id,
      action: "facility_registration.recorded",
      entityTable: "facilityRegistrations",
      entityId: id,
      metadata: {
        facilityId: facility._id,
        kind: args.kind,
        supersedesId: args.supersedesId,
        sourceQuality: "reported_unverified",
      },
      createdAt: now,
    });
    return id;
  },
});

export const registrations = query({
  args: { facilityId: v.id("industrialFacilities") },
  returns: v.object({
    rows: v.array(
      v.object({
        id: v.id("facilityRegistrations"),
        kind: vRegistrationKind,
        reference: v.string(),
        issuedAt: v.string(),
        validUntil: v.string(),
        supersedesId: v.optional(v.id("facilityRegistrations")),
        supersededById: v.optional(v.id("facilityRegistrations")),
        recordedAt: v.number(),
        dateStatus: v.union(
          v.literal("current"),
          v.literal("expired"),
          v.literal("not_yet_current"),
        ),
        sourceQuality: v.literal("reported_unverified"),
      }),
    ),
    hasMore: v.boolean(),
  }),
  handler: async (ctx, args) => {
    const { org } = await requireOrg(ctx, undefined, "read");
    const facility = await ctx.db.get("industrialFacilities", args.facilityId);
    if (facility?.orgId !== org._id)
      throw new ConvexError("FACILITY_NOT_FOUND");
    const rows = await ctx.db
      .query("facilityRegistrations")
      .withIndex("by_facility_recorded", (q) =>
        q.eq("facilityId", facility._id),
      )
      .order("desc")
      .take(101);
    return {
      rows: await Promise.all(
        rows.slice(0, 100).map(async (row) => {
          const successor = await ctx.db
            .query("facilityRegistrations")
            .withIndex("by_supersedes", (q) => q.eq("supersedesId", row._id))
            .first();
          return {
            id: row._id,
            kind: row.kind,
            reference: row.reference,
            issuedAt: row.issuedAt,
            validUntil: row.validUntil,
            supersedesId: row.supersedesId,
            supersededById: successor?._id,
            recordedAt: row.recordedAt,
            dateStatus: registrationDateStatus(
              row.issuedAt,
              row.validUntil,
              Date.now(),
            ),
            sourceQuality: row.sourceQuality,
          };
        }),
      ),
      hasMore: rows.length > 100,
    };
  },
});
