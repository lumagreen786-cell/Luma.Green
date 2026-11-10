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
import { shiftDate } from "./lib/dates";
import { indiaToday } from "./lib/onboarding";
import schema from "./schema";

const modules = convexModules(import.meta.glob("./**/*.*s"));
const code = "LOCAL-SOCIETY";

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
});

async function world() {
  vi.stubEnv("AUTH_DEV_MODE", "true");
  vi.stubEnv("ADMIN_EMAIL", "apartment-admin@example.test");
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-11-10T05:00:00Z"));
  const t = convexTest(schema, modules);
  registerAuth(t);
  await seedDemo(t);
  const household = await signInAs(t, "+919000000109");
  const admin = await signIn(t, {
    email: "apartment-admin@example.test",
    twoFactorEnabled: true,
  });
  await admin.mutation(api.identity.ensureProfile, { locale: "en" });
  const shop = await signInAs(t, "+919000000101");
  const scope = await shop.query(api.workspace.mine, {});
  if (scope?.kind !== "org") throw new Error("Missing test shop");
  const orgId = scope.org.id;
  const profileId = await household.mutation(api.identity.ensureProfile, {
    locale: "en",
  });
  const partnerId = await t.run(async (ctx) => {
    const now = Date.now();
    return ctx.db.insert("stakeholderAccounts", {
      ownerProfileId: profileId,
      kind: "participant_applicant",
      participantType: "community_champion",
      organizationName: "Synthetic Residents’ Association",
      status: "pending",
      createdAt: now,
      updatedAt: now,
    });
  });
  const date = shiftDate(indiaToday(), 1);
  return {
    t,
    admin,
    household,
    shop,
    partnerId,
    review: {
      city: "Bengaluru",
      code,
      orgId,
      partnerId,
      reviewReference: "Synthetic local reviewed consent",
      validUntil: date,
    },
    booking: {
      orgId,
      mode: "pickup" as const,
      slotDate: date,
      slotWindow: "morning" as const,
      adultConfirmed: true as const,
      items: [{ materialCode: "PAPER-NEWS", kg: 1 }],
      address: "Synthetic residents association flat 14",
      name: "Local adult household",
    },
  };
}

it("requires separate authorized review before serving a community code and rechecks current route scope", async () => {
  const w = await world();
  const args = { city: "Bengaluru", code };
  expect(await w.t.query(api.households.apartmentShop, args)).toBeNull();
  await expect(
    w.household.mutation(api.adminCollections.publishApartmentRoute, w.review),
  ).rejects.toThrow("NOT_ADMIN");
  await expect(
    w.admin.mutation(api.adminCollections.publishApartmentRoute, w.review),
  ).rejects.toThrow("APARTMENT_ROUTE_UNAVAILABLE");
  await w.t.run((ctx) => ctx.db.patch(w.partnerId, { status: "approved" }));
  expect(await w.t.query(api.households.apartmentShop, args)).toBeNull();
  const id = await w.admin.mutation(
    api.adminCollections.publishApartmentRoute,
    w.review,
  );
  expect(
    await w.t.query(api.households.apartmentShop, {
      ...args,
      code: code.toLowerCase(),
    }),
  ).toMatchObject({
    routeId: id,
    kind: "community_champion",
    shop: { id: w.review.orgId },
  });
  expect(
    await w.t.query(api.households.apartmentShop, {
      ...args,
      city: "Mumbai, Maharashtra",
    }),
  ).toBeNull();
  expect(
    await w.t.query(api.households.apartmentShop, {
      ...args,
      near: { lat: 18.5, lng: 73.8 },
    }),
  ).toBeNull();
  await expect(
    w.household.mutation(api.households.book, {
      ...w.booking,
      apartmentRouteId: id,
      slotDate: shiftDate(w.review.validUntil, 1),
    }),
  ).rejects.toThrow("APARTMENT_ROUTE_UNAVAILABLE");
  await w.admin.mutation(api.adminCollections.revokeApartmentRoute, { id });
  expect(await w.t.query(api.households.apartmentShop, args)).toBeNull();
  await expect(
    w.household.mutation(api.households.book, {
      ...w.booking,
      apartmentRouteId: id,
    }),
  ).rejects.toThrow("APARTMENT_ROUTE_UNAVAILABLE");
});

it("keeps a selected apartment offer with its reviewed collector after decline", async () => {
  const w = await world();
  await w.t.run((ctx) =>
    ctx.db.patch(w.partnerId, {
      status: "approved",
      participantType: "society_partner",
    }),
  );
  const id = await w.admin.mutation(
    api.adminCollections.publishApartmentRoute,
    w.review,
  );
  expect(
    await w.t.query(api.households.apartmentShop, {
      city: w.review.city,
      code,
    }),
  ).toMatchObject({ kind: "society_partner" });
  const token = await w.household.mutation(api.households.book, {
    ...w.booking,
    apartmentRouteId: id,
  });
  const booking = await w.t.run((ctx) =>
    ctx.db
      .query("bookings")
      .withIndex("by_token", (q) => q.eq("token", token))
      .unique(),
  );
  if (!booking) throw new Error("Missing test booking");
  const shops = await w.t.query(api.households.shops, {
    city: w.review.city,
    items: [],
  });
  const otherShop = shops.find(
    (row) => row.id !== w.review.orgId && row.offersPickup,
  );
  if (!otherShop) throw new Error("Missing alternate shop");
  await expect(
    w.household.mutation(api.households.book, {
      ...w.booking,
      orgId: otherShop.id,
      apartmentRouteId: id,
    }),
  ).rejects.toThrow("APARTMENT_ROUTE_UNAVAILABLE");
  await expect(
    w.admin.mutation(api.adminCollections.reassign, {
      bookingId: booking._id,
      orgId: otherShop.id,
      reason: "Synthetic reroute",
    }),
  ).rejects.toThrow("APARTMENT_ROUTE_UNAVAILABLE");
  await w.shop.mutation(api.shop.respond, {
    bookingId: booking._id,
    accept: false,
  });
  expect(
    await w.household.query(api.households.track, { token }),
  ).toMatchObject({ status: "declined", isApartmentCollection: true });
  const unchanged = await w.t.run((ctx) => ctx.db.get("bookings", booking._id));
  expect(unchanged).toMatchObject({
    orgId: w.review.orgId,
    dispatch: { attemptedOrgIds: [w.review.orgId] },
  });
});
