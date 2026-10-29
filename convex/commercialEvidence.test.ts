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
const firstPage = { cursor: null, numItems: 50 };

async function world() {
  vi.stubEnv("AUTH_DEV_MODE", "true");
  const t = convexTest(schema, modules);
  registerAuth(t);
  await seedDemo(t);
  const trade = await t.run(async (ctx) => {
    const seller = await ctx.db
      .query("orgs")
      .withIndex("by_slug", (q) => q.eq("slug", "ramesh-kabadi-store"))
      .unique();
    if (!seller) throw new Error("Demo seller missing");
    return ctx.db
      .query("trades")
      .withIndex("by_seller", (q) => q.eq("sellerOrgId", seller._id))
      .first();
  });
  if (!trade) throw new Error("Demo trade missing");
  return { t, trade };
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("commercial evidence", () => {
  it("records a reported invoice for both trade parties without changing the trade", async () => {
    const { t, trade } = await world();
    const seller = await signInAs(t, "+919000000101");
    const buyer = await signInAs(t, "+919000000102");

    const id = await seller.mutation(api.commercialEvidence.recordExternal, {
      tradeId: trade._id,
      kind: "gst_invoice",
      reference: " INV-TEST-1 ",
      issuerKind: "trade_seller",
    });
    const visible = await buyer.query(api.commercialEvidence.forTrade, {
      tradeId: trade._id,
      paginationOpts: firstPage,
    });

    expect(visible.page).toMatchObject([
      {
        id,
        kind: "gst_invoice",
        reference: "INV-TEST-1",
        issuerKind: "trade_seller",
        issuerName: "Ramesh Kabadi Store",
        verificationStatus: "reported_unverified",
      },
    ]);
    expect(await t.run(async (ctx) => ctx.db.get("trades", trade._id))).toEqual(
      trade,
    );
    const audit = await t.run(async (ctx) =>
      ctx.db
        .query("auditLog")
        .withIndex("by_entity", (q) =>
          q.eq("entityTable", "commercialEvidence").eq("entityId", id),
        )
        .unique(),
    );
    expect(audit?.action).toBe("commercial_evidence.recorded");
  });

  it("blocks other businesses and signed-out users from trade evidence", async () => {
    const { t, trade } = await world();
    const other = await signInAs(t, "+919000000103");
    const args = {
      tradeId: trade._id,
      kind: "eway_bill" as const,
      reference: "TEST-EWAY",
      issuerKind: "external_authority" as const,
      issuerName: "GST portal",
    };

    await expect(
      other.mutation(api.commercialEvidence.recordExternal, args),
    ).rejects.toThrow(/TRADE_NOT_FOUND/);
    await expect(
      other.query(api.commercialEvidence.forTrade, {
        tradeId: trade._id,
        paginationOpts: firstPage,
      }),
    ).rejects.toThrow(/TRADE_NOT_FOUND/);
    await expect(
      t.mutation(api.commercialEvidence.recordExternal, args),
    ).rejects.toThrow(/NOT_SIGNED_IN/);
  });

  it("keeps corrections append-only and rejects a second replacement", async () => {
    const { t, trade } = await world();
    const seller = await signInAs(t, "+919000000101");
    const base = {
      tradeId: trade._id,
      kind: "gst_invoice" as const,
      issuerKind: "trade_seller" as const,
    };
    const original = await seller.mutation(
      api.commercialEvidence.recordExternal,
      { ...base, reference: "WRONG" },
    );
    const corrected = await seller.mutation(
      api.commercialEvidence.recordExternal,
      { ...base, reference: "RIGHT", supersedesId: original },
    );
    await expect(
      seller.mutation(api.commercialEvidence.recordExternal, {
        ...base,
        reference: "ANOTHER",
        supersedesId: original,
      }),
    ).rejects.toThrow(/ALREADY_CORRECTED/);
    const rows = await seller.query(api.commercialEvidence.forTrade, {
      tradeId: trade._id,
      paginationOpts: firstPage,
    });
    expect(rows.page).toHaveLength(2);
    expect(rows.page.find((row) => row.id === corrected)?.supersedesId).toBe(
      original,
    );
    expect(rows.page.find((row) => row.id === original)?.reference).toBe(
      "WRONG",
    );
  });

  it("requires an identified external issuer and rejects false trade-party names", async () => {
    const { t, trade } = await world();
    const seller = await signInAs(t, "+919000000101");
    await expect(
      seller.mutation(api.commercialEvidence.recordExternal, {
        kind: "cpcb_epr_certificate",
        reference: "TEST-CPCB",
        issuerKind: "external_authority",
        issuerName: "  ",
      }),
    ).rejects.toThrow(/INVALID_ISSUER/);
    await expect(
      seller.mutation(api.commercialEvidence.recordExternal, {
        tradeId: trade._id,
        kind: "gst_invoice",
        reference: "TEST-INV",
        issuerKind: "trade_seller",
        issuerName: "Not the seller",
      }),
    ).rejects.toThrow(/INVALID_ISSUER/);
  });

  it("keeps organization evidence private and marks a CPCB reference unverified", async () => {
    const { t } = await world();
    const recycler = await signInAs(t, "+919000000103");
    const other = await signInAs(t, "+919000000101");
    const id = await recycler.mutation(api.commercialEvidence.recordExternal, {
      kind: "cpcb_epr_certificate",
      reference: "TEST-CPCB-REFERENCE",
      issuerKind: "external_authority",
      issuerName: "CPCB portal",
    });

    const own = await recycler.query(api.commercialEvidence.mine, {
      paginationOpts: firstPage,
    });
    const anotherOrg = await other.query(api.commercialEvidence.mine, {
      paginationOpts: firstPage,
    });
    expect(own.page).toMatchObject([
      {
        id,
        kind: "cpcb_epr_certificate",
        verificationStatus: "reported_unverified",
      },
    ]);
    expect(anotherOrg.page).toEqual([]);
  });
});

it("binds preparation reads to the expected selected workspace even when its evidence list is empty", async () => {
  const { t, trade } = await world();
  const seller = await signInAs(t, "+919000000101");
  await expect(
    seller.query(api.commercialEvidence.mine, {
      expectedOrgId: trade.buyerOrgId,
      paginationOpts: firstPage,
    }),
  ).rejects.toThrow("EVIDENCE_SCOPE_CHANGED");
  await expect(
    seller.query(api.commercialEvidence.mine, {
      expectedOrgId: trade.sellerOrgId,
      paginationOpts: firstPage,
    }),
  ).resolves.toMatchObject({ page: [] });
});
