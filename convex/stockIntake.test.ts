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
const args = {
  intakeReference: "BATCH-INTAKE-1",
  materialCode: "PAPER-NEWS",
  grams: 2000,
  producedOn: "2026-01-01",
  sourceReference: "PRODUCTION-1",
  weighingReference: "WEIGH-1",
  ownProductionConfirmed: true as const,
};
async function world() {
  vi.stubEnv("AUTH_DEV_MODE", "true");
  const t = convexTest(schema, modules);
  registerAuth(t);
  await seedDemo(t);
  const maker = await signInAs(t, "+919000000103");
  const shop = await signInAs(t, "+919000000101");
  const setup = await t.run(async (ctx) => {
    const allOrgs = await ctx.db.query("orgs").collect();
    const org = allOrgs.find((row) => row.kind === "recycler");
    const material = await ctx.db
      .query("materials")
      .withIndex("by_code", (q) => q.eq("code", args.materialCode))
      .unique();
    if (!org || !material) throw new Error("Missing test fixture");
    await ctx.db.patch("orgs", org._id, {
      kind: "manufacturer",
      families: ["paper"],
    });
    await ctx.db.patch("materials", material._id, {
      byproductEligibility: {
        hazardStatus: "non_hazardous",
        sourceReference: "Synthetic review only",
        reviewedAt: 1,
      },
    });
    const stock = await ctx.db
      .query("inventory")
      .withIndex("by_org_material", (q) =>
        q.eq("orgId", org._id).eq("materialCode", args.materialCode),
      )
      .unique();
    if (stock) await ctx.db.delete("inventory", stock._id);
    const membership = await ctx.db
      .query("memberships")
      .withIndex("by_org", (q) => q.eq("orgId", org._id))
      .first();
    if (!membership) throw new Error("Missing member");
    return {
      orgId: org._id,
      materialId: material._id,
      membershipId: membership._id,
    };
  });
  return { t, maker, shop, ...setup };
}
afterEach(() => vi.unstubAllEnvs());
it("adds exact stock once with immutable evidence and idempotent concurrent retry", async () => {
  const { t, maker, orgId } = await world();
  const [first, second] = await Promise.all([
    maker.mutation(api.stockIntake.record, args),
    maker.mutation(api.stockIntake.record, args),
  ]);
  expect(first).toBe(second);
  const stock = await maker.query(api.stock.mine, {});
  expect(
    stock.rows.find((row) => row.material.code === args.materialCode)?.grams,
  ).toBe(2000);
  const movements = await t.run((ctx) =>
    ctx.db
      .query("inventoryMovements")
      .withIndex("by_org_material", (q) =>
        q.eq("orgId", orgId).eq("materialCode", args.materialCode),
      )
      .collect(),
  );
  expect(movements).toHaveLength(1);
  expect(movements[0]).toMatchObject({
    deltaGrams: 2000,
    costDeltaPaise: null,
  });
  expect(
    stock.rows.find((row) => row.material.code === args.materialCode)
      ?.costPaise,
  ).toBeNull();
  const records = await maker.query(api.stockIntake.mine, {
    paginationOpts: { numItems: 20, cursor: null },
  });
  expect(records.page).toHaveLength(1);
  expect(records.page[0]).toMatchObject({
    id: first,
    intakeReference: args.intakeReference,
    materialCode: args.materialCode,
    grams: args.grams,
    sourceReference: args.sourceReference,
    weighingReference: args.weighingReference,
  });
  const audit = await t.run((ctx) =>
    ctx.db
      .query("auditLog")
      .withIndex("by_entity", (q) =>
        q.eq("entityTable", "manufacturerStockIntakes").eq("entityId", first),
      )
      .collect(),
  );
  expect(audit).toHaveLength(1);
  expect(audit[0]).toMatchObject({
    orgId,
    metadata: { intakeGrams: 2000 },
  });
  expect(await t.run((ctx) => ctx.db.query("materialLots").collect())).toEqual(
    [],
  );
});
it("rejects a changed retry without altering stock or evidence", async () => {
  const { maker } = await world();
  await maker.mutation(api.stockIntake.record, args);
  await expect(
    maker.mutation(api.stockIntake.record, { ...args, grams: 3000 }),
  ).rejects.toThrow("INTAKE_REFERENCE_CONFLICT");
  const stock = await maker.query(api.stock.mine, {});
  expect(
    stock.rows.find((row) => row.material.code === args.materialCode)?.grams,
  ).toBe(2000);
});
it("requires an active manufacturer operator and keeps viewer history read-only", async () => {
  const { t, maker, shop, membershipId, orgId } = await world();
  await expect(shop.mutation(api.stockIntake.record, args)).rejects.toThrow(
    "WRONG_ROLE",
  );
  await expect(t.mutation(api.stockIntake.record, args)).rejects.toThrow(
    "NOT_SIGNED_IN",
  );
  await t.run((ctx) =>
    ctx.db.patch("memberships", membershipId, { role: "viewer" }),
  );
  const history = await maker.query(api.stockIntake.mine, {
    paginationOpts: { numItems: 20, cursor: null },
  });
  expect(history.page).toEqual([]);
  await expect(maker.mutation(api.stockIntake.record, args)).rejects.toThrow(
    "WORKSPACE_PERMISSION_DENIED",
  );
  await t.run((ctx) =>
    ctx.db.patch("memberships", membershipId, { role: "member" }),
  );
  await maker.mutation(api.stockIntake.record, args);
  await t.run((ctx) => ctx.db.patch("orgs", orgId, { status: "suspended" }));
  await expect(
    maker.mutation(api.stockIntake.record, {
      ...args,
      intakeReference: "NEXT",
    }),
  ).rejects.toThrow("NO_BUSINESS");
});
it("fails closed for missing, hazardous, inactive and wrong-family material approval", async () => {
  const { t, maker, materialId, orgId } = await world();
  await t.run((ctx) =>
    ctx.db.patch("materials", materialId, { byproductEligibility: undefined }),
  );
  await expect(maker.mutation(api.stockIntake.record, args)).rejects.toThrow(
    "BYPRODUCT_NOT_ELIGIBLE",
  );
  await t.run((ctx) =>
    ctx.db.patch("materials", materialId, {
      byproductEligibility: {
        hazardStatus: "hazardous",
        sourceReference: "test",
        reviewedAt: 1,
      },
    }),
  );
  await expect(maker.mutation(api.stockIntake.record, args)).rejects.toThrow(
    "BYPRODUCT_NOT_ELIGIBLE",
  );
  await t.run((ctx) =>
    ctx.db.patch("materials", materialId, {
      active: false,
      byproductEligibility: {
        hazardStatus: "non_hazardous",
        sourceReference: "test",
        reviewedAt: 1,
      },
    }),
  );
  await expect(maker.mutation(api.stockIntake.record, args)).rejects.toThrow(
    "BYPRODUCT_NOT_ELIGIBLE",
  );
  await t.run(async (ctx) => {
    await ctx.db.patch("materials", materialId, { active: true });
    await ctx.db.patch("orgs", orgId, { families: ["plastic"] });
  });
  expect(await maker.query(api.stockIntake.materials, {})).toEqual([]);
  await expect(maker.mutation(api.stockIntake.record, args)).rejects.toThrow(
    "BYPRODUCT_NOT_ELIGIBLE",
  );
  expect(
    await t.run((ctx) => ctx.db.query("manufacturerStockIntakes").collect()),
  ).toEqual([]);
});
it.each([0, -1, 0.5, Number.MAX_SAFE_INTEGER + 1])(
  "rejects invalid grams %s",
  async (grams) => {
    const { maker } = await world();
    await expect(
      maker.mutation(api.stockIntake.record, { ...args, grams }),
    ).rejects.toThrow("INVALID_WEIGHT");
  },
);
it("rejects future/invalid dates, empty references and overflowing stock atomically", async () => {
  const { t, maker, orgId } = await world();
  for (const producedOn of ["2099-01-01", "2026-02-30", "invalid"])
    await expect(
      maker.mutation(api.stockIntake.record, { ...args, producedOn }),
    ).rejects.toThrow("INVALID_PRODUCTION_DATE");
  await expect(
    maker.mutation(api.stockIntake.record, { ...args, weighingReference: " " }),
  ).rejects.toThrow("INVALID_REFERENCE");
  await t.run((ctx) =>
    ctx.db.insert("inventory", {
      orgId,
      materialCode: args.materialCode,
      grams: Number.MAX_SAFE_INTEGER,
      updatedAt: 1,
    }),
  );
  await expect(maker.mutation(api.stockIntake.record, args)).rejects.toThrow(
    "INVALID_WEIGHT",
  );
  expect(
    await t.run((ctx) => ctx.db.query("manufacturerStockIntakes").collect()),
  ).toEqual([]);
});

