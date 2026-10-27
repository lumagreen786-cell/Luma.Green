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
import schema from "./schema";

const modules = convexModules(import.meta.glob("./**/*.*s"));
afterEach(() => vi.unstubAllEnvs());
async function world() {
  vi.stubEnv("AUTH_DEV_MODE", "true");
  const t = convexTest(schema, modules);
  registerAuth(t);
  await seedDemo(t);
  const owner = await signInAs(t, "+919000000101");
  const foreign = await signInAs(t, "+919000000102");
  return { t, owner, foreign };
}
const output = (grams: number) => ({
  materialCode: "PLASTIC-PET",
  state: "Measured sorted output",
  grams,
});

it("propagates partial acquisition cost and process costs into all outputs without changing inventory", async () => {
  const { t, owner } = await world();
  const lotId = await owner.mutation(api.traceability.declareLot, {
    materialCode: "PLASTIC-PET",
    state: "Measured intake",
    grams: 9,
    acquisitionCostPaise: 10,
    costReference: "RECORDED-INTAKE-COST",
  });
  const stockBefore = await t.run((ctx) => ctx.db.query("inventory").collect());
  const args = {
    inputLotId: lotId,
    inputGrams: 4,
    contaminationGrams: 1,
    processLossGrams: 0,
    processingCostPaise: 3,
    costReference: "RECORDED-PROCESS-COST",
    operationReference: "PROCESS-1",
    outputs: [output(2), output(1)],
  };
  const ids = await Promise.all([
    owner.mutation(api.traceability.transform, args),
    owner.mutation(api.traceability.transform, args),
  ]);
  expect(ids[0]).toBe(ids[1]);
  const history = await owner.query(api.traceability.history, { lotId });
  expect(history.lot).toMatchObject({
    initialCostPaise: 10,
    costPaise: 6,
    availableGrams: 5,
  });
  expect(history.transformations).toHaveLength(1);
  expect(history.transformations[0]).toMatchObject({
    processingCostPaise: 3,
    consumedInputCostPaise: 4,
    totalOutputCostPaise: 7,
  });
  const children = await t.run((ctx) =>
    ctx.db
      .query("materialLots")
      .withIndex("by_parent_transformation", (q) =>
        q.eq("parentTransformationId", ids[0]),
      )
      .collect(),
  );
  expect(children.map(({ costPaise }) => costPaise)).toEqual([5, 2]);
  const production = await owner.query(api.production.mine, {});
  expect(
    production.transformations.find(({ id }) => id === ids[0]),
  ).toMatchObject({ totalOutputCostPaise: 7, processingCostPaise: 3 });
  const audit = await t.run((ctx) =>
    ctx.db
      .query("auditLog")
      .withIndex("by_entity", (q) =>
        q.eq("entityTable", "lotTransformations").eq("entityId", ids[0]),
      )
      .collect(),
  );
  expect(audit).toHaveLength(1);
  expect(audit[0].metadata).toMatchObject({
    totalOutputCostPaise: 7,
    outputCosts: [5, 2],
    lossCostPolicy: "absorbed_by_measured_outputs",
  });
  await expect(
    owner.mutation(api.traceability.transform, {
      ...args,
      processingCostPaise: 4,
    }),
  ).rejects.toThrow("PROCESS_OPERATION_CONFLICT");
  await owner.mutation(api.traceability.transform, {
    inputLotId: lotId,
    inputGrams: 5,
    contaminationGrams: 0,
    processLossGrams: 0,
    processingCostPaise: 0,
    costReference: "EXPLICIT-ZERO-COST",
    operationReference: "PROCESS-2",
    outputs: [output(5)],
  });
  const exhausted = await owner.query(api.traceability.history, { lotId });
  expect(exhausted.lot).toMatchObject({ availableGrams: 0, costPaise: 0 });
  expect(await t.run((ctx) => ctx.db.query("inventory").collect())).toEqual(
    stockBefore,
  );
});

