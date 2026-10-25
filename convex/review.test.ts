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
  signIn,
  signInAs,
} from "./lib/auth.testing";
import { CATALOGUE } from "./lib/catalogue";
import schema from "./schema";

const modules = convexModules(import.meta.glob("./**/*.*s"));

const ADMIN_EMAIL = "admin@luma.test";
const HOUR = 60 * 60 * 1000;
const YARD_APPLICANT = "+919000000107";
const SHOP_APPLICANT = "+919000000108";

const byCode = (a: string, b: string) => a.localeCompare(b);

afterEach(() => {
  vi.unstubAllEnvs();
});

function setup() {
  vi.stubEnv("ADMIN_EMAIL", ADMIN_EMAIL);
  const t = convexTest(schema, modules);
  registerAuth(t);
  return t;
}

type Test = ReturnType<typeof setup>;

/** The demo world: two applicants in review, the catalogue and its prices. */
async function demoWorld() {
  vi.stubEnv("AUTH_DEV_MODE", "true");
  const t = setup();
  await seedDemo(t);
  return t;
}

async function signInAdmin(t: Test, { twoFactorEnabled = true } = {}) {
  const admin = await signIn(t, { email: ADMIN_EMAIL, twoFactorEnabled });
  if (twoFactorEnabled) {
    await admin.mutation(api.identity.ensureProfile, { locale: "en" });
  }
  return admin;
}

async function applicationOf(t: Test, phone: string) {
  return t.run(async (ctx) => {
    const profile = await ctx.db
      .query("profiles")
      .withIndex("by_phone", (q) => q.eq("phone", phone))
      .first();
    if (!profile) throw new Error(`No profile for ${phone}`);
    const application = await ctx.db
      .query("applications")
      .withIndex("by_profile", (q) => q.eq("profileId", profile._id))
      .first();
    if (!application) throw new Error(`No application for ${phone}`);
    return application;
  });
}

/** A person with an application in the given state, straight into the db. */
async function insertApplication(
  t: Test,
  fields: Partial<Doc<"applications">> &
    Pick<Doc<"applications">, "kind" | "status">,
  phone = "+919812345678",
) {
  return t.run(async (ctx) => {
    const now = Date.now();
    const profileId = await ctx.db.insert("profiles", {
      authUserId: `user-${phone}`,
      phone,
      kind: "member",
      locale: "en",
      createdAt: now,
      updatedAt: now,
    });
    return ctx.db.insert("applications", {
      profileId,
      version: 1,
      locale: "en",
      ageConfirmedAt: now,
      privacyAcceptedAt: now,
      createdAt: now,
      updatedAt: now,
      ...fields,
    });
  });
}

const saathiSection = {
  name: "Geetha M",
  area: "Mathikere",
  radiusKm: 5 as const,
  workTypes: ["home_pickups" as const, "shop_help" as const],
  vehicle: "two_wheeler" as const,
  times: ["morning" as const],
  days: ["mon" as const, "wed" as const, "fri" as const],
};