it("keeps movement sources idempotent and allocates every recorded paisa", async () => {
  const { t, orgId, membershipId } = await world();
  const { recordInventoryMovement } = await import("./lib/inventoryLedger");
  const actorProfileId = await t.run(async (ctx) => {
    const membership = await ctx.db.get("memberships", membershipId);
    if (!membership) throw new Error("Missing test owner");
    return membership.profileId;
  });
  const entry = {
    orgId,
    actorProfileId,
    materialCode: "COST-TEST",
    deltaGrams: 3,
    addedCostPaise: 10,
    sourceKey: "test:cost:intake",
    createdAt: Date.now(),
  };
  const first = await t.run((ctx) => recordInventoryMovement(ctx, entry));
  expect(await t.run((ctx) => recordInventoryMovement(ctx, entry))).toBe(first);
  await expect(
    t.run((ctx) => recordInventoryMovement(ctx, { ...entry, deltaGrams: 4 })),
  ).rejects.toThrow(/INVENTORY_SOURCE_CONFLICT/);
  await t.run((ctx) =>
    recordInventoryMovement(ctx, {
      ...entry,
      deltaGrams: -1,
      addedCostPaise: null,
      sourceKey: "test:cost:dispatch:1",
    }),
  );
  await t.run((ctx) =>
    recordInventoryMovement(ctx, {
      ...entry,
      deltaGrams: -2,
      addedCostPaise: null,
      sourceKey: "test:cost:dispatch:2",
    }),
  );
  const rows = await t.run((ctx) =>
    ctx.db
      .query("inventoryMovements")
      .withIndex("by_org_material", (q) =>
        q.eq("orgId", orgId).eq("materialCode", entry.materialCode),
      )
      .collect(),
  );
  expect(rows.map((row) => row.deltaGrams)).toEqual([3, -1, -2]);
  expect(rows.map((row) => row.costDeltaPaise)).toEqual([10, -3, -7]);
  const balance = await t.run((ctx) =>
    ctx.db
      .query("inventory")
      .withIndex("by_org_material", (q) =>
        q.eq("orgId", orgId).eq("materialCode", entry.materialCode),
      )
      .unique(),
  );
  expect(balance).toMatchObject({ grams: 0, costPaise: 0 });
});

