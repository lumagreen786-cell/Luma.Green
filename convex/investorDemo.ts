import type { WithoutSystemFields } from "convex/server";
import { ConvexError, v } from "convex/values";

import type { Doc, Id } from "./_generated/dataModel";
import {
  internalMutation,
  internalQuery,
  type MutationCtx,
  type QueryCtx,
} from "./_generated/server";
import { authComponent } from "./auth";
import { safePaiseFor } from "./lib/chain";
import {
  DEMO_FAMILIES,
  DEMO_INDUSTRY_ROWS,
  DEMO_MATERIALS,
  DEMO_NOTICE,
  demoDate,
} from "./lib/investorDemoData";
import { requireInvestorDemoImport } from "./lib/investorDemoGuard";
import {
  INVESTOR_DEMO_BATCH,
  INVESTOR_DEMO_ROSTER,
} from "./lib/investorDemoRoster";
import { routeGeometry } from "./lib/routePlanning";
import { primarySiteType } from "./lib/siteClassification";

const DEMO_TABLES = [
  "orgs",
  "memberships",
  "stakeholderAccounts",
  "saathiProfiles",
  "applications",
  "materials",
  "inventory",
  "inventoryMovements",
  "manufacturerStockIntakes",
  "rateCards",
  "industrialFacilities",
  "materialLots",
  "lotTransformations",
  "lotTransformationInputs",
  "lotInspections",
  "qualityBuyerDecisions",
  "productionRecipes",
  "productionDeclarations",
  "listings",
  "trades",
  "bookings",
  "bookingOffers",
  "jobs",
  "commercialEvidence",
  "materialDemands",
  "sourcingPlans",
  "supplierQualifications",
  "sourcingAgreements",
  "sourcingReleases",
  "sourcingEvents",
  "routePlans",
  "routePlanVersions",
  "auditReports",
  "conversations",
  "conversationMessages",
] as const;
type DemoTable = (typeof DEMO_TABLES)[number];
type Persona = (typeof INVESTOR_DEMO_ROSTER)[number];
interface Operator {
  persona: Persona;
  profileId: Id<"profiles">;
  orgId: Id<"orgs">;
}

