// @vitest-environment node
import { convexTest } from "convex-test";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { z } from "zod";

import { api, components, internal } from "./_generated/api";
import {
  canSpendAfterRemoval,
  isPhoneGrantCurrent,
} from "./lib/accountClosure";
import { convexModules, registerAuth, signIn } from "./lib/auth.testing";
import { spendIdentityAttempt } from "./lib/identityCheckQuota";
import { hashToken } from "./lib/integrations";
import { indiaToday } from "./lib/onboarding";
import { hasActivePushSession } from "./lib/push";
import schema from "./schema";

const modules = convexModules(import.meta.glob("./**/*.*s"));
const PHONE = "+919000008801";
const identitySchema = z.object({ _id: z.string() });
beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-10-28T05:00:00Z"));
  vi.stubEnv(
    "BETTER_AUTH_SECRET",
    "account-removal-test-secret-value-12345678",
  );
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
});
async function world(hasFactor = false) {
  const t = convexTest(schema, modules);
  registerAuth(t);
  const person = await signIn(t, {
    email: "removal@example.test",
    phoneNumber: PHONE,
    twoFactorEnabled: hasFactor,
  });
  const profileId = await person.mutation(api.identity.ensureProfile, {
    locale: "ar",
  });
  const user = await t.run(async (ctx) =>
    identitySchema.parse(
      await ctx.runQuery(components.betterAuth.adapter.findOne, {
        model: "user",
        where: [{ field: "phoneNumber", value: PHONE }],
      }),
    ),
  );
  const session = await t.run(async (ctx) =>
    identitySchema.parse(
      await ctx.runQuery(components.betterAuth.adapter.findOne, {
        model: "session",
        where: [{ field: "userId", value: user._id }],
      }),
    ),
  );
  async function proof(
    hasSecondFactor = hasFactor,
    expiresAt = Date.now() + 300_000,
    userId = user._id,
  ) {
    await t.run(async (ctx) => {
      await ctx.runMutation(components.betterAuth.adapter.deleteMany, {
        input: {
          model: "verification",
          where: [
            { field: "identifier", value: `luma-security-${session._id}` },
          ],
        },
        paginationOpts: { cursor: null, numItems: 100 },
      });
      await ctx.runMutation(components.betterAuth.adapter.create, {
        input: {
          model: "verification",
          data: {
            identifier: `luma-security-${session._id}`,
            value: JSON.stringify({ userId, secondFactor: hasSecondFactor }),
            expiresAt,
            createdAt: Date.now(),
            updatedAt: Date.now(),
          },
        },
      });
    });
  }
  await proof();
  return { t, person, profileId, user, session, proof };
}
const closeArgs = {
  operationKey: "remove-account-0001",
  confirm: true as const,
};
it("withdraws access immediately and scrubs optional profile settings without editing evidence", async () => {
  const w = await world();
  expect(await w.person.query(api.accountRemoval.status, {})).toMatchObject({
    recentAuth: true,
    state: "open",
    heldReasons: [],
  });
  expect(await w.person.mutation(api.accountRemoval.close, closeArgs)).toEqual({
    state: "access_closed",
    reasons: [],
  });
  const profile = await w.t.run((ctx) => ctx.db.get("profiles", w.profileId));
  expect(profile).toMatchObject({ closedAt: Date.now(), locale: "en" });
  expect(profile?.phone).toBeUndefined();
  expect(profile?.activeOrgId).toBeUndefined();
  expect(await w.person.query(api.identity.me, {})).toBeNull();
  await expect(
    w.person.mutation(api.identity.ensureProfile, { locale: "en" }),
  ).rejects.toThrow("NOT_SIGNED_IN");
  expect(
    await w.t.run((ctx) => ctx.db.query("inventoryMovements").take(1)),
  ).toEqual([]);
  expect(
    await w.t.run((ctx) => ctx.db.query("accountRemovals").take(2)),
  ).toHaveLength(1);
});
it("keeps identical retries idempotent and rejects changed operation keys", async () => {
  const w = await world();
  await w.person.mutation(api.accountRemoval.close, closeArgs);
  await w.person.mutation(api.accountRemoval.close, closeArgs);
  await expect(
    w.person.mutation(api.accountRemoval.close, {
      ...closeArgs,
      operationKey: "different-operation",
    }),
  ).rejects.toThrow("OPERATION_CONFLICT");
  expect(
    await w.t.run((ctx) => ctx.db.query("accountRemovals").take(2)),
  ).toHaveLength(1);
});
it.each(["expired", "wrong-user", "missing-factor"])(
  "rejects %s full-auth proof without closing the account",
  async (kind) => {
    const w = await world(true);
    switch (kind) {
      case "expired": {
        await w.proof(true, Date.now() - 1);
        break;
      }
      case "wrong-user": {
        await w.proof(true, Date.now() + 300_000, "another-user");
        break;
      }
      case "missing-factor": {
        {
          await w.proof(false);
          // No default
        }
        break;
      }
    }
    await expect(
      w.person.mutation(api.accountRemoval.close, closeArgs),
    ).rejects.toThrow("RECENT_FULL_AUTH_REQUIRED");
    const profile = await w.t.run((ctx) => ctx.db.get("profiles", w.profileId));
    expect(profile?.closedAt).toBeUndefined();
  },
);
it("rejects a stale session even if a proof record is refreshed", async () => {
  const w = await world();
  vi.setSystemTime(Date.now() + 300_001);
  await w.proof();
  await expect(
    w.person.mutation(api.accountRemoval.close, closeArgs),
  ).rejects.toThrow("RECENT_FULL_AUTH_REQUIRED");
});
it("holds configured admin removal and leaves the identity usable", async () => {
  const w = await world(true);
  vi.stubEnv("ADMIN_EMAIL", "removal@example.test");
  expect(await w.person.mutation(api.accountRemoval.close, closeArgs)).toEqual({
    state: "held",
    reasons: ["admin_replacement"],
  });
  expect(await w.person.query(api.identity.me, {})).not.toBeNull();
});
it("finishes bounded cleanup and retains a review record and old profile tombstone", async () => {
  const w = await world();
  await w.person.mutation(api.accountRemoval.close, closeArgs);
  await w.t.finishAllScheduledFunctions(vi.runAllTimers);
  const request = await w.t.run((ctx) =>
    ctx.db.query("accountRemovals").unique(),
  );
  expect(request).toMatchObject({ state: "restricted_review", phase: 23 });
  expect(
    await w.t.run((ctx) =>
      ctx.runQuery(components.betterAuth.adapter.findOne, {
        model: "user",
        where: [{ field: "_id", value: w.user._id }],
      }),
    ),
  ).toBeNull();
  const profile = await w.t.run((ctx) => ctx.db.get("profiles", w.profileId));
  expect(profile?.closedAt).toBeDefined();
});
it("does not let a same-phone rejoin reopen old pending invitations or reset paid checks that day", async () => {
  const w = await world();
  const before = Date.now();
  await w.person.mutation(api.accountRemoval.close, closeArgs);
  await w.t.finishAllScheduledFunctions(vi.runAllTimers);
  const newcomer = await signIn(w.t, {
    email: "new-removal@example.test",
    phoneNumber: PHONE,
  });
  const newProfileId = await newcomer.mutation(api.identity.ensureProfile, {
    locale: "en",
  });
  expect(newProfileId).not.toBe(w.profileId);
  expect(await w.t.run((ctx) => isPhoneGrantCurrent(ctx, PHONE, before))).toBe(
    false,
  );
  expect(await w.t.run((ctx) => canSpendAfterRemoval(ctx, PHONE))).toBe(false);
  await expect(
    w.t.run((ctx) => spendIdentityAttempt(ctx, newProfileId)),
  ).rejects.toThrow("CHECK_LIMIT");
  expect(
    await w.t.run((ctx) => ctx.db.query("identityPersonCheckDays").take(1)),
  ).toEqual([]);
  vi.setSystemTime(Date.now() + 24 * 60 * 60_000);
  expect(await w.t.run((ctx) => canSpendAfterRemoval(ctx, PHONE))).toBe(true);
  await w.t.run((ctx) => spendIdentityAttempt(ctx, newProfileId));
  expect(
    await w.t.run((ctx) => ctx.db.query("identityPersonCheckDays").unique()),
  ).toMatchObject({ day: indiaToday(), used: 1 });
});

