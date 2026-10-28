/// <reference types="vite/client" />
// @vitest-environment edge-runtime
import { convexTest } from "convex-test";
import { afterEach, expect, it, vi } from "vitest";

import { api } from "./_generated/api";
import {
  convexModules,
  registerAuth,
  seedDemo,
  signInAs,
} from "./lib/auth.testing";
import { recipeTotal } from "./production";
import schema from "./schema";
const modules = convexModules(import.meta.glob("./**/*.*s"));
afterEach(() => vi.unstubAllEnvs());
async function world() {
  vi.stubEnv("AUTH_DEV_MODE", "true");
  const t = convexTest(schema, modules);
  registerAuth(t);
  await seedDemo(t);
  const owner = await signInAs(t, "+919000000102");
  const foreign = await signInAs(t, "+919000000103");
  const input = await owner.mutation(api.traceability.declareLot, {
    materialCode: "PLASTIC-PET",
    state: "Sorted",
    grams: 1001,
  });
  const transformed = await owner.mutation(api.traceability.transform, {
    inputLotId: input,
    inputGrams: 1001,
    contaminationGrams: 0,
    processLossGrams: 1,
    outputs: [
      { materialCode: "RECYCLED-PET-FLAKE", state: "Washed", grams: 1000 },
    ],
  });
  return { t, owner, foreign, input, transformed };
}
it("rejects fractional, duplicate and unbalanced recipe shares", () => {
  expect(() =>
    recipeTotal([{ name: "PET", basisPoints: 9999, additive: false }]),
  ).toThrow(/RECIPE_MUST_TOTAL/);
  expect(() =>
    recipeTotal([{ name: "PET", basisPoints: 9999.5, additive: false }]),
  ).toThrow(/INVALID_RECIPE/);
  expect(() =>
    recipeTotal([
      { name: "PET", basisPoints: 5000, additive: false },
      { name: "pet", basisPoints: 5000, additive: true },
    ]),
  ).toThrow(/INVALID_RECIPE/);
});
it("keeps recipe revisions immutable and identical retries idempotent", async () => {
  const { owner, foreign } = await world();
  const args = {
    reference: "REC-1",
    version: "1",
    name: "PET recipe",
    instructions: "Follow measured process record",
    ingredients: [{ name: "PET", basisPoints: 10_000, additive: false }],
  };
  const id = await owner.mutation(api.production.recordRecipe, args);
  expect(await owner.mutation(api.production.recordRecipe, args)).toBe(id);
  await expect(
    owner.mutation(api.production.recordRecipe, { ...args, name: "Changed" }),
  ).rejects.toThrow(/RECIPE_VERSION_EXISTS/);
  const foreignData = await foreign.query(api.production.mine, {});
  expect(foreignData.recipes).toHaveLength(0);
});
it("binds every declared input and output inspection without moving inventory", async () => {
  const { t, owner, foreign, input, transformed } = await world();
  const output = await t.run((ctx) =>
    ctx.db
      .query("materialLots")
      .withIndex("by_parent_transformation", (q) =>
        q.eq("parentTransformationId", transformed),
      )
      .first(),
  );
  if (!output) throw new Error("Missing output");
  const inspectionId = await owner.mutation(api.quality.recordInspection, {
    lotId: output._id,
    specificationReference: "Output specification",
    specificationVersion: "1",
    sampleMethod: "Composite sample",
    results: [{ parameter: "Moisture", unit: "percent", value: "1" }],
    decision: "accepted",
  });
  const recipeId = await owner.mutation(api.production.recordRecipe, {
    reference: "REC-1",
    version: "1",
    name: "PET recipe",
    instructions: "Measured input evidence",
    ingredients: [{ name: "PET", basisPoints: 10_000, additive: false }],
  });
  const before = await t.run((ctx) => ctx.db.query("inventory").collect());
  const args = {
    reference: "BATCH-1",
    recipeId,
    transformationId: transformed,
    inspectionId,
    inputs: [
      {
        lotId: input,
        grams: 1001,
        recycledGrams: 1000,
        evidenceReference: "Supplier provenance TEST-1",
        additive: false,
      },
    ],
    evidenceReference: "Production TEST-1",
  };
  const rejectedInspection = await owner.mutation(
    api.quality.recordInspection,
    {
      lotId: output._id,
      specificationReference: "Rejected test",
      specificationVersion: "1",
      sampleMethod: "Composite sample",
      results: [{ parameter: "Moisture", unit: "percent", value: "20" }],
      decision: "rejected",
    },
  );
  await expect(
    owner.mutation(api.production.declareBatch, {
      ...args,
      inspectionId: rejectedInspection,
    }),
  ).rejects.toThrow(/QUALITY_RELEASE_REQUIRED/);
  const id = await owner.mutation(api.production.declareBatch, args);
  expect(await owner.mutation(api.production.declareBatch, args)).toBe(id);
  const production = await owner.query(api.production.mine, {});
  expect(production.batches[0]).toMatchObject({
    recycledInputGrams: 1000,
    recycledInputBasisPoints: 9990,
    outputGrams: 1000,
  });
  expect(await t.run((ctx) => ctx.db.query("inventory").collect())).toEqual(
    before,
  );
  await expect(
    foreign.mutation(api.production.declareBatch, args),
  ).rejects.toThrow(/PRODUCTION_RECORD_NOT_FOUND/);
  const first = args.inputs[0];
  await expect(
    owner.mutation(api.production.declareBatch, {
      ...args,
      reference: "BATCH-2",
      inputs: [{ ...first, recycledGrams: 1002 }],
    }),
  ).rejects.toThrow(/PRODUCTION_INPUT_MISMATCH/);
  await expect(
    owner.mutation(api.production.declareBatch, {
      ...args,
      reference: "BATCH-2",
    }),
  ).rejects.toThrow(/PRODUCTION_ALREADY_DECLARED/);
});
