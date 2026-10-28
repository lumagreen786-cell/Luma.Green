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
import { hashToken } from "./lib/integrations";
import { INVITATION_TTL_MS } from "./lib/workspaceRoles";
import schema from "./schema";

const modules = convexModules(import.meta.glob("./**/*.*s"));
const token = "a".repeat(64);
afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

async function world() {
  vi.stubEnv("AUTH_DEV_MODE", "true");
  const t = convexTest(schema, modules);
  registerAuth(t);
  await seedDemo(t);
  const owner = await signInAs(t, "+919000000102");
  const other = await signInAs(t, "+919000000103");
  const org = await owner.query(api.workspace.mine, {});
  const otherOrg = await other.query(api.workspace.mine, {});
  if (org?.kind !== "org" || otherOrg?.kind !== "org")
    throw new Error("Missing demo workspaces");
  const orgId = org.org.id;
  const otherOrgId = otherOrg.org.id;
  const ownerMembership = await t.run((ctx) =>
    ctx.db
      .query("memberships")
      .withIndex("by_org", (q) => q.eq("orgId", orgId))
      .unique(),
  );
  if (!ownerMembership) throw new Error("Missing owner");
  const ownerProfileId = ownerMembership.profileId;
  const person = await signIn(t, { email: "teammate@example.test" });
  const profileId = await person.mutation(api.identity.ensureProfile, {
    locale: "en",
  });
  async function verify() {
    await t.run(async (ctx) => {
      const profile = await ctx.db.get("profiles", profileId);
      if (!profile) throw new Error("Missing profile");
      await ctx.runMutation(components.betterAuth.adapter.updateOne, {
        input: {
          model: "user",
          where: [{ field: "_id", value: profile.authUserId }],
          update: { emailVerified: true },
        },
      });
    });
  }
  async function addMember(
    role: "admin" | "member" | "viewer" | "owner" | "staff",
    targetOrgId = orgId,
  ) {
    return t.run((ctx) =>
      ctx.db.insert("memberships", {
        profileId,
        orgId: targetOrgId,
        role,
        createdAt: Date.now(),
      }),
    );
  }
  async function addInvite(
    overrides: {
      role?: "admin" | "member" | "viewer";
      expiresAt?: number;
      email?: string;
      invitedBy?: Id<"profiles">;
    } = {},
  ) {
    const tokenHash = await hashToken(token);
    return t.run((ctx) =>
      ctx.db.insert("workspaceInvitations", {
        orgId,
        email: "teammate@example.test",
        role: "member",
        tokenHash,
        invitedBy: ownerProfileId,
        createdAt: Date.now(),
        expiresAt: Date.now() + INVITATION_TTL_MS,
        delivery: "pending",
        ...overrides,
      }),
    );
  }
  return {
    t,
    owner,
    other,
    person,
    profileId,
    orgId,
    otherOrgId,
    ownerMembership,
    addMember,
    addInvite,
    verify,
  };
}

