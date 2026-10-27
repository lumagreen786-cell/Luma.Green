import { expect, test } from "@playwright/test";

import ar from "../messages/ar.json" with { type: "json" };
import en from "../messages/en.json" with { type: "json" };

// Anonymous checks against the normal disconnected app. Protected UI and
// provider acceptance are tested separately; this spec never bypasses auth.
for (const { locale, messages } of [
  { locale: "en", messages: en },
  { locale: "ar", messages: ar },
]) {
  for (const section of ["security", "notifications", "removal"]) {
    test(`${locale} ${section} settings require sign-in and preserve the return destination`, async ({
      page,
    }) => {
      await page.goto(`/${locale}/account/${section}`);
      await expect(page).toHaveURL(
        new RegExp(String.raw`/login\?next=%2Faccount%2F${section}$`),
      );
      await expect(page.getByRole("heading", { level: 1 })).toHaveText(
        messages.auth.metaTitle,
      );
      await expect(page.locator('meta[name="robots"]')).toHaveAttribute(
        "content",
        "noindex, nofollow",
      );
      await expect(
        page.getByLabel(messages.auth.mobileLabel, { exact: true }),
      ).toBeVisible();
      await expect(page).toHaveURL(
        new RegExp(String.raw`/login\?next=%2Faccount%2F${section}$`),
      );
    });
  }
}

for (const route of ["forgot-password", "reset-password"]) {
  test(`retired admin ${route} redirects to phone login`, async ({ page }) => {
    await page.goto(`/admin/${route}`);
    await expect(page).toHaveURL(/\/admin\/login$/);
    await expect(page.locator('input[type="email"]')).toHaveCount(0);
    await expect(page.locator('input[type="password"]')).toHaveCount(0);
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute(
      "content",
      "noindex, nofollow",
    );
  });
}

test("disconnected account-removal review queue stays unavailable", async ({
  page,
}) => {
  await page.goto("/admin/account-removals");
  await expect(page).toHaveURL(/\/admin\/account-removals$/);
  await expect(
    page.getByText("The admin console isn't switched on here", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Account access and evidence review" }),
  ).toHaveCount(0);
});
