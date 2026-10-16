import { expect, test } from "@playwright/test";

import english from "../messages/en.json";

// The owner retained the pre-redesign palette. Test rendered colours, including
// the new library's primary button, rather than only checking token declarations.
const palettes = {
  light: {
    background: "oklch(0.985 0.002 250)",
    foreground: "oklch(0.22 0.008 250)",
    primary: "oklch(0.39 0.075 163)",
  },
  dark: {
    background: "oklch(0.165 0.004 250)",
    foreground: "oklch(0.956 0.003 250)",
    primary: "oklch(0.77 0.1 163)",
  },
} as const;

for (const mode of ["light", "dark"] as const) {
  test(`Astryx actions retain Luma's original ${mode} colours`, async ({
    page,
  }) => {
    await page.addInitScript((theme) => {
      localStorage.setItem("luma-theme", theme);
      localStorage.setItem("lg.languageChosen", "1");
    }, mode);
    await page.goto("/en/login");
    const action = page.getByRole("button", {
      name: english.auth.sendCode,
      exact: true,
    });
    await expect(action).toBeVisible();
    await expect(action).toBeDisabled();
    const colours = await page.evaluate((palette) => {
      // Tailwind may serialize OKLCH tokens as Lab; compare rendered sRGB pixels.
      const canvas = document.createElement("canvas");
      canvas.width = 1;
      canvas.height = 1;
      const context = canvas.getContext("2d");
      if (!context) throw new Error("Colour test requires a canvas context");
      const channels = (colour: string) => {
        context.clearRect(0, 0, 1, 1);
        context.fillStyle = colour;
        context.fillRect(0, 0, 1, 1);
        return [...context.getImageData(0, 0, 1, 1).data];
      };
      const button = document.querySelector<HTMLButtonElement>(
        'button[data-slot="button"][type="submit"]',
      );
      if (!button) throw new Error("Missing sign-in action");
      return [
        [
          channels(getComputedStyle(document.body).backgroundColor),
          channels(palette.background),
        ],
        [
          channels(getComputedStyle(document.body).color),
          channels(palette.foreground),
        ],
        [
          channels(getComputedStyle(button).backgroundColor),
          channels(palette.primary),
        ],
      ];
    }, palettes[mode]);
    for (const [actual, expected] of colours) {
      expect(actual).toBeDefined();
      expect(expected).toBeDefined();
      const channels = actual.entries();
      for (const [channel, value] of channels) {
        expect(Math.abs(value - expected[channel])).toBeLessThanOrEqual(1);
      }
    }
  });
}
