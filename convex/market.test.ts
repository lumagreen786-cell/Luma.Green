/// <reference types="vite/client" />
// @vitest-environment edge-runtime
import { convexTest } from "convex-test";
import { afterEach, describe, expect, it, vi } from "vitest";

import { api } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import {
  convexModules,
  registerAuth,
  seedDemo,
  signIn,
  signInAs,
} from "./lib/auth.testing";
import { paiseFor } from "./lib/chain";
import schema from "./schema";

const modules = convexModules(import.meta.glob("./**/*.*s"));

// Demo logins (convex/lib/demo.ts).
const SHOP = "+919000000101"; // Ramesh Kabadi Store — kabadiwala
const YARD = "+919000000102"; // Peenya Paper & Plastic Yard
const RECYCLER = "+919000000103"; // GreenLoop Polymers
const MAKER = "+919000000104"; // Deccan Packaging — manufacturer
const SAATHI = "+919000000105";

const RAMESH = "Ramesh Kabadi Store";
const PEENYA = "Peenya Paper & Plastic Yard";

afterEach(() => {
  vi.unstubAllEnvs();
});

async function demoWorld() {
  vi.stubEnv("AUTH_DEV_MODE", "true");
  const t = convexTest(schema, modules);
  registerAuth(t);
  await seedDemo(t);
  // This suite also exercises iron offers. Give its buyer explicit material
  // scope instead of relying on the former regular-chain family bypass.
  await t.run(async (ctx) => {
    const fixtures = await ctx.db.query("listings").collect();
    for (const fixture of fixtures)
      if (fixture.status === "open")
        await ctx.db.patch("listings", fixture._id, {
          expiresAt: Date.now() + 30 * 86_400_000,
        });
    const buyer = await ctx.db
      .query("orgs")
      .withIndex("by_slug", (q) => q.eq("slug", "peenya-paper-plastic-yard"))
      .unique();
    if (!buyer) throw new Error("Missing test buyer");
    await ctx.db.patch("orgs", buyer._id, {
      families: ["paper", "plastic", "metal"],
    });
  });
  return t;
}

type Test = Awaited<ReturnType<typeof demoWorld>>;
type Session = Awaited<ReturnType<typeof signInAs>>;

/** Sets a business's stock of one material, as if it sold some elsewhere. */
async function setStock(t: Test, slug: string, code: string, grams: number) {
  await t.run(async (ctx) => {
    const org = await ctx.db
      .query("orgs")
      .withIndex("by_slug", (q) => q.eq("slug", slug))
      .unique();
    if (!org) throw new Error(`No org ${slug}`);
    const row = await ctx.db
      .query("inventory")
      .withIndex("by_org_material", (q) =>
        q.eq("orgId", org._id).eq("materialCode", code),
      )
      .first();
    if (!row) throw new Error(`No ${code} stock for ${slug}`);
    await ctx.db.patch("inventory", row._id, { grams });
  });
}

async function stockOf(t: Test, slug: string, code: string) {
  return t.run(async (ctx) => {
    const org = await ctx.db
      .query("orgs")
      .withIndex("by_slug", (q) => q.eq("slug", slug))
      .unique();
    if (!org) throw new Error(`No org ${slug}`);
    const row = await ctx.db
      .query("inventory")
      .withIndex("by_org_material", (q) =>
        q.eq("orgId", org._id).eq("materialCode", code),
      )
      .first();
    return row?.grams ?? 0;
  });
}

async function lotOf(as: Session, seller: string, code: string) {
  const lots = await as.query(api.market.browse, { materialCode: code });
  const lot = lots.find((candidate) => candidate.seller.name === seller);
  if (!lot) throw new Error(`No ${code} lot from ${seller}`);
  return lot;
}

async function lotIds(as: Session, materialCode?: string) {
  const lots = await as.query(api.market.browse, { materialCode });
  return lots.map((lot) => lot.id);
}

async function tradeOf(
  as: Session,
  side: "buying" | "selling",
  id: Id<"trades">,
) {
  const trades = await as.query(api.market.trades, {});
  const trade = trades[side].find((candidate) => candidate.id === id);
  if (!trade) throw new Error(`Trade ${id} not in ${side}`);
  return trade;
}

async function auditActions(t: Test, entityTable: string, id: string) {
  return t.run(async (ctx) => {
    const rows = await ctx.db
      .query("auditLog")
      .withIndex("by_entity", (q) =>
        q.eq("entityTable", entityTable).eq("entityId", id),
      )
      .collect();
    return rows.map((row) => row.action);
  });
}

