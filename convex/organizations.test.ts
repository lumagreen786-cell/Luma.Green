/// <reference types="vite/client" />
// @vitest-environment edge-runtime
import { convexTest } from "convex-test";
import { afterEach, describe, expect, it, vi } from "vitest";

import { api, components, internal } from "./_generated/api";
import {
  convexModules,
  registerAuth,
  seedDemo,
  signIn,
  signInAs,
} from "./lib/auth.testing";
import schema from "./schema";

const modules = convexModules(import.meta.glob("./**/*.*s"));
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
  const view = await owner.query(api.workspace.mine, {});
  const otherView = await other.query(api.workspace.mine, {});
  if (view?.kind !== "org" || otherView?.kind !== "org")
    throw new Error("Missing sites");
  const orgId = view.org.id;
  const parent = await owner.mutation(api.organizations.create, {
    name: "Demo company",
    kind: "business",
    orgId,
  });
  const person = await signIn(t, {
    email: "phone@example.test",
    phoneNumber: "+919123456789",
  });
  const profileId = await person.mutation(api.identity.ensureProfile, {
    locale: "en",
  });
  const scope = { kind: "organization" as const, id: parent };
  const workspace = { kind: "workspace" as const, id: orgId };
  const token = "b".repeat(64);
  return {
    t,
    owner,
    other,
    person,
    profileId,
    orgId,
    otherOrgId: otherView.org.id,
    parent,
    scope,
    workspace,
    token,
  };
}

describe("organization governance", () => {
  it("groups an approved site without granting parent members operational access", async () => {
    const w = await world();
    await w.owner.mutation(internal.teamInvitations.persist, {
      scope: w.scope,
      phone: "+919123456789",
      role: "admin",
      token: w.token,
    });
    await w.person.mutation(api.teamInvitations.accept, { token: w.token });
    expect(await w.person.query(api.organizations.list, {})).toMatchObject([
      { id: w.parent, role: "admin" },
    ]);
    expect(
      await w.person.query(api.organizations.workspaces, {
        organizationId: w.parent,
      }),
    ).toMatchObject([{ id: w.orgId, role: null }]);
    await expect(
      w.person.mutation(api.workspace.select, { orgId: w.orgId }),
    ).rejects.toThrow("WORKSPACE_PERMISSION_DENIED");
    await expect(
      w.other.query(api.organizations.team, { organizationId: w.parent }),
    ).rejects.toThrow("TEAM_ACCESS_DENIED");
  });
  it("requires ownership of both scopes and cannot create unapproved or internal businesses", async () => {
    const w = await world();
    await expect(
      w.owner.mutation(api.organizations.attachWorkspace, {
        organizationId: w.parent,
        orgId: w.otherOrgId,
      }),
    ).rejects.toThrow("TEAM_ACCESS_DENIED");
    await expect(
      w.person.mutation(api.organizations.create, {
        name: "Unapproved",
        kind: "business",
      }),
    ).rejects.toThrow("APPROVED_WORKSPACE_REQUIRED");
    await expect(
      w.owner.mutation(api.organizations.create, {
        name: "Internal",
        kind: "internal",
      }),
    ).rejects.toThrow("NOT_ADMIN");
    await expect(
      w.owner.mutation(api.organizations.create, {
        name: "Duplicate",
        kind: "business",
        orgId: w.orgId,
      }),
    ).rejects.toThrow("WORKSPACE_ALREADY_GROUPED");
  });
  it("protects the final owner and rejects stale settings", async () => {
    const w = await world();
    const [member] = await w.owner.query(api.organizations.team, {
      organizationId: w.parent,
    });
    await expect(
      w.owner.mutation(api.organizations.changeMember, {
        organizationId: w.parent,
        profileId: member.profileId,
        expectedRole: "owner",
        role: null,
      }),
    ).rejects.toThrow("LAST_OWNER");
    await w.owner.mutation(api.organizations.rename, {
      organizationId: w.parent,
      name: "New name",
      expectedVersion: 1,
    });
    await expect(
      w.owner.mutation(api.organizations.rename, {
        organizationId: w.parent,
        name: "Lost update",
        expectedVersion: 1,
      }),
    ).rejects.toThrow("STALE_VERSION");
  });
  it("attaches a second owned site without moving operational ownership", async () => {
    const w = await world();
    const [owner] = await w.owner.query(api.organizations.team, {
      organizationId: w.parent,
    });
    await w.t.run((ctx) =>
      ctx.db.insert("memberships", {
        profileId: owner.profileId,
        orgId: w.otherOrgId,
        role: "owner",
        createdAt: Date.now(),
      }),
    );
    await w.owner.mutation(api.organizations.attachWorkspace, {
      organizationId: w.parent,
      orgId: w.otherOrgId,
    });
    expect(
      await w.owner.query(api.organizations.workspaces, {
        organizationId: w.parent,
      }),
    ).toHaveLength(2);
    expect(await w.other.query(api.workspace.mine, {})).toMatchObject({
      kind: "org",
      role: "owner",
    });
  });
  it("transfers parent ownership while preserving a final owner", async () => {
    const w = await world();
    await w.owner.mutation(internal.teamInvitations.persist, {
      scope: w.scope,
      phone: "+919123456789",
      role: "member",
      token: w.token,
    });
    await w.person.mutation(api.teamInvitations.accept, { token: w.token });
    await w.owner.mutation(api.organizations.changeMember, {
      organizationId: w.parent,
      profileId: w.profileId,
      expectedRole: "member",
      role: "owner",
    });
    const members = await w.owner.query(api.organizations.team, {
      organizationId: w.parent,
    });
    const oldOwner = members.find((member) => member.profileId !== w.profileId);
    if (!oldOwner) throw new Error("Missing original owner");
    await w.person.mutation(api.organizations.changeMember, {
      organizationId: w.parent,
      profileId: oldOwner.profileId,
      expectedRole: "owner",
      role: "member",
    });
    await expect(
      w.owner.mutation(api.organizations.rename, {
        organizationId: w.parent,
        name: "Forbidden",
        expectedVersion: 1,
      }),
    ).rejects.toThrow("TEAM_ACCESS_DENIED");
  });
  it("requires recent authentication for sensitive grants", async () => {
    const w = await world();
    vi.spyOn(Date, "now").mockReturnValue(Date.now() + 11 * 60_000);
    await expect(
      w.owner.mutation(internal.teamInvitations.persist, {
        scope: w.scope,
        phone: "+919123456789",
        role: "member",
        token: w.token,
      }),
    ).rejects.toThrow("RECENT_AUTH_REQUIRED");
  });
});

