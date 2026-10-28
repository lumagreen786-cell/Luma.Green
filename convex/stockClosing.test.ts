/// <reference types="vite/client" />
// @vitest-environment edge-runtime
import { convexTest } from "convex-test";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

import { api } from "./_generated/api";
import {
  convexModules,
  registerAuth,
  seedDemo,
  signInAs,
} from "./lib/auth.testing";
import { recordInventoryMovement } from "./lib/inventoryLedger";
import schema from "./schema";

const modules = convexModules(import.meta.glob("./**/*.*s"));
const request = {
  operationKey: "review-operation-one",
  day: "2026-10-28",
  note: "Observed stock reviewed",
};
beforeEach(() => {
  vi.stubEnv("AUTH_DEV_MODE", "true");
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-10-28T06:00:00Z"));
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.useRealTimers();
});
async function world() {
  const t = convexTest(schema, modules);
  registerAuth(t);
  await seedDemo(t);
  const owner = await signInAs(t, "+919000000101");
  const other = await signInAs(t, "+919000000102");
  const scope = await t.run(async (ctx) => {
    const org = await ctx.db
      .query("orgs")
      .withIndex("by_slug", (q) => q.eq("slug", "ramesh-kabadi-store"))
      .unique();
    if (!org?.ownerProfileId) throw new Error("Missing scope");
    return { orgId: org._id, profileId: org.ownerProfileId };
  });
  return { t, owner, other, ...scope };
}
it("saves one exact immutable closing, accepts an identical retry after movement and rejects changed replay", async () => {
  const w = await world();
  const stock = await w.owner.query(api.stock.mine, {});
  const id = await w.owner.mutation(api.stockClosing.record, request);
  await w.t.run((ctx) =>
    recordInventoryMovement(ctx, {
      orgId: w.orgId,
      actorProfileId: w.profileId,
      materialCode: "PAPER-NEWS",
      deltaGrams: 1,
      addedCostPaise: null,
      sourceKey: "after-closing",
      createdAt: Date.now(),
    }),
  );
  expect(await w.owner.mutation(api.stockClosing.record, request)).toBe(id);
  const board = await w.owner.query(api.stockClosing.board, {});
  expect(board.latest).toMatchObject({
    id,
    totalGrams: stock.totalGrams,
    totalCostPaise: null,
    day: request.day,
    note: request.note,
  });
  const afterStock = await w.owner.query(api.stock.mine, {});
  expect(afterStock.totalGrams).toBe(stock.totalGrams + 1);
  await expect(
    w.owner.mutation(api.stockClosing.record, {
      ...request,
      note: "Changed review",
    }),
  ).rejects.toThrow("CLOSING_REFERENCE_CONFLICT");
  await expect(
    w.owner.mutation(api.stockClosing.record, {
      ...request,
      operationKey: "another-review-key",
    }),
  ).rejects.toThrow("CLOSING_ALREADY_RECORDED");
  vi.setSystemTime(new Date("2026-10-28T18:30:00Z"));
  const renewedOwner = await signInAs(w.t, "+919000000101");
  await expect(
    renewedOwner.mutation(api.stockClosing.record, request),
  ).resolves.toBe(id);
  await expect(
    renewedOwner.mutation(api.stockClosing.record, {
      ...request,
      operationKey: "old-date-new-key",
    }),
  ).rejects.toThrow("CLOSING_DATE_CHANGED");
  await renewedOwner.mutation(api.stockClosing.record, {
    ...request,
    operationKey: "new-day-review-key",
    day: "2026-10-29",
  });
  const renewedOther = await signInAs(w.t, "+919000000102");
  const foreignBoard = await renewedOther.query(api.stockClosing.board, {});
  expect(foreignBoard.latest).toBeNull();
  const audits = await w.t.run((ctx) =>
    ctx.db
      .query("auditLog")
      .withIndex("by_entity", (q) =>
        q.eq("entityTable", "stockDailyClosings").eq("entityId", id),
      )
      .take(10),
  );
  expect(audits).toHaveLength(1);
});
it("deduplicates concurrent same-day closing requests", async () => {
  const w = await world();
  const results = await Promise.allSettled([
    w.owner.mutation(api.stockClosing.record, request),
    w.owner.mutation(api.stockClosing.record, {
      ...request,
      operationKey: "second-concurrent-key",
    }),
  ]);
  expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
  expect(
    await w.t.run((ctx) => ctx.db.query("stockDailyClosings").take(10)),
  ).toHaveLength(1);
});

