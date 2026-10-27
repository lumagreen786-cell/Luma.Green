import { ConvexError, v } from "convex/values";

import { isLocalAuthTestMode } from "../src/lib/env";
import type { Id } from "./_generated/dataModel";
import { internalMutation, type MutationCtx } from "./_generated/server";
import { authComponent } from "./auth";
import { LOCAL_ACCEPTANCE_PERSONAS } from "./lib/localAcceptance";
import { phoneEmail } from "./lib/phone";
import { primarySiteType } from "./lib/siteClassification";

/**
 * Narrow domain fixtures for real, verified local auth identities. No password,
 * auth table write, payment, inventory, certificate or external provider call.
 * Each fixture is recorded once; re-running preserves later test activity.
 */
export const seed = internalMutation({
  args: {
    accounts: v.array(v.object({ key: v.string(), authUserId: v.string() })),
  },
  returns: v.object({ created: v.number(), existing: v.number() }),
  handler: async (ctx, { accounts }) => {
    if (!isLocalAuthTestMode()) throw new ConvexError("LOCAL_ACCEPTANCE_ONLY");
    if (
      accounts.length > LOCAL_ACCEPTANCE_PERSONAS.length ||
      new Set(accounts.map(({ key }) => key)).size !== accounts.length ||
      new Set(accounts.map(({ authUserId }) => authUserId)).size !==
        accounts.length
    )
      throw new ConvexError("INVALID_ACCEPTANCE_ROSTER");

    let created = 0;
    let existing = 0;
    for (const account of accounts) {
      const persona = LOCAL_ACCEPTANCE_PERSONAS.find(
        ({ key }) => key === account.key,
      );
      if (!persona) throw new ConvexError("INVALID_ACCEPTANCE_ROSTER");
      const profile = await requireAcceptanceProfile(
        ctx,
        account.authUserId,
        persona,
      );
      const previous = await ctx.db
        .query("auditLog")
        .withIndex("by_entity", (q) =>
          q.eq("entityTable", "localAcceptance").eq("entityId", persona.key),
        )
        .first();
      if (previous) {
        if (previous.actorProfileId !== profile._id)
          throw new ConvexError("ACCEPTANCE_IDENTITY_CHANGED");
        existing += 1;
        continue;
      }
      const membership = await ctx.db
        .query("memberships")
        .withIndex("by_profile", (q) => q.eq("profileId", profile._id))
        .first();
      const stakeholder = await ctx.db
        .query("stakeholderAccounts")
        .withIndex("by_owner", (q) => q.eq("ownerProfileId", profile._id))
        .first();
      const saathi = await ctx.db
        .query("saathiProfiles")
        .withIndex("by_profile", (q) => q.eq("profileId", profile._id))
        .first();
      if (membership || stakeholder || saathi)
        throw new ConvexError("ACCEPTANCE_ACCOUNT_ALREADY_USED");

      const now = Date.now();
      const { orgId, inserted } = await createDomainFixture(
        ctx,
        persona,
        profile._id,
        now,
      );
      await ctx.db.insert("auditLog", {
        action: "local.acceptance.account.seeded",
        entityTable: "localAcceptance",
        entityId: persona.key,
        actorProfileId: profile._id,
        orgId,
        createdAt: now,
        metadata: { version: 1, synthetic: true, inserted },
      });
      created += 1;
    }
    return { created, existing };
  },
});

