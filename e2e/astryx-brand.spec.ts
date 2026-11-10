import { expect, test } from "@playwright/test";

import english from "../messages/en.json";

// Compare rendered colours for the approved light-only system, including
// a stored legacy dark preference and the sign-in submit action.
const palette = {
  background: "color-mix(in srgb, #144419 7%, #FFFFFF)",
  foreground: "#144419",
  primary: "#317F38",
};

for (const mode of ["light", "dark"] as const) {
  test(`Actions use the approved palette with a stored ${mode} preference`, async ({
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
    }, palette);
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