describe("browse", () => {
  it("freezes a seller specification into the order and rechecks linked lot custody before acceptance", async () => {
    const t = await demoWorld();
    const shop = await signInAs(t, SHOP);
    const yard = await signInAs(t, YARD);
    const lotId = await shop.mutation(api.traceability.declareLot, {
      materialCode: "PLASTIC-PET",
      state: "Hot washed",
      grams: 1000,
      streamClass: "recoverable_waste",
      handlingClass: "non_hazardous",
    });
    const listingId = await shop.mutation(api.market.createListing, {
      materialCode: "PLASTIC-PET",
      grams: 1000,
      askPaisePerKg: 2500,
      specification: {
        grade: "Clear PET",
        specification: "Buyer specification Q1",
        lotId,
      },
    });
    const tradeId = await yard.mutation(api.market.requestTrade, {
      listingId,
      grams: 1000,
    });
    const order = await tradeOf(yard, "buying", tradeId);
    expect(order.specification).toEqual({
      grade: "Clear PET",
      specification: "Buyer specification Q1",
      lotId,
      lotState: "Hot washed",
      source: "seller_declared",
    });
    const destination = await t.run(async (ctx) => {
      const row = await ctx.db
        .query("orgs")
        .withIndex("by_slug", (q) => q.eq("slug", "peenya-paper-plastic-yard"))
        .unique();
      if (!row) throw new Error("Missing buyer");
      return row._id;
    });
    await shop.mutation(api.traceability.dispatch, {
      lotId,
      receiverOrgId: destination,
    });
    await expect(
      shop.mutation(api.market.act, { tradeId, action: "accept" }),
    ).rejects.toThrow("LOT_NOT_ELIGIBLE");
    const retained = await tradeOf(yard, "buying", tradeId);
    expect(retained.status).toBe("requested");
    expect(retained.specification).toEqual(order.specification);
  });

  it("rejects another business's or controlled lot as sale evidence and does not create inventory from declarations", async () => {
    const t = await demoWorld();
    const shop = await signInAs(t, SHOP);
    const yard = await signInAs(t, YARD);
    const before = await stockOf(t, "ramesh-kabadi-store", "PLASTIC-PET");
    const foreignLot = await yard.mutation(api.traceability.declareLot, {
      materialCode: "PLASTIC-PET",
      state: "Sorted",
      grams: 1000,
    });
    const controlledLot = await shop.mutation(api.traceability.declareLot, {
      materialCode: "PLASTIC-PET",
      state: "Residue",
      grams: 1000,
      handlingClass: "controlled",
    });
    const offer = {
      materialCode: "PLASTIC-PET",
      grams: 1000,
      askPaisePerKg: 2500,
    };
    await expect(
      shop.mutation(api.market.createListing, {
        ...offer,
        specification: { grade: "PET", specification: "Q1", lotId: foreignLot },
      }),
    ).rejects.toThrow("LOT_NOT_ELIGIBLE");
    await expect(
      shop.mutation(api.market.createListing, {
        ...offer,
        specification: {
          grade: "PET",
          specification: "Q1",
          lotId: controlledLot,
        },
      }),
    ).rejects.toThrow("CONTROLLED_ROUTE_REQUIRED");
    await expect(
      shop.mutation(api.market.createListing, {
        ...offer,
        specification: { grade: " ", specification: "Q1" },
      }),
    ).rejects.toThrow("INVALID_LABEL");
    const choices = await shop.query(api.market.listingLotOptions, {
      materialCode: "PLASTIC-PET",
    });
    expect(choices.map((row) => row.id)).not.toContain(foreignLot);
    expect(choices.map((row) => row.id)).not.toContain(controlledLot);
    expect(await stockOf(t, "ramesh-kabadi-store", "PLASTIC-PET")).toBe(before);
  });

  it("rechecks an ordinary buyer's material scope when accepting a pending request", async () => {
    const t = await demoWorld();
    const shop = await signInAs(t, SHOP);
    const yard = await signInAs(t, YARD);
    const listing = await lotOf(yard, RAMESH, "PAPER-NEWS");
    const tradeId = await yard.mutation(api.market.requestTrade, {
      listingId: listing.id,
      grams: 1000,
    });
    await t.run(async (ctx) => {
      const buyer = await ctx.db
        .query("orgs")
        .withIndex("by_slug", (q) => q.eq("slug", "peenya-paper-plastic-yard"))
        .unique();
      if (!buyer) throw new Error("Missing test buyer");
      await ctx.db.patch("orgs", buyer._id, { families: ["plastic"] });
    });
    expect(await lotIds(yard, "PAPER-NEWS")).not.toContain(listing.id);
    await expect(
      yard.mutation(api.market.requestTrade, {
        listingId: listing.id,
        grams: 1000,
      }),
    ).rejects.toThrow("MATERIAL_NOT_ELIGIBLE");
    await expect(
      shop.mutation(api.market.act, { tradeId, action: "accept" }),
    ).rejects.toThrow("MATERIAL_NOT_ELIGIBLE");
  });

  it("blocks a newly restricted material for ordinary sellers, including existing requests", async () => {
    const t = await demoWorld();
    const shop = await signInAs(t, SHOP);
    const yard = await signInAs(t, YARD);
    const listing = await lotOf(yard, RAMESH, "PAPER-NEWS");
    const tradeId = await yard.mutation(api.market.requestTrade, {
      listingId: listing.id,
      grams: 1000,
    });
    await t.run(async (ctx) => {
      const material = await ctx.db
        .query("materials")
        .withIndex("by_code", (q) => q.eq("code", "PAPER-NEWS"))
        .unique();
      if (!material) throw new Error("Missing test material");
      await ctx.db.patch("materials", material._id, {
        byproductEligibility: {
          hazardStatus: "hazardous",
          sourceReference: "Synthetic controlled-material restriction",
          reviewedAt: Date.now(),
        },
      });
    });
    expect(await lotIds(yard, "PAPER-NEWS")).not.toContain(listing.id);
    const sellable = await shop.query(api.market.sellable, {});
    expect(sellable.some((row) => row.material.code === "PAPER-NEWS")).toBe(
      false,
    );
    await expect(
      shop.mutation(api.market.createListing, {
        materialCode: "PAPER-NEWS",
        grams: 1000,
        askPaisePerKg: 1000,
      }),
    ).rejects.toThrow("MATERIAL_NOT_ELIGIBLE");
    await expect(
      yard.mutation(api.market.requestTrade, {
        listingId: listing.id,
        grams: 1000,
      }),
    ).rejects.toThrow("MATERIAL_NOT_ELIGIBLE");
    await expect(
      shop.mutation(api.market.act, { tradeId, action: "accept" }),
    ).rejects.toThrow("MATERIAL_NOT_ELIGIBLE");
    const unchanged = await tradeOf(shop, "selling", tradeId);
    expect(unchanged.status).toBe("requested");
  });

  it("shows each buyer the tier below it, never its own lots", async () => {
    const t = await demoWorld();

    const yard = await signInAs(t, YARD);
    const forYard = await yard.query(api.market.browse, {});
    expect(forYard.length).toBeGreaterThan(0);
    expect(new Set(forYard.map((lot) => lot.seller.kind))).toEqual(
      new Set(["kabadiwala"]),
    );
    expect(forYard.some((lot) => lot.isMine)).toBe(false);
    expect(forYard.map((lot) => lot.seller.name)).toContain(RAMESH);

    const recycler = await signInAs(t, RECYCLER);
    const forRecycler = await recycler.query(api.market.browse, {});
    expect(new Set(forRecycler.map((lot) => lot.seller.kind))).toEqual(
      new Set(["yard"]),
    );
    expect(forRecycler.map((lot) => lot.seller.name)).toContain(PEENYA);

    const maker = await signInAs(t, MAKER);
    const forMaker = await maker.query(api.market.browse, {});
    expect(new Set(forMaker.map((lot) => lot.seller.kind))).toEqual(
      new Set(["recycler"]),
    );
    expect(forMaker.map((lot) => lot.material.code)).toContain(
      "RECYCLED-PET-FLAKE",
    );
  });

  it("filters by material", async () => {
    const t = await demoWorld();
    const yard = await signInAs(t, YARD);
    const paper = await yard.query(api.market.browse, {
      materialCode: "PAPER-NEWS",
    });
    expect(paper.length).toBeGreaterThan(0);
    expect(paper.every((lot) => lot.material.code === "PAPER-NEWS")).toBe(true);
    expect(paper.find((lot) => lot.seller.name === RAMESH)).toMatchObject({
      grams: 150_000,
      note: "Dry, bundled",
      status: "open",
    });
  });

  it("leaves out unbacked stock even in other cities", async () => {
    const t = await demoWorld();
    await t.run(async (ctx) => {
      const now = Date.now();
      const orgId = await ctx.db.insert("orgs", {
        kind: "kabadiwala",
        name: "Mysuru Scrap",
        slug: "mysuru-scrap",
        status: "active",
        city: "Mysuru",
        area: "Vijayanagar",
        address: "Vijayanagar, Mysuru",
        phones: [],
        weeklyOff: [],
        families: ["paper"],
        offersPickup: false,
        createdAt: now,
        updatedAt: now,
      });
      await ctx.db.insert("listings", {
        orgId,
        sellerKind: "kabadiwala",
        materialCode: "PAPER-NEWS",
        grams: 50_000,
        askPaisePerKg: 1700,
        city: "Mysuru",
        status: "open",
        createdAt: now,
        updatedAt: now,
      });
    });
    const yard = await signInAs(t, YARD);
    const lots = await yard.query(api.market.browse, {});
    expect(lots.map((lot) => lot.seller.name)).not.toContain("Mysuru Scrap");
  });

  it("lets approved businesses browse and keeps applicants out", async () => {
    const t = await demoWorld();
    await expect(t.query(api.market.browse, {})).rejects.toThrow(
      /NOT_SIGNED_IN/,
    );
    const shop = await signInAs(t, SHOP);
    expect(await shop.query(api.market.browse, {})).toEqual([]);
    const saathi = await signInAs(t, SAATHI);
    await expect(saathi.query(api.market.browse, {})).rejects.toThrow(
      /NO_BUSINESS/,
    );
  });
});