describe("verified phone invitations", () => {
  it("binds the token to the intended phone, consumes once, and uses the existing workspace roster", async () => {
    const w = await world();
    const invitation = await w.owner.action(api.teamInvitations.create, {
      scope: w.workspace,
      phone: "+919123456789",
      role: "member",
    });
    w.token = invitation.token;
    expect(
      await w.other.query(api.teamInvitations.preview, { token: w.token }),
    ).toBeNull();
    await expect(
      w.other.mutation(api.teamInvitations.accept, { token: w.token }),
    ).rejects.toThrow("INVITATION_UNAVAILABLE");
    await w.person.mutation(api.teamInvitations.accept, { token: w.token });
    await w.person.mutation(api.workspace.select, { orgId: w.orgId });
    expect(await w.person.query(api.workspace.mine, {})).toMatchObject({
      kind: "org",
      role: "member",
    });
    await expect(
      w.person.mutation(api.teamInvitations.accept, { token: w.token }),
    ).rejects.toThrow("INVITATION_UNAVAILABLE");
    const rows = await w.t.run((ctx) =>
      ctx.db.query("phoneTeamInvitations").collect(),
    );
    expect(JSON.stringify(rows)).not.toContain(w.token);
  });
  it("requires the authenticated phone to be verified, not just a profile phone", async () => {
    const w = await world();
    await w.owner.mutation(internal.teamInvitations.persist, {
      scope: w.workspace,
      phone: "+919123456789",
      role: "member",
      token: w.token,
    });
    await w.t.run(async (ctx) => {
      const profile = await ctx.db.get("profiles", w.profileId);
      if (!profile) throw new Error("Missing profile");
      await ctx.runMutation(components.betterAuth.adapter.updateOne, {
        input: {
          model: "user",
          where: [{ field: "_id", value: profile.authUserId }],
          update: { phoneNumberVerified: false },
        },
      });
    });
    expect(
      await w.person.query(api.teamInvitations.preview, { token: w.token }),
    ).toBeNull();
    await expect(
      w.person.mutation(api.teamInvitations.accept, { token: w.token }),
    ).rejects.toThrow("INVITATION_UNAVAILABLE");
  });
  it("does not upgrade an existing viewer through invitation acceptance", async () => {
    const w = await world();
    await w.t.run((ctx) =>
      ctx.db.insert("memberships", {
        profileId: w.profileId,
        orgId: w.orgId,
        role: "viewer",
        createdAt: Date.now(),
      }),
    );
    await w.owner.mutation(internal.teamInvitations.persist, {
      scope: w.workspace,
      phone: "+919123456789",
      role: "admin",
      token: w.token,
    });
    await w.person.mutation(api.teamInvitations.accept, { token: w.token });
    await w.person.mutation(api.workspace.select, { orgId: w.orgId });
    expect(await w.person.query(api.workspace.mine, {})).toMatchObject({
      role: "viewer",
    });
  });
  it("rejects revoked, expired and no-longer-authorized invitations", async () => {
    const w = await world();
    const id = await w.owner.mutation(internal.teamInvitations.persist, {
      scope: w.workspace,
      phone: "+919123456789",
      role: "member",
      token: w.token,
    });
    await w.owner.mutation(api.teamInvitations.revoke, {
      scope: w.workspace,
      invitationId: id,
    });
    expect(
      await w.person.query(api.teamInvitations.preview, { token: w.token }),
    ).toBeNull();
    await w.t.run((ctx) =>
      ctx.db.patch("phoneTeamInvitations", id, {
        revokedAt: undefined,
        expiresAt: Date.now() - 1,
      }),
    );
    expect(
      await w.person.query(api.teamInvitations.preview, { token: w.token }),
    ).toBeNull();
    await w.t.run(async (ctx) => {
      await ctx.db.patch("phoneTeamInvitations", id, {
        expiresAt: Date.now() + 60_000,
      });
      await ctx.db.patch("orgs", w.orgId, { status: "suspended" });
    });
    expect(
      await w.person.query(api.teamInvitations.preview, { token: w.token }),
    ).toBeNull();
  });
  it("limits repeated invitations and rejects cross-scope revocation", async () => {
    const w = await world();
    const id = await w.owner.mutation(internal.teamInvitations.persist, {
      scope: w.scope,
      phone: "+919123456789",
      role: "member",
      token: w.token,
    });
    await expect(
      w.owner.mutation(internal.teamInvitations.persist, {
        scope: w.scope,
        phone: "+919123456789",
        role: "member",
        token: "c".repeat(64),
      }),
    ).rejects.toThrow("INVITATION_EXISTS");
    await expect(
      w.owner.mutation(api.teamInvitations.revoke, {
        scope: w.workspace,
        invitationId: id,
      }),
    ).rejects.toThrow("TEAM_ACCESS_DENIED");
  });
});

