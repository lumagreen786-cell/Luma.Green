/* eslint-disable sonarjs/code-eval -- Executes only this repository's generated appearance script in a mocked isolated VM. */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { URL } from "node:url";
import { runInNewContext } from "node:vm";

import {
  appearanceBridgeScript,
  appearanceMessage,
  shellAppearance,
  themes,
} from "../src/theme.ts";

void test("native chrome follows dark/light appearance with readable status-bar text", () => {
  assert.equal(shellAppearance("dark").colors, themes.dark);
  assert.equal(shellAppearance("dark").statusBar, "light");
  assert.equal(shellAppearance("light").colors, themes.light);
  assert.equal(shellAppearance().statusBar, "dark");
  assert.equal(shellAppearance("unexpected").appearance, "light");
  assert.equal(themes.light.background, "#e7e9ee");
  assert.equal(themes.dark.background, "#080b14");
  for (const theme of Object.values(themes)) {
    assert.equal(theme.primary, "#9bf80f");
    assert.equal(theme.primaryForeground, "#10130a");
  }
});

void test("appearance messages accept only the two exact local settings", () => {
  assert.equal(appearanceMessage("appearance:dark"), "dark");
  assert.equal(appearanceMessage("appearance:light"), "light");
  for (const raw of ["dark", "appearance:system", "appearance:dark extra", ""])
    assert.equal(appearanceMessage(raw), null);
});

void test("appearance observer requires a trusted top-page enveloped bridge and reports only a theme", () => {
  const sent: string[] = [];
  let isDark = true;
  let notify: (() => void) | undefined;
  const postMessage = Object.assign(
    (data: string) => {
      sent.push(data);
    },
    {
      __lumaEnvelope: true,
    },
  );
  const window: {
    top?: unknown;
    location: { origin: string };
    ReactNativeWebView: { postMessage: typeof postMessage };
  } = {
    location: { origin: "https://luma.green" },
    ReactNativeWebView: { postMessage },
  };
  window.top = window;
  const context = {
    window,
    document: { documentElement: { classList: { contains: () => isDark } } },
    MutationObserver: class {
      constructor(callback: () => void) {
        notify = callback;
      }
      observe() {
        /* The test calls the captured callback directly. */
      }
    },
  };
  runInNewContext(appearanceBridgeScript("https://luma.green"), context);
  assert.deepEqual(sent, ["appearance:dark"]);
  isDark = false;
  notify?.();
  assert.deepEqual(sent, ["appearance:dark", "appearance:light"]);
  sent.length = 0;
  window.top = {};
  runInNewContext(appearanceBridgeScript("https://luma.green"), context);
  assert.deepEqual(sent, []);
  window.top = window;
  window.location.origin = "https://foreign.example";
  runInNewContext(appearanceBridgeScript("https://luma.green"), context);
  assert.deepEqual(sent, []);
  window.location.origin = "https://luma.green";
  postMessage.__lumaEnvelope = false;
  runInNewContext(appearanceBridgeScript("https://luma.green"), context);
  assert.deepEqual(sent, []);
});

void test("native configuration permits both system appearances without publishing a binary", () => {
  const config = readFileSync(
    new URL("../app.config.js", import.meta.url),
    "utf8",
  );
  assert.match(config, /userInterfaceStyle: "automatic"/);
  assert.match(config, /splash: \{ backgroundColor: "#e7e9ee" \}/);
});