describe("a trade awaiting the payment gateway", () => {
  it("accepts a request but cannot claim payment, dispatch, or delivery", async () => {
    const t = await demoWorld();
    const yard = await signInAs(t, YARD);
    const shop = await signInAs(t, SHOP);
    const lot = await lotOf(yard, RAMESH, "PAPER-NEWS");
    const shopStock = await stockOf(t, "ramesh-kabadi-store", "PAPER-NEWS");
    const yardStock = await stockOf(
      t,
      "peenya-paper-plastic-yard",
      "PAPER-NEWS",
    );

    // 1. The yard asks for 100 kg at the asking price.
    const tradeId = await yard.mutation(api.market.requestTrade, {
      listingId: lot.id,
      grams: 100_000,
    });
    const requested = await tradeOf(shop, "selling", tradeId);
    expect(requested).toMatchObject({
      status: "requested",
      grams: 100_000,
      paisePerKg: lot.askPaisePerKg,
      totalPaise: paiseFor(100_000, lot.askPaisePerKg),
      counterparty: { name: PEENYA, kind: "yard" },
      actions: ["accept", "decline"],
      inEscrow: false,
    });
    const asked = await tradeOf(yard, "buying", tradeId);
    expect(asked).toMatchObject({
      counterparty: { name: RAMESH, kind: "kabadiwala" },
      actions: [],
    });

    // 2. The kabadiwala accepts: the lot shrinks, nothing is paid yet.
    await shop.mutation(api.market.act, { tradeId, action: "accept" });
    const shrunk = await lotOf(yard, RAMESH, "PAPER-NEWS");
    expect(shrunk.grams).toBe(50_000);
    const accepted = await tradeOf(yard, "buying", tradeId);
    expect(accepted).toMatchObject({
      status: "accepted",
      actions: [],
      inEscrow: false,
      paymentVerification: "gateway_required",
    });
    expect(accepted).not.toHaveProperty("invoiceNo");

    for (const [actor, action] of [
      [yard, "pay"],
      [shop, "dispatch"],
      [yard, "confirm"],
    ] as const) {
      await expect(
        actor.mutation(api.market.act, { tradeId, action }),
      ).rejects.toThrow(/GATEWAY_REQUIRED/);
    }
    expect(await stockOf(t, "ramesh-kabadi-store", "PAPER-NEWS")).toBe(
      shopStock,
    );
    expect(await stockOf(t, "peenya-paper-plastic-yard", "PAPER-NEWS")).toBe(
      yardStock,
    );
    const unchanged = await tradeOf(yard, "buying", tradeId);
    expect(unchanged.timeline).toHaveLength(2);
    expect(await auditActions(t, "trades", tradeId)).toEqual([
      "trade.requested",
      "trade.accepted",
    ]);
  });

  it("sells a lot out, then declines the requests still waiting", async () => {
    const t = await demoWorld();
    const yard = await signInAs(t, YARD);
    const shop = await signInAs(t, SHOP);
    const lot = await lotOf(yard, RAMESH, "PAPER-NEWS"); // 150 kg

    const request = (grams: number) =>
      yard.mutation(api.market.requestTrade, { listingId: lot.id, grams });
    const first = await request(100_000);
    const tooBig = await request(100_000);
    const small = await request(30_000);

    await shop.mutation(api.market.act, { tradeId: first, action: "accept" });
    // Only 50 kg left: the second 100 kg can't be accepted.
    await expect(
      shop.mutation(api.market.act, { tradeId: tooBig, action: "accept" }),
    ).rejects.toThrow(/NOT_ENOUGH_LEFT/);

    const rest = await request(50_000);
    await shop.mutation(api.market.act, { tradeId: rest, action: "accept" });

    const mine = await shop.query(api.market.myListings, {});
    expect(mine.find((listing) => listing.id === lot.id)).toMatchObject({
      status: "sold",
      grams: 0,
    });
    const { selling } = await shop.query(api.market.trades, {});
    for (const id of [tooBig, small]) {
      expect(selling.find((trade) => trade.id === id)?.status).toBe("declined");
      expect(await auditActions(t, "trades", id)).toEqual([
        "trade.requested",
        "trade.declined",
      ]);
    }
    // The request that sold the lot out is accepted, and only accepted.
    expect(selling.find((trade) => trade.id === rest)?.status).toBe("accepted");
    expect(await auditActions(t, "trades", rest)).toEqual([
      "trade.requested",
      "trade.accepted",
    ]);
    expect(await lotIds(yard, "PAPER-NEWS")).not.toContain(lot.id);
  });

  it("lets a seller decline a request", async () => {
    const t = await demoWorld();
    const yard = await signInAs(t, YARD);
    const shop = await signInAs(t, SHOP);
    const lot = await lotOf(yard, RAMESH, "METAL-IRON");
    const tradeId = await yard.mutation(api.market.requestTrade, {
      listingId: lot.id,
      grams: 20_000,
    });
    await shop.mutation(api.market.act, { tradeId, action: "decline" });
    expect(await tradeOf(yard, "buying", tradeId)).toMatchObject({
      status: "declined",
      actions: [],
    });
    // Declining leaves the lot as it was.
    const after = await lotOf(yard, RAMESH, "METAL-IRON");
    expect(after.grams).toBe(lot.grams);
  });
});

describe("act refuses", () => {
  it("rejects wrong-side acceptance and all payment actions", async () => {
    const t = await demoWorld();
    const yard = await signInAs(t, YARD);
    const shop = await signInAs(t, SHOP);
    const lot = await lotOf(yard, RAMESH, "PAPER-NEWS");
    const tradeId = await yard.mutation(api.market.requestTrade, {
      listingId: lot.id,
      grams: 10_000,
    });

    // The buyer can't accept their own request.
    await expect(
      yard.mutation(api.market.act, { tradeId, action: "accept" }),
    ).rejects.toThrow(/WRONG_STEP/);
    await expect(
      yard.mutation(api.market.act, { tradeId, action: "pay" }),
    ).rejects.toThrow(/GATEWAY_REQUIRED/);

    await shop.mutation(api.market.act, { tradeId, action: "accept" });
    // Neither side can advance through an unconfigured payment gateway.
    await expect(
      shop.mutation(api.market.act, { tradeId, action: "pay" }),
    ).rejects.toThrow(/GATEWAY_REQUIRED/);
    await expect(
      shop.mutation(api.market.act, { tradeId, action: "dispatch" }),
    ).rejects.toThrow(/GATEWAY_REQUIRED/);
    await expect(
      yard.mutation(api.market.act, { tradeId, action: "pay" }),
    ).rejects.toThrow(/GATEWAY_REQUIRED/);
    await expect(
      yard.mutation(api.market.act, { tradeId, action: "confirm" }),
    ).rejects.toThrow(/GATEWAY_REQUIRED/);
    const trade = await tradeOf(yard, "buying", tradeId);
    expect(trade.status).toBe("accepted");
  });

  it("someone else's trade, and anyone signed out", async () => {
    const t = await demoWorld();
    const yard = await signInAs(t, YARD);
    const { buying } = await yard.query(api.market.trades, {});
    const tradeId = buying[0].id;

    const maker = await signInAs(t, MAKER);
    await expect(
      maker.mutation(api.market.act, { tradeId, action: "confirm" }),
    ).rejects.toThrow(/NOT_FOUND/);
    await expect(
      t.mutation(api.market.act, { tradeId, action: "confirm" }),
    ).rejects.toThrow(/NOT_SIGNED_IN/);
  });

  it("blocks dispatch of a legacy simulated trade before stock moves", async () => {
    const t = await demoWorld();
    const shop = await signInAs(t, SHOP);
    // A seeded simulated status is not a verified gateway payment.
    await setStock(t, "ramesh-kabadi-store", "PAPER-CARTON", 95_000);
    const { selling } = await shop.query(api.market.trades, {});
    const cartons = selling.find(
      (trade) =>
        trade.material.code === "PAPER-CARTON" &&
        trade.status === "paid_to_escrow",
    );
    expect(cartons).toMatchObject({
      actions: [],
      inEscrow: false,
      paymentVerification: "legacy_unverified",
    });
    const before = await stockOf(t, "ramesh-kabadi-store", "PAPER-CARTON");
    expect(before).toBeLessThan(cartons?.grams ?? 0);

    await expect(
      shop.mutation(api.market.act, {
        tradeId: cartons?.id as Id<"trades">,
        action: "dispatch",
      }),
    ).rejects.toThrow(/GATEWAY_REQUIRED/);
    expect(await stockOf(t, "ramesh-kabadi-store", "PAPER-CARTON")).toBe(
      before,
    );
  });
});

describe("requestTrade refuses", () => {
  it("the wrong tier, too much, too little, and closed lots", async () => {
    const t = await demoWorld();
    const yard = await signInAs(t, YARD);
    const shop = await signInAs(t, SHOP);
    const lot = await lotOf(yard, RAMESH, "PAPER-NEWS");

    // A recycler buys from yards, not straight from a kabadiwala.
    const recycler = await signInAs(t, RECYCLER);
    await expect(
      recycler.mutation(api.market.requestTrade, {
        listingId: lot.id,
        grams: 10_000,
      }),
    ).rejects.toThrow(/WRONG_ROLE/);
    // A business cannot buy its own listing.
    await expect(
      shop.mutation(api.market.requestTrade, {
        listingId: lot.id,
        grams: 10_000,
      }),
    ).rejects.toThrow(/OWN_LISTING/);

    await expect(
      yard.mutation(api.market.requestTrade, {
        listingId: lot.id,
        grams: lot.grams + 1,
      }),
    ).rejects.toThrow(/NOT_ENOUGH_LEFT/);
    for (const grams of [0, -1000, 1.5]) {
      await expect(
        yard.mutation(api.market.requestTrade, { listingId: lot.id, grams }),
      ).rejects.toThrow(/INVALID_WEIGHT/);
    }

    await shop.mutation(api.market.withdraw, { listingId: lot.id });
    await expect(
      yard.mutation(api.market.requestTrade, {
        listingId: lot.id,
        grams: 10_000,
      }),
    ).rejects.toThrow(/LISTING_NOT_OPEN/);

    await expect(
      t.mutation(api.market.requestTrade, {
        listingId: lot.id,
        grams: 10_000,
      }),
    ).rejects.toThrow(/NOT_SIGNED_IN/);
  });
});

