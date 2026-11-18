import { expect, test } from "@playwright/test";

import english from "../messages/en.json";

for (const theme of ["light", "dark"] as const) {
  test(`admin sign-in can change its ${theme} appearance on a phone`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: 320, height: 800 });
    await page.emulateMedia({ colorScheme: theme });
    await page.goto("/admin/login");
    const nextTheme = theme === "dark" ? "Light" : "Dark";
    await page.getByRole("button", { name: "Appearance", exact: true }).click();
    await page
      .getByRole("menuitemradio", { name: nextTheme, exact: true })
      .click();
    await expect(page.locator("html")).toHaveCSS(
      "color-scheme",
      nextTheme.toLowerCase(),
    );
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBeLessThanOrEqual(320);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  });

  test(`missing pages keep the recovery action usable in ${theme}`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.emulateMedia({ colorScheme: theme });
    const response = await page.goto("/ta/no-such-page");
    expect(response?.status()).toBe(404);
    const panel = page.getByRole("heading", { level: 1 }).locator("..");
    await expect(panel).toHaveCSS("border-top-left-radius", "20px");
    await expect(panel.getByRole("link")).toBeVisible();
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBeLessThanOrEqual(390);
    await panel.getByRole("link").click();
    await expect(page).toHaveURL("/ta");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  });

  test(`role details remain readable and bounded in ${theme}`, async ({
    page,
  }) => {
    await page.emulateMedia({ colorScheme: theme, reducedMotion: "reduce" });
    await page.goto("/en/business");
    const roles = page.locator("#roles");
    await expect(roles.getByRole("heading", { level: 3 })).toHaveCount(5);
    const headings = await roles.getByRole("heading", { level: 3 }).all();
    for (const heading of headings) {
      const card = heading.locator("..");
      await expect(heading).toBeVisible();
      await expect(
        card.getByRole("link", { name: english.afterlife.roleAction }),
      ).toBeVisible();
      const layout = await card.evaluate((element) => {
        const heading = element.querySelector("h3");
        const image = element.querySelector("img");
        if (!heading || !image)
          throw new Error("Role card must have a heading and image");
        const bounds = element.getBoundingClientRect();
        const photo = image.getBoundingClientRect();
        return {
          text: getComputedStyle(heading).color,
          bodyText: getComputedStyle(document.body).color,
          imageFits:
            photo.left >= bounds.left - 1 && photo.right <= bounds.right + 1,
          imageLoaded: image.complete && image.naturalWidth > 0,
          height: photo.height,
        };
      });
      expect(layout.text).toBe(layout.bodyText);
      expect(layout.imageFits).toBe(true);
      expect(layout.imageLoaded).toBe(true);
      expect(layout.height).toBeGreaterThan(0);
      expect(layout.height).toBeLessThanOrEqual(220);
    }
  });
}