/** No provider state; all new records have a bounded cleanup manifest and audit. */
function writer(ctx: MutationCtx, batchKey: string, now: number) {
  return async <T extends DemoTable>(
    key: string,
    table: T,
    value: WithoutSystemFields<Doc<T>>,
  ): Promise<Id<T>> => {
    const old = await ctx.db
      .query("investorDemoRecords")
      .withIndex("by_batch_key", (q) =>
        q.eq("batchKey", batchKey).eq("key", key),
      )
      .unique();
    if (old) {
      const id = ctx.db.normalizeId(table, old.recordId);
      if (!id || old.table !== table || !(await ctx.db.get(table, id)))
        throw new ConvexError("DEMO_RECORD_CHANGED_OR_MISSING");
      return id;
    }
    const id = await ctx.db.insert(table, value);
    await ctx.db.insert("investorDemoRecords", {
      batchKey,
      key,
      table,
      recordId: id,
      createdAt: now,
    });
    const auditId = await ctx.db.insert("auditLog", {
      action:
        table === "inventory" ? "inventory.adjusted" : "investor_demo.inserted",
      entityTable: table,
      entityId: id,
      metadata: { batchKey, key, synthetic: true, notice: DEMO_NOTICE },
      createdAt: now,
    });
    await ctx.db.insert("investorDemoRecords", {
      batchKey,
      key: `audit:${key}`,
      table: "auditLog",
      recordId: auditId,
      createdAt: now,
    });
    return id;
  };
}
type Write = ReturnType<typeof writer>;
async function account(ctx: MutationCtx, batchKey: string, persona: Persona) {
  const row = await ctx.db
    .query("investorDemoAccounts")
    .withIndex("by_batch_persona", (q) =>
      q.eq("batchKey", batchKey).eq("personaKey", persona.key),
    )
    .unique();
  const profile = row ? await ctx.db.get("profiles", row.profileId) : null;
  if (
    row?.email !== persona.email ||
    profile?.kind !== "member" ||
    profile.authUserId !== row.authUserId
  )
    throw new ConvexError("DEMO_IDENTITY_REQUIRED");
  const user = await authComponent.getAnyUserById(ctx, row.authUserId);
  if (user?.email !== persona.email || !user.emailVerified)
    throw new ConvexError("DEMO_IDENTITY_REQUIRED");
  return profile;
}
async function selectWorkspace(
  ctx: MutationCtx,
  write: Write,
  profile: Doc<"profiles">,
  orgId: Id<"orgs">,
  role: Doc<"memberships">["role"],
  key: string,
  batchKey: string,
  now: number,
) {
  if (profile.activeOrgId && profile.activeOrgId !== orgId)
    throw new ConvexError("DEMO_PROFILE_ALREADY_ASSIGNED");
  await write(`membership:${key}`, "memberships", {
    profileId: profile._id,
    orgId,
    role,
    createdAt: now,
  });
  if (profile.activeOrgId) return;
  {
    await ctx.db.patch("profiles", profile._id, {
      activeOrgId: orgId,
      updatedAt: now,
    });
    const auditId = await ctx.db.insert("auditLog", {
      actorProfileId: profile._id,
      orgId,
      action: "investor_demo.workspace_selected",
      entityTable: "profiles",
      entityId: profile._id,
      metadata: { synthetic: true, batchKey, key },
      createdAt: now,
    });
    await ctx.db.insert("investorDemoRecords", {
      batchKey,
      key: `workspace-audit:${key}`,
      table: "auditLog",
      recordId: auditId,
      createdAt: now,
    });
  }
}
async function identities(
  ctx: MutationCtx,
  write: Write,
  batchKey: string,
  cohort: number,
  now: number,
) {
  const personas = INVESTOR_DEMO_ROSTER.filter((p) => p.cohort === cohort);
  const profiles = new Map<string, Doc<"profiles">>();
  for (const persona of personas)
    profiles.set(persona.templateKey, await account(ctx, batchKey, persona));
  const operators = new Map<string, Operator>();
  const stakeholders: {
    id: Id<"stakeholderAccounts">;
    profileId: Id<"profiles">;
  }[] = [];
  let saathiId: Id<"saathiProfiles"> | undefined;
  async function addPersona(persona: Persona) {
    const profile = profiles.get(persona.templateKey);
    if (!profile) throw new ConvexError("DEMO_IDENTITY_REQUIRED");
    const access = persona.access;
    switch (access.kind) {
      case "org": {
        const slug = `demo-${persona.key}`;
        const existing = await ctx.db
          .query("orgs")
          .withIndex("by_slug", (q) => q.eq("slug", slug))
          .unique();
        const marker = await ctx.db
          .query("investorDemoRecords")
          .withIndex("by_batch_key", (q) =>
            q.eq("batchKey", batchKey).eq("key", `org:${persona.key}`),
          )
          .unique();
        if (existing && marker?.recordId !== existing._id)
          throw new ConvexError("DEMO_SLUG_CONFLICT");
        const siteType = primarySiteType({ kind: access.orgKind });
        const orgId = await write(`org:${persona.key}`, "orgs", {
          kind: access.orgKind,
          ...(siteType && { siteType }),
          materialOrigins: ["post_consumer", "industrial_byproduct"],
          name: persona.name,
          slug,
          status: "active",
          ownerProfileId: profile._id,
          city: "Bengaluru",
          area: `DEMO district ${String(cohort)}`,
          address: "DEMO fictional site — not a real business address",
          phones: [],
          weeklyOff: [],
          families: DEMO_FAMILIES,
          offersPickup: access.orgKind === "kabadiwala",
          pickupRadiusKm: 5,
          createdAt: now,
          updatedAt: now,
        });
        await selectWorkspace(
          ctx,
          write,
          profile,
          orgId,
          "owner",
          persona.key,
          batchKey,
          now,
        );
        operators.set(persona.templateKey, {
          persona,
          profileId: profile._id,
          orgId,
        });

        return;
      }
      case "stakeholder": {
        const id = await write(
          `stakeholder:${persona.key}`,
          "stakeholderAccounts",
          {
            ownerProfileId: profile._id,
            kind: access.stakeholderKind,
            ...(access.siteType && { siteType: access.siteType }),
            organizationName: persona.name,
            status: "approved",
            reviewNote: DEMO_NOTICE,
            createdAt: now,
            updatedAt: now,
          },
        );
        stakeholders.push({ id, profileId: profile._id });

        return;
      }
      case "saathi": {
        saathiId = await write(`saathi:${persona.key}`, "saathiProfiles", {
          profileId: profile._id,
          name: persona.name,
          city: "Bengaluru",
          area: `DEMO district ${String(cohort)}`,
          radiusKm: 5,
          workTypes: [
            "home_pickups",
            "shop_help",
            "yard_sorting",
            "factory_shifts",
          ],
          vehicle: "cycle",
          times: ["morning", "afternoon", "evening"],
          days: ["mon", "tue", "wed", "thu", "fri", "sat"],
          status: "active",
          createdAt: now,
        });

        return;
      }
      case "personal": {
        return;
      }
    }
  }
  for (const persona of personas) await addPersona(persona);
  const shop = operators.get("kabadiwala");
  if (!shop || !saathiId) throw new ConvexError("DEMO_COHORT_INCOMPLETE");
  for (const [key, role] of [
    ["team-admin", "admin"],
    ["team-member", "member"],
    ["team-viewer", "viewer"],
  ] as const) {
    const profile = profiles.get(key);
    if (!profile) throw new ConvexError("DEMO_IDENTITY_REQUIRED");
    await selectWorkspace(
      ctx,
      write,
      profile,
      shop.orgId,
      role,
      `${key}-${String(cohort)}`,
      batchKey,
      now,
    );
  }
  const applicant = profiles.get("applicant");
  if (applicant)
    await write(`application:${String(cohort)}`, "applications", {
      profileId: applicant._id,
      kind: "kabadiwala",
      status: "draft",
      version: 0,
      locale: "en",
      ageConfirmedAt: now,
      privacyAcceptedAt: now,
      createdAt: now,
      updatedAt: now,
    });
  return { operators, profiles, stakeholders, shop, saathiId };
}
async function catalog(ctx: MutationCtx, write: Write, now: number) {
  const ids = new Map<string, Id<"materials">>();
  for (const [index, material] of DEMO_MATERIALS.entries()) {
    const existing = await ctx.db
      .query("materials")
      .withIndex("by_code", (q) => q.eq("code", material.code))
      .unique();
    if (existing) {
      const marker = await ctx.db
        .query("investorDemoRecords")
        .withIndex("by_batch_key", (q) =>
          q
            .eq("batchKey", INVESTOR_DEMO_BATCH)
            .eq("key", `material:${material.code}`),
        )
        .unique();
      if (marker?.recordId !== existing._id)
        throw new ConvexError("DEMO_MATERIAL_CONFLICT");
    }
    ids.set(
      material.code,
      await write(`material:${material.code}`, "materials", {
        code: material.code,
        names: { en: material.name },
        family: material.family,
        stage: material.stage,
        sortOrder: 10_000 + index,
        active: true,
        byproductEligibility: {
          hazardStatus: "non_hazardous",
          sourceReference: DEMO_NOTICE,
          reviewedAt: now,
        },
      }),
    );
  }
  return ids;
}
async function operationalEvidence(
  write: Write,
  operator: Operator,
  now: number,
) {
  const key = operator.persona.key;
  const facilityId = await write(`facility:${key}`, "industrialFacilities", {
    orgId: operator.orgId,
    name: `${operator.persona.name} demonstration facility`,
    siteReference: DEMO_NOTICE,
    capabilities: [
      "sorting",
      "washing",
      "granulating",
      "compounding",
      "manufacturing",
    ],
    revision: 1,
    createdByProfileId: operator.profileId,
    updatedByProfileId: operator.profileId,
    createdAt: now,
    updatedAt: now,
  });
  const base = {
    orgId: operator.orgId,
    declaredByOrgId: operator.orgId,
    materialCode: "DEMO-PET-BOTTLE",
    state: "DEMO sorted bottle feedstock",
    streamClass: "recoverable_waste" as const,
    handlingClass: "non_hazardous" as const,
    sourceKind: "self_declared" as const,
    sourceReference: DEMO_NOTICE,
    initialGrams: 100_000,
    availableGrams: 50_000,
    status: "available" as const,
    createdByProfileId: operator.profileId,
    createdAt: now,
    updatedAt: now,
  };
  const inputId = await write(`lot:input:${key}`, "materialLots", base);
  const transformationId = await write(
    `transformation:${key}`,
    "lotTransformations",
    {
      facilityId,
      facilityName: `${operator.persona.name} demonstration facility`,
      processKind: "washing",
      orgId: operator.orgId,
      inputLotId: inputId,
      inputGrams: 50_000,
      contaminationGrams: 2000,
      processLossGrams: 1000,
      actorProfileId: operator.profileId,
      createdAt: now,
    },
  );
  await write(`transform-input:${key}`, "lotTransformationInputs", {
    transformationId,
    lotId: inputId,
    materialCode: base.materialCode,
    state: base.state,
    grams: 50_000,
    createdAt: now,
  });
  const outputId = await write(`lot:output:${key}`, "materialLots", {
    ...base,
    materialCode: "DEMO-PET-FLAKE",
    state: "DEMO washed PET flake",
    streamClass: "main_product",
    sourceKind: "transformed",
    parentTransformationId: transformationId,
    initialGrams: 47_000,
    availableGrams: 47_000,
  });
  await write(`lot:controlled:${key}`, "materialLots", {
    ...base,
    materialCode: "DEMO-PAPER-OFFCUT",
    state: "DEMO residual stream — segregate pending review",
    streamClass: "residual_waste",
    handlingClass: "controlled",
    initialGrams: 5000,
    availableGrams: 5000,
  });
  const inspectionId = await write(`inspection:${key}`, "lotInspections", {
    lotId: outputId,
    orgId: operator.orgId,
    assessmentScope: "inspecting_org",
    specificationReference: "DEMO-PET-SPEC",
    specificationVersion: "1",
    sampleMethod: "DEMO fictional composite sample; not laboratory evidence",
    results: [{ parameter: "DEMO moisture", unit: "%", value: "0.5" }],
    decision: "accepted",
    evidenceReference: DEMO_NOTICE,
    actorProfileId: operator.profileId,
    createdAt: now,
  });
  const recipeId = await write(`recipe:${key}`, "productionRecipes", {
    orgId: operator.orgId,
    reference: `DEMO-RECIPE-${key}`,
    version: "1",
    name: "DEMO PET recovery recipe",
    ingredients: [
      {
        name: "DEMO PET bottle feedstock",
        basisPoints: 10_000,
        additive: false,
      },
    ],
    instructions: DEMO_NOTICE,
    actorProfileId: operator.profileId,
    createdAt: now,
  });
  await write(`production:${key}`, "productionDeclarations", {
    orgId: operator.orgId,
    reference: `DEMO-BATCH-${key}`,
    recipeId,
    transformationId,
    inspectionId,
    inputs: [
      {
        lotId: inputId,
        grams: 50_000,
        recycledGrams: 50_000,
        evidenceReference: DEMO_NOTICE,
        additive: false,
      },
    ],
    inputGrams: 50_000,
    recycledInputGrams: 50_000,
    outputGrams: 47_000,
    recycledInputBasisPoints: 10_000,
    evidenceReference: DEMO_NOTICE,
    actorProfileId: operator.profileId,
    createdAt: now,
  });
  return { inspectionId, outputId };
}
async function stock(write: Write, operator: Operator, now: number) {
  for (const material of DEMO_MATERIALS) {
    await write(`stock:${operator.persona.key}:${material.code}`, "inventory", {
      orgId: operator.orgId,
      materialCode: material.code,
      grams: 500_000,
      updatedAt: now,
    });
    await write(
      `stock-movement:${operator.persona.key}:${material.code}`,
      "inventoryMovements",
      {
        orgId: operator.orgId,
        actorProfileId: operator.profileId,
        materialCode: material.code,
        deltaGrams: 500_000,
        costDeltaPaise: null,
        sourceKey: `investor-demo:${operator.persona.key}:${material.code}`,
        createdAt: now,
      },
    );
    if (
      operator.persona.access.kind === "org" &&
      operator.persona.access.orgKind === "manufacturer" &&
      material.stage === "scrap"
    )
      await write(
        `intake:${operator.persona.key}:${material.code}`,
        "manufacturerStockIntakes",
        {
          orgId: operator.orgId,
          actorProfileId: operator.profileId,
          intakeReference: `DEMO-${operator.persona.key}-${material.code}`,
          materialCode: material.code,
          grams: 500_000,
          producedOn: demoDate(now),
          sourceReference: DEMO_NOTICE,
          weighingReference: "DEMO synthetic scale reading",
          ownProductionConfirmed: true,
          createdAt: now,
        },
      );
    if (
      operator.persona.access.kind === "org" &&
      operator.persona.access.orgKind === "kabadiwala"
    )
      await write(
        `rate:${operator.persona.key}:${material.code}`,
        "rateCards",
        {
          orgId: operator.orgId,
          materialCode: material.code,
          paisePerKg: material.rate,
          updatedAt: now,
        },
      );
  }
}
async function sourcing(
  write: Write,
  seller: Operator,
  buyer: Operator,
  materialCode: string,
  key: string,
  now: number,
) {
  if (buyer.persona.access.kind !== "org")
    throw new ConvexError("DEMO_ORG_REQUIRED");
  const qualificationId = await write(
    `qualification:${key}`,
    "supplierQualifications",
    {
      buyerOrgId: buyer.orgId,
      supplierOrgId: seller.orgId,
      materialCode,
      sampleReference: `DEMO-SAMPLE-${key}`,
      specification: DEMO_NOTICE,
      decision: "approved",
      validUntil: demoDate(now, 90),
      reason: "DEMO buyer's sample decision only; no regulatory approval",
      createdAt: now,
    },
  );
  const agreementId = await write(`agreement:${key}`, "sourcingAgreements", {
    buyerOrgId: buyer.orgId,
    supplierOrgId: seller.orgId,
    qualificationId,
    materialCode,
    reference: `DEMO-AGREEMENT-${key}`,
    specification: DEMO_NOTICE,
    quantityGrams: 500_000,
    paisePerKg: 2400,
    startsOn: demoDate(now),
    endsOn: demoDate(now, 90),
    status: "acknowledged",
    acknowledgementReference: "DEMO supplier acknowledgement",
    closed: false,
    createdAt: now,
  });
  const releaseId = await write(`release:${key}`, "sourcingReleases", {
    agreementId,
    buyerOrgId: buyer.orgId,
    supplierOrgId: seller.orgId,
    reference: `DEMO-RELEASE-${key}`,
    quantityGrams: 50_000,
    neededBy: demoDate(now, 7),
    status: "requested",
    createdAt: now,
  });
  await write(`sourcing-event:${key}`, "sourcingEvents", {
    agreementId,
    releaseId,
    actorOrgId: buyer.orgId,
    action: "release.requested",
    reference: DEMO_NOTICE,
    createdAt: now,
  });
  const demandId = await write(`demand:${key}`, "materialDemands", {
    orgId: buyer.orgId,
    buyerKind: buyer.persona.access.orgKind,
    family:
      DEMO_MATERIALS.find((m) => m.code === materialCode)?.family ?? "plastic",
    createdBy: buyer.profileId,
    materialCode,
    quantityGrams: 100_000,
    city: "Bengaluru",
    area: "DEMO district",
    specification: DEMO_NOTICE,
    neededBy: demoDate(now, 14),
    status: "open",
    createdAt: now,
    updatedAt: now,
  });
  await write(`plan:${key}`, "sourcingPlans", {
    orgId: buyer.orgId,
    materialCode,
    quantityGrams: 100_000,
    area: "DEMO district",
    specification: DEMO_NOTICE,
    everyDays: 7,
    nextNeededBy: demoDate(now, 21),
    status: "active",
    lastPublishedDate: demoDate(now, 14),
    lastDemandId: demandId,
    createdAt: now,
  });
}
async function tradePair(
  write: Write,
  seller: Operator,
  buyer: Operator,
  materialCode: string,
  now: number,
) {
  if (seller.persona.access.kind !== "org")
    throw new ConvexError("DEMO_ORG_REQUIRED");
  const key = `${seller.persona.key}:${buyer.persona.key}`;
  const isByproduct = seller.persona.access.orgKind === "manufacturer";
  const specification = {
    grade: "DEMO Grade A",
    specification: DEMO_NOTICE,
    source: "seller_declared" as const,
  };
  const listingId = await write(`listing:${key}`, "listings", {
    orgId: seller.orgId,
    sellerKind: seller.persona.access.orgKind,
    materialCode,
    grams: 75_000,
    askPaisePerKg: 2400,
    city: "Bengaluru",
    note: DEMO_NOTICE,
    ...(isByproduct && { origin: "manufacturer_byproduct" as const }),
    specification,
    status: "open",
    createdAt: now,
    updatedAt: now,
  });
  const totalPaise = safePaiseFor(25_000, 2400);
  if (totalPaise === null) throw new ConvexError("DEMO_INVALID_TOTAL");
  const tradeId = await write(`trade:${key}`, "trades", {
    listingId,
    sellerOrgId: seller.orgId,
    buyerOrgId: buyer.orgId,
    materialCode,
    grams: 25_000,
    paisePerKg: 2400,
    totalPaise,
    status: "accepted",
    timeline: [
      { status: "requested", at: now - 1000 },
      { status: "accepted", at: now },
    ],
    specification,
    createdAt: now - 1000,
    updatedAt: now,
  });
  await write(`trade-request:${key}`, "trades", {
    listingId,
    sellerOrgId: seller.orgId,
    buyerOrgId: buyer.orgId,
    materialCode,
    grams: 10_000,
    paisePerKg: 2400,
    totalPaise: 24_000,
    status: "requested",
    timeline: [{ status: "requested", at: now }],
    specification,
    createdAt: now,
    updatedAt: now,
  });
  const conversationId = await write(`conversation:${key}`, "conversations", {
    kind: "trade",
    status: "open",
    subject: "DEMO quality and collection discussion",
    tradeId,
    sellerOrgId: seller.orgId,
    buyerOrgId: buyer.orgId,
    createdAt: now,
    updatedAt: now,
  });
  await write(`message:${key}`, "conversationMessages", {
    conversationId,
    senderProfileId: seller.profileId,
    senderRole: "member",
    senderOrgId: seller.orgId,
    body: `${DEMO_NOTICE} Please review the sample specification before requesting a collection.`,
    createdAt: now,
  });
  await write(`evidence:${key}`, "commercialEvidence", {
    orgId: seller.orgId,
    tradeId,
    kind: "gst_invoice",
    reference: `DEMO-NOT-A-TAX-INVOICE-${key}`,
    issuerKind: "trade_seller",
    issuerName: `${seller.persona.name} — fictional`,
    recordedByProfileId: seller.profileId,
    version: 1,
    createdAt: now,
  });
  await sourcing(write, seller, buyer, materialCode, key, now);
}
async function household(
  write: Write,
  shop: Operator,
  profile: Doc<"profiles">,
  saathiId: Id<"saathiProfiles">,
  cohort: number,
  now: number,
) {
  for (const status of ["requested", "accepted", "completed"] as const) {
    const key = `${String(cohort)}:${status}`;
    const bookingId = await write(`booking:${key}`, "bookings", {
      token: `demo-${key}-fictional-booking`,
      householdProfileId: profile._id,
      phone: "+910000000000",
      name: `DEMO household ${String(cohort)}`,
      mode: "pickup",
      items: [{ materialCode: "DEMO-PET-BOTTLE", estKg: 5 }],
      estimatePaise: 12_000,
      orgId: shop.orgId,
      slotDate: demoDate(now, status === "completed" ? -1 : 1),
      slotWindow: "morning",
      address: "DEMO fictional pickup site",
      status,
      timeline:
        status === "completed"
          ? [
              { status: "requested", at: now - 3000 },
              { status: "accepted", at: now - 2000 },
              { status: "completed", at: now - 1000 },
            ]
          : [{ status, at: now }],
      ...(status === "completed" && {
        receipt: {
          lines: [
            {
              materialCode: "DEMO-PET-BOTTLE",
              grams: 5000,
              paisePerKg: 2400,
              paise: 12_000,
            },
          ],
          totalPaise: 12_000,
          method: "cash" as const,
          paidAt: now - 1000,
        },
      }),
      createdAt: now - 3000,
      updatedAt: now,
    });
    await write(`booking-offer:${key}`, "bookingOffers", {
      bookingId,
      orgId: shop.orgId,
      attempt: 1,
      event: status === "requested" ? "offered" : "accepted",
      createdAt: now,
    });
  }
  for (const status of ["open", "assigned", "done"] as const)
    await write(`job:${String(cohort)}:${status}`, "jobs", {
      orgId: shop.orgId,
      city: "Bengaluru",
      kind: "yard_sorting",
      title: `DEMO ${status} sorting shift`,
      area: "DEMO fictional sorting site",
      date: demoDate(now, status === "done" ? -1 : 1),
      window: "morning",
      payPaise: 60_000,
      status,
      ...(status !== "open" && { saathiProfileId: saathiId }),
      createdBy: shop.profileId,
      createdAt: now,
      updatedAt: now,
    });
}
export const seed = internalMutation({
  args: { batchKey: v.string(), cohort: v.number() },
  returns: v.object({
    cohort: v.number(),
    operators: v.number(),
    stakeholders: v.number(),
  }),
  handler: async (ctx, { batchKey, cohort }) => {
    requireInvestorDemoImport(batchKey);
    if (!Number.isSafeInteger(cohort) || cohort < 1 || cohort > 5)
      throw new ConvexError("DEMO_INVALID_COHORT");
    const now = Date.now();
    const write = writer(ctx, batchKey, now);
    const { operators, profiles, stakeholders, shop, saathiId } =
      await identities(ctx, write, batchKey, cohort, now);
    const materials = await catalog(ctx, write, now);
    const evidence = new Map<
      string,
      Awaited<ReturnType<typeof operationalEvidence>>
    >();
    for (const operator of operators.values()) {
      await stock(write, operator, now);
      evidence.set(
        operator.persona.templateKey,
        await operationalEvidence(write, operator, now),
      );
    }
    for (const [sellerKey, buyerKey, code] of [
      ["kabadiwala", "preprocessor", "DEMO-PET-BOTTLE"],
      ["preprocessor", "recycler", "DEMO-PET-FLAKE"],
      ["recycler", "manufacturer", "DEMO-RPET-PELLET"],
      ["manufacturer", "kabadiwala", "DEMO-PAPER-OFFCUT"],
      ["fibre-maker", "textile-maker", "DEMO-PAPER-OFFCUT"],
      ["textile-maker", "garment-maker", "DEMO-PAPER-OFFCUT"],
    ]) {
      const seller = operators.get(sellerKey);
      const buyer = operators.get(buyerKey);
      if (!seller || !buyer) throw new ConvexError("DEMO_COHORT_INCOMPLETE");
      await tradePair(write, seller, buyer, code, now);
    }
    const personal = profiles.get("household");
    if (!personal) throw new ConvexError("DEMO_COHORT_INCOMPLETE");
    await household(write, shop, personal, saathiId, cohort, now);
    const materialId = materials.get("DEMO-PET-BOTTLE");
    if (!materialId) throw new ConvexError("DEMO_MATERIAL_REQUIRED");
    const planId = await write(`route:${String(cohort)}`, "routePlans", {
      orgId: shop.orgId,
      reference: `DEMO-ROUTE-${String(cohort)}`,
      title: "DEMO collection round",
      status: "active",
      revision: 1,
      createdAt: now,
      updatedAt: now,
    });
    const route = {
      title: "DEMO collection round",
      vehicleReference: "DEMO cargo vehicle",
      capacityGrams: 200_000,
      origin: {
        siteReference: "DEMO origin",
        latitude: 12.97,
        longitude: 77.59,
      },
      stops: [
        {
          siteReference: "DEMO stop A",
          latitude: 12.98,
          longitude: 77.6,
          materialId,
          grams: 50_000,
        },
        {
          siteReference: "DEMO stop B",
          latitude: 12.99,
          longitude: 77.61,
          materialId,
          grams: 75_000,
        },
      ],
      ordering: "geometric" as const,
    };
    await write(`route-version:${String(cohort)}`, "routePlanVersions", {
      ...route,
      ...routeGeometry(route),
      planId,
      orgId: shop.orgId,
      revision: 1,
      materialCodes: ["DEMO-PET-BOTTLE", "DEMO-PET-BOTTLE"],
      reason: DEMO_NOTICE,
      actorProfileId: shop.profileId,
      createdAt: now,
    });
    const inspection = evidence.get("kabadiwala");
    if (!inspection) throw new ConvexError("DEMO_INSPECTION_REQUIRED");
    for (const stakeholder of stakeholders)
      await write(
        `report:${String(cohort)}:${stakeholder.id}`,
        "auditReports",
        {
          orgId: shop.orgId,
          recipientId: stakeholder.id,
          recipientProfileId: stakeholder.profileId,
          purpose: DEMO_NOTICE,
          expiresAt: now + 30 * 86_400_000,
          snapshot: {
            materialCode: "DEMO-PET-FLAKE",
            state: "DEMO washed PET flake",
            declaredGrams: 47_000,
            specificationReference: "DEMO-PET-SPEC",
            specificationVersion: "1",
            sampleMethod:
              "DEMO fictional composite sample; not laboratory evidence",
            results: [{ parameter: "DEMO moisture", unit: "%", value: "0.5" }],
            inspectingDecision: "accepted",
            buyerDecisions: [],
            inspectionCreatedAt: now,
          },
          attachmentIds: [],
          inspectionId: inspection.inspectionId,
          createdBy: shop.profileId,
          createdAt: now,
        },
      );
    return {
      cohort,
      operators: operators.size,
      stakeholders: stakeholders.length,
    };
  },
});
export const seedIndustries = internalMutation({
  args: { batchKey: v.string(), offset: v.number(), limit: v.number() },
  returns: v.object({
    nextOffset: v.union(v.number(), v.null()),
    total: v.number(),
  }),
  handler: async (ctx, { batchKey, offset, limit }) => {
    requireInvestorDemoImport(batchKey);
    if (
      !Number.isSafeInteger(offset) ||
      offset < 0 ||
      offset > DEMO_INDUSTRY_ROWS.length ||
      !Number.isSafeInteger(limit) ||
      limit < 1 ||
      limit > 25
    )
      throw new ConvexError("DEMO_INVALID_BATCH");
    const now = Date.now();
    const write = writer(ctx, batchKey, now);
    const manufacturers = INVESTOR_DEMO_ROSTER.filter(
      (p) => p.access.kind === "org" && p.access.orgKind === "manufacturer",
    );
    for (
      let index = offset;
      index < Math.min(offset + limit, DEMO_INDUSTRY_ROWS.length);
      index++
    ) {
      const row = DEMO_INDUSTRY_ROWS[index];
      const persona = manufacturers[index % manufacturers.length];
      const profile = await account(ctx, batchKey, persona);
      const marker = await ctx.db
        .query("investorDemoRecords")
        .withIndex("by_batch_key", (q) =>
          q.eq("batchKey", batchKey).eq("key", `org:${persona.key}`),
        )
        .unique();
      const orgId = marker ? ctx.db.normalizeId("orgs", marker.recordId) : null;
      const org = orgId ? await ctx.db.get("orgs", orgId) : null;
      if (org?.ownerProfileId !== profile._id || org.kind !== "manufacturer")
        throw new ConvexError("DEMO_COHORT_REQUIRED");
      await write(`industry:${row.key}`, "industrialFacilities", {
        orgId: org._id,
        name: `DEMO ${row.name}`,
        siteReference: `DEMO source example; ${row.sourceReference}`,
        ...(row.sector && { sectorId: row.sector.id, sector: row.sector }),
        capabilities: ["manufacturing"],
        revision: 1,
        createdByProfileId: profile._id,
        updatedByProfileId: profile._id,
        createdAt: now,
        updatedAt: now,
      });
    }
    const next = offset + limit;
    return {
      nextOffset: next < DEMO_INDUSTRY_ROWS.length ? next : null,
      total: DEMO_INDUSTRY_ROWS.length,
    };
  },
});

