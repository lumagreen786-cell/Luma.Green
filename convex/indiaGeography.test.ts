// @vitest-environment edge-runtime
import { convexTest } from "convex-test";
import { afterEach, describe, expect, it, vi } from "vitest";

import { api } from "./_generated/api";
import {
  convexModules,
  registerAuth,
  seedDemo,
  signIn,
} from "./lib/auth.testing";
import { shiftDate } from "./lib/dates";
import { INDIA_STATES_AND_UTS } from "./lib/geography";
import { indiaToday } from "./lib/onboarding";
import { kabadiwalaSchema } from "./lib/onboarding";
import { orgDraftFrom } from "./lib/review";
import schema from "./schema";

const modules = convexModules(import.meta.glob("./**/*.*s"));

afterEach(() => vi.unstubAllEnvs());

describe("explicit India city", () => {
  const shopApplication = {
    ownerName: "Test Person",
    shopName: "Synthetic National Shop",
    gstRegistered: true,
    gstin: "29ABCDE1234F1Z5",
    address: "Fixture street, Bengaluru, Karnataka",
    location: { lat: 12.97, lng: 77.59 },
    offersPickup: false,
    phones: [],
    opens: "09:00",
    closes: "18:00",
    weeklyOff: [],
  };

  it.each(INDIA_STATES_AND_UTS)(
    "accepts explicit %s in the shared submission schema and activation projection",
    (state) => {
      // Deliberately conflicting fixture address, GST prefix and GPS cannot choose the city.
      const input = {
        ...shopApplication,
        city: ` shared   CITY , ${state.toLowerCase()} `,
      };
      const parsed = kabadiwalaSchema.parse(input);
      expect(parsed.city).toBe(`Shared City, ${state}`);
      expect(
        orgDraftFrom({ kind: "kabadiwala", kabadiwala: parsed }),
      ).toMatchObject({
        city: `Shared City, ${state}`,
        address: shopApplication.address,
        location: shopApplication.location,
        gstin: shopApplication.gstin,
      });
    },
  );

  it.each([undefined, "Shared City", "Shared City, Unknown State"])(
    "does not infer a missing or invalid jurisdiction %s from other application fields",
    (city) => {
      const input = { ...shopApplication, city };
      expect(kabadiwalaSchema.safeParse(input).success).toBe(false);
      expect(
        orgDraftFrom({ kind: "kabadiwala", kabadiwala: input }),
      ).toBeNull();
    },
  );

  it("does not activate a legacy editable application without a city", () => {
    expect(
      orgDraftFrom({
        kind: "kabadiwala",
        kabadiwala: { shopName: "Test shop", address: "Test street, Delhi" },
      }),
    ).toBeNull();
  });
  it("keeps the entered city instead of guessing from an address", () => {
    expect(
      orgDraftFrom({
        kind: "kabadiwala",
        kabadiwala: {
          shopName: "Test shop",
          address: "Test street, Bengaluru",
          city: "  NEW   delhi , delhi ",
        },
      }),
    ).toMatchObject({ city: "New Delhi, Delhi" });
  });
  it("requires a city in the shared complete submission schema", () => {
    const parsed = kabadiwalaSchema.safeParse({
      ownerName: "Test Person",
      shopName: "Test Shop",
      gstRegistered: false,
      address: "Test street",
      offersPickup: false,
      phones: [],
      opens: "09:00",
      closes: "18:00",
      weeklyOff: [],
    });
    expect(parsed.success).toBe(false);
  });
  it("returns only shops from the explicitly selected city", async () => {
    vi.stubEnv("AUTH_DEV_MODE", "true");
    const t = convexTest(schema, modules);
    registerAuth(t);
    await seedDemo(t);
    await t.run(async (ctx) => {
      const shop = await ctx.db
        .query("orgs")
        .withIndex("by_kind_city", (q) =>
          q
            .eq("kind", "kabadiwala")
            .eq("city", "Bengaluru")
            .eq("status", "active"),
        )
        .first();
      if (!shop) throw new Error("Missing shop fixture");
      await ctx.db.patch("orgs", shop._id, { city: "New Delhi, Delhi" });
    });
    const shops = await t.query(api.households.shops, {
      city: " new   DELHI , DELHI ",
      items: [],
    });
    expect(shops).toHaveLength(1);
    expect(
      await t.query(api.households.shops, {
        city: "Mumbai, Maharashtra",
        items: [],
      }),
    ).toEqual([]);
    vi.unstubAllEnvs();
  });
});