it.each([undefined, null, 0, 100])(
  "retains explicitly recorded intake cost %s without inventing missing values",
  async (recordedCostPaise) => {
    const { t, maker, orgId } = await world();
    const costReference =
      recordedCostPaise == null ? undefined : "RECORDED-ALLOCATED-INTAKE";
    const id = await maker.mutation(api.stockIntake.record, {
      ...args,
      recordedCostPaise,
      costReference,
    });
    const stock = await maker.query(api.stock.mine, {});
    expect(
      stock.rows.find(({ material }) => material.code === args.materialCode)
        ?.costPaise,
    ).toBe(recordedCostPaise ?? null);
    const row = await t.run((ctx) =>
      ctx.db.get("manufacturerStockIntakes", id),
    );
    expect(row).toMatchObject({ recordedCostPaise: recordedCostPaise ?? null });
    const history = await maker.query(api.stockIntake.mine, {
      paginationOpts: { cursor: null, numItems: 20 },
    });
    expect(history.page[0]).toMatchObject({
      recordedCostPaise: recordedCostPaise ?? null,
    });
    const audit = await t.run((ctx) =>
      ctx.db
        .query("auditLog")
        .withIndex("by_entity", (q) =>
          q.eq("entityTable", "manufacturerStockIntakes").eq("entityId", id),
        )
        .collect(),
    );
    expect(audit).toHaveLength(1);
    expect(audit[0].metadata).toMatchObject({
      recordedCostPaise: recordedCostPaise ?? null,
    });
    const movement = await t.run((ctx) =>
      ctx.db
        .query("inventoryMovements")
        .withIndex("by_org_source", (q) =>
          q.eq("orgId", orgId).eq("sourceKey", `manufacturer:${id}`),
        )
        .unique(),
    );
    expect(movement?.costDeltaPaise).toBe(recordedCostPaise ?? null);
  },
);

