/// <reference types="vite/client" />
// @vitest-environment edge-runtime
import { convexTest } from "convex-test";
import { afterEach, describe, expect, it, vi } from "vitest";

import { api } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import {
  convexModules,
  registerAuth,
  seedDemo,
  signInAs,
} from "./lib/auth.testing";
import { paiseFor, pointsFor } from "./lib/chain";
import schema from "./schema";

const modules = convexModules(import.meta.glob("./**/*.*s"));

const RAMESH = "+919000000101"; // Ramesh Kabadi Store, the demo kabadiwala
const FARIDA = "+919000000102"; // Peenya Paper & Plastic Yard
const LAKSHMI = "+919000000105"; // a Saathi, no business

async function demoWorld() {
  vi.stubEnv("AUTH_DEV_MODE", "true");
  const t = convexTest(schema, modules);
  registerAuth(t);
  await seedDemo(t);
  await t.run(async (ctx) => {
    const references = await ctx.db.query("marketPrices").collect();
    for (const reference of references)
      await ctx.db.patch("marketPrices", reference._id, {
        sourceLabel: "Synthetic test reference",
        observedAt: Date.now(),
      });
    const org = await ctx.db
      .query("orgs")
      .withIndex("by_slug", (q) => q.eq("slug", "ramesh-kabadi-store"))
      .unique();
    if (!org) throw new Error("Missing shop");
    await ctx.db.insert("rateCards", {
      orgId: org._id,
      materialCode: "GLASS-BOTTLE",
      paisePerKg: 200,
      updatedAt: Date.now(),
    });
  });
  return t;
}

type Test = Awaited<ReturnType<typeof demoWorld>>;
type Person = Awaited<ReturnType<typeof signInAs>>;

afterEach(() => {
  vi.unstubAllEnvs();
});

/** A seeded pickup at Ramesh's shop, by the household's name and status. */
async function bookingOf(
  t: Test,
  name: string,
  status: Doc<"bookings">["status"],
): Promise<Id<"bookings">> {
  const id = await t.run(async (ctx) => {
    const rows = await ctx.db.query("bookings").collect();
    return rows.find((row) => row.name === name && row.status === status)?._id;
  });
  if (!id) throw new Error(`No ${status} booking for ${name}`);
  return id;
}

/** A booking at another shop (or Ramesh's, with overrides). */
async function addBooking(
  t: Test,
  slug: string,
  overrides: Partial<Doc<"bookings">> = {},
): Promise<Id<"bookings">> {
  return t.run(async (ctx) => {
    const org = await ctx.db
      .query("orgs")
      .withIndex("by_slug", (q) => q.eq("slug", slug))
      .unique();
    if (!org) throw new Error(`No org ${slug}`);
    const now = Date.now();
    return ctx.db.insert("bookings", {
      token: `test${slug.slice(0, 6)}`,
      phone: "+919845000077",
      name: "Sunita Rao",
      mode: "pickup",
      items: [{ materialCode: "PAPER-NEWS", estKg: 10 }],
      estimatePaise: 14_000,
      orgId: org._id,
      slotDate: "2026-10-01",
      slotWindow: "morning",
      address: "7, 1st Main, Rajajinagar, Bengaluru",
      status: "accepted",
      timeline: [
        { status: "requested", at: now },
        { status: "accepted", at: now },
      ],
      createdAt: now,
      updatedAt: now,
      ...overrides,
    });
  });
}

/** One row of the shop's rate card, by material code. */
async function priceRow(shop: Person, code: string) {
  const card = await shop.query(api.shop.rateCard, {});
  return card.rows.find((row) => row.material.code === code);
}

async function auditActions(t: Test, entityId: string) {
  return t.run(async (ctx) => {
    const rows = await ctx.db
      .query("auditLog")
      .withIndex("by_entity", (q) =>
        q.eq("entityTable", "bookings").eq("entityId", entityId),
      )
      .collect();
    return rows.map((row) => row.action);
  });
}