describe("selling", () => {
  it("offers only stock that isn't already listed or sold", async () => {
    const t = await demoWorld();
    const shop = await signInAs(t, SHOP);
    const sellable = await shop.query(api.market.sellable, {});
    const byCode = new Map(sellable.map((item) => [item.material.code, item]));
    // 180 kg of newspaper, 150 kg of it already on the market.
    expect(byCode.get("PAPER-NEWS")).toMatchObject({
      stage: "scrap",
      stockGrams: 180_000,
      availableGrams: 30_000,
    });
    // 300 kg of cartons, 180 kg of them promised to a paid trade.
    expect(byCode.get("PAPER-CARTON")?.availableGrams).toBe(120_000);
    expect(byCode.get("PLASTIC-PET")?.availableGrams).toBe(42_000);

    await expect(
      shop.mutation(api.market.createListing, {
        materialCode: "PAPER-NEWS",
        grams: 30_001,
        askPaisePerKg: 1800,
      }),
    ).rejects.toThrow(/NOT_ENOUGH_STOCK/);

    const listingId = await shop.mutation(api.market.createListing, {
      materialCode: "PAPER-NEWS",
      grams: 30_000,
      askPaisePerKg: 1800,
      note: "  Fresh bundles  ",
    });
    const [newest] = await shop.query(api.market.myListings, {});
    expect(newest).toMatchObject({
      id: listingId,
      status: "open",
      grams: 30_000,
      askPaisePerKg: 1800,
      note: "Fresh bundles",
      isMine: true,
    });
    const after = await shop.query(api.market.sellable, {});
    const newspaper = after.find((item) => item.material.code === "PAPER-NEWS");
    expect(newspaper?.availableGrams).toBe(0);
    expect(await auditActions(t, "listings", listingId)).toEqual([
      "listing.created",
    ]);

    // Yards see it straight away.
    const yard = await signInAs(t, YARD);
    expect(await lotIds(yard, "PAPER-NEWS")).toContain(listingId);
  });

  it("lists open lots first", async () => {
    const t = await demoWorld();
    const shop = await signInAs(t, SHOP);
    const mine = await shop.query(api.market.myListings, {});
    const firstClosed = mine.findIndex((listing) => listing.status !== "open");
    expect(firstClosed).toBeGreaterThan(0);
    expect(
      mine.slice(firstClosed).every((listing) => listing.status !== "open"),
    ).toBe(true);
  });

  it("checks every field", async () => {
    const t = await demoWorld();
    const shop = await signInAs(t, SHOP);
    const lot = {
      materialCode: "PLASTIC-PET",
      grams: 10_000,
      askPaisePerKg: 2500,
    };
    const cases = [
      [{ ...lot, grams: 0 }, /INVALID_WEIGHT/],
      [{ ...lot, grams: 10.5 }, /INVALID_WEIGHT/],
      [{ ...lot, askPaisePerKg: 0 }, /INVALID_PRICE/],
      [{ ...lot, askPaisePerKg: 2500.5 }, /INVALID_PRICE/],
      [{ ...lot, askPaisePerKg: Number.MAX_SAFE_INTEGER }, /INVALID_PRICE/],
      [{ ...lot, note: "x".repeat(141) }, /NOTE_TOO_LONG/],
      [{ ...lot, materialCode: "GOLD" }, /UNKNOWN_MATERIAL/],
      // Glass is real but outside this shop's approved material scope.
      [{ ...lot, materialCode: "GLASS-BOTTLE" }, /MATERIAL_NOT_ELIGIBLE/],
      [{ ...lot, grams: 999_999_000 }, /NOT_ENOUGH_STOCK/],
    ] as const;
    for (const [args, error] of cases) {
      await expect(
        shop.mutation(api.market.createListing, args),
      ).rejects.toThrow(error);
    }
    const id = await shop.mutation(api.market.createListing, {
      ...lot,
      note: "x".repeat(140),
    });
    expect(id).toBeTruthy();
  });

  it("rejects an unsafe stored price without creating a trade", async () => {
    const t = await demoWorld();
    const yard = await signInAs(t, YARD);
    const lot = await lotOf(yard, RAMESH, "PAPER-NEWS");
    await t.run((ctx) =>
      ctx.db.patch("listings", lot.id, {
        askPaisePerKg: Number.MAX_SAFE_INTEGER,
      }),
    );
    const before = await t.run((ctx) => ctx.db.query("trades").collect());
    await expect(
      yard.mutation(api.market.requestTrade, {
        listingId: lot.id,
        grams: 1001,
      }),
    ).rejects.toThrow(/INVALID_PRICE/);
    expect(await t.run((ctx) => ctx.db.query("trades").collect())).toEqual(
      before,
    );
  });

  it("keeps unclassified manufacturer material off the market", async () => {
    const t = await demoWorld();
    const maker = await signInAs(t, MAKER);
    await expect(
      maker.mutation(api.market.createListing, {
        materialCode: "RECYCLED-KRAFT",
        grams: 1000,
        askPaisePerKg: 3800,
      }),
    ).rejects.toThrow(/BYPRODUCT_NOT_ELIGIBLE/);
    expect(await maker.query(api.market.myListings, {})).toEqual([]);
    expect(await maker.query(api.market.sellable, {})).toEqual([]);
    await expect(
      t.mutation(api.market.createListing, {
        materialCode: "PAPER-NEWS",
        grams: 1000,
        askPaisePerKg: 1800,
      }),
    ).rejects.toThrow(/NOT_SIGNED_IN/);
  });

  it("declines all waiting requests when a listing has more than two hundred older closed trades", async () => {
    const t = await demoWorld();
    const yard = await signInAs(t, YARD);
    const shop = await signInAs(t, SHOP);
    const lot = await lotOf(yard, RAMESH, "METAL-IRON");
    const originalId = await yard.mutation(api.market.requestTrade, {
      listingId: lot.id,
      grams: 1000,
    });
    await shop.mutation(api.market.act, {
      tradeId: originalId,
      action: "decline",
    });
    const waitingIds = await t.run(async (ctx) => {
      const original = await ctx.db.get("trades", originalId);
      if (!original) throw new Error("Missing trade");
      const { _id, _creationTime, ...trade } = original;
      for (let index = 0; index < 200; index += 1)
        await ctx.db.insert("trades", trade);
      const ids = [];
      for (let index = 0; index < 201; index += 1)
        ids.push(
          await ctx.db.insert("trades", { ...trade, status: "requested" }),
        );
      return ids;
    });
    await shop.mutation(api.market.withdraw, { listingId: lot.id });
    const statuses = await t.run(async (ctx) =>
      Promise.all(
        waitingIds.map(async (id) => {
          const trade = await ctx.db.get("trades", id);
          return trade?.status;
        }),
      ),
    );
    expect(statuses).toEqual(Array.from({ length: 201 }, () => "declined"));
  });

  it("refuses an oversized waiting queue without partially closing the listing", async () => {
    const t = await demoWorld();
    const yard = await signInAs(t, YARD);
    const shop = await signInAs(t, SHOP);
    const lot = await lotOf(yard, RAMESH, "METAL-IRON");
    const originalId = await yard.mutation(api.market.requestTrade, {
      listingId: lot.id,
      grams: 1000,
    });
    await t.run(async (ctx) => {
      const original = await ctx.db.get("trades", originalId);
      if (!original) throw new Error("Missing trade");
      const { _id, _creationTime, ...trade } = original;
      for (let index = 0; index < 1000; index += 1)
        await ctx.db.insert("trades", trade);
    });
    await expect(
      shop.mutation(api.market.withdraw, { listingId: lot.id }),
    ).rejects.toThrow(/TOO_MANY_TRADE_REQUESTS/);
    const state = await t.run(async (ctx) => ({
      listing: await ctx.db.get("listings", lot.id),
      trade: await ctx.db.get("trades", originalId),
    }));
    expect(state.listing?.status).toBe("open");
    expect(state.trade?.status).toBe("requested");
    expect(await auditActions(t, "listings", lot.id)).toEqual([]);
  });

  it("withdraws only my own open lots, declining waiting requests", async () => {
    const t = await demoWorld();
    const yard = await signInAs(t, YARD);
    const shop = await signInAs(t, SHOP);
    const lot = await lotOf(yard, RAMESH, "METAL-IRON");
    const tradeId = await yard.mutation(api.market.requestTrade, {
      listingId: lot.id,
      grams: 50_000,
    });

    await expect(
      yard.mutation(api.market.withdraw, { listingId: lot.id }),
    ).rejects.toThrow(/NOT_FOUND/);

    await shop.mutation(api.market.withdraw, { listingId: lot.id });
    const declined = await tradeOf(yard, "buying", tradeId);
    expect(declined.status).toBe("declined");
    expect(await lotIds(yard)).not.toContain(lot.id);

    await expect(
      shop.mutation(api.market.withdraw, { listingId: lot.id }),
    ).rejects.toThrow(/LISTING_NOT_OPEN/);
    expect(await auditActions(t, "listings", lot.id)).toEqual([
      "listing.withdrawn",
    ]);
  });
});