it("preserves every recorded intake paisa across partial and final stock removal", async () => {
  const { t, maker, orgId, membershipId } = await world();
  const valued = {
    ...args,
    grams: 3,
    recordedCostPaise: 10,
    costReference: "RECORDED-ALLOCATED-COST",
  };
  const ids = await Promise.all([
    maker.mutation(api.stockIntake.record, valued),
    maker.mutation(api.stockIntake.record, valued),
  ]);
  expect(ids[0]).toBe(ids[1]);
  const { recordInventoryMovement } = await import("./lib/inventoryLedger");
  await t.run(async (ctx) => {
    const member = await ctx.db.get("memberships", membershipId);
    if (!member) throw new Error("Missing member");
    await recordInventoryMovement(ctx, {
      orgId,
      actorProfileId: member.profileId,
      materialCode: args.materialCode,
      deltaGrams: -1,
      addedCostPaise: null,
      sourceKey: "test:intake:partial-dispatch",
      createdAt: Date.now(),
    });
  });
  const partial = await maker.query(api.stock.mine, {});
  expect(
    partial.rows.find(({ material }) => material.code === args.materialCode),
  ).toMatchObject({ grams: 2, costPaise: 7 });
  await t.run(async (ctx) => {
    const member = await ctx.db.get("memberships", membershipId);
    if (!member) throw new Error("Missing member");
    await recordInventoryMovement(ctx, {
      orgId,
      actorProfileId: member.profileId,
      materialCode: args.materialCode,
      deltaGrams: -2,
      addedCostPaise: null,
      sourceKey: "test:intake:final-dispatch",
      createdAt: Date.now(),
    });
  });
  const final = await t.run((ctx) =>
    ctx.db
      .query("inventory")
      .withIndex("by_org_material", (q) =>
        q.eq("orgId", orgId).eq("materialCode", args.materialCode),
      )
      .unique(),
  );
  expect(final).toMatchObject({ grams: 0, costPaise: 0 });
  const movement = await t.run((ctx) =>
    ctx.db
      .query("inventoryMovements")
      .withIndex("by_org_material", (q) =>
        q.eq("orgId", orgId).eq("materialCode", args.materialCode),
      )
      .collect(),
  );
  expect(movement.map(({ costDeltaPaise }) => costDeltaPaise)).toEqual([
    10, -3, -7,
  ]);
});

