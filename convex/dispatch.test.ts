/// <reference types="vite/client" />
// @vitest-environment edge-runtime
import { convexTest } from "convex-test";
import { afterEach, describe, expect, it, vi } from "vitest";

import { api, internal } from "./_generated/api";
import type { Doc } from "./_generated/dataModel";
import {
  convexModules,
  registerAuth,
  seedDemo,
  signInAs,
} from "./lib/auth.testing";
import { shiftDate } from "./lib/dates";
import { OFFER_TIMEOUT_MS } from "./lib/dispatch";
import { indiaToday } from "./lib/onboarding";
import schema from "./schema";

const modules = convexModules(import.meta.glob("./**/*.*s"));
const POINT = { lat: 13.028, lng: 77.5409 };
const HOUSEHOLD = "+919000000109";
const SHOP = "+919000000101";

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
});

async function world() {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-10-01T03:00:00Z"));
  vi.stubEnv("AUTH_DEV_MODE", "true");
  const t = convexTest(schema, modules);
  registerAuth(t);
  await seedDemo(t);
  const org = await t.run(async (ctx) => {
    const rows = await ctx.db.query("orgs").collect();
    const chosen = rows.find((row) => row.slug === "ramesh-kabadi-store");
    if (!chosen) throw new Error("Missing demo shop");
    for (const row of rows) {
      if (row.kind === "kabadiwala" && row._id !== chosen._id)
        await ctx.db.patch("orgs", row._id, { status: "suspended" });
    }
    return chosen;
  });
  const household = await signInAs(t, HOUSEHOLD);
  const shop = await signInAs(t, SHOP);
  const args = {
    orgId: org._id,
    mode: "pickup" as const,
    items: [{ materialCode: "PAPER-NEWS", kg: 10 }],
    slotDate: shiftDate(indiaToday(), 1),
    slotWindow: "morning" as const,
    address: "12, 4th Cross, Mathikere, Bengaluru",
    name: "Priya Sharma",
    location: POINT,
  };
  return { t, org, household, shop, args };
}

type World = Awaited<ReturnType<typeof world>>;

async function read(w: World, token: string) {
  const row = await w.t.run(async (ctx) =>
    ctx.db
      .query("bookings")
      .withIndex("by_token", (q) => q.eq("token", token))
      .unique(),
  );
  if (!row) throw new Error("Missing booking");
  return row;
}

async function candidate(
  w: World,
  name: string,
  overrides: Partial<Doc<"orgs">> = {},
  price = 2500,
) {
  return w.t.run(async (ctx) => {
    const id = await ctx.db.insert("orgs", {
      kind: "kabadiwala",
      name,
      slug: name,
      status: "active",
      city: "Bengaluru",
      area: "Yeshwanthpur",
      address: "Yeshwanthpur, Bengaluru",
      location: { lat: POINT.lat + 0.002, lng: POINT.lng },
      phones: [],
      weeklyOff: [],
      families: ["paper"],
      offersPickup: true,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      ...overrides,
    });
    await ctx.db.insert("rateCards", {
      orgId: id,
      materialCode: "PAPER-NEWS",
      paisePerKg: price,
      updatedAt: Date.now(),
    });
    return id;
  });
}

async function events(w: World, booking: Doc<"bookings">) {
  return w.t.run(async (ctx) =>
    ctx.db
      .query("bookingOffers")
      .withIndex("by_booking", (q) => q.eq("bookingId", booking._id))
      .collect(),
  );
}

async function expire(w: World, booking: Doc<"bookings">) {
  vi.setSystemTime((booking.dispatch?.expiresAt ?? Date.now()) + 1);
  await w.t.mutation(internal.dispatch.expireOffer, {
    bookingId: booking._id,
    attempt: booking.dispatch?.attempt ?? 1,
  });
}

