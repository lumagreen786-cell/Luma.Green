import { expect, test } from "@playwright/test";

for (const locale of ["en", "ar"]) {
  test(`${locale} lot evidence requires a workspace session`, async ({
    page,
  }) => {
    await page.goto(`/${locale}/app/lots/sample-lot`);
    await expect(page).toHaveURL(/\/login\?next=%2Fapp$/);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  });
}