describe("shop.requests", () => {
  it("groups the shop's bookings: new, under way and done", async () => {
    const t = await demoWorld();
    const shop = await signInAs(t, RAMESH);

    const groups = await shop.query(api.shop.requests, {});

    // Soonest slot first; a trip already under way on top.
    expect(groups.new.map((booking) => booking.name)).toEqual([
      "Priya",
      "Arjun",
    ]);
    expect(
      groups.active.map((booking) => [booking.name, booking.status]),
    ).toEqual([
      ["Rahul Gowda", "on_the_way"],
      ["Meena Iyer", "accepted"],
    ]);
    // Newest first.
    expect(groups.done.map((booking) => booking.name)).toEqual([
      "Vikram Shetty",
      "Fatima Khan",
      "Priya Sharma",
    ]);
    expect(groups.done[0]?.receipt?.totalPaise).toBeGreaterThan(0);
  });

  it("shows only the area and a masked number until the shop accepts", async () => {
    const t = await demoWorld();
    const shop = await signInAs(t, RAMESH);
    const priya = await bookingOf(t, "Priya Sharma", "requested");

    const { new: fresh } = await shop.query(api.shop.requests, {});
    expect(fresh.map((booking) => booking.address)).toEqual([
      "Yeshwanthpur",
      "Mathikere",
    ]);
    const before = await shop.query(api.shop.get, { bookingId: priya });
    expect(before?.booking).toMatchObject({
      name: "Priya",
      phone: "+91•••••••109",
      address: "Yeshwanthpur",
      token: "",
      status: "requested",
    });

    await shop.mutation(api.shop.respond, { bookingId: priya, accept: true });

    const after = await shop.query(api.shop.get, { bookingId: priya });
    expect(after?.booking).toMatchObject({
      name: "Priya Sharma",
      phone: "+919000000109",
      address: "Flat 4B, Rose Apartments, Yeshwanthpur, Bengaluru",
      token: "priyademo1",
      status: "accepted",
    });
    expect(after?.timeline.map((step) => step.status)).toEqual([
      "requested",
      "accepted",
    ]);
    expect(await auditActions(t, priya)).toEqual(["booking.accepted"]);
    const { active } = await shop.query(api.shop.requests, {});
    expect(active.map((booking) => booking.id)).toContain(priya);
  });

  it("refuses people who aren't signed in or don't run a shop", async () => {
    const t = await demoWorld();
    await expect(t.query(api.shop.requests, {})).rejects.toThrow(
      /NOT_SIGNED_IN/,
    );
    const yard = await signInAs(t, FARIDA);
    await expect(yard.query(api.shop.requests, {})).rejects.toThrow(
      /WRONG_ROLE/,
    );
    const saathi = await signInAs(t, LAKSHMI);
    await expect(saathi.query(api.shop.requests, {})).rejects.toThrow(
      /NO_BUSINESS/,
    );
  });
});

describe("shop.respond", () => {
  it("declines for good, and never reveals the household", async () => {
    const t = await demoWorld();
    const shop = await signInAs(t, RAMESH);
    const arjun = await bookingOf(t, "Arjun Nair", "requested");

    await shop.mutation(api.shop.respond, { bookingId: arjun, accept: false });

    const declined = await shop.query(api.shop.get, { bookingId: arjun });
    expect(declined?.booking).toMatchObject({
      status: "declined",
      address: "Mathikere",
      phone: "+91•••••••011",
    });
    await expect(
      shop.mutation(api.shop.respond, { bookingId: arjun, accept: true }),
    ).rejects.toThrow(/WRONG_STATUS/);
    expect(await auditActions(t, arjun)).toEqual(["booking.declined"]);
    const { done } = await shop.query(api.shop.requests, {});
    expect(done[0]?.id).toBe(arjun);
  });

  it("only moves new requests", async () => {
    const t = await demoWorld();
    const shop = await signInAs(t, RAMESH);
    const meena = await bookingOf(t, "Meena Iyer", "accepted");
    await expect(
      shop.mutation(api.shop.respond, { bookingId: meena, accept: false }),
    ).rejects.toThrow(/WRONG_STATUS/);
  });
});

