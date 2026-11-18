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
import * as lotReservations from "./lib/lotReservations";
import { requireUnreservedLot } from "./lib/lotReservations";
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
  const shop = await signInAs(t, "+919000000101");
  const yard = await signInAs(t, "+919000000102");
  const { shopId, yardId } = await t.run(async (ctx) => {
    const orgs = await ctx.db.query("orgs").collect();
    const seller = orgs.find((org) => org.kind === "kabadiwala");
    const buyer = orgs.find((org) => org.kind === "yard");
    if (!seller || !buyer) throw new Error("Missing fixture organisations");
    const offers = await ctx.db
      .query("listings")
      .withIndex("by_org", (q) => q.eq("orgId", seller._id))
      .collect();
    for (const offer of offers)
      await ctx.db.patch("listings", offer._id, { status: "withdrawn" });
    const stock = await ctx.db
      .query("inventory")
      .withIndex("by_org_material", (q) =>
        q.eq("orgId", seller._id).eq("materialCode", "PLASTIC-PET"),
      )
      .unique();
    if (!stock) throw new Error("Missing fixture stock");
    await ctx.db.patch("inventory", stock._id, { grams: 200_000 });
    return { shopId: seller._id, yardId: buyer._id };
  });
  const lotId = await shop.mutation(api.traceability.declareLot, {
    materialCode: "PLASTIC-PET",
    state: "Sorted PET",
    grams: 1000,
    streamClass: "recoverable_waste",
    handlingClass: "non_hazardous",
  });
  const offer = {
    materialCode: "PLASTIC-PET",
    grams: 1000,
    askPaisePerKg: 2500,
    specification: { lotId, grade: "Clear PET", specification: "Buyer Q1" },
  };
  return { t, shop, yard, shopId, yardId, lotId, offer };
}