it("records an owner correction once with exact cost and refuses reducing promised stock", async () => {
  const w = await world();
  const args = {
    operationKey: "correction-positive-one",
    materialCode: "PAPER-OFFICE",
    deltaGrams: 3,
    costPaise: 2,
    reason: "Physical count corrected",
    evidenceReference: "Isolated weighing reference",
  };
  const id = await w.owner.mutation(api.stockClosing.adjust, args);
  expect(await w.owner.mutation(api.stockClosing.adjust, args)).toBe(id);
  await expect(
    w.owner.mutation(api.stockClosing.adjust, { ...args, deltaGrams: 4 }),
  ).rejects.toThrow("ADJUSTMENT_REFERENCE_CONFLICT");
  await w.owner.mutation(api.stockClosing.adjust, {
    ...args,
    operationKey: "correction-negative-one",
    deltaGrams: -1,
    costPaise: null,
  });
  const stock = await w.owner.query(api.stock.mine, {});
  expect(
    stock.rows.find((row) => row.material.code === "PAPER-OFFICE"),
  ).toMatchObject({ grams: 2, costPaise: 2 });
  await w.t.run(async (ctx) => {
    const listing = await ctx.db
      .query("listings")
      .withIndex("by_org", (q) => q.eq("orgId", w.orgId))
      .first();
    if (!listing) throw new Error("Missing listing template");
    const { _id, _creationTime, ...fields } = listing;
    await ctx.db.insert("listings", {
      ...fields,
      materialCode: "PAPER-OFFICE",
      grams: 2,
      status: "open",
      createdAt: Date.now(),
      updatedAt: Date.now(),
      expiresAt: Date.now() + 86_400_000,
    });
  });
  await expect(
    w.owner.mutation(api.stockClosing.adjust, {
      ...args,
      operationKey: "reserved-correction-one",
      deltaGrams: -1,
      costPaise: null,
    }),
  ).rejects.toThrow("STOCK_RESERVED");
  const adjustments = await w.t.run((ctx) =>
    ctx.db
      .query("stockAdjustments")
      .withIndex("by_org_created", (q) => q.eq("orgId", w.orgId))
      .take(20),
  );
  expect(adjustments).toHaveLength(2);
  const movements = await w.t.run((ctx) =>
    ctx.db
      .query("inventoryMovements")
      .withIndex("by_org_source", (q) =>
        q.eq("orgId", w.orgId).eq("sourceKey", `adjustment:${id}`),
      )
      .take(10),
  );
  expect(movements).toHaveLength(1);
  const alerts = await w.owner.query(api.stockClosing.board, {});
  expect(alerts.adjustments).toHaveLength(2);
});

it("protects accepted trades during corrections and rejects unsafe or unreasoned adjustments", async () => {
  const w = await world();
  const args = {
    operationKey: "protected-correction",
    materialCode: "PAPER-NEWS",
    deltaGrams: -1,
    costPaise: null,
    reason: "Physical count corrected",
    evidenceReference: "Isolated physical evidence",
  };
  await w.t.run(async (ctx) => {
    const listings = await ctx.db
      .query("listings")
      .withIndex("by_org", (q) => q.eq("orgId", w.orgId))
      .take(100);
    for (const listing of listings)
      await ctx.db.patch("listings", listing._id, { status: "withdrawn" });
    const trade = await ctx.db
      .query("trades")
      .withIndex("by_seller", (q) => q.eq("sellerOrgId", w.orgId))
      .first();
    if (!trade) throw new Error("Missing trade template");
    await ctx.db.patch("trades", trade._id, {
      materialCode: "PAPER-NEWS",
      grams: 180_000,
      status: "accepted",
    });
  });
  await expect(w.owner.mutation(api.stockClosing.adjust, args)).rejects.toThrow(
    "STOCK_RESERVED",
  );
  for (const deltaGrams of [0, 0.5, Number.MAX_SAFE_INTEGER + 1])
    await expect(
      w.owner.mutation(api.stockClosing.adjust, { ...args, deltaGrams }),
    ).rejects.toThrow("INVALID_WEIGHT");
  await expect(
    w.owner.mutation(api.stockClosing.adjust, { ...args, reason: "" }),
  ).rejects.toThrow("INVALID_STOCK_ADJUSTMENT");
  await expect(
    w.owner.mutation(api.stockClosing.adjust, {
      ...args,
      evidenceReference: "",
    }),
  ).rejects.toThrow("INVALID_STOCK_ADJUSTMENT");
  await expect(
    w.owner.mutation(api.stockClosing.adjust, { ...args, costPaise: 1 }),
  ).rejects.toThrow("INVALID_PRICE");
  expect(
    await w.t.run((ctx) => ctx.db.query("stockAdjustments").take(10)),
  ).toEqual([]);
});