describe("shop.startTrip", () => {
  it("tells the household the shop is on the way", async () => {
    const t = await demoWorld();
    const shop = await signInAs(t, RAMESH);
    const meena = await bookingOf(t, "Meena Iyer", "accepted");

    await shop.mutation(api.shop.startTrip, { bookingId: meena });

    const view = await shop.query(api.shop.get, { bookingId: meena });
    expect(view?.booking.status).toBe("on_the_way");
    expect(view?.timeline.at(-1)?.status).toBe("on_the_way");
    await expect(
      shop.mutation(api.shop.startTrip, { bookingId: meena }),
    ).rejects.toThrow(/WRONG_STATUS/);
  });

  it("needs an accepted pickup", async () => {
    const t = await demoWorld();
    const shop = await signInAs(t, RAMESH);
    const priya = await bookingOf(t, "Priya Sharma", "requested");
    await expect(
      shop.mutation(api.shop.startTrip, { bookingId: priya }),
    ).rejects.toThrow(/WRONG_STATUS/);

    const dropoff = await addBooking(t, "ramesh-kabadi-store", {
      mode: "dropoff",
      address: undefined,
    });
    await expect(
      shop.mutation(api.shop.startTrip, { bookingId: dropoff }),
    ).rejects.toThrow(/NOT_A_PICKUP/);
  });
});