async function makeSite(
  w: Awaited<ReturnType<typeof world>>,
  hasOwnership = false,
) {
  return w.t.run((ctx) =>
    ctx.db.insert("orgs", {
      kind: "kabadiwala",
      name: "Removal test shop",
      slug: "removal-test-shop",
      status: "active",
      ownerProfileId: hasOwnership ? w.profileId : undefined,
      city: "Bengaluru",
      area: "Test area",
      address: "Example address",
      phones: [],
      weeklyOff: [],
      families: ["paper"],
      offersPickup: true,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }),
  );
}
it("holds a site owner even when the selected workspace preference is empty", async () => {
  const w = await world();
  await makeSite(w, true);
  expect(await w.person.mutation(api.accountRemoval.close, closeArgs)).toEqual({
    state: "held",
    reasons: ["business_owner"],
  });
  expect(
    await w.t.run((ctx) => ctx.db.query("accountRemovals").take(1)),
  ).toEqual([]);
});
it("holds an active household collection and never cancels it automatically", async () => {
  const w = await world(),
    orgId = await makeSite(w);
  const bookingId = await w.t.run((ctx) =>
    ctx.db.insert("bookings", {
      token: "removal-open-booking",
      householdProfileId: w.profileId,
      phone: PHONE,
      mode: "pickup",
      items: [],
      orgId,
      slotDate: indiaToday(),
      slotWindow: "morning",
      status: "accepted",
      timeline: [{ status: "accepted", at: Date.now() }],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }),
  );
  expect(await w.person.mutation(api.accountRemoval.close, closeArgs)).toEqual({
    state: "held",
    reasons: ["active_collection"],
  });
  const row = await w.t.run((ctx) => ctx.db.get("bookings", bookingId));
  expect(row?.status).toBe("accepted");
});
it.each(["member", "viewer"] as const)(
  "permits %s withdrawal without changing the business stock",
  async (role) => {
    const w = await world(),
      orgId = await makeSite(w);
    await w.t.run(async (ctx) => {
      await ctx.db.patch(orgId, { status: "suspended" });
      await ctx.db.insert("memberships", {
        profileId: w.profileId,
        orgId,
        role,
        createdAt: Date.now(),
      });
    });
    expect(
      await w.person.mutation(api.accountRemoval.close, closeArgs),
    ).toEqual({ state: "access_closed", reasons: [] });
    await w.t.finishAllScheduledFunctions(vi.runAllTimers);
    expect(
      await w.t.run((ctx) =>
        ctx.db
          .query("memberships")
          .withIndex("by_profile", (q) => q.eq("profileId", w.profileId))
          .take(1),
      ),
    ).toEqual([]);
    const org = await w.t.run((ctx) => ctx.db.get("orgs", orgId));
    expect(org?.status).toBe("suspended");
  },
);
it("deletes more than one device batch and preserves a rebound installation", async () => {
  const w = await world();
  const other = await signIn(w.t, {
    email: "other-removal@example.test",
    phoneNumber: "+919000008802",
  });
  const otherId = await other.mutation(api.identity.ensureProfile, {
    locale: "en",
  });
  await w.t.run(async (ctx) => {
    for (let i = 0; i < 105; i++)
      await ctx.db.insert("pushDevices", {
        profileId: w.profileId,
        sessionId: w.session._id,
        installationId: `removal-device-${String(i)}`,
        fingerprint: `removal-fingerprint-${String(i)}`,
        channel: "web",
        endpoint: `https://example.test/${String(i)}`,
        locale: "en",
        expiresAt: Date.now() + 60_000,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
    await ctx.db.insert("pushDevices", {
      profileId: otherId,
      installationId: "rebound-installation",
      fingerprint: "rebound-device",
      channel: "web",
      endpoint: "https://example.test/rebound",
      locale: "en",
      expiresAt: Date.now() + 60_000,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
  });
  await w.person.mutation(api.accountRemoval.close, closeArgs);
  await w.t.finishAllScheduledFunctions(vi.runAllTimers);
  expect(
    await w.t.run((ctx) =>
      ctx.db
        .query("pushDevices")
        .withIndex("by_profile", (q) => q.eq("profileId", w.profileId))
        .take(1),
    ),
  ).toEqual([]);
  expect(
    await w.t.run((ctx) =>
      ctx.db
        .query("pushDevices")
        .withIndex("by_profile", (q) => q.eq("profileId", otherId))
        .take(2),
    ),
  ).toHaveLength(1);
});
it("keeps old completed booking history private after same-phone rejoin", async () => {
  const w = await world(),
    orgId = await makeSite(w);
  const booking = await w.t.run((ctx) =>
    ctx.db.insert("bookings", {
      token: "old-private-completed-booking",
      householdProfileId: w.profileId,
      phone: PHONE,
      mode: "pickup",
      items: [],
      orgId,
      slotDate: indiaToday(),
      slotWindow: "morning",
      status: "completed",
      timeline: [{ status: "completed", at: Date.now() }],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }),
  );
  await w.person.mutation(api.accountRemoval.close, closeArgs);
  await w.t.finishAllScheduledFunctions(vi.runAllTimers);
  const newcomer = await signIn(w.t, {
    email: "rejoined@example.test",
    phoneNumber: PHONE,
  });
  await newcomer.mutation(api.identity.ensureProfile, { locale: "en" });
  expect(
    await newcomer.query(api.households.track, {
      token: "old-private-completed-booking",
    }),
  ).toBeNull();
  expect(
    await w.t.run((ctx) => ctx.db.get("bookings", booking)),
  ).not.toBeNull();
});
it("blocks removal queue access for ordinary members and unfinished review", async () => {
  const w = await world();
  await expect(
    w.person.query(api.accountRemoval.reviewQueue, {}),
  ).rejects.toThrow("NOT_ADMIN");
  await w.person.mutation(api.accountRemoval.close, closeArgs);
  const request = await w.t.run((ctx) =>
    ctx.db.query("accountRemovals").unique(),
  );
  expect(request).not.toBeNull();
});
it("withdraws a personal service recipient's read access before batched cleanup", async () => {
  const w = await world();
  const recipient = await signIn(w.t, {
    email: "recipient-removal@example.test",
    phoneNumber: "+919000008803",
  });
  const recipientProfile = await recipient.mutation(
    api.identity.ensureProfile,
    { locale: "en" },
  );
  const stakeholder = await w.t.run((ctx) =>
    ctx.db.insert("stakeholderAccounts", {
      ownerProfileId: recipientProfile,
      kind: "independent_auditor",
      organizationName: "Example recipient",
      status: "approved",
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }),
  );
  const enquiry = await w.person.mutation(api.services.createEnquiry, {
    operationKey: "removal-enquiry-0001",
    kind: "other",
    title: "Private review request",
    details: "Example private evidence review",
    recipientId: stakeholder,
    submit: true,
    commercialModel: "partner_service",
    principalParty: "",
    shareMaterialLotReference: false,
  });
  expect(
    await recipient.query(api.services.enquiry, { id: enquiry }),
  ).toMatchObject({ title: "Private review request" });
  await w.person.mutation(api.accountRemoval.close, closeArgs);
  await expect(
    recipient.query(api.services.enquiry, { id: enquiry }),
  ).rejects.toThrow("RECORD_ACCESS_DENIED");
  const board = await recipient.query(api.services.board, {});
  expect(board.received).toEqual([]);
});
it.each(["pending", "rejected", "approved"] as const)(
  "allows withdrawal of a personal %s stakeholder registration without inventing a review",
  async (status) => {
    const w = await world();
    const id = await w.t.run((ctx) =>
      ctx.db.insert("stakeholderAccounts", {
        ownerProfileId: w.profileId,
        kind: "independent_auditor",
        organizationName: "Example personal stakeholder",
        status,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      }),
    );
    expect(
      await w.person.mutation(api.accountRemoval.close, closeArgs),
    ).toEqual({ state: "access_closed", reasons: [] });
    const row = await w.t.run((ctx) => ctx.db.get("stakeholderAccounts", id));
    expect(row?.status).toBe(status);
  },
);
it("invalidates a co-owner's machine key, report capability and push session before cleanup", async () => {
  const w = await world();
  const canonical = await signIn(w.t, {
    email: "canonical-owner@example.test",
    phoneNumber: "+919000008805",
  });
  const canonicalId = await canonical.mutation(api.identity.ensureProfile, {
    locale: "en",
  });
  const orgId = await makeSite(w);
  await w.t.run(async (ctx) => {
    await ctx.db.patch(orgId, { ownerProfileId: canonicalId });
    await ctx.db.insert("memberships", {
      profileId: w.profileId,
      orgId,
      role: "owner",
      createdAt: Date.now(),
    });
    await ctx.db.patch(w.profileId, { activeOrgId: orgId });
  });
  const key = await w.person.action(api.integrations.createKey, {
    label: "Example export",
    scopes: ["organization:read"],
    expiresInDays: 1,
  });
  const keyHash = await hashToken(key.token),
    capability = "a".repeat(64),
    capabilityHash = await hashToken(capability);
  const jobId = await w.t.run((ctx) =>
    ctx.db.insert("reportJobs", {
      orgId,
      ownerProfileId: w.profileId,
      operationKey: "removal-report-0001",
      capabilityHash,
      status: "queued",
      snapshot: [],
      createdAt: Date.now(),
      expiresAt: Date.now() + 60_000,
    }),
  );
  expect(await w.person.mutation(api.accountRemoval.close, closeArgs)).toEqual({
    state: "access_closed",
    reasons: [],
  });
  const keyRow = await w.t.run((ctx) =>
    ctx.db.get("integrationKeys", key.keyId),
  );
  expect(keyRow?.revokedAt).toBeUndefined();
  expect(
    await w.t.mutation(internal.integrations.read, {
      keyHash,
      resource: "organization",
      limit: 50,
      cursor: null,
      side: "buyer",
    }),
  ).toMatchObject({ status: 403 });
  await expect(
    w.t.mutation(api.reportJobs.start, { jobId, capability }),
  ).rejects.toThrow("JOB_ACCESS_REVOKED");
  expect(
    await w.t.run(async (ctx) => {
      const closed = await ctx.db.get("profiles", w.profileId);
      if (!closed) throw new Error("Missing closed profile fixture");
      return hasActivePushSession(ctx, w.session._id, closed);
    }),
  ).toBe(false);
});
it("holds the last parent owner but permits withdrawal when another open owner remains", async () => {
  const w = await world();
  const parent = await w.t.run(async (ctx) => {
    const id = await ctx.db.insert("organizations", {
      kind: "business",
      name: "Example parent",
      version: 1,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
    await ctx.db.insert("organizationMemberships", {
      organizationId: id,
      profileId: w.profileId,
      role: "owner",
      createdAt: Date.now(),
    });
    return id;
  });
  expect(await w.person.mutation(api.accountRemoval.close, closeArgs)).toEqual({
    state: "held",
    reasons: ["business_owner"],
  });
  const successor = await signIn(w.t, {
    email: "parent-successor@example.test",
    phoneNumber: "+919000008806",
  });
  const successorId = await successor.mutation(api.identity.ensureProfile, {
    locale: "en",
  });
  await w.t.run((ctx) =>
    ctx.db.insert("organizationMemberships", {
      organizationId: parent,
      profileId: successorId,
      role: "owner",
      createdAt: Date.now(),
    }),
  );
  expect(await w.person.mutation(api.accountRemoval.close, closeArgs)).toEqual({
    state: "access_closed",
    reasons: [],
  });
});
it("revokes incoming and outgoing phone invitations and rejects a stale invite after same-phone rejoin", async () => {
  const w = await world(),
    orgId = await makeSite(w);
  const host = await signIn(w.t, {
    email: "invitation-host@example.test",
    phoneNumber: "+919000008807",
  });
  const hostId = await host.mutation(api.identity.ensureProfile, {
    locale: "en",
  });
  await w.t.run(async (ctx) => {
    await ctx.db.patch(orgId, { ownerProfileId: hostId });
    await ctx.db.insert("memberships", {
      profileId: hostId,
      orgId,
      role: "owner",
      createdAt: Date.now(),
    });
    await ctx.db.insert("memberships", {
      profileId: w.profileId,
      orgId,
      role: "admin",
      createdAt: Date.now(),
    });
    await ctx.db.patch(w.profileId, { activeOrgId: orgId });
  });
  const scope = { kind: "workspace" as const, id: orgId };
  const incoming = await host.action(api.teamInvitations.create, {
    scope,
    phone: PHONE,
    role: "member",
  });
  const outgoing = await w.person.action(api.teamInvitations.create, {
    scope,
    phone: "+919000008808",
    role: "member",
  });
  await w.person.mutation(api.accountRemoval.close, closeArgs);
  await w.t.finishAllScheduledFunctions(vi.runAllTimers);
  const rows = await w.t.run(async (ctx) => [
    await ctx.db.get("phoneTeamInvitations", incoming.id),
    await ctx.db.get("phoneTeamInvitations", outgoing.id),
  ]);
  expect(rows.every((row) => row?.revokedAt !== undefined)).toBe(true);
  const fresh = await signIn(w.t, {
    email: "same-phone-invited@example.test",
    phoneNumber: PHONE,
  });
  await fresh.mutation(api.identity.ensureProfile, { locale: "en" });
  // Even an old record missed by a physical revoke cannot bypass the phone cutoff.
  await w.t.run((ctx) => ctx.db.patch(incoming.id, { revokedAt: undefined }));
  await expect(
    fresh.mutation(api.teamInvitations.accept, { token: incoming.token }),
  ).rejects.toThrow("INVITATION_UNAVAILABLE");
});
it("deletes every stored session across the bounded component adapter pages", async () => {
  const w = await world();
  await w.t.run(async (ctx) => {
    for (let i = 0; i < 104; i++)
      await ctx.runMutation(components.betterAuth.adapter.create, {
        input: {
          model: "session",
          data: {
            userId: w.user._id,
            token: `removal-extra-session-${String(i)}`,
            createdAt: Date.now(),
            updatedAt: Date.now(),
            expiresAt: Date.now() + 60_000,
          },
        },
      });
  });
  await w.person.mutation(api.accountRemoval.close, closeArgs);
  await w.t.finishAllScheduledFunctions(vi.runAllTimers);
  expect(
    await w.t.run((ctx) =>
      ctx.runQuery(components.betterAuth.adapter.findOne, {
        model: "session",
        where: [{ field: "userId", value: w.user._id }],
      }),
    ),
  ).toBeNull();
  const request = await w.t.run((ctx) =>
    ctx.db.query("accountRemovals").unique(),
  );
  expect(request?.state).toBe("restricted_review");
});
it("uses current-obligation indexes instead of permanently holding a long resolved history", async () => {
  const w = await world(),
    orgId = await makeSite(w);
  const current = await w.t.run(async (ctx) => {
    const saathiProfileId = await ctx.db.insert("saathiProfiles", {
      profileId: w.profileId,
      name: "Example worker",
      city: "Bengaluru",
      area: "Example area",
      radiusKm: 2,
      workTypes: ["home_pickups"],
      vehicle: "none",
      times: ["morning"],
      days: [],
      status: "active",
      createdAt: Date.now(),
    });
    for (let i = 0; i < 106; i++) {
      const bookingId = await ctx.db.insert("bookings", {
        token: `resolved-history-${String(i)}`,
        householdProfileId: w.profileId,
        phone: PHONE,
        mode: "pickup",
        items: [],
        orgId,
        slotDate: indiaToday(),
        slotWindow: "morning",
        status: "completed",
        timeline: [{ status: "completed", at: Date.now() }],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
      const jobId = await ctx.db.insert("jobs", {
        orgId,
        kind: "home_pickups",
        title: "Resolved job",
        area: "Example area",
        date: indiaToday(),
        window: "morning",
        payPaise: 0,
        status: "done",
        saathiProfileId,
        createdAt: Date.now(),
      });
      await ctx.db.insert("workerHandovers", {
        orgId,
        jobId,
        bookingId,
        saathiProfileId,
        workerProfileId: w.profileId,
        operationKey: `resolved-handover-${String(i)}`,
        boundByProfileId: w.profileId,
        createdAt: Date.now(),
        acknowledgedAt: Date.now(),
      });
    }
    const jobId = await ctx.db.insert("jobs", {
      orgId,
      kind: "home_pickups",
      title: "Current job",
      area: "Example area",
      date: indiaToday(),
      window: "morning",
      payPaise: 0,
      status: "assigned",
      saathiProfileId,
      createdAt: Date.now(),
    });
    const bookingId = await ctx.db.insert("bookings", {
      token: "pending-handover-history",
      householdProfileId: w.profileId,
      phone: PHONE,
      mode: "pickup",
      items: [],
      orgId,
      slotDate: indiaToday(),
      slotWindow: "morning",
      status: "completed",
      timeline: [{ status: "completed", at: Date.now() }],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
    return { jobId, saathiProfileId, bookingId };
  });
  expect(await w.person.mutation(api.accountRemoval.close, closeArgs)).toEqual({
    state: "held",
    reasons: ["assigned_work"],
  });
  // Cancelled old assignments are not current work and must not block withdrawal.
  await w.t.run((ctx) =>
    ctx.db.patch(current.jobId, { cancelledAt: Date.now() }),
  );
  const handoverId = await w.t.run((ctx) =>
    ctx.db.insert("workerHandovers", {
      orgId,
      jobId: current.jobId,
      bookingId: current.bookingId,
      saathiProfileId: current.saathiProfileId,
      workerProfileId: w.profileId,
      operationKey: "current-pending-handover",
      boundByProfileId: w.profileId,
      createdAt: Date.now(),
      collectedAt: Date.now(),
      collectedGrams: 1000,
    }),
  );
  expect(await w.person.mutation(api.accountRemoval.close, closeArgs)).toEqual({
    state: "held",
    reasons: ["assigned_work"],
  });
  await w.t.run((ctx) =>
    ctx.db.patch(handoverId, { acknowledgedAt: Date.now() }),
  );
  expect(await w.person.mutation(api.accountRemoval.close, closeArgs)).toEqual({
    state: "access_closed",
    reasons: [],
  });
});
