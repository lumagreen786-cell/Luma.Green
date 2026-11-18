/// <reference types="vite/client" />
// @vitest-environment edge-runtime
import { convexTest } from "convex-test";
import { afterEach, describe, expect, it, vi } from "vitest";

import { api } from "./_generated/api";
import {
  convexModules,
  registerAuth,
  seedDemo,
  signInAs,
} from "./lib/auth.testing";
import schema from "./schema";

const modules = convexModules(import.meta.glob("./**/*.*s"));

async function world() {
  vi.stubEnv("AUTH_DEV_MODE", "true");
  const t = convexTest(schema, modules);
  registerAuth(t);
  await seedDemo(t);
  const shop = await signInAs(t, "+919000000101");
  const yard = await signInAs(t, "+919000000102");
  const recycler = await signInAs(t, "+919000000103");
  const orgs = await t.run(async (ctx) => {
    const all = await ctx.db.query("orgs").collect();
    return {
      shop: all.find((org) => org.kind === "kabadiwala")!._id,
      yard: all.find((org) => org.kind === "yard")!._id,
      recycler: all.find((org) => org.kind === "recycler")!._id,
    };
  });
  return { t, shop, yard, recycler, orgs };
}

afterEach(() => vi.unstubAllEnvs());

describe("national activity selection", () => {
  it("searches the official subclass catalogue behind current workspace access", async () => {
    const { t, shop, orgs } = await world();
    const all = await shop.query(api.industryReference.nationalSearch, {
      search: "",
    });
    expect(all).toMatchObject({
      sourceVersion: "NIC-2025",
      sourceQuality: "official_reference",
      total: 1887,
      nextOffset: 25,
    });
    expect(all.items).toHaveLength(25);
    const wheat = await shop.query(api.industryReference.nationalSearch, {
      search: "011101",
    });
    expect(wheat.items).toEqual([
      expect.objectContaining({ code: "011101", title: "Growing of wheat" }),
    ]);
    await expect(
      t.query(api.industryReference.nationalSearch, { search: "" }),
    ).rejects.toThrow("NOT_SIGNED_IN");
    const membership = await t.run((ctx) =>
      ctx.db
        .query("memberships")
        .withIndex("by_org", (q) => q.eq("orgId", orgs.shop))
        .first(),
    );
    await t.run((ctx) => ctx.db.delete("memberships", membership!._id));
    await expect(
      shop.query(api.industryReference.nationalSearch, { search: "" }),
    ).rejects.toThrow("NO_BUSINESS");
  });

  it("resolves activity provenance on the server without changing stock or permissions", async () => {
    const { t, shop, yard, orgs } = await world();
    const args = {
      name: "Source activity site",
      siteReference: "Recorded site",
      sectorId: "cpcb-2025-row-5",
      capabilities: ["sorting" as const],
    };
    const before = await shop.query(api.stock.mine, {});
    const originalOrg = await t.run((ctx) => ctx.db.get("orgs", orgs.shop));
    const id = await shop.mutation(api.industrialProfiles.save, {
      ...args,
      industryActivityCode: "011101",
    });
    const [saved] = await shop.query(api.industrialProfiles.mine, {});
    expect(saved.industryActivity).toMatchObject({
      code: "011101",
      title: "Growing of wheat",
      sourceVersion: "NIC-2025",
      sourceQuality: "official_reference",
      workbookSha256: expect.stringMatching(/^[a-f0-9]{64}$/u),
      pdfSha256: expect.stringMatching(/^[a-f0-9]{64}$/u),
    });
    expect(saved.sector?.sourceQuality).toBe("workbook_unverified");
    expect(await yard.query(api.industrialProfiles.mine, {})).toEqual([]);
    const after = await shop.query(api.stock.mine, {});
    expect(after.totalGrams).toBe(before.totalGrams);
    expect(await t.run((ctx) => ctx.db.get("orgs", orgs.shop))).toEqual(
      originalOrg,
    );
    await shop.mutation(api.industrialProfiles.save, {
      ...args,
      facilityId: id,
      name: "Renamed site",
    });
    const [renamed] = await shop.query(api.industrialProfiles.mine, {});
    expect(renamed.industryActivity).toEqual(saved.industryActivity);
    await shop.mutation(api.industrialProfiles.save, {
      ...args,
      facilityId: id,
      industryActivityCode: null,
    });
    const [cleared] = await shop.query(api.industrialProfiles.mine, {});
    expect(cleared.industryActivity).toBeUndefined();
    for (const code of ["01", "01110", "999999", "invented"]) {
      await expect(
        shop.mutation(api.industrialProfiles.save, {
          ...args,
          facilityId: id,
          industryActivityCode: code,
        }),
      ).rejects.toThrow("SECTOR_NOT_FOUND");
    }
    const [unchanged] = await shop.query(api.industrialProfiles.mine, {});
    expect(unchanged).toEqual(cleared);
  });
});

