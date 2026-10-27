import { ConvexError, v } from "convex/values";

import { mutation, query } from "./_generated/server";
import { requireAdmin } from "./lib/access";
import { requiredLabel } from "./lib/lotEvidence";
import { definitionFields } from "./lib/operationalSchema";
import { requireOrg } from "./lib/workspace";

const definitionView = v.object({
  id: v.id("operationalDefinitions"),
  ...definitionFields,
  status: v.union(
    v.literal("draft"),
    v.literal("active"),
    v.literal("retired"),
  ),
  reviewReference: v.optional(v.string()),
  createdAt: v.number(),
});
function bounded(value: string, max: number) {
  const text = value.trim();
  if (!text || text.length > max) throw new ConvexError("INVALID_REFERENCE");
  return text;
}
export const adminList = query({
  args: {},
  returns: v.array(definitionView),
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const rows = await ctx.db
      .query("operationalDefinitions")
      .withIndex("by_created")
      .order("desc")
      .take(200);
    return rows.map(
      ({
        _id,
        materialCode,
        name,
        family,
        stage,
        processingState,
        grade,
        version,
        specification,
        sourceReference,
        status,
        reviewReference,
        createdAt,
      }) => ({
        id: _id,
        materialCode,
        name,
        family,
        stage,
        processingState,
        grade,
        version,
        specification,
        sourceReference,
        status,
        reviewReference,
        createdAt,
      }),
    );
  },
});
export const active = query({
  args: { search: v.string() },
  returns: v.object({ rows: v.array(definitionView), truncated: v.boolean() }),
  handler: async (ctx, args) => {
    await requireOrg(ctx, undefined, "read");
    if (args.search.length > 120) throw new ConvexError("INVALID_LABEL");
    const page = await ctx.db
      .query("operationalDefinitions")
      .withIndex("by_status_created", (q) => q.eq("status", "active"))
      .order("desc")
      .take(501);
    const search = args.search.trim().toLowerCase();
    const matches = page
      .slice(0, 500)
      .filter((r) =>
        [
          r.materialCode,
          r.name,
          r.grade,
          r.processingState,
          r.specification,
        ].some((s) => s.toLowerCase().includes(search)),
      );
    return {
      rows: matches
        .slice(0, 100)
        .map(
          ({
            _id,
            materialCode,
            name,
            family,
            stage,
            processingState,
            grade,
            version,
            specification,
            sourceReference,
            status,
            reviewReference,
            createdAt,
          }) => ({
            id: _id,
            materialCode,
            name,
            family,
            stage,
            processingState,
            grade,
            version,
            specification,
            sourceReference,
            status,
            reviewReference,
            createdAt,
          }),
        ),
      truncated: page.length > 500 || matches.length > 100,
    };
  },
});
export const draft = mutation({
  args: definitionFields,
  returns: v.id("operationalDefinitions"),
  handler: async (ctx, args) => {
    const admin = await requireAdmin(ctx);
    const materialCode = args.materialCode.trim().toUpperCase();
    if (!/^[A-Z0-9][A-Z0-9-]{2,59}$/.test(materialCode))
      throw new ConvexError("INVALID_MATERIAL_CODE");
    const fields = {
      ...args,
      materialCode,
      name: requiredLabel(args.name),
      processingState: requiredLabel(args.processingState),
      grade: requiredLabel(args.grade),
      version: requiredLabel(args.version),
      specification: bounded(args.specification, 2000),
      sourceReference: bounded(args.sourceReference, 500),
    };
    const existing = await ctx.db
      .query("operationalDefinitions")
      .withIndex("by_material_version", (q) =>
        q.eq("materialCode", materialCode).eq("version", fields.version),
      )
      .unique();
    if (existing) throw new ConvexError("DEFINITION_VERSION_EXISTS");
    const id = await ctx.db.insert("operationalDefinitions", {
      ...fields,
      status: "draft",
      createdBy: admin._id,
      createdAt: Date.now(),
    });
    await ctx.db.insert("auditLog", {
      action: "catalogue.definitionDrafted",
      entityTable: "operationalDefinitions",
      entityId: id,
      metadata: { adminUserId: admin._id, ...fields },
      createdAt: Date.now(),
    });
    return id;
  },
});
export const review = mutation({
  args: {
    id: v.id("operationalDefinitions"),
    decision: v.union(v.literal("active"), v.literal("retired")),
    reference: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const admin = await requireAdmin(ctx);
    const row = await ctx.db.get("operationalDefinitions", args.id);
    if (
      !row ||
      row.status === "retired" ||
      (args.decision === "active" && row.status !== "draft")
    )
      throw new ConvexError("INVALID_DEFINITION_STATE");
    const reference = bounded(args.reference, 500);
    if (args.decision === "active") {
      const material = await ctx.db
        .query("materials")
        .withIndex("by_code", (q) => q.eq("code", row.materialCode))
        .unique();
      if (
        material &&
        (material.family !== row.family || material.stage !== row.stage)
      )
        throw new ConvexError("MATERIAL_DEFINITION_CONFLICT");
      if (!material?.active) {
        const materialId =
          material?._id ??
          (await ctx.db.insert("materials", {
            code: row.materialCode,
            family: row.family,
            stage: row.stage,
            names: { en: row.name },
            sortOrder: 1000,
            active: true,
          }));
        if (material)
          await ctx.db.patch("materials", materialId, { active: true });
        await ctx.db.insert("auditLog", {
          action: "material.definitionActivated",
          entityTable: "materials",
          entityId: materialId,
          metadata: {
            adminUserId: admin._id,
            definitionId: row._id,
            reference,
            previousActive: material?.active ?? null,
            hazardApprovalGranted: false,
          },
          createdAt: Date.now(),
        });
      }
    }
    await ctx.db.patch("operationalDefinitions", row._id, {
      status: args.decision,
      reviewReference: reference,
      reviewedAt: Date.now(),
      reviewedBy: admin._id,
    });
    await ctx.db.insert("auditLog", {
      action: "catalogue.definitionReviewed",
      entityTable: "operationalDefinitions",
      entityId: row._id,
      metadata: {
        adminUserId: admin._id,
        before: row.status,
        after: args.decision,
        reference,
        hazardApprovalGranted: false,
      },
      createdAt: Date.now(),
    });
    return null;
  },
});
