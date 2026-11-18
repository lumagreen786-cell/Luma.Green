import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const css = readFileSync(
  path.join(process.cwd(), "src/app/globals.css"),
  "utf8",
);

// The interactive theme behavior is tested beside ThemeProvider. These checks
// guard the CSS contract that JavaScript alone cannot exercise in jsdom.
describe("Afterlife dual theme", () => {
  it("keeps component dark styles under the chosen root class", () => {
    expect(css).toContain("@custom-variant dark (&:is(.dark *));");
  });

  it("supplies semantic surfaces and a dark override", () => {
    const light = /:root\s*\{([^}]+)\}/.exec(css)?.[1] ?? "";
    expect(css).toMatch(/\.dark\s*\{/);
    for (const token of [
      "background",
      "foreground",
      "card",
      "card-foreground",
      "popover",
      "popover-foreground",
      "primary",
      "primary-foreground",
      "muted",
      "muted-foreground",
      "border",
      "input",
      "ring",
      "sidebar",
      "sidebar-foreground",
    ]) {
      expect(light, `Light theme is missing ${token}`).toContain(`--${token}:`);
    }
  });
});

function luminance(hex: string) {
  const channels = [1, 3, 5].map((offset) => {
    const value = Number.parseInt(hex.slice(offset, offset + 2), 16) / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
}

function tokens(block: string): Record<string, string> {
  return Object.fromEntries(
    block.split(";").flatMap((declaration) => {
      const [name, value] = declaration
        .trim()
        .split(":")
        .map((part) => part.trim());
      return name.startsWith("--") && /^#[\da-f]{6}$/.test(value)
        ? [[name.slice(2), value]]
        : [];
    }),
  );
}

it("keeps body and muted copy readable on light and dark surfaces", () => {
  const root = /:root\s*\{([^}]+)\}/.exec(css)?.[1] ?? "";
  const dark = /\.dark\s*\{([^}]+)\}/.exec(css)?.[1] ?? "";
  for (const theme of [tokens(root), { ...tokens(root), ...tokens(dark) }]) {
    for (const [foreground, background] of [
      ["foreground", "background"],
      ["muted-foreground", "background"],
      ["muted-foreground", "card"],
      ["primary-foreground", "primary"],
    ]) {
      const values = [
        luminance(theme[foreground]),
        luminance(theme[background]),
      ].toSorted((a, b) => b - a);
      expect(
        (values[0] + 0.05) / (values[1] + 0.05),
        `${foreground} on ${background}`,
      ).toBeGreaterThanOrEqual(4.5);
    }
  }
});
