import { ConvexError, v } from "convex/values";

import {
  carbonFrameworkIds,
  carbonGatesForProject,
  carbonIndustries,
  type CarbonIndustryId,
} from "../src/lib/carbon-frameworks";
import type { Doc, Id } from "./_generated/dataModel";
import {
  mutation,
  type MutationCtx,
  query,
  type QueryCtx,
} from "./_generated/server";
import {
  carbonEvidenceFields,
  carbonFrameworkCheckFields,
  carbonFrameworkScreeningFields,
  carbonReviewSnapshotFields,
  requiredCarbonEvidence,
  vCarbonEvidenceKind,
  vCarbonFramework,
  vCarbonIndustry,
  vCarbonMethod,
  vCarbonProjectStatus,
} from "./lib/carbonProjectSchema";
import { cleanEvidenceText } from "./lib/commercialEvidence";
import { requireOrg } from "./lib/workspace";

const projectFields = {
  id: v.id("carbonProjects"),
  facilityId: v.id("industrialFacilities"),
  facilityName: v.string(),
  method: vCarbonMethod,
  industry: v.optional(vCarbonIndustry),
  name: v.string(),
  status: vCarbonProjectStatus,
  evidenceStatus: v.literal("reported_unverified"),
  evidence: v.array(v.object(carbonEvidenceFields)),
  updatedAt: v.number(),
  revision: v.number(),
  snapshotRevision: v.optional(v.number()),
};

const projectArgs = {
  expectedOrgId: v.id("orgs"),
  projectId: v.id("carbonProjects"),
};

const editArgs = {
  ...projectArgs,
  expectedRevision: v.number(),
};

const batchFields = {
  transformationId: v.id("lotTransformations"),
  inputGrams: v.number(),
  recordedAt: v.number(),
};

const batchPage = v.object({
  rows: v.array(v.object(batchFields)),
  hasMore: v.boolean(),
});

const pageSize = 50;
const maximumReferences = 40;
const maximumBatches = 40;

function checkWorkspace(orgId: Id<"orgs">, expectedOrgId: Id<"orgs">) {
  if (orgId !== expectedOrgId) throw new ConvexError("EVIDENCE_SCOPE_CHANGED");
}

function latestEvidence(row: Doc<"carbonProjects">) {
  return new Map(row.evidence.map((entry) => [entry.kind, entry]));
}

function checkIndustryMethod(
  industry: CarbonIndustryId,
  method: Doc<"carbonProjects">["method"],
) {
  if (carbonIndustries[industry].method !== method)
    throw new ConvexError("CARBON_INDUSTRY_METHOD_MISMATCH");
}

async function requireProject(
  ctx: QueryCtx,
  orgId: Id<"orgs">,
  projectId: Id<"carbonProjects">,
) {
  const project = await ctx.db.get("carbonProjects", projectId);
  if (project?.orgId !== orgId)
    throw new ConvexError("CARBON_PROJECT_NOT_FOUND");
  return project;
}

async function projectForEdit(
  ctx: MutationCtx,
  orgId: Id<"orgs">,
  projectId: Id<"carbonProjects">,
  expectedRevision: number,
) {
  const project = await requireProject(ctx, orgId, projectId);
  if (project.revision !== expectedRevision)
    throw new ConvexError("CARBON_PROJECT_CHANGED");
  return project;
}

export const frameworkScreenings = query({
  args: projectArgs,
  returns: v.array(v.object(carbonFrameworkScreeningFields)),
  handler: async (ctx, { expectedOrgId, projectId }) => {
    const { org } = await requireOrg(ctx, undefined, "read");
    checkWorkspace(org._id, expectedOrgId);
    await requireProject(ctx, org._id, projectId);
    const rows = await ctx.db
      .query("carbonFrameworkScreenings")
      .withIndex("by_project_framework", (q) => q.eq("projectId", projectId))
      .take(carbonFrameworkIds.length);
    return rows.map(({ framework, revision, checks }) => ({
      framework,
      revision,
      checks,
    }));
  },
});

