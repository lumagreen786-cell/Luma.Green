import { expect, test } from "@playwright/test";

import arabic from "../messages/ar.json";
import english from "../messages/en.json";
import malayalam from "../messages/ml.json";

for (const { locale, copy } of [
  { locale: "en", copy: english },
  { locale: "ar", copy: arabic },
  { locale: "ml", copy: malayalam },
] as const) {
  for (const colorScheme of ["light", "dark"] as const) {
    test(`public dock fits ${locale} in ${colorScheme}`, async ({ page }) => {
      await page.setViewportSize({ width: 320, height: 700 });
      await page.emulateMedia({ colorScheme, reducedMotion: "reduce" });
      await page.goto(`/${locale}`);
      const nav = page.getByRole("navigation", {
        name: copy.footer.useHeading,
        exact: true,
      });
      await expect(nav).toBeInViewport();
      await expect(nav.getByRole("link")).toHaveCount(4);
      const links = await nav.getByRole("link").all();
      for (const link of links) {
        await expect(link).toBeInViewport();
        expect(
          await link.evaluate(
            (element) => element.scrollWidth <= element.clientWidth + 1,
          ),
        ).toBe(true);
        const box = await link.boundingBox();
        expect(box?.height).toBeGreaterThanOrEqual(44);
      }
      await nav
        .getByRole("link", { name: copy.nav.prices, exact: true })
        .click();
      const pricePath = locale === "en" ? "/prices" : `/${locale}/prices`;
      await expect(page).toHaveURL(new RegExp(`${pricePath}$`));
      await expect(
        nav.getByRole("link", { name: copy.nav.prices, exact: true }),
      ).toHaveAttribute("aria-current", "page");
      await page.goto(`/${locale}/login`);
      await expect(
        page.getByRole("navigation", {
          name: copy.footer.useHeading,
          exact: true,
        }),
      ).toHaveCount(0);
    });
  }
}
