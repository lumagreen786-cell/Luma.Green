/// <reference types="vite/client" />
// @vitest-environment edge-runtime
import { convexTest } from "convex-test";
import { afterEach, expect, it, vi } from "vitest";

import { components, internal } from "./_generated/api";
import { convexModules, registerAuth } from "./lib/auth.testing";
import { LOCAL_ACCEPTANCE_PERSONAS } from "./lib/localAcceptance";
import { phoneEmail } from "./lib/phone";
import schema from "./schema";

const modules = convexModules(import.meta.glob("./**/*.*s"));
afterEach(() => {
  vi.unstubAllEnvs();
});

function world() {
  vi.stubEnv("AUTH_LOCAL_TEST_MODE", "true");
  vi.stubEnv("SITE_URL", "http://localhost:3100");
  vi.stubEnv("CONVEX_SITE_URL", "http://127.0.0.1:3211");
  const t = convexTest(schema, modules);
  registerAuth(t);
  return t;
}

async function verifiedIdentity(
  t: ReturnType<typeof world>,
  key: string,
  isVerified = true,
) {
  return t.run(async (ctx) => {
    const now = Date.now();
    const user = (await ctx.runMutation(components.betterAuth.adapter.create, {
      input: {
        model: "user",
        data: {
          name: "Synthetic acceptance identity",
          email: `${key}@luma.test`,
          emailVerified: isVerified,
          createdAt: now,
          updatedAt: now,
        },
      },
    })) as { _id: string };
    const profileId = await ctx.db.insert("profiles", {
      authUserId: user._id,
      kind: "member",
      locale: "en",
      createdAt: now,
      updatedAt: now,
    });
    return { key, authUserId: user._id, profileId };
  });
}

it.each([
  ["false", "http://localhost:3100", "http://127.0.0.1:3211"],
  ["true", "https://luma.green", "http://127.0.0.1:3211"],
  ["true", "http://localhost:3100", "https://dev.convex.site"],
])(
  "refuses fixture writes outside the strict local gate (case %#)",
  async (mode, site, backend) => {
    const t = world();
    vi.stubEnv("AUTH_LOCAL_TEST_MODE", mode);
    vi.stubEnv("SITE_URL", site);
    vi.stubEnv("CONVEX_SITE_URL", backend);
    await expect(
      t.mutation(internal.localAcceptance.seed, { accounts: [] }),
    ).rejects.toThrow("LOCAL_ACCEPTANCE_ONLY");
    expect(await t.run((ctx) => ctx.db.query("auditLog").first())).toBeNull();
  },
);

it("requires the matching verified identity and a supported persona", async () => {
  const t = world();
  const pending = await verifiedIdentity(t, "kabadiwala", false);
  await expect(
    t.mutation(internal.localAcceptance.seed, {
      accounts: [{ key: pending.key, authUserId: pending.authUserId }],
    }),
  ).rejects.toThrow("ACCEPTANCE_IDENTITY_NOT_VERIFIED");
  await expect(
    t.mutation(internal.localAcceptance.seed, {
      accounts: [{ key: "admin", authUserId: pending.authUserId }],
    }),
  ).rejects.toThrow("INVALID_ACCEPTANCE_ROSTER");
  await expect(
    t.mutation(internal.localAcceptance.seed, {
      accounts: [{ key: "recycler", authUserId: pending.authUserId }],
    }),
  ).rejects.toThrow("ACCEPTANCE_IDENTITY_NOT_VERIFIED");
});