describe("workspace membership is the live authority", () => {
  it("keeps suspended workspace records read-only for resolution", async () => {
    const w = await world();
    await w.t.run((ctx) =>
      ctx.db.patch("orgs", w.orgId, { status: "suspended" }),
    );
    expect(await w.owner.query(api.workspace.mine, {})).toMatchObject({
      kind: "org",
      role: "viewer",
      org: { id: w.orgId },
    });
    const stock = await w.owner.query(api.stock.mine, {});
    expect(stock.totalGrams).toBeGreaterThan(0);
    await expect(w.owner.query(api.market.trades, {})).resolves.toBeDefined();
    await expect(
      w.owner.mutation(api.shop.setRate, {
        materialCode: "PAPER-NEWS",
        paisePerKg: 1000,
      }),
    ).rejects.toThrow("NO_BUSINESS");
    await expect(
      w.other.query(api.workspace.team, { orgId: w.orgId }),
    ).rejects.toThrow("WORKSPACE_CHANGED");
  });
  it("denies selection and roster access outside the caller's memberships", async () => {
    const w = await world();
    await expect(
      w.owner.mutation(api.workspace.select, { orgId: w.otherOrgId }),
    ).rejects.toThrow("WORKSPACE_PERMISSION_DENIED");
    await expect(
      w.owner.query(api.workspace.team, { orgId: w.otherOrgId }),
    ).rejects.toThrow("WORKSPACE_CHANGED");
    await expect(w.person.query(api.stock.mine, {})).rejects.toThrow(
      "NO_BUSINESS",
    );
  });

  it("switches between memberships and denies a stale selection after removal", async () => {
    const w = await world();
    const first = await w.addMember("member");
    await w.addMember("viewer", w.otherOrgId);
    await w.person.mutation(api.workspace.select, { orgId: w.orgId });
    expect(await w.person.query(api.workspace.mine, {})).toMatchObject({
      kind: "org",
      role: "member",
      org: { id: w.orgId },
    });
    await w.owner.mutation(api.workspace.removeMember, {
      orgId: w.orgId,
      membershipId: first,
    });
    await expect(w.person.query(api.stock.mine, {})).rejects.toThrow(
      "NO_BUSINESS",
    );
    expect(await w.person.query(api.workspace.mine, {})).toEqual({
      kind: "selectionRequired",
    });
    expect(await w.person.query(api.workspace.list, {})).toMatchObject([
      { selected: false, role: "viewer" },
    ]);
    await w.person.mutation(api.workspace.select, { orgId: w.otherOrgId });
    expect(await w.person.query(api.workspace.mine, {})).toMatchObject({
      role: "viewer",
      org: { id: w.otherOrgId },
    });
  });

  it.each(["viewer", "member", "admin", "owner", "staff"] as const)(
    "enforces %s permissions at an actual lot mutation",
    async (role) => {
      const w = await world();
      await w.addMember(role);
      await expect(w.person.query(api.stock.mine, {})).resolves.toBeDefined();
      const write = w.person.mutation(api.traceability.declareLot, {
        materialCode: "PLASTIC-PET",
        state: "PET-BALE",
        grams: 1000,
      });
      if (role === "viewer")
        await expect(write).rejects.toThrow("WORKSPACE_PERMISSION_DENIED");
      else await expect(write).resolves.toBeDefined();
    },
  );

  it("revokes operational rights immediately after a role change", async () => {
    const w = await world();
    const id = await w.addMember("member");
    await w.owner.mutation(api.workspace.changeRole, {
      orgId: w.orgId,
      membershipId: id,
      role: "viewer",
    });
    await expect(
      w.person.mutation(api.traceability.declareLot, {
        materialCode: "PLASTIC-PET",
        state: "PET-BALE",
        grams: 1000,
      }),
    ).rejects.toThrow("WORKSPACE_PERMISSION_DENIED");
    expect(await w.person.query(api.market.trades, {})).toMatchObject({
      buying: expect.any(Array),
      selling: expect.any(Array),
    });
    const rows = await w.person.query(api.market.trades, {});
    expect(
      [...rows.buying, ...rows.selling].every(
        (trade) => trade.actions.length === 0,
      ),
    ).toBe(true);
  });

  it("blocks admin escalation and protects the last owner", async () => {
    const w = await world();
    const id = await w.addMember("admin");
    await expect(
      w.person.mutation(api.workspace.changeRole, {
        orgId: w.orgId,
        membershipId: id,
        role: "owner",
      }),
    ).rejects.toThrow("WORKSPACE_PERMISSION_DENIED");
    await expect(
      w.person.mutation(api.workspace.removeMember, {
        orgId: w.orgId,
        membershipId: w.ownerMembership._id,
      }),
    ).rejects.toThrow("WORKSPACE_PERMISSION_DENIED");
    await expect(
      w.owner.mutation(api.workspace.changeRole, {
        orgId: w.orgId,
        membershipId: w.ownerMembership._id,
        role: "viewer",
      }),
    ).rejects.toThrow("LAST_OWNER_REQUIRED");
    await expect(
      w.owner.mutation(api.workspace.removeMember, {
        orgId: w.orgId,
        membershipId: w.ownerMembership._id,
      }),
    ).rejects.toThrow("LAST_OWNER_REQUIRED");
    await w.owner.mutation(api.workspace.changeRole, {
      orgId: w.orgId,
      membershipId: id,
      role: "owner",
    });
    await w.owner.mutation(api.workspace.removeMember, {
      orgId: w.orgId,
      membershipId: w.ownerMembership._id,
    });
    expect(await w.t.run((ctx) => ctx.db.get("orgs", w.orgId))).toMatchObject({
      ownerProfileId: w.profileId,
    });
  });

  it("does not promote stakeholders when their account is approved", async () => {
    const w = await world();
    await w.t.run((ctx) =>
      ctx.db.insert("stakeholderAccounts", {
        ownerProfileId: w.profileId,
        kind: "city_official",
        organizationName: "City test",
        status: "approved",
        createdAt: Date.now(),
        updatedAt: Date.now(),
      }),
    );
    expect(await w.person.query(api.workspace.list, {})).toEqual([]);
    await expect(
      w.person.mutation(api.traceability.declareLot, {
        materialCode: "PLASTIC-PET",
        state: "PET-BALE",
        grams: 1000,
      }),
    ).rejects.toThrow("NO_BUSINESS");
  });
});