export const recordFrameworkCheck = mutation({
  args: {
    ...editArgs,
    framework: vCarbonFramework,
    ...carbonFrameworkCheckFields,
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { org, profile } = await requireOrg(ctx);
    const { expectedOrgId, projectId, framework, gate, status } = args;
    checkWorkspace(org._id, expectedOrgId);
    const project = await requireProject(ctx, org._id, projectId);
    const gates = carbonGatesForProject(framework, project.industry);
    if (!gates.includes(gate))
      throw new ConvexError("INVALID_CARBON_FRAMEWORK_GATE");
    const reference = cleanEvidenceText(args.reference, 160);
    if (!reference) throw new ConvexError("INVALID_CARBON_REFERENCE");

    const row = await ctx.db
      .query("carbonFrameworkScreenings")
      .withIndex("by_project_framework", (q) =>
        q.eq("projectId", projectId).eq("framework", framework),
      )
      .unique();
    const currentRevision = row?.revision ?? 0;
    const checks = row?.checks ?? [];
    const existing = checks.find((check) => check.gate === gate);
    const isUnchanged =
      existing?.status === status && existing.reference === reference;

    if (args.expectedRevision !== currentRevision) {
      // The last check may have saved before the client received its response.
      if (
        isUnchanged &&
        args.expectedRevision === currentRevision - 1 &&
        checks.at(-1) === existing
      )
        return null;
      throw new ConvexError("CARBON_FRAMEWORK_CHANGED");
    }
    if (isUnchanged) return null;

    const revision = currentRevision + 1;
    const nextChecks = checks.filter((check) => check.gate !== gate);
    nextChecks.push({ gate, status, reference });
    if (row) {
      await ctx.db.patch("carbonFrameworkScreenings", row._id, {
        checks: nextChecks,
        revision,
      });
    } else {
      await ctx.db.insert("carbonFrameworkScreenings", {
        projectId,
        framework,
        checks: nextChecks,
        revision,
      });
    }
    await ctx.db.insert("auditLog", {
      orgId: org._id,
      actorProfileId: profile._id,
      action: "carbon_project.framework_check_recorded",
      entityTable: "carbonProjects",
      entityId: projectId,
      metadata: { framework, gate, status, revision },
      createdAt: Date.now(),
    });
    return null;
  },
});

function batchesForProject(ctx: QueryCtx, projectId: Id<"carbonProjects">) {
  return ctx.db
    .query("carbonProjectBatches")
    .withIndex("by_project_recorded", (q) => q.eq("projectId", projectId));
}

function existingBatch(
  ctx: QueryCtx,
  transformationId: Id<"lotTransformations">,
) {
  return ctx.db
    .query("carbonProjectBatches")
    .withIndex("by_transformation", (q) =>
      q.eq("transformationId", transformationId),
    )
    .unique();
}

async function isRecordedBatch(ctx: QueryCtx, row: Doc<"lotTransformations">) {
  if (!Number.isSafeInteger(row.inputGrams) || row.inputGrams <= 0)
    return false;
  const demo = await ctx.db
    .query("investorDemoRecords")
    .withIndex("by_table_record", (q) =>
      q.eq("table", "lotTransformations").eq("recordId", row._id),
    )
    .first();
  return !demo;
}

export const batches = query({
  args: projectArgs,
  returns: batchPage,
  handler: async (ctx, { expectedOrgId, projectId }) => {
    const { org } = await requireOrg(ctx, undefined, "read");
    checkWorkspace(org._id, expectedOrgId);
    await requireProject(ctx, org._id, projectId);
    const records = await batchesForProject(ctx, projectId)
      .order("desc")
      .take(maximumBatches + 1);
    return {
      rows: records
        .slice(0, maximumBatches)
        .map(({ transformationId, inputGrams, recordedAt }) => ({
          transformationId,
          inputGrams,
          recordedAt,
        })),
      hasMore: records.length > maximumBatches,
    };
  },
});

