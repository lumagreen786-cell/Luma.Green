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
import {
  hasQualityRelease,
  isCurrentAcceptedInspection,
} from "./lib/qualityRelease";
import schema from "./schema";

const modules = convexModules(import.meta.glob("./**/*.*s"));

async function world() {
  vi.stubEnv("AUTH_DEV_MODE", "true");
  const t = convexTest(schema, modules);
  registerAuth(t);
  await seedDemo(t);
  const inspector = await signInAs(t, "+919000000101");
  const owner = await signInAs(t, "+919000000102");
  const recycler = await signInAs(t, "+919000000103");
  const orgIds = await t.run(async (ctx) => {
    const yard = await ctx.db
      .query("orgs")
      .withIndex("by_kind_city", (q) =>
        q.eq("kind", "yard").eq("city", "Bengaluru"),
      )
      .first();
    if (!yard) throw new Error("Seeded yard missing");
    const shop = await ctx.db
      .query("orgs")
      .withIndex("by_kind_city", (q) =>
        q.eq("kind", "kabadiwala").eq("city", "Bengaluru"),
      )
      .first();
    if (!shop) throw new Error("Seeded shop missing");
    const recycler = await ctx.db
      .query("orgs")
      .withIndex("by_kind_city", (q) =>
        q.eq("kind", "recycler").eq("city", "Bengaluru"),
      )
      .first();
    if (!recycler) throw new Error("Seeded recycler missing");
    const shopMembership = await ctx.db
      .query("memberships")
      .withIndex("by_org", (q) => q.eq("orgId", shop._id))
      .first();
    if (!shopMembership) throw new Error("Seeded shop owner missing");
    await ctx.db.delete("memberships", shopMembership._id);
    await ctx.db.insert("memberships", {
      profileId: shopMembership.profileId,
      orgId: yard._id,
      role: "staff",
      createdAt: Date.now(),
    });
    return { yardId: yard._id, recyclerId: recycler._id };
  });
  const lotId = await owner.mutation(api.traceability.declareLot, {
    materialCode: "PLASTIC-PET",
    state: "PET-BALE",
    grams: 10_000,
  });
  return { t, inspector, owner, recycler, ...orgIds, lotId };
}

afterEach(() => vi.unstubAllEnvs());

