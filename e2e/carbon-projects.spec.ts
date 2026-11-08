import { expect, test } from "@playwright/test";

for (const locale of ["en", "ar"]) {
  test(`${locale} carbon project workspace requires sign-in`, async ({
    page,
  }) => {
    await page.goto(`/${locale}/app/carbon-projects`);
    await expect(page).toHaveURL(/\/login\?next=%2Fapp$/);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  });
}
