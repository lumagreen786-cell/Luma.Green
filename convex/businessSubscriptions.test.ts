/// <reference types="vite/client" />
// @vitest-environment edge-runtime
import { convexTest } from "convex-test";
import { afterEach, expect, it, vi } from "vitest";

import { api } from "./_generated/api";
import {
  convexModules,
  registerAuth,
  seedDemo,
  signIn,
  signInAs,
} from "./lib/auth.testing";
import { billingMonth, meterDirectCashReceipt } from "./lib/draftBilling";
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

it("freezes a draft price book and invoice from deduplicated cash usage only", async () => {
  const w = await world();
  vi.stubEnv("ADMIN_EMAIL", "billing-admin@luma.test");
  const admin = await signIn(w.t, {
    email: "billing-admin@luma.test",
    twoFactorEnabled: true,
  });
  await admin.mutation(api.identity.ensureProfile, { locale: "en" });
  const prior = new Date(Date.now() - 45 * 24 * 60 * 60 * 1000);
  const month = billingMonth(prior.getTime());
  const priceBook = {
    version: "pilot-1",
    startsMonth: month,
    plans: [{ plan: "yard" as const, monthlyPaise: 1000 }],
    feeBps: 50,
    feeCapPaise: 200,
  };
  const inputs = {
    orgId: w.orgId,
    month,
    priceBookVersion: "pilot-1",
    plan: "yard" as const,
  };
  const roster = { paginationOpts: { numItems: 10, cursor: null } };
  await expect(
    w.owner.query(api.businessSubscriptions.draftSitesForAdmin, roster),
  ).rejects.toThrow("NOT_ADMIN");
  const sites = await admin.query(
    api.businessSubscriptions.draftSitesForAdmin,
    roster,
  );
  expect(sites.page).toEqual(
    expect.arrayContaining([expect.objectContaining({ orgId: w.orgId })]),
  );
  await expect(
    w.owner.mutation(api.businessSubscriptions.recordDraftPriceBook, priceBook),
  ).rejects.toThrow("NOT_ADMIN");
  await expect(
    admin.mutation(api.businessSubscriptions.generateDraftInvoice, inputs),
  ).rejects.toThrow("DRAFT_PRICE_BOOK_NOT_FOUND");
  const bookId = await admin.mutation(
    api.businessSubscriptions.recordDraftPriceBook,
    priceBook,
  );
  expect(
    await admin.mutation(
      api.businessSubscriptions.recordDraftPriceBook,
      priceBook,
    ),
  ).toBe(bookId);
  await expect(
    admin.mutation(api.businessSubscriptions.recordDraftPriceBook, {
      ...priceBook,
      feeBps: 25,
    }),
  ).rejects.toThrow("DRAFT_PRICE_BOOK_CONFLICT");

  await w.owner.mutation(api.businessSubscriptions.selectPlan, {
    orgId: w.orgId,
    plan: "trader",
    expectedVersion: 0,
  });
  await w.t.run(async (ctx) => {
    const trade = await ctx.db
      .query("trades")
      .withIndex("by_buyer", (q) => q.eq("buyerOrgId", w.orgId))
      .first();
    if (!trade) throw new Error("missing order");
    await meterDirectCashReceipt(
      ctx,
      { ...trade, totalPaise: 100 },
      prior.getTime(),
    );
    await meterDirectCashReceipt(
      ctx,
      { ...trade, totalPaise: 100 },
      prior.getTime(),
    );
    await expect(
      meterDirectCashReceipt(
        ctx,
        { ...trade, totalPaise: 101 },
        prior.getTime(),
      ),
    ).rejects.toThrow("DRAFT_USAGE_CONFLICT");
  });
  const invoice = await admin.mutation(
    api.businessSubscriptions.generateDraftInvoice,
    inputs,
  );
  expect(
    await admin.mutation(
      api.businessSubscriptions.generateDraftInvoice,
      inputs,
    ),
  ).toBe(invoice);
  await expect(
    admin.mutation(api.businessSubscriptions.generateDraftInvoice, {
      ...inputs,
      month: billingMonth(Date.now()),
    }),
  ).rejects.toThrow("DRAFT_PERIOD_OPEN");
  const status = await w.owner.query(api.businessSubscriptions.status, {
    orgId: w.orgId,
  });
  expect(status).toMatchObject({
    entitlement: null,
    billingAvailable: false,
    request: { selectedPlan: "trader" },
    drafts: [
      {
        month,
        plan: "yard",
        priceBookVersion: "pilot-1",
        usageCount: 1,
        subtotalPaise: 1001,
      },
    ],
  });
  const membership = await w.t.run((ctx) =>
    ctx.db
      .query("memberships")
      .withIndex("by_org", (q) => q.eq("orgId", w.orgId))
      .unique(),
  );
  if (!membership) throw new Error("missing membership");
  await w.t.run((ctx) =>
    ctx.db.patch("memberships", membership._id, { role: "viewer" }),
  );
  expect(
    await w.owner.query(api.businessSubscriptions.status, { orgId: w.orgId }),
  ).toMatchObject({ drafts: null });
});