export const batchOptions = query({
  args: projectArgs,
  returns: batchPage,
  handler: async (ctx, { expectedOrgId, projectId }) => {
    const { org } = await requireOrg(ctx, undefined, "read");
    checkWorkspace(org._id, expectedOrgId);
    const project = await requireProject(ctx, org._id, projectId);
    const records = await ctx.db
      .query("lotTransformations")
      .withIndex("by_org_facility_created", (q) =>
        q.eq("orgId", org._id).eq("facilityId", project.facilityId),
      )
      .order("desc")
      .take(pageSize + 1);
    const rows = await Promise.all(
      records.slice(0, pageSize).map(async (row) => {
        if (
          !(await isRecordedBatch(ctx, row)) ||
          (await existingBatch(ctx, row._id))
        )
          return [];
        return [
          {
            transformationId: row._id,
            inputGrams: row.inputGrams,
            recordedAt: row.createdAt,
          },
        ];
      }),
    );
    return { rows: rows.flat(), hasMore: records.length > pageSize };
  },
});

export const attachBatch = mutation({
  args: { ...editArgs, transformationId: v.id("lotTransformations") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { org, profile } = await requireOrg(ctx);
    checkWorkspace(org._id, args.expectedOrgId);
    const project = await projectForEdit(
      ctx,
      org._id,
      args.projectId,
      args.expectedRevision,
    );
    const row = await ctx.db.get("lotTransformations", args.transformationId);
    if (
      row?.orgId !== org._id ||
      row.facilityId !== project.facilityId ||
      !(await isRecordedBatch(ctx, row))
    )
      throw new ConvexError("CARBON_BATCH_NOT_AVAILABLE");

    const previous = await existingBatch(ctx, row._id);
    if (previous?.projectId === project._id) return null;
    if (previous) throw new ConvexError("CARBON_BATCH_ALREADY_ATTACHED");
    const attached = await batchesForProject(ctx, project._id).take(
      maximumBatches,
    );
    if (attached.length >= maximumBatches)
      throw new ConvexError("CARBON_BATCH_LIMIT");

    const now = Date.now();
    const revision = project.revision + 1;
    const batchLinkId = await ctx.db.insert("carbonProjectBatches", {
      projectId: project._id,
      transformationId: row._id,
      inputGrams: row.inputGrams,
      recordedAt: now,
    });
    await ctx.db.patch("carbonProjects", project._id, {
      status: "draft",
      revision,
      updatedAt: now,
    });
    await ctx.db.insert("auditLog", {
      orgId: org._id,
      actorProfileId: profile._id,
      action: "carbon_project.batch_attached",
      entityTable: "carbonProjects",
      entityId: project._id,
      metadata: {
        transformationId: row._id,
        batchLinkId,
        revision,
        previousStatus: project.status,
      },
      createdAt: now,
    });
    return null;
  },
});

export const detachBatch = mutation({
  args: { ...editArgs, transformationId: v.id("lotTransformations") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { org, profile } = await requireOrg(ctx);
    checkWorkspace(org._id, args.expectedOrgId);
    const project = await projectForEdit(
      ctx,
      org._id,
      args.projectId,
      args.expectedRevision,
    );
    const link = await existingBatch(ctx, args.transformationId);
    if (link?.projectId === project._id) {
      const now = Date.now();
      const revision = project.revision + 1;
      await ctx.db.delete("carbonProjectBatches", link._id);
      await ctx.db.patch("carbonProjects", project._id, {
        status: "draft",
        revision,
        updatedAt: now,
      });
      await ctx.db.insert("auditLog", {
        orgId: org._id,
        actorProfileId: profile._id,
        action: "carbon_project.batch_detached",
        entityTable: "carbonProjects",
        entityId: project._id,
        metadata: {
          transformationId: link.transformationId,
          batchLinkId: link._id,
          attachedAt: link.recordedAt,
          revision,
          previousStatus: project.status,
        },
        createdAt: now,
      });
    }
    return null;
  },
});

export const mine = query({
  args: { expectedOrgId: v.id("orgs") },
  returns: v.object({
    rows: v.array(v.object(projectFields)),
    hasMore: v.boolean(),
  }),
  handler: async (ctx, { expectedOrgId }) => {
    const { org } = await requireOrg(ctx, undefined, "read");
    checkWorkspace(org._id, expectedOrgId);
    const rows = await ctx.db
      .query("carbonProjects")
      .withIndex("by_org_updated", (q) => q.eq("orgId", org._id))
      .order("desc")
      .take(pageSize + 1);

    return {
      rows: rows.slice(0, pageSize).map((row) => ({
        id: row._id,
        facilityId: row.facilityId,
        facilityName: row.facilityName,
        method: row.method,
        industry: row.industry,
        name: row.name,
        status: row.status,
        evidenceStatus: "reported_unverified" as const,
        evidence: [...latestEvidence(row).values()].map(
          ({ kind, reference, recordedAt }) => ({
            kind,
            reference,
            recordedAt,
          }),
        ),
        updatedAt: row.updatedAt,
        revision: row.revision,
        snapshotRevision: row.snapshotRevision,
      })),
      hasMore: rows.length > pageSize,
    };
  },
});

