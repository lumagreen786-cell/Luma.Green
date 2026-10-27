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
  const shop = await signInAs(t, "+919000000101");
  const yard = await signInAs(t, "+919000000102");
  const recycler = await signInAs(t, "+919000000103");
  const orgs = await t.run(async (ctx) => {
    const all = await ctx.db.query("orgs").collect();
    return {
      shop: all.find((org) => org.kind === "kabadiwala")!._id,
      yard: all.find((org) => org.kind === "yard")!._id,
      recycler: all.find((org) => org.kind === "recycler")!._id,
    };
  });
  return { t, shop, yard, recycler, orgs };
}

afterEach(() => vi.unstubAllEnvs());

describe("physical lot evidence", () => {
  it("keeps a declared lot separate from authoritative stock and audit-logs it", async () => {
    const { t, shop } = await world();
    const before = await shop.query(api.stock.mine, {});
    const lotId = await shop.mutation(api.traceability.declareLot, {
      materialCode: "PLASTIC-PET",
      state: "PET-BOTTLE-SORTED",
      grams: 10_000,
      sourceReference: "Intake slip 12",
    });
    const after = await shop.query(api.stock.mine, {});
    expect(after.totalGrams).toBe(before.totalGrams);
    const history = await shop.query(api.traceability.history, { lotId });
    expect(history.lot).toMatchObject({
      sourceKind: "self_declared",
      initialGrams: 10_000,
      availableGrams: 10_000,
    });
    expect(
      await t.run(async (ctx) =>
        ctx.db
          .query("auditLog")
          .withIndex("by_entity", (q) =>
            q.eq("entityTable", "materialLots").eq("entityId", lotId),
          )
          .first(),
      ),
    ).toMatchObject({ action: "material_lot.declared" });
    for (const grams of [0, 0.5, Number.MAX_SAFE_INTEGER + 1]) {
      await expect(
        shop.mutation(api.traceability.declareLot, {
          materialCode: "PLASTIC-PET",
          state: "PET-BALE",
          grams,
        }),
      ).rejects.toThrow(/INVALID_WEIGHT/);
    }
  });

  it("records exact custody without treating a weight disagreement as receipt", async () => {
    const { shop, yard, recycler, orgs } = await world();
    const lotId = await shop.mutation(api.traceability.declareLot, {
      materialCode: "PLASTIC-PET",
      state: "PET-BALE",
      grams: 10_000,
    });
    await expect(
      recycler.query(api.traceability.history, { lotId }),
    ).rejects.toThrow(/LOT_NOT_FOUND/);
    await expect(
      yard.mutation(api.traceability.dispatch, {
        lotId,
        receiverOrgId: orgs.recycler,
      }),
    ).rejects.toThrow(/LOT_NOT_FOUND/);
    await shop.mutation(api.traceability.dispatch, {
      lotId,
      receiverOrgId: orgs.yard,
    });
    await expect(
      shop.mutation(api.traceability.dispatch, {
        lotId,
        receiverOrgId: orgs.yard,
      }),
    ).rejects.toThrow(/LOT_NOT_AVAILABLE/);
    await expect(
      yard.mutation(api.traceability.receive, { lotId, receivedGrams: 9999 }),
    ).rejects.toThrow(/WEIGHT_DISPUTE/);
    await expect(
      recycler.mutation(api.traceability.receive, {
        lotId,
        receivedGrams: 10_000,
      }),
    ).rejects.toThrow(/LOT_NOT_PENDING_FOR_ORG/);
    await yard.mutation(api.traceability.receive, {
      lotId,
      receivedGrams: 10_000,
    });
    const history = await yard.query(api.traceability.history, { lotId });
    expect(history.custody.map((event) => event.kind)).toEqual([
      "dispatched",
      "received",
    ]);
    expect(history.custody.map((event) => event.grams)).toEqual([
      10_000, 10_000,
    ]);
    await expect(
      shop.query(api.traceability.history, { lotId }),
    ).rejects.toThrow(/LOT_NOT_FOUND/);
  });

  it("creates PET and side-stream child lots with exact mass balance", async () => {
    const { t, shop } = await world();
    const lotId = await shop.mutation(api.traceability.declareLot, {
      materialCode: "PLASTIC-PET",
      state: "PET-BALE",
      grams: 10_000,
    });
    const request = {
      inputLotId: lotId,
      inputGrams: 8000,
      contaminationGrams: 500,
      processLossGrams: 500,
      outputs: [
        {
          materialCode: "RECYCLED-PET-FLAKE",
          state: "PET-FLAKE-HOT-WASHED",
          grams: 6000,
        },
        {
          materialCode: "PLASTIC-PP",
          state: "PP-FLOAT-FRACTION",
          grams: 1000,
        },
      ],
    };
    await expect(
      shop.mutation(api.traceability.transform, {
        ...request,
        outputs: [{ ...request.outputs[0], grams: 6001 }, request.outputs[1]],
      }),
    ).rejects.toThrow(/MASS_BALANCE_MISMATCH/);
    const transformationId = await shop.mutation(
      api.traceability.transform,
      request,
    );
    const history = await shop.query(api.traceability.history, { lotId });
    expect(history.lot.availableGrams).toBe(2000);
    expect(history.transformations[0]).toMatchObject({
      id: transformationId,
      inputGrams: 8000,
      contaminationGrams: 500,
      processLossGrams: 500,
    });
    expect(
      history.transformations[0].outputs.map((output) => output.grams),
    ).toEqual([6000, 1000]);
    const childId = history.transformations[0].outputs[0].id;
    const childHistory = await shop.query(api.traceability.history, {
      lotId: childId,
    });
    expect(childHistory.lot).toMatchObject({
      sourceKind: "transformed",
      initialGrams: 6000,
    });
    await expect(
      shop.mutation(api.traceability.transform, {
        ...request,
        inputGrams: 8000,
      }),
    ).rejects.toThrow(/NOT_ENOUGH_LOT_GRAMS/);
    expect(
      await t.run(async (ctx) =>
        ctx.db
          .query("lotTransformations")
          .withIndex("by_input_lot_created", (q) => q.eq("inputLotId", lotId))
          .collect(),
      ),
    ).toHaveLength(1);
  });
});

