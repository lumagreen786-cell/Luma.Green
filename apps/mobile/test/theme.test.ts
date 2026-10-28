import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

import { shellAppearance, themes } from "../src/theme.ts";

void test("shell controls follow device appearance with readable status bars", () => {
  assert.equal(shellAppearance("dark").colors, themes.dark);
  assert.equal(shellAppearance("dark").statusBar, "light");
  for (const scheme of ["light", "unspecified", null, undefined] as const) {
    assert.equal(shellAppearance(scheme).colors, themes.light);
    assert.equal(shellAppearance(scheme).statusBar, "dark");
  }
});

// Convert the owning OKLCH web tokens independently to rounded sRGB bytes.
// This detects web palette changes that would otherwise leave native chrome stale.
function srgbHex(lightness: number, chroma: number, hue: number): string {
  const a = chroma * Math.cos((hue * Math.PI) / 180);
  const b = chroma * Math.sin((hue * Math.PI) / 180);
  const l = (lightness + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (lightness - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (lightness - 0.0894841775 * a - 1.291485548 * b) ** 3;
  const channels = [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ];
  return `#${channels
    .map((channel) => {
      const encoded =
        channel <= 0.0031308
          ? 12.92 * channel
          : 1.055 * channel ** (1 / 2.4) - 0.055;
      return Math.round(Math.min(1, Math.max(0, encoded)) * 255)
        .toString(16)
        .padStart(2, "0");
    })
    .join("")}`;
}

void test("both native palettes match the current web semantic tokens", () => {
  const css = readFileSync(
    new URL("../../../src/app/globals.css", import.meta.url),
  ).toString("utf8");
  const names = {
    background: "background",
    foreground: "foreground",
    primary: "primary",
    primaryForeground: "primary-foreground",
    muted: "muted",
    border: "border",
  } as const;
  for (const appearance of ["light", "dark"] as const) {
    const selector = appearance === "light" ? ":root" : ".dark";
    const block = css.slice(css.indexOf(`${selector} {`)).split("}", 1)[0];
    for (const [native, web] of Object.entries(names)) {
      const value = new RegExp(String.raw`--${web}: oklch\(([^)]+)\)`).exec(
        block,
      )?.[1];
      assert.ok(value, `${appearance} ${web} must have an owning web token`);
      const [lightness, chroma, hue] = value.split(" ").map(Number);
      assert.equal(
        themes[appearance][native as keyof typeof names],
        srgbHex(lightness, chroma, hue),
      );
    }
  }
});

void test("native configuration permits device light and dark appearance", () => {
  const config = readFileSync(
    new URL("../app.config.js", import.meta.url),
  ).toString("utf8");
  assert.match(config, /userInterfaceStyle: "automatic"/);
});
