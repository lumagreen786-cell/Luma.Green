import { expect, test } from "@playwright/test";

import ar from "../messages/ar.json" with { type: "json" };
import en from "../messages/en.json" with { type: "json" };

for (const { locale, messages } of [
  { locale: "en", messages: en },
  { locale: "ar", messages: ar },
]) {
  for (const route of ["market", "trades"]) {
    test(`${locale} PET ${route} link requires a workspace session`, async ({
      page,
    }) => {
      await page.goto(`/${locale}/app/${route}?procurement=pet`);
      await expect(page).toHaveURL(/\/login\?next=%2Fapp$/);
      await expect(page.getByRole("heading", { level: 1 })).toHaveText(
        messages.auth.metaTitle,
      );
      await expect(
        page.getByText(messages.market.recycledPetProcurement),
      ).toHaveCount(0);
    });
  }
}