/** Explicit synthetic stock for local byproduct browser acceptance only. */
export const seedByproducts = internalMutation({
  args: {},
  returns: v.object({ created: v.boolean() }),
  handler: async (ctx) => {
    if (!isLocalAuthTestMode()) throw new ConvexError("LOCAL_ACCEPTANCE_ONLY");
    const marker = await ctx.db
      .query("auditLog")
      .withIndex("by_entity", (q) =>
        q.eq("entityTable", "localAcceptance").eq("entityId", "byproducts-v1"),
      )
      .first();
    if (marker) return { created: false };
    const org = await ctx.db
      .query("orgs")
      .withIndex("by_slug", (q) =>
        q.eq("slug", "local-acceptance-manufacturer"),
      )
      .unique();
    if (
      !org?.ownerProfileId ||
      org.kind !== "manufacturer" ||
      org.status !== "active" ||
      !org.families.includes("paper")
    )
      throw new ConvexError("ACCEPTANCE_MANUFACTURER_REQUIRED");
    const profile = await ctx.db.get("profiles", org.ownerProfileId);
    if (!profile) throw new ConvexError("ACCEPTANCE_PROFILE_REQUIRED");
    const manufacturer = LOCAL_ACCEPTANCE_PERSONAS.find(
      ({ key }) => key === "manufacturer",
    );
    if (!manufacturer) throw new ConvexError("INVALID_ACCEPTANCE_ROSTER");
    await requireAcceptanceProfile(ctx, profile.authUserId, manufacturer);
    const ownerSeed = await ctx.db
      .query("auditLog")
      .withIndex("by_entity", (q) =>
        q.eq("entityTable", "localAcceptance").eq("entityId", "manufacturer"),
      )
      .first();
    if (
      ownerSeed?.orgId !== org._id ||
      ownerSeed.actorProfileId !== profile._id
    )
      throw new ConvexError("ACCEPTANCE_MANUFACTURER_REQUIRED");
    const now = Date.now();
    const fixtures = [
      {
        code: "LOCAL-PAPER-BYPRODUCT",
        name: "Local test paper offcuts",
        eligible: true,
      },
      {
        code: "LOCAL-PAPER-UNCLASSIFIED",
        name: "Local test unclassified paper",
        eligible: false,
      },
    ];
    const inserted: { table: string; id: string }[] = [];
    for (const [index, fixture] of fixtures.entries()) {
      const existing = await ctx.db
        .query("materials")
        .withIndex("by_code", (q) => q.eq("code", fixture.code))
        .first();
      const stock = await ctx.db
        .query("inventory")
        .withIndex("by_org_material", (q) =>
          q.eq("orgId", org._id).eq("materialCode", fixture.code),
        )
        .first();
      if (existing || stock)
        throw new ConvexError("ACCEPTANCE_FIXTURE_CONFLICT");
      const materialId = await ctx.db.insert("materials", {
        code: fixture.code,
        names: { en: fixture.name },
        family: "paper",
        stage: "scrap",
        co2eFactor: 0,
        sortOrder: 10_000 + index,
        active: true,
        byproductEligibility: fixture.eligible
          ? {
              hazardStatus: "non_hazardous",
              sourceReference:
                "Synthetic local fixture only; not a real hazard classification or regulatory approval.",
              reviewedAt: now,
            }
          : undefined,
      });
      const inventoryId = await ctx.db.insert("inventory", {
        orgId: org._id,
        materialCode: fixture.code,
        grams: 1_000_000,
        updatedAt: now,
      });
      const movementId = await ctx.db.insert("inventoryMovements", {
        orgId: org._id,
        actorProfileId: profile._id,
        materialCode: fixture.code,
        deltaGrams: 1_000_000,
        costDeltaPaise: null,
        sourceKey: `local-acceptance:${fixture.code}`,
        createdAt: now,
      });
      inserted.push(
        { table: "materials", id: materialId },
        { table: "inventory", id: inventoryId },
        { table: "inventoryMovements", id: movementId },
      );
    }
    await ctx.db.insert("auditLog", {
      action: "local.acceptance.byproducts.seeded",
      entityTable: "localAcceptance",
      entityId: "byproducts-v1",
      actorProfileId: profile._id,
      orgId: org._id,
      createdAt: now,
      metadata: {
        synthetic: true,
        version: 1,
        inserted,
        gramsPerMaterial: 1_000_000,
        evidence:
          "Direct local test stock fixture; not generated from physical lot declarations.",
      },
    });
    return { created: true };
  },
});

