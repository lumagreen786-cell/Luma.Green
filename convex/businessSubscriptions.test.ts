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
afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});
async function world() {
  vi.stubEnv("AUTH_DEV_MODE", "true");
  const t = convexTest(schema, modules);
  registerAuth(t);
  await seedDemo(t);
  const owner = await signInAs(t, "+919000000102"),
    other = await signInAs(t, "+919000000103");
  const workspace = await owner.query(api.workspace.mine, {});
  if (workspace?.kind !== "org") throw new Error("missing site");
  return { t, owner, other, orgId: workspace.org.id };
}
it("saves, changes and cancels a site request without creating a paid subscription", async () => {
  const w = await world();
  const fetch = vi.spyOn(globalThis, "fetch");
  expect(
    await w.owner.query(api.businessSubscriptions.status, { orgId: w.orgId }),
  ).toMatchObject({
    request: null,
    billingAvailable: false,
    entitlement: null,
    canManage: true,
  });
  expect(
    await w.owner.mutation(api.businessSubscriptions.selectPlan, {
      orgId: w.orgId,
      plan: "trader",
      expectedVersion: 0,
    }),
  ).toBe(1);
  expect(
    await w.owner.mutation(api.businessSubscriptions.selectPlan, {
      orgId: w.orgId,
      plan: "trader",
      expectedVersion: 1,
    }),
  ).toBe(1);
  expect(
    await w.owner.mutation(api.businessSubscriptions.selectPlan, {
      orgId: w.orgId,
      plan: "yard",
      expectedVersion: 1,
    }),
  ).toBe(2);
  await expect(
    w.owner.mutation(api.businessSubscriptions.cancelRequest, {
      orgId: w.orgId,
      expectedVersion: 1,
    }),
  ).rejects.toThrow("STALE_VERSION");
  expect(
    await w.owner.mutation(api.businessSubscriptions.cancelRequest, {
      orgId: w.orgId,
      expectedVersion: 2,
    }),
  ).toBe(3);
  const status = await w.owner.query(api.businessSubscriptions.status, {
    orgId: w.orgId,
  });
  expect(status).toMatchObject({
    request: { selectedPlan: "yard", requestState: "cancelled", version: 3 },
    entitlement: null,
    billingAvailable: false,
  });
  expect(status.events.map((e) => e.action)).toEqual([
    "cancelled",
    "changed",
    "selected",
  ]);
  expect(
    await w.t.run((ctx) =>
      ctx.db
        .query("auditLog")
        .withIndex("by_org_created", (q) => q.eq("orgId", w.orgId))
        .take(100),
    ),
  ).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ action: "subscription.request_cancelled" }),
    ]),
  );
  expect(fetch).not.toHaveBeenCalled();
});
it("rejects another selected site, viewer writes and removed membership", async () => {
  const w = await world();
  await expect(
    w.other.query(api.businessSubscriptions.status, { orgId: w.orgId }),
  ).rejects.toThrow("WORKSPACE_CHANGED");
  const member = await w.t.run((ctx) =>
    ctx.db
      .query("memberships")
      .withIndex("by_org", (q) => q.eq("orgId", w.orgId))
      .unique(),
  );
  if (!member) throw new Error("missing member");
  await w.t.run((ctx) =>
    ctx.db.patch("memberships", member._id, { role: "viewer" }),
  );
  const result = await w.owner.query(api.businessSubscriptions.status, {
    orgId: w.orgId,
  });
  expect(result.canManage).toBe(false);
  await expect(
    w.owner.mutation(api.businessSubscriptions.selectPlan, {
      orgId: w.orgId,
      plan: "trader",
      expectedVersion: 0,
    }),
  ).rejects.toThrow("WORKSPACE_PERMISSION_DENIED");
  await w.t.run((ctx) => ctx.db.delete("memberships", member._id));
  await expect(
    w.owner.query(api.businessSubscriptions.status, { orgId: w.orgId }),
  ).rejects.toThrow("NO_BUSINESS");
});
it("preserves suspended-site read recovery and denies writes", async () => {
  const w = await world();
  await w.t.run((ctx) =>
    ctx.db.patch("orgs", w.orgId, { status: "suspended" }),
  );
  const result = await w.owner.query(api.businessSubscriptions.status, {
    orgId: w.orgId,
  });
  expect(result.canManage).toBe(false);
  await expect(
    w.owner.mutation(api.businessSubscriptions.selectPlan, {
      orgId: w.orgId,
      plan: "trader",
      expectedVersion: 0,
    }),
  ).rejects.toThrow("NO_BUSINESS");
});
it("never grants entitlement from enforcement flag alone or a saved selection", async () => {
  const w = await world();
  vi.stubEnv("BUSINESS_SUBSCRIPTIONS_ENFORCEMENT_ENABLED", "true");
  await w.owner.mutation(api.businessSubscriptions.selectPlan, {
    orgId: w.orgId,
    plan: "recycler",
    expectedVersion: 0,
  });
  const result = await w.owner.query(api.businessSubscriptions.status, {
    orgId: w.orgId,
  });
  expect(result.entitlement).toBeNull();
});
it("requires recent full authentication before changing the billing request", async () => {
  const w = await world();
  const now = Date.now();
  vi.spyOn(Date, "now").mockReturnValue(now + 11 * 60 * 1000);
  await expect(
    w.owner.mutation(api.businessSubscriptions.selectPlan, {
      orgId: w.orgId,
      plan: "trader",
      expectedVersion: 0,
    }),
  ).rejects.toThrow("RECENT_AUTH_REQUIRED");
  const result = await w.owner.query(api.businessSubscriptions.status, {
    orgId: w.orgId,
  });
  expect(result.request).toBeNull();
});