describe("manufacturer non-hazardous byproduct offers", () => {
  it.each([
    "hazardous",
    "inactive-material",
    "suspended-buyer",
    "buyer-family-removed",
    "seller-family-removed",
  ] as const)(
    "rejects acceptance after %s while preserving decline and all stock",
    async (change) => {
      const t = await demoWorld();
      const maker = await signInAs(t, MAKER);
      const shop = await signInAs(t, SHOP);
      const ids = await t.run(async (ctx) => {
        const seller = await ctx.db
          .query("orgs")
          .withIndex("by_slug", (q) => q.eq("slug", "deccan-packaging"))
          .unique();
        const buyer = await ctx.db
          .query("orgs")
          .withIndex("by_slug", (q) => q.eq("slug", "ramesh-kabadi-store"))
          .unique();
        const material = await ctx.db
          .query("materials")
          .withIndex("by_code", (q) => q.eq("code", "PLASTIC-PET"))
          .unique();
        if (!seller || !buyer || !material)
          throw new Error("Missing test fixture");
        await ctx.db.patch("materials", material._id, {
          byproductEligibility: {
            hazardStatus: "non_hazardous",
            sourceReference: "Synthetic reviewed test record",
            reviewedAt: Date.now(),
          },
        });
        const inventoryId = await ctx.db.insert("inventory", {
          orgId: seller._id,
          materialCode: material.code,
          grams: 50_000,
          updatedAt: Date.now(),
        });
        return {
          seller: seller._id,
          buyer: buyer._id,
          material: material._id,
          inventory: inventoryId,
        };
      });
      const listingId = await maker.mutation(api.market.createListing, {
        materialCode: "PLASTIC-PET",
        grams: 10_000,
        askPaisePerKg: 2500,
      });
      const tradeId = await shop.mutation(api.market.requestTrade, {
        listingId,
        grams: 1000,
      });
      await t.run(async (ctx) => {
        switch (change) {
          case "hazardous": {
            await ctx.db.patch("materials", ids.material, {
              byproductEligibility: {
                hazardStatus: "hazardous",
                sourceReference: "Synthetic revised test record",
                reviewedAt: Date.now(),
              },
            });
            break;
          }
          case "inactive-material": {
            await ctx.db.patch("materials", ids.material, { active: false });
            break;
          }
          case "suspended-buyer": {
            await ctx.db.patch("orgs", ids.buyer, { status: "suspended" });
            break;
          }
          case "buyer-family-removed": {
            await ctx.db.patch("orgs", ids.buyer, { families: ["paper"] });
            break;
          }
          case "seller-family-removed": {
            await ctx.db.patch("orgs", ids.seller, { families: ["paper"] });
            break;
          }
        }
      });
      const before = await t.run(async (ctx) => ({
        trade: await ctx.db.get("trades", tradeId),
        listing: await ctx.db.get("listings", listingId),
        stock: await ctx.db.get("inventory", ids.inventory),
        audit: await ctx.db.query("auditLog").collect(),
      }));
      await expect(
        maker.mutation(api.market.act, { tradeId, action: "accept" }),
      ).rejects.toThrow("BYPRODUCT_NOT_ELIGIBLE");
      const after = await t.run(async (ctx) => ({
        trade: await ctx.db.get("trades", tradeId),
        listing: await ctx.db.get("listings", listingId),
        stock: await ctx.db.get("inventory", ids.inventory),
        audit: await ctx.db.query("auditLog").collect(),
      }));
      expect(after).toEqual(before);
      await expect(
        maker.mutation(api.market.act, { tradeId, action: "decline" }),
      ).resolves.toMatchObject({ status: "declined" });
      const preservedInventory = await t.run((ctx) =>
        ctx.db.get("inventory", ids.inventory),
      );
      expect(preservedInventory?.grams).toBe(50_000);
    },
  );

  it("requires admin-reviewed classification and a matching active buyer", async () => {
    vi.stubEnv("ADMIN_EMAIL", "admin@luma.test");
    const t = await demoWorld();
    const maker = await signInAs(t, MAKER);
    const shop = await signInAs(t, SHOP);
    const admin = await signIn(t, {
      email: "admin@luma.test",
      twoFactorEnabled: true,
    });
    const { materialId, shopId } = await t.run(async (ctx) => {
      const factory = await ctx.db
        .query("orgs")
        .withIndex("by_slug", (q) => q.eq("slug", "deccan-packaging"))
        .unique();
      const buyer = await ctx.db
        .query("orgs")
        .withIndex("by_slug", (q) => q.eq("slug", "ramesh-kabadi-store"))
        .unique();
      const material = await ctx.db
        .query("materials")
        .withIndex("by_code", (q) => q.eq("code", "PLASTIC-PET"))
        .unique();
      if (!factory || !buyer || !material) throw new Error("Missing fixture");
      await ctx.db.insert("inventory", {
        orgId: factory._id,
        materialCode: material.code,
        grams: 50_000,
        updatedAt: Date.now(),
      });
      return { materialId: material._id, shopId: buyer._id };
    });
    const offer = {
      materialCode: "PLASTIC-PET",
      grams: 10_000,
      askPaisePerKg: 2500,
    };

    await expect(
      maker.mutation(api.market.createListing, offer),
    ).rejects.toThrow(/BYPRODUCT_NOT_ELIGIBLE/);
    await expect(
      maker.mutation(api.byproductClassification.reviewMaterial, {
        materialCode: "PLASTIC-PET",
        hazardStatus: "non_hazardous",
        sourceReference: "LAB-TEST-1",
      }),
    ).rejects.toThrow(/NOT_ADMIN/);
    await admin.mutation(api.byproductClassification.reviewMaterial, {
      materialCode: "PLASTIC-PET",
      hazardStatus: "non_hazardous",
      sourceReference: "LAB-TEST-1",
    });
    const reviewed = await t.run((ctx) => ctx.db.get("materials", materialId));
    expect(reviewed?.byproductEligibility).toMatchObject({
      hazardStatus: "non_hazardous",
      sourceReference: "LAB-TEST-1",
    });

    await t.run((ctx) => ctx.db.patch("orgs", shopId, { city: "Mysuru" }));
    const listingId = await maker.mutation(api.market.createListing, offer);
    const visible = await shop.query(api.market.browse, {
      materialCode: "PLASTIC-PET",
    });
    expect(visible).toContainEqual(
      expect.objectContaining({
        id: listingId,
        origin: "manufacturer_byproduct",
      }),
    );
    const makerLots = await maker.query(api.market.browse, {
      materialCode: "PLASTIC-PET",
    });
    expect(makerLots.some((listing) => listing.id === listingId)).toBe(false);

    await t.run((ctx) => ctx.db.patch("orgs", shopId, { families: ["paper"] }));
    const wrongFamilyLots = await shop.query(api.market.browse, {
      materialCode: "PLASTIC-PET",
    });
    expect(wrongFamilyLots.some((listing) => listing.id === listingId)).toBe(
      false,
    );
    await expect(
      shop.mutation(api.market.requestTrade, { listingId, grams: 1000 }),
    ).rejects.toThrow(/BYPRODUCT_NOT_ELIGIBLE/);
    await t.run((ctx) =>
      ctx.db.patch("orgs", shopId, { families: ["paper", "plastic"] }),
    );
    const tradeId = await shop.mutation(api.market.requestTrade, {
      listingId,
      grams: 1000,
    });
    const requested = await tradeOf(shop, "buying", tradeId);
    expect(requested.status).toBe("requested");

    await admin.mutation(api.byproductClassification.reviewMaterial, {
      materialCode: "PLASTIC-PET",
      hazardStatus: "hazardous",
      sourceReference: "LAB-TEST-2",
    });
    const revokedLots = await shop.query(api.market.browse, {
      materialCode: "PLASTIC-PET",
    });
    expect(revokedLots.some((listing) => listing.id === listingId)).toBe(false);
    await expect(
      shop.mutation(api.market.requestTrade, { listingId, grams: 1000 }),
    ).rejects.toThrow(/BYPRODUCT_NOT_ELIGIBLE/);
  });

  it("refuses missing review evidence, product grades, and inactive buyers", async () => {
    vi.stubEnv("ADMIN_EMAIL", "admin@luma.test");
    const t = await demoWorld();
    const admin = await signIn(t, {
      email: "admin@luma.test",
      twoFactorEnabled: true,
    });
    await expect(
      admin.mutation(api.byproductClassification.reviewMaterial, {
        materialCode: "PLASTIC-PET",
        hazardStatus: "non_hazardous",
        sourceReference: " ",
      }),
    ).rejects.toThrow(/INVALID_CLASSIFICATION_SOURCE/);
    await expect(
      admin.mutation(api.byproductClassification.reviewMaterial, {
        materialCode: "RECYCLED-PET-FLAKE",
        hazardStatus: "non_hazardous",
        sourceReference: "LAB-TEST-1",
      }),
    ).rejects.toThrow(/MATERIAL_NOT_ELIGIBLE/);
    const shop = await signInAs(t, SHOP);
    await t.run(async (ctx) => {
      const buyer = await ctx.db
        .query("orgs")
        .withIndex("by_slug", (q) => q.eq("slug", "ramesh-kabadi-store"))
        .unique();
      if (!buyer) throw new Error("Missing buyer");
      await ctx.db.patch("orgs", buyer._id, { status: "suspended" });
    });
    // Suspended workspaces retain read access to history but have no eligible market matches.
    expect(await shop.query(api.market.browse, {})).toEqual([]);
  });
});

