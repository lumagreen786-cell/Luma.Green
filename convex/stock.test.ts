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
import { paiseFor } from "./lib/chain";
import schema from "./schema";

const modules = convexModules(import.meta.glob("./**/*.*s"));

async function demoWorld() {
  vi.stubEnv("AUTH_DEV_MODE", "true");
  const t = convexTest(schema, modules);
  registerAuth(t);
  await seedDemo(t);
  return t;
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("stock.mine", () => {
  it("separates recorded stock cost from the shop's current offer value", async () => {
    const t = await demoWorld();
    const shop = await signInAs(t, "+919000000101");

    const stock = await shop.query(api.stock.mine, {});

    expect(stock.kind).toBe("kabadiwala");
    expect(stock.buyerKind).toBe("yard");
    expect(
      Object.fromEntries(
        stock.rows.map((row) => [row.material.code, row.grams]),
      ),
    ).toEqual({
      "PAPER-NEWS": 180_000,
      "PAPER-CARTON": 300_000,
      "PLASTIC-PET": 42_000,
      "METAL-IRON": 260_000,
      "METAL-ALU-CAN": 12_000,
    });
    const offers = await t.run(async (ctx) => {
      const org = await ctx.db
        .query("orgs")
        .withIndex("by_slug", (q) => q.eq("slug", "ramesh-kabadi-store"))
        .unique();
      if (!org) throw new Error("Missing shop");
      return ctx.db
        .query("rateCards")
        .withIndex("by_org_material", (q) => q.eq("orgId", org._id))
        .collect();
    });
    const prices = new Map(
      offers.map((offer) => [offer.materialCode, offer.paisePerKg]),
    );
    expect(stock.totalCostPaise).toBeNull();
    for (const row of stock.rows) {
      expect(row.marketPaise).toBe(prices.get(row.material.code));
      expect(row.valuePaise).toBe(
        paiseFor(row.grams, prices.get(row.material.code) ?? 0),
      );
    }
    expect(stock.totalGrams).toBe(794_000);
    expect(stock.totalValuePaise).toBe(
      stock.rows.reduce((sum, row) => sum + (row.valuePaise ?? 0), 0),
    );
    // Most valuable first.
    const values = stock.rows.map((row) => row.valuePaise ?? 0);
    expect(values).toEqual(values.toSorted((a, b) => b - a));
  });

  it.each(["one", "all"])(
    "does not report a complete offer value when %s own offers are missing",
    async (scope) => {
      const t = await demoWorld();
      const shop = await signInAs(t, "+919000000101");
      await t.run(async (ctx) => {
        const org = await ctx.db
          .query("orgs")
          .withIndex("by_slug", (q) => q.eq("slug", "ramesh-kabadi-store"))
          .unique();
        if (!org) throw new Error("Missing shop");
        const prices = await ctx.db
          .query("rateCards")
          .withIndex("by_org_material", (q) => q.eq("orgId", org._id))
          .collect();
        for (const price of prices) {
          if (scope === "all" || price.materialCode === "PAPER-NEWS")
            await ctx.db.delete("rateCards", price._id);
        }
      });
      const stock = await shop.query(api.stock.mine, {});
      expect(stock.totalGrams).toBe(794_000);
      expect(stock.totalValuePaise).toBeNull();
      expect(
        stock.rows.find((row) => row.material.code === "PAPER-NEWS")
          ?.valuePaise,
      ).toBeNull();
      if (scope === "one")
        expect(stock.rows.some((row) => row.valuePaise !== null)).toBe(true);
    },
  );

  it("reports an actual zero value for empty stock", async () => {
    const t = await demoWorld();
    const shop = await signInAs(t, "+919000000101");
    await t.run(async (ctx) => {
      const inventory = await ctx.db.query("inventory").collect();
      for (const item of inventory)
        await ctx.db.patch("inventory", item._id, { grams: 0 });
    });
    const stock = await shop.query(api.stock.mine, {});
    expect(stock.rows).toEqual([]);
    expect(stock.totalValuePaise).toBe(0);
  });

  it("works for every kind of business, each seeing only its own", async () => {
    const t = await demoWorld();

    const farida = await signInAs(t, "+919000000102");
    const yard = await farida.query(api.stock.mine, {});
    expect(yard.buyerKind).toBe("recycler");
    expect(yard.totalGrams).toBe(13_400_000);

    const suresh = await signInAs(t, "+919000000103");
    const recycler = await suresh.query(api.stock.mine, {});
    expect(recycler.buyerKind).toBe("manufacturer");
    expect(new Set(recycler.rows.map((row) => row.stage))).toEqual(
      new Set(["scrap", "recycled"]),
    );

    const anita = await signInAs(t, "+919000000104");
    const factory = await anita.query(api.stock.mine, {});
    expect(factory.kind).toBe("manufacturer");
    expect(factory.buyerKind).toBeNull();
    const codes = factory.rows.map((row) => row.material.code);
    expect(codes.toSorted((a, b) => a.localeCompare(b))).toEqual([
      "RECYCLED-KRAFT",
      "RECYCLED-PET-FLAKE",
    ]);
  });

  it("leaves out what has run out", async () => {
    const t = await demoWorld();
    const shop = await signInAs(t, "+919000000101");
    await t.run(async (ctx) => {
      const rows = await ctx.db.query("inventory").collect();
      const cans = rows.find((row) => row.materialCode === "METAL-ALU-CAN");
      if (cans) await ctx.db.patch("inventory", cans._id, { grams: 0 });
    });

    const stock = await shop.query(api.stock.mine, {});

    expect(stock.rows.map((row) => row.material.code)).not.toContain(
      "METAL-ALU-CAN",
    );
    expect(stock.totalGrams).toBe(782_000);
  });

  it("refuses people without a business", async () => {
    const t = await demoWorld();
    await expect(t.query(api.stock.mine, {})).rejects.toThrow(/NOT_SIGNED_IN/);
    for (const phone of ["+919000000105", "+919000000107", "+919000000109"]) {
      const person = await signInAs(t, phone);
      await expect(person.query(api.stock.mine, {})).rejects.toThrow(
        /NO_BUSINESS/,
      );
    }
  });
});
