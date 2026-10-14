// @vitest-environment edge-runtime
import { makeSignature, symmetricDecrypt } from "better-auth/crypto";
import { convexTest, type TestConvex } from "convex-test";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";

import { api, components, internal } from "./_generated/api";
import { createAuth } from "./auth";
import { convexModules, registerAuth } from "./lib/auth.testing";
import { queueInbox } from "./lib/push";
import schema from "./schema";

const modules = convexModules(import.meta.glob("./**/*.*s"));
async function responseStatus(request: Promise<Response>) {
  const response = await request;
  return response.status;
}
async function responseBody(request: Promise<Response>): Promise<unknown> {
  const response = await request;
  return response.json();
}

const PHONE = "+919000000031";
const SMS_CODE = "381429";
const ORIGIN = "https://luma.test";
const SETUP_TOKEN = "test-setup-token-0123456789abcdef";
const setupSchema = z.object({
  totpURI: z.string(),
  backupCodes: z.array(z.string()),
});
type Test = TestConvex<typeof schema>;

beforeEach(() => {
  vi.stubEnv("SITE_URL", ORIGIN);
  vi.stubEnv("CONVEX_SITE_URL", "https://test.convex.site");
  vi.stubEnv("BETTER_AUTH_SECRET", "0123456789abcdef0123456789abcdef");
  vi.stubEnv("ADMIN_EMAIL", "admin@luma.test");
  vi.stubEnv("ADMIN_SETUP_TOKEN", SETUP_TOKEN);
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

function client(t: Test) {
  const cookies = new Map<string, string>();
  let requestCount = 0;
  const request = async (
    path: string,
    body?: Record<string, unknown>,
    headers?: Record<string, string>,
  ) => {
    const response = await t.fetch(`/api/auth${path}`, {
      method: body ? "POST" : "GET",
      headers: {
        "Content-Type": "application/json",
        Origin: ORIGIN,
        // Separate fixture clients have independent rate-limit buckets. The
        // account/challenge attempt limits are still real and exercised below.
        "X-Forwarded-For": `192.0.2.${String(++requestCount)}`,
        Cookie: [...cookies]
          .map(([key, value]) => `${key}=${value}`)
          .join("; "),
        ...headers,
      },
      ...(body && { body: JSON.stringify(body) }),
    });
    for (const cookie of response.headers.getSetCookie()) {
      const first = cookie.split(";", 1)[0] ?? "";
      const separator = first.indexOf("=");
      if (separator === -1) continue;
      const name = first.slice(0, separator);
      const value = first.slice(separator + 1);
      if (value) cookies.set(name, value);
      else cookies.delete(name);
    }
    return response;
  };
  return { request, cookies };
}

async function seedCode(t: Test, phone = PHONE) {
  await t.run(async (ctx) => {
    await ctx.runMutation(components.betterAuth.adapter.deleteMany, {
      input: {
        model: "verification",
        where: [{ field: "identifier", value: phone }],
      },
      paginationOpts: { cursor: null, numItems: 100 },
    });
    await ctx.runMutation(components.betterAuth.adapter.create, {
      input: {
        model: "verification",
        data: {
          identifier: phone,
          value: `${SMS_CODE}:0`,
          expiresAt: Date.now() + 300_000,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        },
      },
    });
  });
}

async function signedIn() {
  const t = convexTest(schema, modules);
  registerAuth(t);
  const browser = client(t);
  await seedCode(t);
  expect(
    await responseStatus(
      browser.request("/phone-number/verify", {
        phoneNumber: PHONE,
        code: SMS_CODE,
      }),
    ),
  ).toBe(200);
  return { t, browser };
}

async function codeFor(t: Test, uri: string) {
  if (!new URL(uri).searchParams.get("secret"))
    throw new Error("The test enrollment did not return a key.");
  const factor = z.object({ secret: z.string() }).parse(
    await t.run((ctx) =>
      ctx.runQuery(components.betterAuth.adapter.findOne, {
        model: "twoFactor",
      }),
    ),
  );
  const secret = await symmetricDecrypt({
    key: "0123456789abcdef0123456789abcdef",
    data: factor.secret,
  });
  return t.run(async (ctx) => {
    const generated = await createAuth(ctx).api.generateTOTP({
      body: { secret },
    });
    return generated.code;
  });
}

async function enrolled() {
  const fixture = await signedIn();
  const setupResponse = await fixture.browser.request("/two-factor/enable", {});
  expect(setupResponse.status).toBe(200);
  const setup = setupSchema.parse(await setupResponse.json());
  const code = await codeFor(fixture.t, setup.totpURI);
  expect(
    await responseStatus(
      fixture.browser.request("/two-factor/verify-totp", { code }),
    ),
  ).toBe(200);
  return { ...fixture, setup };
}

async function newChallenge(t: Test) {
  const browser = client(t);
  await seedCode(t);
  const response = await browser.request("/phone-number/verify", {
    phoneNumber: PHONE,
    code: SMS_CODE,
  });
  expect(response.status).toBe(200);
  expect(await response.json()).toMatchObject({ twoFactorRedirect: true });
  return browser;
}

describe("phone codes with optional authenticator protection", () => {
  it("keeps phone-only sign-in and first enrollment inactive until an authenticator code is valid", async () => {
    const { t, browser } = await signedIn();
    expect(await responseStatus(browser.request("/get-session"))).toBe(200);
    const setupResponse = await browser.request("/two-factor/enable", {});
    expect(setupResponse.status).toBe(200);
    const setup = setupSchema.parse(await setupResponse.json());
    const before = await browser.request("/get-session");
    expect(await before.json()).toMatchObject({
      user: { twoFactorEnabled: false },
    });
    const goodCode = await codeFor(t, setup.totpURI);
    const badCode = goodCode === "000000" ? "111111" : "000000";
    expect(
      await responseStatus(
        browser.request("/two-factor/verify-totp", { code: badCode }),
      ),
    ).toBe(401);
    const code = await codeFor(t, setup.totpURI);
    expect(
      await responseStatus(
        browser.request("/two-factor/verify-totp", { code }),
      ),
    ).toBe(200);
    expect(await responseBody(browser.request("/get-session"))).toMatchObject({
      user: { twoFactorEnabled: true },
    });
  });

  it("issues no session or Convex JWT during the second-factor challenge and rejects forged flags", async () => {
    const { t, setup } = await enrolled();
    const browser = await newChallenge(t);
    expect(
      [...browser.cookies.keys()].some(
        (key) => key.endsWith("session_token") || key.includes("convex_jwt"),
      ),
    ).toBe(false);
    expect(await responseBody(browser.request("/get-session"))).toBeNull();
    expect(await responseStatus(browser.request("/convex/token"))).toBe(401);
    expect(await t.query(api.identity.me, {})).toBeNull();
    await expect(
      t.mutation(api.identity.ensureProfile, { locale: "en" }),
    ).rejects.toThrow("NOT_SIGNED_IN");
    const code = await codeFor(t, setup.totpURI);
    expect(
      await responseStatus(
        browser.request("/two-factor/verify-totp", {
          code,
          trustDevice: true,
        }),
      ),
    ).toBe(403);
    expect(
      await responseStatus(
        browser.request("/two-factor/verify-totp", { code }),
      ),
    ).toBe(200);
    expect(await responseBody(browser.request("/get-session"))).toMatchObject({
      user: { twoFactorEnabled: true },
    });
  });

  it("allows a recovery code only once and keeps authenticator protection enabled", async () => {
    const { t, setup } = await enrolled();
    const code = setup.backupCodes[0];
    if (!code) throw new Error("No test backup code.");
    const browser = await newChallenge(t);
    expect(
      await responseStatus(
        browser.request("/two-factor/verify-backup-code", { code }),
      ),
    ).toBe(200);
    const second = await newChallenge(t);
    expect(
      await responseStatus(
        second.request("/two-factor/verify-backup-code", { code }),
      ),
    ).toBe(401);
    expect(await responseBody(browser.request("/get-session"))).toMatchObject({
      user: { twoFactorEnabled: true },
    });
  });

  it("requires recent primary sign-in and rejects direct secret replacement or retrieval", async () => {
    const { t, browser } = await enrolled();
    expect(
      await responseStatus(browser.request("/two-factor/enable", {})),
    ).toBe(403);
    expect(
      await responseStatus(browser.request("/two-factor/get-totp-uri", {})),
    ).toBe(403);
    vi.useFakeTimers();
    vi.setSystemTime(Date.now() + 301_000);
    expect(
      await responseStatus(
        browser.request("/two-factor/generate-backup-codes", {}),
      ),
    ).toBe(403);
    expect(
      await responseStatus(browser.request("/two-factor/disable", {})),
    ).toBe(403);
    // Session is still valid; only sensitive changes need fresh primary proof.
    expect(await responseBody(browser.request("/get-session"))).toMatchObject({
      user: { twoFactorEnabled: true },
    });
    expect(await t.run((ctx) => ctx.db.query("profiles").collect())).toEqual(
      [],
    );
  });

  it("rejects unsupported phone password and direct number change paths", async () => {
    const { browser } = await signedIn();
    for (const path of [
      "/phone-number/request-password-reset",
      "/phone-number/reset-password",
      "/sign-in/phone-number",
    ]) {
      expect(
        await responseStatus(
          browser.request(path, {
            phoneNumber: PHONE,
            password: "not-a-real-password",
            newPassword: "not-a-real-password",
            otp: SMS_CODE,
          }),
        ),
      ).toBe(403);
    }
    expect(
      await responseStatus(
        browser.request("/phone-number/verify", {
          phoneNumber: PHONE,
          code: SMS_CODE,
          updatePhoneNumber: true,
        }),
      ),
    ).toBe(403);
  });
});

const sessionShape = z.object({
  session: z.object({ id: z.string(), userId: z.string() }),
  user: z.object({ id: z.string() }),
});

async function adminAccount() {
  vi.stubEnv("ADMIN_EMAIL", `${PHONE.slice(1)}@phone.luma.green`);
  const { t, browser } = await signedIn();
  const setupResponse = await browser.request("/two-factor/enable", {});
  expect(setupResponse.status).toBe(200);
  const setup = setupSchema.parse(await setupResponse.json());
  const code = await codeFor(t, setup.totpURI);
  expect(
    await responseStatus(browser.request("/two-factor/verify-totp", { code })),
  ).toBe(200);
  return { t, browser, setup };
}

describe("authenticator session boundaries", () => {
  it("revokes every older session when enrollment completes, including its Convex identity", async () => {
    const { t, browser } = await signedIn();
    const old = sessionShape.parse(
      await responseBody(browser.request("/get-session")),
    );
    const oldCookies = new Map(browser.cookies);
    const setupResponse = await browser.request("/two-factor/enable", {});
    const setup = setupSchema.parse(await setupResponse.json());
    const code = await codeFor(t, setup.totpURI);
    expect(
      await responseStatus(
        browser.request("/two-factor/verify-totp", { code }),
      ),
    ).toBe(200);
    const oldBrowser = client(t);
    for (const [key, value] of oldCookies) oldBrowser.cookies.set(key, value);
    expect(await responseBody(oldBrowser.request("/get-session"))).toBeNull();
    const oldIdentity = t.withIdentity({
      subject: old.user.id,
      sessionId: old.session.id,
    });
    expect(await oldIdentity.query(api.identity.me, {})).toBeNull();
    await expect(
      oldIdentity.mutation(api.identity.ensureProfile, { locale: "en" }),
    ).rejects.toThrow("NOT_SIGNED_IN");
  });

  it("binds a sensitive-change proof to the current user and session", async () => {
    const { t, browser } = await signedIn();
    const session = sessionShape.parse(
      await responseBody(browser.request("/get-session")),
    );
    await t.run((ctx) =>
      ctx.runMutation(components.betterAuth.adapter.updateOne, {
        input: {
          model: "verification",
          where: [
            {
              field: "identifier",
              value: `luma-security-${session.session.id}`,
            },
          ],
          update: {
            value: JSON.stringify({
              userId: "another-user",
              secondFactor: true,
            }),
          },
        },
      }),
    );
    expect(
      await responseStatus(browser.request("/two-factor/enable", {})),
    ).toBe(403);
  });

  it("rejects an expired sign-in challenge and a consumed challenge replay", async () => {
    const { t, setup } = await enrolled();
    const expired = await newChallenge(t);
    vi.useFakeTimers();
    vi.setSystemTime(Date.now() + 601_000);
    const code = await codeFor(t, setup.totpURI);
    expect(
      await responseStatus(
        expired.request("/two-factor/verify-totp", { code }),
      ),
    ).toBe(401);
    const fresh = await newChallenge(t);
    const replayCookies = new Map(fresh.cookies);
    expect(
      await responseStatus(fresh.request("/two-factor/verify-totp", { code })),
    ).toBe(200);
    const replay = client(t);
    for (const [key, value] of replayCookies) replay.cookies.set(key, value);
    expect(
      await responseStatus(replay.request("/two-factor/verify-totp", { code })),
    ).toBe(401);
    expect(await responseBody(replay.request("/get-session"))).toBeNull();
  });

  it("exhausts an attempt budget even when an attacker changes IP addresses", async () => {
    const { t, setup } = await enrolled();
    const browser = await newChallenge(t);
    const good = await codeFor(t, setup.totpURI);
    const code = good === "000000" ? "111111" : "000000";
    for (let attempt = 0; attempt < 5; attempt++) {
      expect(
        await responseStatus(
          browser.request("/two-factor/verify-totp", { code }),
        ),
      ).toBe(401);
    }
    expect(
      await responseStatus(
        browser.request("/two-factor/verify-totp", { code: good }),
      ),
    ).toBe(400);
    expect(await responseBody(browser.request("/get-session"))).toBeNull();
  });

  it("invalidates old recovery codes after replacement and permits fresh full-auth disable", async () => {
    const { t, setup, browser } = await enrolled();
    const response = await browser.request(
      "/two-factor/generate-backup-codes",
      {},
    );
    expect(response.status).toBe(200);
    const replacement = z
      .object({ backupCodes: z.array(z.string()) })
      .parse(await response.json());
    const challenge = await newChallenge(t);
    expect(
      await responseStatus(
        challenge.request("/two-factor/verify-backup-code", {
          code: setup.backupCodes[0],
        }),
      ),
    ).toBe(401);
    expect(
      await responseStatus(
        challenge.request("/two-factor/verify-backup-code", {
          code: replacement.backupCodes[0],
        }),
      ),
    ).toBe(200);
    expect(
      await responseStatus(challenge.request("/two-factor/disable", {})),
    ).toBe(200);
    expect(await responseBody(challenge.request("/get-session"))).toMatchObject(
      { user: { twoFactorEnabled: false } },
    );
    const audit = await t.run((ctx) => ctx.db.query("auditLog").collect());
    expect(audit.map((row) => row.action)).toEqual(
      expect.arrayContaining([
        "auth.authenticator.enabled",
        "auth.recovery_codes.changed",
        "auth.authenticator.disabled",
      ]),
    );
    expect(audit.every((row) => row.metadata === undefined)).toBe(true);
    const serialized = JSON.stringify(audit);
    for (const secret of [...setup.backupCodes, ...replacement.backupCodes])
      expect(serialized).not.toContain(secret);
  });

  it("requires the admin authenticator after SMS before session or JWT creation", async () => {
    const { t, browser } = await adminAccount();
    const session = sessionShape.parse(
      await responseBody(browser.request("/get-session")),
    );
    await t.run((ctx) =>
      ctx.runMutation(components.betterAuth.adapter.updateOne, {
        input: {
          model: "user",
          where: [{ field: "_id", value: session.user.id }],
          update: { phoneNumber: PHONE, phoneNumberVerified: true },
        },
      }),
    );
    const phoneClient = client(t);
    await seedCode(t);
    const response = await phoneClient.request("/phone-number/verify", {
      phoneNumber: PHONE,
      code: SMS_CODE,
    });
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ twoFactorRedirect: true });
    expect(await responseBody(phoneClient.request("/get-session"))).toBeNull();
    expect(await responseStatus(phoneClient.request("/convex/token"))).toBe(
      401,
    );
    expect(
      await responseStatus(browser.request("/two-factor/disable", {})),
    ).toBe(403);
  });
});

