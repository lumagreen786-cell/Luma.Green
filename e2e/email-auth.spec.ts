import { expect, test } from "@playwright/test";

for (const locale of ["en", "ar", "ur"]) {
  test(`phone-only login redirects retired email routes in ${locale}`, async ({
    page,
  }) => {
    const prefix = locale === "en" ? "" : `/${locale}`;
    for (const route of ["verify", "reset", "complete"]) {
      await page.goto(`${prefix}/login/email/${route}`);
      await expect(page).toHaveURL(new RegExp(`${prefix}/login$`));
      await expect(page.locator('input[type="email"]')).toHaveCount(0);
      await expect(page.locator('input[type="password"]')).toHaveCount(0);
    }
  });
}
