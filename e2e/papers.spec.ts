import { expect, test } from "@playwright/test";

import ar from "../messages/ar.json" with { type: "json" };
import en from "../messages/en.json" with { type: "json" };
// Disconnected browser guards only. Provider and review behavior are tested
// separately with synthetic responses; this does not prove live OCR accuracy.
for (const { locale, messages } of [
  { locale: "en", messages: en },
  { locale: "ar", messages: ar },
]) {
  test(`${locale} paper records need a real business session`, async ({
    page,
  }) => {
    await page.goto(`/${locale}/app/papers`);
    await expect(page).toHaveURL(/\/login\?next=%2Fapp$/);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      messages.auth.metaTitle,
    );
    await expect(
      page.getByRole("textbox", { name: messages.papers.text }),
    ).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: messages.papers.extract }),
    ).toHaveCount(0);
  });
}