describe("atomic authenticator redemption", () => {
  it("accepts only one concurrent redemption of the same signed challenge", async () => {
    const { t, setup } = await enrolled();
    const first = await newChallenge(t);
    const second = client(t);
    for (const [key, value] of first.cookies) second.cookies.set(key, value);
    const code = await codeFor(t, setup.totpURI);
    const responses = await Promise.all([
      first.request("/two-factor/verify-totp", { code }),
      second.request("/two-factor/verify-totp", { code }),
    ]);
    expect(
      responses.map((response) => response.status).toSorted((a, b) => a - b),
    ).toEqual([200, 401]);
  });

  it("accepts one recovery code only once across concurrent independent challenges", async () => {
    const { t, setup } = await enrolled();
    const first = await newChallenge(t);
    const second = await newChallenge(t);
    const code = setup.backupCodes[0];
    const responses = await Promise.all([
      first.request("/two-factor/verify-backup-code", { code }),
      second.request("/two-factor/verify-backup-code", { code }),
    ]);
    expect(
      responses.filter((response) => response.status === 200),
    ).toHaveLength(1);
    expect(
      responses.filter(
        (response) => response.status === 401 || response.status === 409,
      ),
    ).toHaveLength(1);
  });
});

it("cannot mint a password credential for a phone identity with a reset token", async () => {
  const { t, browser } = await signedIn();
  const session = sessionShape.parse(
    await responseBody(browser.request("/get-session")),
  );
  const token = "fixture-phone-reset-token";
  await t.run((ctx) =>
    ctx.runMutation(components.betterAuth.adapter.create, {
      input: {
        model: "verification",
        data: {
          identifier: `reset-password:${token}`,
          value: session.user.id,
          expiresAt: Date.now() + 60_000,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        },
      },
    }),
  );
  expect(
    await responseStatus(
      browser.request("/reset-password", {
        token,
        newPassword: "test-only replacement passphrase",
      }),
    ),
  ).toBe(403);
  const credential = await t.run((ctx) =>
    ctx.runQuery(components.betterAuth.adapter.findOne, {
      model: "account",
      where: [
        { field: "userId", value: session.user.id },
        { field: "providerId", value: "credential" },
      ],
    }),
  );
  expect(credential).toBeNull();
});

