/// <reference types="vite/client" />
// @vitest-environment edge-runtime
import { convexTest } from "convex-test";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

import { api, internal } from "./_generated/api";
import {
  convexModules,
  registerAuth,
  seedDemo,
  signInAs,
} from "./lib/auth.testing";
import { OFFER_TIMEOUT_MS } from "./lib/dispatch";
import schema from "./schema";

const modules = convexModules(import.meta.glob("./**/*.*s"));
const SHOP = "+919000000101";
const BUYER = "+919000000102";
const RECIPIENT = "+919000000105";
const HOUSEHOLD = "+919000000109";
const POINT = { lat: 13.028, lng: 77.5409 };
const offlineFetch = vi.fn(() => {
  throw new Error("OFFLINE_ACCEPTANCE_MUST_NOT_CALL_PROVIDERS");
});

beforeEach(() => {
  vi.stubEnv("AUTH_DEV_MODE", "true");
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-10-02T03:00:00Z"));
  offlineFetch.mockClear();
  vi.stubGlobal("fetch", offlineFetch);
});
afterEach(() => {
  const networkAttempts = offlineFetch.mock.calls.length;
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.useRealTimers();
  expect(networkAttempts).toBe(0);
});

async function world() {
  const t = convexTest(schema, modules);
  registerAuth(t);
  await seedDemo(t);
  const shop = await signInAs(t, SHOP);
  const household = await signInAs(t, HOUSEHOLD);
  const buyer = await signInAs(t, BUYER);
  const org = await t.run((ctx) =>
    ctx.db
      .query("orgs")
      .withIndex("by_slug", (q) => q.eq("slug", "ramesh-kabadi-store"))
      .unique(),
  );
  if (!org) throw new Error("Missing isolated shop fixture");
  return { t, shop, household, buyer, org };
}

const bookingValues = {
  mode: "pickup" as const,
  items: [],
  slotDate: "2026-10-03",
  slotWindow: "morning" as const,
  address: "Flat 12, Mathikere, Bengaluru",
  name: "Synthetic collection owner",
  location: POINT,
};