const STATUS_RECORD_LIMIT = 6000;
const allowedManifestTables = new Set<string>([...DEMO_TABLES, "auditLog"]);
function isManifestTable(table: string): table is DemoTable | "auditLog" {
  return allowedManifestTables.has(table);
}
async function markedRows<T extends DemoTable | "auditLog">(
  ctx: QueryCtx,
  markers: readonly Doc<"investorDemoRecords">[],
  table: T,
) {
  const rows: { key: string; row: Doc<T> }[] = [];
  let missing = 0;
  for (const marker of markers) {
    if (marker.table !== table) continue;
    const id = ctx.db.normalizeId(table, marker.recordId);
    const row = id ? await ctx.db.get(table, id) : null;
    if (row) rows.push({ key: marker.key, row });
    else missing++;
  }
  return { rows, missing };
}
function increment(map: Map<string, number>, key: string, amount = 1) {
  map.set(key, (map.get(key) ?? 0) + amount);
}
function batchCommitments(
  listings: { row: Doc<"listings"> }[],
  trades: { row: Doc<"trades"> }[],
) {
  const commitments = new Map<string, number>();
  for (const { row } of listings)
    if (row.status === "open")
      increment(commitments, `${row.orgId}:${row.materialCode}`, row.grams);
  for (const { row } of trades)
    if (row.status === "accepted" || row.status === "paid_to_escrow")
      increment(
        commitments,
        `${row.sellerOrgId}:${row.materialCode}`,
        row.grams,
      );
  return commitments;
}
async function stockIntegrity(
  ctx: QueryCtx,
  markers: readonly Doc<"investorDemoRecords">[],
) {
  const [stocks, intakes, listings, trades, audits] = await Promise.all([
    markedRows(ctx, markers, "inventory"),
    markedRows(ctx, markers, "manufacturerStockIntakes"),
    markedRows(ctx, markers, "listings"),
    markedRows(ctx, markers, "trades"),
    markedRows(ctx, markers, "auditLog"),
  ]);
  const auditsByKey = new Map(audits.rows.map((item) => [item.key, item.row]));
  const stockByPair = new Map(
    stocks.rows.map((item) => [
      `${item.row.orgId}:${item.row.materialCode}`,
      item.row,
    ]),
  );
  const commitments = batchCommitments(listings.rows, trades.rows);
  let invalidIntegerRows = 0;
  let baselineChangedRows = 0;
  let missingAuditRows = 0;
  for (const { key, row } of stocks.rows) {
    if (!Number.isSafeInteger(row.grams) || row.grams < 0) invalidIntegerRows++;
    if (row.grams !== 500_000) baselineChangedRows++;
    const audit = auditsByKey.get(`audit:${key}`);
    if (
      audit?.action !== "inventory.adjusted" ||
      audit.entityTable !== "inventory" ||
      audit.entityId !== row._id
    )
      missingAuditRows++;
  }
  let intakeMismatchRows = 0;
  for (const { row } of intakes.rows) {
    const stock = stockByPair.get(`${row.orgId}:${row.materialCode}`);
    if (
      !Number.isSafeInteger(row.grams) ||
      row.grams !== 500_000 ||
      stock?.grams !== row.grams
    )
      intakeMismatchRows++;
  }
  let commitmentExcessPairs = 0;
  for (const [key, grams] of commitments) {
    const stock = stockByPair.get(key);
    if (
      !stock ||
      !Number.isSafeInteger(grams) ||
      grams < 0 ||
      grams > stock.grams
    )
      commitmentExcessPairs++;
  }
  return {
    checkedRows: stocks.rows.length,
    missingRows: stocks.missing,
    invalidIntegerRows,
    baselineChangedRows,
    missingAuditRows,
    intakeMismatchRows,
    commitmentExcessPairs,
  };
}
async function scopedPaymentObservations(
  ctx: QueryCtx,
  markers: readonly Doc<"investorDemoRecords">[],
) {
  const trades = await markedRows(ctx, markers, "trades");
  const orgs = await markedRows(ctx, markers, "orgs");
  let tradesWithProviderOrders = 0;
  let tradesWithFinancialRecords = 0;
  let tradesWithFinancialMovements = 0;
  let orgsWithProviderVendors = 0;
  for (const { row } of trades.rows) {
    const [orders, financials, movements] = await Promise.all([
      ctx.db
        .query("cashfreeOrders")
        .withIndex("by_trade_mode", (q) => q.eq("tradeId", row._id))
        .take(1),
      ctx.db
        .query("tradeFinancials")
        .withIndex("by_trade", (q) => q.eq("tradeId", row._id))
        .take(1),
      ctx.db
        .query("financialMovements")
        .withIndex("by_trade_kind", (q) => q.eq("tradeId", row._id))
        .take(1),
    ]);
    if (orders.length > 0) tradesWithProviderOrders++;
    if (financials.length > 0) tradesWithFinancialRecords++;
    if (movements.length > 0) tradesWithFinancialMovements++;
  }
  for (const { row } of orgs.rows) {
    const vendors = await ctx.db
      .query("cashfreeVendors")
      .withIndex("by_org_mode", (q) => q.eq("orgId", row._id))
      .take(1);
    if (vendors.length > 0) orgsWithProviderVendors++;
  }
  return {
    tradesWithProviderOrders,
    tradesWithFinancialRecords,
    tradesWithFinancialMovements,
    orgsWithProviderVendors,
  };
}