it("checks authoritative site seats again at phone invitation acceptance and preserves billing-off additions", async () => {
  const w = await world();
  await w.owner.mutation(internal.teamInvitations.persist, {
    scope: w.workspace,
    phone: "+919123456789",
    role: "member",
    token: w.token,
  });
  await w.t.run(async (ctx) => {
    await ctx.db.insert("businessSubscriptionEntitlements", {
      orgId: w.orgId,
      provider: "cashfree",
      providerSubscriptionId: "verified-test-subscription",
      providerEventId: "verified-test-event",
      plan: "trader",
      verifiedAt: Date.now(),
      validFrom: Date.now() - 1000,
      validUntil: Date.now() + 60_000,
      memberLimit: 3,
      siteLimit: 1,
    });
    for (const n of [1, 2]) {
      const profileId = await ctx.db.insert("profiles", {
        authUserId: `phone-cap-${String(n)}`,
        kind: "member",
        locale: "en",
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
      await ctx.db.insert("memberships", {
        orgId: w.orgId,
        profileId,
        role: "viewer",
        createdAt: Date.now(),
      });
    }
  });
  vi.stubEnv("BUSINESS_SUBSCRIPTIONS_ENFORCEMENT_ENABLED", "true");
  await expect(
    w.person.mutation(api.teamInvitations.accept, { token: w.token }),
  ).rejects.toThrow("SUBSCRIPTION_MEMBER_LIMIT");
  vi.stubEnv("BUSINESS_SUBSCRIPTIONS_ENFORCEMENT_ENABLED", "false");
  await w.person.mutation(api.teamInvitations.accept, { token: w.token });
  expect(await w.person.query(api.workspace.mine, {})).toMatchObject({
    kind: "org",
  });
  // A consumed token remains unusable under the existing invitation contract.
  await expect(
    w.person.mutation(api.teamInvitations.accept, { token: w.token }),
  ).rejects.toThrow("INVITATION_UNAVAILABLE");
  const team = await w.owner.query(api.workspace.team, { orgId: w.orgId });
  expect(team.members).toHaveLength(4);
});
