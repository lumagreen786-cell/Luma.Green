import { expect, test } from "@playwright/test";

import ar from "../messages/ar.json" with { type: "json" };
import en from "../messages/en.json" with { type: "json" };

// No configured provider or synthetic public session. These cases prove the
// private entry guard, not a paid subscription or merchant acceptance.
for (const { locale, messages } of [
  { locale: "en", messages: en },
  { locale: "ar", messages: ar },
]) {
  test(`${locale} site plans require a real business session`, async ({
    page,
  }) => {
    await page.goto(`/${locale}/app/billing`);
    await expect(page).toHaveURL(/\/login\?next=%2Fapp$/);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      messages.auth.metaTitle,
    );
    await expect(
      page.getByRole("heading", { name: messages.businessSubscriptions.title }),
    ).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: messages.businessSubscriptions.save }),
    ).toHaveCount(0);
  });
}
