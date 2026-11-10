/// <reference types="vite/client" />
// @vitest-environment edge-runtime
import { convexTest } from "convex-test";
import { afterEach, expect, it, vi } from "vitest";

import { api } from "./_generated/api";
import {
  convexModules,
  registerAuth,
  seedDemo,
  signIn,
  signInAs,
} from "./lib/auth.testing";
import { INVITATION_TTL_MS } from "./lib/workspaceRoles";
import schema from "./schema";

const modules = convexModules(import.meta.glob("./**/*.*s"));
const permission = "shared_collection_progress" as const;
const phone = "+919876500021";
const token = "priyademo1";

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
});

async function familyWorld() {
  vi.stubEnv("AUTH_DEV_MODE", "true");
  vi.stubEnv("BETTER_AUTH_SECRET", "local-test-secret-000000000000000");
  const t = convexTest(schema, modules);
  registerAuth(t);
  await seedDemo(t);
  const owner = await signInAs(t, "+919000000109");
  const member = await signIn(t, {
    phoneNumber: phone,
    email: "family@example.test",
  });
  const outsider = await signIn(t, {
    phoneNumber: "+919876500022",
    email: "outside@example.test",
  });
  const unverified = await signIn(t, { email: "unverified@example.test" });
  const ownerId = await owner.mutation(api.identity.ensureProfile, {
    locale: "en",
  });
  await member.mutation(api.identity.ensureProfile, { locale: "en" });
  await outsider.mutation(api.identity.ensureProfile, { locale: "en" });
  await unverified.mutation(api.identity.ensureProfile, { locale: "en" });
  return { t, owner, member, outsider, unverified, ownerId };
}

it("allows only the intended verified adult to accept a one-use invitation", async () => {
  const { t, owner, member, outsider, unverified } = await familyWorld();
  const code = await owner.action(api.householdFamily.invite, {
    phone,
    permission,
    adultConfirmed: true,
  });
  const grant = await t.run((ctx) =>
    ctx.db.query("householdFamilyGrants").first(),
  );
  expect(grant?.tokenHash).toMatch(/^[\da-f]{64}$/);
  expect(JSON.stringify(grant)).not.toContain(code);
  expect(JSON.stringify(grant)).not.toContain(phone);
  expect(await outsider.query(api.households.track, { token })).toBeNull();
  await expect(
    unverified.mutation(api.householdFamily.accept, {
      token: code,
      adultConfirmed: true,
    }),
  ).rejects.toThrow("VERIFIED_PHONE_REQUIRED");
  await expect(
    outsider.mutation(api.householdFamily.accept, {
      token: code,
      adultConfirmed: true,
    }),
  ).rejects.toThrow("INVITATION_UNAVAILABLE");
  await expect(
    owner.action(api.householdFamily.invite, {
      phone,
      permission,
      adultConfirmed: true,
    }),
  ).rejects.toThrow("INVITATION_EXISTS");
  await member.mutation(api.householdFamily.accept, {
    token: code,
    adultConfirmed: true,
  });
  await expect(
    member.mutation(api.householdFamily.accept, {
      token: code,
      adultConfirmed: true,
    }),
  ).rejects.toThrow("INVITATION_UNAVAILABLE");
  expect(await owner.query(api.householdFamily.mine, {})).toMatchObject({
    invited: [{ phoneLastFour: "0021", accepted: true }],
  });
});

it("shares only the chosen booking progress and applies owner removal and revocation on every read", async () => {
  const { t, owner, member, outsider, ownerId } = await familyWorld();
  const code = await owner.action(api.householdFamily.invite, {
    phone,
    permission,
    adultConfirmed: true,
  });
  await owner.mutation(api.householdFamily.shareCollection, {
    token,
    share: true,
  });
  expect(await member.query(api.householdFamily.collections, {})).toEqual([]);
  await member.mutation(api.householdFamily.accept, {
    token: code,
    adultConfirmed: true,
  });
  const view = await member.query(api.households.track, { token });
  expect(view).toMatchObject({
    familyView: true,
    isMine: false,
    items: [],
    canCancel: false,
  });
  expect(view?.receipt).toBeUndefined();
  expect(view?.receiptReview).toBeUndefined();
  expect(view?.points).toBeUndefined();
  expect(view?.estimatePaise).toBeUndefined();
  expect(view?.shop.phone).toBeUndefined();
  expect(
    await member.query(api.households.track, { token: "priyademo2" }),
  ).toBeNull();
  expect(await outsider.query(api.households.track, { token })).toBeNull();
  expect(await member.query(api.householdFamily.collections, {})).toEqual([
    expect.objectContaining({ token }),
  ]);
  await expect(
    member.mutation(api.households.cancel, { token }),
  ).rejects.toThrow("NOT_YOURS");
  await expect(
    member.mutation(api.householdFamily.shareCollection, {
      token,
      share: false,
    }),
  ).rejects.toThrow("NOT_YOURS");

  await owner.mutation(api.householdFamily.shareCollection, {
    token,
    share: false,
  });
  expect(await member.query(api.households.track, { token })).toBeNull();
  await owner.mutation(api.householdFamily.shareCollection, {
    token,
    share: true,
  });
  const family = await owner.query(api.householdFamily.mine, {});
  const grant = family?.invited[0];
  if (!grant) throw new Error("Missing family grant");
  await expect(
    outsider.mutation(api.householdFamily.revoke, { id: grant.id }),
  ).rejects.toThrow("NOT_YOURS");
  await owner.mutation(api.householdFamily.revoke, { id: grant.id });
  expect(await member.query(api.households.track, { token })).toBeNull();

  const reissued = await owner.action(api.householdFamily.invite, {
    phone,
    permission,
    adultConfirmed: true,
  });
  await member.mutation(api.householdFamily.accept, {
    token: reissued,
    adultConfirmed: true,
  });
  await t.run((ctx) => ctx.db.patch(ownerId, { closedAt: Date.now() }));
  expect(await member.query(api.householdFamily.collections, {})).toEqual([]);
  expect(await member.query(api.households.track, { token })).toBeNull();
});

it("expires an unused code and permits a replacement", async () => {
  const { t, owner, member } = await familyWorld();
  vi.useFakeTimers();
  const code = await owner.action(api.householdFamily.invite, {
    phone,
    permission,
    adultConfirmed: true,
  });
  const grant = await t.run((ctx) =>
    ctx.db.query("householdFamilyGrants").first(),
  );
  expect(grant?.expiresAt).toBeGreaterThan(Date.now());
  if (!grant) throw new Error("Missing invitation");
  await t.run((ctx) =>
    ctx.db.patch(grant._id, { expiresAt: Date.now() - INVITATION_TTL_MS }),
  );
  await expect(
    member.mutation(api.householdFamily.accept, {
      token: code,
      adultConfirmed: true,
    }),
  ).rejects.toThrow("INVITATION_UNAVAILABLE");
  const replacement = await owner.action(api.householdFamily.invite, {
    phone,
    permission,
    adultConfirmed: true,
  });
  await member.mutation(api.householdFamily.accept, {
    token: replacement,
    adultConfirmed: true,
  });
  const family = await owner.query(api.householdFamily.mine, {});
  expect(family?.invited).toHaveLength(1);
});
