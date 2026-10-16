import { describe, expect, it } from "vitest";

import { api } from "../convex/_generated/api";
import {
  inboxFixture,
  securityFixture,
} from "../scripts/guide-preview/account-fixtures";
import { authClient } from "../scripts/guide-preview/auth";
import { redirect } from "../scripts/guide-preview/navigation";
import {
  useAction,
  useMutation,
  usePaginatedQuery,
  useQuery,
} from "../scripts/guide-preview/queries";
import {
  workspaceListFixture,
  workspaceTeamFixture,
} from "../scripts/guide-preview/workspace-fixtures";

describe("isolated account documentation fixtures", () => {
  it("never authenticates, changes protection or returns a secret", async () => {
    expect(() => redirect()).toThrow(
      "Server redirects are unavailable in the isolated preview.",
    );
    expect(authClient.useSession().data).toEqual({
      fixture: true,
      user: {
        id: "guide-fictional-user",
        email: "guide-fictional@example.test",
        emailVerified: false,
        phoneNumberVerified: false,
      },
      session: { id: undefined },
    });
    for (const change of [
      authClient.signOut,
      authClient.signUp.email,
      authClient.requestPasswordReset,
      authClient.resetPassword,
      ...Object.values(authClient.twoFactor),
      ...Object.values(authClient.phoneNumber),
    ])
      await expect(change()).rejects.toThrow("cannot change accounts");
    expect(securityFixture("?security=on")).toEqual({
      kind: "member",
      hasProfile: true,
      twoFactorEnabled: true,
      hasPassword: false,
      adminName: undefined,
      locale: undefined,
      phone: undefined,
    });
    expect(securityFixture("")?.twoFactorEnabled).toBe(false);
  });

  it("permits only a synthetic challenge transition in the failure entry", async () => {
    window.history.replaceState(null, "", "/en/account/security?scenario=totp");
    await expect(authClient.signIn.email()).rejects.toThrow(
      "cannot change accounts",
    );
    window.history.replaceState(null, "", "/failure.html?scenario=login");
    await expect(authClient.signIn.email()).rejects.toThrow(
      "cannot change accounts",
    );
    window.history.replaceState(null, "", "/failure.html?scenario=totp");
    await expect(authClient.signIn.email()).resolves.toEqual({
      data: { twoFactorRedirect: true },
      error: null,
    });
    window.history.replaceState(null, "", "/");
  });

  it("keeps inbox records synthetic and missing data separate from loading", () => {
    const ready = inboxFixture("");
    expect(ready.unreadCount).toBe(2);
    expect(ready.results).toHaveLength(3);
    for (const item of ready.results) {
      expect(item.id).toMatch(/^guide-inbox-/);
      expect(Object.keys(item).toSorted((a, b) => a.localeCompare(b))).toEqual([
        "createdAt",
        "event",
        "id",
        "read",
      ]);
    }
    expect(inboxFixture("?inbox=empty")).toEqual({
      results: [],
      status: "Exhausted",
      unreadCount: 0,
    });
    expect(inboxFixture("?inbox=loading")).toEqual({
      results: [],
      status: "LoadingFirstPage",
      unreadCount: 0,
    });
  });
});

describe("isolated workspace documentation fixtures", () => {
  it("renders synthetic membership and pending invitation records without tokens", () => {
    expect(useQuery(api.workspace.list)).toEqual(workspaceListFixture);
    expect(useQuery(api.workspace.team)).toEqual(workspaceTeamFixture);
    expect(workspaceListFixture.filter((item) => item.selected)).toHaveLength(
      1,
    );
    for (const item of workspaceListFixture) {
      expect(item.org.id).toMatch(/^guide-workspace-/);
      expect(item.org.name).toMatch(/^Demo /);
      expect(item.org.gstin).toBeUndefined();
    }
    for (const member of workspaceTeamFixture.members) {
      expect(member.name).toMatch(/^Demo /);
      expect(member.id).toMatch(/^guide-membership-/);
    }
    for (const invitation of workspaceTeamFixture.invitations) {
      expect(invitation.email).toMatch(/@example\.test$/);
      expect(invitation.delivery).toBe("pending");
      expect(invitation).not.toHaveProperty("token");
    }
    expect(useQuery(api.workspace.team, "skip")).toBeUndefined();
  });

  it("rejects workspace mutations and invitation actions without changing fixtures", async () => {
    window.history.replaceState(null, "", "/ar/account/workspaces");
    const before = JSON.stringify([workspaceListFixture, workspaceTeamFixture]);
    await expect(useMutation()()).rejects.toThrow("writes are disabled");
    await expect(useAction()()).rejects.toThrow("writes are disabled");
    expect(JSON.stringify([workspaceListFixture, workspaceTeamFixture])).toBe(
      before,
    );
    window.history.replaceState(null, "", "/");
  });
});

it("uses a synthetic member for onboarding instead of the admin console identity", () => {
  window.history.replaceState(null, "", "/ar/join/kabadiwala");
  expect(useQuery(api.identity.me)).toMatchObject({
    kind: "member",
    hasProfile: true,
  });
  window.history.replaceState(null, "", "/admin");
  expect(useQuery(api.identity.me)).toMatchObject({ kind: "admin" });
  window.history.replaceState(null, "", "/");
});

describe("isolated operational documentation fixtures", () => {
  it("returns synthetic records for each newly previewed workflow", () => {
    expect(useQuery(api.traceability.mine)).toMatchObject({
      rows: [{ id: "guide-operations-lot", availableGrams: 125_000 }],
    });
    expect(useQuery(api.qualityFiles.board)).toMatchObject({
      own: [{ name: "synthetic-quality-example.pdf" }],
    });
    expect(useQuery(api.auditShares.board)).toMatchObject({
      received: [{ id: "guide-operations-report" }],
    });
    expect(useQuery(api.auditShares.read)).toMatchObject({
      files: [{ available: false }],
    });
    expect(usePaginatedQuery(api.routePlans.mine)).toMatchObject({
      results: [{ _id: "guide-operations-route" }],
      status: "Exhausted",
    });
    expect(useQuery(api.routePlans.detail)).toMatchObject({
      plan: { title: "Synthetic collection route" },
    });
    expect(usePaginatedQuery(api.routePlans.history)).toMatchObject({
      results: [{ revision: 1 }],
      status: "Exhausted",
    });
  });
  it("never executes writes or provider actions for operational previews", async () => {
    window.history.replaceState(null, "", "/en/app/logistics");
    const before = JSON.stringify(useQuery(api.routePlans.detail));
    await expect(useMutation()()).rejects.toThrow("writes are disabled");
    await expect(useAction()()).rejects.toThrow("writes are disabled");
    expect(JSON.stringify(useQuery(api.routePlans.detail))).toBe(before);
    expect(() => usePaginatedQuery(api.routePlans.history).loadMore()).toThrow(
      "pagination is exhausted",
    );
  });
});