describe("lot evidence read boundaries", () => {
  it("gives a pending recipient only its dispatch, then removes the previous holder's detail access", async () => {
    const { shop, yard, recycler, orgs } = await world();
    const lotId = await shop.mutation(api.traceability.declareLot, {
      materialCode: "PET",
      state: "Bale",
      grams: 1000,
      sourceReference: "Private source reference",
    });
    await shop.mutation(api.quality.recordInspection, {
      lotId,
      specificationReference: "Private buyer specification",
      specificationVersion: "1",
      sampleMethod: "Measured sample",
      results: [{ parameter: "Moisture", unit: "%", value: "2" }],
      decision: "conditional",
    });
    await shop.mutation(api.traceability.dispatch, {
      lotId,
      receiverOrgId: orgs.yard,
    });
    const queried1 = await yard.query(api.traceability.incoming, {});
    expect(queried1.rows).toEqual([
      expect.objectContaining({ id: lotId, grams: 1000 }),
    ]);
    const pending = await yard.query(api.traceability.history, { lotId });
    expect(pending.access).toBe("pending_receiver");
    expect(pending.lot.sourceReference).toBeUndefined();
    expect(pending.custody).toHaveLength(1);
    expect(pending.transformations).toEqual([]);
    await expect(yard.query(api.quality.forLot, { lotId })).rejects.toThrow(
      /LOT_NOT_FOUND/,
    );
    await expect(
      recycler.query(api.traceability.history, { lotId }),
    ).rejects.toThrow(/LOT_NOT_FOUND/);
    const queried2 = await recycler.query(api.traceability.incoming, {});
    expect(queried2.rows).toEqual([]);
    await yard.mutation(api.traceability.receive, {
      lotId,
      receivedGrams: 1000,
    });
    const queried3 = await yard.query(api.traceability.incoming, {});
    expect(queried3.rows).toEqual([]);
    await expect(
      shop.query(api.traceability.history, { lotId }),
    ).rejects.toThrow(/LOT_NOT_FOUND/);
    await yard.mutation(api.traceability.transform, {
      inputLotId: lotId,
      inputGrams: 1000,
      contaminationGrams: 0,
      processLossGrams: 0,
      outputs: [
        {
          materialCode: "Private output",
          state: "Private process",
          grams: 1000,
        },
      ],
    });
    const sent = await shop.query(api.traceability.sent, {});
    expect(
      sent.rows.map((row) => row.kind).toSorted((a, b) => a.localeCompare(b)),
    ).toEqual(["dispatched", "received"]);
    expect(sent.rows.every((row) => row.grams === 1000)).toBe(true);
    expect(JSON.stringify(sent)).not.toMatch(
      /Private output|Private process|Private buyer specification/,
    );
  });

  it("lists only active businesses in the selected city and exposes no contacts", async () => {
    const { t, shop, orgs } = await world();
    const directory = await shop.query(api.traceability.recipientOptions, {
      kind: "yard",
      city: " Bengaluru ",
    });
    expect(directory.rows.map((row) => row.id)).toContain(orgs.yard);
    expect(
      Object.keys(directory.rows[0]).toSorted((a, b) => a.localeCompare(b)),
    ).toEqual(["area", "city", "id", "kind", "name"]);
    const queried4 = await shop.query(api.traceability.recipientOptions, {
      kind: "yard",
      city: "Unknown city",
    });
    expect(queried4.rows).toEqual([]);
    await t.run((ctx) =>
      ctx.db.patch("orgs", orgs.yard, { status: "suspended" }),
    );
    const queried5 = await shop.query(api.traceability.recipientOptions, {
      kind: "yard",
      city: "Bengaluru",
    });
    expect(queried5.rows.map((row) => row.id)).not.toContain(orgs.yard);
  });

  it("permits viewer reads while rejecting every operational path", async () => {
    const { t, shop, orgs } = await world();
    const lotId = await shop.mutation(api.traceability.declareLot, {
      materialCode: "PET",
      state: "Bale",
      grams: 1000,
    });
    await t.run(async (ctx) => {
      const membership = await ctx.db
        .query("memberships")
        .withIndex("by_org", (q) => q.eq("orgId", orgs.shop))
        .first();
      if (!membership) throw new Error("Missing membership");
      await ctx.db.patch("memberships", membership._id, { role: "viewer" });
    });
    const queried6 = await shop.query(api.traceability.mine, {});
    expect(queried6.rows).toHaveLength(1);
    const queried7 = await shop.query(api.traceability.history, { lotId });
    expect(queried7.access).toBe("holder");
    await shop.query(api.traceability.incoming, {});
    await shop.query(api.traceability.sent, {});
    await shop.query(api.traceability.recipientOptions, {
      kind: "yard",
      city: "Bengaluru",
    });
    await expect(
      shop.mutation(api.traceability.declareLot, {
        materialCode: "PET",
        state: "Bale",
        grams: 1,
      }),
    ).rejects.toThrow(/WORKSPACE_PERMISSION_DENIED/);
    await expect(
      shop.mutation(api.traceability.dispatch, {
        lotId,
        receiverOrgId: orgs.yard,
      }),
    ).rejects.toThrow(/WORKSPACE_PERMISSION_DENIED/);
    await expect(
      shop.mutation(api.traceability.receive, { lotId, receivedGrams: 1000 }),
    ).rejects.toThrow(/WORKSPACE_PERMISSION_DENIED/);
    await expect(
      shop.mutation(api.traceability.transform, {
        inputLotId: lotId,
        inputGrams: 1000,
        contaminationGrams: 0,
        processLossGrams: 0,
        outputs: [{ materialCode: "PET", state: "Flake", grams: 1000 }],
      }),
    ).rejects.toThrow(/WORKSPACE_PERMISSION_DENIED/);
  });

  it("bounds directory and incoming results and reports truncation", async () => {
    const { t, shop, yard, orgs } = await world();
    await t.run(async (ctx) => {
      const existing = await ctx.db.get("orgs", orgs.yard);
      if (!existing) throw new Error("Missing org");
      const { _id, _creationTime, ...fields } = existing;
      for (let index = 0; index < 101; index++) {
        await ctx.db.insert("orgs", {
          ...fields,
          slug: `bounded-${String(index)}`,
          name: `Test receiver ${String(index)}`,
        });
        const lotId = await ctx.db.insert("materialLots", {
          orgId: orgs.shop,
          declaredByOrgId: orgs.shop,
          materialCode: "PET",
          state: "Bale",
          sourceKind: "self_declared",
          initialGrams: 1000,
          availableGrams: 1000,
          status: "in_transit",
          pendingReceiverOrgId: orgs.yard,
          createdByProfileId: fields.ownerProfileId!,
          createdAt: index,
          updatedAt: index,
        });
        const dispatchId = await ctx.db.insert("lotCustodyEvents", {
          lotId,
          kind: "dispatched",
          fromOrgId: orgs.shop,
          toOrgId: orgs.yard,
          grams: 1000,
          actorProfileId: fields.ownerProfileId!,
          createdAt: index,
        });
        await ctx.db.patch("materialLots", lotId, {
          pendingDispatchId: dispatchId,
        });
      }
    });
    expect(
      await shop.query(api.traceability.recipientOptions, {
        kind: "yard",
        city: "Bengaluru",
      }),
    ).toMatchObject({ rows: expect.any(Array), hasMore: true });
    const queried8 = await shop.query(api.traceability.recipientOptions, {
      kind: "yard",
      city: "Bengaluru",
    });
    expect(queried8.rows).toHaveLength(100);
    const queried9 = await yard.query(api.traceability.incoming, {});
    expect(queried9.rows).toHaveLength(100);
    const queried10 = await yard.query(api.traceability.incoming, {});
    expect(queried10.hasMore).toBe(true);
    const queried11 = await shop.query(api.traceability.sent, {});
    expect(queried11.rows).toHaveLength(100);
    const queried12 = await shop.query(api.traceability.sent, {});
    expect(queried12.hasMore).toBe(true);
  });
});