describe("shop.complete", () => {
  it("pays at the shop's rates, keeps the receipt and adds the weight to stock", async () => {
    const t = await demoWorld();
    const shop = await signInAs(t, RAMESH);
    const meena = await bookingOf(t, "Meena Iyer", "accepted");
    const card = await shop.query(api.shop.rateCard, {});
    const newsRate = card.rows.find(
      (row) => row.material.code === "PAPER-NEWS",
    )?.myPaise;
    if (!newsRate) throw new Error("Ramesh has no newspaper price");
    const stockBefore = await shop.query(api.stock.mine, {});
    const gramsOf = (
      stock: typeof stockBefore,
      code: string,
    ): number | undefined =>
      stock.rows.find((row) => row.material.code === code)?.grams;

    const result = await shop.mutation(api.shop.complete, {
      bookingId: meena,
      lines: [
        { materialCode: "PAPER-NEWS", grams: 12_000 },
        // Explicit test offer at ₹2/kg.
        { materialCode: "GLASS-BOTTLE", grams: 2500 },
        // A second bundle of the same material is added up.
        { materialCode: "PAPER-NEWS", grams: 7250 },
      ],
      method: "upi",
    });

    const newsPaise = paiseFor(19_250, newsRate);
    const glassPaise = paiseFor(2500, 200);
    const totalPaise = newsPaise + glassPaise;
    expect(result).toEqual({ totalPaise, points: pointsFor(totalPaise) });

    const paid = await shop.query(api.shop.get, { bookingId: meena });
    expect(paid?.booking.status).toBe("completed");
    expect(paid?.points).toBe(pointsFor(totalPaise));
    expect(paid?.booking.receipt).toMatchObject({
      method: "upi",
      totalPaise,
      lines: [
        {
          material: { code: "PAPER-NEWS" },
          grams: 19_250,
          paisePerKg: newsRate,
          paise: newsPaise,
        },
        {
          material: { code: "GLASS-BOTTLE" },
          grams: 2500,
          paisePerKg: 200,
          paise: glassPaise,
        },
      ],
    });

    const stockAfter = await shop.query(api.stock.mine, {});
    expect(gramsOf(stockAfter, "PAPER-NEWS")).toBe(
      (gramsOf(stockBefore, "PAPER-NEWS") ?? 0) + 19_250,
    );
    expect(gramsOf(stockBefore, "GLASS-BOTTLE")).toBeUndefined();
    expect(gramsOf(stockAfter, "GLASS-BOTTLE")).toBe(2500);

    expect(await shop.query(api.shop.payouts, {})).toMatchObject({
      todayPaise: totalPaise,
      todayCount: 1,
    });
    expect(await auditActions(t, meena)).toEqual(["booking.completed"]);
    await expect(
      shop.mutation(api.shop.complete, {
        bookingId: meena,
        lines: [{ materialCode: "PAPER-NEWS", grams: 1000 }],
        method: "cash",
      }),
    ).rejects.toThrow(/WRONG_STATUS/);
  });

  it("uses today's price, and never rewrites a paid receipt", async () => {
    const t = await demoWorld();
    const shop = await signInAs(t, RAMESH);
    const fatima = await bookingOf(t, "Fatima Khan", "completed");
    const receiptOf = (id: Id<"bookings">) =>
      t.run(async (ctx) => {
        const booking = await ctx.db.get("bookings", id);
        return booking?.receipt;
      });
    const oldReceipt = await receiptOf(fatima);
    expect(oldReceipt?.lines[0]?.materialCode).toBe("METAL-IRON");

    await shop.mutation(api.shop.setRate, {
      materialCode: "METAL-IRON",
      paisePerKg: 3100,
    });
    const rahul = await bookingOf(t, "Rahul Gowda", "on_the_way");
    const result = await shop.mutation(api.shop.complete, {
      bookingId: rahul,
      lines: [{ materialCode: "METAL-IRON", grams: 3333 }],
      method: "cash",
    });

    expect(result.totalPaise).toBe(paiseFor(3333, 3100));
    expect(await receiptOf(fatima)).toEqual(oldReceipt);
  });

  it("refuses a weighing that doesn't add up", async () => {
    const t = await demoWorld();
    const shop = await signInAs(t, RAMESH);
    const meena = await bookingOf(t, "Meena Iyer", "accepted");
    const pay = (lines: { materialCode: string; grams: number }[]) =>
      shop.mutation(api.shop.complete, {
        bookingId: meena,
        lines,
        method: "cash",
      });

    await expect(pay([])).rejects.toThrow(/NOTHING_WEIGHED/);
    for (const grams of [0, -500, 1.5, 6_000_000]) {
      await expect(
        pay([{ materialCode: "PAPER-NEWS", grams }]),
      ).rejects.toThrow(/INVALID_WEIGHT/);
    }
    for (const materialCode of ["GOLD", "RECYCLED-PET-FLAKE"]) {
      await expect(pay([{ materialCode, grams: 1000 }])).rejects.toThrow(
        /INVALID_MATERIAL/,
      );
    }
    const view = await shop.query(api.shop.get, { bookingId: meena });
    expect(view?.booking.status).toBe("accepted");

    const priya = await bookingOf(t, "Priya Sharma", "requested");
    await expect(
      shop.mutation(api.shop.complete, {
        bookingId: priya,
        lines: [{ materialCode: "PAPER-NEWS", grams: 1000 }],
        method: "cash",
      }),
    ).rejects.toThrow(/WRONG_STATUS/);
  });
});

