import assert from "node:assert/strict";
import { hkdfSync } from "node:crypto";
import { createRequire } from "node:module";
import path from "node:path";
import test from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";

const require = createRequire(import.meta.url);
const installedFile = fileURLToPath(import.meta.resolve("better-auth/minimal"));
const installedRoot = path.dirname(path.dirname(installedFile));
const artifact = process.env.LUMA_AUTH_TEST_ARTIFACT;
const dist = artifact ? path.resolve(artifact, "dist") : installedRoot;
const load = (name) => import(pathToFileURL(path.join(dist, name)).href);
const { betterAuth } = await load("auth/minimal.mjs");
const { magicLink } = await load("plugins/magic-link/index.mjs");
const { oAuthProxy } = await load("plugins/oauth-proxy/index.mjs");
const { deviceAuthorization } = await load(
  "plugins/device-authorization/index.mjs",
);
const { generateGenericState, parseGenericState } = await load("state.mjs");
const { symmetricEncrypt, symmetricDecrypt, makeSignature } =
  await load("crypto/index.mjs");
const { memoryAdapter } = await import(
  pathToFileURL(require.resolve("better-auth/adapters/memory")).href
);
const secret = "test-only".repeat(8);
const origin = "https://auth.localhost";
function purposeKey(key, purpose) {
  if (typeof key === "string")
    return Buffer.from(
      hkdfSync(
        "sha256",
        key,
        "better-auth:oauth-encryption:v1",
        `better-auth:${purpose}:v1`,
        32,
      ),
    ).toString("hex");
  return {
    keys: new Map([...key.keys].map(([v, k]) => [v, purposeKey(k, purpose)])),
    currentVersion: key.currentVersion,
    ...(key.legacySecret && {
      legacySecret: purposeKey(key.legacySecret, purpose),
    }),
  };
}
async function fixture(plugins, storage = "plain") {
  const data = {
    user: [],
    session: [],
    account: [],
    verification: [],
    deviceCode: [],
  };
  const auth = betterAuth({
    baseURL: origin,
    secret,
    database: memoryAdapter(data),
    logger: { disabled: true },
    verification: { storeIdentifier: storage },
    plugins,
  });
  const context = await auth.$context;
  const request = (url, headers = {}) =>
    auth.handler(new Request(origin + "/api/auth" + url, { headers }));
  return { auth, context, data, request };
}
function stateContext(context) {
  let cookie;
  return {
    context,
    setCookie(_name, value) {
      cookie = value;
    },
    getCookie() {
      return cookie;
    },
    async setSignedCookie(_name, value) {
      cookie = value;
    },
    async getSignedCookie() {
      return cookie;
    },
  };
}
for (const storage of ["plain", "hashed"]) {
  test(`OAuth state is namespaced before ${storage} identifier storage and still round trips`, async () => {
    const { context } = await fixture([], storage);
    const c = stateContext(context);
    const identifiers = [];
    const create = context.internalAdapter.createVerificationValue;
    context.internalAdapter.createVerificationValue = (value) => {
      identifiers.push(value.identifier);
      return create(value);
    };
    const state = await generateGenericState(c, {
      callbackURL: origin + "/done",
      codeVerifier: "local-fixture",
      expiresAt: Date.now() + 60_000,
    });
    assert.deepEqual(identifiers, [`auth-state:${state.state}`]);
    const parsed = await parseGenericState(c, state.state);
    assert.equal(parsed.codeVerifier, "local-fixture");
    await assert.rejects(parseGenericState(c, state.state));
  });
  test(`Magic Link rejects another record purpose with ${storage} identifier storage`, async () => {
    const { context, data, request } = await fixture(
      [magicLink({ sendMagicLink: () => Promise.resolve() })],
      storage,
    );
    await context.internalAdapter.createVerificationValue({
      identifier: "local-record",
      value: JSON.stringify({
        email: "person@example.invalid",
        callbackURL: origin + "/done",
      }),
      expiresAt: new Date(Date.now() + 60_000),
    });
    const response = await request(
      "/magic-link/verify?token=local-record&callbackURL=/done",
    );
    assert.equal(
      new URL(response.headers.get("location")).searchParams.get("error"),
      "INVALID_TOKEN",
    );
    assert.equal(data.session.length, 0);
    assert.equal(data.user.length, 0);
  });
  for (const storeToken of ["plain", "hashed"])
    test(`valid Magic Link retains one-use behavior (${storage}/${storeToken})`, async () => {
      let delivered;
      const { auth, context, data, request } = await fixture(
        [
          magicLink({
            storeToken,
            sendMagicLink: async (value) => {
              delivered = value.token;
            },
          }),
        ],
        storage,
      );
      const ids = [];
      const create = context.internalAdapter.createVerificationValue;
      context.internalAdapter.createVerificationValue = (value) => {
        ids.push(value.identifier);
        return create(value);
      };
      await auth.api.signInMagicLink({
        body: { email: "person@example.invalid", name: "Local fixture" },
        headers: new Headers({ origin }),
      });
      assert.ok(ids[0].startsWith("magic-link:"));
      const response = await request(
        `/magic-link/verify?token=${delivered}&callbackURL=/done`,
      );
      assert.equal(response.status, 302);
      assert.equal(data.session.length, 1);
      const replay = await request(
        `/magic-link/verify?token=${delivered}&callbackURL=/done`,
      );
      assert.equal(
        new URL(replay.headers.get("location")).searchParams.get("error"),
        "INVALID_TOKEN",
      );
      assert.equal(data.session.length, 1);
    });
}
for (const value of [
  "{",
  JSON.stringify({ type: "other", email: "person@example.invalid" }),
  JSON.stringify({ type: "magic-link", email: "bad" }),
  JSON.stringify({
    type: "magic-link",
    email: "person@example.invalid",
    extra: true,
  }),
])
  test(`Magic Link handles malformed or wrong-shape stored data: ${value.slice(0, 24)}`, async () => {
    const { context, data, request } = await fixture([
      magicLink({ sendMagicLink: () => Promise.resolve() }),
    ]);
    await context.internalAdapter.createVerificationValue({
      identifier: "magic-link:local-token",
      value,
      expiresAt: new Date(Date.now() + 60_000),
    });
    const result = await request(
      "/magic-link/verify?token=local-token&callbackURL=/done",
    );
    assert.equal(result.status, 302);
    assert.equal(
      new URL(result.headers.get("location")).searchParams.get("error"),
      "INVALID_TOKEN",
    );
    assert.equal(data.session.length, 0);
    assert.equal(data.user.length, 0);
  });