it("cannot consume the same measured grams through concurrent transformations", async () => {
  const { shop } = await world();
  const lotId = await shop.mutation(api.traceability.declareLot, {
    materialCode: "PET",
    state: "Bale",
    grams: 1000,
  });
  const request = {
    inputLotId: lotId,
    inputGrams: 700,
    contaminationGrams: 0,
    processLossGrams: 0,
    outputs: [{ materialCode: "PET", state: "Flake", grams: 700 }],
  };
  const outcomes = await Promise.allSettled([
    shop.mutation(api.traceability.transform, request),
    shop.mutation(api.traceability.transform, request),
  ]);
  expect(
    outcomes.filter((outcome) => outcome.status === "fulfilled"),
  ).toHaveLength(1);
  const history = await shop.query(api.traceability.history, { lotId });
  expect(history.lot.availableGrams).toBe(300);
  expect(history.transformations).toHaveLength(1);
  expect(history.transformations[0].outputs[0].grams).toBe(700);
});

it("requires active business membership even when the caller knows a lot identifier", async () => {
  const { t, shop, orgs } = await world();
  const lotId = await shop.mutation(api.traceability.declareLot, {
    materialCode: "PET",
    state: "Bale",
    grams: 1000,
  });
  await expect(
    t.query(api.traceability.recipientOptions, {
      kind: "yard",
      city: "Bengaluru",
    }),
  ).rejects.toThrow(/NOT_SIGNED_IN/);
  await t.run(async (ctx) => {
    const memberships = await ctx.db
      .query("memberships")
      .withIndex("by_org", (q) => q.eq("orgId", orgs.shop))
      .collect();
    for (const membership of memberships)
      await ctx.db.delete("memberships", membership._id);
  });
  await expect(shop.query(api.traceability.mine, {})).rejects.toThrow(
    /NO_BUSINESS/,
  );
  await expect(shop.query(api.traceability.incoming, {})).rejects.toThrow(
    /NO_BUSINESS/,
  );
  await expect(shop.query(api.traceability.sent, {})).rejects.toThrow(
    /NO_BUSINESS/,
  );
  await expect(shop.query(api.traceability.history, { lotId })).rejects.toThrow(
    /NO_BUSINESS/,
  );
  await expect(shop.query(api.quality.forLot, { lotId })).rejects.toThrow(
    /NO_BUSINESS/,
  );
});

