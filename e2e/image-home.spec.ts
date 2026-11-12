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
        const recycle = await hero.locator('a[href$="/sell"]').boundingBox();
        const prices = await hero.locator('a[href$="/prices"]').boundingBox();
        if (!recycle || !prices) throw new Error("Hero actions must render");
        for (const box of [recycle, prices]) {
          expect(box.x).toBeGreaterThanOrEqual(0);
          expect(box.x + box.width).toBeLessThanOrEqual(width);
          expect(box.height).toBeGreaterThanOrEqual(44);
        }
        const image = hero.locator("[data-recycling-illustration]");
        await image.scrollIntoViewIfNeeded();
        await expect(image).toBeVisible();
        await expect(image).toHaveAttribute("aria-hidden", "true");
        await expect(image).toHaveAttribute("alt", "");
        await expect(image).toHaveAttribute(
          "src",
          /recycle-household-illustration\.webp/,
        );
        await expect
          .poll(() =>
            image.evaluate(
              (element: HTMLImageElement) =>
                element.complete && element.naturalWidth > 0,
            ),
          )
          .toBe(true);
        const artworkBounds = await image.boundingBox();
        expect(artworkBounds?.width).toBeGreaterThan(200);
        expect(artworkBounds?.height).toBeGreaterThan(100);
        await expect(page.locator("[data-product-preview]")).toHaveCount(0);
        await expect(
          page.locator('section[aria-labelledby="roles-heading"] img'),
        ).toHaveCount(6);
        const resources = page.getByRole("main").getByRole("article");
        await expect(resources).toHaveCount(3);
        for (const [index, original] of [
          "material-yard.webp",
          "recycle-chain-illustration.webp",
          "recycling-line.webp",
        ].entries()) {
          const artwork = resources.nth(index).locator("img");
          await expect(artwork).toHaveAttribute(
            "src",
            new RegExp(original.replaceAll(".", String.raw`\.`)),
          );
          await artwork.scrollIntoViewIfNeeded();
          await expect
            .poll(() =>
              artwork.evaluate(
                (element: HTMLImageElement) =>
                  element.complete && element.naturalWidth > 0,
              ),
            )
            .toBe(true);
          const bounds = await artwork.boundingBox();
          expect(bounds?.width).toBeGreaterThan(100);
          expect(bounds?.width).toBeLessThanOrEqual(width);
        }
        expect(
          await page.evaluate(() => document.documentElement.scrollWidth),
        ).toBeLessThanOrEqual(width);
        await hero.screenshot({ path: testInfo.outputPath("home-image.png") });
        const records = resources.last();
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