it("allows a member to close stock but reserves manual corrections for owners and admins", async () => {
  const w = await world();
  await w.t.run(async (ctx) => {
    const membership = await ctx.db
      .query("memberships")
      .withIndex("by_profile_org", (q) =>
        q.eq("profileId", w.profileId).eq("orgId", w.orgId),
      )
      .unique();
    if (!membership) throw new Error("Missing membership");
    await ctx.db.patch("memberships", membership._id, { role: "member" });
  });
  const board = await w.owner.query(api.stockClosing.board, {});
  expect(board).toMatchObject({ canOperate: true, canAdjust: false });
  await w.owner.mutation(api.stockClosing.record, request);
  await expect(
    w.owner.mutation(api.stockClosing.adjust, {
      operationKey: "member-correction",
      materialCode: "PAPER-NEWS",
      deltaGrams: 1,
      costPaise: null,
      reason: "Physical count corrected",
      evidenceReference: "Isolated physical evidence",
    }),
  ).rejects.toThrow("WORKSPACE_PERMISSION_DENIED");
});
it("does not enable alerts by default and emits one inbox-only alert per downward crossing", async () => {
  const w = await world();
  const change = (deltaGrams: number, sourceKey: string) =>
    w.t.run((ctx) =>
      recordInventoryMovement(ctx, {
        orgId: w.orgId,
        actorProfileId: w.profileId,
        materialCode: "PAPER-NEWS",
        deltaGrams,
        addedCostPaise: null,
        sourceKey,
        createdAt: Date.now(),
      }),
    );
  const initialBoard = await w.owner.query(api.stockClosing.board, {});
  expect(initialBoard.settings).toEqual([]);
  await w.owner.mutation(api.stockClosing.configure, {
    materialCode: "PAPER-NEWS",
    enabled: true,
    thresholdGrams: 100_000,
  });
  await change(-80_001, "cross-one");
  await change(-80_001, "cross-one");
  await change(-1, "still-below");
  const firstBoard = await w.owner.query(api.stockClosing.board, {});
  expect(firstBoard.alerts).toHaveLength(1);
  await change(2, "recover");
  await change(-1, "cross-two");
  const secondBoard = await w.owner.query(api.stockClosing.board, {});
  expect(secondBoard.alerts).toHaveLength(2);
  const inbox = await w.owner.query(api.inbox.list, {
    paginationOpts: { numItems: 20, cursor: null },
  });
  expect(inbox.page.filter((row) => row.event === "stock_low")).toHaveLength(2);
  expect(
    await w.t.run((ctx) => ctx.db.query("pushDeliveries").take(10)),
  ).toEqual([]);
  await w.owner.mutation(api.stockClosing.configure, {
    materialCode: "PAPER-NEWS",
    enabled: false,
    thresholdGrams: 100_000,
  });
  await change(10, "disabled-recover");
  await change(-20, "disabled-cross");
  const disabledBoard = await w.owner.query(api.stockClosing.board, {});
  expect(disabledBoard.alerts).toHaveLength(2);
  await w.t.run(async (ctx) => {
    const rows = await ctx.db
      .query("memberships")
      .withIndex("by_org", (q) => q.eq("orgId", w.orgId))
      .take(100);
    for (const row of rows) await ctx.db.delete("memberships", row._id);
  });
  const hidden = await w.owner.query(api.inbox.list, {
    paginationOpts: { numItems: 20, cursor: null },
  });
  expect(hidden.page.filter((row) => row.event === "stock_low")).toEqual([]);
});
it.each(["suspended", "viewer"] as const)(
  "keeps %s reads and denies closing or threshold writes",
  async (access) => {
    const w = await world();
    await w.owner.mutation(api.stockClosing.record, request);
    await w.t.run(async (ctx) => {
      if (access === "suspended")
        await ctx.db.patch("orgs", w.orgId, { status: "suspended" });
      else {
        const membership = await ctx.db
          .query("memberships")
          .withIndex("by_profile_org", (q) =>
            q.eq("profileId", w.profileId).eq("orgId", w.orgId),
          )
          .unique();
        if (!membership) throw new Error("Missing membership");
        await ctx.db.patch("memberships", membership._id, { role: "viewer" });
      }
    });
    expect(await w.owner.query(api.stockClosing.board, {})).toMatchObject({
      canOperate: false,
      latest: { day: request.day },
    });
    await expect(
      w.owner.mutation(api.stockClosing.record, request),
    ).rejects.toThrow(
      access === "suspended" ? "NO_BUSINESS" : "WORKSPACE_PERMISSION_DENIED",
    );
    await expect(
      w.owner.mutation(api.stockClosing.configure, {
        materialCode: "PAPER-NEWS",
        enabled: true,
        thresholdGrams: 1,
      }),
    ).rejects.toThrow(
      access === "suspended" ? "NO_BUSINESS" : "WORKSPACE_PERMISSION_DENIED",
    );
  },
);
it("refuses invalid quantities and ledger drift without a partial closing", async () => {
  const w = await world();
  for (const thresholdGrams of [-1, 0.5, Number.MAX_SAFE_INTEGER + 1])
    await expect(
      w.owner.mutation(api.stockClosing.configure, {
        materialCode: "PAPER-NEWS",
        enabled: true,
        thresholdGrams,
      }),
    ).rejects.toThrow("INVALID_WEIGHT");
  await w.t.run(async (ctx) => {
    const row = await ctx.db
      .query("inventory")
      .withIndex("by_org_material", (q) =>
        q.eq("orgId", w.orgId).eq("materialCode", "PAPER-NEWS"),
      )
      .unique();
    if (!row) throw new Error("Missing stock");
    await ctx.db.patch("inventory", row._id, { grams: row.grams + 1 });
  });
  await expect(
    w.owner.mutation(api.stockClosing.record, request),
  ).rejects.toThrow("STOCK_LEDGER_MISMATCH");
  expect(
    await w.t.run((ctx) => ctx.db.query("stockDailyClosings").take(10)),
  ).toEqual([]);
});