describe("industrial facility declarations", () => {
  it("stores authoritative source provenance without granting role or market approval", async () => {
    const { t, shop, yard } = await world();
    const before = await shop.query(api.stock.mine, {});
    const facilityId = await shop.mutation(api.industrialProfiles.save, {
      name: "Wash line",
      siteReference: "Site A",
      sectorId: "cpcb-2025-row-5",
      capabilities: ["washing", "washing", "sorting"],
    });
    const [row] = await shop.query(api.industrialProfiles.mine, {});
    expect(row).toMatchObject({
      _id: facilityId,
      capabilities: ["washing", "sorting"],
      sector: { row: 5, sourceQuality: "workbook_unverified" },
    });
    expect(await yard.query(api.industrialProfiles.mine, {})).toEqual([]);
    await expect(
      yard.mutation(api.industrialProfiles.save, {
        facilityId,
        name: "Other",
        siteReference: "Other",
        capabilities: ["washing"],
      }),
    ).rejects.toThrow(/FACILITY_NOT_FOUND/);
    const afterStock = await shop.query(api.stock.mine, {});
    expect(afterStock.totalGrams).toBe(before.totalGrams);
    const audits = await t.run((ctx) =>
      ctx.db
        .query("auditLog")
        .withIndex("by_entity", (q) =>
          q
            .eq("entityTable", "industrialFacilities")
            .eq("entityId", facilityId),
        )
        .collect(),
    );
    expect(audits).toHaveLength(1);
    expect(audits[0].metadata).toMatchObject({ scope: "self_declared" });
    await shop.mutation(api.industrialProfiles.save, {
      facilityId,
      name: "Updated",
      siteReference: "Site B",
      capabilities: ["baling"],
    });
    const updated = await shop.query(api.industrialProfiles.mine, {});
    expect(updated[0]).toMatchObject({
      name: "Updated",
      capabilities: ["baling"],
    });
    expect(updated[0].sector).toBeUndefined();
  });
  it("rejects unknown sectors, empty capabilities and invalid references atomically", async () => {
    const { shop } = await world();
    const args = {
      name: "Line",
      siteReference: "Site",
      capabilities: ["sorting" as const],
    };
    await expect(
      shop.mutation(api.industrialProfiles.save, {
        ...args,
        sectorId: "invented",
      }),
    ).rejects.toThrow(/SECTOR_NOT_FOUND/);
    await expect(
      shop.mutation(api.industrialProfiles.save, { ...args, capabilities: [] }),
    ).rejects.toThrow(/INVALID_CAPABILITIES/);
    await expect(
      shop.mutation(api.industrialProfiles.save, {
        ...args,
        siteReference: " ",
      }),
    ).rejects.toThrow(/INVALID_REFERENCE/);
    expect(await shop.query(api.industrialProfiles.mine, {})).toEqual([]);
  });
  it("permits viewer reads but restricts profile writes to owner/admin and denies revoked users", async () => {
    const { t, shop, orgs } = await world();
    const membership = await t.run((ctx) =>
      ctx.db
        .query("memberships")
        .withIndex("by_org", (q) => q.eq("orgId", orgs.shop))
        .first(),
    );
    await t.run((ctx) =>
      ctx.db.patch("memberships", membership!._id, { role: "viewer" }),
    );
    expect(await shop.query(api.industrialProfiles.mine, {})).toEqual([]);
    const reference = await shop.query(api.industryReference.search, {
      kind: "sectors",
      search: "",
    });
    expect(reference.total).toBe(419);
    await expect(
      shop.mutation(api.industrialProfiles.save, {
        name: "Line",
        siteReference: "Site",
        capabilities: ["sorting"],
      }),
    ).rejects.toThrow(/WORKSPACE_PERMISSION_DENIED/);
    await expect(
      t.query(api.industryReference.search, { kind: "sectors", search: "" }),
    ).rejects.toThrow(/NOT_SIGNED_IN/);
    await t.run((ctx) => ctx.db.delete("memberships", membership!._id));
    await expect(
      shop.query(api.industryReference.search, { kind: "sectors", search: "" }),
    ).rejects.toThrow(/NO_BUSINESS/);
    await expect(shop.query(api.industrialProfiles.mine, {})).rejects.toThrow(
      /NO_BUSINESS/,
    );
  });
});