it("routes household discovery through all 36 explicit state partitions without borrowing pilot prices", async () => {
  vi.stubEnv("AUTH_DEV_MODE", "true");
  const t = convexTest(schema, modules);
  registerAuth(t);
  await seedDemo(t);
  const pilot = await t.query(api.catalogue.priceQuotes, {
    city: "Bengaluru",
    source: "fallback",
  });
  expect(
    pilot.rows.find((row) => row.code === "PAPER-NEWS")?.paisePerKg,
  ).toBeGreaterThan(0);

  const shops = await t.run(async (ctx) => {
    const result = [];
    for (const [index, state] of INDIA_STATES_AND_UTS.entries()) {
      // Same-name, co-located synthetic records test routing, not real service coverage.
      const city = `Shared City, ${state}`;
      const id = await ctx.db.insert("orgs", {
        kind: "kabadiwala",
        name: `Synthetic shop ${state}`,
        slug: `synthetic-national-shop-${String(index)}`,
        status: "active",
        city,
        area: "Fixture area",
        address: "Fixture street, Bengaluru, Karnataka",
        location: { lat: 12.97, lng: 77.59 },
        phones: [],
        weeklyOff: [],
        families: ["paper"],
        offersPickup: true,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
      result.push({ id, city });
    }
    return result;
  });
  for (const shop of shops) {
    const offers = await t.query(api.households.shops, {
      city: shop.city.toUpperCase(),
      items: [{ materialCode: "PAPER-NEWS", kg: 1 }],
      near: { lat: 12.97, lng: 77.59 },
    });
    expect(offers.map((row) => row.id)).toEqual([shop.id]);
    expect(offers[0].estimatePaise).toBeUndefined();
    expect(offers[0].fallbackCodes).toEqual(["PAPER-NEWS"]);
    const localQuotes = await t.query(api.catalogue.priceQuotes, {
      city: shop.city,
      source: "fallback",
    });
    expect(
      localQuotes.rows.find((row) => row.code === "PAPER-NEWS")?.paisePerKg,
    ).toBeNull();
  }
  for (const city of [
    "Shared City",
    "Shared City, Unknown State",
    "Shared City, Daman and Diu",
    "Shared City, Karnataka, India",
  ])
    await expect(
      t.query(api.households.shops, {
        city,
        items: [],
        near: { lat: 12.97, lng: 77.59 },
      }),
    ).rejects.toThrow("INVALID_CITY");
});

it("requires explicit city before activation and never copies another city's reference prices", async () => {
  vi.stubEnv("AUTH_DEV_MODE", "true");
  const t = convexTest(schema, modules);
  registerAuth(t);
  await seedDemo(t);
  const person = await signIn(t, {
    email: "919812345601@phone.luma.green",
    phoneNumber: "+919812345601",
  });
  await person.mutation(api.identity.ensureProfile, { locale: "en" });
  await person.mutation(api.applications.start, {
    kind: "kabadiwala",
    locale: "en",
    ageConfirmed: true,
    privacyAccepted: true,
  });
  const section = {
    ownerName: "Test Person",
    shopName: "Mumbai Shop",
    gstRegistered: false,
    address: "Recorded street, Bengaluru",
    offersPickup: false,
    phones: [],
    opens: "09:00",
    closes: "18:00",
    weeklyOff: [],
  };
  await person.mutation(api.applications.saveDraft, { kabadiwala: section });
  await expect(person.mutation(api.applications.submit, {})).rejects.toThrow(
    "INCOMPLETE",
  );
  await person.mutation(api.applications.saveDraft, {
    kabadiwala: { ...section, city: " mUMBAI , maharashtra " },
  });
  await person.mutation(api.applications.submit, {});
  const shops = await t.run((ctx) =>
    ctx.db
      .query("orgs")
      .withIndex("by_kind_city", (q) =>
        q
          .eq("kind", "kabadiwala")
          .eq("city", "Mumbai, Maharashtra")
          .eq("status", "active"),
      )
      .take(5),
  );
  expect(shops).toHaveLength(1);
  expect(shops[0].address).toBe(section.address);
  const rates = await t.run((ctx) =>
    ctx.db
      .query("rateCards")
      .withIndex("by_org_material", (q) => q.eq("orgId", shops[0]._id))
      .take(30),
  );
  expect(rates).toEqual([]);
  vi.unstubAllEnvs();
});

it("keeps canonical city quotes isolated and missing local prices unavailable", async () => {
  vi.stubEnv("AUTH_DEV_MODE", "true");
  const t = convexTest(schema, modules);
  registerAuth(t);
  await seedDemo(t);
  const board = await t.query(api.catalogue.priceBoard, {
    city: " BENGALURU ",
  });
  expect(board.city).toBe("Bengaluru");
  const quotes = await t.query(api.catalogue.priceQuotes, {
    city: " mUMBAI , maharashtra ",
    source: "fallback",
  });
  expect(quotes.rows.every((row) => row.paisePerKg === null)).toBe(true);
  await expect(
    t.query(api.households.shops, { city: "1234", items: [] }),
  ).rejects.toThrow("INVALID_CITY");
  vi.unstubAllEnvs();
});

it("isolates same-name cities by state for household shops, quotes and direct pickup radius checks", async () => {
  vi.stubEnv("AUTH_DEV_MODE", "true");
  const t = convexTest(schema, modules);
  registerAuth(t);
  await seedDemo(t);
  const ids = await t.run(async (ctx) => {
    const shops = await ctx.db
      .query("orgs")
      .withIndex("by_kind_city", (q) =>
        q
          .eq("kind", "kabadiwala")
          .eq("city", "Bengaluru")
          .eq("status", "active"),
      )
      .take(2);
    if (shops.length !== 2) throw new Error("Missing local shop fixtures");
    const local = { lat: 22.08, lng: 82.15 };
    const remote = { lat: 31.33, lng: 76.75 };
    await ctx.db.patch("orgs", shops[0]._id, {
      city: "Bilaspur, Chhattisgarh",
      location: local,
      offersPickup: true,
    });
    await ctx.db.patch("orgs", shops[1]._id, {
      city: "Bilaspur, Himachal Pradesh",
      location: remote,
      offersPickup: true,
    });
    for (const [city, paise] of [
      ["Bilaspur, Chhattisgarh", 1000],
      ["Bilaspur, Himachal Pradesh", 2000],
    ] as const) {
      await ctx.db.insert("referencePrices", {
        city,
        materialCode: "PAPER-NEWS",
        floorPaise: paise,
        fallbackPaise: paise,
        updatedAt: Date.now(),
      });
    }
    return { first: shops[0]._id, second: shops[1]._id, local };
  });
  const first = await t.query(api.households.shops, {
    city: " bilaspur , chhattisgarh ",
    items: [],
    near: ids.local,
  });
  const second = await t.query(api.households.shops, {
    city: "Bilaspur, Himachal Pradesh",
    items: [],
    near: ids.local,
  });
  expect(first.map((row) => row.id)).toEqual([ids.first]);
  expect(second.map((row) => row.id)).toEqual([ids.second]);
  expect(second[0].offersPickup).toBe(false);
  for (const [city, paise] of [
    ["Bilaspur, Chhattisgarh", 1000],
    ["Bilaspur, Himachal Pradesh", 2000],
  ] as const) {
    const quotes = await t.query(api.catalogue.priceQuotes, {
      city,
      source: "fallback",
    });
    expect(
      quotes.rows.find((row) => row.code === "PAPER-NEWS")?.paisePerKg,
    ).toBe(paise);
  }
  await expect(
    t.query(api.households.shops, { city: "Bilaspur", items: [] }),
  ).rejects.toThrow("INVALID_CITY");
  const person = await signIn(t, {
    email: "919812345602@phone.luma.green",
    phoneNumber: "+919812345602",
  });
  await person.mutation(api.identity.ensureProfile, { locale: "en" });
  await expect(
    person.mutation(api.households.book, {
      adultConfirmed: true,
      orgId: ids.second,
      mode: "pickup",
      items: [{ materialCode: "PAPER-NEWS", kg: 1 }],
      name: "Test Person",
      address: "Full address for local household",
      location: ids.local,
      slotDate: shiftDate(indiaToday(), 1),
      slotWindow: "morning",
    }),
  ).rejects.toThrow("OUTSIDE_PICKUP_RADIUS");
  vi.unstubAllEnvs();
});