describe("classified process and residual evidence", () => {
  it("snapshots declared facility processes and independently classifies measured outputs", async () => {
    const { shop, yard } = await world();
    const facilityId = await shop.mutation(api.industrialProfiles.save, {
      name: "PET line",
      siteReference: "Site A",
      capabilities: ["washing"],
    });
    const foreign = await yard.mutation(api.industrialProfiles.save, {
      name: "Foreign",
      siteReference: "Site B",
      capabilities: ["washing"],
    });
    const inputLotId = await shop.mutation(api.traceability.declareLot, {
      materialCode: "PET",
      state: "Bale",
      grams: 1000,
      streamClass: "recoverable_waste",
      handlingClass: "non_hazardous",
    });
    const args = {
      inputLotId,
      inputGrams: 1000,
      contaminationGrams: 0,
      processLossGrams: 100,
      outputs: [
        {
          materialCode: "PET",
          state: "Flake",
          grams: 800,
          streamClass: "main_product" as const,
          handlingClass: "non_hazardous" as const,
        },
        {
          materialCode: "SLUDGE",
          state: "Residue",
          grams: 100,
          streamClass: "residual_waste" as const,
          handlingClass: "controlled" as const,
        },
      ],
    };
    await expect(
      shop.mutation(api.traceability.transform, { ...args, facilityId }),
    ).rejects.toThrow(/FACILITY_PROCESS_REQUIRED/);
    await expect(
      shop.mutation(api.traceability.transform, {
        ...args,
        facilityId: foreign,
        processKind: "washing",
      }),
    ).rejects.toThrow(/FACILITY_NOT_FOUND/);
    await expect(
      shop.mutation(api.traceability.transform, {
        ...args,
        facilityId,
        processKind: "baling",
      }),
    ).rejects.toThrow(/PROCESS_NOT_DECLARED/);
    await shop.mutation(api.traceability.transform, {
      ...args,
      facilityId,
      processKind: "washing",
    });
    await shop.mutation(api.industrialProfiles.save, {
      facilityId,
      name: "Renamed",
      siteReference: "Site A",
      capabilities: ["baling"],
    });
    const history = await shop.query(api.traceability.history, {
      lotId: inputLotId,
    });
    expect(history.transformations[0]).toMatchObject({
      facilityName: "PET line",
      processKind: "washing",
      processLossGrams: 100,
    });
    expect(
      history.transformations[0].outputs.map((o) => o.streamClass),
    ).toEqual(["main_product", "residual_waste"]);
  });
  it.each([
    {
      streamClass: "residual_waste" as const,
      handlingClass: "non_hazardous" as const,
    },
    {
      streamClass: "recoverable_waste" as const,
      handlingClass: "controlled" as const,
    },
  ])(
    "restricts $streamClass/$handlingClass to audited controlled disposition",
    async (classification) => {
      const { t, shop, yard, orgs } = await world();
      const before = await shop.query(api.stock.mine, {});
      const lotId = await shop.mutation(api.traceability.declareLot, {
        materialCode: "RESIDUE",
        state: "Measured",
        grams: 1000,
        ...classification,
      });
      await expect(
        shop.mutation(api.traceability.dispatch, {
          lotId,
          receiverOrgId: orgs.yard,
        }),
      ).rejects.toThrow(/CONTROLLED_ROUTE_REQUIRED/);
      await expect(
        shop.mutation(api.traceability.transform, {
          inputLotId: lotId,
          inputGrams: 1000,
          contaminationGrams: 0,
          processLossGrams: 0,
          outputs: [{ materialCode: "PET", state: "Fake clean", grams: 1000 }],
        }),
      ).rejects.toThrow(/CONTROLLED_ROUTE_REQUIRED/);
      const args = {
        lotId,
        grams: 600,
        destinationReference: "Treatment facility reference",
        authorisationReference: "Declared consent reference",
        manifestReference: "Manifest A",
      };
      await expect(
        yard.mutation(api.traceability.recordControlledDisposition, args),
      ).rejects.toThrow(/LOT_NOT_FOUND/);
      for (const grams of [0, 0.5, 1001])
        await expect(
          shop.mutation(api.traceability.recordControlledDisposition, {
            ...args,
            grams,
          }),
        ).rejects.toThrow();
      await expect(
        shop.mutation(api.traceability.recordControlledDisposition, {
          ...args,
          manifestReference: " ",
        }),
      ).rejects.toThrow(/INVALID_REFERENCE/);
      const outcomes = await Promise.allSettled([
        shop.mutation(api.traceability.recordControlledDisposition, args),
        shop.mutation(api.traceability.recordControlledDisposition, args),
      ]);
      expect(outcomes.filter((o) => o.status === "fulfilled")).toHaveLength(1);
      let history = await shop.query(api.traceability.history, { lotId });
      expect(history.lot.availableGrams).toBe(400);
      expect(history.dispositions).toHaveLength(1);
      await shop.mutation(api.traceability.recordControlledDisposition, {
        ...args,
        grams: 400,
        manifestReference: "Manifest B",
      });
      history = await shop.query(api.traceability.history, { lotId });
      expect(history.lot).toMatchObject({
        availableGrams: 0,
        status: "exhausted",
      });
      expect(history.dispositions.reduce((sum, d) => sum + d.grams, 0)).toBe(
        1000,
      );
      await expect(
        shop.mutation(api.traceability.recordControlledDisposition, {
          ...args,
          grams: 1,
        }),
      ).rejects.toThrow(/NOT_ENOUGH_LOT_GRAMS/);
      const afterStock = await shop.query(api.stock.mine, {});
      expect(afterStock.totalGrams).toBe(before.totalGrams);
      const audits = await t.run((ctx) =>
        ctx.db
          .query("auditLog")
          .withIndex("by_entity", (q) =>
            q.eq("entityTable", "materialLots").eq("entityId", lotId),
          )
          .collect(),
      );
      expect(
        audits.filter(
          (a) => a.action === "material_lot.controlled_disposition_recorded",
        ),
      ).toHaveLength(2);
    },
  );
  it("keeps legacy lots unassessed and prevents ordinary lots from claiming controlled disposition", async () => {
    const { shop } = await world();
    const lotId = await shop.mutation(api.traceability.declareLot, {
      materialCode: "PET",
      state: "Bale",
      grams: 1000,
    });
    const history = await shop.query(api.traceability.history, { lotId });
    expect(history.lot).toMatchObject({
      streamClass: "unspecified",
      handlingClass: "unassessed",
    });
    await expect(
      shop.mutation(api.traceability.recordControlledDisposition, {
        lotId,
        grams: 1,
        destinationReference: "A",
        authorisationReference: "B",
        manifestReference: "C",
      }),
    ).rejects.toThrow(/CONTROLLED_LOT_REQUIRED/);
  });
});