for (const encryptionPurpose of [
  null,
  "oauth-state-cookie",
  "oauth-proxy-state",
  "oauth-proxy-package",
  "oauth-proxy-profile",
])
  test(`proxy callback accepts only its profile encryption purpose (${encryptionPurpose ?? "old-shared-key"})`, async () => {
    const { context, data, request } = await fixture([oAuthProxy()]);
    const c = stateContext(context);
    const state = await generateGenericState(c, {
      callbackURL: origin + "/done",
      codeVerifier: "local-fixture",
      expiresAt: Date.now() + 60_000,
    });
    const payload = {
      timestamp: Date.now(),
      state: state.state,
      callbackURL: origin + "/done",
      userInfo: {
        id: "fixture-account",
        email: "person@example.invalid",
        name: "Local fixture",
        emailVerified: true,
      },
      account: { providerId: "fixture-provider", accountId: "fixture-account" },
    };
    const key = encryptionPurpose
      ? purposeKey(context.secretConfig, encryptionPurpose)
      : context.secretConfig;
    const profile = await symmetricEncrypt({
      key,
      data: JSON.stringify(payload),
    });
    const response = await request(
      `/oauth-proxy-callback?callbackURL=${encodeURIComponent(origin + "/done")}&profile=${encodeURIComponent(profile)}`,
    );
    if (encryptionPurpose === "oauth-proxy-profile") {
      assert.equal(response.headers.get("location"), origin + "/done");
      assert.equal(data.session.length, 1);
    } else {
      assert.equal(
        new URL(response.headers.get("location")).searchParams.get("error"),
        "invalid_profile",
      );
      assert.equal(data.session.length, 0);
      assert.equal(data.user.length, 0);
    }
  });