describe("one-use verified-email team invitations", () => {
  it("reveals no invitation data when a session is absent during account switching", async () => {
    const w = await world();
    await w.addInvite();
    expect(await w.t.query(api.workspace.invitation, { token })).toEqual({
      status: "unavailable",
    });
    await expect(
      w.t.mutation(api.workspace.acceptInvitation, { token }),
    ).rejects.toThrow("NOT_SIGNED_IN");
  });
  it("requires verified email and atomically consumes the invitation", async () => {
    const w = await world();
    const id = await w.addInvite();
    expect(await w.person.query(api.workspace.invitation, { token })).toEqual({
      status: "verifyEmail",
    });
    await expect(
      w.person.mutation(api.workspace.acceptInvitation, { token }),
    ).rejects.toThrow("VERIFIED_EMAIL_REQUIRED");
    await w.verify();
    expect(
      await w.person.query(api.workspace.invitation, { token }),
    ).toMatchObject({ status: "ready", role: "member" });
    await expect(
      w.person.mutation(api.workspace.acceptInvitation, { token }),
    ).resolves.toBe(w.orgId);
    await expect(
      w.person.mutation(api.workspace.acceptInvitation, { token }),
    ).rejects.toThrow("INVITATION_UNAVAILABLE");
    expect(
      await w.t.run((ctx) => ctx.db.get("workspaceInvitations", id)),
    ).toMatchObject({
      acceptedBy: w.profileId,
      acceptedAt: expect.any(Number),
    });
  });

  it.each([
    "expired",
    "wrong-email",
    "revoked",
    "sender-removed",
    "suspended",
  ] as const)("denies an invitation that is %s", async (failure) => {
    const w = await world();
    await w.verify();
    const overrides: { expiresAt?: number; email?: string } = {};
    if (failure === "expired") overrides.expiresAt = Date.now() - 1;
    else if (failure === "wrong-email")
      overrides.email = "someone-else@example.test";
    const id = await w.addInvite(overrides);
    switch (failure) {
      case "revoked": {
        await w.owner.mutation(api.workspace.revokeInvitation, {
          orgId: w.orgId,
          invitationId: id,
        });
        break;
      }
      case "sender-removed": {
        await w.t.run((ctx) =>
          ctx.db.delete("memberships", w.ownerMembership._id),
        );
        break;
      }
      case "suspended": {
        await w.t.run((ctx) =>
          ctx.db.patch("orgs", w.orgId, { status: "suspended" }),
        );
        break;
      }
      case "expired":
      case "wrong-email": {
        break;
      }
    }
    expect(await w.person.query(api.workspace.invitation, { token })).toEqual({
      status: "unavailable",
    });
    await expect(
      w.person.mutation(api.workspace.acceptInvitation, { token }),
    ).rejects.toThrow("INVITATION_UNAVAILABLE");
  });

  it("does not overwrite an existing member's role through an invitation", async () => {
    const w = await world();
    await w.verify();
    await w.addMember("viewer");
    await w.addInvite({ role: "admin" });
    await w.person.mutation(api.workspace.acceptInvitation, { token });
    expect(await w.person.query(api.workspace.mine, {})).toMatchObject({
      role: "viewer",
    });
  });

  it("denies invitation creation to members and admin grants to administrators", async () => {
    const w = await world();
    const id = await w.addMember("member");
    const args = {
      orgId: w.orgId,
      email: "colleague@example.test",
      role: "member" as const,
      locale: "en",
      token,
    };
    await expect(
      w.person.mutation(internal.workspace.persistInvitation, args),
    ).rejects.toThrow("WORKSPACE_PERMISSION_DENIED");
    await w.owner.mutation(api.workspace.changeRole, {
      orgId: w.orgId,
      membershipId: id,
      role: "admin",
    });
    await expect(
      w.person.mutation(internal.workspace.persistInvitation, {
        ...args,
        role: "admin",
      }),
    ).rejects.toThrow("WORKSPACE_PERMISSION_DENIED");
  });

  it("stores no raw token or email in the acceptance audit", async () => {
    const w = await world();
    await w.verify();
    await w.addInvite();
    await w.person.mutation(api.workspace.acceptInvitation, { token });
    const logs = await w.t.run((ctx) =>
      ctx.db
        .query("auditLog")
        .withIndex("by_org_created", (q) => q.eq("orgId", w.orgId))
        .collect(),
    );
    const entry = logs.find(
      (log) => log.action === "workspace.invitation_accepted",
    );
    expect(entry).toMatchObject({
      actorProfileId: w.profileId,
      orgId: w.orgId,
      metadata: { actorRole: "member" },
    });
    expect(JSON.stringify(entry)).not.toContain(token);
    expect(JSON.stringify(entry)).not.toContain("teammate@example.test");
  });
});

