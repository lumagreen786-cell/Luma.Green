const assert = require("node:assert/strict");
const { mkdtempSync, writeFileSync, rmSync } = require("node:fs");
const { tmpdir } = require("node:os");
const path = require("node:path");
const { test } = require("node:test");
const { resolveSettings } = require("../config.cjs");
const { appOrigin } = require("../origin.cjs");
const buildConfig = require("../app.config.js");

const project = "ccdb8912-bbf5-4ef5-8e87-a0df35c929e1";

test("Android delegates capture without broad storage permissions or session backups", () => {
  const config = buildConfig();
  assert.equal(config.android.allowBackup, false);
  for (const permission of [
    "android.permission.CAMERA",
    "android.permission.READ_EXTERNAL_STORAGE",
    "android.permission.WRITE_EXTERNAL_STORAGE",
    "android.permission.RECORD_AUDIO",
    "android.permission.ACCESS_BACKGROUND_LOCATION",
  ]) {
    assert.ok(config.android.blockedPermissions.includes(permission));
  }
  assert.ok(config.plugins.includes("./plugins/with-camera-capture.cjs"));
});

test("a fresh clone uses the current website origin with OTA disabled", () => {
  assert.deepEqual(resolveSettings({}), {
    origin: "https://luma.green",
    allowLocalHttp: false,
    projectId: undefined,
    signing: undefined,
    pushEnabled: false,
    googleServicesFile: undefined,
  });
});

