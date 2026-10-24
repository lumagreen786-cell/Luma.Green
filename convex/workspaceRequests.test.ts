/// <reference types="vite/client" />
// @vitest-environment edge-runtime
import { afterEach, describe, expect, it, vi } from "vitest";

import { api } from "./_generated/api";
import { convexModules, signIn } from "./lib/auth.testing";
import { teamWorld } from "./lib/teams.testing";

const modules = convexModules(import.meta.glob("./**/*.*s"));
const consent = {
  locale: "en",
  ageConfirmed: true,
  privacyAccepted: true,
} as const;
const shop = {
  ownerName: "Demo Owner",
  shopName: "Demo Second Shop",
  gstRegistered: false,
  address: "12, Demo Road, Yeshwanthpur, Bengaluru",
  offersPickup: false,
  phones: [],
  opens: "08:00",
  closes: "20:00",
  weeklyOff: [],
};
afterEach(() => vi.unstubAllEnvs());
async function world() {
  const w = await teamWorld(modules);
  const organizationId = await w.owner.mutation(api.organizations.create, {
    name: "Demo company",
    kind: "business",
    orgId: w.orgId,
  });
  const personalId = await w.owner.mutation(api.applications.start, {
    kind: "kabadiwala",
    ...consent,
  });
  const applicationId = await w.owner.mutation(api.applications.start, {
    kind: "kabadiwala",
    organizationId,
    ...consent,
  });
  return { ...w, organizationId, personalId, applicationId };
}
describe("new company site applications", () => {
  it("keeps personal onboarding separate and activates a complete owned site automatically", async () => {
    const w = await world();
    expect(await w.owner.query(api.applications.mine, {})).toMatchObject({
      application: { id: w.personalId, status: "draft" },
    });
    await expect(
      w.owner.mutation(api.applications.submit, {
        applicationId: w.applicationId,
      }),
    ).rejects.toThrow("INCOMPLETE");
    await w.owner.mutation(api.applications.saveDraft, {
      applicationId: w.applicationId,
      kabadiwala: shop,
    });
    await w.owner.mutation(api.applications.submit, {
      applicationId: w.applicationId,
    });
    expect(
      await w.owner.query(api.organizations.workspaces, {
        organizationId: w.organizationId,
      }),
    ).toHaveLength(2);
    await expect(
      w.owner.mutation(api.review.decide, {
        applicationId: w.applicationId,
        decision: "approve",
      }),
    ).rejects.toThrow("NOT_ADMIN");
    const sites = await w.owner.query(api.organizations.workspaces, {
      organizationId: w.organizationId,
    });
    expect(sites).toHaveLength(2);
    expect(sites).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: shop.shopName, role: "owner" }),
      ]),
    );
    expect(await w.owner.query(api.applications.mine, {})).toMatchObject({
      application: { id: w.personalId, status: "draft" },
    });
    expect(
      await w.owner.query(api.organizations.siteRequests, {
        organizationId: w.organizationId,
      }),
    ).toMatchObject([{ id: w.applicationId, status: "approved" }]);
  });
  it("denies another applicant's draft and blocks editing or approval after parent revocation", async () => {
    const w = await world();
    await expect(
      w.other.query(api.applications.own, { applicationId: w.applicationId }),
    ).rejects.toThrow("NO_APPLICATION");
    await expect(
      w.other.mutation(api.applications.saveDraft, {
        applicationId: w.applicationId,
        kabadiwala: shop,
      }),
    ).rejects.toThrow("NO_APPLICATION");
    await w.owner.mutation(api.applications.saveDraft, {
      applicationId: w.applicationId,
      kabadiwala: shop,
    });
    await w.t.run(async (ctx) => {
      const member = await ctx.db
        .query("organizationMemberships")
        .withIndex("by_organization_profile", (q) =>
          q.eq("organizationId", w.organizationId).eq("profileId", w.ownerId),
        )
        .unique();
      if (!member) throw new Error("Missing member");
      await ctx.db.patch("organizationMemberships", member._id, {
        role: "viewer",
      });
    });
    await expect(
      w.owner.mutation(api.applicationFiles.generateUploadUrl, {
        applicationId: w.applicationId,
      }),
    ).rejects.toThrow("TEAM_ACCESS_DENIED");
    await expect(
      w.owner.mutation(api.applications.submit, {
        applicationId: w.applicationId,
      }),
    ).rejects.toThrow("TEAM_ACCESS_DENIED");
    await w.t.run((ctx) =>
      ctx.db.patch("applications", w.applicationId, { status: "submitted" }),
    );
    vi.stubEnv("ADMIN_EMAIL", "reviewer@example.test");
    const admin = await signIn(w.t, {
      email: "reviewer@example.test",
      twoFactorEnabled: true,
    });
    await expect(
      admin.mutation(api.review.decide, {
        applicationId: w.applicationId,
        decision: "approve",
      }),
    ).rejects.toThrow("TEAM_ACCESS_DENIED");
  });
  it("scopes document uploads to the requested application without granting parent-wide identity access", async () => {
    const w = await world();
    const applicationId = await w.owner.mutation(api.applications.start, {
      kind: "yard",
      organizationId: w.organizationId,
      ...consent,
    });
    const storageId = await w.t.run((ctx) =>
      ctx.storage.store(new Blob(["%PDF-1.7\nDemo permit"])),
    );
    await expect(
      w.other.action(api.applicationFiles.attach, {
        applicationId,
        storageId,
        type: "pcb_certificate",
        name: "permit.pdf",
      }),
    ).rejects.toThrow("NO_APPLICATION");
    const result = await w.owner.action(api.applicationFiles.attach, {
      applicationId,
      storageId,
      type: "pcb_certificate",
      name: "permit.pdf",
    });
    expect(result.ok).toBe(true);
    const detail = await w.owner.query(api.applications.own, {
      applicationId,
    });
    expect(detail?.application?.files).toHaveLength(1);
    const personal = await w.owner.query(api.applications.mine, {});
    expect(personal?.application?.files).toHaveLength(0);
    await expect(
      w.owner.mutation(api.applications.submit, { applicationId }),
    ).rejects.toThrow("INCOMPLETE");
  });
});
