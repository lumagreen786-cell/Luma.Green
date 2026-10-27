/// <reference types="vite/client" />
// @vitest-environment edge-runtime
import { convexTest } from "convex-test";
import { afterEach, describe, expect, it, vi } from "vitest";

import { api, components, internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
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

/** The demo household, with two seeded bookings (priyademo1 and 2). */
const PRIYA = "+919000000109";
const HOME = "Flat 12, 4th Cross, Mathikere, Bengaluru";

afterEach(() => {
  vi.unstubAllEnvs();
});

async function demoWorld() {
  vi.stubEnv("AUTH_DEV_MODE", "true");
  const t = convexTest(schema, modules);
  registerAuth(t);
  await seedDemo(t);
  return t;
}

type World = Awaited<ReturnType<typeof demoWorld>>;

async function orgId(t: World, slug: string): Promise<Id<"orgs">> {
  const org = await t.run(async (ctx) =>
    ctx.db
      .query("orgs")
      .withIndex("by_slug", (q) => q.eq("slug", slug))
      .unique(),
  );
  if (!org) throw new Error(`No org ${slug}`);
  return org._id;
}

async function rate(t: World, slug: string, code: string): Promise<number> {
  const id = await orgId(t, slug);
  const row = await t.run(async (ctx) =>
    ctx.db
      .query("rateCards")
      .withIndex("by_org_material", (q) =>
        q.eq("orgId", id).eq("materialCode", code),
      )
      .unique(),
  );
  if (!row) throw new Error(`No ${code} price at ${slug}`);
  return row.paisePerKg;
}

/** Someone new, signed in with their phone for the first time. */
async function newHousehold(t: World, phone = "+919876500001") {
  const as = await signIn(t, {
    email: `${phone.slice(1)}@phone.luma.green`,
    phoneNumber: phone,
  });
  await as.mutation(api.identity.ensureProfile, { locale: "en" });
  return as;
}

function tomorrow() {
  return shiftDate(indiaToday(), 1);
}

const basket = [
  { materialCode: "PAPER-NEWS", kg: 12 },
  { materialCode: "PLASTIC-PET", kg: 3 },
];

async function pickupAt(t: World, slug = "ramesh-kabadi-store") {
  return {
    orgId: await orgId(t, slug),
    mode: "pickup" as const,
    items: basket,
    slotDate: tomorrow(),
    slotWindow: "morning" as const,
    address: HOME,
    name: "Arjun",
  };
}

async function bookingByToken(t: World, token: string) {
  return t.run(async (ctx) =>
    ctx.db
      .query("bookings")
      .withIndex("by_token", (q) => q.eq("token", token))
      .unique(),
  );
}

async function statusOf(t: World, token: string) {
  const booking = await bookingByToken(t, token);
  return booking?.status;
}

describe("households.shops", () => {
  it("prices the basket at each shop's own rates, the city fallback for gaps", async () => {
    const t = await demoWorld();
    const shops = await t.query(api.households.shops, {
      items: [
        { materialCode: "PAPER-NEWS", kg: 10 },
        { materialCode: "METAL-IRON", kg: 5 },
      ],
    });

    const ramesh = shops.find((shop) => shop.name === "Ramesh Kabadi Store");
    expect(ramesh?.estimatePaise).toBe(
      10 * (await rate(t, "ramesh-kabadi-store", "PAPER-NEWS")) +
        5 * (await rate(t, "ramesh-kabadi-store", "METAL-IRON")),
    );
    expect(ramesh?.fallbackCodes).toEqual([]);

    // Jayanagar buys paper and plastic only: iron is at the city fallback.
    const jayanagar = shops.find(
      (shop) => shop.name === "Jayanagar Raddi Centre",
    );
    expect(jayanagar?.fallbackCodes).toEqual(["METAL-IRON"]);
    expect(jayanagar?.estimatePaise).toBe(
      10 * (await rate(t, "jayanagar-raddi-centre", "PAPER-NEWS")) + 5 * 2800,
    );
    expect(jayanagar?.offersPickup).toBe(false);
  });

  it("lists active kabadiwalas only, best offer first", async () => {
    const t = await demoWorld();
    const sriLakshmi = await orgId(t, "sri-lakshmi-scrap");
    await t.run(async (ctx) => {
      await ctx.db.patch("orgs", sriLakshmi, { status: "suspended" });
    });

    const shops = await t.query(api.households.shops, {
      items: [{ materialCode: "PAPER-NEWS", kg: 10 }],
    });
    const names = shops.map((shop) => shop.name);
    expect(names).toHaveLength(5);
    expect(names).not.toContain("Sri Lakshmi Scrap");
    expect(names).not.toContain("Peenya Paper & Plastic Yard");
    const offers = shops.map((shop) => shop.estimatePaise);
    expect(offers).toEqual(offers.toSorted((a, b) => (b ?? 0) - (a ?? 0)));
    expect(shops.every((shop) => shop.distanceKm === undefined)).toBe(true);
  });

  it("sorts nearest first when the household shares where they are", async () => {
    const t = await demoWorld();
    const shops = await t.query(api.households.shops, {
      items: [{ materialCode: "PAPER-NEWS", kg: 10 }],
      near: { lat: 13.028, lng: 77.5409 }, // Yeshwanthpur
    });
    expect(shops[0]).toMatchObject({
      name: "Ramesh Kabadi Store",
      distanceKm: 0,
    });
    const distances = shops.map((shop) => shop.distanceKm ?? 0);
    expect(distances).toEqual(distances.toSorted((a, b) => a - b));
  });

  it("refuses a basket it can't price", async () => {
    const t = await demoWorld();
    const shops = (items: { materialCode: string; kg: number }[]) =>
      t.query(api.households.shops, { items });
    await expect(shops([{ materialCode: "NOPE", kg: 1 }])).rejects.toThrow(
      /UNKNOWN_MATERIAL/,
    );
    // Recycled output is sold by recyclers, never by households.
    await expect(
      shops([{ materialCode: "RECYCLED-PET-FLAKE", kg: 1 }]),
    ).rejects.toThrow(/UNKNOWN_MATERIAL/);
    await expect(
      shops([{ materialCode: "PAPER-NEWS", kg: 0 }]),
    ).rejects.toThrow(/INVALID_KG/);
    await expect(
      shops([{ materialCode: "PAPER-NEWS", kg: 501 }]),
    ).rejects.toThrow(/INVALID_KG/);
    await expect(
      t.query(api.households.shops, {
        items: [],
        near: { lat: 200, lng: 77 },
      }),
    ).rejects.toThrow(/INVALID_LOCATION/);
  });
});

describe("households.book", () => {
  it("books a pickup for the signed-in household at the shop's prices", async () => {
    const t = await demoWorld();
    const arjun = await newHousehold(t);
    const token = await arjun.mutation(api.households.book, {
      ...(await pickupAt(t)),
      address: "  Flat 12, 4th Cross,\n Mathikere ",
      name: "  Arjun Nair ",
    });
    expect(token).toMatch(/^[2-9a-z]{10}$/);

    const booking = await bookingByToken(t, token);
    expect(booking).toMatchObject({
      status: "requested",
      mode: "pickup",
      phone: "+919876500001",
      name: "Arjun Nair",
      address: "Flat 12, 4th Cross, Mathikere",
      slotDate: tomorrow(),
      slotWindow: "morning",
      items: [
        { materialCode: "PAPER-NEWS", estKg: 12 },
        { materialCode: "PLASTIC-PET", estKg: 3 },
      ],
      estimatePaise:
        12 * (await rate(t, "ramesh-kabadi-store", "PAPER-NEWS")) +
        3 * (await rate(t, "ramesh-kabadi-store", "PLASTIC-PET")),
    });
    expect(booking?.householdProfileId).toBeDefined();
    expect(booking?.timeline.map((step) => step.status)).toEqual(["requested"]);

    const audit = await t.run(async (ctx) =>
      ctx.db
        .query("auditLog")
        .withIndex("by_entity", (q) =>
          q.eq("entityTable", "bookings").eq("entityId", booking?._id ?? ""),
        )
        .collect(),
    );
    expect(audit.map((row) => row.action)).toEqual(["booking.requested"]);
  });

  it("needs a signed-in household", async () => {
    const t = await demoWorld();
    await expect(
      t.mutation(api.households.book, await pickupAt(t)),
    ).rejects.toThrow(/NOT_SIGNED_IN/);
  });

  it("does not accept a profile phone after its authentication verification is removed", async () => {
    const t = await demoWorld();
    const arjun = await newHousehold(t);
    await t.run(async (ctx) => {
      const profile = await ctx.db
        .query("profiles")
        .withIndex("by_phone", (q) => q.eq("phone", "+919876500001"))
        .unique();
      if (!profile) throw new Error("Missing household fixture");
      await ctx.runMutation(components.betterAuth.adapter.updateOne, {
        input: {
          model: "user",
          where: [{ field: "_id", value: profile.authUserId }],
          update: { phoneNumberVerified: false },
        },
      });
    });
    await expect(
      arjun.mutation(api.households.book, await pickupAt(t)),
    ).rejects.toThrow("NO_PHONE");
  });

  it("books with the currently verified phone when the profile cache is stale", async () => {
    const t = await demoWorld();
    const arjun = await newHousehold(t);
    await t.run(async (ctx) => {
      const profile = await ctx.db
        .query("profiles")
        .withIndex("by_phone", (q) => q.eq("phone", "+919876500001"))
        .unique();
      if (!profile) throw new Error("Missing household fixture");
      await ctx.runMutation(components.betterAuth.adapter.updateOne, {
        input: {
          model: "user",
          where: [{ field: "_id", value: profile.authUserId }],
          update: { phoneNumber: "+919876500003", phoneNumberVerified: true },
        },
      });
    });
    const token = await arjun.mutation(api.households.book, await pickupAt(t));
    const booking = await bookingByToken(t, token);
    expect(booking?.phone).toBe("+919876500003");
  });

  it("needs an address for a pickup", async () => {
    const t = await demoWorld();
    const arjun = await newHousehold(t);
    const noAddress = { ...(await pickupAt(t)), address: undefined };
    await expect(
      arjun.mutation(api.households.book, noAddress),
    ).rejects.toThrow(/ADDRESS_REQUIRED/);
    await expect(
      arjun.mutation(api.households.book, {
        ...noAddress,
        address: "Flat 4",
      }),
    ).rejects.toThrow(/INVALID_ADDRESS/);
  });

  it("books a pickup only with a shop that picks up; a drop-off with any", async () => {
    const t = await demoWorld();
    const arjun = await newHousehold(t);
    const jayanagar = await pickupAt(t, "jayanagar-raddi-centre");
    await expect(
      arjun.mutation(api.households.book, jayanagar),
    ).rejects.toThrow(/SHOP_NO_PICKUP/);

    const token = await arjun.mutation(api.households.book, {
      ...jayanagar,
      mode: "dropoff",
    });
    const booking = await bookingByToken(t, token);
    expect(booking?.mode).toBe("dropoff");
    // A drop-off never keeps the household's address.
    expect(booking?.address).toBeUndefined();
  });

  it("books only an active kabadiwala", async () => {
    const t = await demoWorld();
    const arjun = await newHousehold(t);
    await expect(
      arjun.mutation(
        api.households.book,
        await pickupAt(t, "peenya-paper-plastic-yard"),
      ),
    ).rejects.toThrow(/SHOP_NOT_FOUND/);
  });

  it("books from today up to six days ahead", async () => {
    const t = await demoWorld();
    const arjun = await newHousehold(t);
    const today = indiaToday();
    const booking = await pickupAt(t);
    for (const slotDate of [shiftDate(today, -1), shiftDate(today, 8), "x"]) {
      await expect(
        arjun.mutation(api.households.book, { ...booking, slotDate }),
      ).rejects.toThrow(/INVALID_DATE/);
    }
    await expect(
      arjun.mutation(api.households.book, {
        ...booking,
        slotDate: shiftDate(today, 6),
        slotWindow: "evening",
      }),
    ).resolves.toMatch(/^[2-9a-z]{10}$/);
  });

  it("checks the basket and the name", async () => {
    const t = await demoWorld();
    const arjun = await newHousehold(t);
    const booking = await pickupAt(t);
    const attempt = (changes: Partial<typeof booking>) =>
      arjun.mutation(api.households.book, { ...booking, ...changes });

    await expect(attempt({ items: [] })).rejects.toThrow(/PHOTOS_REQUIRED/);
    await expect(
      attempt({ items: [{ materialCode: "PAPER-NEWS", kg: 0 }] }),
    ).rejects.toThrow(/INVALID_KG/);
    await expect(
      attempt({ items: [{ materialCode: "PAPER-NEWS", kg: 500.5 }] }),
    ).rejects.toThrow(/INVALID_KG/);
    await expect(
      attempt({ items: [{ materialCode: "GOLD", kg: 1 }] }),
    ).rejects.toThrow(/UNKNOWN_MATERIAL/);
    const tooMany = Array.from({ length: 21 }, (_, index) => ({
      materialCode: `M${String(index)}`,
      kg: 1,
    }));
    await expect(attempt({ items: tooMany })).rejects.toThrow(/TOO_MANY_ITEMS/);
    await expect(attempt({ name: " A " })).rejects.toThrow(/INVALID_NAME/);
  });

  it("counts older open bookings even after fifty newer cancellations", async () => {
    const t = await demoWorld();
    const arjun = await newHousehold(t);
    const booking = await pickupAt(t);
    const tokens = [];
    for (let index = 0; index < 5; index += 1) {
      tokens.push(await arjun.mutation(api.households.book, booking));
    }
    const original = await bookingByToken(t, tokens[0]);
    if (!original) throw new Error("Missing booking");
    await t.run(async (ctx) => {
      const { _id, _creationTime, ...data } = original;
      for (let index = 0; index < 50; index += 1) {
        await ctx.db.insert("bookings", {
          ...data,
          token: `closed-${String(index)}`,
          status: "cancelled",
        });
      }
    });
    const before = await t.run((ctx) => ctx.db.query("bookings").collect());
    await expect(arjun.mutation(api.households.book, booking)).rejects.toThrow(
      /TOO_MANY_OPEN/,
    );
    expect(await t.run((ctx) => ctx.db.query("bookings").collect())).toEqual(
      before,
    );
  });

  it("keeps a household to five open bookings at once", async () => {
    const t = await demoWorld();
    const arjun = await newHousehold(t);
    const booking = await pickupAt(t);
    for (let index = 0; index < 5; index += 1) {
      await arjun.mutation(api.households.book, booking);
    }
    await expect(arjun.mutation(api.households.book, booking)).rejects.toThrow(
      /TOO_MANY_OPEN/,
    );
  });
});

describe("households.track", () => {
  it("shows the booking only to its owner, without household contact data", async () => {
    const t = await demoWorld();
    const arjun = await newHousehold(t, "+919876512345");
    const token = await arjun.mutation(api.households.book, await pickupAt(t));

    const view = await arjun.query(api.households.track, { token });
    expect(view).toMatchObject({
      token,
      status: "requested",
      mode: "pickup",
      slotDate: tomorrow(),
      slotWindow: "morning",
      isMine: true,
      canCancel: true,
      shop: {
        name: "Ramesh Kabadi Store",
        area: "Yeshwanthpur",
        // The shop's own number, so the household can call.
        phone: "+919000000101",
      },
    });
    expect(view?.items.map((row) => row.material.names.en)).toEqual([
      "Newspaper",
      "PET bottles",
    ]);

    const everything = JSON.stringify(view);
    expect(everything).not.toContain("9876512345");
    expect(everything).not.toContain("Mathikere");
    expect(everything).not.toContain("Arjun");
  });

  it("shows the receipt and points of a finished pickup", async () => {
    const t = await demoWorld();
    const priya = await signInAs(t, PRIYA);
    const view = await priya.query(api.households.track, {
      token: "priyademo2",
    });
    expect(view?.status).toBe("completed");
    expect(view?.canCancel).toBe(false);
    expect(view?.receipt?.lines.map((line) => line.material.names.en)).toEqual([
      "Newspaper",
      "Cardboard boxes",
    ]);
    expect(view?.receipt?.totalPaise).toBe(
      view?.receipt?.lines.reduce((sum, line) => sum + line.paise, 0),
    );
    expect(view?.points).toBeGreaterThan(0);
    expect(JSON.stringify(view)).not.toContain("Rose Apartments");
  });

  it("knows whether the viewer is the household that booked", async () => {
    const t = await demoWorld();
    const priya = await signInAs(t, PRIYA);
    const stranger = await newHousehold(t);
    const token = "priyademo1";
    const asPriya = await priya.query(api.households.track, { token });
    const asStranger = await stranger.query(api.households.track, { token });
    const signedOut = await t.query(api.households.track, { token });
    expect(asPriya?.isMine).toBe(true);
    expect(asStranger).toBeNull();
    expect(signedOut).toBeNull();
  });

  it("finds nothing for an unknown link", async () => {
    const t = await demoWorld();
    expect(
      await t.query(api.households.track, { token: "nosuchbook" }),
    ).toBeNull();
    expect(await t.query(api.households.track, { token: "" })).toBeNull();
  });
});

describe("households.mine", () => {
  it("lists the signed-in household's own bookings, newest first", async () => {
    const t = await demoWorld();
    const priya = await signInAs(t, PRIYA);
    const token = await priya.mutation(api.households.book, {
      ...(await pickupAt(t)),
      name: "Priya",
    });

    const mine = await priya.query(api.households.mine, {});
    expect(mine?.map((row) => row.token)).toEqual([
      token,
      "priyademo1",
      "priyademo2",
    ]);
    expect(mine?.[0]).toMatchObject({
      status: "requested",
      shopName: "Ramesh Kabadi Store",
      itemCount: 2,
      estGrams: 15_000,
    });
    expect(mine?.[2]?.paidPaise).toBeUndefined();
  });

  it("shows nobody else's bookings, and nothing when signed out", async () => {
    const t = await demoWorld();
    const stranger = await newHousehold(t);
    expect(await stranger.query(api.households.mine, {})).toEqual([]);
    expect(await t.query(api.households.mine, {})).toBeNull();
  });
});

describe("households.cancel", () => {
  it("lets the household cancel while it's requested", async () => {
    const t = await demoWorld();
    const priya = await signInAs(t, PRIYA);
    await priya.mutation(api.households.cancel, { token: "priyademo1" });

    const booking = await bookingByToken(t, "priyademo1");
    expect(booking?.status).toBe("cancelled");
    expect(booking?.timeline.map((step) => step.status)).toEqual([
      "requested",
      "cancelled",
    ]);
    const view = await priya.query(api.households.track, {
      token: "priyademo1",
    });
    expect(view?.canCancel).toBe(false);
  });

  it("lets the household cancel an accepted pickup, but not once it's on the way", async () => {
    const t = await demoWorld();
    const arjun = await newHousehold(t);
    const token = await arjun.mutation(api.households.book, await pickupAt(t));
    const booking = await bookingByToken(t, token);
    if (!booking) throw new Error("not booked");

    await t.run(async (ctx) => {
      await ctx.db.patch("bookings", booking._id, { status: "accepted" });
    });
    await arjun.mutation(api.households.cancel, { token });
    expect(await statusOf(t, token)).toBe("cancelled");

    const second = await arjun.mutation(api.households.book, await pickupAt(t));
    const onTheWay = await bookingByToken(t, second);
    if (!onTheWay) throw new Error("not booked");
    await t.run(async (ctx) => {
      await ctx.db.patch("bookings", onTheWay._id, { status: "on_the_way" });
    });
    await expect(
      arjun.mutation(api.households.cancel, { token: second }),
    ).rejects.toThrow(/CANNOT_CANCEL/);
  });

  it("refuses a finished pickup, someone else's booking and signed-out visitors", async () => {
    const t = await demoWorld();
    const priya = await signInAs(t, PRIYA);
    await expect(
      priya.mutation(api.households.cancel, { token: "priyademo2" }),
    ).rejects.toThrow(/CANNOT_CANCEL/);

    const stranger = await newHousehold(t);
    await expect(
      stranger.mutation(api.households.cancel, { token: "priyademo1" }),
    ).rejects.toThrow(/NOT_YOURS/);
    await expect(
      t.mutation(api.households.cancel, { token: "priyademo1" }),
    ).rejects.toThrow(/NOT_SIGNED_IN/);
    await expect(
      priya.mutation(api.households.cancel, { token: "nosuchbook" }),
    ).rejects.toThrow(/NOT_FOUND/);
    expect(await statusOf(t, "priyademo1")).toBe("requested");
  });
});

const imageBytes = () =>
  new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 16, 1, 2, 3]).buffer;