it("creates only bounded synthetic domain fixtures once without stock or payment records", async () => {
  const t = world();
  const identities = await Promise.all(
    ["kabadiwala", "apartment", "saathi", "team-viewer"].map((key) =>
      verifiedIdentity(t, key),
    ),
  );
  const accounts = identities.map(({ key, authUserId }) => ({
    key,
    authUserId,
  }));
  expect(await t.mutation(internal.localAcceptance.seed, { accounts })).toEqual(
    { created: 4, existing: 0 },
  );
  expect(await t.mutation(internal.localAcceptance.seed, { accounts })).toEqual(
    { created: 0, existing: 4 },
  );
  await t.run(async (ctx) => {
    expect(await ctx.db.query("orgs").collect()).toHaveLength(1);
    expect(await ctx.db.query("memberships").collect()).toHaveLength(1);
    expect(await ctx.db.query("stakeholderAccounts").collect()).toHaveLength(1);
    expect(await ctx.db.query("saathiProfiles").collect()).toHaveLength(1);
    expect(await ctx.db.query("auditLog").collect()).toHaveLength(4);
    for (const table of [
      "inventory",
      "trades",
      "bookings",
      "listings",
    ] as const) {
      expect(await ctx.db.query(table).first()).toBeNull();
    }
    const viewer = identities.find(({ key }) => key === "team-viewer");
    if (!viewer)
      throw new Error("The viewer fixture is required by this test.");
    expect(
      await ctx.db
        .query("memberships")
        .withIndex("by_profile", (q) => q.eq("profileId", viewer.profileId))
        .first(),
    ).toBeNull();
  });
});