async function accountObservations(
  ctx: QueryCtx,
  accounts: Doc<"investorDemoAccounts">[],
) {
  let invalidAccountCount = 0;
  let nonMemberProfileCount = 0;
  let scopedAdminProfileCount = 0;
  const accountCohorts = new Map<string, number>();
  const seenPersonas = new Set<string>();
  for (const account of accounts) {
    const persona = INVESTOR_DEMO_ROSTER.find(
      (p) => p.key === account.personaKey,
    );
    const profile = await ctx.db.get("profiles", account.profileId);
    if (
      account.email !== persona?.email ||
      profile?.authUserId !== account.authUserId ||
      seenPersonas.has(account.personaKey)
    )
      invalidAccountCount++;
    if (profile && profile.kind !== "member") nonMemberProfileCount++;
    const admins = await ctx.db
      .query("adminProfiles")
      .withIndex("by_profileId", (q) => q.eq("profileId", account.profileId))
      .take(1);
    if (admins.length > 0) scopedAdminProfileCount++;
    if (persona) increment(accountCohorts, String(persona.cohort));
    seenPersonas.add(account.personaKey);
  }
  return {
    invalidAccountCount,
    nonMemberProfileCount,
    scopedAdminProfileCount,
    accountCohorts,
  };
}

const inventorySummary = v.object({
  checkedRows: v.number(),
  missingRows: v.number(),
  invalidIntegerRows: v.number(),
  baselineChangedRows: v.number(),
  missingAuditRows: v.number(),
  intakeMismatchRows: v.number(),
  commitmentExcessPairs: v.number(),
});
const paymentSummary = v.object({
  tradesWithProviderOrders: v.number(),
  tradesWithFinancialRecords: v.number(),
  tradesWithFinancialMovements: v.number(),
  orgsWithProviderVendors: v.number(),
});
function requireBatch(batchKey: string) {
  if (batchKey !== INVESTOR_DEMO_BATCH)
    throw new ConvexError("DEMO_INVALID_BATCH");
}
/** Counts only: at most3951 manifest rows +141 receipts, below4096 reads.
 * Detailed record checks are paginated; operational checks run one cohort at a time.
 */