it("combines current radius, slot capacity, one acceptance and the unassigned deadline without provider calls", async () => {
  const w = await world();
  await w.t.run(async (ctx) => {
    const shops = await ctx.db
      .query("orgs")
      .withIndex("by_kind_city", (q) =>
        q.eq("kind", "kabadiwala").eq("city", "Bengaluru"),
      )
      .take(30);
    for (const row of shops)
      if (row._id !== w.org._id)
        await ctx.db.patch("orgs", row._id, { status: "suspended" });
    // Isolate this slot from the general demo's pre-existing visits.
    const existingVisits = await ctx.db
      .query("bookings")
      .withIndex("by_org_date_window", (q) =>
        q
          .eq("orgId", w.org._id)
          .eq("slotDate", bookingValues.slotDate)
          .eq("slotWindow", "morning"),
      )
      .take(30);
    for (const row of existingVisits)
      await ctx.db.patch("bookings", row._id, { status: "cancelled" });
  });
  await w.shop.mutation(api.collectionScheduling.saveAvailability, {
    capacityPerWindow: 2,
    holidayDates: [],
    enabledWindows: ["morning"],
  });
  await w.shop.mutation(api.shop.configureDispatch, {
    autoAccept: false,
    pickupRadiusKm: 2,
  });
  const photoIds = await Promise.all(
    [1, 2, 3].map((number) =>
      w.household.action(api.householdPhotos.upload, {
        name: `synthetic-scrap-${String(number)}.jpg`,
        bytes: new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 16, 1, 2, 3]).buffer,
      }),
    ),
  );
  const tokens = await Promise.all([
    w.household.mutation(api.households.book, {
      ...bookingValues,
      orgId: w.org._id,
      photoIds: [photoIds[0]],
    }),
    w.household.mutation(api.households.book, {
      ...bookingValues,
      orgId: w.org._id,
      photoIds: [photoIds[1]],
    }),
  ]);
  await expect(
    w.household.mutation(api.households.book, {
      ...bookingValues,
      orgId: w.org._id,
      photoIds: [photoIds[2]],
    }),
  ).rejects.toThrow("SLOT_UNAVAILABLE");
  const bookings = await w.t.run(async (ctx) =>
    Promise.all(
      tokens.map((token) =>
        ctx.db
          .query("bookings")
          .withIndex("by_token", (q) => q.eq("token", token))
          .unique(),
      ),
    ),
  );
  const [first, second] = bookings;
  if (!first || !second) throw new Error("Missing isolated requests");
  await w.t.run((ctx) =>
    ctx.db.patch("orgs", w.org._id, {
      location: { lat: 12, lng: 77 },
    }),
  );
  await expect(
    w.shop.mutation(api.shop.respond, { bookingId: first._id, accept: true }),
  ).rejects.toThrow("OUTSIDE_PICKUP_RADIUS");
  await w.t.run((ctx) => ctx.db.patch("orgs", w.org._id, { location: POINT }));
  const competing = await Promise.allSettled([
    w.shop.mutation(api.shop.respond, { bookingId: first._id, accept: true }),
    w.shop.mutation(api.shop.respond, { bookingId: first._id, accept: true }),
  ]);
  expect(competing.filter((row) => row.status === "fulfilled")).toHaveLength(1);
  expect(
    await w.t.run((ctx) => ctx.db.get("bookings", first._id)),
  ).toMatchObject({
    status: "accepted",
  });
  const acceptedEvents = await w.t.run((ctx) =>
    ctx.db
      .query("bookingOffers")
      .withIndex("by_booking", (q) => q.eq("bookingId", first._id))
      .take(10),
  );
  expect(acceptedEvents.filter((row) => row.event === "accepted")).toHaveLength(
    1,
  );
  vi.setSystemTime(Date.now() + OFFER_TIMEOUT_MS + 1);
  await w.t.mutation(internal.dispatch.expireOffer, {
    bookingId: second._id,
    attempt: second.dispatch?.attempt ?? 1,
  });
  const expired = await w.t.run((ctx) => ctx.db.get("bookings", second._id));
  expect(expired).toMatchObject({ status: "requested" });
  expect(expired?.dispatch?.expiresAt).toBeUndefined();
  const renewedShop = await signInAs(w.t, SHOP);
  await expect(
    renewedShop.mutation(api.shop.respond, {
      bookingId: second._id,
      accept: true,
    }),
  ).rejects.toThrow("WRONG_STATUS");
  const privateView = await renewedShop.query(api.shop.get, {
    bookingId: second._id,
  });
  expect(privateView?.booking.phone).not.toBe(HOUSEHOLD);
  expect(privateView?.booking.token).toBe("");
});

it("ranks comparable delivered offers but withdraws them when current eligibility changes", async () => {
  const w = await world();
  const common = {
    materialCode: "PAPER-NEWS",
    specification: { grade: "TEST-GRADE", specification: "TEST-SPEC" },
    grams: 1000,
  };
  const best = await w.shop.mutation(api.market.createListing, {
    ...common,
    askPaisePerKg: 100,
    freightPaisePerKg: 10,
    deliveryAvailableAt: Date.now() + 3_600_000,
  });
  const higherDelivered = await w.shop.mutation(api.market.createListing, {
    ...common,
    askPaisePerKg: 95,
    freightPaisePerKg: 20,
  });
  const unknownFreight = await w.shop.mutation(api.market.createListing, {
    ...common,
    askPaisePerKg: 1,
  });
  const ids = [best, higherDelivered, unknownFreight];
  const offers = await w.buyer.query(api.market.browse, {
    materialCode: common.materialCode,
  });
  expect(
    offers.filter((row) => ids.includes(row.id)).map((row) => row.id),
  ).toEqual(ids);
  await w.t.run((ctx) =>
    ctx.db.patch("orgs", w.org._id, { status: "suspended" }),
  );
  const afterSuspension = await w.buyer.query(api.market.browse, {
    materialCode: common.materialCode,
  });
  expect(afterSuspension.filter((row) => ids.includes(row.id))).toEqual([]);
  await expect(
    w.buyer.mutation(api.market.requestTrade, { listingId: best, grams: 1000 }),
  ).rejects.toThrow("NOT_FOUND");
  await w.t.run(async (ctx) => {
    await ctx.db.patch("orgs", w.org._id, { status: "active" });
    const buyer = await ctx.db
      .query("orgs")
      .withIndex("by_slug", (q) => q.eq("slug", "peenya-paper-plastic-yard"))
      .unique();
    if (!buyer) throw new Error("Missing isolated buyer");
    await ctx.db.patch("orgs", buyer._id, { families: ["plastic"] });
  });
  const afterScopeChange = await w.buyer.query(api.market.browse, {
    materialCode: common.materialCode,
  });
  expect(afterScopeChange.filter((row) => ids.includes(row.id))).toEqual([]);
  await expect(
    w.buyer.mutation(api.market.requestTrade, { listingId: best, grams: 1000 }),
  ).rejects.toThrow("MATERIAL_NOT_ELIGIBLE");
});