it("sums multiple known inputs and keeps unknown processing or acquisition costs unknown", async () => {
  const { owner } = await world();
  const declare = (grams: number, acquisitionCostPaise?: number) =>
    owner.mutation(api.traceability.declareLot, {
      materialCode: "PLASTIC-PET",
      state: "Measured intake",
      grams,
      acquisitionCostPaise,
      costReference:
        acquisitionCostPaise === undefined ? undefined : "RECORDED-COST",
    });
  const a = await declare(3, 1),
    b = await declare(4, 6),
    unknown = await declare(3);
  const id = await owner.mutation(api.traceability.transform, {
    inputLotId: a,
    inputGrams: 1,
    additionalInputs: [{ lotId: b, grams: 2 }],
    contaminationGrams: 0,
    processLossGrams: 0,
    processingCostPaise: 2,
    costReference: "RECORDED-PROCESS",
    outputs: [output(3)],
  });
  const known = await owner.query(api.traceability.history, { lotId: a });
  expect(known.transformations.find((event) => event.id === id)).toMatchObject({
    consumedInputCostPaise: 3,
    totalOutputCostPaise: 5,
  });
  await owner.mutation(api.traceability.transform, {
    inputLotId: unknown,
    inputGrams: 1,
    contaminationGrams: 0,
    processLossGrams: 0,
    processingCostPaise: 0,
    costReference: "RECORDED-ZERO",
    outputs: [output(1)],
  });
  const unknownHistory = await owner.query(api.traceability.history, {
    lotId: unknown,
  });
  expect(unknownHistory.transformations[0].totalOutputCostPaise).toBeNull();
  await owner.mutation(api.traceability.transform, {
    inputLotId: b,
    inputGrams: 1,
    contaminationGrams: 0,
    processLossGrams: 0,
    outputs: [output(1)],
  });
  const missingProcess = await owner.query(api.traceability.history, {
    lotId: b,
  });
  expect(
    missingProcess.transformations.at(-1)?.totalOutputCostPaise,
  ).toBeNull();
});

it("guards first acquisition entry, audits it once and rejects foreign or consumed cost restatement", async () => {
  const { t, owner, foreign } = await world();
  const lotId = await owner.mutation(api.traceability.declareLot, {
    materialCode: "PLASTIC-PET",
    state: "Intake",
    grams: 10,
  });
  const args = {
    lotId,
    acquisitionCostPaise: 0,
    costReference: "EXPLICIT-RECORDED-ZERO",
  };
  await expect(
    t.mutation(api.traceability.recordAcquisitionCost, args),
  ).rejects.toThrow(/NOT_SIGNED_IN/);
  await expect(
    foreign.mutation(api.traceability.recordAcquisitionCost, args),
  ).rejects.toThrow("LOT_NOT_FOUND");
  await owner.mutation(api.traceability.recordAcquisitionCost, args);
  await owner.mutation(api.traceability.recordAcquisitionCost, args);
  await expect(
    owner.mutation(api.traceability.recordAcquisitionCost, {
      ...args,
      acquisitionCostPaise: 1,
    }),
  ).rejects.toThrow("COST_ALREADY_RECORDED");
  const events = await t.run((ctx) =>
    ctx.db
      .query("auditLog")
      .withIndex("by_entity", (q) =>
        q.eq("entityTable", "materialLots").eq("entityId", lotId),
      )
      .collect(),
  );
  expect(
    events.filter(
      ({ action }) => action === "material_lot.acquisition_cost_recorded",
    ),
  ).toHaveLength(1);
  const unknown = await owner.mutation(api.traceability.declareLot, {
    materialCode: "PLASTIC-PET",
    state: "Intake",
    grams: 10,
  });
  await owner.mutation(api.traceability.transform, {
    inputLotId: unknown,
    inputGrams: 1,
    contaminationGrams: 0,
    processLossGrams: 0,
    outputs: [output(1)],
  });
  await expect(
    owner.mutation(api.traceability.recordAcquisitionCost, {
      ...args,
      lotId: unknown,
    }),
  ).rejects.toThrow("COST_BASIS_ALREADY_CONSUMED");
});