export const status = internalQuery({
  args: { batchKey: v.string() },
  returns: v.object({
    batchKey: v.string(),
    scope: v.literal("batch_manifest_counts_only"),
    accountCount: v.number(),
    expectedAccountCount: v.number(),
    truncated: v.boolean(),
    invalidAccountCount: v.number(),
    cohorts: v.array(
      v.object({
        cohort: v.number(),
        accounts: v.number(),
        expectedAccounts: v.number(),
        organisations: v.number(),
      }),
    ),
    markerCount: v.number(),
    duplicateMarkerKeys: v.number(),
    duplicateRecordReferences: v.number(),
    unexpectedTableMarkers: v.number(),
    recordCounts: v.array(v.object({ table: v.string(), count: v.number() })),
  }),
  handler: async (ctx, { batchKey }) => {
    requireBatch(batchKey);
    const accounts = await ctx.db
      .query("investorDemoAccounts")
      .withIndex("by_batch_persona", (q) => q.eq("batchKey", batchKey))
      .take(INVESTOR_DEMO_ROSTER.length + 1);
    const allMarkers = await ctx.db
      .query("investorDemoRecords")
      .withIndex("by_batch", (q) => q.eq("batchKey", batchKey))
      .take(STATUS_RECORD_LIMIT + 1);
    const markers = allMarkers.slice(0, STATUS_RECORD_LIMIT);
    const isTruncated =
      accounts.length > INVESTOR_DEMO_ROSTER.length ||
      allMarkers.length > STATUS_RECORD_LIMIT;
    const accountCohorts = new Map<string, number>();
    const seenPersonas = new Set<string>();
    let invalidAccountCount = 0;
    for (const account of accounts) {
      const persona = INVESTOR_DEMO_ROSTER.find(
        (p) => p.key === account.personaKey,
      );
      if (
        account.email !== persona?.email ||
        seenPersonas.has(account.personaKey)
      )
        invalidAccountCount++;
      if (persona) increment(accountCohorts, String(persona.cohort));
      seenPersonas.add(account.personaKey);
    }
    const keyCounts = new Map<string, number>();
    const recordReferences = new Set<string>();
    const counts = new Map<string, number>();
    let duplicateRecordReferences = 0;
    let unexpectedTableMarkers = 0;
    for (const marker of markers) {
      increment(keyCounts, marker.key);
      increment(counts, marker.table);
      const reference = `${marker.table}:${marker.recordId}`;
      if (recordReferences.has(reference)) duplicateRecordReferences++;
      recordReferences.add(reference);
      if (!isManifestTable(marker.table)) unexpectedTableMarkers++;
    }
    const orgMarkers = new Set(
      markers.filter((m) => m.table === "orgs").map((m) => m.key),
    );
    const cohorts = Array.from({ length: 5 }, (_, index) => index + 1).map(
      (cohort) => ({
        cohort,
        accounts: accountCohorts.get(String(cohort)) ?? 0,
        expectedAccounts: INVESTOR_DEMO_ROSTER.filter(
          (p) => p.cohort === cohort,
        ).length,
        organisations: INVESTOR_DEMO_ROSTER.filter(
          (p) => p.cohort === cohort && orgMarkers.has(`org:${p.key}`),
        ).length,
      }),
    );
    return {
      batchKey,
      scope: "batch_manifest_counts_only" as const,
      accountCount: accounts.length,
      expectedAccountCount: INVESTOR_DEMO_ROSTER.length,
      truncated: isTruncated,
      invalidAccountCount,
      cohorts,
      markerCount: markers.length,
      duplicateMarkerKeys: [...keyCounts.values()].filter((count) => count > 1)
        .length,
      duplicateRecordReferences,
      unexpectedTableMarkers,
      recordCounts: [...counts]
        .filter(([table]) => isManifestTable(table))
        .map(([table, count]) => ({ table, count }))
        .toSorted((a, b) => a.table.localeCompare(b.table)),
    };
  },
});
/** At most100 marker rows plus100 referenced rows, no writes or sensitive output. */
export const verifySlice = internalQuery({
  args: {
    batchKey: v.string(),
    cursor: v.union(v.string(), v.null()),
    limit: v.number(),
  },
  returns: v.object({
    cursor: v.string(),
    isDone: v.boolean(),
    checkedRecords: v.number(),
    missingRecords: v.number(),
    unexpectedTableMarkers: v.number(),
  }),
  handler: async (ctx, { batchKey, cursor, limit }) => {
    requireBatch(batchKey);
    if (!Number.isSafeInteger(limit) || limit < 1 || limit > 100)
      throw new ConvexError("DEMO_INVALID_BATCH");
    const result = await ctx.db
      .query("investorDemoRecords")
      .withIndex("by_batch", (q) => q.eq("batchKey", batchKey))
      .paginate({ cursor, numItems: limit });
    let missingRecords = 0;
    let unexpectedTableMarkers = 0;
    for (const marker of result.page) {
      if (!isManifestTable(marker.table)) {
        unexpectedTableMarkers++;
        continue;
      }
      const id = ctx.db.normalizeId(marker.table, marker.recordId);
      if (!id || !(await ctx.db.get(marker.table, id))) missingRecords++;
    }
    return {
      cursor: result.continueCursor,
      isDone: result.isDone,
      checkedRecords: result.page.length,
      missingRecords,
      unexpectedTableMarkers,
    };
  },
});
function integrityKeys(cohort: number) {
  const personas = INVESTOR_DEMO_ROSTER.filter(
    (p) => p.cohort === cohort && p.access.kind === "org",
  );
  const keys: string[] = [];
  for (const persona of personas) {
    keys.push(`org:${persona.key}`);
    for (const material of DEMO_MATERIALS) {
      keys.push(
        `stock:${persona.key}:${material.code}`,
        `audit:stock:${persona.key}:${material.code}`,
      );
      if (
        persona.access.kind === "org" &&
        persona.access.orgKind === "manufacturer" &&
        material.stage === "scrap"
      )
        keys.push(`intake:${persona.key}:${material.code}`);
    }
  }
  for (const [seller, buyer] of [
    ["kabadiwala", "preprocessor"],
    ["preprocessor", "recycler"],
    ["recycler", "manufacturer"],
    ["manufacturer", "kabadiwala"],
    ["fibre-maker", "textile-maker"],
    ["textile-maker", "garment-maker"],
  ]) {
    const pair = `${seller}-${String(cohort)}:${buyer}-${String(cohort)}`;
    keys.push(`listing:${pair}`, `trade:${pair}`, `trade-request:${pair}`);
  }
  return keys;
}
/** Seed baseline only, not reconciliation of subsequent arbitrary stock movements.
 * Reads142 exact cohort markers, their bounded references and28 account receipts.
 */