describe("multi-input measured processing", () => {
  it("consumes each source exactly and exposes one immutable process from both sources", async () => {
    const { t, shop } = await world();
    const beforeStock = await shop.query(api.stock.mine, {});
    const primary = await shop.mutation(api.traceability.declareLot, {
      materialCode: "PET",
      state: "Flake",
      grams: 1000,
    });
    const additive = await shop.mutation(api.traceability.declareLot, {
      materialCode: "ADDITIVE",
      state: "Measured feedstock",
      grams: 300,
    });
    const process = await shop.mutation(api.traceability.transform, {
      inputLotId: primary,
      inputGrams: 900,
      additionalInputs: [{ lotId: additive, grams: 200 }],
      contaminationGrams: 50,
      processLossGrams: 50,
      outputs: [
        {
          materialCode: "COMPOUND",
          state: "Pellet",
          grams: 1000,
          streamClass: "main_product",
          handlingClass: "non_hazardous",
        },
      ],
    });
    const primaryHistory = await shop.query(api.traceability.history, {
      lotId: primary,
    });
    const secondaryHistory = await shop.query(api.traceability.history, {
      lotId: additive,
    });
    expect(primaryHistory.lot.availableGrams).toBe(100);
    expect(secondaryHistory.lot.availableGrams).toBe(100);
    expect(primaryHistory.transformations).toHaveLength(1);
    expect(secondaryHistory.transformations).toHaveLength(1);
    expect(secondaryHistory.transformations[0]).toMatchObject({
      id: process,
      inputGrams: 1100,
      inputs: [
        { id: primary, grams: 900 },
        { id: additive, grams: 200 },
      ],
    });
    const outputs = await t.run((ctx) =>
      ctx.db
        .query("materialLots")
        .withIndex("by_parent_transformation", (q) =>
          q.eq("parentTransformationId", process),
        )
        .collect(),
    );
    expect(outputs).toHaveLength(1);
    expect(outputs[0].initialGrams).toBe(1000);
    const outputHistory = await shop.query(api.traceability.history, {
      lotId: outputs[0]._id,
    });
    expect(outputHistory.transformations).toHaveLength(1);
    expect(outputHistory.transformations[0].inputs).toEqual(
      primaryHistory.transformations[0].inputs,
    );
    const afterStock = await shop.query(api.stock.mine, {});
    expect(afterStock.totalGrams).toBe(beforeStock.totalGrams);
  });
  it("rejects duplicates, foreign, controlled, overdrawn and unbalanced inputs without partial consumption", async () => {
    const { t, shop, yard } = await world();
    const primary = await shop.mutation(api.traceability.declareLot, {
      materialCode: "PET",
      state: "Flake",
      grams: 1000,
    });
    const secondary = await shop.mutation(api.traceability.declareLot, {
      materialCode: "ADDITIVE",
      state: "Feedstock",
      grams: 200,
    });
    const foreign = await yard.mutation(api.traceability.declareLot, {
      materialCode: "OTHER",
      state: "Feedstock",
      grams: 200,
    });
    const controlled = await shop.mutation(api.traceability.declareLot, {
      materialCode: "RESIDUE",
      state: "Sludge",
      grams: 200,
      handlingClass: "controlled",
    });
    const base = {
      inputLotId: primary,
      inputGrams: 1000,
      contaminationGrams: 0,
      processLossGrams: 0,
      outputs: [{ materialCode: "COMPOUND", state: "Pellet", grams: 1200 }],
    };
    for (const [additionalInputs, error] of [
      [[{ lotId: primary, grams: 200 }], "INVALID_INPUTS"],
      [
        [
          { lotId: secondary, grams: 100 },
          { lotId: secondary, grams: 100 },
        ],
        "INVALID_INPUTS",
      ],
      [[{ lotId: foreign, grams: 200 }], "LOT_NOT_FOUND"],
      [[{ lotId: controlled, grams: 200 }], "CONTROLLED_ROUTE_REQUIRED"],
      [[{ lotId: secondary, grams: 201 }], "NOT_ENOUGH_LOT_GRAMS"],
      [[{ lotId: secondary, grams: 199 }], "MASS_BALANCE_MISMATCH"],
    ] as const)
      await expect(
        shop.mutation(api.traceability.transform, {
          ...base,
          additionalInputs: [...additionalInputs],
        }),
      ).rejects.toThrow(error);
    const one = await shop.query(api.traceability.history, { lotId: primary });
    const two = await shop.query(api.traceability.history, {
      lotId: secondary,
    });
    expect(one.lot.availableGrams).toBe(1000);
    expect(two.lot.availableGrams).toBe(200);
    expect(
      await t.run((ctx) => ctx.db.query("lotTransformationInputs").collect()),
    ).toEqual([]);
    expect(
      await t.run((ctx) => ctx.db.query("lotTransformations").collect()),
    ).toEqual([]);
  });
  it("keeps legacy single-input history readable and prevents unsafe aggregate input mass", async () => {
    const { t, shop, orgs } = await world();
    const first = await shop.mutation(api.traceability.declareLot, {
      materialCode: "PET",
      state: "Flake",
      grams: Number.MAX_SAFE_INTEGER,
    });
    const second = await shop.mutation(api.traceability.declareLot, {
      materialCode: "ADDITIVE",
      state: "Feedstock",
      grams: 1,
    });
    await expect(
      shop.mutation(api.traceability.transform, {
        inputLotId: first,
        inputGrams: Number.MAX_SAFE_INTEGER,
        additionalInputs: [{ lotId: second, grams: 1 }],
        contaminationGrams: 0,
        processLossGrams: 0,
        outputs: [
          {
            materialCode: "COMPOUND",
            state: "Pellet",
            grams: Number.MAX_SAFE_INTEGER,
          },
        ],
      }),
    ).rejects.toThrow("INVALID_WEIGHT");
    await t.run(async (ctx) => {
      const member = await ctx.db
        .query("memberships")
        .withIndex("by_org", (q) => q.eq("orgId", orgs.shop))
        .first();
      if (!member) throw new Error("Missing fixture");
      await ctx.db.insert("lotTransformations", {
        orgId: orgs.shop,
        actorProfileId: member.profileId,
        inputLotId: first,
        inputGrams: 100,
        contaminationGrams: 100,
        processLossGrams: 0,
        createdAt: 1,
      });
    });
    const history = await shop.query(api.traceability.history, {
      lotId: first,
    });
    expect(history.transformations[0].inputs).toEqual([
      {
        id: first,
        materialCode: "PET",
        state: "Flake",
        grams: 100,
        canOpen: true,
      },
    ]);
  });
});

