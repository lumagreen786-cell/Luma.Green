/// <reference types="vite/client" />
// @vitest-environment edge-runtime
import { convexTest } from "convex-test";
import { afterEach, describe, expect, it, vi } from "vitest";

import { api } from "./_generated/api";
import {
  convexModules,
  registerAuth,
  seedDemo,
  signInAs,
} from "./lib/auth.testing";
import schema from "./schema";

const modules = convexModules(import.meta.glob("./**/*.*s"));

async function world() {
  vi.stubEnv("AUTH_DEV_MODE", "true");
  const t = convexTest(schema, modules);
  registerAuth(t);
  await seedDemo(t);
  const recycler = await signInAs(t, "+919000000103");
  const shop = await signInAs(t, "+919000000101");
  const { recyclerOrg, shopOrg, facilityId, membershipId } = await t.run(
    async (ctx) => {
      const recyclerOrg = await ctx.db
        .query("orgs")
        .withIndex("by_kind_city", (q) => q.eq("kind", "recycler"))
        .first();
      const shopOrg = await ctx.db
        .query("orgs")
        .withIndex("by_kind_city", (q) => q.eq("kind", "kabadiwala"))
        .first();
      if (!recyclerOrg || !shopOrg) throw new Error("Missing demo workspaces");
      const membership = await ctx.db
        .query("memberships")
        .withIndex("by_org", (q) => q.eq("orgId", recyclerOrg._id))
        .first();
      if (!membership) throw new Error("Missing demo membership");
      const facilityId = await ctx.db.insert("industrialFacilities", {
        orgId: recyclerOrg._id,
        name: "Fixture recycler",
        siteReference: "Facility fixture",
        capabilities: ["washing"],
        createdByProfileId: membership.profileId,
        updatedByProfileId: membership.profileId,
        createdAt: 1,
        updatedAt: 1,
      });
      return { recyclerOrg, shopOrg, facilityId, membershipId: membership._id };
    },
  );
  return {
    t,
    recycler,
    shop,
    recyclerOrgId: recyclerOrg._id,
    shopOrgId: shopOrg._id,
    facilityId,
    membershipId,
  };
}

afterEach(() => vi.unstubAllEnvs());

