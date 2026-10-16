import { expect, test } from "@playwright/test";

import ar from "../messages/ar.json" with { type: "json" };
import en from "../messages/en.json" with { type: "json" };

for (const { locale, messages } of [
  { locale: "en", messages: en },
  { locale: "ar", messages: ar },
]) {
  for (const width of [390, 768, 1440]) {
    test(`${locale} task layout keeps sign-in and unavailable-price guidance in reach at ${String(width)}px`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.goto(`/${locale}/login`);
      await page.evaluate(async () => document.fonts.ready);
      await expect(page.getByRole("heading", { level: 1 })).toBeInViewport();
      await expect(
        page.getByRole("button", { name: messages.auth.continue, exact: true }),
      ).toBeInViewport();
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
      if (width >= 1024) {
        const form = await page.getByRole("main").boundingBox();
        await expect(page.getByRole("complementary")).toHaveCount(0);
        expect(form).not.toBeNull();
        if (form) {
          expect(form.width).toBeGreaterThanOrEqual(400);
          expect(
            Math.abs(form.x + form.width / 2 - width / 2),
          ).toBeLessThanOrEqual(1);
        }
      }
      await page.goto(`/${locale}/prices`);
      const unavailable = page.getByRole("status", {
        name: messages.prices.unavailable.title,
      });
      await expect(unavailable).toHaveAttribute("aria-busy", "false");
      await expect(unavailable).toBeVisible();
      const bounds = await unavailable.boundingBox();
      expect(bounds).not.toBeNull();
      if (bounds) expect(bounds.height).toBeLessThan(240);
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
    });
  }
}
