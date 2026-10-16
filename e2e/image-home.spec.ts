import { expect, test } from "@playwright/test";

import english from "../messages/en.json";

for (const locale of ["en", "ar"]) {
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
        await expect(hero.locator('a[href$="/sell"]')).toBeInViewport();
        if (width >= 768) {
          const recycle = await hero.locator('a[href$="/sell"]').boundingBox();
          const prices = await hero
            .locator('a[data-slot="button"][href$="/prices"]')
            .boundingBox();
          if (!recycle || !prices) throw new Error("Hero actions must render");
          expect(Math.abs(recycle.y - prices.y)).toBeLessThanOrEqual(1);
          expect(recycle.width).toBeLessThan(width / 2);
        }
        const image = hero.locator("img");
        await image.scrollIntoViewIfNeeded();
        await expect
          .poll(() =>
            image.evaluate(
              (element: HTMLImageElement) =>
                element.complete && element.naturalWidth > 0,
            ),
          )
          .toBe(true);
        await expect(page.locator("[data-product-preview]")).toHaveCount(0);
        await expect(
          page.locator('section[aria-labelledby="roles-heading"] img'),
        ).toHaveCount(5);
        await expect(
          page.locator('section[aria-labelledby="shop-workday-heading"] img'),
        ).toHaveCount(1);
        expect(
          await page.evaluate(() => document.documentElement.scrollWidth),
        ).toBeLessThanOrEqual(width);
        await hero.screenshot({ path: testInfo.outputPath("home-image.png") });
        const records = page.locator(
          'section[aria-labelledby="material-records-heading"]',
        );
        await records.screenshot({
          path: testInfo.outputPath("material-records.png"),
        });
        await expect(page.locator("#demo-testimonials-heading")).toHaveCount(0);
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
  await expect(
    header.getByRole("link", { name: english.nav.home, exact: true }),
  ).toHaveAttribute("href", "/");
  const trigger = header.getByRole("button", { name: english.nav.openMenu });
  await expect(trigger).toBeEnabled();
  await trigger.focus();
  await page.keyboard.press("Enter");
  const menu = page.getByRole("dialog");
  const recycle = menu.getByRole("link", {
    name: english.nav.sellScrap,
    exact: true,
  });
  await expect(recycle).toHaveAttribute("href", "/sell");
  await expect(menu.getByRole("button", { name: /English/ })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(trigger).toBeFocused();
  await header
    .getByRole("link", { name: english.nav.home, exact: true })
    .click();
  await expect(page).toHaveURL(/\/$/u);
});