describe("named lot offer reservations", () => {
  it("omits offered and accepted lots from the next listing's choices", async () => {
    const { shop, yard, lotId, offer } = await world();
    const choices = () =>
      shop.query(api.market.listingLotOptions, {
        materialCode: offer.materialCode,
      });
    expect(await choices()).toContainEqual({
      id: lotId,
      state: "Sorted PET",
      grams: offer.grams,
    });
    const listingId = await shop.mutation(api.market.createListing, offer);
    expect(await choices()).not.toContainEqual(
      expect.objectContaining({ id: lotId }),
    );
    const tradeId = await yard.mutation(api.market.requestTrade, {
      listingId,
      grams: offer.grams,
    });
    await shop.mutation(api.market.act, { tradeId, action: "accept" });
    expect(await choices()).not.toContainEqual(
      expect.objectContaining({ id: lotId }),
    );
  });

  it.each(["expired", "withdrawn"] as const)(
    "offers a lot as a listing choice again after its offer is %s",
    async (status) => {
      const { t, shop, lotId, offer } = await world();
      const listingId = await shop.mutation(api.market.createListing, offer);
      if (status === "expired")
        await t.run((ctx) =>
          ctx.db.patch("listings", listingId, { expiresAt: Date.now() - 1 }),
        );
      else await shop.mutation(api.market.withdraw, { listingId });
      expect(
        await shop.query(api.market.listingLotOptions, {
          materialCode: offer.materialCode,
        }),
      ).toContainEqual({ id: lotId, state: "Sorted PET", grams: offer.grams });
    },
  );

  it("omits failed quality without changing the lot or its stock", async () => {
    const { t, shop, shopId, lotId, offer } = await world();
    await shop.mutation(api.quality.recordInspection, {
      lotId,
      specificationReference: "Buyer Q1",
      specificationVersion: "1",
      sampleMethod: "Composite sample",
      results: [{ parameter: "PVC", unit: "ppm", value: "180" }],
      decision: "rejected",
    });
    const snapshot = () =>
      t.run(async (ctx) => ({
        lot: await ctx.db.get("materialLots", lotId),
        stock: await ctx.db
          .query("inventory")
          .withIndex("by_org_material", (q) =>
            q.eq("orgId", shopId).eq("materialCode", offer.materialCode),
          )
          .unique(),
      }));
    const before = await snapshot();
    expect(
      await shop.query(api.market.listingLotOptions, {
        materialCode: offer.materialCode,
      }),
    ).not.toContainEqual(expect.objectContaining({ id: lotId }));
    expect(await snapshot()).toEqual(before);
  });

  it("does not hide unexpected reservation failures behind an empty choice list", async () => {
    const { shop, offer } = await world();
    vi.spyOn(lotReservations, "requireUnreservedLot").mockRejectedValueOnce(
      new Error("Unexpected reservation query failure"),
    );
    await expect(
      shop.query(api.market.listingLotOptions, {
        materialCode: offer.materialCode,
      }),
    ).rejects.toThrow("Unexpected reservation query failure");
  });

  it("refuses another offer for the same lot despite spare aggregate stock", async () => {
    const { shop, offer } = await world();
    await shop.mutation(api.market.createListing, offer);
    await expect(
      shop.mutation(api.market.createListing, offer),
    ).rejects.toThrow("LOT_RESERVED");
  });

  it("holds offered grams against direct dispatch and evidence processing", async () => {
    const { t, shop, lotId, yardId, offer } = await world();
    await shop.mutation(api.market.createListing, offer);
    await expect(
      shop.mutation(api.traceability.dispatch, {
        lotId,
        receiverOrgId: yardId,
      }),
    ).rejects.toThrow("LOT_RESERVED");
    await expect(
      shop.mutation(api.traceability.transform, {
        inputLotId: lotId,
        inputGrams: 1000,
        contaminationGrams: 0,
        processLossGrams: 0,
        outputs: [
          { materialCode: "PLASTIC-PET", state: "Baled PET", grams: 1000 },
        ],
      }),
    ).rejects.toThrow("LOT_RESERVED");
    expect(
      await t.run((ctx) => ctx.db.get("materialLots", lotId)),
    ).toMatchObject({
      status: "available",
      availableGrams: 1000,
    });
  });

  it("accepts its own offer and transfers the reservation to the trade", async () => {
    const { t, shop, yard, offer, lotId } = await world();
    const listingId = await shop.mutation(api.market.createListing, offer);
    const tradeId = await yard.mutation(api.market.requestTrade, {
      listingId,
      grams: offer.grams,
    });
    await shop.mutation(api.market.act, { tradeId, action: "accept" });
    expect(await t.run((ctx) => ctx.db.get("trades", tradeId))).toMatchObject({
      status: "accepted",
    });
    await expect(
      shop.mutation(api.market.createListing, offer),
    ).rejects.toThrow("LOT_RESERVED");
    await expect(
      t.run(async (ctx) => {
        const lot = await ctx.db.get("materialLots", lotId);
        if (!lot) throw new Error("Missing fixture lot");
        await requireUnreservedLot(ctx, lot);
      }),
    ).rejects.toThrow("LOT_RESERVED");
  });

  it.each(["expired", "withdrawn"] as const)(
    "releases a %s offer without releasing other current offers",
    async (status) => {
      const { t, shop, offer } = await world();
      const listingId = await shop.mutation(api.market.createListing, offer);
      if (status === "expired")
        await t.run((ctx) =>
          ctx.db.patch("listings", listingId, { expiresAt: Date.now() - 1 }),
        );
      else await shop.mutation(api.market.withdraw, { listingId });
      await shop.mutation(api.market.createListing, offer);
      await expect(
        shop.mutation(api.market.createListing, offer),
      ).rejects.toThrow("LOT_RESERVED");
    },
  );

  it("never ignores a different open offer while accepting its own", async () => {
    const { t, shop, yard, offer } = await world();
    const listingId = await shop.mutation(api.market.createListing, offer);
    const tradeId = await yard.mutation(api.market.requestTrade, {
      listingId,
      grams: offer.grams,
    });
    await t.run(async (ctx) => {
      const original = await ctx.db.get("listings", listingId);
      if (!original) throw new Error("Missing fixture offer");
      const { _id, _creationTime, ...fields } = original;
      await ctx.db.insert("listings", fields);
    });
    await expect(
      shop.mutation(api.market.act, { tradeId, action: "accept" }),
    ).rejects.toThrow("LOT_RESERVED");
    expect(await t.run((ctx) => ctx.db.get("trades", tradeId))).toMatchObject({
      status: "requested",
    });
  });

  it("allows only one concurrent offer for a named lot", async () => {
    const { shop, offer } = await world();
    const attempts = await Promise.allSettled([
      shop.mutation(api.market.createListing, offer),
      shop.mutation(api.market.createListing, offer),
    ]);
    expect(
      attempts.filter((result) => result.status === "fulfilled"),
    ).toHaveLength(1);
    expect(
      attempts.filter((result) => result.status === "rejected"),
    ).toHaveLength(1);
  });

  it("does not treat another organisation's offer as this holder's reservation", async () => {
    const { t, shop, yardId, offer } = await world();
    const listingId = await shop.mutation(api.market.createListing, offer);
    await t.run((ctx) =>
      ctx.db.patch("listings", listingId, { orgId: yardId }),
    );
    await expect(
      shop.mutation(api.market.createListing, offer),
    ).resolves.toBeDefined();
  });

  it("fails closed when too many open historical offers prevent a complete check", async () => {
    const { t, shop, offer, shopId } = await world();
    const listingId = await shop.mutation(api.market.createListing, offer);
    await t.run(async (ctx) => {
      const listing = await ctx.db.get("listings", listingId);
      if (!listing) throw new Error("Missing fixture offer");
      const { _id, _creationTime, ...fields } = listing;
      for (let index = 0; index < 101; index += 1)
        await ctx.db.insert("listings", {
          ...fields,
          orgId: shopId,
          expiresAt: Date.now() - 1,
        });
      await ctx.db.delete("listings", listingId);
    });
    await expect(
      shop.mutation(api.market.createListing, offer),
    ).rejects.toThrow("TOO_MANY_LOT_OFFERS");
  });
});