describe("reported facility registrations", () => {
  it("keeps immutable versions and derives dates without verifying consent", async () => {
    const { t, shop, yard } = await world();
    const facilityId = await shop.mutation(api.industrialProfiles.save, {
      name: "Line",
      siteReference: "Site",
      capabilities: ["washing"],
    });
    const args = {
      facilityId,
      kind: "consent_to_operate" as const,
      reference: "Reported consent A",
      issuedAt: "2020-01-01",
      validUntil: "2020-12-31",
    };
    const previous = await shop.mutation(
      api.industrialProfiles.recordRegistration,
      args,
    );
    const id = await shop.mutation(api.industrialProfiles.recordRegistration, {
      ...args,
      reference: "Corrected reference",
      issuedAt: "2021-01-01",
      validUntil: "2090-12-31",
      supersedesId: previous,
    });
    await shop.mutation(api.industrialProfiles.recordRegistration, {
      ...args,
      kind: "other",
      issuedAt: "2091-01-01",
      validUntil: "2092-01-01",
    });
    const result = await shop.query(api.industrialProfiles.registrations, {
      facilityId,
    });
    expect(result.rows.find((row) => row.id === previous)).toMatchObject({
      reference: "Reported consent A",
      dateStatus: "expired",
      sourceQuality: "reported_unverified",
      supersededById: id,
    });
    expect(result.rows.find((row) => row.id === id)).toMatchObject({
      dateStatus: "current",
      supersedesId: previous,
    });
    expect(result.rows.find((row) => row.kind === "other")?.dateStatus).toBe(
      "not_yet_current",
    );
    await expect(
      shop.mutation(api.industrialProfiles.recordRegistration, {
        ...args,
        supersedesId: previous,
      }),
    ).rejects.toThrow(/REGISTRATION_ALREADY_SUPERSEDED/);
    await expect(
      yard.query(api.industrialProfiles.registrations, { facilityId }),
    ).rejects.toThrow(/FACILITY_NOT_FOUND/);
    await expect(
      yard.mutation(api.industrialProfiles.recordRegistration, args),
    ).rejects.toThrow(/FACILITY_NOT_FOUND/);
    const logs = await t.run((ctx) =>
      ctx.db
        .query("auditLog")
        .withIndex("by_entity", (q) =>
          q.eq("entityTable", "facilityRegistrations").eq("entityId", id),
        )
        .collect(),
    );
    expect(logs).toHaveLength(1);
    expect(logs[0].metadata).toMatchObject({
      sourceQuality: "reported_unverified",
    });
  });
  it("rejects invalid dates and unrelated correction references without writes", async () => {
    const { shop } = await world();
    const facilityId = await shop.mutation(api.industrialProfiles.save, {
      name: "Line",
      siteReference: "Site",
      capabilities: ["washing"],
    });
    const otherId = await shop.mutation(api.industrialProfiles.save, {
      name: "Other",
      siteReference: "Site",
      capabilities: ["washing"],
    });
    const args = {
      facilityId,
      kind: "consent_to_operate" as const,
      reference: "Reference",
      issuedAt: "2020-01-01",
      validUntil: "2021-12-31",
    };
    for (const invalid of [
      { issuedAt: "2020-02-30" },
      { validUntil: "2019-01-01" },
      { issuedAt: "" },
      { validUntil: "2021-1-1" },
    ])
      await expect(
        shop.mutation(api.industrialProfiles.recordRegistration, {
          ...args,
          ...invalid,
        }),
      ).rejects.toThrow(/INVALID_REGISTRATION_DATES/);
    const previous = await shop.mutation(
      api.industrialProfiles.recordRegistration,
      { ...args, facilityId: otherId },
    );
    await expect(
      shop.mutation(api.industrialProfiles.recordRegistration, {
        ...args,
        supersedesId: previous,
      }),
    ).rejects.toThrow(/REGISTRATION_NOT_FOUND/);
    await expect(
      shop.mutation(api.industrialProfiles.recordRegistration, {
        ...args,
        facilityId: otherId,
        kind: "other",
        supersedesId: previous,
      }),
    ).rejects.toThrow(/REGISTRATION_NOT_FOUND/);
    const result = await shop.query(api.industrialProfiles.registrations, {
      facilityId,
    });
    expect(result.rows).toEqual([]);
  });
  it("allows viewer reads but rejects viewer changes", async () => {
    const { t, shop, orgs } = await world();
    const facilityId = await shop.mutation(api.industrialProfiles.save, {
      name: "Line",
      siteReference: "Site",
      capabilities: ["washing"],
    });
    await t.run(async (ctx) => {
      const member = await ctx.db
        .query("memberships")
        .withIndex("by_org", (q) => q.eq("orgId", orgs.shop))
        .first();
      await ctx.db.patch("memberships", member!._id, { role: "viewer" });
    });
    expect(
      await shop.query(api.industrialProfiles.registrations, { facilityId }),
    ).toEqual({ rows: [], hasMore: false });
    await expect(
      shop.mutation(api.industrialProfiles.recordRegistration, {
        facilityId,
        kind: "other",
        reference: "Reference",
        issuedAt: "2020-01-01",
        validUntil: "2021-01-01",
      }),
    ).rejects.toThrow(/WORKSPACE_PERMISSION_DENIED/);
  });
});