describe("carbon project preparation", () => {
  it("limits internal review to a complete current reference set", async () => {
    const {
      t,
      recycler,
      shop,
      recyclerOrgId: expectedOrgId,
      facilityId,
    } = await world();
    const create = {
      expectedOrgId,
      facilityId,
      name: "PET evidence draft",
      method: "verra_vmr0007" as const,
    };
    const projectId = await recycler.mutation(
      api.carbonProjects.create,
      create,
    );
    expect(await recycler.mutation(api.carbonProjects.create, create)).toBe(
      projectId,
    );
    const scope = { expectedOrgId, projectId };
    await expect(
      recycler.mutation(api.carbonProjects.review, {
        ...scope,
        expectedRevision: 1,
      }),
    ).rejects.toThrow(/CARBON_EVIDENCE_REQUIRED/);

    const required = [
      "baseline",
      "monitoring",
      "claim_rights",
      "verification_report",
    ] as const;
    for (const [index, kind] of required.entries()) {
      await recycler.mutation(api.carbonProjects.recordEvidence, {
        ...scope,
        kind,
        reference: `TEST-${kind}`,
        expectedRevision: index + 1,
      });
    }
    await expect(
      recycler.mutation(api.carbonProjects.review, {
        ...scope,
        expectedRevision: 4,
      }),
    ).rejects.toThrow(/CARBON_PROJECT_CHANGED/);
    await recycler.mutation(api.carbonProjects.review, {
      ...scope,
      expectedRevision: 5,
    });
    expect(
      await recycler.query(api.carbonProjects.mine, { expectedOrgId }),
    ).toMatchObject({
      rows: [
        {
          id: projectId,
          facilityName: "Fixture recycler",
          status: "internally_reviewed",
          evidenceStatus: "reported_unverified",
          revision: 6,
        },
      ],
      hasMore: false,
    });

    const snapshotArgs = { ...scope, revision: 6 };
    const snapshot = await recycler.query(
      api.carbonProjects.reviewSnapshot,
      snapshotArgs,
    );
    expect(snapshot).toMatchObject({
      projectId,
      revision: 6,
      purpose: "internal_carbon_review",
      evidenceStatus: "reported_unverified",
      batches: [],
    });
    expect(snapshot?.references.map(({ kind }) => kind)).toEqual(required);
    await recycler.mutation(api.carbonProjects.recordFrameworkCheck, {
      ...scope,
      framework: "verra",
      gate: "method_and_version",
      status: "supported",
      reference: "PRIVATE-TEST-METHOD",
      expectedRevision: 0,
    });
    expect(
      await recycler.query(api.carbonProjects.reviewSnapshot, snapshotArgs),
    ).toEqual(snapshot);
    expect(
      await recycler.query(api.carbonProjects.mine, { expectedOrgId }),
    ).toMatchObject({
      rows: [
        { revision: 6, snapshotRevision: 6, status: "internally_reviewed" },
      ],
    });
    await expect(
      shop.query(api.carbonProjects.reviewSnapshot, snapshotArgs),
    ).rejects.toThrow(/EVIDENCE_SCOPE_CHANGED/);
    await recycler.mutation(api.carbonProjects.review, {
      ...scope,
      expectedRevision: 6,
    });

    await recycler.mutation(api.carbonProjects.recordEvidence, {
      ...scope,
      kind: "registry_issuance",
      reference: "TEST-UNVERIFIED-REGISTRY",
      expectedRevision: 6,
    });
    const { rows } = await recycler.query(api.carbonProjects.mine, {
      expectedOrgId,
    });
    expect(rows).toMatchObject([
      { status: "draft", evidenceStatus: "reported_unverified", revision: 7 },
    ]);
    expect(rows[0]?.evidence).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ kind: "registry_issuance" }),
      ]),
    );
    expect(
      await recycler.query(api.carbonProjects.reviewSnapshot, snapshotArgs),
    ).toEqual(snapshot);
    expect(
      await recycler.query(api.carbonProjects.reviewSnapshot, {
        ...scope,
        revision: 7,
      }),
    ).toBeNull();
    const events = await t.run((ctx) =>
      ctx.db
        .query("auditLog")
        .withIndex("by_entity", (q) =>
          q.eq("entityTable", "carbonProjects").eq("entityId", projectId),
        )
        .take(10),
    );
    expect(events.map((event) => event.action)).toContain(
      "carbon_project.internally_reviewed",
    );
    expect(JSON.stringify(events)).not.toContain("TEST-UNVERIFIED-REGISTRY");
    expect(JSON.stringify(events)).not.toContain("PRIVATE-TEST-METHOD");
  });

  it("rejects overlapping edits and preserves history on a correction", async () => {
    const {
      t,
      recycler,
      recyclerOrgId: expectedOrgId,
      facilityId,
      membershipId,
    } = await world();
    const projectId = await recycler.mutation(api.carbonProjects.create, {
      expectedOrgId,
      facilityId,
      name: "Correction fixture",
      method: "bee_wa03_003",
    });
    const scope = { expectedOrgId, projectId, kind: "monitoring" as const };
    await t.run((ctx) =>
      ctx.db.patch("memberships", membershipId, { role: "member" }),
    );
    await expect(
      recycler.mutation(api.carbonProjects.review, {
        expectedOrgId,
        projectId,
        expectedRevision: 1,
      }),
    ).rejects.toThrow(/WORKSPACE_PERMISSION_DENIED/);

    const attempts = await Promise.allSettled([
      recycler.mutation(api.carbonProjects.recordEvidence, {
        ...scope,
        expectedRevision: 1,
        reference: "TEST-A",
      }),
      recycler.mutation(api.carbonProjects.recordEvidence, {
        ...scope,
        expectedRevision: 1,
        reference: "TEST-B",
      }),
    ]);
    expect(
      attempts.filter((attempt) => attempt.status === "fulfilled"),
    ).toHaveLength(1);
    await recycler.mutation(api.carbonProjects.recordEvidence, {
      ...scope,
      expectedRevision: 2,
      reference: "TEST-C",
    });
    await recycler.mutation(api.carbonProjects.recordEvidence, {
      ...scope,
      expectedRevision: 3,
      reference: "TEST-C",
    });
    const stored = await t.run((ctx) =>
      ctx.db.get("carbonProjects", projectId),
    );
    expect(stored?.evidence).toHaveLength(2);

    await t.run((ctx) =>
      ctx.db.patch("memberships", membershipId, { role: "viewer" }),
    );
    await expect(
      recycler.mutation(api.carbonProjects.recordEvidence, {
        ...scope,
        expectedRevision: 3,
        reference: "TEST-D",
      }),
    ).rejects.toThrow(/WORKSPACE_PERMISSION_DENIED/);
    expect(
      await recycler.query(api.carbonProjects.mine, { expectedOrgId }),
    ).toMatchObject({
      rows: [
        {
          revision: 3,
          evidence: [{ kind: "monitoring", reference: "TEST-C" }],
        },
      ],
    });
  });

  it("denies unrelated and stale workspace access", async () => {
    const { t, recycler, shop, recyclerOrgId, shopOrgId, facilityId } =
      await world();
    const create = {
      facilityId,
      name: "Private project",
      method: "bee_wa03_003" as const,
    };
    const projectId = await recycler.mutation(api.carbonProjects.create, {
      ...create,
      expectedOrgId: recyclerOrgId,
    });
    await expect(
      shop.query(api.carbonProjects.mine, { expectedOrgId: recyclerOrgId }),
    ).rejects.toThrow(/EVIDENCE_SCOPE_CHANGED/);
    await expect(
      shop.mutation(api.carbonProjects.create, {
        ...create,
        expectedOrgId: shopOrgId,
      }),
    ).rejects.toThrow(/FACILITY_NOT_FOUND/);
    await expect(
      shop.mutation(api.carbonProjects.recordEvidence, {
        expectedOrgId: shopOrgId,
        projectId,
        kind: "baseline",
        reference: "TEST-BLOCKED",
        expectedRevision: 1,
      }),
    ).rejects.toThrow(/CARBON_PROJECT_NOT_FOUND/);
    expect(
      await shop.query(api.carbonProjects.mine, { expectedOrgId: shopOrgId }),
    ).toEqual({ rows: [], hasMore: false });
    await expect(
      t.query(api.carbonProjects.mine, { expectedOrgId: recyclerOrgId }),
    ).rejects.toThrow();
  });

  it("links only owned, non-demo batches and reserves each transformation once", async () => {
    const {
      t,
      recycler,
      shop,
      recyclerOrgId: expectedOrgId,
      shopOrgId,
      facilityId,
      membershipId,
    } = await world();
    const create = {
      expectedOrgId,
      facilityId,
      name: "Batch project",
      method: "verra_vmr0007" as const,
    };
    const projectId = await recycler.mutation(
      api.carbonProjects.create,
      create,
    );
    const otherProjectId = await recycler.mutation(api.carbonProjects.create, {
      ...create,
      name: "Other batch project",
    });
    const { transformationId, demoId, unassignedId, foreignId, inputLotId } =
      await t.run(async (ctx) => {
        const membership = await ctx.db.get("memberships", membershipId);
        if (!membership) throw new Error("Missing membership fixture");
        const inputLotId = await ctx.db.insert("materialLots", {
          orgId: expectedOrgId,
          declaredByOrgId: expectedOrgId,
          materialCode: "PET",
          state: "bottles",
          sourceKind: "self_declared",
          initialGrams: 100,
          availableGrams: 0,
          status: "exhausted",
          createdByProfileId: membership.profileId,
          createdAt: 1,
          updatedAt: 1,
        });
        const row = {
          facilityId,
          orgId: expectedOrgId,
          inputLotId,
          inputGrams: 100,
          contaminationGrams: 0,
          processLossGrams: 0,
          actorProfileId: membership.profileId,
          createdAt: 2,
        };
        const transformationId = await ctx.db.insert("lotTransformations", row);
        const demoId = await ctx.db.insert("lotTransformations", row);
        const unassignedId = await ctx.db.insert("lotTransformations", {
          ...row,
          facilityId: undefined,
        });
        const foreignId = await ctx.db.insert("lotTransformations", {
          ...row,
          orgId: shopOrgId,
        });
        await ctx.db.insert("investorDemoRecords", {
          batchKey: "fixture",
          key: "demo:batch",
          table: "lotTransformations",
          recordId: demoId,
          createdAt: 2,
        });
        return {
          transformationId,
          demoId,
          unassignedId,
          foreignId,
          inputLotId,
        };
      });
    const scope = { expectedOrgId, projectId };
    const attach = { ...scope, transformationId, expectedRevision: 1 };
    expect(
      await recycler.query(api.carbonProjects.batchOptions, scope),
    ).toEqual({
      rows: [{ transformationId, inputGrams: 100, recordedAt: 2 }],
      hasMore: false,
    });
    for (const id of [demoId, unassignedId, foreignId]) {
      await expect(
        recycler.mutation(api.carbonProjects.attachBatch, {
          ...attach,
          transformationId: id,
        }),
      ).rejects.toThrow(/CARBON_BATCH_NOT_AVAILABLE/);
    }
    await expect(
      shop.query(api.carbonProjects.batches, {
        ...scope,
        expectedOrgId: shopOrgId,
      }),
    ).rejects.toThrow(/CARBON_PROJECT_NOT_FOUND/);
    await expect(
      recycler.mutation(api.carbonProjects.attachBatch, {
        ...attach,
        expectedRevision: 0,
      }),
    ).rejects.toThrow(/CARBON_PROJECT_CHANGED/);
    const attempts = await Promise.allSettled([
      recycler.mutation(api.carbonProjects.attachBatch, attach),
      recycler.mutation(api.carbonProjects.attachBatch, {
        ...attach,
        projectId: otherProjectId,
      }),
    ]);
    expect(
      attempts.filter((attempt) => attempt.status === "fulfilled"),
    ).toHaveLength(1);
    const failure = attempts.find((attempt) => attempt.status === "rejected");
    expect(String(failure?.reason)).toMatch(/CARBON_BATCH_ALREADY_ATTACHED/);
    const winnerId =
      attempts[0].status === "fulfilled" ? projectId : otherProjectId;
    const winner = { ...scope, projectId: winnerId };
    await recycler.mutation(api.carbonProjects.attachBatch, {
      ...attach,
      projectId: winnerId,
      expectedRevision: 2,
    });
    expect(
      await recycler.query(api.carbonProjects.batches, winner),
    ).toMatchObject({
      rows: [{ transformationId, inputGrams: 100 }],
      hasMore: false,
    });
    expect(
      await recycler.query(api.carbonProjects.batchOptions, scope),
    ).toEqual({ rows: [], hasMore: false });
    const loserId = winnerId === projectId ? otherProjectId : projectId;
    const detach = { ...winner, transformationId, expectedRevision: 2 };
    await recycler.mutation(api.carbonProjects.detachBatch, {
      ...detach,
      projectId: loserId,
      expectedRevision: 1,
    });
    await expect(
      shop.mutation(api.carbonProjects.detachBatch, {
        ...detach,
        expectedOrgId: shopOrgId,
      }),
    ).rejects.toThrow(/CARBON_PROJECT_NOT_FOUND/);
    await expect(
      recycler.mutation(api.carbonProjects.detachBatch, {
        ...detach,
        expectedRevision: 1,
      }),
    ).rejects.toThrow(/CARBON_PROJECT_CHANGED/);
    const kinds = [
      "baseline",
      "monitoring",
      "claim_rights",
      "verification_report",
    ] as const;
    for (const [index, kind] of kinds.entries()) {
      await recycler.mutation(api.carbonProjects.recordEvidence, {
        ...winner,
        expectedRevision: index + 2,
        kind,
        reference: `TEST-${kind}`,
      });
    }
    await recycler.mutation(api.carbonProjects.review, {
      ...winner,
      expectedRevision: 6,
    });
    await recycler.mutation(api.carbonProjects.detachBatch, {
      ...detach,
      expectedRevision: 7,
    });
    await recycler.mutation(api.carbonProjects.detachBatch, {
      ...detach,
      expectedRevision: 8,
    });
    expect(
      await recycler.query(api.carbonProjects.reviewSnapshot, {
        ...winner,
        revision: 7,
      }),
    ).toMatchObject({
      batches: [{ transformationId, inputGrams: 100 }],
    });
    const removed = await recycler.query(api.carbonProjects.batches, winner);
    expect(removed).toEqual({ rows: [], hasMore: false });
    const { rows } = await recycler.query(api.carbonProjects.mine, {
      expectedOrgId,
    });
    expect(rows.find((row) => row.id === winnerId)).toMatchObject({
      status: "draft",
      revision: 8,
    });
    await recycler.mutation(api.carbonProjects.attachBatch, {
      ...attach,
      projectId: loserId,
    });
    const stock = await t.run((ctx) => ctx.db.get("materialLots", inputLotId));
    expect(stock?.availableGrams).toBe(0);
    const events = await t.run((ctx) =>
      ctx.db
        .query("auditLog")
        .withIndex("by_entity", (q) =>
          q.eq("entityTable", "carbonProjects").eq("entityId", winnerId),
        )
        .take(10),
    );
    const attaches = events.filter(
      ({ action }) => action === "carbon_project.batch_attached",
    );
    const detaches = events.filter(
      ({ action }) => action === "carbon_project.batch_detached",
    );
    expect(attaches).toHaveLength(1);
    expect(detaches).toHaveLength(1);
    expect(detaches[0]?.metadata).toMatchObject({
      ...(attaches[0]?.metadata as { batchLinkId: string }),
      transformationId,
      previousStatus: "internally_reviewed",
      revision: 8,
      attachedAt: attaches[0]?.createdAt,
    });
  });
});