describe("quality holds on processed PET", () => {
  it("honors a failed inspection on an otherwise uninspected declared lot", async () => {
    const { owner, inspector, lotId, recyclerId } = await world();
    const before = await owner.query(api.traceability.history, { lotId });
    expect(before.lot.qualityReleased).toBe(true);
    await inspector.mutation(api.quality.recordInspection, {
      lotId,
      specificationReference: "Declared PET specification",
      specificationVersion: "1",
      sampleMethod: "Composite sample",
      results: [{ parameter: "PVC", unit: "ppm", value: "180" }],
      decision: "rejected",
    });
    const after = await owner.query(api.traceability.history, { lotId });
    expect(after.lot.qualityReleased).toBe(false);
    await expect(
      owner.mutation(api.traceability.dispatch, {
        lotId,
        receiverOrgId: recyclerId,
      }),
    ).rejects.toThrow("QUALITY_RELEASE_REQUIRED");
  });

  async function processedLot() {
    const context = await world();
    const transformationId = await context.owner.mutation(
      api.traceability.transform,
      {
        inputLotId: context.lotId,
        inputGrams: 10_000,
        contaminationGrams: 0,
        processLossGrams: 0,
        outputs: [
          {
            materialCode: "PLASTIC-PET",
            state: "Sorted PET",
            grams: 10_000,
            handlingClass: "non_hazardous",
            streamClass: "main_product",
          },
        ],
      },
    );
    const lot = await context.t.run((ctx) =>
      ctx.db
        .query("materialLots")
        .withIndex("by_parent_transformation", (q) =>
          q.eq("parentTransformationId", transformationId),
        )
        .unique(),
    );
    if (!lot) throw new Error("Processed fixture lot missing");
    const inspection = {
      lotId: lot._id,
      buyerOrgId: context.recyclerId,
      specificationReference: "Buyer PET specification",
      specificationVersion: "2026-11",
      sampleMethod: "Composite sample",
      results: [{ parameter: "PVC", unit: "ppm", value: "80" }],
      decision: "accepted" as const,
    };
    const accepted = await context.inspector.mutation(
      api.quality.recordInspection,
      inspection,
    );
    return { ...context, lot, inspection, accepted };
  }

  it.each(["rejected", "conditional"] as const)(
    "holds a lot with a %s result under the accepted specification",
    async (decision) => {
      const { t, inspector, owner, recyclerId, lot, inspection, accepted } =
        await processedLot();
      await inspector.mutation(api.quality.recordInspection, {
        ...inspection,
        decision,
        results: [{ parameter: "PVC", unit: "ppm", value: "180" }],
      });
      await inspector.mutation(api.quality.recordInspection, inspection);
      expect(await t.run((ctx) => hasQualityRelease(ctx, lot, accepted))).toBe(
        false,
      );
      const history = await owner.query(api.traceability.history, {
        lotId: lot._id,
      });
      expect(history.lot.qualityReleased).toBe(false);
      await expect(
        owner.mutation(api.traceability.dispatch, {
          lotId: lot._id,
          receiverOrgId: recyclerId,
        }),
      ).rejects.toThrow("QUALITY_RELEASE_REQUIRED");
      await expect(
        owner.mutation(api.traceability.transform, {
          inputLotId: lot._id,
          inputGrams: 1000,
          contaminationGrams: 0,
          processLossGrams: 0,
          outputs: [
            { materialCode: "PLASTIC-PET", state: "Baled PET", grams: 1000 },
          ],
        }),
      ).rejects.toThrow("QUALITY_RELEASE_REQUIRED");
      expect(
        await t.run((ctx) => ctx.db.get("materialLots", lot._id)),
      ).toMatchObject({ status: "available", availableGrams: 10_000 });
    },
  );

  it("requires approval to resolve a failed result and retains the inspection history", async () => {
    const { t, inspector, owner, recyclerId, lot, inspection, accepted } =
      await processedLot();
    const rejected = await inspector.mutation(api.quality.recordInspection, {
      ...inspection,
      decision: "rejected",
    });
    const correction = await inspector.mutation(api.quality.proposeCorrection, {
      ...inspection,
      supersedesInspectionId: rejected,
      reason: "Independent lab corrected the sample result",
    });
    expect(await t.run((ctx) => hasQualityRelease(ctx, lot, accepted))).toBe(
      false,
    );
    await owner.mutation(api.quality.approveCorrection, {
      inspectionId: correction,
    });
    expect(await t.run((ctx) => hasQualityRelease(ctx, lot, correction))).toBe(
      true,
    );
    const results = await owner.query(api.quality.forLot, { lotId: lot._id });
    expect(results.rows.find((row) => row.id === rejected)).toMatchObject({
      decision: "rejected",
      isSuperseded: true,
    });
    await owner.mutation(api.traceability.dispatch, {
      lotId: lot._id,
      receiverOrgId: recyclerId,
    });
  });

  it("keeps other buyers and specification revisions separate", async () => {
    const { t, inspector, lot, inspection, accepted } = await processedLot();
    await inspector.mutation(api.quality.recordInspection, {
      ...inspection,
      buyerOrgId: undefined,
      decision: "rejected",
    });
    await inspector.mutation(api.quality.recordInspection, {
      ...inspection,
      specificationVersion: "2025-11",
      decision: "conditional",
    });
    expect(await t.run((ctx) => hasQualityRelease(ctx, lot, accepted))).toBe(
      true,
    );
  });
});