describe("trades", () => {
  it("shows each side its own trades with the steps open to it", async () => {
    const t = await demoWorld();
    const recycler = await signInAs(t, RECYCLER);
    const { buying, selling } = await recycler.query(api.market.trades, {});
    // Seeded history remains visible, but its payment was never verified.
    const pet = buying.find((trade) => trade.status === "dispatched");
    expect(pet).toMatchObject({
      material: { code: "PLASTIC-PET", family: "plastic" },
      counterparty: { name: PEENYA, kind: "yard" },
      actions: [],
      inEscrow: false,
      paymentVerification: "legacy_unverified",
      needsEwayBill: true,
    });
    // The old status cannot open a new dispatch action.
    expect(
      selling.find((trade) => trade.status === "paid_to_escrow"),
    ).toMatchObject({
      material: { code: "RECYCLED-PET-FLAKE" },
      actions: [],
      paymentVerification: "legacy_unverified",
    });

    const maker = await signInAs(t, MAKER);
    const forMaker = await maker.query(api.market.trades, {});
    expect(forMaker.selling).toEqual([]);
    expect(forMaker.buying.length).toBeGreaterThan(0);

    const saathi = await signInAs(t, SAATHI);
    await expect(saathi.query(api.market.trades, {})).rejects.toThrow(
      /NO_BUSINESS/,
    );
    await expect(t.query(api.market.trades, {})).rejects.toThrow(
      /NOT_SIGNED_IN/,
    );
  });
});

describe("unverified legacy trade record", () => {
  it("preserves the old reference without calling it a paid invoice", async () => {
    const t = await demoWorld();
    const yard = await signInAs(t, YARD);
    const { buying } = await yard.query(api.market.trades, {});
    const completed = buying.find((trade) => trade.status === "completed");
    const tradeId = completed?.id as Id<"trades">;

    const receipt = await yard.query(api.market.receipt, { tradeId });
    expect(receipt).toMatchObject({
      number: null,
      legacyReceiptNo: completed?.legacyReceiptNo,
      paymentVerification: "legacy_unverified",
      side: "buyer",
      status: "completed",
      seller: { name: RAMESH, kind: "kabadiwala" },
      buyer: { name: PEENYA, kind: "yard", gstin: "29ABCPE1234F1Z5" },
      line: {
        material: { code: "PAPER-NEWS" },
        grams: 400_000,
        paise: completed?.totalPaise,
      },
      totalPaise: completed?.totalPaise,
      inEscrow: false,
    });
    expect(receipt?.issuedAt).toBeNull();
    expect(receipt?.releasedAt).toBeNull();
    expect(receipt?.seller.address).toContain("Yeshwanthpur");

    const shop = await signInAs(t, SHOP);
    expect(await shop.query(api.market.receipt, { tradeId })).toMatchObject({
      side: "seller",
      number: null,
      legacyReceiptNo: completed?.legacyReceiptNo,
    });

    const maker = await signInAs(t, MAKER);
    expect(await maker.query(api.market.receipt, { tradeId })).toBeNull();
    expect(
      await yard.query(api.market.receipt, { tradeId: "not-an-id" }),
    ).toBeNull();
    await expect(t.query(api.market.receipt, { tradeId })).rejects.toThrow(
      /NOT_SIGNED_IN/,
    );
  });

  it("has no issued number while a trade awaits the gateway", async () => {
    const t = await demoWorld();
    const yard = await signInAs(t, YARD);
    const { buying } = await yard.query(api.market.trades, {});
    const requested = buying.find((trade) => trade.status === "requested");
    const receipt = await yard.query(api.market.receipt, {
      tradeId: requested?.id as Id<"trades">,
    });
    expect(receipt).toMatchObject({
      number: null,
      issuedAt: null,
      paymentVerification: "not_applicable",
    });
  });
});

describe("complete stock reservations", () => {
  it("counts an older open lot even after 1,000 newer lots were withdrawn", async () => {
    const t = await demoWorld();
    const shop = await signInAs(t, SHOP);
    const before = await shop.query(api.market.sellable, {});
    await t.run(async (ctx) => {
      const existing = await ctx.db.query("listings").first();
      if (!existing) throw new Error("Missing seeded listing");
      const { _id, _creationTime, ...listing } = existing;
      for (let index = 0; index < 1000; index += 1) {
        await ctx.db.insert("listings", { ...listing, status: "withdrawn" });
      }
    });
    expect(await shop.query(api.market.sellable, {})).toEqual(before);
    const paper = before.find((row) => row.material.code === "PAPER-NEWS");
    if (!paper) throw new Error("Missing paper stock");
    await expect(
      shop.mutation(api.market.createListing, {
        materialCode: "PAPER-NEWS",
        grams: paper.availableGrams + 1,
        askPaisePerKg: 100,
      }),
    ).rejects.toThrow(/NOT_ENOUGH_STOCK/);
  });

  it("counts older accepted sales after 1,000 newer declined requests", async () => {
    const t = await demoWorld();
    const shop = await signInAs(t, SHOP);
    const yard = await signInAs(t, YARD);
    const listing = await lotOf(yard, RAMESH, "PAPER-NEWS");
    const tradeId = await yard.mutation(api.market.requestTrade, {
      listingId: listing.id,
      grams: 1000,
    });
    await shop.mutation(api.market.act, { tradeId, action: "accept" });
    const before = await shop.query(api.market.sellable, {});
    await t.run(async (ctx) => {
      const existing = await ctx.db.get("trades", tradeId);
      if (!existing) throw new Error("Missing trade");
      const { _id, _creationTime, ...trade } = existing;
      for (let index = 0; index < 1000; index += 1) {
        await ctx.db.insert("trades", { ...trade, status: "declined" });
      }
    });
    expect(await shop.query(api.market.sellable, {})).toEqual(before);
  });

  it("refuses to list stock when active reservations exceed the safety bound", async () => {
    const t = await demoWorld();
    const shop = await signInAs(t, SHOP);
    await t.run(async (ctx) => {
      const existing = await ctx.db.query("listings").first();
      if (!existing) throw new Error("Missing seeded listing");
      const { _id, _creationTime, ...listing } = existing;
      for (let index = 0; index < 1001; index += 1) {
        await ctx.db.insert("listings", {
          ...listing,
          grams: 1,
          status: "open",
        });
      }
    });
    await expect(
      shop.mutation(api.market.createListing, {
        materialCode: "PAPER-NEWS",
        grams: 1,
        askPaisePerKg: 100,
      }),
    ).rejects.toThrow(/TOO_MANY_RESERVATIONS/);
  });
});

