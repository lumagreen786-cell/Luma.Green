/// <reference types="vite/client" />
// @vitest-environment edge-runtime
import { convexTest } from "convex-test";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { api, internal } from "./_generated/api";
import {
  convexModules,
  registerAuth,
  seedDemo,
  signIn,
  signInAs,
} from "./lib/auth.testing";
import schema from "./schema";
const modules = convexModules(import.meta.glob("./**/*.*s"));
beforeEach(() => {
  vi.stubEnv("AUTH_DEV_MODE", "true");
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-10-27T06:00:00Z"));
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.useRealTimers();
});
async function world() {
  const t = convexTest(schema, modules);
  registerAuth(t);
  await seedDemo(t);
  const creator = await signInAs(t, "+919000000101"),
    recipient = await signInAs(t, "+919000000105"),
    other = await signInAs(t, "+919000000109");
  const ids = await t.run(async (ctx) => {
    const org = await ctx.db
        .query("orgs")
        .withIndex("by_slug", (q) => q.eq("slug", "ramesh-kabadi-store"))
        .unique(),
      receiver = await ctx.db
        .query("profiles")
        .withIndex("by_phone", (q) => q.eq("phone", "+919000000105"))
        .unique();
    if (!org || !receiver) throw new Error("Missing fixture");
    const accountId = await ctx.db.insert("stakeholderAccounts", {
      ownerProfileId: receiver._id,
      kind: "csr_sponsor",
      organizationName: "Isolated test recipient",
      status: "approved",
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
    return { orgId: org._id, accountId, receiverProfileId: receiver._id };
  });
  return { t, creator, recipient, other, ...ids };
}
const ENQUIRY = {
  operationKey: "enquiry-operation-001",
  kind: "finance" as const,
  commercialModel: "partner_service" as const,
  principalParty: "",
  title: "Finance referral request",
  details: "Private applicant information for the chosen recipient",
  shareMaterialLotReference: false,
};
const PROGRAMME = {
  operationKey: "programme-operation-001",
  title: "Test area reported collection",
  area: "Ward test area",
  startsOn: "2026-10-01",
  endsOn: "2026-10-31",
  stream: "Dry recyclables",
  coverageCount: 40,
  trips: 7,
  centreHandovers: 3,
  quantityGrams: 1_000_001,
  groupIncomePaise: 45_001,
  evidenceReference: "Private evidence contains no verified official approval",
};
describe("private service enquiries", () => {
  it.each(["suspended", "viewer"] as const)(
    "keeps creator records readable but blocks every scoped write for %s access",
    async (access) => {
      const w = await world();
      const enquiryId = await w.creator.mutation(api.services.createEnquiry, {
        ...ENQUIRY,
        orgId: w.orgId,
        recipientId: w.accountId,
      });
      const programmeId = await w.creator.mutation(
        api.services.createProgramme,
        {
          ...PROGRAMME,
          orgId: w.orgId,
        },
      );
      const reportId = await w.creator.mutation(api.services.shareProgramme, {
        programmeId,
        recipientId: w.accountId,
        operationKey: "readonly-share-before-change",
        purpose: "Reported collection summary",
        expiresAt: Date.now() + 86_400_000,
      });
      await w.t.run(async (ctx) => {
        if (access === "suspended") {
          await ctx.db.patch("orgs", w.orgId, { status: "suspended" });
        } else {
          const membership = await ctx.db
            .query("memberships")
            .withIndex("by_org", (q) => q.eq("orgId", w.orgId))
            .first();
          if (!membership) throw new Error("Missing creator membership");
          await ctx.db.patch("memberships", membership._id, { role: "viewer" });
        }
      });
      const board = await w.creator.query(api.services.board, {});
      expect(board).toMatchObject({ orgId: w.orgId, canCreate: false });
      expect(board.enquiries).toContainEqual(
        expect.objectContaining({ id: enquiryId, canEdit: false }),
      );
      expect(board.programmes).toContainEqual(
        expect.objectContaining({ id: programmeId, canEdit: false }),
      );
      expect(board.reports).toContainEqual(
        expect.objectContaining({ id: reportId, canRevoke: false }),
      );
      await expect(
        w.creator.query(api.services.enquiry, { id: enquiryId }),
      ).resolves.toMatchObject({ canEdit: false });
      await expect(
        w.creator.query(api.services.programme, { id: programmeId }),
      ).resolves.toMatchObject({ canEdit: false });
      await expect(
        w.creator.query(api.services.report, { id: reportId }),
      ).resolves.toMatchObject({ canRevoke: false });
      await expect(
        w.creator.mutation(api.services.createEnquiry, {
          ...ENQUIRY,
          operationKey: "readonly-new-enquiry",
          orgId: w.orgId,
        }),
      ).rejects.toThrow("RECORD_ACCESS_DENIED");
      await expect(
        w.creator.mutation(api.services.createProgramme, {
          ...PROGRAMME,
          operationKey: "readonly-new-programme",
          orgId: w.orgId,
        }),
      ).rejects.toThrow("RECORD_ACCESS_DENIED");
      await expect(
        w.creator.mutation(api.services.updateEnquiry, {
          id: enquiryId,
          version: 1,
          title: ENQUIRY.title,
          details: ENQUIRY.details,
          state: "enquiry",
        }),
      ).rejects.toThrow("RECORD_ACCESS_DENIED");
      const { operationKey, ...programmeFields } = PROGRAMME;
      expect(operationKey).toBe("programme-operation-001");
      await expect(
        w.creator.mutation(api.services.updateProgramme, {
          ...programmeFields,
          orgId: w.orgId,
          id: programmeId,
          version: 1,
          state: "closed",
        }),
      ).rejects.toThrow("RECORD_ACCESS_DENIED");
      await expect(
        w.creator.mutation(api.services.shareProgramme, {
          programmeId,
          recipientId: w.accountId,
          operationKey: "readonly-new-share",
          purpose: "Reported collection summary",
          expiresAt: Date.now() + 86_400_000,
        }),
      ).rejects.toThrow("RECORD_ACCESS_DENIED");
      await expect(
        w.creator.mutation(api.services.revokeProgrammeShare, { id: reportId }),
      ).rejects.toThrow("RECORD_ACCESS_DENIED");
      await expect(
        w.creator.mutation(api.services.revokeEnquiryRecipient, {
          id: enquiryId,
        }),
      ).rejects.toThrow("RECORD_ACCESS_DENIED");
      await w.t.run(async (ctx) => {
        const memberships = await ctx.db
          .query("memberships")
          .withIndex("by_org", (q) => q.eq("orgId", w.orgId))
          .take(100);
        for (const membership of memberships)
          await ctx.db.delete("memberships", membership._id);
      });
      await expect(
        w.creator.query(api.services.enquiry, { id: enquiryId }),
      ).rejects.toThrow("RECORD_ACCESS_DENIED");
      await expect(
        w.creator.query(api.services.programme, { id: programmeId }),
      ).rejects.toThrow("RECORD_ACCESS_DENIED");
      await expect(
        w.creator.query(api.services.report, { id: reportId }),
      ).rejects.toThrow("RECORD_ACCESS_DENIED");
      const removed = await w.creator.query(api.services.board, {});
      expect(removed.enquiries).toEqual([]);
      expect(removed.programmes).toEqual([]);
      expect(removed.reports).toEqual([]);
    },
  );
  it("deduplicates creation and refuses a changed payload on the same operation key", async () => {
    const w = await world();
    const args = { ...ENQUIRY, orgId: w.orgId, recipientId: w.accountId };
    const id = await w.creator.mutation(api.services.createEnquiry, args);
    expect(await w.creator.mutation(api.services.createEnquiry, args)).toBe(id);
    await expect(
      w.creator.mutation(api.services.createEnquiry, {
        ...args,
        title: "Different request",
      }),
    ).rejects.toThrow("OPERATION_KEY_REUSED");
    expect(
      await w.t.run((ctx) => ctx.db.query("serviceEnquiries").take(10)),
    ).toHaveLength(1);
  });
  it("keeps drafts private and permits only the chosen approved recipient after submission", async () => {
    const w = await world();
    const id = await w.creator.mutation(api.services.createEnquiry, {
      ...ENQUIRY,
      recipientId: w.accountId,
    });
    await expect(
      w.recipient.query(api.services.enquiry, { id }),
    ).rejects.toThrow("RECORD_ACCESS_DENIED");
    await w.creator.mutation(api.services.updateEnquiry, {
      id,
      version: 1,
      title: ENQUIRY.title,
      details: ENQUIRY.details,
      state: "enquiry",
    });
    expect(await w.recipient.query(api.services.enquiry, { id })).toMatchObject(
      { providerStatus: "unavailable", canEdit: false },
    );
    await expect(w.other.query(api.services.enquiry, { id })).rejects.toThrow(
      "RECORD_ACCESS_DENIED",
    );
    await expect(
      w.recipient.mutation(api.services.updateEnquiry, {
        id,
        version: 2,
        title: ENQUIRY.title,
        details: ENQUIRY.details,
        state: "closed",
      }),
    ).rejects.toThrow("RECORD_ACCESS_DENIED");
    await w.t.run((ctx) =>
      ctx.db.patch("stakeholderAccounts", w.accountId, { status: "rejected" }),
    );
    const hidden = await w.recipient.query(api.services.board, {});
    expect(hidden.received).toEqual([]);
    await expect(
      w.recipient.query(api.services.enquiry, { id }),
    ).rejects.toThrow("RECORD_ACCESS_DENIED");
  });
  it("rejects a foreign workspace and does not share a creator's private request with coworkers", async () => {
    const w = await world();
    await expect(
      w.other.mutation(api.services.createEnquiry, {
        ...ENQUIRY,
        orgId: w.orgId,
      }),
    ).rejects.toThrow("RECORD_ACCESS_DENIED");
    const id = await w.creator.mutation(api.services.createEnquiry, {
      ...ENQUIRY,
      orgId: w.orgId,
    });
    await w.t.run(async (ctx) => {
      await ctx.db.insert("memberships", {
        orgId: w.orgId,
        profileId: w.receiverProfileId,
        role: "member",
        createdAt: Date.now(),
      });
      await ctx.db.patch("profiles", w.receiverProfileId, {
        activeOrgId: w.orgId,
      });
    });
    await expect(
      w.recipient.query(api.services.enquiry, { id }),
    ).rejects.toThrow("RECORD_ACCESS_DENIED");
  });
  it("permits TOTP-authenticated platform admin reads without giving another member access", async () => {
    const w = await world();
    vi.stubEnv("ADMIN_EMAIL", "admin@luma.test");
    const admin = await signIn(w.t, {
      email: "admin@luma.test",
      twoFactorEnabled: true,
    });
    await admin.mutation(api.identity.ensureProfile, { locale: "en" });
    const id = await w.creator.mutation(api.services.createEnquiry, ENQUIRY);
    expect(await admin.query(api.services.enquiry, { id })).toMatchObject({
      title: ENQUIRY.title,
      canEdit: false,
    });
  });
});
describe("programme aggregate grants", () => {
  it("shares only a fixed aggregate snapshot and revokes later recipient reads", async () => {
    const w = await world();
    const id = await w.creator.mutation(api.services.createProgramme, {
      ...PROGRAMME,
      orgId: w.orgId,
    });
    const args = {
      programmeId: id,
      recipientId: w.accountId,
      operationKey: "programme-share-operation-001",
      purpose: "Review area totals only",
      expiresAt: Date.now() + 86_400_000,
    };
    const reportId = await w.creator.mutation(
      api.services.shareProgramme,
      args,
    );
    expect(await w.creator.mutation(api.services.shareProgramme, args)).toBe(
      reportId,
    );
    const report = await w.recipient.query(api.services.report, {
      id: reportId,
    });
    expect(report).toMatchObject({
      quantityGrams: 1_000_001,
      groupIncomePaise: 45_001,
      sourceQuality: "reported_unverified",
    });
    expect(JSON.stringify(report)).not.toContain(PROGRAMME.evidenceReference);
    await expect(
      w.recipient.query(api.services.programme, { id }),
    ).rejects.toThrow("RECORD_ACCESS_DENIED");
    await expect(
      w.other.query(api.services.report, { id: reportId }),
    ).rejects.toThrow("RECORD_ACCESS_DENIED");
    const programmeChanges = {
      title: PROGRAMME.title,
      area: PROGRAMME.area,
      startsOn: PROGRAMME.startsOn,
      endsOn: PROGRAMME.endsOn,
      stream: PROGRAMME.stream,
      coverageCount: PROGRAMME.coverageCount,
      trips: PROGRAMME.trips,
      centreHandovers: PROGRAMME.centreHandovers,
      quantityGrams: PROGRAMME.quantityGrams,
      groupIncomePaise: PROGRAMME.groupIncomePaise,
      evidenceReference: PROGRAMME.evidenceReference,
    };
    await w.creator.mutation(api.services.updateProgramme, {
      ...programmeChanges,
      orgId: w.orgId,
      id,
      version: 1,
      state: "draft",
      quantityGrams: 2_000_000,
    });
    const fixed = await w.recipient.query(api.services.report, {
      id: reportId,
    });
    expect(fixed.quantityGrams).toBe(1_000_001);
    await w.creator.mutation(api.services.revokeProgrammeShare, {
      id: reportId,
    });
    await w.creator.mutation(api.services.revokeProgrammeShare, {
      id: reportId,
    });
    await expect(
      w.recipient.query(api.services.report, { id: reportId }),
    ).rejects.toThrow("RECORD_ACCESS_DENIED");
  });
  it("rejects unapproved recipients, reversed periods and fractional or negative quantities", async () => {
    const w = await world();
    await expect(
      w.creator.mutation(api.services.createProgramme, {
        ...PROGRAMME,
        quantityGrams: 0.1,
      }),
    ).rejects.toThrow("INVALID_QUANTITY");
    await expect(
      w.creator.mutation(api.services.createProgramme, {
        ...PROGRAMME,
        groupIncomePaise: -1,
      }),
    ).rejects.toThrow("INVALID_QUANTITY");
    await expect(
      w.creator.mutation(api.services.createProgramme, {
        ...PROGRAMME,
        startsOn: "2026-11-01",
      }),
    ).rejects.toThrow("INVALID_PERIOD");
    const id = await w.creator.mutation(
      api.services.createProgramme,
      PROGRAMME,
    );
    await w.t.run((ctx) =>
      ctx.db.patch("stakeholderAccounts", w.accountId, { status: "pending" }),
    );
    await expect(
      w.creator.mutation(api.services.shareProgramme, {
        programmeId: id,
        recipientId: w.accountId,
        operationKey: "denied-share-operation",
        purpose: "Review totals",
        expiresAt: Date.now() + 86_400_000,
      }),
    ).rejects.toThrow("RECIPIENT_UNAVAILABLE");
  });
  it("seeds reference labels without inventing approved providers", async () => {
    const w = await world();
    expect(await w.t.mutation(internal.services.seedReferenceKinds, {})).toBe(
      17,
    );
    const firstAudit = await referenceAudits(w.t);
    expect(firstAudit).toHaveLength(17);
    expect(firstAudit.every((row) => row.actorProfileId === undefined)).toBe(
      true,
    );
    expect(await w.t.mutation(internal.services.seedReferenceKinds, {})).toBe(
      0,
    );
    expect(await referenceAudits(w.t)).toEqual(firstAudit);
    expect(
      await w.t.run((ctx) => ctx.db.query("stakeholderAccounts").take(10)),
    ).toHaveLength(1);
  });
});

it("derives all commercial payment directions and shares only an explicitly selected material summary", async () => {
  const w = await world();
  const models = {
    partner_service: "not_applicable",
    materials_sale_reference: "buyer_to_seller",
    toll_jobwork: "principal_to_processor",
    paid_collection: "customer_to_service",
    generator_paid_treatment: "generator_to_handler",
  } as const;
  const lotId = await w.t.run(async (ctx) => {
    const profile = await ctx.db
      .query("profiles")
      .withIndex("by_phone", (q) => q.eq("phone", "+919000000101"))
      .unique();
    if (!profile) throw new Error("Missing creator");
    return ctx.db.insert("materialLots", {
      orgId: w.orgId,
      declaredByOrgId: w.orgId,
      createdByProfileId: profile._id,
      materialCode: "PAPER-NEWS",
      state: "reported_sorted",
      sourceKind: "self_declared",
      initialGrams: 1001,
      availableGrams: 1001,
      status: "available",
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
  });
  for (const model of Object.keys(models) as (keyof typeof models)[]) {
    const args = {
      ...ENQUIRY,
      operationKey: `model-${model}-operation`,
      commercialModel: model,
      principalParty: "Declared principal company",
      orgId: w.orgId,
      recipientId: w.accountId,
      materialLotId: lotId,
      shareMaterialLotReference: model === "toll_jobwork",
    };
    const id = await w.creator.mutation(api.services.createEnquiry, args);
    await w.creator.mutation(api.services.updateEnquiry, {
      id,
      version: 1,
      title: args.title,
      details: args.details,
      state: "enquiry",
    });
    const record = await w.recipient.query(api.services.enquiry, { id });
    expect(record.paymentDirection).toBe(models[model]);
    if (model === "toll_jobwork")
      expect(record.materialSnapshot).toEqual({
        materialCode: "PAPER-NEWS",
        declaredGrams: 1001,
      });
    else expect(record.materialSnapshot).toBeUndefined();
    expect(JSON.stringify(record)).not.toContain(lotId);
  }
  const lot = await w.t.run((ctx) => ctx.db.get("materialLots", lotId));
  expect(lot?.availableGrams).toBe(1001);
  await expect(
    w.other.mutation(api.services.createEnquiry, {
      ...ENQUIRY,
      operationKey: "foreign-material-reference",
      materialLotId: lotId,
      shareMaterialLotReference: true,
    }),
  ).rejects.toThrow("RECORD_ACCESS_DENIED");
});

it("links referral complaints only for current service or programme readers and withdraws recipient access", async () => {
  const w = await world();
  const id = await w.creator.mutation(api.services.createEnquiry, {
    ...ENQUIRY,
    recipientId: w.accountId,
  });
  await w.creator.mutation(api.services.updateEnquiry, {
    id,
    version: 1,
    title: ENQUIRY.title,
    details: ENQUIRY.details,
    state: "enquiry",
  });
  const programmeId = await w.creator.mutation(
    api.services.createProgramme,
    PROGRAMME,
  );
  const message = {
    name: "Test Member",
    phone: "9000000105",
    role: "saathi" as const,
    topic: "other" as const,
    message: "Provider referral complaint details",
    source: { kind: "serviceEnquiry" as const, id },
  };
  await w.recipient.mutation(api.support.send, message);
  await expect(w.other.mutation(api.support.send, message)).rejects.toThrow(
    "RECORD_ACCESS_DENIED",
  );
  const links = await w.creator.query(api.support.linkedSources, {});
  expect(
    links.some(
      (item) => item.source.kind === "serviceEnquiry" && item.source.id === id,
    ),
  ).toBe(true);
  expect(
    links.some(
      (item) =>
        item.source.kind === "programme" && item.source.id === programmeId,
    ),
  ).toBe(true);
  await w.creator.mutation(api.services.revokeEnquiryRecipient, { id });
  await w.creator.mutation(api.services.revokeEnquiryRecipient, { id });
  await expect(w.recipient.query(api.services.enquiry, { id })).rejects.toThrow(
    "RECORD_ACCESS_DENIED",
  );
  await expect(w.recipient.mutation(api.support.send, message)).rejects.toThrow(
    "RECORD_ACCESS_DENIED",
  );
  await expect(
    w.recipient.mutation(api.support.send, {
      ...message,
      source: { kind: "programme", id: programmeId },
    }),
  ).rejects.toThrow("RECORD_ACCESS_DENIED");
});

it("expires abandoned private service drafts and preserves open issues and published programme evidence", async () => {
  const w = await world();
  const abandoned = await w.creator.mutation(
      api.services.createEnquiry,
      ENQUIRY,
    ),
    held = await w.creator.mutation(api.services.createEnquiry, {
      ...ENQUIRY,
      operationKey: "held-enquiry-operation",
    }),
    programmeId = await w.creator.mutation(
      api.services.createProgramme,
      PROGRAMME,
    );
  await w.creator.mutation(api.services.shareProgramme, {
    programmeId,
    recipientId: w.accountId,
    operationKey: "retained-evidence-share",
    purpose: "Review reported aggregates",
    expiresAt: Date.now() + 86_400_000,
  });
  await w.creator.mutation(api.support.send, {
    name: "Test Creator",
    phone: "9000000101",
    role: "kabadiwala",
    topic: "other",
    message: "Keep this draft while checking my question",
    source: { kind: "serviceEnquiry", id: held },
  });
  await w.t.run(async (ctx) => {
    await ctx.db.patch("serviceEnquiries", abandoned, {
      updatedAt: Date.now() - 31 * 86_400_000,
    });
    await ctx.db.patch("serviceEnquiries", held, {
      updatedAt: Date.now() - 31 * 86_400_000,
    });
    await ctx.db.patch("programmeRecords", programmeId, {
      updatedAt: Date.now() - 31 * 86_400_000,
    });
  });
  await w.t.mutation(internal.services.expireDrafts, {});
  await w.t.mutation(internal.services.expireDrafts, { kind: "programme" });
  expect(
    await w.t.run((ctx) => ctx.db.get("serviceEnquiries", abandoned)),
  ).toBeNull();
  expect(
    await w.t.run((ctx) => ctx.db.get("serviceEnquiries", held)),
  ).not.toBeNull();
  expect(
    await w.t.run((ctx) => ctx.db.get("programmeRecords", programmeId)),
  ).not.toBeNull();
});

it("returns the original enquiry on a creation retry after edits and changed source grams", async () => {
  const w = await world();
  const lotId = await w.t.run(async (ctx) => {
    const creator = await ctx.db
      .query("profiles")
      .withIndex("by_phone", (q) => q.eq("phone", "+919000000101"))
      .unique();
    if (!creator) throw new Error("Missing creator");
    return ctx.db.insert("materialLots", {
      orgId: w.orgId,
      declaredByOrgId: w.orgId,
      createdByProfileId: creator._id,
      materialCode: "PAPER-NEWS",
      state: "reported_sorted",
      sourceKind: "self_declared",
      initialGrams: 1001,
      availableGrams: 1001,
      status: "available",
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
  });
  const original = {
    ...ENQUIRY,
    orgId: w.orgId,
    recipientId: w.accountId,
    materialLotId: lotId,
    shareMaterialLotReference: true,
    commercialModel: "toll_jobwork" as const,
    principalParty: "Principal material owner",
    submit: false,
  };
  const id = await w.creator.mutation(api.services.createEnquiry, original);
  await w.creator.mutation(api.services.updateEnquiry, {
    id,
    version: 1,
    state: "enquiry",
    title: "Edited saved enquiry",
    details: "Edited saved private details",
  });
  await w.t.run((ctx) =>
    ctx.db.patch("materialLots", lotId, { availableGrams: 500 }),
  );
  const before = await w.t.run((ctx) =>
    ctx.db
      .query("auditLog")
      .withIndex("by_entity", (q) =>
        q.eq("entityTable", "serviceEnquiries").eq("entityId", id),
      )
      .collect(),
  );
  expect(await w.creator.mutation(api.services.createEnquiry, original)).toBe(
    id,
  );
  expect(
    await w.creator.mutation(api.services.createEnquiry, {
      ...original,
      title: `  ${original.title}  `,
      details: ` ${original.details} `,
      principalParty: ` ${original.principalParty} `,
    }),
  ).toBe(id);
  await expect(
    w.creator.mutation(api.services.createEnquiry, {
      ...original,
      title: "Edited saved enquiry",
    }),
  ).rejects.toThrow("OPERATION_KEY_REUSED");
  const saved = await w.creator.query(api.services.enquiry, { id });
  expect(saved).toMatchObject({
    title: "Edited saved enquiry",
    details: "Edited saved private details",
    version: 2,
    materialSnapshot: { materialCode: "PAPER-NEWS", declaredGrams: 1001 },
  });
  expect(
    await w.t.run((ctx) => ctx.db.query("serviceEnquiries").take(10)),
  ).toHaveLength(1);
  const after = await w.t.run((ctx) =>
    ctx.db
      .query("auditLog")
      .withIndex("by_entity", (q) =>
        q.eq("entityTable", "serviceEnquiries").eq("entityId", id),
      )
      .collect(),
  );
  expect(after).toEqual(before);
});

it("keeps programme creation identity after title and quantity edits without duplicate audit entries", async () => {
  const w = await world();
  const original = { ...PROGRAMME, orgId: w.orgId };
  const id = await w.creator.mutation(api.services.createProgramme, original);
  await w.creator.mutation(api.services.updateProgramme, {
    id,
    version: 1,
    state: "draft",
    orgId: w.orgId,
    title: "Edited saved programme",
    evidenceReference: PROGRAMME.evidenceReference,
    area: PROGRAMME.area,
    startsOn: PROGRAMME.startsOn,
    endsOn: PROGRAMME.endsOn,
    stream: PROGRAMME.stream,
    coverageCount: PROGRAMME.coverageCount,
    trips: PROGRAMME.trips,
    centreHandovers: PROGRAMME.centreHandovers,
    quantityGrams: 9001,
    groupIncomePaise: PROGRAMME.groupIncomePaise,
  });
  const before = await w.t.run((ctx) =>
    ctx.db
      .query("auditLog")
      .withIndex("by_entity", (q) =>
        q.eq("entityTable", "programmeRecords").eq("entityId", id),
      )
      .collect(),
  );
  expect(await w.creator.mutation(api.services.createProgramme, original)).toBe(
    id,
  );
  expect(
    await w.creator.mutation(api.services.createProgramme, {
      ...original,
      title: ` ${original.title} `,
      area: ` ${original.area} `,
    }),
  ).toBe(id);
  await expect(
    w.creator.mutation(api.services.createProgramme, {
      ...original,
      title: "Edited saved programme",
      quantityGrams: 9001,
    }),
  ).rejects.toThrow("OPERATION_KEY_REUSED");
  expect(await w.creator.query(api.services.programme, { id })).toMatchObject({
    title: "Edited saved programme",
    quantityGrams: 9001,
    version: 2,
  });
  expect(
    await w.t.run((ctx) => ctx.db.query("programmeRecords").take(10)),
  ).toHaveLength(1);
  const after = await w.t.run((ctx) =>
    ctx.db
      .query("auditLog")
      .withIndex("by_entity", (q) =>
        q.eq("entityTable", "programmeRecords").eq("entityId", id),
      )
      .collect(),
  );
  expect(after).toEqual(before);
});

async function referenceAudits(t: Awaited<ReturnType<typeof world>>["t"]) {
  return t.run(async (ctx) => {
    const definitions = await ctx.db.query("serviceKindDefinitions").take(30);
    const rows = await Promise.all(
      definitions.map((definition) =>
        ctx.db
          .query("auditLog")
          .withIndex("by_entity", (q) =>
            q
              .eq("entityTable", "serviceKindDefinitions")
              .eq("entityId", definition._id),
          )
          .take(2),
      ),
    );
    return rows.flat();
  });
}

it("records the selected recipient conversation once and preserves frozen terms", async () => {
  const w = await world();
  const id = await w.creator.mutation(api.services.createEnquiry, {
    ...ENQUIRY,
    recipientId: w.accountId,
    submit: true,
  });
  const ack = {
    id,
    version: 1,
    operationKey: "response-ack-001",
    action: "acknowledge" as const,
  };
  await expect(
    w.other.mutation(api.services.actOnEnquiry, ack),
  ).rejects.toThrow("RECORD_ACCESS_DENIED");
  await w.recipient.mutation(api.services.actOnEnquiry, ack);
  await w.recipient.mutation(api.services.actOnEnquiry, ack);
  expect(await w.creator.query(api.services.enquiry, { id })).toMatchObject({
    state: "acknowledged",
    version: 2,
    history: [
      expect.objectContaining({ action: "acknowledge", party: "recipient" }),
    ],
  });
  await expect(
    w.recipient.mutation(api.services.actOnEnquiry, {
      ...ack,
      operationKey: "response-stale-001",
      action: "respond",
      message: "A response",
    }),
  ).rejects.toThrow("RECORD_CHANGED");
  await w.recipient.mutation(api.services.actOnEnquiry, {
    id,
    version: 2,
    operationKey: "response-text-001",
    action: "respond",
    message: "We can discuss the request",
  });
  await expect(
    w.creator.mutation(api.services.updateEnquiry, {
      id,
      version: 3,
      title: "Changed terms",
      details: ENQUIRY.details,
      state: "closed",
    }),
  ).rejects.toThrow("RECORD_CHANGED");
  await w.creator.mutation(api.services.updateEnquiry, {
    id,
    version: 3,
    title: ENQUIRY.title,
    details: ENQUIRY.details,
    state: "closed",
  });
  await expect(
    w.recipient.mutation(api.services.actOnEnquiry, {
      id,
      version: 4,
      operationKey: "response-after-close",
      action: "respond",
      message: "Must not save",
    }),
  ).rejects.toThrow("RECORD_CHANGED");
  const row = await w.creator.query(api.services.enquiry, { id });
  expect(row.history).toHaveLength(3);
  expect(row.allowedActions).toEqual([]);
  const audits = await w.t.run((ctx) =>
    ctx.db
      .query("auditLog")
      .withIndex("by_entity", (q) =>
        q.eq("entityTable", "serviceEnquiries").eq("entityId", id),
      )
      .take(100),
  );
  expect(
    audits.filter(
      (item) => item.entityId === id && item.action === "service.acknowledge",
    ),
  ).toHaveLength(1);
  await w.creator.mutation(api.services.revokeEnquiryRecipient, { id });
  await expect(w.recipient.query(api.services.enquiry, { id })).rejects.toThrow(
    "RECORD_ACCESS_DENIED",
  );
});

it.each(["suspended", "removed", "rejected", "transferred"] as const)(
  "ends recipient access when source authority is %s",
  async (change) => {
    const w = await world();
    const id = await w.creator.mutation(api.services.createEnquiry, {
      ...ENQUIRY,
      orgId: w.orgId,
      recipientId: w.accountId,
      submit: true,
    });
    await w.t.run(async (ctx) => {
      switch (change) {
        case "suspended": {
          await ctx.db.patch("orgs", w.orgId, { status: "suspended" });
          break;
        }
        case "removed": {
          const rows = await ctx.db
            .query("memberships")
            .withIndex("by_org", (q) => q.eq("orgId", w.orgId))
            .take(100);
          for (const row of rows) await ctx.db.delete("memberships", row._id);
          break;
        }
        case "rejected": {
          await ctx.db.patch("stakeholderAccounts", w.accountId, {
            status: "rejected",
          });
          break;
        }
        case "transferred": {
          const row = await ctx.db.get("serviceEnquiries", id);
          if (!row) throw new Error("Fixture missing");
          await ctx.db.patch("stakeholderAccounts", w.accountId, {
            ownerProfileId: row.requesterProfileId,
          });
          break;
        }
      }
    });
    const hidden = await w.recipient.query(api.services.board, {});
    expect(hidden.received).toEqual([]);
    await expect(
      w.recipient.query(api.services.enquiry, { id }),
    ).rejects.toThrow("RECORD_ACCESS_DENIED");
    await expect(
      w.recipient.mutation(api.services.actOnEnquiry, {
        id,
        version: 1,
        operationKey: "blocked-response-001",
        action: "acknowledge",
      }),
    ).rejects.toThrow("RECORD_ACCESS_DENIED");
  },
);

it("denies recipient-only actions to the requester and keeps declined requests terminal", async () => {
  const w = await world();
  const draft = await w.creator.mutation(api.services.createEnquiry, {
    ...ENQUIRY,
    recipientId: w.accountId,
  });
  await expect(
    w.recipient.mutation(api.services.actOnEnquiry, {
      id: draft,
      version: 1,
      operationKey: "private-draft-ack",
      action: "acknowledge",
    }),
  ).rejects.toThrow("RECORD_ACCESS_DENIED");
  await w.creator.mutation(api.services.updateEnquiry, {
    id: draft,
    version: 1,
    title: "Edited draft request",
    details: "Changed before submission",
    state: "draft",
  });
  await w.creator.mutation(api.services.updateEnquiry, {
    id: draft,
    version: 2,
    title: "Edited draft request",
    details: "Changed before submission",
    state: "enquiry",
  });
  await expect(
    w.creator.mutation(api.services.actOnEnquiry, {
      id: draft,
      version: 3,
      operationKey: "requester-decline",
      action: "decline",
    }),
  ).rejects.toThrow("RECORD_CHANGED");
  const args = {
    id: draft,
    version: 3,
    operationKey: "recipient-decline",
    action: "decline" as const,
    message: "Unable to help",
  };
  await w.recipient.mutation(api.services.actOnEnquiry, args);
  await w.recipient.mutation(api.services.actOnEnquiry, args);
  await expect(
    w.recipient.mutation(api.services.actOnEnquiry, {
      ...args,
      message: "Changed payload",
    }),
  ).rejects.toThrow("OPERATION_KEY_REUSED");
  expect(
    await w.creator.query(api.services.enquiry, { id: draft }),
  ).toMatchObject({ state: "declined", version: 4, allowedActions: [] });
});

it("reserves closure and revocation when discussion reaches its rate or text limits", async () => {
  const w = await world();
  const id = await w.creator.mutation(api.services.createEnquiry, {
    ...ENQUIRY,
    recipientId: w.accountId,
    submit: true,
  });
  for (let n = 0; n < 4; n++)
    await w.recipient.mutation(api.services.actOnEnquiry, {
      id,
      version: n + 1,
      operationKey: `bounded-text-${String(n)}`,
      action: "respond",
      message: "a".repeat(2000),
    });
  await expect(
    w.recipient.mutation(api.services.actOnEnquiry, {
      id,
      version: 5,
      operationKey: "bounded-text-extra",
      action: "respond",
      message: "extra",
    }),
  ).rejects.toThrow("HISTORY_LIMIT");
  await w.recipient.mutation(api.services.actOnEnquiry, {
    id,
    version: 5,
    operationKey: "bounded-close-001",
    action: "close",
  });
  await w.creator.mutation(api.services.revokeEnquiryRecipient, { id });
  expect(await w.creator.query(api.services.enquiry, { id })).toMatchObject({
    state: "closed",
    version: 7,
  });
  const rateId = await w.creator.mutation(api.services.createEnquiry, {
    ...ENQUIRY,
    operationKey: "rate-new-request",
    recipientId: w.accountId,
    submit: true,
  });
  for (let n = 0; n < 12; n++)
    await w.recipient.mutation(api.services.actOnEnquiry, {
      id: rateId,
      version: n + 1,
      operationKey: `bounded-rate-${String(n)}`,
      action: "respond",
      message: "short",
    });
  await expect(
    w.recipient.mutation(api.services.actOnEnquiry, {
      id: rateId,
      version: 13,
      operationKey: "bounded-rate-extra",
      action: "respond",
      message: "extra",
    }),
  ).rejects.toThrow("RESPONSE_RATE_LIMIT");
  await w.recipient.mutation(api.services.actOnEnquiry, {
    id: rateId,
    version: 13,
    operationKey: "rate-close-001",
    action: "close",
  });
});

it.each(["viewer", "different_workspace"] as const)(
  "blocks requester response for %s even when the same person owns the stakeholder recipient",
  async (change) => {
    const w = await world();
    const id = await w.creator.mutation(api.services.createEnquiry, {
      ...ENQUIRY,
      orgId: w.orgId,
      recipientId: w.accountId,
      submit: true,
    });
    await w.t.run(async (ctx) => {
      const row = await ctx.db.get("serviceEnquiries", id);
      if (!row) throw new Error("Missing fixture");
      await ctx.db.patch("stakeholderAccounts", w.accountId, {
        ownerProfileId: row.requesterProfileId,
      });
      await ctx.db.patch("serviceEnquiries", id, {
        recipientProfileId: row.requesterProfileId,
      });
      const membership = await ctx.db
        .query("memberships")
        .withIndex("by_profile_org", (q) =>
          q.eq("profileId", row.requesterProfileId).eq("orgId", w.orgId),
        )
        .unique();
      if (!membership) throw new Error("Missing fixture");
      if (change === "viewer")
        await ctx.db.patch("memberships", membership._id, { role: "viewer" });
      else {
        const orgs = await ctx.db.query("orgs").take(20);
        const other = orgs.find((org) => org._id !== w.orgId);
        if (!other) throw new Error("Missing fixture");
        await ctx.db.patch("profiles", row.requesterProfileId, {
          activeOrgId: other._id,
        });
      }
    });
    await expect(
      w.creator.mutation(api.services.actOnEnquiry, {
        id,
        version: 1,
        operationKey: "requester-write-denied",
        action: "respond",
        message: "Must not save",
      }),
    ).rejects.toThrow("RECORD_ACCESS_DENIED");
  },
);

it("revokes both aggregate report and enquiry sharing when the source requester loses workspace membership", async () => {
  const w = await world();
  const programmeId = await w.creator.mutation(api.services.createProgramme, {
    ...PROGRAMME,
    orgId: w.orgId,
  });
  const reportId = await w.creator.mutation(api.services.shareProgramme, {
    programmeId,
    recipientId: w.accountId,
    operationKey: "membership-report-share",
    purpose: "Synthetic reported totals",
    expiresAt: Date.now() + 86_400_000,
  });
  const enquiryId = await w.creator.mutation(api.services.createEnquiry, {
    ...ENQUIRY,
    orgId: w.orgId,
    recipientId: w.accountId,
    submit: true,
  });
  const before = await w.recipient.query(api.services.board, {});
  expect(before.reports).toContainEqual(
    expect.objectContaining({ id: reportId }),
  );
  expect(before.received).toContainEqual(
    expect.objectContaining({ id: enquiryId }),
  );
  await w.t.run(async (ctx) => {
    const source = await ctx.db.get("programmeRecords", programmeId);
    if (!source) throw new Error("Missing fixture");
    const membership = await ctx.db
      .query("memberships")
      .withIndex("by_profile_org", (q) =>
        q.eq("profileId", source.requesterProfileId).eq("orgId", w.orgId),
      )
      .unique();
    if (!membership) throw new Error("Missing fixture");
    await ctx.db.delete("memberships", membership._id);
  });
  const after = await w.recipient.query(api.services.board, {});
  expect(after.received).toEqual([]);
  expect(after.reports).toEqual([]);
  await expect(
    w.recipient.query(api.services.report, { id: reportId }),
  ).rejects.toThrow("RECORD_ACCESS_DENIED");
  await expect(
    w.recipient.query(api.services.enquiry, { id: enquiryId }),
  ).rejects.toThrow("RECORD_ACCESS_DENIED");
});
