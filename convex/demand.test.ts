/// <reference types="vite/client" />
// @vitest-environment edge-runtime
import { convexTest } from "convex-test";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { api } from "./_generated/api";
import {
  convexModules,
  registerAuth,
  seedDemo,
  signInAs,
} from "./lib/auth.testing";
import schema from "./schema";

const modules = convexModules(import.meta.glob("./**/*.*s"));
const INPUT = {
  materialCode: "PAPER-NEWS",
  quantityGrams: 100_001,
  area: "Peenya",
  specification: "Dry newspaper, sorted and bundled",
  neededBy: "2026-10-03",
};
beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-10-02T06:30:00Z"));
  vi.stubEnv("AUTH_DEV_MODE", "true");
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
});
async function world() {
  const t = convexTest(schema, modules);
  registerAuth(t);
  await seedDemo(t);
  return t;
}

describe("material demand", () => {
  it("shows a yard's requirement only to its eligible local sellers without contact data", async () => {
    const t = await world();
    const yard = await signInAs(t, "+919000000102");
    const shop = await signInAs(t, "+919000000101");
    const recycler = await signInAs(t, "+919000000103");
    const id = await yard.mutation(api.demand.post, INPUT);
    const board = await shop.query(api.demand.board, {});
    expect(board.available.find((row) => row.id === id)).toMatchObject({
      quantityGrams: 100_001,
      buyer: { kind: "yard" },
    });
    expect(board.available[0]?.buyer).not.toHaveProperty("phones");
    expect(await recycler.query(api.demand.board, {})).toMatchObject({
      available: [],
    });
    expect(await shop.query(api.demand.board, {})).toMatchObject({ mine: [] });
    await t.run(async (ctx) => {
      const org = await ctx.db
        .query("orgs")
        .withIndex("by_slug", (q) => q.eq("slug", "ramesh-kabadi-store"))
        .unique();
      if (org) await ctx.db.patch("orgs", org._id, { city: "Mysuru" });
    });
    expect(await shop.query(api.demand.board, {})).toMatchObject({
      available: [],
    });
  });
  it("allows only the owner to close and audits once", async () => {
    const t = await world();
    const yard = await signInAs(t, "+919000000102");
    const shop = await signInAs(t, "+919000000101");
    const demandId = await yard.mutation(api.demand.post, INPUT);
    await expect(shop.mutation(api.demand.close, { demandId })).rejects.toThrow(
      /DEMAND_NOT_FOUND/,
    );
    await yard.mutation(api.demand.close, { demandId });
    await yard.mutation(api.demand.close, { demandId });
    expect(await shop.query(api.demand.board, {})).toMatchObject({
      available: [],
    });
    const own = await yard.query(api.demand.board, {});
    expect(own.mine[0]?.status).toBe("closed");
    const logs = await t.run(async (ctx) =>
      ctx.db
        .query("auditLog")
        .withIndex("by_entity", (q) =>
          q.eq("entityTable", "materialDemands").eq("entityId", demandId),
        )
        .collect(),
    );
    const actions = logs.map((row) => row.action);
    expect(actions).toEqual(["demand.posted", "demand.closed"]);
  });
  it("expires demands and hides suspended buyers", async () => {
    const t = await world();
    const yard = await signInAs(t, "+919000000102");
    const shop = await signInAs(t, "+919000000101");
    const id = await yard.mutation(api.demand.post, INPUT);
    vi.setSystemTime(new Date("2026-10-04T06:30:00Z"));
    const renewedShop = await signInAs(t, "+919000000101");
    expect(await renewedShop.query(api.demand.board, {})).toMatchObject({
      available: [],
    });
    vi.setSystemTime(new Date("2026-10-02T06:30:00Z"));
    await t.run(async (ctx) => {
      const row = await ctx.db.get("materialDemands", id);
      if (row) await ctx.db.patch("orgs", row.orgId, { status: "suspended" });
    });
    expect(await shop.query(api.demand.board, {})).toMatchObject({
      available: [],
    });
    const suspendedBoard = await yard.query(api.demand.board, {});
    expect(suspendedBoard.canPost).toBe(false);
    expect(suspendedBoard.available).toEqual([]);
    expect(suspendedBoard.mine.map((row) => row.id)).toContain(id);
    await expect(yard.mutation(api.demand.post, INPUT)).rejects.toThrow(
      /NO_BUSINESS/,
    );
  });
  it.each([
    { quantityGrams: 1.2 },
    { quantityGrams: 0 },
    { quantityGrams: Number.MAX_SAFE_INTEGER + 1 },
    { neededBy: "2026-02-30" },
    { neededBy: "2027-01-02" },
    { specification: "x".repeat(501) },
  ])("rejects invalid requirements %j", async (invalid) => {
    const yard = await signInAs(await world(), "+919000000102");
    await expect(
      yard.mutation(api.demand.post, { ...INPUT, ...invalid }),
    ).rejects.toThrow(/INVALID_DEMAND/);
  });
  it("rejects unsupported materials, reverse-chain posting and excess submission", async () => {
    const t = await world();
    const yard = await signInAs(t, "+919000000102");
    const shop = await signInAs(t, "+919000000101");
    await expect(shop.mutation(api.demand.post, INPUT)).rejects.toThrow(
      /WRONG_ROLE/,
    );
    await expect(
      yard.mutation(api.demand.post, { ...INPUT, materialCode: "NOT-REAL" }),
    ).rejects.toThrow(/MATERIAL_NOT_ALLOWED/);
    await yard.mutation(api.demand.post, INPUT);
    await expect(yard.mutation(api.demand.post, INPUT)).rejects.toThrow(
      /TRY_LATER/,
    );
    await expect(t.query(api.demand.board, {})).rejects.toThrow(
      /NOT_SIGNED_IN/,
    );
  });
});

