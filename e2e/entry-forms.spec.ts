import { expect, test } from "@playwright/test";

import ar from "../messages/ar.json";
import en from "../messages/en.json";
import kn from "../messages/kn.json";

/** Public UI only: no OTP delivery or authenticated enrollment is claimed. */
for (const { locale, copy } of [
  { locale: "en", copy: en },
  { locale: "ar", copy: ar },
  { locale: "kn", copy: kn },
]) {
  for (const width of [390, 768, 1440]) {
    for (const theme of ["light", "dark"] as const) {
      test(`${locale} entry forms fit ${String(width)}px in ${theme}`, async ({
        page,
      }, testInfo) => {
        await page.setViewportSize({ width, height: 900 });
        await page.emulateMedia({
          colorScheme: theme,
          reducedMotion: "reduce",
        });
        await page.addInitScript(() => {
          localStorage.setItem("lg.languageChosen", "1");
        });
        await page.goto(`/${locale}/login`);
        const phone = page.getByLabel(copy.auth.mobileLabel, { exact: true });
        await expect(phone).toBeVisible();
        await page.evaluate(async () => document.fonts.ready);
        const image = page.locator("aside img");
        await expect(image).toBeVisible();
        await expect
          .poll(() =>
            image.evaluate(
              (element: HTMLImageElement) =>
                element.complete && element.naturalWidth > 0,
            ),
          )
          .toBe(true);
        await phone.fill("123");
        await phone.press("Enter");
        await expect(page.getByRole("main").getByRole("alert")).toHaveText(
          copy.auth.mobileInvalid,
        );
        await expect(phone).toHaveValue("123");
        await expect(phone).toBeFocused();
        expect(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth,
          ),
        ).toBe(true);
        await page.screenshot({
          path: testInfo.outputPath("login.png"),
          fullPage: true,
        });
        await page.goto(`/${locale}/join`);
        const role = page.getByRole("main").getByRole("link", {
          name: new RegExp(copy.join.roles.kabadiwala.title),
        });
        await expect(role).toHaveAttribute(
          "href",
          new RegExp("/join/kabadiwala$"),
        );
        // Load lazy role images before retaining a full-page visual artifact.
        const roleImages = await page.locator("main img").all();
        for (const roleImage of roleImages) {
          await roleImage.scrollIntoViewIfNeeded();
          await expect
            .poll(() =>
              roleImage.evaluate(
                (element: HTMLImageElement) =>
                  element.complete && element.naturalWidth > 0,
              ),
            )
            .toBe(true);
        }
        await page.getByRole("heading", { level: 1 }).scrollIntoViewIfNeeded();
        expect(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth,
          ),
        ).toBe(true);
        await page.screenshot({
          path: testInfo.outputPath("join.png"),
          fullPage: true,
        });
        await page.goto(`/${locale}/sell`);
        await expect(
          page.getByRole("heading", { name: copy.sell.title, exact: true }),
        ).toBeVisible();
        await expect(page.locator("main header img")).toBeVisible();
        expect(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth,
          ),
        ).toBe(true);
        await page.screenshot({
          path: testInfo.outputPath("sell.png"),
          fullPage: true,
        });
        await page.goto(`/${locale}`);
        const hero = page.getByRole("region", {
          name: copy.home.hero.title,
          exact: true,
        });
        const heroImage = hero.locator("img");
        await expect(heroImage).toBeVisible();
        await page.evaluate(async () => document.fonts.ready);
        await expect
          .poll(() =>
            heroImage.evaluate(
              (element: HTMLImageElement) =>
                element.complete && element.naturalWidth > 0,
            ),
          )
          .toBe(true);
        if (width === 1440) {
          const heading = await hero
            .getByRole("heading", { level: 1 })
            .boundingBox();
          const picture = await heroImage.boundingBox();
          expect(heading).not.toBeNull();
          expect(picture).not.toBeNull();
          if (heading && picture) {
            expect(
              Math.min(heading.x + heading.width, picture.x + picture.width) -
                Math.max(heading.x, picture.x),
            ).toBeLessThanOrEqual(0);
          }
        }
        await page.screenshot({ path: testInfo.outputPath("home.png") });
      });
    }
  }
}
