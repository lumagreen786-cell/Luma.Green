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
    await expect(panel).toHaveCSS("border-top-left-radius", "28px");
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
    await page.emulateMedia({ colorScheme: theme });
    await page.goto("/en");
    const roles = page.getByRole("tablist", {
      name: english.home.roles.heading,
    });
    const tabs = await roles.getByRole("tab").all();
    for (const tab of tabs) {
      await tab.click();
      const panel = page.getByRole("tabpanel");
      await expect(panel.getByRole("heading")).toBeVisible();
      const colors = await panel.evaluate((element) => {
        const heading = element.querySelector("h3");
        return {
          bg: getComputedStyle(element).backgroundColor,
          text: heading ? getComputedStyle(heading).color : "",
        };
      });
      expect(colors.bg).toBe("rgb(32, 35, 44)");
      expect(colors.text).toBe("rgb(245, 246, 248)");
      const image = panel.locator("figure");
      const imageBounds = await image.boundingBox();
      expect(imageBounds?.height).toBeLessThanOrEqual(192);
    }
  });
}