it("keeps an institution's repeat visit private while sharing only its reported aggregate", async () => {
  const w = await world();
  const recipient = await signInAs(w.t, RECIPIENT);
  const ids = await w.t.run(async (ctx) => {
    const owner = await ctx.db
      .query("profiles")
      .withIndex("by_phone", (q) => q.eq("phone", HOUSEHOLD))
      .unique();
    const viewer = await ctx.db
      .query("profiles")
      .withIndex("by_phone", (q) => q.eq("phone", RECIPIENT))
      .unique();
    if (!owner || !viewer) throw new Error("Missing isolated participants");
    await ctx.db.insert("stakeholderAccounts", {
      ownerProfileId: owner._id,
      kind: "material_generator",
      siteType: "apartment_community",
      organizationName: "Synthetic institution",
      status: "approved",
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
    const recipientId = await ctx.db.insert("stakeholderAccounts", {
      ownerProfileId: viewer._id,
      kind: "csr_sponsor",
      organizationName: "Synthetic aggregate recipient",
      status: "approved",
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
    const bookingId = await ctx.db.insert("bookings", {
      token: "synthetic-institution-template",
      orgId: w.org._id,
      householdProfileId: owner._id,
      phone: HOUSEHOLD,
      name: "Synthetic institution owner",
      mode: "pickup",
      address: "Private institution address, Bengaluru",
      items: [],
      slotDate: "2026-09-26",
      slotWindow: "morning",
      status: "completed",
      timeline: [{ status: "completed", at: Date.now() }],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
    return { recipientId, bookingId };
  });
  const schedule = await w.household.mutation(api.collectionScheduling.repeat, {
    bookingId: ids.bookingId,
    everyDays: 7,
  });
  await w.t.mutation(internal.collectionScheduling.generate, {});
  await w.t.mutation(internal.collectionScheduling.generate, {});
  const visits = await w.t.run((ctx) =>
    ctx.db
      .query("bookings")
      .withIndex("by_recurring_date", (q) =>
        q.eq("recurringDateKey", `${schedule}:2026-10-03`),
      )
      .take(2),
  );
  expect(visits).toHaveLength(1);
  const programmeId = await w.household.mutation(api.services.createProgramme, {
    operationKey: "programme-0001",
    title: "Synthetic institution report",
    area: "Example area",
    startsOn: "2026-10-01",
    endsOn: "2026-10-31",
    stream: "Dry recyclables",
    coverageCount: 1,
    trips: 1,
    centreHandovers: 0,
    quantityGrams: 1001,
    groupIncomePaise: 0,
    evidenceReference:
      "Private self-reported source, not official verification",
  });
  const reportId = await w.household.mutation(api.services.shareProgramme, {
    programmeId,
    recipientId: ids.recipientId,
    operationKey: "share-0001",
    purpose: "Review reported totals only",
    expiresAt: Date.now() + 86_400_000,
  });
  const shared = await recipient.query(api.services.report, { id: reportId });
  expect(shared).toMatchObject({
    quantityGrams: 1001,
    sourceQuality: "reported_unverified",
  });
  expect(JSON.stringify(shared)).not.toContain(HOUSEHOLD);
  expect(JSON.stringify(shared)).not.toContain("Private institution address");
  expect(JSON.stringify(shared)).not.toContain("Private self-reported source");
  await expect(
    recipient.query(api.services.programme, { id: programmeId }),
  ).rejects.toThrow("RECORD_ACCESS_DENIED");
  await expect(
    recipient.query(api.households.track, { token: visits[0].token }),
  ).resolves.toBeNull();
  await w.household.mutation(api.services.revokeProgrammeShare, {
    id: reportId,
  });
  await expect(
    recipient.query(api.services.report, { id: reportId }),
  ).rejects.toThrow("RECORD_ACCESS_DENIED");
  await w.household.mutation(api.collectionScheduling.stopRepeating, {
    id: schedule,
  });
  expect(
    await w.t.run((ctx) => ctx.db.get("bookings", visits[0]._id)),
  ).not.toBeNull();
});