describe("invitation delivery ownership", () => {
  it("claims a valid send only once and records one provider outcome", async () => {
    const w = await world();
    const invitationId = await w.addInvite();
    const claim = { invitationId, token };
    expect(
      await w.t.mutation(internal.workspace.claimInvitationEmail, claim),
    ).toMatchObject({
      email: "teammate@example.test",
    });
    expect(
      await w.t.mutation(internal.workspace.claimInvitationEmail, claim),
    ).toBeNull();
    await w.t.mutation(internal.workspace.recordInvitationDelivery, {
      invitationId,
      accepted: true,
    });
    await w.t.mutation(internal.workspace.recordInvitationDelivery, {
      invitationId,
      accepted: false,
    });
    expect(
      await w.t.run((ctx) => ctx.db.get("workspaceInvitations", invitationId)),
    ).toMatchObject({
      delivery: "accepted",
    });
    const logs = await w.t.run((ctx) =>
      ctx.db
        .query("auditLog")
        .withIndex("by_org_created", (q) => q.eq("orgId", w.orgId))
        .collect(),
    );
    expect(
      logs.filter((log) => log.action.startsWith("workspace.email_")),
    ).toHaveLength(1);
  });

  it("does not deliver a revoked invitation or a mismatched token", async () => {
    const w = await world();
    const invitationId = await w.addInvite();
    expect(
      await w.t.mutation(internal.workspace.claimInvitationEmail, {
        invitationId,
        token: "b".repeat(64),
      }),
    ).toBeNull();
    await w.owner.mutation(api.workspace.revokeInvitation, {
      orgId: w.orgId,
      invitationId,
    });
    expect(
      await w.t.mutation(internal.workspace.claimInvitationEmail, {
        invitationId,
        token,
      }),
    ).toBeNull();
    expect(
      await w.t.run((ctx) => ctx.db.get("workspaceInvitations", invitationId)),
    ).not.toHaveProperty("attemptedAt");
  });
});