it("does not let other buyer types or material families hide matching demand", async () => {
  const t = await world();
  const yard = await signInAs(t, "+919000000102");
  const shop = await signInAs(t, "+919000000101");
  const id = await yard.mutation(api.demand.post, INPUT);
  await t.run(async (ctx) => {
    const source = await ctx.db.get("materialDemands", id);
    if (!source) throw new Error("Missing demand");
    const shopOrg = await ctx.db
      .query("orgs")
      .withIndex("by_slug", (q) => q.eq("slug", "ramesh-kabadi-store"))
      .unique();
    if (!shopOrg) throw new Error("Missing shop");
    await ctx.db.patch("orgs", shopOrg._id, { families: ["paper"] });
    const { _id, _creationTime, ...row } = source;
    for (let index = 0; index < 105; index += 1) {
      await ctx.db.insert("materialDemands", {
        ...row,
        buyerKind: "manufacturer",
        neededBy: "2026-10-02",
      });
      await ctx.db.insert("materialDemands", {
        ...row,
        family: "plastic",
        neededBy: "2026-10-02",
      });
    }
  });
  const board = await shop.query(api.demand.board, {});
  expect(board.available.map((row) => row.id)).toContain(id);
});

it("removes restricted material from ordinary demand discovery and blocks new requests while preserving owner closure", async () => {
  const t = await world();
  const yard = await signInAs(t, "+919000000102");
  const shop = await signInAs(t, "+919000000101");
  const demandId = await yard.mutation(api.demand.post, INPUT);
  const before = await shop.query(api.demand.board, {});
  expect(before.available.map((row) => row.id)).toContain(demandId);
  await t.run(async (ctx) => {
    const material = await ctx.db
      .query("materials")
      .withIndex("by_code", (q) => q.eq("code", INPUT.materialCode))
      .unique();
    if (!material) throw new Error("Missing test material");
    await ctx.db.patch("materials", material._id, {
      byproductEligibility: {
        hazardStatus: "hazardous",
        sourceReference: "Synthetic material restriction",
        reviewedAt: Date.now(),
      },
    });
  });
  const sellerBoard = await shop.query(api.demand.board, {});
  const buyerBoard = await yard.query(api.demand.board, {});
  expect(sellerBoard.available.map((row) => row.id)).not.toContain(demandId);
  expect(sellerBoard.materials.map((row) => row.code)).not.toContain(
    INPUT.materialCode,
  );
  expect(buyerBoard.materials.map((row) => row.code)).not.toContain(
    INPUT.materialCode,
  );
  await expect(yard.mutation(api.demand.post, INPUT)).rejects.toThrow(
    /MATERIAL_NOT_ALLOWED/,
  );
  expect(buyerBoard.mine.map((row) => row.id)).toContain(demandId);
  await yard.mutation(api.demand.close, { demandId });
  const closed = await yard.query(api.demand.board, {});
  expect(closed.mine.find((row) => row.id === demandId)?.status).toBe("closed");
  const demands = await t.run((ctx) =>
    ctx.db.query("materialDemands").collect(),
  );
  expect(demands).toHaveLength(1);
});
