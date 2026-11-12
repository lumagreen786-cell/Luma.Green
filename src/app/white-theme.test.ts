import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const css = readFileSync(
  path.join(process.cwd(), "src/app/globals.css"),
  "utf8",
);

// The interactive theme behavior is tested beside ThemeProvider. These checks
// guard the CSS contract that JavaScript alone cannot exercise in jsdom.
describe("Florin dual theme", () => {
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