describe("pickup dispatch", () => {
  it("schedules the first offer and auto-accepts only a known pin in the radius", async () => {
    const w = await world();
    await w.shop.mutation(api.shop.configureDispatch, {
      autoAccept: true,
      pickupRadiusKm: 2,
    });
    const token = await w.household.mutation(api.households.book, w.args);
    const booking = await read(w, token);
    expect(booking.status).toBe("accepted");
    expect(booking.dispatch?.expiresAt).toBeUndefined();
    const bookingEvents = await events(w, booking);
    expect(bookingEvents.map((row) => row.event)).toEqual([
      "offered",
      "accepted",
    ]);
    const masked = await w.t.query(api.households.track, { token });
    expect(JSON.stringify(masked)).not.toContain('"lat"');
    expect(masked?.dispatch).toMatchObject({
      attempt: 1,
      approximateLocation: false,
    });

    for (const location of [
      undefined,
      { lat: POINT.lat + 1, lng: POINT.lng },
    ]) {
      const manualToken = await w.household.mutation(api.households.book, {
        ...w.args,
        location,
      });
      const manual = await read(w, manualToken);
      expect(manual.status).toBe("requested");
      expect(manual.dispatch?.expiresAt).toBe(Date.now() + OFFER_TIMEOUT_MS);
    }
  });

  it("passes a rejected offer to the closest eligible shop without reducing the quote", async () => {
    const w = await world();
    await candidate(w, "lower-price", { location: POINT }, 1);
    await candidate(w, "wrong-family", {
      location: POINT,
      families: ["plastic"],
    });
    await candidate(w, "dropoff-only", {
      location: POINT,
      offersPickup: false,
    });
    await candidate(w, "suspended", { location: POINT, status: "suspended" });
    await candidate(w, "other-city", { location: POINT, city: "Mysuru" });
    await candidate(w, "too-far", {
      location: { lat: POINT.lat + 1, lng: POINT.lng },
      pickupRadiusKm: 1,
    });
    await candidate(w, "no-location", { location: undefined });
    await candidate(w, "farther", {
      location: { lat: POINT.lat + 0.01, lng: POINT.lng },
    });
    const nearest = await candidate(w, "nearest");
    const token = await w.household.mutation(api.households.book, w.args);
    const original = await read(w, token);
    await w.shop.mutation(api.shop.respond, {
      bookingId: original._id,
      accept: false,
    });
    const next = await read(w, token);
    expect(next.orgId).toBe(nearest);
    const notifications = await w.t.run(async (ctx) =>
      ctx.db.query("smsNotifications").collect(),
    );
    expect(
      notifications.some(
        (row) =>
          row.event === "booking_reassigned" &&
          row.bookingId === next._id &&
          row.revision === 2,
      ),
    ).toBe(true);
    expect(original.estimatePaise).toBeDefined();
    expect(next.estimatePaise).toBeGreaterThanOrEqual(
      original.estimatePaise ?? 0,
    );
    expect(next.status).toBe("requested");
    expect(next.dispatch?.attempt).toBe(2);
    expect(next.dispatch?.attemptedOrgIds).toEqual([w.org._id, nearest]);
    expect(
      await w.shop.query(api.shop.get, { bookingId: next._id }),
    ).toBeNull();
    await expect(
      w.shop.mutation(api.shop.respond, { bookingId: next._id, accept: true }),
    ).rejects.toThrow(/NOT_FOUND/);
    const nextEvents = await events(w, next);
    expect(nextEvents.map((row) => row.event)).toEqual([
      "offered",
      "declined",
      "offered",
    ]);
    const view = await w.t.query(api.households.track, { token });
    expect(view?.shop.name).toBe("nearest");
    expect(view?.dispatch?.attempt).toBe(2);
  });

  it("finds the nearest eligible shop even after the first 200 city rows", async () => {
    const w = await world();
    await w.t.run(async (ctx) => {
      for (let index = 0; index < 205; index += 1) {
        await ctx.db.insert("orgs", {
          kind: "kabadiwala",
          name: `Far shop ${String(index)}`,
          slug: `far-${String(index)}`,
          status: "active",
          city: "Bengaluru",
          area: "Far area",
          address: "Far area, Bengaluru",
          location: { lat: POINT.lat + 1, lng: POINT.lng },
          phones: [],
          weeklyOff: [],
          families: ["paper"],
          offersPickup: true,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });
      }
    });
    const nearest = await candidate(w, "nearest-after-200");
    const token = await w.household.mutation(api.households.book, w.args);
    const original = await read(w, token);
    await w.shop.mutation(api.shop.respond, {
      bookingId: original._id,
      accept: false,
    });
    const reassigned = await read(w, token);
    expect(reassigned.orgId).toBe(nearest);
    expect(reassigned.status).toBe("requested");
  });

  it("runs the scheduled timeout and auto-accepts a qualified replacement", async () => {
    const w = await world();
    const next = await candidate(w, "automatic", { autoAccept: true });
    const token = await w.household.mutation(api.households.book, w.args);
    await w.t.finishAllScheduledFunctions(() =>
      vi.advanceTimersByTime(OFFER_TIMEOUT_MS),
    );
    const booking = await read(w, token);
    expect(booking.orgId).toBe(next);
    expect(booking.status).toBe("accepted");
    const bookingEvents = await events(w, booking);
    expect(bookingEvents.map((row) => row.event)).toEqual([
      "offered",
      "timed_out",
      "offered",
      "accepted",
    ]);
  });

  it("ignores early and stale timers and never offers the same shop twice", async () => {
    const w = await world();
    const next = await candidate(w, "next");
    const token = await w.household.mutation(api.households.book, w.args);
    const original = await read(w, token);
    await w.t.mutation(internal.dispatch.expireOffer, {
      bookingId: original._id,
      attempt: 1,
    });
    const early = await read(w, token);
    expect(early.dispatch?.attempt).toBe(1);
    await expire(w, original);
    const second = await read(w, token);
    expect(second.orgId).toBe(next);
    await expire(w, original);
    expect(await read(w, token)).toEqual(second);
    await expire(w, second);
    const exhausted = await read(w, token);
    expect(exhausted.status).toBe("declined");
    expect(exhausted.dispatch?.expiresAt).toBeUndefined();
    const exhaustedEvents = await events(w, exhausted);
    expect(exhaustedEvents.map((row) => row.event)).toEqual([
      "offered",
      "timed_out",
      "offered",
      "timed_out",
    ]);
    await expire(w, second);
    expect(await read(w, token)).toEqual(exhausted);
  });

  it("never changes an accepted or cancelled booking when its timer fires", async () => {
    for (const action of ["accept", "cancel"] as const) {
      const w = await world();
      await candidate(w, "next");
      const token = await w.household.mutation(api.households.book, w.args);
      const original = await read(w, token);
      if (action === "accept")
        await w.shop.mutation(api.shop.respond, {
          bookingId: original._id,
          accept: true,
        });
      else await w.household.mutation(api.households.cancel, { token });
      const settled = await read(w, token);
      await expire(w, original);
      expect(await read(w, token)).toEqual(settled);
    }
  });

  it.each([0, 1])(
    "rejects acceptance %i ms after the deadline before the expiry job runs",
    async (delay) => {
      const w = await world();
      const next = await candidate(w, "next");
      const token = await w.household.mutation(api.households.book, w.args);
      const original = await read(w, token);
      const originalEvents = await events(w, original);
      const originalAudit = await w.t.run((ctx) =>
        ctx.db.query("auditLog").collect(),
      );
      vi.setSystemTime(original.createdAt + OFFER_TIMEOUT_MS + delay);

      await expect(
        w.shop.mutation(api.shop.respond, {
          bookingId: original._id,
          accept: true,
        }),
      ).rejects.toThrow(/WRONG_STATUS/);
      expect(await read(w, token)).toEqual(original);
      expect(await events(w, original)).toEqual(originalEvents);
      expect(
        await w.t.run((ctx) => ctx.db.query("auditLog").collect()),
      ).toEqual(originalAudit);

      await w.t.mutation(internal.dispatch.expireOffer, {
        bookingId: original._id,
        attempt: 1,
      });
      const reassigned = await read(w, token);
      expect(reassigned.orgId).toBe(next);
      expect(reassigned.status).toBe("requested");
      const reassignedEvents = await events(w, reassigned);
      expect(reassignedEvents.map((row) => row.event)).toEqual([
        "offered",
        "timed_out",
        "offered",
      ]);
    },
  );

  it("accepts just before the deadline", async () => {
    const w = await world();
    const token = await w.household.mutation(api.households.book, w.args);
    const original = await read(w, token);
    vi.setSystemTime(original.createdAt + OFFER_TIMEOUT_MS - 1);
    await w.shop.mutation(api.shop.respond, {
      bookingId: original._id,
      accept: true,
    });
    const accepted = await read(w, token);
    expect(accepted.status).toBe("accepted");
  });

  it("preserves acceptance of legacy pickups without a dispatch deadline", async () => {
    const w = await world();
    const token = await w.household.mutation(api.households.book, w.args);
    const original = await read(w, token);
    await w.t.run((ctx) =>
      ctx.db.patch("bookings", original._id, { dispatch: undefined }),
    );
    vi.setSystemTime(original.createdAt + OFFER_TIMEOUT_MS);
    await w.shop.mutation(api.shop.respond, {
      bookingId: original._id,
      accept: true,
    });
    const accepted = await read(w, token);
    expect(accepted.status).toBe("accepted");
  });

  it("leaves drop-offs at the selected shop and preserves old booking behaviour", async () => {
    const w = await world();
    await candidate(w, "next");
    await w.shop.mutation(api.shop.configureDispatch, {
      autoAccept: true,
      pickupRadiusKm: 5,
    });
    const token = await w.household.mutation(api.households.book, {
      ...w.args,
      mode: "dropoff",
    });
    const booking = await read(w, token);
    expect(booking.dispatch).toBeUndefined();
    expect(booking.status).toBe("requested");
    await w.shop.mutation(api.shop.respond, {
      bookingId: booking._id,
      accept: false,
    });
    const declined = await read(w, token);
    expect(declined.status).toBe("declined");
    expect(await events(w, booking)).toEqual([]);
  });

  it("does not send an expired appointment to another shop", async () => {
    const w = await world();
    await candidate(w, "next");
    const token = await w.household.mutation(api.households.book, w.args);
    const booking = await read(w, token);
    vi.setSystemTime(new Date("2026-10-03T03:00:00Z"));
    await w.t.mutation(internal.dispatch.expireOffer, {
      bookingId: booking._id,
      attempt: 1,
    });
    const declined = await read(w, token);
    expect(declined.status).toBe("declined");
    expect(declined.orgId).toBe(w.org._id);
  });

  it("validates pins and refuses shop responses after a completed transition", async () => {
    const w = await world();
    await expect(
      w.household.mutation(api.households.book, {
        ...w.args,
        location: { lat: 91, lng: 77 },
      }),
    ).rejects.toThrow(/INVALID_LOCATION/);
    const token = await w.household.mutation(api.households.book, w.args);
    const booking = await read(w, token);
    await w.shop.mutation(api.shop.respond, {
      bookingId: booking._id,
      accept: true,
    });
    await expect(
      w.shop.mutation(api.shop.respond, {
        bookingId: booking._id,
        accept: false,
      }),
    ).rejects.toThrow(/WRONG_STATUS/);
    await expect(
      w.shop.mutation(api.shop.respond, {
        bookingId: booking._id,
        accept: true,
      }),
    ).rejects.toThrow(/WRONG_STATUS/);
  });
});