it("normalizes historical missing cost to unknown and rejects changed cost or evidence on retry", async () => {
  const { t, maker } = await world();
  const legacy = await maker.mutation(api.stockIntake.record, args);
  await t.run((ctx) =>
    ctx.db.patch("manufacturerStockIntakes", legacy, {
      recordedCostPaise: undefined,
      costReference: undefined,
    }),
  );
  expect(
    await maker.mutation(api.stockIntake.record, {
      ...args,
      recordedCostPaise: null,
    }),
  ).toBe(legacy);
  const valued = {
    ...args,
    intakeReference: "VALUED-INTAKE",
    recordedCostPaise: 100,
    costReference: "RECORDED-COST-1",
  };
  await maker.mutation(api.stockIntake.record, valued);
  const mixed = await maker.query(api.stock.mine, {});
  expect(
    mixed.rows.find(({ material }) => material.code === args.materialCode)
      ?.costPaise,
  ).toBeNull();
  await expect(
    maker.mutation(api.stockIntake.record, {
      ...valued,
      recordedCostPaise: 101,
    }),
  ).rejects.toThrow("INTAKE_REFERENCE_CONFLICT");
  await expect(
    maker.mutation(api.stockIntake.record, {
      ...valued,
      costReference: "RECORDED-COST-2",
    }),
  ).rejects.toThrow("INTAKE_REFERENCE_CONFLICT");
  expect(
    await t.run((ctx) => ctx.db.query("manufacturerStockIntakes").collect()),
  ).toHaveLength(2);
});

it("rejects invalid, unsupported and overflowing recorded costs atomically", async () => {
  const { t, maker, orgId } = await world();
  for (const recordedCostPaise of [-1, 0.5, Number.MAX_SAFE_INTEGER + 1])
    await expect(
      maker.mutation(api.stockIntake.record, {
        ...args,
        recordedCostPaise,
        costReference: "RECORDED-COST",
      }),
    ).rejects.toThrow("INVALID_PRICE");
  await expect(
    maker.mutation(api.stockIntake.record, { ...args, recordedCostPaise: 0 }),
  ).rejects.toThrow("COST_REFERENCE_REQUIRED");
  await t.run((ctx) =>
    ctx.db.insert("inventory", {
      orgId,
      materialCode: args.materialCode,
      grams: 1,
      costPaise: Number.MAX_SAFE_INTEGER,
      updatedAt: Date.now(),
    }),
  );
  await expect(
    maker.mutation(api.stockIntake.record, {
      ...args,
      recordedCostPaise: 1,
      costReference: "RECORDED-COST",
    }),
  ).rejects.toThrow("INVALID_PRICE");
  expect(
    await t.run((ctx) => ctx.db.query("manufacturerStockIntakes").collect()),
  ).toEqual([]);
  const stock = await t.run((ctx) =>
    ctx.db
      .query("inventory")
      .withIndex("by_org_material", (q) =>
        q.eq("orgId", orgId).eq("materialCode", args.materialCode),
      )
      .unique(),
  );
  expect(stock).toMatchObject({ grams: 1, costPaise: Number.MAX_SAFE_INTEGER });
});

it("keeps known intake valuation behind the existing manufacturer write permission", async () => {
  const { t, maker, shop, membershipId } = await world();
  const valued = {
    ...args,
    recordedCostPaise: 100,
    costReference: "RECORDED-COST",
  };
  await expect(shop.mutation(api.stockIntake.record, valued)).rejects.toThrow(
    "WRONG_ROLE",
  );
  await expect(t.mutation(api.stockIntake.record, valued)).rejects.toThrow(
    "NOT_SIGNED_IN",
  );
  await t.run((ctx) =>
    ctx.db.patch("memberships", membershipId, { role: "viewer" }),
  );
  await expect(maker.mutation(api.stockIntake.record, valued)).rejects.toThrow(
    "WORKSPACE_PERMISSION_DENIED",
  );
  expect(
    await t.run((ctx) => ctx.db.query("manufacturerStockIntakes").collect()),
  ).toEqual([]);
});