describe("gateway guard before inventory changes", () => {
  it.each([Number.MAX_SAFE_INTEGER, Number.MAX_SAFE_INTEGER + 1, -1, 0.5])(
    "blocks a legacy confirmation without changing trade, stock or audit (stock %s)",
    async (grams) => {
      const t = await demoWorld();
      const recycler = await signInAs(t, RECYCLER);
      const { buying } = await recycler.query(api.market.trades, {});
      const delivery = buying.find((trade) => trade.status === "dispatched");
      if (!delivery) throw new Error("Missing dispatched trade");
      await setStock(t, "greenloop-polymers", delivery.material.code, grams);
      const snapshot = () =>
        t.run(async (ctx) => ({
          trade: await ctx.db.get("trades", delivery.id),
          inventory: await ctx.db.query("inventory").collect(),
          audit: await ctx.db.query("auditLog").collect(),
        }));
      const before = await snapshot();
      await expect(
        recycler.mutation(api.market.act, {
          tradeId: delivery.id,
          action: "confirm",
        }),
      ).rejects.toThrow(/GATEWAY_REQUIRED/);
      expect(await snapshot()).toEqual(before);
    },
  );
});

describe("legacy trade mass stays unchanged without gateway verification", () => {
  it.each([
    ["confirm", Number.MAX_SAFE_INTEGER + 1],
    ["confirm", 0.5],
    ["confirm", -1],
    ["confirm", 0],
    ["dispatch", Number.MAX_SAFE_INTEGER + 1],
    ["dispatch", 0.5],
    ["dispatch", -1],
    ["dispatch", 0],
  ] as const)(
    "blocks %s for invalid stored grams %s atomically",
    async (action, grams) => {
      const t = await demoWorld();
      const recycler = await signInAs(t, RECYCLER);
      const { buying, selling } = await recycler.query(api.market.trades, {});
      const trade =
        action === "confirm"
          ? buying.find((row) => row.status === "dispatched")
          : selling.find((row) => row.status === "paid_to_escrow");
      if (!trade) throw new Error("Missing pending trade");
      await t.run((ctx) => ctx.db.patch("trades", trade.id, { grams }));
      const snapshot = () =>
        t.run(async (ctx) => ({
          trade: await ctx.db.get("trades", trade.id),
          inventory: await ctx.db.query("inventory").collect(),
          audit: await ctx.db.query("auditLog").collect(),
        }));
      const before = await snapshot();
      await expect(
        recycler.mutation(api.market.act, { tradeId: trade.id, action }),
      ).rejects.toThrow(/GATEWAY_REQUIRED/);
      expect(await snapshot()).toEqual(before);
    },
  );

  it("does not receive stock even at a safe-integer boundary", async () => {
    const t = await demoWorld();
    const recycler = await signInAs(t, RECYCLER);
    const { buying } = await recycler.query(api.market.trades, {});
    const delivery = buying.find((trade) => trade.status === "dispatched");
    if (!delivery) throw new Error("Missing dispatched trade");
    await setStock(
      t,
      "greenloop-polymers",
      delivery.material.code,
      Number.MAX_SAFE_INTEGER - delivery.grams,
    );
    await expect(
      recycler.mutation(api.market.act, {
        tradeId: delivery.id,
        action: "confirm",
      }),
    ).rejects.toThrow(/GATEWAY_REQUIRED/);
    expect(await stockOf(t, "greenloop-polymers", delivery.material.code)).toBe(
      Number.MAX_SAFE_INTEGER - delivery.grams,
    );
    const pending = await tradeOf(recycler, "buying", delivery.id);
    expect(pending.status).toBe("dispatched");
    expect(await auditActions(t, "trades", delivery.id)).not.toContain(
      "trade.completed",
    );
  });
});

describe("market evidence classification", () => {
  it.each([
    {},
    {
      streamClass: "recoverable_waste" as const,
      handlingClass: "unassessed" as const,
    },
    {
      streamClass: "unspecified" as const,
      handlingClass: "non_hazardous" as const,
    },
  ])(
    "does not offer unknown evidence classifications %j",
    async (classification) => {
      const t = await demoWorld();
      const shop = await signInAs(t, SHOP);
      const lotId = await shop.mutation(api.traceability.declareLot, {
        materialCode: "PLASTIC-PET",
        state: "Declared input",
        grams: 1000,
        ...classification,
      });
      const before = await stockOf(t, "ramesh-kabadi-store", "PLASTIC-PET");
      const choices = await shop.query(api.market.listingLotOptions, {
        materialCode: "PLASTIC-PET",
      });
      expect(choices.map((row) => row.id)).not.toContain(lotId);
      await expect(
        shop.mutation(api.market.createListing, {
          materialCode: "PLASTIC-PET",
          grams: 1000,
          askPaisePerKg: 2500,
          specification: { grade: "PET", specification: "Q1", lotId },
        }),
      ).rejects.toThrow("LOT_NOT_ELIGIBLE");
      expect(await stockOf(t, "ramesh-kabadi-store", "PLASTIC-PET")).toBe(
        before,
      );
      const listings = await shop.query(api.market.myListings, {});
      expect(listings.some((row) => row.specification?.lotId === lotId)).toBe(
        false,
      );
    },
  );
  it.each([
    {
      streamClass: "recoverable_waste" as const,
      handlingClass: "unassessed" as const,
    },
    {
      streamClass: "unspecified" as const,
      handlingClass: "non_hazardous" as const,
    },
  ])(
    "rechecks linked classifications at request and acceptance %j",
    async (classification) => {
      const t = await demoWorld();
      const shop = await signInAs(t, SHOP);
      const yard = await signInAs(t, YARD);
      const lotId = await shop.mutation(api.traceability.declareLot, {
        materialCode: "PLASTIC-PET",
        state: "Measured",
        grams: 2000,
        streamClass: "recoverable_waste",
        handlingClass: "non_hazardous",
      });
      const listingId = await shop.mutation(api.market.createListing, {
        materialCode: "PLASTIC-PET",
        grams: 2000,
        askPaisePerKg: 2500,
        specification: { grade: "PET", specification: "Q1", lotId },
      });
      const tradeId = await yard.mutation(api.market.requestTrade, {
        listingId,
        grams: 1000,
      });
      const before = await stockOf(t, "ramesh-kabadi-store", "PLASTIC-PET");
      await t.run((ctx) => ctx.db.patch("materialLots", lotId, classification));
      await expect(
        yard.mutation(api.market.requestTrade, { listingId, grams: 1000 }),
      ).rejects.toThrow("LOT_NOT_ELIGIBLE");
      await expect(
        shop.mutation(api.market.act, { tradeId, action: "accept" }),
      ).rejects.toThrow("LOT_NOT_ELIGIBLE");
      const listing = await t.run((ctx) => ctx.db.get("listings", listingId));
      expect(listing).toMatchObject({ status: "open", grams: 2000 });
      const trade = await tradeOf(yard, "buying", tradeId);
      expect(trade.status).toBe("requested");
      expect(await stockOf(t, "ramesh-kabadi-store", "PLASTIC-PET")).toBe(
        before,
      );
      await shop.mutation(api.market.act, { tradeId, action: "decline" });
    },
  );
});