it("rolls back unsafe totals and concurrent overconsumption without losing cost or grams", async () => {
  const { t, owner } = await world();
  const lotId = await owner.mutation(api.traceability.declareLot, {
    materialCode: "PLASTIC-PET",
    state: "Intake",
    grams: 10,
    acquisitionCostPaise: Number.MAX_SAFE_INTEGER,
    costReference: "RECORDED-MAXIMUM",
  });
  const args = {
    inputLotId: lotId,
    inputGrams: 10,
    contaminationGrams: 0,
    processLossGrams: 0,
    processingCostPaise: 1,
    costReference: "RECORDED-PROCESS",
    outputs: [output(10)],
  };
  await expect(
    owner.mutation(api.traceability.transform, args),
  ).rejects.toThrow("COST_OVERFLOW");
  const overflowHistory = await owner.query(api.traceability.history, {
    lotId,
  });
  expect(overflowHistory.lot).toMatchObject({
    availableGrams: 10,
    costPaise: Number.MAX_SAFE_INTEGER,
  });
  const settled = await Promise.allSettled(
    ["ONE", "TWO"].map((operationReference) =>
      owner.mutation(api.traceability.transform, {
        ...args,
        inputGrams: 6,
        processingCostPaise: 0,
        outputs: [output(6)],
        operationReference,
      }),
    ),
  );
  expect(settled.filter(({ status }) => status === "fulfilled")).toHaveLength(
    1,
  );
  expect(settled.filter(({ status }) => status === "rejected")).toHaveLength(1);
  const after = await t.run((ctx) => ctx.db.get("materialLots", lotId));
  expect(after?.availableGrams).toBe(4);
});

it("keeps sender costs private before and after custody receipt", async () => {
  const { t, owner, foreign } = await world();
  const receiver = await t.run((ctx) =>
    ctx.db
      .query("orgs")
      .withIndex("by_kind_city", (q) =>
        q.eq("kind", "yard").eq("city", "Bengaluru"),
      )
      .first(),
  );
  if (!receiver) throw new Error("Missing recipient");
  const lotId = await owner.mutation(api.traceability.declareLot, {
    materialCode: "PLASTIC-PET",
    state: "Intake",
    grams: 3,
    acquisitionCostPaise: 42,
    costReference: "PRIVATE-SOURCE-COST",
  });
  await owner.mutation(api.traceability.dispatch, {
    lotId,
    receiverOrgId: receiver._id,
  });
  const pending = await foreign.query(api.traceability.history, { lotId });
  expect(pending.lot).not.toHaveProperty("costPaise");
  expect(pending.lot).not.toHaveProperty("costReference");
  await foreign.mutation(api.traceability.receive, { lotId, receivedGrams: 3 });
  const received = await foreign.query(api.traceability.history, { lotId });
  expect(received.lot.costPaise).toBeNull();
  expect(received.lot.costReference).toBeUndefined();
  await foreign.mutation(api.traceability.recordAcquisitionCost, {
    lotId,
    acquisitionCostPaise: 50,
    costReference: "RECIPIENT-ACQUISITION",
  });
  const acquired = await foreign.query(api.traceability.history, { lotId });
  expect(acquired.lot.costPaise).toBe(50);
});

