import { ConvexError, v } from "convex/values";

import { components, internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import {
  internalAction,
  internalMutation,
  type MutationCtx,
} from "./_generated/server";
import { CATALOGUE, catalogueEntry } from "./lib/catalogue";
import {
  bookingToken,
  kgToGrams,
  paiseFor,
  pointsFor,
  type TradeStatus,
} from "./lib/chain";
import { shiftDate } from "./lib/dates";
import {
  DEMO_ACCOUNTS,
  DEMO_BOOKINGS,
  DEMO_CITY,
  DEMO_JOBS,
  DEMO_LISTINGS,
  DEMO_ORGS,
  DEMO_TRADES,
  type DemoOrg,
  type DemoRole,
} from "./lib/demo";
import { demoPdf, demoPicture } from "./lib/demoFiles";
import { indiaToday, MATERIAL_FAMILIES } from "./lib/onboarding";
import { phoneEmail } from "./lib/phone";

/**
 * The demo world: `npx convex run demo:seed` fills an empty dev deployment,
 * `npx convex run demo:reset` wipes the prototype's data and seeds again.
 * Both refuse to run unless AUTH_DEV_MODE=true, so production is never
 * touched. Sign-ins and profiles survive a reset.
 */

function assertDemoAllowed() {
  if (process.env.AUTH_DEV_MODE !== "true") {
    throw new ConvexError("DEMO_ONLY_ON_DEV");
  }
}

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

/** The price a demo business asks, rounded to 50 paise. */
function priceAt(code: string, factor: number): number {
  const entry = catalogueEntry(code);
  if (!entry) throw new ConvexError(`UNKNOWN_MATERIAL_${code}`);
  return Math.round((entry.fallbackPaise * factor) / 50) * 50;
}

const TRADE_STEPS: readonly TradeStatus[] = [
  "requested",
  "accepted",
  "paid_to_escrow",
  "dispatched",
  "completed",
];

// --- Seed -------------------------------------------------------------------

export const seed = internalAction({
  args: {},
  returns: v.object({ seeded: v.boolean() }),
  handler: async (ctx): Promise<{ seeded: boolean }> => {
    assertDemoAllowed();
    const store = async (content: string, type: string) =>
      ctx.storage.store(new Blob([content], { type }));
    const files = {
      certificate: await store(
        demoPdf("KSPCB Consent to Operate - DEMO", [
          "Irfan Metal & Plastic Yard, Hegde Nagar, Bengaluru",
          "Consent number: KSPCB/CFO/2025/4410",
          "Valid until: 31 March 2028",
          "This is a sample document for the Luma.Green prototype.",
        ]),
        "application/pdf",
      ),
      photoA: await store(
        demoPicture("Baling press", "machine"),
        "image/svg+xml",
      ),
      photoB: await store(
        demoPicture("Sorting floor and bales", "yard"),
        "image/svg+xml",
      ),
    };
    return ctx.runMutation(internal.demo.seedData, { files });
  },
});

export const reset = internalAction({
  args: {},
  returns: v.object({ seeded: v.boolean() }),
  handler: async (ctx): Promise<{ seeded: boolean }> => {
    assertDemoAllowed();
    const storageIds: Id<"_storage">[] = await ctx.runMutation(
      internal.demo.clearData,
      {},
    );
    for (const storageId of storageIds) await ctx.storage.delete(storageId);
    return ctx.runAction(internal.demo.seed, {});
  },
});

/** Deletes the prototype's data; returns the demo files to delete. */
export const clearData = internalMutation({
  args: {},
  returns: v.array(v.id("_storage")),
  handler: async (ctx) => {
    assertDemoAllowed();
    const tables = [
      "materials",
      "referencePrices",
      "marketPrices",
      "rateCards",
      "orgs",
      "memberships",
      "saathiProfiles",
      "bookings",
      "inventory",
      "inventoryMovements",
      "listings",
      "trades",
      "jobs",
      "supportRequests",
    ] as const;
    for (const table of tables) {
      const rows = await ctx.db.query(table).collect();
      for (const row of rows) await ctx.db.delete(table, row._id);
    }

    // Applications of the demo logins go too; their files are returned.
    const storageIds: Id<"_storage">[] = [];
    for (const account of DEMO_ACCOUNTS) {
      const profile = await ctx.db
        .query("profiles")
        .withIndex("by_phone", (q) => q.eq("phone", account.phone))
        .first();
      if (!profile) continue;
      const applications = await ctx.db
        .query("applications")
        .withIndex("by_profile", (q) => q.eq("profileId", profile._id))
        .collect();
      for (const application of applications) {
        const files = await ctx.db
          .query("applicationFiles")
          .withIndex("by_application", (q) =>
            q.eq("applicationId", application._id),
          )
          .collect();
        for (const file of files) {
          storageIds.push(file.storageId);
          await ctx.db.delete("applicationFiles", file._id);
        }
        const snapshots = await ctx.db
          .query("applicationSnapshots")
          .withIndex("by_application_version", (q) =>
            q.eq("applicationId", application._id),
          )
          .collect();
        for (const snapshot of snapshots) {
          await ctx.db.delete("applicationSnapshots", snapshot._id);
        }
        await ctx.db.delete("applications", application._id);
      }
    }
    return storageIds;
  },
});

export const seedData = internalMutation({
  args: {
    files: v.object({
      certificate: v.id("_storage"),
      photoA: v.id("_storage"),
      photoB: v.id("_storage"),
    }),
  },
  returns: v.object({ seeded: v.boolean() }),
  handler: async (ctx, args) => {
    assertDemoAllowed();
    const already = await ctx.db
      .query("orgs")
      .withIndex("by_slug", (q) => q.eq("slug", "ramesh-kabadi-store"))
      .first();
    if (already) return { seeded: false };

    const now = Date.now();
    const today = indiaToday(now);
    await seedCatalogue(ctx, today, now);
    const profiles = await seedAccounts(ctx, now);
    const orgs = await seedOrgs(ctx, profiles, now);
    await seedSaathi(ctx, profiles, now);
    await seedMarket(ctx, orgs, now);
    await seedBookings(ctx, orgs, profiles, today, now);
    await seedJobs(ctx, orgs, profiles, today, now);
    await seedApplicants(ctx, profiles, args.files, now);
    await seedSupport(ctx, now);
    return { seeded: true };
  },
});

// --- Parts of the seed ------------------------------------------------------

async function seedCatalogue(ctx: MutationCtx, today: string, now: number) {
  for (const [index, entry] of CATALOGUE.entries()) {
    await ctx.db.insert("materials", {
      code: entry.code,
      family: entry.family,
      stage: entry.stage,
      names: entry.names,
      co2eFactor: entry.co2eFactor,
      sortOrder: index,
      active: true,
    });
    await ctx.db.insert("referencePrices", {
      city: DEMO_CITY,
      materialCode: entry.code,
      floorPaise: entry.floorPaise,
      fallbackPaise: entry.fallbackPaise,
      updatedAt: now,
    });
    // 30 days of price history with a gentle, repeatable wobble.
    for (let day = -29; day <= 0; day += 1) {
      const wobble =
        0.06 * Math.sin(day / 4 + index) +
        0.025 * Math.cos(day / 2 + index * 1.7);
      await ctx.db.insert("marketPrices", {
        city: DEMO_CITY,
        materialCode: entry.code,
        date: shiftDate(today, day),
        sourceLabel: "Synthetic demo reference — not a live market benchmark",
        observedAt: now + day * 86_400_000,
        paisePerKg: Math.round((entry.fallbackPaise * (1 + wobble)) / 50) * 50,
      });
    }
  }
}

/** The Better Auth user and profile for every demo phone. */
async function seedAccounts(
  ctx: MutationCtx,
  now: number,
): Promise<
  Map<DemoRole, { profileId: Id<"profiles">; name: string; phone: string }>
> {
  const profiles = new Map<
    DemoRole,
    { profileId: Id<"profiles">; name: string; phone: string }
  >();
  for (const account of DEMO_ACCOUNTS) {
    let user = (await ctx.runQuery(components.betterAuth.adapter.findOne, {
      model: "user",
      where: [{ field: "phoneNumber", value: account.phone }],
    })) as { _id: string } | null;
    user ??= (await ctx.runMutation(components.betterAuth.adapter.create, {
      input: {
        model: "user",
        data: {
          name: account.name,
          email: phoneEmail(account.phone),
          emailVerified: false,
          phoneNumber: account.phone,
          phoneNumberVerified: true,
          createdAt: now,
          updatedAt: now,
        },
      },
    })) as { _id: string };

    const existing = await ctx.db
      .query("profiles")
      .withIndex("by_authUserId", (q) => q.eq("authUserId", user._id))
      .unique();
    const profileId =
      existing?._id ??
      (await ctx.db.insert("profiles", {
        authUserId: user._id,
        phone: account.phone,
        kind: "member",
        locale: "en",
        createdAt: now,
        updatedAt: now,
      }));
    profiles.set(account.role, {
      profileId,
      name: account.name,
      phone: account.phone,
    });
  }
  return profiles;
}

type OrgIds = Map<string, Id<"orgs">>;

async function seedOrgs(
  ctx: MutationCtx,
  profiles: Awaited<ReturnType<typeof seedAccounts>>,
  now: number,
): Promise<OrgIds> {
  const orgs: OrgIds = new Map();
  for (const org of DEMO_ORGS) {
    const owner = org.ownerRole ? profiles.get(org.ownerRole) : undefined;
    const orgId = await seedOrg(ctx, org, owner, now);
    orgs.set(org.slug, orgId);
    const actor = owner ?? profiles.values().next().value;
    if (!actor) throw new ConvexError("DEMO_PROFILE_REQUIRED");
    await seedStock(ctx, orgId, actor.profileId, org.stock, now);
    if (org.kind === "kabadiwala") await seedRateCard(ctx, orgId, org, now);
  }
  return orgs;
}

async function seedOrg(
  ctx: MutationCtx,
  org: DemoOrg,
  owner: { profileId: Id<"profiles">; name: string } | undefined,
  now: number,
): Promise<Id<"orgs">> {
  const applicationId = owner
    ? await approvedApplication(ctx, owner, org, now)
    : undefined;
  const orgId = await ctx.db.insert("orgs", {
    kind: org.kind,
    name: org.name,
    slug: org.slug,
    status: "active",
    ownerProfileId: owner?.profileId,
    applicationId,
    city: DEMO_CITY,
    area: org.area,
    address: `${org.address}, ${DEMO_CITY}`,
    location: org.location,
    phones: [],
    hours:
      org.kind === "kabadiwala"
        ? { opens: "08:00", closes: "20:00" }
        : { opens: "09:00", closes: "18:00" },
    weeklyOff: ["sun"],
    gstin: org.gstin,
    families: org.families,
    offersPickup: org.offersPickup,
    vehicle: org.vehicle,
    consent: org.consent,
    createdAt: now - 20 * DAY,
    updatedAt: now,
  });
  if (owner) {
    await ctx.db.insert("memberships", {
      profileId: owner.profileId,
      orgId,
      role: "owner",
      createdAt: now,
    });
  }
  return orgId;
}

async function seedStock(
  ctx: MutationCtx,
  orgId: Id<"orgs">,
  actorProfileId: Id<"profiles">,
  stock: Record<string, number>,
  now: number,
) {
  for (const [code, kg] of Object.entries(stock)) {
    await ctx.db.insert("inventory", {
      orgId,
      materialCode: code,
      grams: kgToGrams(kg),
      costPaise: null,
      updatedAt: now,
    });
    await ctx.db.insert("inventoryMovements", {
      orgId,
      actorProfileId,
      materialCode: code,
      deltaGrams: kgToGrams(kg),
      costDeltaPaise: null,
      sourceKey: `demo:${orgId}:${code}`,
      createdAt: now,
    });
  }
}

/** A kabadiwala's household prices: every scrap material they handle. */
async function seedRateCard(
  ctx: MutationCtx,
  orgId: Id<"orgs">,
  org: DemoOrg,
  now: number,
) {
  const handled = CATALOGUE.filter(
    (entry) => entry.stage === "scrap" && org.families.includes(entry.family),
  );
  for (const entry of handled) {
    await ctx.db.insert("rateCards", {
      orgId,
      materialCode: entry.code,
      paisePerKg: Math.max(
        entry.floorPaise,
        priceAt(entry.code, org.priceFactor ?? 1),
      ),
      updatedAt: now,
    });
  }
}

/** An application the admin has already approved, for a demo business. */
async function approvedApplication(
  ctx: MutationCtx,
  owner: { profileId: Id<"profiles">; name: string },
  org: DemoOrg,
  now: number,
): Promise<Id<"applications">> {
  const families = org.families.filter(
    (family): family is (typeof MATERIAL_FAMILIES)[number] =>
      (MATERIAL_FAMILIES as readonly string[]).includes(family),
  );
  const base = {
    profileId: owner.profileId,
    status: "approved" as const,
    version: 1,
    locale: "en",
    ageConfirmedAt: now - 21 * DAY,
    privacyAcceptedAt: now - 21 * DAY,
    submittedAt: now - 21 * DAY,
    decidedAt: now - 20 * DAY,
    createdAt: now - 21 * DAY,
    updatedAt: now - 20 * DAY,
  };
  if (org.kind === "kabadiwala") {
    return ctx.db.insert("applications", {
      ...base,
      kind: "kabadiwala",
      kabadiwala: {
        city: DEMO_CITY,
        ownerName: owner.name,
        shopName: org.name,
        gstRegistered: false,
        address: org.address,
        location: org.location,
        offersPickup: org.offersPickup,
        vehicle: org.vehicle,
        phones: [],
        opens: "08:00",
        closes: "20:00",
        weeklyOff: ["sun"],
      },
    });
  }
  return ctx.db.insert("applications", {
    ...base,
    kind: org.kind,
    business: {
      city: DEMO_CITY,
      businessName: org.name,
      gstRegistered: true,
      gstin: org.gstin,
      materials: families,
      address: org.address,
      location: org.location,
      locationTags: [org.area],
      collectsFromSuppliers: org.offersPickup,
      phones: [],
      opens: "09:00",
      closes: "18:00",
      weeklyOff: ["sun"],
    },
    documents: {
      pcbNotRequired: false,
      board: "kspcb",
      consentNumber: org.consent?.number,
      validUntil: org.consent?.validUntil,
      declaration: true,
    },
  });
}

async function seedSaathi(
  ctx: MutationCtx,
  profiles: Awaited<ReturnType<typeof seedAccounts>>,
  now: number,
) {
  const saathi = profiles.get("saathi");
  if (!saathi) return;
  const section = {
    name: saathi.name,
    city: DEMO_CITY,
    area: "Yeshwanthpur",
    radiusKm: 5 as const,
    workTypes: ["home_pickups" as const, "yard_sorting" as const],
    vehicle: "cycle" as const,
    times: ["morning" as const, "evening" as const],
    days: [
      "mon" as const,
      "tue" as const,
      "wed" as const,
      "thu" as const,
      "fri" as const,
      "sat" as const,
    ],
  };
  const applicationId = await ctx.db.insert("applications", {
    profileId: saathi.profileId,
    kind: "saathi",
    status: "approved",
    version: 1,
    locale: "en",
    ageConfirmedAt: now - 15 * DAY,
    privacyAcceptedAt: now - 15 * DAY,
    saathi: section,
    submittedAt: now - 15 * DAY,
    decidedAt: now - 14 * DAY,
    createdAt: now - 15 * DAY,
    updatedAt: now - 14 * DAY,
  });
  await ctx.db.insert("saathiProfiles", {
    profileId: saathi.profileId,
    applicationId,
    name: section.name,
    city: DEMO_CITY,
    area: section.area,
    radiusKm: section.radiusKm,
    workTypes: section.workTypes,
    vehicle: section.vehicle,
    times: section.times,
    days: section.days,
    status: "active",
    createdAt: now - 14 * DAY,
  });
}

async function seedMarket(ctx: MutationCtx, orgs: OrgIds, now: number) {
  const kindOf = new Map(DEMO_ORGS.map((org) => [org.slug, org.kind]));
  const listingFor = new Map<string, Id<"listings">>();
  for (const listing of DEMO_LISTINGS) {
    const orgId = orgs.get(listing.seller);
    const sellerKind = kindOf.get(listing.seller);
    if (!orgId || !sellerKind) continue;
    const listingId = await ctx.db.insert("listings", {
      orgId,
      sellerKind,
      materialCode: listing.materialCode,
      grams: kgToGrams(listing.kg),
      askPaisePerKg: priceAt(listing.materialCode, listing.factor),
      city: DEMO_CITY,
      note: listing.note,
      status: "open",
      expiresAt: now + 30 * DAY, // Explicit synthetic contract validity.
      createdAt: now - 2 * DAY,
      updatedAt: now - 2 * DAY,
    });
    listingFor.set(`${listing.seller}:${listing.materialCode}`, listingId);
  }

  for (const [index, trade] of DEMO_TRADES.entries()) {
    const sellerOrgId = orgs.get(trade.seller);
    const buyerOrgId = orgs.get(trade.buyer);
    const sellerKind = kindOf.get(trade.seller);
    if (!sellerOrgId || !buyerOrgId || !sellerKind) continue;
    const paisePerKg = priceAt(trade.materialCode, trade.factor);
    const grams = kgToGrams(trade.kg);
    const created = now - trade.daysAgo * DAY - 6 * HOUR;
    // A request still waits on the seller, so its lot stays open with the
    // kilos on offer; later steps have already taken them off the lot.
    const isWaiting = trade.status === "requested";
    const listingId =
      listingFor.get(`${trade.seller}:${trade.materialCode}`) ??
      (await ctx.db.insert("listings", {
        orgId: sellerOrgId,
        sellerKind,
        materialCode: trade.materialCode,
        grams: isWaiting ? grams : 0,
        askPaisePerKg: paisePerKg,
        city: DEMO_CITY,
        status: isWaiting ? "open" : "sold",
        ...(isWaiting && { expiresAt: now + 30 * DAY }),
        createdAt: created,
        updatedAt: created,
      }));
    const steps = TRADE_STEPS.slice(0, TRADE_STEPS.indexOf(trade.status) + 1);
    await ctx.db.insert("trades", {
      listingId,
      sellerOrgId,
      buyerOrgId,
      materialCode: trade.materialCode,
      grams,
      paisePerKg,
      totalPaise: paiseFor(grams, paisePerKg),
      status: trade.status,
      timeline: steps.map((status, step) => ({
        status,
        at: created + step * 3 * HOUR,
      })),
      invoiceNo:
        trade.status === "requested" || trade.status === "accepted"
          ? undefined
          : `LG-26-${String(index + 1).padStart(4, "0")}`,
      createdAt: created,
      updatedAt: created + (steps.length - 1) * 3 * HOUR,
    });
  }
}

const BOOKING_STEPS = [
  "requested",
  "accepted",
  "on_the_way",
  "completed",
] as const;

/** A completed pickup's receipt: weights a little under the estimate. */
function demoReceipt(
  items: readonly { materialCode: string; kg: number }[],
  priceOf: (code: string) => number,
) {
  const lines = items.map((item) => {
    const grams = Math.round(kgToGrams(item.kg) * 0.97);
    const paisePerKg = priceOf(item.materialCode);
    return {
      materialCode: item.materialCode,
      grams,
      paisePerKg,
      paise: paiseFor(grams, paisePerKg),
    };
  });
  return {
    lines,
    totalPaise: lines.reduce((sum, line) => sum + line.paise, 0),
  };
}

async function seedBookings(
  ctx: MutationCtx,
  orgs: OrgIds,
  profiles: Awaited<ReturnType<typeof seedAccounts>>,
  today: string,
  now: number,
) {
  const orgId = orgs.get("ramesh-kabadi-store");
  if (!orgId) return;
  const rateRows = await ctx.db
    .query("rateCards")
    .withIndex("by_org_material", (q) => q.eq("orgId", orgId))
    .collect();
  const rates = new Map(
    rateRows.map((rate) => [rate.materialCode, rate.paisePerKg]),
  );
  const priceOf = (code: string) => rates.get(code) ?? priceAt(code, 1);
  const household = profiles.get("household");
  let demoTokens = 0;

  for (const [index, booking] of DEMO_BOOKINGS.entries()) {
    const estimatePaise = booking.items.reduce(
      (sum, item) =>
        sum + paiseFor(kgToGrams(item.kg), priceOf(item.materialCode)),
      0,
    );
    const created = now + Math.min(booking.day, 0) * DAY - (index + 2) * HOUR;
    const steps = BOOKING_STEPS.slice(
      0,
      BOOKING_STEPS.indexOf(booking.status) + 1,
    );
    const isHousehold = household?.phone === booking.phone;
    const receipt =
      booking.status === "completed"
        ? demoReceipt(booking.items, priceOf)
        : undefined;
    // The demo household's pickups get fixed, easy-to-type tracking links.
    if (isHousehold) demoTokens += 1;
    const token = isHousehold
      ? `priyademo${String(demoTokens)}`
      : bookingToken(Math.random);

    await ctx.db.insert("bookings", {
      token,
      householdProfileId: isHousehold ? household.profileId : undefined,
      phone: booking.phone,
      name: booking.name,
      mode: "pickup",
      items: booking.items.map((item) => ({
        materialCode: item.materialCode,
        estKg: item.kg,
      })),
      estimatePaise,
      orgId,
      slotDate: shiftDate(today, booking.day),
      slotWindow: booking.window,
      address: `${booking.address}, ${DEMO_CITY}`,
      status: booking.status,
      timeline: steps.map((status, step) => ({
        status,
        at: created + step * HOUR,
      })),
      receipt: receipt && {
        ...receipt,
        method: index % 2 === 0 ? "upi" : "cash",
        paidAt: created + steps.length * HOUR,
      },
      points: receipt && pointsFor(receipt.totalPaise),
      createdAt: created,
      updatedAt: created + (steps.length - 1) * HOUR,
    });
  }
}

async function seedJobs(
  ctx: MutationCtx,
  orgs: OrgIds,
  profiles: Awaited<ReturnType<typeof seedAccounts>>,
  today: string,
  now: number,
) {
  const saathi = profiles.get("saathi");
  const saathiProfile = saathi
    ? await ctx.db
        .query("saathiProfiles")
        .withIndex("by_profile", (q) => q.eq("profileId", saathi.profileId))
        .unique()
    : null;
  for (const job of DEMO_JOBS) {
    await ctx.db.insert("jobs", {
      orgId: job.poster ? orgs.get(job.poster) : undefined,
      city: job.poster ? DEMO_CITY : undefined,
      kind: job.kind,
      title: job.title,
      area: job.area,
      date: shiftDate(today, job.day),
      window: job.window,
      payPaise: job.payRupees * 100,
      status: job.status,
      saathiProfileId: job.status === "open" ? undefined : saathiProfile?._id,
      createdAt: now - DAY,
    });
  }
}

/** Two applications waiting for the admin, one due soon. */
async function seedApplicants(
  ctx: MutationCtx,
  profiles: Awaited<ReturnType<typeof seedAccounts>>,
  files: DemoFiles,
  now: number,
) {
  await seedYardApplicant(ctx, profiles.get("applicant-yard"), files, now);
  await seedShopApplicant(ctx, profiles.get("applicant-kabadiwala"), now);
}

interface DemoFiles {
  certificate: Id<"_storage">;
  photoA: Id<"_storage">;
  photoB: Id<"_storage">;
}

async function seedYardApplicant(
  ctx: MutationCtx,
  yard: { profileId: Id<"profiles">; name: string } | undefined,
  files: DemoFiles,
  now: number,
) {
  if (!yard) return;
  const submittedAt = now - 19 * HOUR;
  const business = {
    city: DEMO_CITY,
    businessName: "Irfan Metal & Plastic Yard",
    gstRegistered: true,
    gstin: "29AAIFI3344R1Z1",
    materials: ["metal" as const, "plastic" as const],
    address: "Survey 42, Hegde Nagar, Bengaluru",
    location: { lat: 13.0708, lng: 77.6293 },
    locationTags: ["Hegde Nagar", "Thanisandra"],
    collectsFromSuppliers: true,
    phones: [],
    opens: "09:00",
    closes: "19:00",
    weeklyOff: ["fri" as const],
  };
  const documents = {
    pcbNotRequired: false,
    board: "kspcb" as const,
    consentNumber: "KSPCB/CFO/2025/4410",
    validUntil: "2028-03-31",
    declaration: true,
  };
  const applicationId = await ctx.db.insert("applications", {
    profileId: yard.profileId,
    kind: "yard",
    status: "submitted",
    version: 1,
    locale: "en",
    ageConfirmedAt: submittedAt - HOUR,
    privacyAcceptedAt: submittedAt - HOUR,
    business,
    documents,
    submittedAt,
    createdAt: submittedAt - HOUR,
    updatedAt: submittedAt,
  });
  const fileIds: Id<"applicationFiles">[] = [];
  for (const [type, storageId, name, contentType] of [
    [
      "pcb_certificate",
      files.certificate,
      "KSPCB-consent.pdf",
      "application/pdf",
    ],
    ["machine_media", files.photoA, "baling-press.svg", "image/svg+xml"],
    ["machine_media", files.photoB, "sorting-floor.svg", "image/svg+xml"],
  ] as const) {
    const meta = await ctx.db.system.get("_storage", storageId);
    fileIds.push(
      await ctx.db.insert("applicationFiles", {
        applicationId,
        profileId: yard.profileId,
        type,
        storageId,
        name,
        contentType,
        size: meta?.size ?? 0,
        firstSubmittedVersion: 1,
        createdAt: submittedAt,
      }),
    );
  }
  await ctx.db.insert("applicationSnapshots", {
    applicationId,
    version: 1,
    business,
    documents,
    fileIds,
    submittedAt,
  });
}

async function seedShopApplicant(
  ctx: MutationCtx,
  shop: { profileId: Id<"profiles">; name: string } | undefined,
  now: number,
) {
  if (!shop) return;
  const submittedAt = now - 2 * HOUR;
  const kabadiwala = {
    city: DEMO_CITY,
    ownerName: shop.name,
    shopName: "Kavitha Raddi Shop",
    gstRegistered: false,
    address: "3rd Block, Rajajinagar, Bengaluru",
    location: { lat: 12.9915, lng: 77.5525 },
    offersPickup: false,
    phones: [{ number: "+919845000099", label: "Husband" }],
    opens: "09:00",
    closes: "19:30",
    weeklyOff: ["tue" as const],
  };
  const applicationId = await ctx.db.insert("applications", {
    profileId: shop.profileId,
    kind: "kabadiwala",
    status: "submitted",
    version: 1,
    locale: "kn",
    ageConfirmedAt: submittedAt - HOUR,
    privacyAcceptedAt: submittedAt - HOUR,
    kabadiwala,
    submittedAt,
    createdAt: submittedAt - HOUR,
    updatedAt: submittedAt,
  });
  await ctx.db.insert("applicationSnapshots", {
    applicationId,
    version: 1,
    kabadiwala,
    fileIds: [],
    submittedAt,
  });
}

async function seedSupport(ctx: MutationCtx, now: number) {
  await ctx.db.insert("supportRequests", {
    name: "Manjunath",
    phone: "+919845000021",
    role: "kabadiwala",
    topic: "prices",
    message: "How do I change my price for cardboard?",
    status: "open",
    createdAt: now - 5 * HOUR,
  });
  await ctx.db.insert("supportRequests", {
    name: "Sunita",
    phone: "+919845000022",
    role: "household",
    topic: "solar",
    message:
      "We have a 1,200 sq ft terrace in Jayanagar. Is rooftop solar worth it?",
    status: "open",
    createdAt: now - 26 * HOUR,
  });
}
