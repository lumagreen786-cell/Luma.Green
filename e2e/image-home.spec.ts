import { expect, test } from "@playwright/test";

import arabic from "../messages/ar.json";
import english from "../messages/en.json";

for (const { locale, copy } of [
  { locale: "en", copy: english },
  { locale: "ar", copy: arabic },
]) {
  for (const width of [390, 768, 1440]) {
    for (const colorScheme of ["light", "dark"] as const) {
      test(`image home fits ${locale} ${String(width)}px ${colorScheme}`, async ({
        page,
      }, testInfo) => {
        await page.setViewportSize({ width, height: 900 });
        await page.emulateMedia({ reducedMotion: "reduce", colorScheme });
        await page.goto(`/${locale}`);
        await page.evaluate(async () => document.fonts.ready);
        const hero = page.getByRole("main").locator("section").first();
        const booking = hero.getByRole("button", {
          name: copy.afterlife.bookNow,
          exact: true,
        });
        await expect(booking).toBeInViewport();
        await expect(booking).toBeDisabled();
        const action = await booking.boundingBox();
        if (!action) throw new Error("Booking action must render");
        expect(action.x).toBeGreaterThanOrEqual(0);
        expect(action.x + action.width).toBeLessThanOrEqual(width);
        expect(action.height).toBeGreaterThanOrEqual(44);
        const image = hero.locator("img");
        await expect(image).toBeVisible();
        await expect(image).toHaveAttribute("alt", "");
        await expect(image).toHaveAttribute(
          "src",
          /household-preparation\.webp/,
        );
        await expect
          .poll(() =>
            image.evaluate(
              (element: HTMLImageElement) =>
                element.complete && element.naturalWidth > 0,
            ),
          )
          .toBe(true);
        await expect(hero.getByRole("heading", { level: 1 })).toHaveCSS(
          "color",
          "rgb(255, 255, 255)",
        );
        await expect(page.locator("#how")).toBeAttached();
        await expect(page.locator("#questions details")).toHaveCount(3);
        await expect(page.getByRole("dialog")).toHaveCount(0);
        await expect(page.locator("#demo-testimonials-heading")).toHaveCount(0);
        expect(
          await page.evaluate(() => document.documentElement.scrollWidth),
        ).toBeLessThanOrEqual(width);
        await hero.screenshot({ path: testInfo.outputPath("home-image.png") });
        await page
          .locator("#how")
          .screenshot({ path: testInfo.outputPath("booking-phone.png") });
        await page
          .getByRole("contentinfo")
          .screenshot({ path: testInfo.outputPath("footer.png") });
      });
    }
  }
}

test("login shares working public navigation and the mobile menu retains keyboard access", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/en/login");
  const header = page.getByRole("banner");
  const home = header.getByRole("link", { name: "Luma.Green", exact: true });
  await expect(home).toHaveAttribute("href", "/");
  const trigger = header.getByRole("button", {
    name: english.afterlife.menu,
    exact: true,
  });
  await trigger.focus();
  await page.keyboard.press("Enter");
  await expect(trigger).toHaveAttribute("aria-expanded", "true");
  const menu = header.getByRole("navigation", {
    name: english.afterlife.menu,
    exact: true,
  });
  await expect(
    menu.getByRole("link", { name: english.afterlife.how, exact: true }),
  ).toHaveAttribute("href", "/#how");
  await expect(menu.getByRole("button", { name: /English/ })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(trigger).toHaveAttribute("aria-expanded", "false");
  await expect(trigger).toBeFocused();
  await home.click();
  await expect(page).toHaveURL(/\/$/u);
});
