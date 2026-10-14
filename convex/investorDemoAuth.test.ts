// @vitest-environment edge-runtime
import { hashPassword } from "better-auth/crypto";
import { makeFunctionReference } from "convex/server";
import { convexTest } from "convex-test";
import { afterEach, beforeAll, beforeEach, expect, it, vi } from "vitest";

import { components } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { createAuth } from "./auth";
import { convexModules, registerAuth } from "./lib/auth.testing";
import { INVESTOR_DEMO_BATCH } from "./lib/investorDemoRoster";
import schema from "./schema";

const modules = convexModules(import.meta.glob("./**/*.*s"));
const importIdentity = makeFunctionReference<
  "mutation",
  {
    batchKey: typeof INVESTOR_DEMO_BATCH;
    personaKey: string;
    passwordHash: string;
  },
  { authUserId: string; profileId: Id<"profiles">; created: boolean }
>("investorDemoAuth:seedIdentity");
const target = "https://outstanding-buzzard-942.eu-west-1.convex.site";
const origin = "https://lumagreen.vercel.app";
const password = "Fictional-test-only-password-286549";
const email = "household-1@investor.luma.invalid";
const credential = { hash: "" };
beforeAll(async () => {
  credential.hash = await hashPassword(password);
});
beforeEach(() => {
  vi.stubEnv("SITE_URL", origin);
  vi.stubEnv("CONVEX_SITE_URL", target);
  vi.stubEnv("BETTER_AUTH_SECRET", "test-secret-0123456789abcdef0123456789");
  vi.stubEnv("ADMIN_EMAIL", "");
  vi.stubEnv("AUTH_LOCAL_TEST_MODE", "");
  vi.stubEnv("AUTH_DEV_MODE", "");
  vi.stubEnv("RESEND_API_KEY", "");
  vi.stubEnv("AUTH_FROM_EMAIL", "");
  vi.stubEnv("INVESTOR_DEMO_TARGET_URL", target);
  vi.stubEnv(
    "INVESTOR_DEMO_IMPORT_EXPIRES_AT",
    new Date(Date.now() + 3_600_000).toISOString(),
  );
  vi.stubGlobal(
    "fetch",
    vi.fn(() => {
      throw new Error("No external delivery permitted");
    }),
  );
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});
function setup() {
  const t = convexTest(schema, modules);
  registerAuth(t);
  return t;
}
function provision(
  t: ReturnType<typeof setup>,
  personaKey = "household-1",
  hash = credential.hash,
) {
  return t.mutation(importIdentity, {
    batchKey: INVESTOR_DEMO_BATCH,
    personaKey,
    passwordHash: hash,
  });
}
function authRows(
  t: ReturnType<typeof setup>,
  model: "user" | "session" | "account" | "verification",
) {
  return t.run((ctx) =>
    ctx.runQuery(components.betterAuth.adapter.findMany, {
      model,
      paginationOpts: { cursor: null, numItems: 200 },
    }),
  );
}
function request(
  t: ReturnType<typeof setup>,
  path: string,
  body: Record<string, unknown>,
) {
  return t.fetch(`/api/auth${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Origin: origin,
      "X-Forwarded-For": "192.0.2.241",
    },
    body: JSON.stringify(body),
  });
}

it("imports one fictional credential atomically without phone proof, sessions or delivery", async () => {
  const t = setup();
  const result = await provision(t);
  expect(result.created).toBe(true);
  const users = await authRows(t, "user");
  expect(users.page).toHaveLength(1);
  expect(users.page[0]).toMatchObject({ email, emailVerified: true });
  expect(users.page[0]).not.toHaveProperty("phoneNumber");
  expect(users.page[0]).not.toHaveProperty("phoneNumberVerified");
  const sessions = await authRows(t, "session");
  const codes = await authRows(t, "verification");
  expect(sessions.page).toEqual([]);
  expect(codes.page).toEqual([]);
  const evidence = await t.run(async (ctx) => ({
    profile: await ctx.db.get(result.profileId),
    audit: await ctx.db.query("auditLog").collect(),
    receipts: await ctx.db.query("investorDemoAccounts").collect(),
  }));
  expect(evidence.profile).toMatchObject({
    kind: "member",
    authUserId: result.authUserId,
  });
  expect(evidence.audit.map((x) => x.action)).toContain(
    "auth.identity.created",
  );
  expect(evidence.audit.map((x) => x.action)).toContain(
    "investor.demo.identity.imported",
  );
  expect(JSON.stringify(evidence)).not.toContain(credential.hash);
  expect(JSON.stringify(evidence)).not.toContain(password);
  expect(fetch).not.toHaveBeenCalled();
});

it("rejects legacy demo email credentials through the real HTTP handler", async () => {
  const t = setup();
  await provision(t);
  vi.stubEnv("INVESTOR_DEMO_IMPORT_EXPIRES_AT", "");
  const response = await request(t, "/sign-in/email", { email, password });
  expect(response.status).toBe(403);
  expect(response.headers.get("set-cookie")).toBeNull();
  const sessions = await authRows(t, "session");
  expect(sessions.page).toEqual([]);
  expect(fetch).not.toHaveBeenCalled();
});

it("does not make ordinary signup or an unverified identity bypass email verification", async () => {
  const t = setup();
  await provision(t);
  const signup = await request(t, "/sign-up/email", {
    email: "ordinary@example.invalid",
    name: "Ordinary",
    password,
  });
  expect(signup.status).toBe(403);
  await t.run(async (ctx) => {
    const auth = await createAuth(ctx).$context;
    const user = await auth.internalAdapter.createUser({
      email: "unverified@example.invalid",
      name: "Unverified",
      emailVerified: false,
    });
    await auth.internalAdapter.createAccount({
      userId: user.id,
      accountId: user.id,
      providerId: "credential",
      password: credential.hash,
    });
  });
  const signin = await request(t, "/sign-in/email", {
    email: "unverified@example.invalid",
    password,
  });
  expect(signin.status).not.toBe(200);
  expect(signin.headers.get("set-cookie")).toBeNull();
  expect(fetch).not.toHaveBeenCalled();
});

it("retries the exact receipt without creating another user or changing credentials", async () => {
  const t = setup();
  const first = await provision(t);
  const second = await provision(t);
  expect(second).toEqual({ ...first, created: false });
  const users = await authRows(t, "user");
  const accounts = await authRows(t, "account");
  expect(users.page).toHaveLength(1);
  expect(accounts.page).toHaveLength(1);
  await expect(
    provision(t, "household-1", `${"b".repeat(32)}:${"c".repeat(128)}`),
  ).rejects.toThrow("INVESTOR_DEMO_IDENTITY_DRIFT");
});

it("refuses to take over an existing matching email without an import receipt", async () => {
  const t = setup();
  await t.run(async (ctx) => {
    const auth = await createAuth(ctx).$context;
    await auth.internalAdapter.createUser({
      email,
      name: "Existing",
      emailVerified: false,
    });
  });
  await expect(provision(t)).rejects.toThrow(
    "INVESTOR_DEMO_IDENTITY_COLLISION",
  );
  const accounts = await authRows(t, "account");
  expect(accounts.page).toEqual([]);
});

it.each(["platform-admin-1", "unknown-1"])(
  "refuses non-roster identity %s",
  async (key) => {
    const t = setup();
    await expect(provision(t, key)).rejects.toThrow(
      "INVESTOR_DEMO_IDENTITY_INVALID",
    );
    const users = await authRows(t, "user");
    expect(users.page).toEqual([]);
  },
);
it("rejects even a roster identity when it matches the configured admin", async () => {
  const t = setup();
  vi.stubEnv("ADMIN_EMAIL", email);
  await expect(provision(t)).rejects.toThrow("INVESTOR_DEMO_IDENTITY_INVALID");
});
it("rejects malformed password hashes before writing an account", async () => {
  const t = setup();
  await expect(
    provision(t, "household-1", "plaintext-password"),
  ).rejects.toThrow("INVESTOR_DEMO_IDENTITY_INVALID");
});
it.each([
  ["INVESTOR_DEMO_TARGET_URL", ""],
  [
    "INVESTOR_DEMO_TARGET_URL",
    "https://glorious-rooster-470.eu-west-1.convex.site",
  ],
  ["CONVEX_SITE_URL", "https://unrelated.convex.site"],
  ["INVESTOR_DEMO_IMPORT_EXPIRES_AT", ""],
  ["INVESTOR_DEMO_IMPORT_EXPIRES_AT", "2000-01-01T00:00:00.000Z"],
  ["INVESTOR_DEMO_IMPORT_EXPIRES_AT", "2099-01-01T00:00:00.000Z"],
  ["AUTH_LOCAL_TEST_MODE", "true"],
  ["AUTH_DEV_MODE", "true"],
])(
  "rejects a disabled or mismatched deployment gate %s",
  async (key, value) => {
    const t = setup();
    vi.stubEnv(key, value);
    await expect(provision(t)).rejects.toThrow("INVESTOR_DEMO_IMPORT_DISABLED");
    const users = await authRows(t, "user");
    expect(users.page).toEqual([]);
  },
);
it("permits the explicit local verification target without widening hosted local mode", async () => {
  const t = setup();
  vi.stubEnv("CONVEX_SITE_URL", "http://127.0.0.1:3211");
  vi.stubEnv("INVESTOR_DEMO_TARGET_URL", "http://127.0.0.1:3211");
  vi.stubEnv("AUTH_LOCAL_TEST_MODE", "true");
  const result = await provision(t);
  expect(result.created).toBe(true);
  expect(fetch).not.toHaveBeenCalled();
});

it("keeps one identity when two imports race for the same roster entry", async () => {
  const t = setup();
  const results = await Promise.all([provision(t), provision(t)]);
  expect(results[0].authUserId).toBe(results[1].authUserId);
  expect(results.filter((item) => item.created)).toHaveLength(1);
  const users = await authRows(t, "user");
  expect(users.page).toHaveLength(1);
});

it("refuses a receipt whose profile has been reassigned or promoted", async () => {
  const t = setup();
  const result = await provision(t);
  await t.run((ctx) => ctx.db.patch(result.profileId, { kind: "admin" }));
  await expect(provision(t)).rejects.toThrow("INVESTOR_DEMO_IDENTITY_DRIFT");
  const profile = await t.run((ctx) => ctx.db.get(result.profileId));
  expect(profile?.kind).toBe("admin");
});

it("does not accept a wrong password for an imported verified identity", async () => {
  const t = setup();
  await provision(t);
  const response = await request(t, "/sign-in/email", {
    email,
    password: "Incorrect-test-password-1024",
  });
  expect(response.status).toBe(403);
  expect(response.headers.get("set-cookie")).toBeNull();
  const sessions = await authRows(t, "session");
  expect(sessions.page).toEqual([]);
});
