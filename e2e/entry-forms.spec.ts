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
        await expect(page.getByRole("complementary")).toHaveCount(0);
        const formBounds = await page.getByRole("main").boundingBox();
        expect(formBounds).not.toBeNull();
        if (formBounds)
          expect(
            Math.abs(formBounds.x + formBounds.width / 2 - width / 2),
          ).toBeLessThanOrEqual(1);
        await expect(
          page.getByRole("button", { name: copy.auth.sendCode, exact: true }),
        ).toBeDisabled();
        await expect(
          page.getByText(copy.auth.unavailableBody, { exact: true }),
        ).toBeVisible();
        const main = page.getByRole("main");
        const box = await main.boundingBox();
        if (!box) throw new Error("Centered login content is missing");
        expect(
          Math.abs(box.y + box.height / 2 - (900 + 80) / 2),
        ).toBeLessThanOrEqual(2);
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
        await expect(page.locator("main img")).toHaveCount(5);
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
          page.getByRole("heading", {
            name: copy.sell.simple.title,
            exact: true,
          }),
        ).toBeVisible();
        await expect(page.locator("main header img")).toHaveCount(1);
        await expect(
          page.getByRole("list", { name: copy.sell.promises.label }),
        ).toHaveCount(0);
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
        await page.evaluate(async () => document.fonts.ready);
        const collection = hero.locator('a[href$="/sell"]');
        await expect(collection).toBeInViewport();
        await expect(heroImage).toBeVisible();
        if (width < 1024) {
          const previewBounds = await heroImage.boundingBox();
          const actionBounds = await collection.boundingBox();
          expect(previewBounds?.y).toBeGreaterThan(
            (actionBounds?.y ?? 0) + (actionBounds?.height ?? 0),
          );
        }
        if (width === 1440) {
          const heading = await hero
            .getByRole("heading", { level: 1 })
            .boundingBox();
          const picture = await heroImage.boundingBox();
          expect(heading).not.toBeNull();
          expect(picture).not.toBeNull();
          if (heading && picture) {
            expect(
              Math.min(picture.y + picture.height, heading.y + heading.height) -
                Math.max(picture.y, heading.y),
              "The photo and title share the desktop row",
            ).toBeGreaterThan(0);
            // Desktop actions fit their labels and share one row.
            const action = await hero.locator('a[href$="/sell"]').boundingBox();
            expect(action).not.toBeNull();
            if (!action) throw new Error("Collection action must render");
            const prices = await hero
              .locator('a[data-slot="button"][href$="/prices"]')
              .boundingBox();
            expect(prices).not.toBeNull();
            if (!prices) throw new Error("Price action must render");
            expect(Math.abs(prices.y - action.y)).toBeLessThanOrEqual(1);
            expect(action.width).toBeLessThan(picture.width);
            expect(action.y).toBeGreaterThanOrEqual(heading.y + heading.height);
            expect(
              Math.min(picture.x + picture.width, action.x + action.width) -
                Math.max(picture.x, action.x),
            ).toBeLessThanOrEqual(0);
            expect(
              await page.evaluate(
                () => document.documentElement.scrollWidth <= innerWidth,
              ),
            ).toBe(true);
          }
        }
        await page.screenshot({ path: testInfo.outputPath("home.png") });
      });
    }
  }
}