it("does not disclose a producer's private parent process to a later custodian", async () => {
  const { shop, yard, orgs } = await world();
  const input = await shop.mutation(api.traceability.declareLot, {
    materialCode: "PET",
    state: "Private blend input",
    grams: 1000,
    sourceReference: "PRIVATE-PRODUCTION-REFERENCE",
  });
  await shop.mutation(api.traceability.transform, {
    inputLotId: input,
    inputGrams: 1000,
    contaminationGrams: 0,
    processLossGrams: 0,
    outputs: [{ materialCode: "PET", state: "Output pellet", grams: 1000 }],
  });
  const sourceHistory = await shop.query(api.traceability.history, {
    lotId: input,
  });
  const output = sourceHistory.transformations[0].outputs[0].id;
  await expect(
    shop.mutation(api.traceability.dispatch, {
      lotId: output,
      receiverOrgId: orgs.yard,
    }),
  ).rejects.toThrow(/QUALITY_RELEASE_REQUIRED/);
  await expect(
    shop.mutation(api.traceability.transform, {
      inputLotId: output,
      inputGrams: 1000,
      contaminationGrams: 0,
      processLossGrams: 0,
      outputs: [{ materialCode: "PET", state: "Next process", grams: 1000 }],
    }),
  ).rejects.toThrow(/QUALITY_RELEASE_REQUIRED/);
  await shop.mutation(api.quality.recordInspection, {
    lotId: output,
    specificationReference: "Buyer PET specification",
    specificationVersion: "1",
    sampleMethod: "Batch sample",
    results: [{ parameter: "Moisture", unit: "%", value: "1" }],
    decision: "accepted",
  });
  await shop.mutation(api.traceability.dispatch, {
    lotId: output,
    receiverOrgId: orgs.yard,
  });
  await yard.mutation(api.traceability.receive, {
    lotId: output,
    receivedGrams: 1000,
  });
  const received = await yard.query(api.traceability.history, {
    lotId: output,
  });
  expect(received.transformations).toEqual([]);
  expect(JSON.stringify(received)).not.toContain("Private blend input");
  await expect(
    yard.query(api.traceability.history, { lotId: input }),
  ).rejects.toThrow("LOT_NOT_FOUND");
});

it("keeps sibling input details private after either input remainder changes custodian", async () => {
  const { shop, yard, orgs } = await world();
  const first = await shop.mutation(api.traceability.declareLot, {
    materialCode: "PRIVATE-PRIMARY",
    state: "Primary feedstock",
    grams: 1000,
  });
  const second = await shop.mutation(api.traceability.declareLot, {
    materialCode: "PRIVATE-SECONDARY",
    state: "Additive package",
    grams: 200,
  });
  await shop.mutation(api.traceability.transform, {
    inputLotId: first,
    inputGrams: 500,
    additionalInputs: [{ lotId: second, grams: 100 }],
    contaminationGrams: 0,
    processLossGrams: 0,
    outputs: [{ materialCode: "BLEND", state: "Pellet", grams: 600 }],
  });
  for (const [lotId, receivedGrams] of [
    [first, 500],
    [second, 100],
  ] as const) {
    await shop.mutation(api.traceability.dispatch, {
      lotId,
      receiverOrgId: orgs.yard,
    });
    await yard.mutation(api.traceability.receive, { lotId, receivedGrams });
    const history = await yard.query(api.traceability.history, { lotId });
    expect(history.transformations).toEqual([]);
    expect(history.custody).toHaveLength(2);
  }
});
