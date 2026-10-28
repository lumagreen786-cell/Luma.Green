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
} from "./lib/auth.testing";
import schema from "./schema";
const modules = convexModules(import.meta.glob("./**/*.*s"));
afterEach(() => vi.unstubAllEnvs());
async function world(city: string) {
  vi.stubEnv("AUTH_DEV_MODE", "true");
  vi.stubEnv("ADMIN_EMAIL", "collections-admin@example.test");
  const t = convexTest(schema, modules);
  registerAuth(t);
  await seedDemo(t);
  const admin = await signIn(t, {
    email: "collections-admin@example.test",
    twoFactorEnabled: true,
  });
  const ids = await t.run(async (ctx) => {
    const current = await ctx.db
      .query("orgs")
      .withIndex("by_slug", (q) => q.eq("slug", "ramesh-kabadi-store"))
      .unique();
    if (!current) throw new Error("fixture");
    await ctx.db.patch(current._id, { city });
    const booking = await ctx.db
      .query("bookings")
      .withIndex("by_org_status", (q) =>
        q.eq("orgId", current._id).eq("status", "requested"),
      )
      .first();
    if (!booking) throw new Error("fixture");
    const receiver = await ctx.db.insert("orgs", {
      kind: "kabadiwala",
      name: "Local receiver",
      slug: "local-receiver",
      status: "active",
      city,
      area: "Local",
      address: "Recorded shop address",
      phones: [],
      weeklyOff: [],
      hours: { opens: "09:00", closes: "18:00" },
      families: ["paper"],
      offersPickup: true,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
    await ctx.db.insert("orgs", {
      kind: "kabadiwala",
      name: "Different state",
      slug: "different-state",
      status: "active",
      city: "Bilaspur, Himachal Pradesh",
      area: "Remote",
      address: "Recorded shop address",
      phones: [],
      weeklyOff: [],
      hours: { opens: "09:00", closes: "18:00" },
      families: ["paper"],
      offersPickup: true,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
    return { bookingId: booking._id, orgId: current._id, receiver };
  });
  return { t, admin, ...ids };
}
it.each(["New Delhi, Delhi", "Bilaspur, Chhattisgarh"])(
  "offers local reassignment choices outside the pilot in %s",
  async (city) => {
    const { admin, receiver, bookingId } = await world(city);
    const choices = await admin.query(api.adminCollections.shops, {
      bookingId,
    });
    expect(choices.city).toBe(city);
    expect(choices.shops.map((row) => row.id)).toEqual([receiver]);
  },
);

it("keeps unknown-state legacy localities unavailable and rejects unsigned/non-admin callers", async () => {
  const { t, admin, bookingId } = await world("Bilaspur");
  expect(await admin.query(api.adminCollections.shops, { bookingId })).toEqual({
    city: null,
    shops: [],
  });
  await expect(
    t.query(api.adminCollections.shops, { bookingId }),
  ).rejects.toThrow("NOT_SIGNED_IN");
  const member = await signIn(t, { email: "member@example.test" });
  await expect(
    member.query(api.adminCollections.shops, { bookingId }),
  ).rejects.toThrow("NOT_ADMIN");
  vi.stubEnv("ADMIN_EMAIL", "incomplete-admin@example.test");
  const incompleteAdmin = await signIn(t, {
    email: "incomplete-admin@example.test",
    twoFactorEnabled: false,
  });
  await expect(
    incompleteAdmin.query(api.adminCollections.shops, { bookingId }),
  ).rejects.toThrow("TWO_FACTOR_REQUIRED");
});