export const create = mutation({
  args: {
    expectedOrgId: v.id("orgs"),
    facilityId: v.id("industrialFacilities"),
    name: v.string(),
    method: vCarbonMethod,
    industry: v.optional(vCarbonIndustry),
  },
  returns: v.id("carbonProjects"),
  handler: async (ctx, args) => {
    const { org, profile } = await requireOrg(ctx);
    checkWorkspace(org._id, args.expectedOrgId);
    const facility = await ctx.db.get("industrialFacilities", args.facilityId);
    if (facility?.orgId !== org._id)
      throw new ConvexError("FACILITY_NOT_FOUND");
    const name = cleanEvidenceText(args.name, 120);
    if (!name) throw new ConvexError("INVALID_CARBON_PROJECT_NAME");
    const { industry } = args;
    if (industry) checkIndustryMethod(industry, args.method);

    const prior = await ctx.db
      .query("carbonProjects")
      .withIndex("by_org_facility_method_name", (q) =>
        q
          .eq("orgId", org._id)
          .eq("facilityId", facility._id)
          .eq("method", args.method)
          .eq("name", name),
      )
      .first();
    if (prior) {
      if (industry && prior.industry !== industry) {
        throw new ConvexError(
          prior.industry
            ? "CARBON_INDUSTRY_ALREADY_ASSIGNED"
            : "CARBON_INDUSTRY_ASSIGNMENT_REQUIRED",
        );
      }
      return prior._id;
    }

    const now = Date.now();
    const id = await ctx.db.insert("carbonProjects", {
      orgId: org._id,
      facilityId: facility._id,
      facilityName: facility.name,
      method: args.method,
      industry,
      name,
      status: "draft",
      evidence: [],
      revision: 1,
      createdAt: now,
      updatedAt: now,
    });
    await ctx.db.insert("auditLog", {
      orgId: org._id,
      actorProfileId: profile._id,
      action: "carbon_project.created",
      entityTable: "carbonProjects",
      entityId: id,
      metadata: { method: args.method, industry, revision: 1 },
      createdAt: now,
    });
    return id;
  },
});

export const assignIndustry = mutation({
  args: { ...editArgs, industry: vCarbonIndustry },
  returns: v.null(),
  handler: async (
    ctx,
    { expectedOrgId, projectId, industry, expectedRevision },
  ) => {
    const { org, profile } = await requireOrg(ctx);
    checkWorkspace(org._id, expectedOrgId);
    const project = await requireProject(ctx, org._id, projectId);
    if (
      project.industry === industry &&
      (expectedRevision === project.revision ||
        expectedRevision === project.revision - 1)
    )
      return null;
    if (project.revision !== expectedRevision)
      throw new ConvexError("CARBON_PROJECT_CHANGED");
    if (project.industry)
      throw new ConvexError("CARBON_INDUSTRY_ALREADY_ASSIGNED");
    checkIndustryMethod(industry, project.method);

    const revision = project.revision + 1;
    const now = Date.now();
    await ctx.db.patch("carbonProjects", projectId, {
      industry,
      status: "draft",
      revision,
      updatedAt: now,
    });
    await ctx.db.insert("auditLog", {
      orgId: org._id,
      actorProfileId: profile._id,
      action: "carbon_project.industry_assigned",
      entityTable: "carbonProjects",
      entityId: projectId,
      metadata: { industry, revision, previousStatus: project.status },
      createdAt: now,
    });
    return null;
  },
});