describe("carbon framework screening", () => {
  it("creates projects only when the selected industry's candidate method matches", async () => {
    const {
      recycler,
      recyclerOrgId: expectedOrgId,
      facilityId,
    } = await world();
    const routes = [
      ["pet_plastics", "verra_vmr0007"],
      ["metals_recycling", "verra_vmr0007"],
      ["e_waste_recovery", "verra_vmr0008"],
      ["compressed_biogas", "bee_wa03_003"],
      ["industrial_manufacturing", "bee_in02_001"],
    ] as const;
    for (const [industry, method] of routes) {
      const input = {
        expectedOrgId,
        facilityId,
        name: industry,
        industry,
        method,
      };
      const id = await recycler.mutation(api.carbonProjects.create, input);
      expect(await recycler.mutation(api.carbonProjects.create, input)).toBe(
        id,
      );
    }
    const { rows } = await recycler.query(api.carbonProjects.mine, {
      expectedOrgId,
    });
    expect(rows).toHaveLength(routes.length);
    expect(rows.map(({ industry, method }) => [industry, method])).toEqual(
      expect.arrayContaining([...routes]),
    );
    await expect(
      recycler.mutation(api.carbonProjects.create, {
        expectedOrgId,
        facilityId,
        name: "Invalid project",
        industry: "compressed_biogas",
        method: "verra_vmr0007",
      }),
    ).rejects.toThrow(/CARBON_INDUSTRY_METHOD_MISMATCH/);
    await expect(
      recycler.mutation(api.carbonProjects.create, {
        expectedOrgId,
        facilityId,
        name: "pet_plastics",
        industry: "metals_recycling",
        method: "verra_vmr0007",
      }),
    ).rejects.toThrow(/CARBON_INDUSTRY_ALREADY_ASSIGNED/);
  });

  it("assigns a legacy industry once and preserves generic checks and old reviews", async () => {
    const {
      t,
      recycler,
      recyclerOrgId: expectedOrgId,
      facilityId,
      membershipId,
    } = await world();
    const create = {
      expectedOrgId,
      facilityId,
      name: "Legacy electronics recycling",
      method: "verra_vmr0008",
    } as const;
    const projectId = await recycler.mutation(
      api.carbonProjects.create,
      create,
    );
    const scope = { expectedOrgId, projectId };
    const assign = {
      ...scope,
      industry: "e_waste_recovery",
      expectedRevision: 6,
    } as const;
    const check = {
      ...scope,
      framework: "verra",
      gate: "method_and_version",
      status: "supported",
      reference: "PRIVATE-LEGACY-METHOD",
      expectedRevision: 0,
    } as const;
    const industryCheck = {
      ...check,
      gate: "equipment_categories_and_custody",
      reference: "PRIVATE-INDUSTRY-CUSTODY",
      expectedRevision: 1,
    } as const;

    await expect(
      recycler.mutation(api.carbonProjects.create, {
        ...create,
        industry: assign.industry,
      }),
    ).rejects.toThrow(/CARBON_INDUSTRY_ASSIGNMENT_REQUIRED/);
    await recycler.mutation(api.carbonProjects.recordFrameworkCheck, check);
    await expect(
      recycler.mutation(api.carbonProjects.recordFrameworkCheck, industryCheck),
    ).rejects.toThrow(/INVALID_CARBON_FRAMEWORK_GATE/);
    const required = [
      "baseline",
      "monitoring",
      "claim_rights",
      "verification_report",
    ] as const;
    for (const [index, kind] of required.entries()) {
      await recycler.mutation(api.carbonProjects.recordEvidence, {
        ...scope,
        kind,
        reference: `TEST-${kind}`,
        expectedRevision: index + 1,
      });
    }
    await recycler.mutation(api.carbonProjects.review, {
      ...scope,
      expectedRevision: 5,
    });
    const oldSnapshotArgs = { ...scope, revision: 6 };
    const original = await recycler.query(
      api.carbonProjects.reviewSnapshot,
      oldSnapshotArgs,
    );
    expect(original).toBeTruthy();
    expect(original?.industry).toBeUndefined();
    await expect(
      recycler.mutation(api.carbonProjects.assignIndustry, {
        ...assign,
        industry: "pet_plastics",
      }),
    ).rejects.toThrow(/CARBON_INDUSTRY_METHOD_MISMATCH/);
    await expect(
      recycler.mutation(api.carbonProjects.assignIndustry, {
        ...assign,
        expectedRevision: 5,
      }),
    ).rejects.toThrow(/CARBON_PROJECT_CHANGED/);
    await t.run((ctx) =>
      ctx.db.patch("memberships", membershipId, { role: "viewer" }),
    );
    await expect(
      recycler.mutation(api.carbonProjects.assignIndustry, assign),
    ).rejects.toThrow(/WORKSPACE_PERMISSION_DENIED/);
    await t.run((ctx) =>
      ctx.db.patch("memberships", membershipId, { role: "owner" }),
    );
    await recycler.mutation(api.carbonProjects.assignIndustry, assign);
    await recycler.mutation(api.carbonProjects.assignIndustry, assign);
    await expect(
      recycler.mutation(api.carbonProjects.assignIndustry, {
        ...assign,
        industry: "pet_plastics",
        expectedRevision: 7,
      }),
    ).rejects.toThrow(/CARBON_INDUSTRY_ALREADY_ASSIGNED/);
    expect(
      await recycler.query(api.carbonProjects.mine, { expectedOrgId }),
    ).toMatchObject({
      rows: [
        {
          industry: assign.industry,
          revision: 7,
          snapshotRevision: 6,
          status: "draft",
        },
      ],
    });
    await recycler.mutation(
      api.carbonProjects.recordFrameworkCheck,
      industryCheck,
    );
    expect(
      await recycler.query(api.carbonProjects.frameworkScreenings, scope),
    ).toMatchObject([
      {
        framework: "verra",
        revision: 2,
        checks: [
          { gate: check.gate, reference: check.reference },
          { gate: industryCheck.gate, reference: industryCheck.reference },
        ],
      },
    ]);
    await recycler.mutation(api.carbonProjects.review, {
      ...scope,
      expectedRevision: 7,
    });
    expect(
      await recycler.query(api.carbonProjects.reviewSnapshot, {
        ...scope,
        revision: 8,
      }),
    ).toMatchObject({ industry: assign.industry, revision: 8 });
    expect(
      await recycler.query(api.carbonProjects.reviewSnapshot, oldSnapshotArgs),
    ).toEqual(original);
    const events = await t.run((ctx) =>
      ctx.db
        .query("auditLog")
        .withIndex("by_entity", (q) =>
          q.eq("entityTable", "carbonProjects").eq("entityId", projectId),
        )
        .take(20),
    );
    expect(
      events.filter(
        ({ action }) => action === "carbon_project.industry_assigned",
      ),
    ).toMatchObject([
      {
        metadata: {
          industry: assign.industry,
          revision: 7,
          previousStatus: "internally_reviewed",
        },
      },
    ]);
  });

  it("scopes checks by workspace and keeps private references out of the audit log", async () => {
    const {
      t,
      recycler,
      shop,
      recyclerOrgId: expectedOrgId,
      shopOrgId,
      facilityId,
      membershipId,
    } = await world();
    const projectId = await recycler.mutation(api.carbonProjects.create, {
      expectedOrgId,
      facilityId,
      name: "Framework screening fixture",
      method: "verra_vmr0007",
    });
    const scope = { expectedOrgId, projectId };
    const check = {
      ...scope,
      framework: "verra",
      gate: "method_and_version",
      status: "supported",
      reference: " PRIVATE-TEST-SCREENING ",
      expectedRevision: 0,
    } as const;

    expect(
      await recycler.query(api.carbonProjects.frameworkScreenings, scope),
    ).toEqual([]);
    await t.run((ctx) =>
      ctx.db.patch("memberships", membershipId, { role: "member" }),
    );
    await recycler.mutation(api.carbonProjects.recordFrameworkCheck, check);
    await recycler.mutation(api.carbonProjects.recordFrameworkCheck, check);
    const stored = [
      {
        framework: "verra",
        revision: 1,
        checks: [
          {
            gate: "method_and_version",
            status: "supported",
            reference: "PRIVATE-TEST-SCREENING",
          },
        ],
      },
    ];
    await t.run((ctx) =>
      ctx.db.patch("memberships", membershipId, { role: "viewer" }),
    );
    expect(
      await recycler.query(api.carbonProjects.frameworkScreenings, scope),
    ).toEqual(stored);
    await expect(
      recycler.mutation(api.carbonProjects.recordFrameworkCheck, check),
    ).rejects.toThrow(/WORKSPACE_PERMISSION_DENIED/);
    await expect(
      shop.query(api.carbonProjects.frameworkScreenings, scope),
    ).rejects.toThrow(/EVIDENCE_SCOPE_CHANGED/);
    await expect(
      shop.query(api.carbonProjects.frameworkScreenings, {
        ...scope,
        expectedOrgId: shopOrgId,
      }),
    ).rejects.toThrow(/CARBON_PROJECT_NOT_FOUND/);
    await expect(
      shop.mutation(api.carbonProjects.recordFrameworkCheck, {
        ...check,
        expectedOrgId: shopOrgId,
      }),
    ).rejects.toThrow(/CARBON_PROJECT_NOT_FOUND/);
    await expect(
      t.query(api.carbonProjects.frameworkScreenings, scope),
    ).rejects.toThrow(/NOT_SIGNED_IN/);
    await expect(
      t.mutation(api.carbonProjects.recordFrameworkCheck, check),
    ).rejects.toThrow(/NOT_SIGNED_IN/);
    await t.run((ctx) => ctx.db.delete("memberships", membershipId));
    await expect(
      recycler.query(api.carbonProjects.frameworkScreenings, scope),
    ).rejects.toThrow(/NO_BUSINESS/);

    const events = await t.run((ctx) =>
      ctx.db
        .query("auditLog")
        .withIndex("by_entity", (q) =>
          q.eq("entityTable", "carbonProjects").eq("entityId", projectId),
        )
        .take(10),
    );
    expect(events).toMatchObject([
      { action: "carbon_project.created" },
      {
        action: "carbon_project.framework_check_recorded",
        orgId: expectedOrgId,
        metadata: {
          framework: "verra",
          gate: "method_and_version",
          status: "supported",
          revision: 1,
        },
      },
    ]);
    expect(JSON.stringify(events)).not.toContain("PRIVATE-TEST-SCREENING");
  });

  it("rejects invalid gates and references, and prevents stale changes within each framework", async () => {
    const {
      recycler,
      recyclerOrgId: expectedOrgId,
      facilityId,
    } = await world();
    const projectId = await recycler.mutation(api.carbonProjects.create, {
      expectedOrgId,
      facilityId,
      name: "Framework revision fixture",
      method: "verra_vmr0007",
    });
    const scope = { expectedOrgId, projectId };
    const check = {
      ...scope,
      framework: "verra",
      gate: "method_and_version",
      status: "supported",
      reference: "TEST-A",
      expectedRevision: 0,
    } as const;

    await expect(
      recycler.mutation(api.carbonProjects.recordFrameworkCheck, {
        ...check,
        gate: "durable_removal_and_storage",
      }),
    ).rejects.toThrow(/INVALID_CARBON_FRAMEWORK_GATE/);
    await expect(
      recycler.mutation(api.carbonProjects.recordFrameworkCheck, {
        ...check,
        reference: " ",
      }),
    ).rejects.toThrow(/INVALID_CARBON_REFERENCE/);
    const concurrent = await Promise.allSettled([
      recycler.mutation(api.carbonProjects.recordFrameworkCheck, check),
      recycler.mutation(api.carbonProjects.recordFrameworkCheck, {
        ...check,
        reference: "TEST-B",
      }),
    ]);
    expect(
      concurrent.filter(({ status }) => status === "fulfilled"),
    ).toHaveLength(1);
    await expect(
      recycler.mutation(api.carbonProjects.recordFrameworkCheck, {
        ...check,
        reference: "TEST-C",
      }),
    ).rejects.toThrow(/CARBON_FRAMEWORK_CHANGED/);
    await recycler.mutation(api.carbonProjects.recordFrameworkCheck, {
      ...check,
      status: "contradicted",
      expectedRevision: 1,
      reference: "TEST-D",
    });
    await expect(
      recycler.mutation(api.carbonProjects.recordFrameworkCheck, check),
    ).rejects.toThrow(/CARBON_FRAMEWORK_CHANGED/);
    await recycler.mutation(api.carbonProjects.recordFrameworkCheck, {
      ...check,
      framework: "puro",
      gate: "durable_removal_and_storage",
      status: "contradicted",
    });
    expect(
      await recycler.query(api.carbonProjects.frameworkScreenings, scope),
    ).toEqual(
      expect.arrayContaining([
        {
          framework: "verra",
          revision: 2,
          checks: [
            {
              gate: "method_and_version",
              status: "contradicted",
              reference: "TEST-D",
            },
          ],
        },
        {
          framework: "puro",
          revision: 1,
          checks: [
            {
              gate: "durable_removal_and_storage",
              status: "contradicted",
              reference: "TEST-A",
            },
          ],
        },
      ]),
    );
  });
});