it("excludes a sender's transformation costs from recipient history while allowing its own later costs", async () => {
  const { t, owner, foreign } = await world();
  const receiver = await t.run((ctx) =>
    ctx.db
      .query("orgs")
      .withIndex("by_kind_city", (q) =>
        q.eq("kind", "yard").eq("city", "Bengaluru"),
      )
      .first(),
  );
  if (!receiver) throw new Error("Missing recipient");
  const source = await owner.mutation(api.traceability.declareLot, {
    materialCode: "PLASTIC-PET",
    state: "Private intake",
    grams: 6,
    acquisitionCostPaise: 123_456_789,
    costReference: "PRIVATE-ACQUISITION-SOURCE",
  });
  await owner.mutation(api.traceability.transform, {
    inputLotId: source,
    inputGrams: 6,
    contaminationGrams: 0,
    processLossGrams: 0,
    processingCostPaise: 987_654,
    costReference: "PRIVATE-PROCESS-COST",
    outputs: [output(6)],
  });
  const sourceHistory = await owner.query(api.traceability.history, {
    lotId: source,
  });
  const child = sourceHistory.transformations[0].outputs[0].id;
  const inspect = {
    specificationReference: "Recorded buyer test",
    specificationVersion: "1",
    sampleMethod: "Recorded sample",
    decision: "accepted" as const,
    results: [{ parameter: "Recorded check", unit: "text", value: "accepted" }],
  };
  await owner.mutation(api.quality.recordInspection, {
    ...inspect,
    lotId: child,
  });
  await owner.mutation(api.traceability.dispatch, {
    lotId: child,
    receiverOrgId: receiver._id,
  });
  const pending = await foreign.query(api.traceability.history, {
    lotId: child,
  });
  expect(pending.transformations).toEqual([]);
  expect(pending.lot).not.toHaveProperty("costPaise");
  await foreign.mutation(api.traceability.receive, {
    lotId: child,
    receivedGrams: 6,
  });
  const received = await foreign.query(api.traceability.history, {
    lotId: child,
  });
  expect(received.lot).toMatchObject({
    sourceKind: "transformed",
    availableGrams: 6,
    costPaise: null,
  });
  expect(received.transformations).toEqual([]);
  await foreign.mutation(api.traceability.recordAcquisitionCost, {
    lotId: child,
    acquisitionCostPaise: 100,
    costReference: "RECIPIENT-OWN-COST",
  });
  await foreign.mutation(api.quality.recordInspection, {
    ...inspect,
    lotId: child,
  });
  await foreign.mutation(api.traceability.transform, {
    inputLotId: child,
    inputGrams: 3,
    contaminationGrams: 0,
    processLossGrams: 0,
    processingCostPaise: 1,
    costReference: "RECIPIENT-OWN-PROCESS",
    outputs: [output(3)],
  });
  const current = await foreign.query(api.traceability.history, {
    lotId: child,
  });
  expect(current.transformations).toHaveLength(1);
  expect(current.transformations[0]).toMatchObject({
    consumedInputCostPaise: 50,
    processingCostPaise: 1,
    totalOutputCostPaise: 51,
  });
  const encoded = JSON.stringify(current);
  for (const secret of [
    "PRIVATE-PROCESS-COST",
    "PRIVATE-ACQUISITION-SOURCE",
    "123456789",
    "987654",
    "124444443",
  ])
    expect(encoded).not.toContain(secret);
});

it("denies viewer cost writes and retry operations before accessing private cost data", async () => {
  const { t, owner } = await world();
  const lotId = await owner.mutation(api.traceability.declareLot, {
    materialCode: "PLASTIC-PET",
    state: "Intake",
    grams: 10,
  });
  await t.run(async (ctx) => {
    const lot = await ctx.db.get("materialLots", lotId);
    if (!lot) throw new Error("Missing lot");
    const member = await ctx.db
      .query("memberships")
      .withIndex("by_org", (q) => q.eq("orgId", lot.orgId))
      .first();
    if (!member) throw new Error("Missing member");
    await ctx.db.patch("memberships", member._id, { role: "viewer" });
  });
  await expect(
    owner.mutation(api.traceability.recordAcquisitionCost, {
      lotId,
      acquisitionCostPaise: 1,
      costReference: "RECORDED-COST",
    }),
  ).rejects.toThrow("WORKSPACE_PERMISSION_DENIED");
  await expect(
    owner.mutation(api.traceability.transform, {
      inputLotId: lotId,
      inputGrams: 1,
      contaminationGrams: 0,
      processLossGrams: 0,
      operationReference: "RETRY",
      outputs: [output(1)],
    }),
  ).rejects.toThrow("WORKSPACE_PERMISSION_DENIED");
});