describe("buyer-specific lot inspections", () => {
  it("keeps the original result immutable through correction and separate approval", async () => {
    const { t, inspector, owner, recyclerId, lotId } = await world();
    const initial = await inspector.mutation(api.quality.recordInspection, {
      lotId,
      buyerOrgId: recyclerId,
      specificationReference: "Buyer PET bale specification",
      specificationVersion: "2026-10",
      sampleMethod: "Five-bale composite",
      results: [{ parameter: "PVC", unit: "ppm", value: "80" }],
      decision: "accepted",
      evidenceReference: "Lab report 42",
    });
    const corrected = await inspector.mutation(api.quality.proposeCorrection, {
      lotId,
      buyerOrgId: recyclerId,
      supersedesInspectionId: initial,
      reason: "Lab issued corrected PVC value",
      specificationReference: "Buyer PET bale specification",
      specificationVersion: "2026-10",
      sampleMethod: "Five-bale composite",
      results: [{ parameter: "PVC", unit: "ppm", value: "180" }],
      decision: "rejected",
      evidenceReference: "Corrected lab report 43",
    });
    await expect(
      inspector.mutation(api.quality.approveCorrection, {
        inspectionId: corrected,
      }),
    ).rejects.toThrow(/SELF_APPROVAL_FORBIDDEN/);
    const pending = await owner.query(api.quality.forLot, { lotId });
    expect(
      pending.rows.find((row) => row.id === corrected)?.approvedByProfileId,
    ).toBeUndefined();
    const releasable = () =>
      t.run(async (ctx) => {
        const record = await ctx.db.get("lotInspections", initial);
        if (!record) throw new Error("Missing inspection");
        return isCurrentAcceptedInspection(ctx, record);
      });
    expect(await releasable()).toBe(true);
    await owner.mutation(api.quality.approveCorrection, {
      inspectionId: corrected,
    });
    expect(await releasable()).toBe(false);
    const { rows } = await owner.query(api.quality.forLot, { lotId });
    expect(rows.find((row) => row.id === initial)).toMatchObject({
      decision: "accepted",
      buyerOrgId: recyclerId,
      assessmentScope: "inspecting_org",
      results: [{ parameter: "PVC", unit: "ppm", value: "80" }],
    });
    expect(rows.find((row) => row.id === corrected)).toMatchObject({
      decision: "rejected",
      correctionReason: "Lab issued corrected PVC value",
      supersedesInspectionId: initial,
      results: [{ parameter: "PVC", unit: "ppm", value: "180" }],
    });
    expect(
      rows.find((row) => row.id === corrected)?.approvedByProfileId,
    ).toBeDefined();
    await expect(
      owner.mutation(api.quality.approveCorrection, {
        inspectionId: corrected,
      }),
    ).rejects.toThrow(/INSPECTION_SUPERSEDED/);
    expect(
      await t.run(async (ctx) =>
        ctx.db
          .query("lotInspectionApprovals")
          .withIndex("by_inspection", (q) => q.eq("inspectionId", corrected))
          .collect(),
      ),
    ).toHaveLength(1);
  });

  it("denies unrelated organisations and rejects a changed correction specification", async () => {
    const { inspector, recycler, lotId } = await world();
    const initial = await inspector.mutation(api.quality.recordInspection, {
      lotId,
      specificationReference: "Spec A",
      specificationVersion: "1",
      sampleMethod: "Composite",
      results: [{ parameter: "Moisture", unit: "%", value: "0.2" }],
      decision: "conditional",
    });
    await expect(recycler.query(api.quality.forLot, { lotId })).rejects.toThrow(
      /LOT_NOT_FOUND/,
    );
    await expect(
      recycler.mutation(api.quality.recordInspection, {
        lotId,
        specificationReference: "Spec A",
        specificationVersion: "1",
        sampleMethod: "Composite",
        results: [{ parameter: "Moisture", unit: "%", value: "0.2" }],
        decision: "accepted",
      }),
    ).rejects.toThrow(/LOT_NOT_FOUND/);
    await expect(
      inspector.mutation(api.quality.proposeCorrection, {
        lotId,
        supersedesInspectionId: initial,
        reason: "Use newer spec",
        specificationReference: "Spec A",
        specificationVersion: "2",
        sampleMethod: "Composite",
        results: [{ parameter: "Moisture", unit: "%", value: "0.2" }],
        decision: "accepted",
      }),
    ).rejects.toThrow(/CORRECTION_SCOPE_CHANGED/);
  });
});

it("reports correction and approval permissions without hiding superseded evidence", async () => {
  const { t, inspector, owner, yardId, lotId } = await world();
  const fields = {
    lotId,
    specificationReference: "Measured specification",
    specificationVersion: "1",
    sampleMethod: "Composite",
    results: [{ parameter: "Moisture", unit: "%", value: "2" }],
    decision: "accepted" as const,
  };
  const original = await inspector.mutation(
    api.quality.recordInspection,
    fields,
  );
  const correction = await inspector.mutation(api.quality.proposeCorrection, {
    ...fields,
    supersedesInspectionId: original,
    reason: "Measurement correction",
  });
  const queried1 = await inspector.query(api.quality.forLot, { lotId });
  expect(queried1.rows.find((row) => row.id === correction)).toMatchObject({
    canApprove: false,
    canCorrect: false,
    isSuperseded: false,
  });
  const queried2 = await owner.query(api.quality.forLot, { lotId });
  expect(queried2.rows.find((row) => row.id === correction)).toMatchObject({
    canApprove: true,
    canCorrect: false,
  });
  await owner.mutation(api.quality.approveCorrection, {
    inspectionId: correction,
  });
  const { rows } = await owner.query(api.quality.forLot, { lotId });
  expect(rows.find((row) => row.id === original)).toMatchObject({
    canCorrect: false,
    isSuperseded: true,
  });
  expect(rows.find((row) => row.id === correction)).toMatchObject({
    canApprove: false,
    canCorrect: true,
  });
  await t.run(async (ctx) => {
    const membership = await ctx.db
      .query("memberships")
      .withIndex("by_org", (q) => q.eq("orgId", yardId))
      .collect();
    for (const row of membership)
      await ctx.db.patch("memberships", row._id, { role: "viewer" });
  });
  const queried3 = await inspector.query(api.quality.forLot, { lotId });
  expect(queried3.rows.every((row) => !row.canCorrect && !row.canApprove)).toBe(
    true,
  );
});