it("requires the factor even when a previously valid trusted-device cookie exists", async () => {
  const { t, browser } = await enrolled();
  const session = sessionShape.parse(
    await responseBody(browser.request("/get-session")),
  );
  const secret = "0123456789abcdef0123456789abcdef";
  const identifier = "trust-device-fixture";
  const signedValue = await makeSignature(
    `${session.user.id}!${identifier}`,
    secret,
  );
  const inner = signedValue
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replaceAll("=", "");
  const value = `${inner}!${identifier}`;
  const signature = await makeSignature(value, secret);
  const cookieName = [...browser.cookies.keys()]
    .find((name) => name.endsWith("session_token"))
    ?.replace("session_token", "trust_device");
  if (!cookieName) throw new Error("Missing fixture cookie name");
  await t.run((ctx) =>
    ctx.runMutation(components.betterAuth.adapter.create, {
      input: {
        model: "verification",
        data: {
          identifier,
          value: session.user.id,
          expiresAt: Date.now() + 300_000,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        },
      },
    }),
  );
  const trusted = client(t);
  trusted.cookies.set(cookieName, encodeURIComponent(`${value}.${signature}`));
  await seedCode(t);
  const response = await trusted.request("/phone-number/verify", {
    phoneNumber: PHONE,
    code: SMS_CODE,
    twoFactorEnabled: false,
  });
  expect(await response.json()).toMatchObject({ twoFactorRedirect: true });
  expect(await responseBody(trusted.request("/get-session"))).toBeNull();
});