describe("photo-only household requests", () => {
  it("stores owned photos without invented quantities or estimates and keeps bytes private", async () => {
    const t = await demoWorld();
    const as = await newHousehold(t);
    const photoId = await as.action(api.householdPhotos.upload, {
      name: "scrap.jpg",
      bytes: imageBytes(),
    });
    const token = await as.mutation(api.households.book, {
      ...(await pickupAt(t)),
      items: [],
      photoIds: [photoId],
    });
    const booking = await bookingByToken(t, token);
    expect(booking).toMatchObject({ items: [], requestKind: "photo_request" });
    expect(booking?.estimatePaise).toBeUndefined();
    await t.run((ctx) =>
      ctx.db.patch("householdPhotos", photoId, {
        createdAt: Date.now() - 25 * 60 * 60 * 1000,
      }),
    );
    await t.mutation(internal.householdPhotos.expire, { photoId });
    expect(
      await t.run((ctx) => ctx.db.get("householdPhotos", photoId)),
    ).not.toBeNull();
    const tracked = await t.query(api.households.track, { token });
    expect(tracked?.estimatePaise).toBeUndefined();
    expect(
      await as.action(api.householdPhotos.read, { photoId }),
    ).toMatchObject({ bytes: imageBytes(), contentType: "image/jpeg" });
    await expect(
      t.action(api.householdPhotos.read, { photoId }),
    ).rejects.toThrow("NOT_SIGNED_IN");
    const other = await newHousehold(t, "+919876500002");
    await expect(
      other.action(api.householdPhotos.read, { photoId }),
    ).rejects.toThrow();
    expect(
      await as.mutation(api.households.book, {
        ...(await pickupAt(t)),
        items: [],
        photoIds: [photoId],
      }),
    ).toBe(token);
    await expect(
      as.mutation(api.households.book, {
        ...(await pickupAt(t)),
        items: [],
        photoIds: [photoId],
        name: "Changed name",
      }),
    ).rejects.toThrow("PHOTO_NOT_AVAILABLE");
    const attached = await t.run((ctx) =>
      ctx.db.get("householdPhotos", photoId),
    );
    expect(attached?.bookingId).toBe(booking?._id);
    if (!attached?.storageId) throw new Error("Missing photo storage");
    await t.mutation(internal.householdPhotos.discardUnattached, {
      photoId,
      storageId: attached.storageId,
    });
    expect(
      await as.action(api.householdPhotos.read, { photoId }),
    ).toMatchObject({ bytes: imageBytes() });
    if (!booking) throw new Error("Missing booking");
    const shop = await signInAs(t, "+919000000101");
    expect(
      await shop.query(api.householdPhotos.list, { bookingId: booking._id }),
    ).toHaveLength(1);
    await t.run(async (ctx) => {
      const membership = await ctx.db
        .query("memberships")
        .withIndex("by_org", (q) => q.eq("orgId", booking.orgId))
        .first();
      if (!membership) throw new Error("Missing membership");
      await ctx.db.patch("memberships", membership._id, { role: "viewer" });
    });
    const shopPhoto = await shop.action(api.householdPhotos.read, { photoId });
    expect(shopPhoto.contentType).toBe("image/jpeg");
    const requestOtherOrg = await orgId(t, "jayanagar-raddi-centre");
    await t.run((ctx) =>
      ctx.db.patch("bookings", booking._id, { orgId: requestOtherOrg }),
    );
    await expect(
      shop.action(api.householdPhotos.read, { photoId }),
    ).rejects.toThrow("FORBIDDEN");
  });
  it("rejects foreign, duplicate, missing and excessive photos", async () => {
    const t = await demoWorld();
    const as = await newHousehold(t);
    const other = await newHousehold(t, "+919876500002");
    const photoId = await as.action(api.householdPhotos.upload, {
      name: "scrap.jpg",
      bytes: imageBytes(),
    });
    const request = { ...(await pickupAt(t)), items: [] };
    await expect(as.mutation(api.households.book, request)).rejects.toThrow(
      "PHOTOS_REQUIRED",
    );
    await expect(
      other.mutation(api.households.book, { ...request, photoIds: [photoId] }),
    ).rejects.toThrow("PHOTO_NOT_AVAILABLE");
    await expect(
      as.mutation(api.households.book, {
        ...request,
        photoIds: [photoId, photoId],
      }),
    ).rejects.toThrow("INVALID_PHOTOS");
    await expect(
      as.mutation(api.households.book, {
        ...request,
        photoIds: Array.from({ length: 6 }, () => photoId),
      }),
    ).rejects.toThrow("INVALID_PHOTOS");
  });
  it("rejects untrusted types and oversized uploads before storage, and expires only unattached photos", async () => {
    const t = await demoWorld();
    const as = await newHousehold(t);
    await expect(
      as.action(api.householdPhotos.upload, {
        name: "fake.jpg",
        bytes: new TextEncoder().encode("<svg/>").buffer,
      }),
    ).rejects.toThrow("PHOTO_TYPE");
    await expect(
      as.action(api.householdPhotos.upload, {
        name: "big.jpg",
        bytes: new Uint8Array(2 * 1024 * 1024 + 1).buffer,
      }),
    ).rejects.toThrow("PHOTO_SIZE");
    const photoId = await as.action(api.householdPhotos.upload, {
      name: "scrap.jpg",
      bytes: imageBytes(),
    });
    await t.run((ctx) =>
      ctx.db.patch("householdPhotos", photoId, {
        createdAt: Date.now() - 25 * 60 * 60 * 1000,
      }),
    );
    await t.mutation(internal.householdPhotos.expire, { photoId });
    expect(
      await t.run((ctx) => ctx.db.get("householdPhotos", photoId)),
    ).toBeNull();
  });
});