it("expires new requests and pending acceptance without repricing accepted orders", async () => {
  const t = await demoWorld();
  const shop = await signInAs(t, SHOP);
  const yard = await signInAs(t, YARD);
  const listing = await lotOf(yard, RAMESH, "PAPER-NEWS");
  const accepted = await yard.mutation(api.market.requestTrade, {
    listingId: listing.id,
    grams: 1000,
  });
  const pending = await yard.mutation(api.market.requestTrade, {
    listingId: listing.id,
    grams: 1000,
  });
  await shop.mutation(api.market.act, { tradeId: accepted, action: "accept" });
  const before = await tradeOf(yard, "buying", accepted);
  await t.run((ctx) =>
    ctx.db.patch("listings", listing.id, {
      expiresAt: Date.now() - 1,
      askPaisePerKg: listing.askPaisePerKg + 100,
    }),
  );
  await expect(
    yard.mutation(api.market.requestTrade, {
      listingId: listing.id,
      grams: 1000,
    }),
  ).rejects.toThrow(/LISTING_EXPIRED/);
  await expect(
    shop.mutation(api.market.act, { tradeId: pending, action: "accept" }),
  ).rejects.toThrow(/LISTING_EXPIRED/);
  const after = await tradeOf(yard, "buying", accepted);
  expect(after).toMatchObject({
    status: "accepted",
    paisePerKg: before.paisePerKg,
    totalPaise: before.totalPaise,
  });
  const requests = await shop.query(api.market.trades, {});
  expect(
    requests.selling.find((row) => row.id === pending)?.actions,
  ).not.toContain("accept");
  const currentOffers = await yard.query(api.market.browse, {});
  expect(currentOffers.some((row) => row.id === listing.id)).toBe(false);
});

it("bounds explicit contract validity and releases only expired unsold reservations", async () => {
  const t = await demoWorld();
  const shop = await signInAs(t, SHOP);
  const freeStock = await shop.query(api.market.sellable, {});
  const available = freeStock.find((row) => row.material.code === "PAPER-NEWS");
  if (!available) throw new Error("Missing stock");
  const args = {
    materialCode: "PAPER-NEWS",
    grams: available.availableGrams,
    askPaisePerKg: 100,
  };
  for (const contractValidUntil of [
    Date.now() - 1,
    Date.now() + 91 * 86_400_000,
    0.5,
  ])
    await expect(
      shop.mutation(api.market.createListing, { ...args, contractValidUntil }),
    ).rejects.toThrow(/INVALID_OFFER_VALIDITY/);
  const listingId = await shop.mutation(api.market.createListing, args);
  const listing = await t.run((ctx) => ctx.db.get("listings", listingId));
  expect(listing?.expiresAt).toBe((listing?.createdAt ?? 0) + 86_400_000);
  await expect(shop.mutation(api.market.createListing, args)).rejects.toThrow(
    /NOT_ENOUGH_STOCK/,
  );
  await t.run((ctx) =>
    ctx.db.patch("listings", listingId, { expiresAt: Date.now() - 1 }),
  );
  const replacement = await shop.mutation(api.market.createListing, {
    ...args,
    contractValidUntil: Date.now() + 7 * 86_400_000,
  });
  expect(replacement).not.toBe(listingId);
  expect(await t.run((ctx) => ctx.db.get("listings", listingId))).toMatchObject(
    { status: "open", grams: args.grams },
  );
});

it("ranks compatible offers on declared delivered cost and freezes separate freight context", async () => {
  const t = await demoWorld(),
    shop = await signInAs(t, SHOP),
    yard = await signInAs(t, YARD);
  const now = Date.now(),
    first = await shop.mutation(api.market.createListing, {
      materialCode: "PAPER-NEWS",
      specification: { grade: "TEST-GRADE", specification: "TEST-SPEC" },
      grams: 1000,
      askPaisePerKg: 100,
      freightPaisePerKg: 10,
      deliveryAvailableAt: now + 3_600_000,
    }),
    second = await shop.mutation(api.market.createListing, {
      materialCode: "PAPER-NEWS",
      specification: { grade: "TEST-GRADE", specification: "TEST-SPEC" },
      grams: 1000,
      askPaisePerKg: 95,
      freightPaisePerKg: 20,
    });
  const offers = await yard.query(api.market.browse, {
    materialCode: "PAPER-NEWS",
  });
  expect(offers.slice(0, 2).map((row) => row.id)).toEqual([first, second]);
  const tradeId = await yard.mutation(api.market.requestTrade, {
    listingId: first,
    grams: 1000,
  });
  await shop.mutation(api.market.act, { tradeId, action: "accept" });
  const order = await tradeOf(yard, "buying", tradeId);
  expect(order).toMatchObject({
    paisePerKg: 100,
    totalPaise: 100,
    freightPaisePerKg: 10,
    deliveryAvailableAt: now + 3_600_000,
  });
  for (const freightPaisePerKg of [-1, 0.5, Number.MAX_SAFE_INTEGER])
    await expect(
      shop.mutation(api.market.createListing, {
        materialCode: "PAPER-NEWS",
        specification: { grade: "TEST-GRADE", specification: "TEST-SPEC" },
        grams: 1,
        askPaisePerKg: 100,
        freightPaisePerKg,
      }),
    ).rejects.toThrow(/INVALID_PRICE/);
});

it("rechecks backing stock so concurrent acceptances cannot promise the same remaining grams", async () => {
  const t = await demoWorld(),
    shop = await signInAs(t, SHOP),
    yard = await signInAs(t, YARD);
  await t.run(async (ctx) => {
    const profile = await ctx.db
      .query("profiles")
      .withIndex("by_phone", (q) => q.eq("phone", SHOP))
      .unique();
    if (!profile) throw new Error("Missing profile");
    const member = await ctx.db
      .query("memberships")
      .withIndex("by_profile", (q) => q.eq("profileId", profile._id))
      .first();
    if (!member) throw new Error("Missing member");
    const listings = await ctx.db
      .query("listings")
      .withIndex("by_org", (q) => q.eq("orgId", member.orgId))
      .collect();
    for (const row of listings)
      await ctx.db.patch("listings", row._id, { status: "withdrawn" });
  });
  await setStock(t, "ramesh-kabadi-store", "PAPER-NEWS", 2000);
  const listingId = await shop.mutation(api.market.createListing, {
    materialCode: "PAPER-NEWS",
    grams: 2000,
    askPaisePerKg: 100,
  });
  const a = await yard.mutation(api.market.requestTrade, {
      listingId,
      grams: 1000,
    }),
    b = await yard.mutation(api.market.requestTrade, {
      listingId,
      grams: 1000,
    });
  await setStock(t, "ramesh-kabadi-store", "PAPER-NEWS", 1000);
  await expect(
    yard.mutation(api.market.requestTrade, { listingId, grams: 2000 }),
  ).rejects.toThrow(/NOT_ENOUGH_STOCK/);
  const results = await Promise.allSettled([
    shop.mutation(api.market.act, { tradeId: a, action: "accept" }),
    shop.mutation(api.market.act, { tradeId: b, action: "accept" }),
  ]);
  expect(results.filter((row) => row.status === "fulfilled")).toHaveLength(1);
  const trades = await shop.query(api.market.trades, {});
  expect(
    trades.selling.filter(
      (row) => [a, b].includes(row.id) && row.status === "accepted",
    ),
  ).toHaveLength(1);
});

it("discovers and requests ordinary eligible stock across cities with unchanged guards", async () => {
  const t = await demoWorld();
  const yard = await signInAs(t, YARD);
  const listingId = await t.run(async (ctx) => {
    const rows = await ctx.db.query("listings").collect();
    const row = rows.find(
      (x) =>
        x.status === "open" &&
        x.sellerKind === "kabadiwala" &&
        x.materialCode === "PAPER-NEWS",
    );
    if (!row) throw new Error("Missing ordinary offer");
    await ctx.db.patch("orgs", row.orgId, { city: "Mumbai, Maharashtra" });
    await ctx.db.patch("listings", row._id, { city: "Mumbai, Maharashtra" });
    return row._id;
  });
  const found = await yard.query(api.market.browse, {});
  expect(found.map((x) => x.id)).toContain(listingId);
  const tradeId = await yard.mutation(api.market.requestTrade, {
    listingId,
    grams: 1000,
  });
  expect(await t.run((ctx) => ctx.db.get("trades", tradeId))).toMatchObject({
    grams: 1000,
    status: "requested",
  });
  await t.run(async (ctx) => {
    const row = await ctx.db.get("listings", listingId);
    if (!row) throw new Error("Missing offer");
    await ctx.db.patch("orgs", row.orgId, { status: "suspended" });
  });
  const afterSuspension = await yard.query(api.market.browse, {});
  expect(afterSuspension.map((x) => x.id)).not.toContain(listingId);
  await expect(
    yard.mutation(api.market.requestTrade, { listingId, grams: 1000 }),
  ).rejects.toThrow("NOT_FOUND");
});
