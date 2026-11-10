import { ConvexError, v } from "convex/values";

import type { Id } from "./_generated/dataModel";
import { mutation, query } from "./_generated/server";
import { requireAdmin } from "./lib/access";
import {
  registrationDates,
  vProcessKind,
} from "./lib/industrialClassification";
import { requiredLabel } from "./lib/lotEvidence";
import { isOrdinaryMaterial } from "./lib/materialEligibility";
import { indiaToday } from "./lib/onboarding";
import { requireOrg } from "./lib/workspace";

function reference(value: string) {
  const text = value.trim();
  if (text.length < 3 || text.length > 500)
    throw new ConvexError("INVALID_REFERENCE");
  return text;
}
const reviewView = v.object({
  id: v.id("facilityScopeReviews"),
  facilityId: v.id("industrialFacilities"),
  registrationId: v.id("facilityRegistrations"),
  materialCodes: v.array(v.string()),
  processes: v.array(vProcessKind),
  decision: v.union(
    v.literal("approved"),
    v.literal("rejected"),
    v.literal("revoked"),
  ),
  evidenceReference: v.string(),
  validUntil: v.string(),
  createdAt: v.number(),
  current: v.boolean(),
  ordinaryTradeCustody: v.optional(v.literal(true)),
});
const destinationView = v.object({
  id: v.id("controlledDestinations"),
  name: v.string(),
  siteReference: v.string(),
  materialCodes: v.array(v.string()),
  processes: v.array(vProcessKind),
  authorisationReference: v.string(),
  validUntil: v.string(),
  active: v.boolean(),
  effective: v.boolean(),
});
export const queue = query({
  args: {},
  returns: v.object({
    facilities: v.array(
      v.object({
        id: v.id("industrialFacilities"),
        name: v.string(),
        organisation: v.string(),
        capabilities: v.array(vProcessKind),
        registrations: v.array(
          v.object({
            id: v.id("facilityRegistrations"),
            reference: v.string(),
            kind: v.string(),
            validUntil: v.string(),
            current: v.boolean(),
          }),
        ),
        reviews: v.array(reviewView),
      }),
    ),
    truncated: v.boolean(),
  }),
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const facilities = await ctx.db
      .query("industrialFacilities")
      .withIndex("by_updated")
      .order("desc")
      .take(101);
    const result = [];
    for (const f of facilities.slice(0, 100)) {
      const org = await ctx.db.get("orgs", f.orgId);
      const registrations = await ctx.db
        .query("facilityRegistrations")
        .withIndex("by_facility_recorded", (q) => q.eq("facilityId", f._id))
        .order("desc")
        .take(50);
      const reviews = await ctx.db
        .query("facilityScopeReviews")
        .withIndex("by_facility_created", (q) => q.eq("facilityId", f._id))
        .order("desc")
        .take(20);
      const records: {
        id: Id<"facilityRegistrations">;
        reference: string;
        kind: string;
        validUntil: string;
        current: boolean;
      }[] = [];
      for (const r of registrations) {
        const successor = await ctx.db
          .query("facilityRegistrations")
          .withIndex("by_supersedes", (q) => q.eq("supersedesId", r._id))
          .first();
        records.push({
          id: r._id,
          reference: r.reference,
          kind: r.kind,
          validUntil: r.validUntil,
          current:
            !successor &&
            r.validUntil >= indiaToday() &&
            r.issuedAt <= indiaToday(),
        });
      }
      result.push({
        id: f._id,
        name: f.name,
        organisation: org?.name ?? "",
        capabilities: f.capabilities,
        registrations: records,
        reviews: reviews.map((r, index) => ({
          id: r._id,
          facilityId: r.facilityId,
          registrationId: r.registrationId,
          materialCodes: r.materialCodes,
          processes: r.processes,
          decision: r.decision,
          ...(r.ordinaryTradeCustody && {
            ordinaryTradeCustody: r.ordinaryTradeCustody,
          }),
          evidenceReference: r.evidenceReference,
          validUntil: r.validUntil,
          createdAt: r.createdAt,
          current:
            index === 0 &&
            r.decision === "approved" &&
            r.validUntil >= indiaToday() &&
            r.facilityUpdatedAt === f.updatedAt &&
            r.facilityRevision === (f.revision ?? 0) &&
            records.some((x) => x.id === r.registrationId && x.current),
        })),
      });
    }
    return { facilities: result, truncated: facilities.length > 100 };
  },
});
export const reviewFacility = mutation({
  args: {
    facilityId: v.id("industrialFacilities"),
    registrationId: v.id("facilityRegistrations"),
    materialCodes: v.array(v.string()),
    processes: v.array(vProcessKind),
    decision: v.union(
      v.literal("approved"),
      v.literal("rejected"),
      v.literal("revoked"),
    ),
    evidenceReference: v.string(),
    validUntil: v.string(),
    ordinaryTradeCustody: v.optional(v.literal(true)),
  },
  returns: v.id("facilityScopeReviews"),
  handler: async (ctx, args) => {
    const admin = await requireAdmin(ctx);
    const facility = await ctx.db.get("industrialFacilities", args.facilityId);
    const registration = await ctx.db.get(
      "facilityRegistrations",
      args.registrationId,
    );
    if (
      !facility ||
      registration?.facilityId !== facility._id ||
      registration.orgId !== facility.orgId
    )
      throw new ConvexError("REGISTRATION_NOT_FOUND");
    const materialCodes = [...new Set(args.materialCodes)];
    const processes = [...new Set(args.processes)];
    if (
      materialCodes.length === 0 ||
      materialCodes.length > 30 ||
      materialCodes.length !== args.materialCodes.length ||
      processes.length === 0 ||
      processes.length !== args.processes.length ||
      processes.some((x) => !facility.capabilities.includes(x))
    )
      throw new ConvexError("INVALID_REVIEW_SCOPE");
    if (
      args.ordinaryTradeCustody &&
      (args.decision !== "approved" ||
        registration.kind !== "consent_to_operate")
    )
      throw new ConvexError("ORDINARY_CUSTODY_REQUIRES_CONSENT");
    registrationDates(indiaToday(), args.validUntil);
    if (args.decision === "approved") {
      const successor = await ctx.db
        .query("facilityRegistrations")
        .withIndex("by_supersedes", (q) =>
          q.eq("supersedesId", registration._id),
        )
        .first();
      if (
        successor ||
        registration.issuedAt > indiaToday() ||
        registration.validUntil < args.validUntil
      )
        throw new ConvexError("REGISTRATION_NOT_CURRENT");
      const org = await ctx.db.get("orgs", facility.orgId);
      if (org?.status !== "active") throw new ConvexError("NO_BUSINESS");
      for (const code of materialCodes) {
        const material = await ctx.db
          .query("materials")
          .withIndex("by_code", (q) => q.eq("code", code))
          .unique();
        if (
          !material?.active ||
          !org.families.includes(material.family) ||
          (args.ordinaryTradeCustody && !isOrdinaryMaterial(material))
        )
          throw new ConvexError("MATERIAL_NOT_ALLOWED");
      }
    }
    const fields = {
      ...args,
      materialCodes,
      processes,
      evidenceReference: reference(args.evidenceReference),
      orgId: facility.orgId,
      facilityUpdatedAt: facility.updatedAt,
      facilityRevision: facility.revision ?? 0,
      reviewerId: admin._id,
      createdAt: Date.now(),
    };
    const id = await ctx.db.insert("facilityScopeReviews", fields);
    await ctx.db.insert("auditLog", {
      orgId: facility.orgId,
      action: "facility.scopeReviewed",
      entityTable: "facilityScopeReviews",
      entityId: id,
      metadata: {
        adminUserId: admin._id,
        decision: args.decision,
        ordinaryTradeCustody: args.ordinaryTradeCustody ?? false,
        portalAction: false,
      },
      createdAt: Date.now(),
    });
    return id;
  },
});
export const destinations = query({
  args: { admin: v.optional(v.boolean()) },
  returns: v.array(destinationView),
  handler: async (ctx, args) => {
    if (args.admin) await requireAdmin(ctx);
    else await requireOrg(ctx, undefined, "read");
    const rows = await ctx.db
      .query("controlledDestinations")
      .withIndex("by_active_updated", (q) => q.eq("active", true))
      .order("desc")
      .take(100);
    const inactive = args.admin
      ? await ctx.db
          .query("controlledDestinations")
          .withIndex("by_active_updated", (q) => q.eq("active", false))
          .order("desc")
          .take(100)
      : [];
    return [...rows, ...inactive].map(
      ({
        _id,
        name,
        siteReference,
        materialCodes,
        processes,
        authorisationReference,
        validUntil,
        active,
      }) => ({
        id: _id,
        name,
        siteReference,
        materialCodes,
        processes,
        authorisationReference,
        validUntil,
        active,
        effective: active && validUntil >= indiaToday(),
      }),
    );
  },
});
export const recordDestination = mutation({
  args: {
    name: v.string(),
    siteReference: v.string(),
    materialCodes: v.array(v.string()),
    processes: v.array(vProcessKind),
    authorisationReference: v.string(),
    validUntil: v.string(),
  },
  returns: v.id("controlledDestinations"),
  handler: async (ctx, args) => {
    const admin = await requireAdmin(ctx);
    registrationDates(indiaToday(), args.validUntil);
    const materialCodes = [
      ...new Set(args.materialCodes.map((code) => requiredLabel(code))),
    ];
    const processes = [...new Set(args.processes)];
    if (
      materialCodes.length === 0 ||
      materialCodes.length > 30 ||
      processes.length === 0 ||
      processes.length > 10
    )
      throw new ConvexError("INVALID_REVIEW_SCOPE");
    const id = await ctx.db.insert("controlledDestinations", {
      ...args,
      name: requiredLabel(args.name),
      siteReference: reference(args.siteReference),
      authorisationReference: reference(args.authorisationReference),
      materialCodes,
      processes,
      active: true,
      createdBy: admin._id,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
    await ctx.db.insert("auditLog", {
      action: "controlled_destination.recorded",
      entityTable: "controlledDestinations",
      entityId: id,
      metadata: {
        adminUserId: admin._id,
        authorisationReference: args.authorisationReference,
        portalAction: false,
      },
      createdAt: Date.now(),
    });
    return id;
  },
});
export const changeDestinationStatus = mutation({
  args: {
    id: v.id("controlledDestinations"),
    active: v.boolean(),
    reason: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const admin = await requireAdmin(ctx);
    const row = await ctx.db.get("controlledDestinations", args.id);
    if (!row) throw new ConvexError("DESTINATION_NOT_FOUND");
    const reason = reference(args.reason);
    if (args.active && row.validUntil < indiaToday())
      throw new ConvexError("DESTINATION_EXPIRED");
    await ctx.db.patch("controlledDestinations", row._id, {
      active: args.active,
      updatedAt: Date.now(),
    });
    await ctx.db.insert("controlledDestinationReviews", {
      destinationId: row._id,
      active: args.active,
      reason,
      reviewerId: admin._id,
      createdAt: Date.now(),
    });
    await ctx.db.insert("auditLog", {
      action: "controlled_destination.statusChanged",
      entityTable: "controlledDestinations",
      entityId: row._id,
      metadata: { adminUserId: admin._id, active: args.active, reason },
      createdAt: Date.now(),
    });
    return null;
  },
});

export const myReviews = query({
  args: {},
  returns: v.array(
    v.object({ facilityName: v.string(), reviews: v.array(reviewView) }),
  ),
  handler: async (ctx) => {
    const { org } = await requireOrg(ctx, undefined, "read");
    const facilities = await ctx.db
      .query("industrialFacilities")
      .withIndex("by_org_created", (q) => q.eq("orgId", org._id))
      .take(100);
    const output = [];
    for (const facility of facilities) {
      const rows = await ctx.db
        .query("facilityScopeReviews")
        .withIndex("by_facility_created", (q) =>
          q.eq("facilityId", facility._id),
        )
        .order("desc")
        .take(20);
      const reviews = [];
      for (const [index, r] of rows.entries()) {
        const registration = await ctx.db.get(
          "facilityRegistrations",
          r.registrationId,
        );
        const successor = await ctx.db
          .query("facilityRegistrations")
          .withIndex("by_supersedes", (q) =>
            q.eq("supersedesId", r.registrationId),
          )
          .first();
        reviews.push({
          id: r._id,
          facilityId: r.facilityId,
          registrationId: r.registrationId,
          materialCodes: r.materialCodes,
          processes: r.processes,
          decision: r.decision,
          ...(r.ordinaryTradeCustody && {
            ordinaryTradeCustody: r.ordinaryTradeCustody,
          }),
          evidenceReference: r.evidenceReference,
          validUntil: r.validUntil,
          createdAt: r.createdAt,
          current:
            index === 0 &&
            r.decision === "approved" &&
            r.facilityUpdatedAt === facility.updatedAt &&
            r.facilityRevision === (facility.revision ?? 0) &&
            r.validUntil >= indiaToday() &&
            Boolean(
              registration &&
              registration.issuedAt <= indiaToday() &&
              registration.validUntil >= indiaToday(),
            ) &&
            !successor,
        });
      }
      output.push({ facilityName: facility.name, reviews });
    }
    return output;
  },
});