describe("the queue", () => {
  it("lists applications in review oldest first, then those with the applicant", async () => {
    const t = await demoWorld();
    const now = Date.now();
    await insertApplication(
      t,
      {
        kind: "recycler",
        status: "submitted",
        submittedAt: now - 30 * HOUR,
        business: {
          businessName: "Old Town Recyclers",
          address: "Old Madras Road, KR Puram, Bengaluru",
        },
      },
      "+919812340001",
    );
    await insertApplication(
      t,
      {
        kind: "saathi",
        status: "changes_requested",
        submittedAt: now - 50 * HOUR,
        decidedAt: now - 3 * HOUR,
        note: "Your selfie is blurred. Please take it again.",
        saathi: saathiSection,
      },
      "+919812340002",
    );

    const admin = await signInAdmin(t);
    const queue = await admin.query(api.review.queue, {});
    expect(
      queue.map(({ name, status, sla, hoursWaiting }) => ({
        name,
        status,
        sla,
        hoursWaiting,
      })),
    ).toEqual([
      {
        name: "Old Town Recyclers",
        status: "submitted",
        sla: "overdue",
        hoursWaiting: 30,
      },
      {
        name: "Irfan Metal & Plastic Yard",
        status: "submitted",
        sla: "due_soon",
        hoursWaiting: 19,
      },
      {
        name: "Kavitha Raddi Shop",
        status: "submitted",
        sla: "ok",
        hoursWaiting: 2,
      },
      // With the applicant: the clock runs from the request for changes.
      {
        name: "Geetha M",
        status: "changes_requested",
        sla: "ok",
        hoursWaiting: 3,
      },
    ]);
    expect(queue[1]).toMatchObject({
      kind: "yard",
      phone: YARD_APPLICANT,
      area: "Hegde Nagar",
      fileCount: 3,
      version: 1,
    });
    expect(queue[2]).toMatchObject({
      kind: "kabadiwala",
      contactName: "Kavitha S",
      area: "Rajajinagar",
      fileCount: 0,
    });
  });

  it("counts an open support chat when no callback requests exist", async () => {
    const t = setup();
    const admin = await signInAdmin(t);
    const member = await signIn(t, { email: "support-member@luma.test" });
    await member.mutation(api.identity.ensureProfile, { locale: "en" });
    expect(await admin.query(api.review.summary, {})).toMatchObject({
      openSupport: 0,
    });

    const conversationId = await member.mutation(api.messaging.openSupport, {
      subject: "Collection help",
    });
    expect(await admin.query(api.review.summary, {})).toMatchObject({
      openSupport: 1,
    });

    await admin.mutation(api.messaging.setSupportStatus, {
      conversationId,
      status: "closed",
    });
    expect(await admin.query(api.review.summary, {})).toMatchObject({
      openSupport: 0,
    });
  });

  it("combines callback requests and open support chats without counting private trades", async () => {
    const t = await demoWorld();
    const admin = await signInAdmin(t);
    const member = await signInAs(t, SHOP_APPLICANT);
    await member.mutation(api.messaging.openSupport, {
      subject: "Application help",
    });
    await t.run(async (ctx) => {
      const trade = await ctx.db.query("trades").first();
      if (!trade) throw new Error("No seeded trade");
      await ctx.db.insert("conversations", {
        kind: "trade",
        status: "open",
        subject: trade.materialCode,
        tradeId: trade._id,
        sellerOrgId: trade.sellerOrgId,
        buyerOrgId: trade.buyerOrgId,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
    });
    expect(await admin.query(api.review.summary, {})).toMatchObject({
      openSupport: 3,
    });
  });

  it("keeps the combined support count within the existing 1000-record bound", async () => {
    const t = setup();
    const admin = await signInAdmin(t);
    await t.run(async (ctx) => {
      const now = Date.now();
      await ctx.db.insert("supportRequests", {
        name: "Support example",
        phone: "+919000000001",
        role: "household",
        topic: "pickup",
        message: "Call back about collection",
        status: "open",
        createdAt: now,
      });
      for (let index = 0; index < 1000; index += 1) {
        await ctx.db.insert("conversations", {
          kind: "support",
          status: "open",
          subject: `Support example ${String(index)}`,
          createdAt: now,
          updatedAt: now,
        });
      }
    });
    expect(await admin.query(api.review.summary, {})).toMatchObject({
      openSupport: 1000,
    });
  });

  it("counts what's waiting for the console home", async () => {
    const t = await demoWorld();
    await insertApplication(t, {
      kind: "manufacturer",
      status: "submitted",
      submittedAt: Date.now() - 25 * HOUR,
    });
    const admin = await signInAdmin(t);
    expect(await admin.query(api.review.summary, {})).toEqual({
      waiting: 3,
      dueSoon: 1,
      overdue: 1,
      withApplicant: 0,
      openSupport: 2,
    });
  });
});

describe("one application", () => {
  const shop = {
    ownerName: "Ramesh K",
    shopName: "Ramesh Raddi",
    gstRegistered: false,
    address: "12, 4th Cross, Mathikere, Bengaluru",
    offersPickup: false,
    phones: [],
    opens: "08:00",
    closes: "20:00",
    weeklyOff: [],
  };

  it("shows the form, the versions, what changed and the trail", async () => {
    const t = setup();
    const ramesh = await signIn(t, {
      email: "919000000001@phone.luma.green",
      phoneNumber: "+919000000001",
    });
    await ramesh.mutation(api.identity.ensureProfile, { locale: "kn" });
    const id = await ramesh.mutation(api.applications.start, {
      kind: "kabadiwala",
      locale: "kn",
      ageConfirmed: true,
      privacyAccepted: true,
    });
    await ramesh.mutation(api.applications.saveDraft, { kabadiwala: shop });
    // A historical application submitted before automatic activation remains reviewable.
    await t.run(async (ctx) => {
      await ctx.db.patch("applications", id, {
        status: "submitted",
        version: 1,
        submittedAt: Date.now(),
      });
      await ctx.db.insert("applicationSnapshots", {
        applicationId: id,
        version: 1,
        kabadiwala: shop,
        fileIds: [],
        submittedAt: Date.now(),
      });
      const historical = await ctx.db.get("applications", id);
      const profileId = historical?.profileId;
      await ctx.db.insert("auditLog", {
        action: "application.submitted",
        entityTable: "applications",
        entityId: id,
        actorProfileId: profileId,
        createdAt: Date.now(),
      });
    });

    const admin = await signInAdmin(t);
    const first = await admin.query(api.review.get, { applicationId: id });
    expect(first).toMatchObject({
      id,
      kind: "kabadiwala",
      status: "submitted",
      version: 1,
      locale: "kn",
      name: "Ramesh Raddi",
      phone: "+919000000001",
      kabadiwala: shop,
      files: [],
      earlierVersions: 0,
      changes: [],
    });
    expect(first?.audit.map(({ action, by }) => ({ action, by }))).toEqual([
      { action: "application.started", by: "applicant" },
      { action: "application.submitted", by: "applicant" },
    ]);

    await admin.mutation(api.review.decide, {
      applicationId: id,
      decision: "changes",
      note: "Please add the shop's full name as on the board.",
    });
    await ramesh.mutation(api.applications.saveDraft, {
      kabadiwala: { ...shop, shopName: "Ramesh Raddi Centre" },
    });
    await ramesh.mutation(api.applications.submit, {});

    const second = await admin.query(api.review.get, { applicationId: id });
    expect(second).toMatchObject({
      status: "approved",
      version: 2,
      earlierVersions: 1,
      changes: ["kabadiwala.shopName"],
    });
    expect(second?.audit.at(2)).toMatchObject({
      action: "application.changes_requested",
      by: "admin",
      from: "submitted",
      to: "changes_requested",
      note: "Please add the shop's full name as on the board.",
    });
  });

  it("is null for an id that isn't an application", async () => {
    const t = await demoWorld();
    const admin = await signInAdmin(t);
    expect(
      await admin.query(api.review.get, { applicationId: "not-an-id" }),
    ).toBeNull();
    const profileId = await t.run(async (ctx) => {
      const profile = await ctx.db.query("profiles").first();
      return profile?._id ?? "";
    });
    expect(
      await admin.query(api.review.get, { applicationId: profileId }),
    ).toBeNull();
  });

  it("lists the files for the admin to open", async () => {
    const t = await demoWorld();
    const yard = await applicationOf(t, YARD_APPLICANT);
    const admin = await signInAdmin(t);
    const detail = await admin.query(api.review.get, {
      applicationId: yard._id,
    });
    expect(detail?.files.map(({ type, name }) => ({ type, name }))).toEqual([
      { type: "pcb_certificate", name: "KSPCB-consent.pdf" },
      { type: "machine_media", name: "baling-press.svg" },
      { type: "machine_media", name: "sorting-floor.svg" },
    ]);
  });
});

describe("approving", () => {
  it("opens a kabadiwala's shop with an owner and a rate card", async () => {
    const t = await demoWorld();
    const application = await applicationOf(t, SHOP_APPLICANT);
    const admin = await signInAdmin(t);
    await admin.mutation(api.review.decide, {
      applicationId: application._id,
      decision: "approve",
    });

    const result = await t.run(async (ctx) => {
      const org = await ctx.db
        .query("orgs")
        .withIndex("by_slug", (q) => q.eq("slug", "kavitha-raddi-shop"))
        .unique();
      if (!org) throw new Error("No shop");
      return {
        org,
        members: await ctx.db
          .query("memberships")
          .withIndex("by_org", (q) => q.eq("orgId", org._id))
          .collect(),
        rates: await ctx.db
          .query("rateCards")
          .withIndex("by_org_material", (q) => q.eq("orgId", org._id))
          .collect(),
        prices: await ctx.db.query("referencePrices").collect(),
        application: await ctx.db.get("applications", application._id),
        audit: await ctx.db.query("auditLog").collect(),
      };
    });

    expect(result.org).toMatchObject({
      kind: "kabadiwala",
      name: "Kavitha Raddi Shop",
      status: "active",
      ownerProfileId: application.profileId,
      applicationId: application._id,
      city: "Bengaluru",
      area: "Rajajinagar",
      address: "3rd Block, Rajajinagar, Bengaluru",
      phones: [{ number: "+919845000099", label: "Husband" }],
      hours: { opens: "09:00", closes: "19:30" },
      weeklyOff: ["tue"],
      families: ["paper", "plastic", "metal"],
      offersPickup: false,
    });
    expect(result.members).toEqual([
      expect.objectContaining({
        profileId: application.profileId,
        role: "owner",
      }),
    ]);

    // Every scrap material the shop buys, at the city's fallback price.
    const fallbackOf = new Map(
      result.prices.map((price) => [price.materialCode, price.fallbackPaise]),
    );
    const bought = CATALOGUE.filter(
      (entry) =>
        entry.stage === "scrap" &&
        ["paper", "plastic", "metal"].includes(entry.family),
    ).map((entry) => entry.code);
    expect(
      result.rates.map((rate) => rate.materialCode).toSorted(byCode),
    ).toEqual(bought.toSorted(byCode));
    for (const rate of result.rates) {
      expect(rate.paisePerKg).toBe(fallbackOf.get(rate.materialCode));
    }

    expect(result.application).toMatchObject({
      status: "approved",
      decidedBy: expect.any(String) as unknown,
      decidedAt: expect.any(Number) as unknown,
    });
    expect(result.application?.note).toBeUndefined();
    expect(
      result.audit
        .filter((row) => row.action !== "profile.created")
        .map(({ action, metadata }) => ({ action, metadata })),
    ).toEqual([
      {
        action: "org.created",
        metadata: expect.objectContaining({
          kind: "kabadiwala",
          rateCardItems: bought.length,
        }) as unknown,
      },
      {
        action: "application.approved",
        metadata: expect.objectContaining({
          from: "submitted",
          to: "approved",
          orgId: result.org._id,
        }) as unknown,
      },
      { action: "inbox.created", metadata: undefined },
      { action: "notification.disabled", metadata: undefined },
    ]);

    // And the new shop owner's app opens on their business.
    const kavitha = await signInAs(t, SHOP_APPLICANT);
    expect(await kavitha.query(api.workspace.mine, {})).toMatchObject({
      kind: "org",
      org: { name: "Kavitha Raddi Shop", kind: "kabadiwala" },
    });
    const inbox = await kavitha.query(api.inbox.list, {
      paginationOpts: { numItems: 10, cursor: null },
    });
    expect(inbox.page).toHaveLength(1);
    expect(inbox.page[0]).toMatchObject({
      event: "application_approved",
      read: false,
    });
    expect(
      result.audit.find((row) => row.action === "inbox.created"),
    ).toMatchObject({
      entityTable: "inbox",
      entityId: inbox.page[0]?.id,
      actorProfileId: application.profileId,
    });
  });

  it("opens a yard with its materials, pickups and consent, and no rate card", async () => {
    const t = await demoWorld();
    const application = await applicationOf(t, YARD_APPLICANT);
    const admin = await signInAdmin(t);
    await admin.mutation(api.review.decide, {
      applicationId: application._id,
      decision: "approve",
    });
    const { org, rates } = await t.run(async (ctx) => {
      const found = await ctx.db
        .query("orgs")
        .withIndex("by_owner", (q) =>
          q.eq("ownerProfileId", application.profileId),
        )
        .unique();
      return {
        org: found,
        rates: found
          ? await ctx.db
              .query("rateCards")
              .withIndex("by_org_material", (q) => q.eq("orgId", found._id))
              .collect()
          : [],
      };
    });
    expect(org).toMatchObject({
      kind: "yard",
      name: "Irfan Metal & Plastic Yard",
      slug: "irfan-metal-plastic-yard",
      area: "Hegde Nagar",
      gstin: "29AAIFI3344R1Z1",
      families: ["metal", "plastic"],
      offersPickup: true,
      weeklyOff: ["fri"],
      consent: {
        board: "KSPCB",
        number: "KSPCB/CFO/2025/4410",
        validUntil: "2028-03-31",
      },
    });
    expect(rates).toEqual([]);
  });

  it("gives a business a slug nobody else has", async () => {
    const t = await demoWorld();
    await t.run(async (ctx) => {
      const taken = await ctx.db.query("orgs").first();
      if (taken) {
        await ctx.db.patch("orgs", taken._id, { slug: "kavitha-raddi-shop" });
      }
    });
    const application = await applicationOf(t, SHOP_APPLICANT);
    const admin = await signInAdmin(t);
    await admin.mutation(api.review.decide, {
      applicationId: application._id,
      decision: "approve",
    });
    const slug = await t.run(async (ctx) => {
      const org = await ctx.db
        .query("orgs")
        .withIndex("by_owner", (q) =>
          q.eq("ownerProfileId", application.profileId),
        )
        .unique();
      return org?.slug;
    });
    expect(slug).toBe("kavitha-raddi-shop-2");
  });

  it("makes an approved Saathi a Saathi", async () => {
    const t = setup();
    const lakshmi = await signIn(t, {
      email: "919000000002@phone.luma.green",
      phoneNumber: "+919000000002",
    });
    const profileId = await lakshmi.mutation(api.identity.ensureProfile, {
      locale: "hi",
    });
    const applicationId = await t.run(async (ctx) =>
      ctx.db.insert("applications", {
        profileId,
        kind: "saathi",
        status: "submitted",
        version: 1,
        locale: "hi",
        ageConfirmedAt: Date.now(),
        privacyAcceptedAt: Date.now(),
        saathi: saathiSection,
        submittedAt: Date.now(),
        createdAt: Date.now(),
        updatedAt: Date.now(),
      }),
    );

    const admin = await signInAdmin(t);
    await admin.mutation(api.review.decide, {
      applicationId,
      decision: "approve",
    });

    const saathis = await t.run(async (ctx) =>
      ctx.db.query("saathiProfiles").collect(),
    );
    expect(saathis).toEqual([
      expect.objectContaining({
        ...saathiSection,
        profileId,
        applicationId,
        city: "Bengaluru",
        status: "active",
      }),
    ]);
    expect(await lakshmi.query(api.workspace.mine, {})).toEqual({
      kind: "saathi",
      saathi: { name: "Geetha M", area: "Mathikere", city: "Bengaluru" },
    });
  });

  it("switches a suspended business back on instead of opening a second", async () => {
    const t = await demoWorld();
    const application = await applicationOf(t, SHOP_APPLICANT);
    const admin = await signInAdmin(t);
    await admin.mutation(api.review.decide, {
      applicationId: application._id,
      decision: "approve",
    });
    await t.run(async (ctx) => {
      await ctx.db.patch("applications", application._id, {
        status: "suspended",
      });
      const org = await ctx.db
        .query("orgs")
        .withIndex("by_owner", (q) =>
          q.eq("ownerProfileId", application.profileId),
        )
        .unique();
      if (org) await ctx.db.patch("orgs", org._id, { status: "suspended" });
    });

    await admin.mutation(api.review.decide, {
      applicationId: application._id,
      decision: "approve",
    });
    const orgs = await t.run(async (ctx) =>
      ctx.db
        .query("orgs")
        .withIndex("by_owner", (q) =>
          q.eq("ownerProfileId", application.profileId),
        )
        .collect(),
    );
    expect(orgs.map((org) => org.status)).toEqual(["active"]);
  });

  it("refuses an application that's missing its business details", async () => {
    const t = setup();
    const applicationId = await insertApplication(t, {
      kind: "yard",
      status: "submitted",
      submittedAt: Date.now(),
    });
    const admin = await signInAdmin(t);
    await expect(
      admin.mutation(api.review.decide, { applicationId, decision: "approve" }),
    ).rejects.toThrow(/INCOMPLETE_APPLICATION/);
  });

  it("restores the original business after ownership transfer without granting access to its former owner", async () => {
    const t = await demoWorld();
    const application = await applicationOf(t, SHOP_APPLICANT);
    const admin = await signInAdmin(t);
    await admin.mutation(api.review.decide, {
      applicationId: application._id,
      decision: "approve",
    });
    const { orgId, successorId } = await t.run(async (ctx) => {
      const org = await ctx.db
        .query("orgs")
        .withIndex("by_owner", (q) =>
          q.eq("ownerProfileId", application.profileId),
        )
        .unique();
      if (!org) throw new Error("Missing approved business");
      const successorId = await ctx.db.insert("profiles", {
        authUserId: "successor-owner",
        kind: "member",
        locale: "en",
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
      const formerMembership = await ctx.db
        .query("memberships")
        .withIndex("by_profile_org", (q) =>
          q.eq("profileId", application.profileId).eq("orgId", org._id),
        )
        .unique();
      if (!formerMembership) throw new Error("Missing former owner");
      await ctx.db.delete("memberships", formerMembership._id);
      await ctx.db.insert("memberships", {
        orgId: org._id,
        profileId: successorId,
        role: "owner",
        createdAt: Date.now(),
      });
      await ctx.db.patch("orgs", org._id, {
        ownerProfileId: successorId,
        status: "suspended",
      });
      await ctx.db.patch("applications", application._id, {
        status: "suspended",
      });
      return { orgId: org._id, successorId };
    });
    await admin.mutation(api.review.decide, {
      applicationId: application._id,
      decision: "approve",
    });
    const businesses = await t.run(async (ctx) => {
      const orgs = await ctx.db.query("orgs").collect();
      return orgs.filter((org) => org.applicationId === application._id);
    });
    expect(businesses).toMatchObject([
      { _id: orgId, ownerProfileId: successorId, status: "active" },
    ]);
    expect(
      await t.run((ctx) =>
        ctx.db
          .query("memberships")
          .withIndex("by_profile", (q) =>
            q.eq("profileId", application.profileId),
          )
          .collect(),
      ),
    ).toEqual([]);
  });
});

describe("asking for changes and rejecting", () => {
  it("need a note, which the applicant then sees", async () => {
    const t = await demoWorld();
    const application = await applicationOf(t, SHOP_APPLICANT);
    const admin = await signInAdmin(t);

    for (const decision of ["changes", "reject"] as const) {
      await expect(
        admin.mutation(api.review.decide, {
          applicationId: application._id,
          decision,
        }),
      ).rejects.toThrow(/NOTE_REQUIRED/);
      await expect(
        admin.mutation(api.review.decide, {
          applicationId: application._id,
          decision,
          note: "no",
        }),
      ).rejects.toThrow(/NOTE_REQUIRED/);
    }

    await admin.mutation(api.review.decide, {
      applicationId: application._id,
      decision: "changes",
      note: "  The map pin is on the main road; move it to your shop.  ",
    });
    const kavitha = await signInAs(t, SHOP_APPLICANT);
    expect(await kavitha.query(api.applications.mine, {})).toMatchObject({
      application: {
        status: "changes_requested",
        note: "The map pin is on the main road; move it to your shop.",
      },
    });
    // Nothing opens until the admin approves.
    expect(
      await t.run(async (ctx) =>
        ctx.db
          .query("orgs")
          .withIndex("by_owner", (q) =>
            q.eq("ownerProfileId", application.profileId),
          )
          .collect(),
      ),
    ).toEqual([]);
  });

  it("rejects with the reason on record", async () => {
    const t = await demoWorld();
    const application = await applicationOf(t, YARD_APPLICANT);
    const admin = await signInAdmin(t);
    await admin.mutation(api.review.decide, {
      applicationId: application._id,
      decision: "reject",
      note: "The consent number isn't on the KSPCB register.",
    });
    const { stored, audit } = await t.run(async (ctx) => ({
      stored: await ctx.db.get("applications", application._id),
      audit: await ctx.db
        .query("auditLog")
        .withIndex("by_entity", (q) =>
          q.eq("entityTable", "applications").eq("entityId", application._id),
        )
        .collect(),
    }));
    expect(stored).toMatchObject({
      status: "rejected",
      note: "The consent number isn't on the KSPCB register.",
    });
    expect(audit.map(({ action, metadata }) => ({ action, metadata }))).toEqual(
      [
        {
          action: "application.rejected",
          metadata: {
            from: "submitted",
            to: "rejected",
            note: "The consent number isn't on the KSPCB register.",
            version: 1,
          },
        },
      ],
    );
  });
});

describe("decisions out of turn", () => {
  it("are refused once decided, and for drafts", async () => {
    const t = await demoWorld();
    const application = await applicationOf(t, SHOP_APPLICANT);
    const admin = await signInAdmin(t);
    await admin.mutation(api.review.decide, {
      applicationId: application._id,
      decision: "approve",
    });
    await expect(
      admin.mutation(api.review.decide, {
        applicationId: application._id,
        decision: "approve",
      }),
    ).rejects.toThrow(/WRONG_STATE/);
    await expect(
      admin.mutation(api.review.decide, {
        applicationId: application._id,
        decision: "reject",
        note: "Changed my mind.",
      }),
    ).rejects.toThrow(/WRONG_STATE/);

    const draft = await insertApplication(t, {
      kind: "saathi",
      status: "draft",
      version: 0,
    });
    await expect(
      admin.mutation(api.review.decide, {
        applicationId: draft,
        decision: "approve",
      }),
    ).rejects.toThrow(/WRONG_STATE/);
  });

  it("are refused for an application that doesn't exist", async () => {
    const t = await demoWorld();
    const application = await applicationOf(t, SHOP_APPLICANT);
    await t.run(async (ctx) => {
      await ctx.db.delete("applications", application._id);
    });
    const admin = await signInAdmin(t);
    await expect(
      admin.mutation(api.review.decide, {
        applicationId: application._id,
        decision: "approve",
      }),
    ).rejects.toThrow(/NOT_FOUND/);
  });
});

describe("only the admin", () => {
  it("may see the queue, an application, or decide", async () => {
    const t = await demoWorld();
    const application = await applicationOf(t, SHOP_APPLICANT);
    const applicationId: Id<"applications"> = application._id;
    const decide = { applicationId, decision: "approve" as const };

    // Signed out.
    await expect(t.query(api.review.queue, {})).rejects.toThrow(
      /NOT_SIGNED_IN/,
    );
    await expect(t.query(api.review.summary, {})).rejects.toThrow(
      /NOT_SIGNED_IN/,
    );
    await expect(t.query(api.review.get, { applicationId })).rejects.toThrow(
      /NOT_SIGNED_IN/,
    );
    await expect(t.mutation(api.review.decide, decide)).rejects.toThrow(
      /NOT_SIGNED_IN/,
    );

    // A business owner, and the applicant themselves.
    for (const phone of ["+919000000101", SHOP_APPLICANT]) {
      const member = await signInAs(t, phone);
      await expect(member.query(api.review.queue, {})).rejects.toThrow(
        /NOT_ADMIN/,
      );
      await expect(
        member.query(api.review.get, { applicationId }),
      ).rejects.toThrow(/NOT_ADMIN/);
      await expect(member.mutation(api.review.decide, decide)).rejects.toThrow(
        /NOT_ADMIN/,
      );
    }

    // The admin before their authenticator is set up.
    const halfway = await signInAdmin(t, { twoFactorEnabled: false });
    await expect(halfway.query(api.review.queue, {})).rejects.toThrow(
      /TWO_FACTOR_REQUIRED/,
    );
    await expect(halfway.mutation(api.review.decide, decide)).rejects.toThrow(
      /TWO_FACTOR_REQUIRED/,
    );

    const untouched = await applicationOf(t, SHOP_APPLICANT);
    expect(untouched.status).toBe("submitted");
  });
});
