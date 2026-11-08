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