describe("another shop's bookings", () => {
  it("stay invisible and untouchable", async () => {
    const t = await demoWorld();
    const theirs = await addBooking(t, "sri-lakshmi-scrap");
    const shop = await signInAs(t, RAMESH);

    expect(await shop.query(api.shop.get, { bookingId: theirs })).toBeNull();
    const groups = await shop.query(api.shop.requests, {});
    expect(
      [...groups.new, ...groups.active, ...groups.done].map((b) => b.id),
    ).not.toContain(theirs);
    await expect(
      shop.mutation(api.shop.respond, { bookingId: theirs, accept: true }),
    ).rejects.toThrow(/NOT_FOUND/);
    await expect(
      shop.mutation(api.shop.startTrip, { bookingId: theirs }),
    ).rejects.toThrow(/NOT_FOUND/);
    await expect(
      shop.mutation(api.shop.complete, {
        bookingId: theirs,
        lines: [{ materialCode: "PAPER-NEWS", grams: 1000 }],
        method: "cash",
      }),
    ).rejects.toThrow(/NOT_FOUND/);
  });

  it("returns nothing for an id that isn't a booking", async () => {
    const t = await demoWorld();
    const shop = await signInAs(t, RAMESH);
    expect(
      await shop.query(api.shop.get, { bookingId: "not-a-real-id" }),
    ).toBeNull();
  });
});

describe("signed out and other roles", () => {
  it("can't read or change a shop", async () => {
    const t = await demoWorld();
    const meena = await bookingOf(t, "Meena Iyer", "accepted");
    const yard = await signInAs(t, FARIDA);
    const callers: [Person, RegExp][] = [
      [t, /NOT_SIGNED_IN/],
      [yard, /WRONG_ROLE/],
    ];
    for (const [who, error] of callers) {
      await expect(who.query(api.shop.rateCard, {})).rejects.toThrow(error);
      await expect(who.query(api.shop.payouts, {})).rejects.toThrow(error);
      await expect(
        who.query(api.shop.get, { bookingId: meena }),
      ).rejects.toThrow(error);
      await expect(
        who.mutation(api.shop.respond, { bookingId: meena, accept: true }),
      ).rejects.toThrow(error);
      await expect(
        who.mutation(api.shop.startTrip, { bookingId: meena }),
      ).rejects.toThrow(error);
      await expect(
        who.mutation(api.shop.complete, {
          bookingId: meena,
          lines: [{ materialCode: "PAPER-NEWS", grams: 1000 }],
          method: "cash",
        }),
      ).rejects.toThrow(error);
      await expect(
        who.mutation(api.shop.setRate, {
          materialCode: "PAPER-NEWS",
          paisePerKg: 1500,
        }),
      ).rejects.toThrow(error);
    }
  });
});

describe("the rate card", () => {
  it("lists every scrap material the shop handles, with floor and market", async () => {
    const t = await demoWorld();
    const shop = await signInAs(t, RAMESH);

    const card = await shop.query(api.shop.rateCard, {});

    const families = new Set(card.rows.map((row) => row.material.family));
    // Ramesh handles paper, plastic, metal and e-waste — no glass, no clothes.
    expect([...families]).toEqual(["paper", "plastic", "metal", "ewaste"]);
    expect(card.rows).toHaveLength(20);
    for (const row of card.rows) {
      expect(row.myPaise).toBeGreaterThanOrEqual(row.floorPaise ?? 0);
      expect(row.fallbackPaise).toBeGreaterThan(0);
      expect(row.marketPaise).toBeGreaterThan(0);
    }
  });

  it("accepts an own offer below the indicative reference", async () => {
    const t = await demoWorld();
    const shop = await signInAs(t, RAMESH);
    await shop.mutation(api.shop.setRate, {
      materialCode: "PAPER-NEWS",
      paisePerKg: 1,
    });
    const saved = await priceRow(shop, "PAPER-NEWS");
    expect(saved?.myPaise).toBe(1);
  });

  it("adds a price the shop hadn't set", async () => {
    const t = await demoWorld();
    const shop = await signInAs(t, RAMESH);
    await t.run(async (ctx) => {
      const rows = await ctx.db.query("rateCards").collect();
      for (const row of rows) {
        if (row.materialCode === "PAPER-MIXED") {
          await ctx.db.delete("rateCards", row._id);
        }
      }
    });
    const unset = await priceRow(shop, "PAPER-MIXED");
    expect(unset?.myPaise).toBeNull();

    await shop.mutation(api.shop.setRate, {
      materialCode: "PAPER-MIXED",
      paisePerKg: 950,
    });
    const set = await priceRow(shop, "PAPER-MIXED");
    expect(set?.myPaise).toBe(950);
  });

  it("refuses odd prices and materials the shop doesn't handle", async () => {
    const t = await demoWorld();
    const shop = await signInAs(t, RAMESH);
    for (const paisePerKg of [0, -100, 1450.5, 2_000_000]) {
      await expect(
        shop.mutation(api.shop.setRate, {
          materialCode: "PAPER-NEWS",
          paisePerKg,
        }),
      ).rejects.toThrow(/INVALID_PRICE/);
    }
    for (const materialCode of ["GLASS-BOTTLE", "RECYCLED-KRAFT", "GOLD"]) {
      await expect(
        shop.mutation(api.shop.setRate, { materialCode, paisePerKg: 5000 }),
      ).rejects.toThrow(/NOT_MY_MATERIAL/);
    }
  });
});