export const recordEvidence = mutation({
  args: { ...editArgs, kind: vCarbonEvidenceKind, reference: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { org, profile } = await requireOrg(ctx);
    checkWorkspace(org._id, args.expectedOrgId);
    const project = await projectForEdit(
      ctx,
      org._id,
      args.projectId,
      args.expectedRevision,
    );
    const reference = cleanEvidenceText(args.reference, 160);
    if (!reference) throw new ConvexError("INVALID_CARBON_REFERENCE");
    if (latestEvidence(project).get(args.kind)?.reference === reference)
      return null;
    if (project.evidence.length >= maximumReferences)
      throw new ConvexError("CARBON_EVIDENCE_LIMIT");

    const now = Date.now();
    const revision = project.revision + 1;
    await ctx.db.patch("carbonProjects", project._id, {
      evidence: [
        ...project.evidence,
        { kind: args.kind, reference, recordedAt: now, revision },
      ],
      status: "draft",
      revision,
      updatedAt: now,
    });
    await ctx.db.insert("auditLog", {
      orgId: org._id,
      actorProfileId: profile._id,
      action: "carbon_project.evidence_recorded",
      entityTable: "carbonProjects",
      entityId: project._id,
      metadata: { kind: args.kind, revision, previousStatus: project.status },
      createdAt: now,
    });
    return null;
  },
});

export const review = mutation({
  args: editArgs,
  returns: v.null(),
  handler: async (ctx, args) => {
    const { org, profile } = await requireOrg(ctx, undefined, "manage");
    checkWorkspace(org._id, args.expectedOrgId);
    const project = await projectForEdit(
      ctx,
      org._id,
      args.projectId,
      args.expectedRevision,
    );
    if (project.snapshotRevision === project.revision) return null;
    const evidence = latestEvidence(project);
    if (requiredCarbonEvidence.some((kind) => !evidence.has(kind)))
      throw new ConvexError("CARBON_EVIDENCE_REQUIRED");

    const now = Date.now();
    const revision = project.revision + 1;
    const batches = await batchesForProject(ctx, project._id).take(
      maximumBatches + 1,
    );
    if (batches.length > maximumBatches)
      throw new ConvexError("CARBON_BATCH_LIMIT");
    await ctx.db.insert("carbonReviewSnapshots", {
      projectId: project._id,
      facilityId: project.facilityId,
      method: project.method,
      industry: project.industry,
      revision,
      reviewedAt: now,
      references: [...evidence.values()].map(
        ({ kind, reference, recordedAt }) => ({ kind, reference, recordedAt }),
      ),
      batches: batches.map(({ transformationId, inputGrams, recordedAt }) => ({
        transformationId,
        inputGrams,
        recordedAt,
      })),
    });
    await ctx.db.patch("carbonProjects", project._id, {
      status: "internally_reviewed",
      revision,
      snapshotRevision: revision,
      updatedAt: now,
    });
    await ctx.db.insert("auditLog", {
      orgId: org._id,
      actorProfileId: profile._id,
      action: "carbon_project.internally_reviewed",
      entityTable: "carbonProjects",
      entityId: project._id,
      metadata: { revision },
      createdAt: now,
    });
    return null;
  },
});

export const reviewSnapshot = query({
  args: { ...projectArgs, revision: v.number() },
  returns: v.union(
    v.null(),
    v.object({
      ...carbonReviewSnapshotFields,
      schemaVersion: v.literal(1),
      purpose: v.literal("internal_carbon_review"),
      evidenceStatus: v.literal("reported_unverified"),
    }),
  ),
  handler: async (ctx, { expectedOrgId, projectId, revision }) => {
    const { org } = await requireOrg(ctx, undefined, "read");
    checkWorkspace(org._id, expectedOrgId);
    await requireProject(ctx, org._id, projectId);
    const row = await ctx.db
      .query("carbonReviewSnapshots")
      .withIndex("by_project_revision", (q) =>
        q.eq("projectId", projectId).eq("revision", revision),
      )
      .unique();
    if (!row) return null;
    return {
      projectId: row.projectId,
      facilityId: row.facilityId,
      method: row.method,
      industry: row.industry,
      revision: row.revision,
      reviewedAt: row.reviewedAt,
      references: row.references,
      batches: row.batches,
      schemaVersion: 1 as const,
      purpose: "internal_carbon_review" as const,
      evidenceStatus: "reported_unverified" as const,
    };
  },
});