export const integrity = internalQuery({
  args: { batchKey: v.string(), cohort: v.number() },
  returns: v.object({
    cohort: v.number(),
    accountCount: v.number(),
    expectedMarkers: v.number(),
    missingMarkers: v.number(),
    invalidAccountCount: v.number(),
    nonMemberProfileCount: v.number(),
    scopedAdminProfileCount: v.number(),
    inventory: inventorySummary,
    paymentObservations: paymentSummary,
  }),
  handler: async (ctx, { batchKey, cohort }) => {
    requireBatch(batchKey);
    if (!Number.isSafeInteger(cohort) || cohort < 1 || cohort > 5)
      throw new ConvexError("DEMO_INVALID_COHORT");
    const keys = integrityKeys(cohort);
    const markers: Doc<"investorDemoRecords">[] = [];
    for (const key of keys) {
      const marker = await ctx.db
        .query("investorDemoRecords")
        .withIndex("by_batch_key", (q) =>
          q.eq("batchKey", batchKey).eq("key", key),
        )
        .unique();
      if (marker) markers.push(marker);
    }
    const accounts: Doc<"investorDemoAccounts">[] = [];
    for (const persona of INVESTOR_DEMO_ROSTER) {
      if (persona.cohort !== cohort) continue;
      const account = await ctx.db
        .query("investorDemoAccounts")
        .withIndex("by_batch_persona", (q) =>
          q.eq("batchKey", batchKey).eq("personaKey", persona.key),
        )
        .unique();
      if (account) accounts.push(account);
    }
    const {
      invalidAccountCount,
      nonMemberProfileCount,
      scopedAdminProfileCount,
    } = await accountObservations(ctx, accounts);
    return {
      cohort,
      accountCount: accounts.length,
      expectedMarkers: keys.length,
      missingMarkers: keys.length - markers.length,
      invalidAccountCount,
      nonMemberProfileCount,
      scopedAdminProfileCount,
      inventory: await stockIntegrity(ctx, markers),
      paymentObservations: await scopedPaymentObservations(ctx, markers),
    };
  },
});
