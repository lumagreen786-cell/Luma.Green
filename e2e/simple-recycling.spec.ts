import { expect, test } from "@playwright/test";

import arabic from "../messages/ar.json";
import english from "../messages/en.json";

for (const [locale, copy] of [
  ["en", english],
  ["ar", arabic],
] as const) {
  for (const colorScheme of ["light", "dark"] as const) {
    test(`photo-first recycling form fits ${locale} ${colorScheme}`, async ({
      page,
    }, testInfo) => {
      await page.setViewportSize({ width: 390, height: 900 });
      await page.emulateMedia({ colorScheme, reducedMotion: "reduce" });
      await page.goto(`/${locale}/sell`);
      await expect(
        page.getByRole("heading", {
          name: copy.sell.simple.title,
          exact: true,
        }),
      ).toBeVisible();
      const unavailable = page.getByText(copy.sell.unavailable.title, {
        exact: true,
      });
      if (await unavailable.isVisible()) {
        await expect(unavailable).toBeVisible();
        return;
      }
      await expect(
        page.getByRole("heading", {
          name: copy.sell.simple.details,
          exact: true,
        }),
      ).toBeVisible();
      await page.getByLabel(copy.join.form.city).fill("Mumbai");
      await page
        .getByRole("combobox", { name: copy.join.form.stateUT })
        .click();
      await page
        .getByRole("option", { name: "Maharashtra", exact: true })
        .click();
      await expect(page.getByLabel(copy.sell.when.nameLabel)).toBeVisible();
      await expect(
        page.getByRole("button", {
          name: copy.sell.simple.photos,
          exact: true,
        }),
      ).toBeVisible();
      await expect(
        page.getByText(copy.sell.basket.title, { exact: true }),
      ).toHaveCount(0);
      await page.getByLabel(copy.sell.when.nameLabel).fill("Local layout test");
      await page
        .getByLabel(copy.sell.when.addressLabel)
        .fill("12 Test Street, Bengaluru");
      await page
        .getByRole("button", { name: copy.sell.simple.next, exact: true })
        .click();
      await expect(page.getByRole("main").getByRole("alert")).toContainText(
        copy.sell.simple.photoRequired,
      );
      await expect(page.getByLabel(copy.sell.when.nameLabel)).toHaveValue(
        "Local layout test",
      );
      await expect(page.getByLabel(copy.sell.when.addressLabel)).toHaveValue(
        "12 Test Street, Bengaluru",
      );
      await page
        .getByRole("radio", { name: copy.sell.simple.dropoff, exact: true })
        .click();
      await expect(page.getByLabel(copy.sell.when.addressLabel)).toHaveCount(0);
      await page
        .getByRole("radio", { name: copy.sell.simple.pickup, exact: true })
        .click();
      await expect(page.getByLabel(copy.sell.when.addressLabel)).toHaveValue(
        "12 Test Street, Bengaluru",
      );
      await expect(page.getByLabel(copy.join.form.city)).toHaveValue("Mumbai");
      await expect(
        page.getByRole("combobox", { name: copy.join.form.stateUT }),
      ).toContainText("Maharashtra");
      await page.evaluate(async () => document.fonts.ready);
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth),
      ).toBeLessThanOrEqual(390);
      await page.screenshot({
        path: testInfo.outputPath("recycle-form.png"),
        fullPage: true,
      });
    });
  }
}