describe("inventory mass boundary", () => {
  it.each([Number.MAX_SAFE_INTEGER, Number.MAX_SAFE_INTEGER + 1, -1, 0.5])(
    "refuses unsafe pickup stock without saving a receipt, points, inventory or audit (stock %s)",
    async (grams) => {
      const t = await demoWorld();
      const shop = await signInAs(t, RAMESH);
      const bookingId = await bookingOf(t, "Meena Iyer", "accepted");
      await t.run(async (ctx) => {
        const booking = await ctx.db.get("bookings", bookingId);
        if (!booking) throw new Error("Missing booking");
        const row = await ctx.db
          .query("inventory")
          .withIndex("by_org_material", (q) =>
            q.eq("orgId", booking.orgId).eq("materialCode", "PAPER-NEWS"),
          )
          .first();
        if (!row) throw new Error("Missing paper stock");
        await ctx.db.patch("inventory", row._id, { grams });
      });
      const snapshot = () =>
        t.run(async (ctx) => ({
          booking: await ctx.db.get("bookings", bookingId),
          inventory: await ctx.db.query("inventory").collect(),
          audit: await ctx.db.query("auditLog").collect(),
        }));
      const before = await snapshot();
      await expect(
        shop.mutation(api.shop.complete, {
          bookingId,
          lines: [
            { materialCode: "GLASS-BOTTLE", grams: 1000 },
            { materialCode: "PAPER-NEWS", grams: 2 },
          ],
          method: "cash",
        }),
      ).rejects.toThrow(/INVALID_WEIGHT/);
      expect(await snapshot()).toEqual(before);
    },
  );
});

it("completes a pickup exactly at the safe stock boundary", async () => {
  const t = await demoWorld();
  const shop = await signInAs(t, RAMESH);
  const bookingId = await bookingOf(t, "Meena Iyer", "accepted");
  const stockId = await t.run(async (ctx) => {
    const booking = await ctx.db.get("bookings", bookingId);
    if (!booking) throw new Error("Missing booking");
    const row = await ctx.db
      .query("inventory")
      .withIndex("by_org_material", (q) =>
        q.eq("orgId", booking.orgId).eq("materialCode", "PAPER-NEWS"),
      )
      .first();
    if (!row) throw new Error("Missing paper stock");
    await ctx.db.patch("inventory", row._id, {
      grams: Number.MAX_SAFE_INTEGER - 2,
    });
    return row._id;
  });
  await shop.mutation(api.shop.complete, {
    bookingId,
    lines: [{ materialCode: "PAPER-NEWS", grams: 2 }],
    method: "cash",
  });
  const currentStock = await t.run((ctx) => ctx.db.get("inventory", stockId));
  expect(currentStock?.grams).toBe(Number.MAX_SAFE_INTEGER);
  expect(await auditActions(t, bookingId)).toContain("booking.completed");
});
