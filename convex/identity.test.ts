/// <reference types="vite/client" />
// @vitest-environment edge-runtime
import { convexTest } from "convex-test";
import { afterEach, describe, expect, it, vi } from "vitest";

import { api, components } from "./_generated/api";
import { convexModules, registerAuth, signIn } from "./lib/auth.testing";
import schema from "./schema";

const modules = convexModules(import.meta.glob("./**/*.*s"));

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("signInOptions", () => {
  it("offers phone sign-in only when codes can be delivered", async () => {
    const t = convexTest(schema, modules);

    vi.stubEnv("AUTH_DEV_MODE", "");
    vi.stubEnv("MSG91_AUTH_KEY", "");
    const off = await t.query(api.identity.signInOptions, {});
    expect(off.phone).toBe(false);

    vi.stubEnv("AUTH_DEV_MODE", "true");
    const devMode = await t.query(api.identity.signInOptions, {});
    expect(devMode.phone).toBe(false);
    vi.stubEnv("AUTH_LOCAL_TEST_MODE", "true");
    vi.stubEnv("SITE_URL", "http://localhost:3000");
    vi.stubEnv("CONVEX_SITE_URL", "http://127.0.0.1:3211");
    vi.stubEnv("AUTH_LOCAL_EMAIL_INBOX_URL", "http://127.0.0.1:3215/deliver");
    vi.stubEnv(
      "AUTH_LOCAL_EMAIL_INBOX_TOKEN",
      "private-test-inbox-0123456789abcdef",
    );
    const local = await t.query(api.identity.signInOptions, {});
    expect(local.phone).toBe(true);
    expect(local.email).toBe(false);
  });

  it("opens admin setup only with a configured identity, before an admin exists", async () => {
    const t = convexTest(schema, modules);

    vi.stubEnv("ADMIN_EMAIL", "");
    const unset = await t.query(api.identity.signInOptions, {});
    expect(unset.adminSetup).toBe(false);

    vi.stubEnv("ADMIN_EMAIL", "admin@luma.test");
    vi.stubEnv("ADMIN_SETUP_TOKEN", "");
    const noToken = await t.query(api.identity.signInOptions, {});
    expect(noToken.adminSetup).toBe(true);
    vi.stubEnv("ADMIN_SETUP_TOKEN", "short-token");
    const shortToken = await t.query(api.identity.signInOptions, {});
    expect(shortToken.adminSetup).toBe(true);
    vi.stubEnv("ADMIN_SETUP_TOKEN", "x".repeat(513));
    const longToken = await t.query(api.identity.signInOptions, {});
    expect(longToken.adminSetup).toBe(true);
    vi.stubEnv("ADMIN_SETUP_TOKEN", "test-setup-token-0123456789abcdef");
    const open = await t.query(api.identity.signInOptions, {});
    expect(open.adminSetup).toBe(true);

    await t.run(async (ctx) => {
      const now = Date.now();
      const profileId = await ctx.db.insert("profiles", {
        authUserId: "user_1",
        kind: "admin",
        locale: "en",
        createdAt: now,
        updatedAt: now,
      });
      await ctx.db.insert("adminProfiles", {
        profileId,
        name: "Asha Rao",
        email: "admin@luma.test",
        phone: "+919876543210",
        dateOfBirth: "1990-01-15",
        aadhaarLast4: "1234",
        createdAt: now,
        updatedAt: now,
      });
    });
    const done = await t.query(api.identity.signInOptions, {});
    expect(done.adminSetup).toBe(false);
  });
});