it("limits photo upload reservations atomically per phone profile", async () => {
  const t = await demoWorld();
  const as = await newHousehold(t);
  for (let index = 0; index < 20; index++) {
    await as.mutation(internal.householdPhotos.reserve, {
      name: "scrap.jpg",
      contentType: "image/jpeg",
      size: 10,
    });
  }
  await expect(
    as.action(api.householdPhotos.upload, {
      name: "scrap.jpg",
      bytes: new Uint8Array([0xff, 0xd8, 0xff]).buffer,
    }),
  ).rejects.toThrow("PHOTO_UPLOAD_LIMIT");
  expect(
    await t.run((ctx) => ctx.db.query("householdPhotos").collect()),
  ).toHaveLength(20);
});

it.each([false, true])(
  "requires the administrator's second factor to read photos (%s)",
  async (twoFactorEnabled) => {
    const t = await demoWorld();
    vi.stubEnv("ADMIN_EMAIL", "photo-admin@example.test");
    const as = await newHousehold(t);
    const photoId = await as.action(api.householdPhotos.upload, {
      name: "scrap.jpg",
      bytes: imageBytes(),
    });
    const admin = await signIn(t, {
      email: "photo-admin@example.test",
      twoFactorEnabled,
    });
    const read = admin.action(api.householdPhotos.read, { photoId });
    if (twoFactorEnabled)
      await expect(read).resolves.toMatchObject({ contentType: "image/jpeg" });
    else await expect(read).rejects.toThrow("TWO_FACTOR_REQUIRED");
  },
);

