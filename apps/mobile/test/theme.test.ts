import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { URL } from "node:url";

import { shellAppearance, themes } from "../src/theme.ts";

void test("native chrome has one light appearance and dark status-bar text", () => {
  assert.deepEqual(Object.keys(themes), ["light"]);
  assert.equal(shellAppearance().colors, themes.light);
  assert.equal(shellAppearance().appearance, "light");
  assert.equal(shellAppearance().statusBar, "dark");
});

void test("native actions and loading indicators use readable approved colours", () => {
  assert.equal(themes.light.background, "#FFFFFF");
  assert.equal(themes.light.foreground, "#144419");
  assert.equal(themes.light.primary, "#317F38");
  assert.equal(themes.light.primaryForeground, "#FFFFFF");
  assert.equal(themes.light.indicator, "#317F38");
});

void test("native configuration keeps launch surfaces light", () => {
  const config = readFileSync(
    new URL("../app.config.js", import.meta.url),
  ).toString("utf8");
  assert.match(config, /userInterfaceStyle: "light"/);
  assert.match(config, /splash: \{ backgroundColor: "#FFFFFF" \}/);
});