test("purpose key derivation preserves string, versioned and legacy rotation without accepting other purposes", async () => {
  const { derivePurposeKey } = await load("crypto/purpose.mjs");
  const old = "old-test-only".repeat(5);
  const keys = {
    keys: new Map([
      [2, secret],
      [1, old],
    ]),
    currentVersion: 2,
    legacySecret: old,
  };
  for (const key of [secret, keys]) {
    const derived = derivePurposeKey(key, "oauth-proxy-profile");
    assert.deepEqual(derived, purposeKey(key, "oauth-proxy-profile"));
    const encoded = await symmetricEncrypt({
      key: derived,
      data: "local fixture",
    });
    assert.equal(
      await symmetricDecrypt({ key: derived, data: encoded }),
      "local fixture",
    );
    await assert.rejects(
      symmetricDecrypt({
        key: derivePurposeKey(key, "oauth-proxy-state"),
        data: encoded,
      }),
    );
  }
  const legacyPayload = await symmetricEncrypt({
    key: purposeKey(old, "oauth-proxy-profile"),
    data: "old purpose-isolated value",
  });
  assert.equal(
    await symmetricDecrypt({
      key: derivePurposeKey(keys, "oauth-proxy-profile"),
      data: legacyPayload,
    }),
    "old purpose-isolated value",
  );
});
async function sessionHeaders(context, email) {
  const user = await context.internalAdapter.createUser({
    email,
    name: "Local fixture",
    emailVerified: true,
  });
  const session = await context.internalAdapter.createSession(user.id);
  const signature = await makeSignature(session.token, secret);
  return {
    user,
    headers: {
      cookie: `${context.authCookies.sessionToken.name}=${encodeURIComponent(session.token + "." + signature)}`,
    },
  };
}
test("device request details are shown only after successful ownership claim", async () => {
  const { context, request } = await fixture([deviceAuthorization()]);
  const owner = await sessionHeaders(context, "owner@example.invalid");
  const other = await sessionHeaders(context, "other@example.invalid");
  const create = async (userCode) =>
    context.adapter.create({
      model: "deviceCode",
      data: {
        deviceCode: "device-" + userCode,
        userCode,
        expiresAt: new Date(Date.now() + 60_000),
        status: "pending",
        clientId: "local-client",
        scope: "read:fixture",
        pollingInterval: 5,
      },
    });
  await create("LOCALCODE");
  const anonymous = await request("/device?user_code=LOCALCODE");
  assert.deepEqual(await anonymous.json(), {
    user_code: "LOCALCODE",
    status: "pending",
  });
  const claimed = await request("/device?user_code=LOCALCODE", owner.headers);
  assert.deepEqual(await claimed.json(), {
    user_code: "LOCALCODE",
    status: "pending",
    client_id: "local-client",
    scope: "read:fixture",
  });
  const privateView = await request(
    "/device?user_code=LOCALCODE",
    other.headers,
  );
  assert.deepEqual(await privateView.json(), {
    user_code: "LOCALCODE",
    status: "pending",
  });
  await create("LOSTCLAIM");
  const increment = context.adapter.incrementOne;
  context.adapter.incrementOne = async () => null;
  const lost = await request("/device?user_code=LOSTCLAIM", owner.headers);
  assert.deepEqual(await lost.json(), {
    user_code: "LOSTCLAIM",
    status: "pending",
  });
  context.adapter.incrementOne = increment;
});

test("cookie state round trips once with its own derived purpose", async () => {
  const { context } = await fixture([]);
  context.oauthConfig.storeStateStrategy = "cookie";
  const c = stateContext(context);
  const state = await generateGenericState(c, {
    callbackURL: origin + "/done",
    codeVerifier: "local-fixture",
    expiresAt: Date.now() + 60_000,
  });
  const plaintext = await symmetricDecrypt({
    key: purposeKey(context.secretConfig, "oauth-state-cookie"),
    data: c.getCookie(),
  });
  assert.equal(JSON.parse(plaintext).oauthState, state.state);
  const parsed = await parseGenericState(c, state.state);
  assert.equal(parsed.codeVerifier, "local-fixture");
  await assert.rejects(parseGenericState(c, state.state));
});
test("Magic Link revalidates the consumed record after lookup", async () => {
  const { context, data, request } = await fixture([
    magicLink({ sendMagicLink: () => Promise.resolve() }),
  ]);
  await context.internalAdapter.createVerificationValue({
    identifier: "magic-link:local-token",
    value: JSON.stringify({
      type: "magic-link",
      email: "person@example.invalid",
    }),
    expiresAt: new Date(Date.now() + 60_000),
  });
  const consume = context.internalAdapter.consumeVerificationValue;
  context.internalAdapter.consumeVerificationValue = async (...args) => {
    const record = await consume(...args);
    return (
      record && {
        ...record,
        value: JSON.stringify({
          type: "other",
          email: "person@example.invalid",
        }),
      }
    );
  };
  const response = await request(
    "/magic-link/verify?token=local-token&callbackURL=/done",
  );
  assert.equal(
    new URL(response.headers.get("location")).searchParams.get("error"),
    "INVALID_TOKEN",
  );
  assert.equal(data.session.length, 0);
});