describe("signed out", () => {
  it("has no identity", async () => {
    const t = convexTest(schema, modules);
    expect(await t.query(api.identity.me, {})).toBeNull();
  });

  it("can't create a profile, save the admin record or read the console", async () => {
    const t = convexTest(schema, modules);
    vi.stubEnv("ADMIN_EMAIL", "admin@luma.test");

    await expect(
      t.mutation(api.identity.ensureProfile, { locale: "kn" }),
    ).rejects.toThrow(/NOT_SIGNED_IN/);
    await expect(
      t.mutation(api.identity.saveAdminProfile, {
        name: "Mallory",
        phone: "+919876543210",
        dateOfBirth: "1990-01-15",
        aadhaarLast4: "1234",
      }),
    ).rejects.toThrow(/NOT_SIGNED_IN/);
    await expect(t.query(api.admin.overview, {})).rejects.toThrow(
      /NOT_SIGNED_IN/,
    );

    const rows = await t.run(async (ctx) => ({
      profiles: await ctx.db.query("profiles").collect(),
      adminProfiles: await ctx.db.query("adminProfiles").collect(),
    }));
    expect(rows).toEqual({ profiles: [], adminProfiles: [] });
  });
});

describe("verified profile phone", () => {
  it("does not copy an unverified authentication phone into a new profile", async () => {
    const t = convexTest(schema, modules);
    registerAuth(t);
    const as = await signIn(t, {
      email: "unverified@example.test",
      phoneNumber: "+919000000007",
    });
    await t.run((ctx) =>
      ctx.runMutation(components.betterAuth.adapter.updateOne, {
        input: {
          model: "user",
          where: [{ field: "email", value: "unverified@example.test" }],
          update: { phoneNumberVerified: false },
        },
      }),
    );
    const id = await as.mutation(api.identity.ensureProfile, { locale: "en" });
    const profile = await t.run((ctx) => ctx.db.get("profiles", id));
    expect(profile?.phone).toBeUndefined();
  });

  it("syncs a newly verified phone on the existing profile without changing authentication state", async () => {
    const t = convexTest(schema, modules);
    registerAuth(t);
    const as = await signIn(t, {
      email: "existing@example.test",
      twoFactorEnabled: true,
    });
    const profileId = await as.mutation(api.identity.ensureProfile, {
      locale: "en",
    });
    const profile = await t.run((ctx) => ctx.db.get("profiles", profileId));
    if (!profile) throw new Error("Missing existing profile");
    const sessionsBefore = await t.run((ctx) =>
      ctx.runQuery(components.betterAuth.adapter.findMany, {
        model: "session",
        where: [{ field: "userId", value: profile.authUserId }],
        paginationOpts: { numItems: 10, cursor: null },
      }),
    );
    await t.run((ctx) =>
      ctx.runMutation(components.betterAuth.adapter.updateOne, {
        input: {
          model: "user",
          where: [{ field: "_id", value: profile.authUserId }],
          update: { phoneNumber: "+919000000008", phoneNumberVerified: true },
        },
      }),
    );
    const userBefore = await t.run((ctx) =>
      ctx.runQuery(components.betterAuth.adapter.findOne, {
        model: "user",
        where: [{ field: "_id", value: profile.authUserId }],
      }),
    );
    expect(
      await as.mutation(api.identity.ensureProfile, { locale: "en" }),
    ).toBe(profileId);
    expect(
      await t.run((ctx) => ctx.db.get("profiles", profileId)),
    ).toMatchObject({
      _id: profileId,
      authUserId: profile.authUserId,
      phone: "+919000000008",
      kind: "member",
    });
    expect(await as.query(api.identity.me, {})).toMatchObject({
      twoFactorEnabled: true,
    });
    expect(
      await t.run((ctx) =>
        ctx.runQuery(components.betterAuth.adapter.findOne, {
          model: "user",
          where: [{ field: "_id", value: profile.authUserId }],
        }),
      ),
    ).toEqual(userBefore);
    expect(
      await t.run((ctx) =>
        ctx.runQuery(components.betterAuth.adapter.findMany, {
          model: "session",
          where: [{ field: "userId", value: profile.authUserId }],
          paginationOpts: { numItems: 10, cursor: null },
        }),
      ),
    ).toEqual(sessionsBefore);
  });
});