test("Android Firebase config rejects private keys and another app identity", () => {
  const directory = mkdtempSync(path.join(tmpdir(), "luma-firebase-config-"));
  const filename = "google-services.json";
  try {
    const env = { LUMA_ANDROID_GOOGLE_SERVICES_FILE: filename };
    for (const invalid of [
      { type: "service_account", private_key: "do-not-bundle" },
      {
        client: [
          {
            client_info: { android_client_info: { package_name: "other.app" } },
          },
        ],
      },
      {},
    ]) {
      writeFileSync(path.join(directory, filename), JSON.stringify(invalid));
      assert.throws(() => resolveSettings(env, directory));
    }
    writeFileSync(
      path.join(directory, filename),
      JSON.stringify({
        client: [
          {
            client_info: {
              android_client_info: { package_name: "green.luma.app" },
            },
          },
        ],
      }),
    );
    assert.equal(
      resolveSettings(env, directory).googleServicesFile,
      path.join(directory, filename),
    );
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("push stays disabled without an explicit flag and a real EAS project", () => {
  assert.equal(
    resolveSettings({ EXPO_PUBLIC_EAS_PROJECT_ID: project }).pushEnabled,
    false,
  );
  assert.equal(
    resolveSettings({
      EXPO_PUBLIC_PUSH_ENABLED: "true",
      EXPO_PUBLIC_EAS_PROJECT_ID: project,
    }).pushEnabled,
    true,
  );
  assert.throws(() => resolveSettings({ EXPO_PUBLIC_PUSH_ENABLED: "true" }));
  assert.throws(() =>
    resolveSettings({
      EXPO_PUBLIC_PUSH_ENABLED: "yes",
      EXPO_PUBLIC_EAS_PROJECT_ID: project,
    }),
  );
});

test("a release never permits local HTTP even if the developer flag is set", () => {
  for (const profile of ["preview", "production"]) {
    assert.throws(() =>
      resolveSettings({
        EAS_BUILD_PROFILE: profile,
        EXPO_PUBLIC_ALLOW_LOCAL_HTTP: "1",
        EXPO_PUBLIC_APP_URL: "http://localhost:3000",
      }),
    );
  }
  assert.throws(() =>
    resolveSettings({
      NODE_ENV: "production",
      EXPO_PUBLIC_ALLOW_LOCAL_HTTP: "1",
      EXPO_PUBLIC_APP_URL: "http://localhost:3000",
    }),
  );
});

test("explicit local development supports simulator and Android emulator loopback", () => {
  // Android's emulator loopback addresses the developer's host machine.
  // eslint-disable-next-line sonarjs/no-hardcoded-ip -- documented emulator loopback, never a remote service
  for (const host of ["localhost", "127.0.0.1", "[::1]", "10.0.2.2"]) {
    assert.equal(
      resolveSettings({
        EAS_BUILD_PROFILE: "development",
        EXPO_PUBLIC_ALLOW_LOCAL_HTTP: "1",
        EXPO_PUBLIC_APP_URL: `http://${host}:3000`,
      }).origin,
      `http://${host}:3000`,
    );
  }
  // eslint-disable-next-line unicorn/prefer-https -- intentionally insecure URL verifies rejection
  assert.throws(() => appOrigin("http://outside.example", true));
});

test("app origins cannot hide credentials, paths, queries or unsafe schemes", () => {
  for (const value of [
    "https://admin:secret@app.luma.green",
    "https://app.luma.green/admin",
    "https://app.luma.green?release=preview",
    "https://app.luma.green#admin",
    "javascript:alert(1)",
    "file:///etc/passwd",
    "https://localhost",
    "invalid",
  ])
    assert.throws(() => appOrigin(value), value);
});

test("project settings reject placeholder IDs and incomplete signing metadata", () => {
  assert.equal(
    resolveSettings({ EXPO_PUBLIC_EAS_PROJECT_ID: project }).projectId,
    project,
  );
  for (const value of [
    "YOUR_PROJECT_ID",
    "1234",
    "00000000-0000-0000-0000-000000000000",
  ]) {
    assert.throws(() => resolveSettings({ EXPO_PUBLIC_EAS_PROJECT_ID: value }));
  }
  assert.throws(() => resolveSettings({ LUMA_UPDATE_CERTIFICATE: "cert.pem" }));
  assert.throws(() => resolveSettings({ LUMA_UPDATE_KEY_ID: "main" }));
  assert.throws(() =>
    resolveSettings({
      LUMA_UPDATE_CERTIFICATE: "cert.pem",
      LUMA_UPDATE_KEY_ID: "main",
    }),
  );
  assert.throws(() =>
    resolveSettings({
      EXPO_PUBLIC_EAS_PROJECT_ID: project,
      LUMA_UPDATE_CERTIFICATE: "cert.pem",
      LUMA_UPDATE_KEY_ID: "../bad key",
    }),
  );
});

test("invalid configured certificates stop configuration instead of silently disabling signing", () => {
  const directory = mkdtempSync(path.join(tmpdir(), "luma-update-cert-"));
  try {
    writeFileSync(path.join(directory, "invalid.pem"), "not a certificate");
    assert.throws(() =>
      resolveSettings(
        {
          EXPO_PUBLIC_EAS_PROJECT_ID: project,
          LUMA_UPDATE_CERTIFICATE: "invalid.pem",
          LUMA_UPDATE_KEY_ID: "main",
        },
        directory,
      ),
    );
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("configured production OTA requires an explicit app origin and signed updates", () => {
  const env = {
    EAS_BUILD_PROFILE: "production",
    EXPO_PUBLIC_EAS_PROJECT_ID: project,
  };
  assert.throws(() => resolveSettings(env), /Production OTA/);
  assert.throws(
    () =>
      resolveSettings({
        ...env,
        EXPO_PUBLIC_APP_URL: "https://app.luma.green",
      }),
    /Production OTA/,
  );
  assert.equal(
    resolveSettings({ EAS_BUILD_PROFILE: "production" }).projectId,
    undefined,
  );
});

test("a local production export cannot omit signing by omitting the EAS build profile", () => {
  const env = {
    NODE_ENV: "production",
    EXPO_PUBLIC_EAS_PROJECT_ID: project,
    EXPO_PUBLIC_APP_URL: "https://app.luma.green",
  };
  assert.throws(() => resolveSettings(env), /Production OTA/);
  assert.throws(
    () => resolveSettings({ ...env, EAS_BUILD_PROFILE: "custom" }),
    /Production OTA/,
  );
  for (const profile of ["development", "preview"]) {
    assert.equal(
      resolveSettings({ ...env, EAS_BUILD_PROFILE: profile }).signing,
      undefined,
    );
  }
  assert.equal(
    resolveSettings({ NODE_ENV: "production" }).projectId,
    undefined,
  );
});

test("the internal Android demo is an installable APK using the live web screens", () => {
  const { build } = require("../eas.json");
  const profile = build.preview;
  assert.equal(profile.distribution, "internal");
  assert.equal(profile.android.buildType, "apk");
  assert.notEqual(profile.developmentClient, true);
  const settings = resolveSettings({
    ...profile.env,
    EAS_BUILD_PROFILE: "preview",
    NODE_ENV: "production",
  });
  assert.equal(settings.origin, "https://luma.green");
  assert.equal(settings.allowLocalHttp, false);
  assert.equal(settings.pushEnabled, false);
});

test("the shell links the existing Expo project without enabling OTA or push", () => {
  const config = buildConfig();
  assert.equal(config.owner, "lumagreens-team");
  assert.equal(config.slug, "lumagreen");
  assert.equal(
    config.extra.eas.projectId,
    "f0e526e7-20d3-4657-8c45-78afb801cfdf",
  );
  assert.equal(config.updates.enabled, false);
  assert.equal(config.extra.pushEnabled, false);
});
