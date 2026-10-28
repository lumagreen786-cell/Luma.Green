const assert = require("node:assert/strict");
const { test } = require("node:test");
const { trimIosPermissions } = require("../plugins/with-app-permissions.cjs");

test("iOS production removes unused capabilities without removing picker or foreground access", () => {
  const input = {
    NSCameraUsageDescription: "capture",
    NSPhotoLibraryUsageDescription: "pick",
    NSLocationWhenInUseUsageDescription: "nearby",
    NSLocationAlwaysUsageDescription: "unused",
    NSLocationAlwaysAndWhenInUseUsageDescription: "unused",
    NSMotionUsageDescription: "unused",
    NSMicrophoneUsageDescription: "unused",
    NSLocalNetworkUsageDescription: "dev",
    NSBonjourServices: ["dev"],
    UIBackgroundModes: ["location", "audio", "remote-notification"],
  };
  const result = trimIosPermissions(input, false);
  assert.deepEqual(result, {
    NSCameraUsageDescription: "capture",
    NSPhotoLibraryUsageDescription: "pick",
    NSLocationWhenInUseUsageDescription: "nearby",
  });
  assert.deepEqual(trimIosPermissions(result, false), result);
  assert.equal(input.NSLocationAlwaysUsageDescription, "unused");
  assert.equal(
    trimIosPermissions(input, true).NSLocalNetworkUsageDescription,
    "dev",
  );
});

test("compiled production configuration contains no background or developer access", () => {
  const { execFileSync } = require("node:child_process");
  const path = require("node:path");
  const cli = path.join(
    path.dirname(require.resolve("expo/package.json")),
    "bin",
    "cli",
  );
  const compiled = JSON.parse(
    execFileSync(
      process.execPath,
      [cli, "config", "--type", "introspect", "--json"],
      {
        cwd: path.join(__dirname, ".."),
        env: {
          ...process.env,
          NODE_ENV: "production",
          EAS_BUILD_PROFILE: "production",
          EXPO_PUBLIC_APP_URL: "https://luma.green",
          EXPO_PUBLIC_EAS_PROJECT_ID: "",
          EXPO_PUBLIC_PUSH_ENABLED: "false",
          LUMA_UPDATE_CERTIFICATE: "",
          LUMA_UPDATE_KEY_ID: "",
        },
        maxBuffer: 4 * 1024 * 1024,
        encoding: "utf8",
      },
    ),
  );
  const mods = compiled._internal.modResults;
  const plist = mods.ios.infoPlist;
  assert.deepEqual(
    Object.keys(plist)
      .filter((key) => key.endsWith("UsageDescription"))
      .toSorted((a, b) => a.localeCompare(b)),
    [
      "NSCameraUsageDescription",
      "NSLocationWhenInUseUsageDescription",
      "NSPhotoLibraryUsageDescription",
    ],
  );
  assert.equal(plist.UIBackgroundModes, undefined);
  const permissions = mods.android.manifest.manifest["uses-permission"]
    .filter((entry) => entry.$["tools:node"] !== "remove")
    .map((entry) => entry.$["android:name"])
    .toSorted((a, b) => a.localeCompare(b));
  assert.deepEqual(permissions, [
    "android.permission.ACCESS_COARSE_LOCATION",
    "android.permission.ACCESS_FINE_LOCATION",
    "android.permission.INTERNET",
  ]);
});