it("rejects direct phone changes despite an invalid unrelated flag", async () => {
  const { t, browser } = await signedIn();
  const newPhone = "+919000000032";
  await seedCode(t, newPhone);
  const response = await browser.request("/phone-number/verify", {
    phoneNumber: newPhone,
    code: SMS_CODE,
    updatePhoneNumber: true,
    trustDevice: "not-a-boolean",
  });
  expect(response.status).toBe(403);
  expect(await response.json()).toMatchObject({
    code: "UNSUPPORTED_PHONE_ACCOUNT_CHANGE",
  });
  expect(await responseBody(browser.request("/get-session"))).toMatchObject({
    user: { phoneNumber: PHONE },
  });
});

it("rejects trusted factor login despite an invalid unrelated flag", async () => {
  const { t, setup } = await enrolled();
  const browser = await newChallenge(t);
  const code = await codeFor(t, setup.totpURI);
  const response = await browser.request("/two-factor/verify-totp", {
    code,
    trustDevice: true,
    updatePhoneNumber: "not-a-boolean",
  });
  expect(response.status).toBe(403);
  expect(await response.json()).toMatchObject({
    code: "TRUST_DEVICE_DISABLED",
  });
  expect(await responseBody(browser.request("/get-session"))).toBeNull();
});

it("cancels push recreated by a second tab before real HTTP logout", async () => {
  vi.useFakeTimers();
  vi.stubEnv("EXPO_PUSH_ENABLED", "true");
  vi.stubEnv("EXPO_PUSH_ACCESS_TOKEN", "fixture-test-token");
  vi.stubEnv("WEB_PUSH_ENABLED", "false");
  const { t, browser } = await signedIn();
  const session = sessionShape.parse(
    await responseBody(browser.request("/get-session")),
  );
  const identity = { subject: session.user.id, sessionId: session.session.id };
  const firstTab = t.withIdentity(identity);
  const secondTab = t.withIdentity(identity);
  const profileId = await firstTab.mutation(api.identity.ensureProfile, {
    locale: "en",
  });
  const installationId = "11111111-1111-4111-8111-111111111111";
  const registration = {
    token: "ExpoPushToken[second_tab]",
    locale: "en",
    installationId,
  };
  await firstTab.mutation(api.push.registerExpo, registration);
  await firstTab.mutation(api.push.unregisterInstallation, { installationId });
  // The second runtime can register while the shared session is still live,
  // between the first runtime's device cleanup and its actual HTTP sign-out.
  const recreated = await secondTab.mutation(
    api.push.registerExpo,
    registration,
  );
  expect(await responseStatus(browser.request("/sign-out", {}))).toBe(200);
  await expect(secondTab.query(api.push.settings, {})).rejects.toThrow(
    "NOT_SIGNED_IN",
  );
  await t.run((ctx) =>
    queueInbox(ctx, {
      profileId,
      event: "application_received",
      dedupKey: "post-signout-fixture-event",
    }),
  );
  const delivery = await t.run((ctx) => ctx.db.query("pushDeliveries").first());
  expect(delivery?.deviceId).toBe(recreated);
  if (!delivery) throw new Error("No delivery fixture");
  expect(
    await t.mutation(internal.pushState.claim, { id: delivery._id }),
  ).toBeNull();
  expect(
    await t.run((ctx) => ctx.db.get("pushDeliveries", delivery._id)),
  ).toMatchObject({
    status: "cancelled",
  });
  expect(await t.run((ctx) => ctx.db.get("pushDevices", recreated))).toBeNull();
});