async function createDomainFixture(
  ctx: MutationCtx,
  persona: (typeof LOCAL_ACCEPTANCE_PERSONAS)[number],
  profileId: Id<"profiles">,
  now: number,
) {
  const inserted: { table: string; id: string }[] = [];
  let orgId: Id<"orgs"> | undefined;
  const access = persona.access;
  switch (access.kind) {
    case "org": {
      const slug = `local-acceptance-${persona.key}`;
      if (
        await ctx.db
          .query("orgs")
          .withIndex("by_slug", (q) => q.eq("slug", slug))
          .first()
      ) {
        throw new ConvexError("ACCEPTANCE_SLUG_ALREADY_USED");
      }
      orgId = await ctx.db.insert("orgs", {
        kind: access.orgKind,
        siteType: primarySiteType({ kind: access.orgKind }),
        name: persona.name,
        slug,
        status: "active",
        ownerProfileId: profileId,
        city: "Bengaluru",
        area: "Local test area",
        address: "Synthetic acceptance site, Bengaluru",
        phones: [],
        weeklyOff: [],
        families: ["paper", "plastic", "metal", "glass"],
        offersPickup: access.orgKind === "kabadiwala",
        pickupRadiusKm: 5,
        hours: { opens: "00:00", closes: "23:59" },
        createdAt: now,
        updatedAt: now,
      });
      inserted.push({ table: "orgs", id: orgId });
      const id = await ctx.db.insert("memberships", {
        profileId,
        orgId,
        role: "owner",
        createdAt: now,
      });
      inserted.push({ table: "memberships", id });
      break;
    }
    case "stakeholder": {
      const id = await ctx.db.insert("stakeholderAccounts", {
        ownerProfileId: profileId,
        kind: access.stakeholderKind,
        siteType: access.siteType,
        organizationName: persona.name,
        status: "approved",
        createdAt: now,
        updatedAt: now,
        reviewNote:
          "Synthetic local acceptance fixture; not a real compliance approval.",
      });
      inserted.push({ table: "stakeholderAccounts", id });
      break;
    }
    case "saathi": {
      const id = await ctx.db.insert("saathiProfiles", {
        profileId,
        name: persona.name,
        city: "Bengaluru",
        area: "Local test area",
        radiusKm: 5,
        workTypes: [
          "home_pickups",
          "shop_help",
          "yard_sorting",
          "factory_shifts",
        ],
        vehicle: "cycle",
        times: ["morning", "afternoon", "evening"],
        days: ["mon", "tue", "wed", "thu", "fri", "sat", "sun"],
        status: "active",
        createdAt: now,
      });
      inserted.push({ table: "saathiProfiles", id });
      break;
    }
    case "personal": {
      break;
    }
  }
  return { orgId, inserted };
}

async function requireAcceptanceProfile(
  ctx: MutationCtx,
  authUserId: string,
  persona: (typeof LOCAL_ACCEPTANCE_PERSONAS)[number],
) {
  const user = await authComponent.getAnyUserById(ctx, authUserId);
  const isEmailVerified = user?.email === persona.email && user.emailVerified;
  const isPhoneVerified =
    user?.phoneNumber === persona.phone &&
    user.phoneNumberVerified === true &&
    user.email === phoneEmail(persona.phone);
  if (!isEmailVerified && !isPhoneVerified) {
    throw new ConvexError("ACCEPTANCE_IDENTITY_NOT_VERIFIED");
  }
  const profile = await ctx.db
    .query("profiles")
    .withIndex("by_authUserId", (q) => q.eq("authUserId", authUserId))
    .unique();
  if (profile?.kind !== "member")
    throw new ConvexError("ACCEPTANCE_PROFILE_REQUIRED");
  return profile;
}