it("fails an oversized closing without storing a truncated snapshot", async () => {
  const w = await world();
  await w.t.run(async (ctx) => {
    for (let i = 0; i < 501; i++)
      await ctx.db.insert("inventory", {
        orgId: w.orgId,
        materialCode: `ISOLATED-${String(i)}`,
        grams: 0,
        costPaise: 0,
        updatedAt: Date.now(),
      });
  });
  await expect(
    w.owner.mutation(api.stockClosing.record, request),
  ).rejects.toThrow("STOCK_CLOSING_LIMIT");
  expect(
    await w.t.run((ctx) => ctx.db.query("stockDailyClosings").take(10)),
  ).toEqual([]);
});

it("does not manufacture a crossing when enabled below current stock and does not duplicate an unchanged setting audit", async () => {
  const w = await world();
  const args = {
    materialCode: "PAPER-NEWS",
    enabled: true,
    thresholdGrams: 500_000,
  };
  await w.owner.mutation(api.stockClosing.configure, args);
  await w.owner.mutation(api.stockClosing.configure, args);
  const board = await w.owner.query(api.stockClosing.board, {});
  expect(board.alerts).toEqual([]);
  expect(board.settings).toContainEqual(
    expect.objectContaining({ enabled: true, below: true }),
  );
  const audit = await w.t.run((ctx) =>
    ctx.db
      .query("auditLog")
      .withIndex("by_org_created", (q) => q.eq("orgId", w.orgId))
      .take(100),
  );
  expect(
    audit.filter((row) => row.action === "stock.threshold_configured"),
  ).toHaveLength(1);
});