describe("private collection invitations and receipts", () => {
  it("binds helper access to a verified account, redacts money, and honors leave, revoke, expiry and completion", async () => {
    const t = await demoWorld();
    const owner = await signInAs(t, PRIYA);
    const helper = await newHousehold(t, "+919876500051");
    const stranger = await newHousehold(t, "+919876500052");
    const token = "priyademo1";
    const id = await owner.mutation(api.householdReceipts.invite, {
      token,
      phone: "9876500051",
      adultConfirmed: true,
    });
    expect(
      await owner.mutation(api.householdReceipts.invite, {
        token,
        phone: "+919876500051",
        adultConfirmed: true,
      }),
    ).toBe(id);
    expect(await helper.query(api.households.track, { token })).toBeNull();
    await expect(
      stranger.mutation(api.householdReceipts.acceptInvitation, {
        token,
        adultConfirmed: true,
      }),
    ).rejects.toThrow("INVITATION_UNAVAILABLE");
    await expect(
      helper.mutation(api.householdReceipts.acceptInvitation, {
        token,
        adultConfirmed: false,
      }),
    ).rejects.toThrow("INVITATION_UNAVAILABLE");
    await helper.mutation(api.householdReceipts.acceptInvitation, {
      token,
      adultConfirmed: true,
    });
    await helper.mutation(api.householdReceipts.acceptInvitation, {
      token,
      adultConfirmed: true,
    });
    expect(await helper.query(api.households.track, { token })).toMatchObject({
      isMine: false,
      canCancel: false,
    });
    const view = await helper.query(api.households.track, { token });
    expect(view?.estimatePaise).toBeUndefined();
    expect(view?.receipt).toBeUndefined();
    expect(view?.points).toBeUndefined();
    await expect(
      helper.mutation(api.households.cancel, { token }),
    ).rejects.toThrow("NOT_YOURS");
    await helper.mutation(api.householdReceipts.handover, {
      token,
      note: "Bags handed to the assigned collector.",
    });
    await helper.mutation(api.householdReceipts.handover, {
      token,
      note: "Bags handed to the assigned collector.",
    });
    await expect(
      helper.mutation(api.householdReceipts.handover, {
        token,
        note: "Different note",
      }),
    ).rejects.toThrow("HANDOVER_ALREADY_RECORDED");
    await helper.mutation(api.householdReceipts.endInvitation, {
      invitationId: id,
    });
    expect(await helper.query(api.households.track, { token })).toBeNull();
    const next = await owner.mutation(api.householdReceipts.invite, {
      token,
      phone: "9876500051",
      adultConfirmed: true,
    });
    await helper.mutation(api.householdReceipts.acceptInvitation, {
      token,
      adultConfirmed: true,
    });
    await owner.mutation(api.householdReceipts.endInvitation, {
      invitationId: next,
    });
    expect(await helper.query(api.households.track, { token })).toBeNull();
    const expiring = await owner.mutation(api.householdReceipts.invite, {
      token,
      phone: "9876500051",
      adultConfirmed: true,
    });
    await helper.mutation(api.householdReceipts.acceptInvitation, {
      token,
      adultConfirmed: true,
    });
    await t.run((ctx) =>
      ctx.db.patch("collectionInvitations", expiring, {
        expiresAt: Date.now() - 1,
      }),
    );
    expect(await helper.query(api.households.track, { token })).toBeNull();
    const final = await owner.mutation(api.householdReceipts.invite, {
      token,
      phone: "9876500051",
      adultConfirmed: true,
    });
    await helper.mutation(api.householdReceipts.acceptInvitation, {
      token,
      adultConfirmed: true,
    });
    const booking = await bookingByToken(t, token);
    if (!booking) throw new Error("Missing booking");
    await t.run((ctx) =>
      ctx.db.patch("bookings", booking._id, { status: "completed" }),
    );
    expect(await helper.query(api.households.track, { token })).toBeNull();
    await expect(
      helper.mutation(api.householdReceipts.handover, { token, note: "Late" }),
    ).rejects.toThrow("INVALID_HANDOVER");
    const finalGrants = await owner.query(api.householdReceipts.sharing, {
      token,
    });
    expect(finalGrants.find((g) => g.id === final)?.active).toBe(false);
    const audit = await t.run((ctx) => ctx.db.query("auditLog").take(200));
    expect(JSON.stringify(audit)).not.toContain("Bags handed");
    expect(JSON.stringify(audit)).not.toContain("9876500051");
  });

  it("requires owner acceptance before payment acknowledgement and keeps repeated calls idempotent", async () => {
    const t = await demoWorld();
    const owner = await signInAs(t, PRIYA);
    const other = await newHousehold(t);
    const token = "priyademo2";
    const before = await bookingByToken(t, token);
    const receiptVersion = before?.receipt?.paidAt;
    if (receiptVersion === undefined) throw new Error("Missing receipt");
    await expect(
      owner.mutation(api.householdReceipts.acknowledgePayment, {
        token,
        receiptVersion,
      }),
    ).rejects.toThrow("ACCEPT_RECEIPT_FIRST");
    await expect(
      other.mutation(api.householdReceipts.review, {
        token,
        receiptVersion,
        decision: "accepted",
        rejectedLineIndexes: [],
      }),
    ).rejects.toThrow("NOT_YOURS");
    await expect(
      owner.mutation(api.householdReceipts.review, {
        token,
        receiptVersion: receiptVersion + 1,
        decision: "accepted",
        rejectedLineIndexes: [],
      }),
    ).rejects.toThrow("RECEIPT_CHANGED");
    const decision = {
      token,
      receiptVersion,
      decision: "accepted" as const,
      rejectedLineIndexes: [],
    };
    await owner.mutation(api.householdReceipts.review, decision);
    await owner.mutation(api.householdReceipts.review, decision);
    await owner.mutation(api.householdReceipts.acknowledgePayment, {
      token,
      receiptVersion,
    });
    await owner.mutation(api.householdReceipts.acknowledgePayment, {
      token,
      receiptVersion,
    });
    const after = await bookingByToken(t, token);
    expect(after?.receiptReview?.paymentAcknowledgedAt).toBeGreaterThan(0);
    expect(after?.receipt).toEqual(before?.receipt);
    expect(
      await t.run((ctx) => ctx.db.query("householdReceiptEvents").take(10)),
    ).toHaveLength(2);
  });

  it("holds disputed receipts, retains rejected lines and sends one private support request without rewriting stock", async () => {
    const t = await demoWorld();
    const owner = await signInAs(t, PRIYA);
    const token = "priyademo2";
    const before = await bookingByToken(t, token);
    const receipt = before?.receipt;
    if (!receipt) throw new Error("Missing receipt");
    const stockBefore = await t.run((ctx) =>
      ctx.db.query("inventory").take(200),
    );
    const args = {
      token,
      receiptVersion: receipt.paidAt,
      decision: "disputed" as const,
      rejectedLineIndexes: [0],
      note: "The first weight is incorrect.",
    };
    await owner.mutation(api.householdReceipts.review, args);
    await owner.mutation(api.householdReceipts.review, args);
    const after = await bookingByToken(t, token);
    expect(after?.receipt).toEqual(receipt);
    expect(after?.receiptReview?.acceptedGrams).toBe(
      receipt.lines.slice(1).reduce((sum, l) => sum + l.grams, 0),
    );
    expect(after?.receiptReview?.acceptedPaise).toBe(
      receipt.lines.slice(1).reduce((sum, l) => sum + l.paise, 0),
    );
    expect(after?.receiptReview?.decision).toBe("disputed");
    await expect(
      owner.mutation(api.householdReceipts.acknowledgePayment, {
        token,
        receiptVersion: receipt.paidAt,
      }),
    ).rejects.toThrow("ACCEPT_RECEIPT_FIRST");
    await expect(
      owner.mutation(api.householdReceipts.review, {
        ...args,
        decision: "accepted",
        rejectedLineIndexes: [],
      }),
    ).rejects.toThrow("RECEIPT_REVIEW_HELD");
    expect(await t.run((ctx) => ctx.db.query("inventory").take(200))).toEqual(
      stockBefore,
    );
    expect(
      await t.run((ctx) => ctx.db.query("householdReceiptEvents").take(10)),
    ).toHaveLength(1);
    const support = await t.run((ctx) =>
      ctx.db.query("supportRequests").take(10),
    );
    expect(
      support.filter((row) =>
        row.message.includes("The first weight is incorrect."),
      ),
    ).toHaveLength(1);
    const paymentCase = support.find((row) =>
      row.message.includes("The first weight is incorrect."),
    );
    expect(paymentCase).toMatchObject({
      source: { kind: "booking", id: before._id },
      team: "accounts",
      escalatedAt: expect.any(Number),
    });
    expect(
      support.find((row) =>
        row.message.includes("The first weight is incorrect."),
      )?.status,
    ).toBe("open");
  });
});

it("does not present expired offers or reference prices as a current household estimate", async () => {
  const t = await demoWorld();
  const id = await orgId(t, "ramesh-kabadi-store");
  await t.run(async (ctx) => {
    const rates = await ctx.db
      .query("rateCards")
      .withIndex("by_org_material", (q) => q.eq("orgId", id))
      .take(50);
    for (const row of rates)
      await ctx.db.patch("rateCards", row._id, { expiresAt: Date.now() - 1 });
    const references = await ctx.db
      .query("referencePrices")
      .withIndex("by_city_material", (q) => q.eq("city", "Bengaluru"))
      .take(100);
    for (const row of references)
      await ctx.db.patch("referencePrices", row._id, {
        expiresAt: Date.now() - 1,
      });
  });
  const rows = await t.query(api.households.shops, { items: basket });
  expect(rows.find((row) => row.id === id)?.estimatePaise).toBeUndefined();
});