it("does not take over an account already used for an organisation", async () => {
  const t = world();
  const { key, authUserId, profileId } = await verifiedIdentity(t, "recycler");
  await t.run(async (ctx) => {
    const orgId = await ctx.db.insert("orgs", {
      kind: "recycler",
      name: "Preserved local record",
      slug: "unrelated-record",
      status: "active",
      city: "Bengaluru",
      area: "Test",
      address: "Test",
      phones: [],
      weeklyOff: [],
      families: ["plastic"],
      offersPickup: false,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
    await ctx.db.insert("memberships", {
      profileId,
      orgId,
      role: "owner",
      createdAt: Date.now(),
    });
  });
  await expect(
    t.mutation(internal.localAcceptance.seed, {
      accounts: [{ key, authUserId }],
    }),
  ).rejects.toThrow("ACCEPTANCE_ACCOUNT_ALREADY_USED");
  expect(await t.run((ctx) => ctx.db.query("orgs").collect())).toHaveLength(1);
});

it("creates bounded byproduct stock once and preserves later test activity", async () => {
  const t = world();
  const identity = await verifiedIdentity(t, "manufacturer");
  await t.mutation(internal.localAcceptance.seed, {
    accounts: [{ key: identity.key, authUserId: identity.authUserId }],
  });
  expect(await t.mutation(internal.localAcceptance.seedByproducts, {})).toEqual(
    { created: true },
  );
  await t.run(async (ctx) => {
    const material = await ctx.db
      .query("materials")
      .withIndex("by_code", (q) => q.eq("code", "LOCAL-PAPER-BYPRODUCT"))
      .unique();
    expect(material?.byproductEligibility?.hazardStatus).toBe("non_hazardous");
    const unclassified = await ctx.db
      .query("materials")
      .withIndex("by_code", (q) => q.eq("code", "LOCAL-PAPER-UNCLASSIFIED"))
      .unique();
    expect(unclassified?.byproductEligibility).toBeUndefined();
    const stock = await ctx.db.query("inventory").first();
    if (!stock) throw new Error("Missing fixture stock");
    await ctx.db.patch("inventory", stock._id, { grams: 12_345 });
  });
  expect(await t.mutation(internal.localAcceptance.seedByproducts, {})).toEqual(
    { created: false },
  );
  const preservedStock = await t.run((ctx) =>
    ctx.db.query("inventory").first(),
  );
  expect(preservedStock?.grams).toBe(12_345);
  expect(
    await t.run((ctx) => ctx.db.query("materials").collect()),
  ).toHaveLength(2);
});

it("refuses byproduct seeding in cloud mode or over an unrelated material", async () => {
  const t = world();
  vi.stubEnv("CONVEX_SITE_URL", "https://dev.convex.site");
  await expect(
    t.mutation(internal.localAcceptance.seedByproducts, {}),
  ).rejects.toThrow("LOCAL_ACCEPTANCE_ONLY");
  vi.stubEnv("CONVEX_SITE_URL", "http://127.0.0.1:3211");
  await expect(
    t.mutation(internal.localAcceptance.seedByproducts, {}),
  ).rejects.toThrow("ACCEPTANCE_MANUFACTURER_REQUIRED");
  const identity = await verifiedIdentity(t, "manufacturer");
  await t.mutation(internal.localAcceptance.seed, {
    accounts: [{ key: identity.key, authUserId: identity.authUserId }],
  });
  await t.run((ctx) =>
    ctx.db.insert("materials", {
      code: "LOCAL-PAPER-BYPRODUCT",
      names: { en: "Preserved unrelated record" },
      family: "paper",
      stage: "scrap",
      co2eFactor: 0,
      sortOrder: 1,
      active: true,
    }),
  );
  await expect(
    t.mutation(internal.localAcceptance.seedByproducts, {}),
  ).rejects.toThrow("ACCEPTANCE_FIXTURE_CONFLICT");
  expect(
    await t.run((ctx) => ctx.db.query("inventory").collect()),
  ).toHaveLength(0);
  const preservedMaterial = await t.run((ctx) =>
    ctx.db.query("materials").first(),
  );
  expect(preservedMaterial?.names.en).toBe("Preserved unrelated record");
});

it("accepts only the exact verified phone and internal phone identity for its fixed local persona", async () => {
  const t = world();
  const persona = LOCAL_ACCEPTANCE_PERSONAS.find(
    ({ key }) => key === "kabadiwala",
  );
  if (!persona) throw new Error("Missing persona");
  const authUserId = await t.run(async (ctx) => {
    const now = Date.now();
    const user = (await ctx.runMutation(components.betterAuth.adapter.create, {
      input: {
        model: "user",
        data: {
          name: "Synthetic phone persona",
          email: phoneEmail(persona.phone),
          emailVerified: false,
          phoneNumber: persona.phone,
          phoneNumberVerified: true,
          createdAt: now,
          updatedAt: now,
        },
      },
    })) as { _id: string };
    await ctx.db.insert("profiles", {
      authUserId: user._id,
      kind: "member",
      locale: "en",
      createdAt: now,
      updatedAt: now,
    });
    return user._id;
  });
  await expect(
    t.mutation(internal.localAcceptance.seed, {
      accounts: [{ key: "manufacturer", authUserId }],
    }),
  ).rejects.toThrow("ACCEPTANCE_IDENTITY_NOT_VERIFIED");
  vi.stubEnv("CONVEX_SITE_URL", "https://cloud-test.convex.site");
  await expect(
    t.mutation(internal.localAcceptance.seed, {
      accounts: [{ key: persona.key, authUserId }],
    }),
  ).rejects.toThrow("LOCAL_ACCEPTANCE_ONLY");
  vi.stubEnv("CONVEX_SITE_URL", "http://127.0.0.1:3211");
  expect(
    await t.mutation(internal.localAcceptance.seed, {
      accounts: [{ key: persona.key, authUserId }],
    }),
  ).toEqual({ created: 1, existing: 0 });
  expect(
    await t.mutation(internal.localAcceptance.seed, {
      accounts: [{ key: persona.key, authUserId }],
    }),
  ).toEqual({ created: 0, existing: 1 });
});

it.each([false, true])(
  "rejects a phone persona with an unverified phone or a different internal identity (%s)",
  async (phoneNumberVerified) => {
    const t = world();
    const persona = LOCAL_ACCEPTANCE_PERSONAS.find(
      ({ key }) => key === "manufacturer",
    );
    if (!persona) throw new Error("Missing persona");
    const authUserId = await t.run(async (ctx) => {
      const now = Date.now();
      const user = (await ctx.runMutation(
        components.betterAuth.adapter.create,
        {
          input: {
            model: "user",
            data: {
              name: "Synthetic rejected phone persona",
              email: phoneNumberVerified
                ? "different@phone.luma.green"
                : phoneEmail(persona.phone),
              emailVerified: false,
              phoneNumber: persona.phone,
              phoneNumberVerified,
              createdAt: now,
              updatedAt: now,
            },
          },
        },
      )) as { _id: string };
      await ctx.db.insert("profiles", {
        authUserId: user._id,
        kind: "member",
        locale: "en",
        createdAt: now,
        updatedAt: now,
      });
      return user._id;
    });
    await expect(
      t.mutation(internal.localAcceptance.seed, {
        accounts: [{ key: persona.key, authUserId }],
      }),
    ).rejects.toThrow("ACCEPTANCE_IDENTITY_NOT_VERIFIED");
    expect(await t.run((ctx) => ctx.db.query("orgs").first())).toBeNull();
  },
);