describe("shop dispatch preferences", () => {
  it("uses manual acceptance by default and audits changes once", async () => {
    const w = await world();
    expect(await w.shop.query(api.shop.dispatchSettings, {})).toMatchObject({
      autoAccept: false,
      pickupRadiusKm: 5,
      canManage: true,
      canAutoAccept: true,
    });
    for (let i = 0; i < 2; i += 1)
      await w.shop.mutation(api.shop.configureDispatch, {
        autoAccept: true,
        pickupRadiusKm: 3,
      });
    expect(await w.shop.query(api.shop.dispatchSettings, {})).toMatchObject({
      autoAccept: true,
      pickupRadiusKm: 3,
    });
    const audits = await w.t.run(async (ctx) =>
      ctx.db
        .query("auditLog")
        .withIndex("by_entity", (q) =>
          q.eq("entityTable", "orgs").eq("entityId", w.org._id),
        )
        .collect(),
    );
    expect(
      audits.filter((row) => row.action === "shop.dispatch_configured"),
    ).toHaveLength(1);
  });

  it("requires the active shop owner, a pickup location and an integer radius", async () => {
    const w = await world();
    const args = { autoAccept: true, pickupRadiusKm: 5 };
    await expect(
      w.t.mutation(api.shop.configureDispatch, args),
    ).rejects.toThrow(/NOT_SIGNED_IN/);
    await expect(
      w.household.mutation(api.shop.configureDispatch, args),
    ).rejects.toThrow(/NO_BUSINESS/);
    for (const pickupRadiusKm of [0, 51, 1.5])
      await expect(
        w.shop.mutation(api.shop.configureDispatch, {
          ...args,
          pickupRadiusKm,
        }),
      ).rejects.toThrow(/INVALID_RADIUS/);
    await w.t.run(async (ctx) => {
      await ctx.db.patch("orgs", w.org._id, { location: undefined });
    });
    await expect(
      w.shop.mutation(api.shop.configureDispatch, args),
    ).rejects.toThrow(/PICKUP_LOCATION_REQUIRED/);
    await w.t.run(async (ctx) => {
      await ctx.db.patch("orgs", w.org._id, { ownerProfileId: undefined });
      // Workspace membership is the current authority, including legacy staff.
      const memberships = await ctx.db
        .query("memberships")
        .withIndex("by_org", (q) => q.eq("orgId", w.org._id))
        .collect();
      for (const membership of memberships)
        await ctx.db.patch("memberships", membership._id, { role: "staff" });
    });
    await expect(
      w.shop.mutation(api.shop.configureDispatch, args),
    ).rejects.toThrow(/OWNER_REQUIRED/);
  });
});

it("reassigns a photo request without inventing an estimate", async () => {
  const w = await world();
  const otherId = await candidate(w, "photo-replacement");
  const photoId = await w.household.action(api.householdPhotos.upload, {
    name: "scrap.jpg",
    bytes: new Uint8Array([0xff, 0xd8, 0xff, 0xe0]).buffer,
  });
  const token = await w.household.mutation(api.households.book, {
    ...w.args,
    items: [],
    photoIds: [photoId],
  });
  const initial = await read(w, token);
  await w.shop.mutation(api.shop.respond, {
    bookingId: initial._id,
    accept: false,
  });
  const next = await read(w, token);
  expect(next.orgId).toBe(otherId);
  expect(next.estimatePaise).toBeUndefined();
  expect(next.items).toEqual([]);
});
