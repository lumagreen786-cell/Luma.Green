import { expect, test } from "@playwright/test";

import ar from "../messages/ar.json";
import en from "../messages/en.json";
import kn from "../messages/kn.json";
import pt from "../messages/pt.json";
import { localeMeta } from "../src/i18n/locales";

for (const [locale, messages] of [
  ["en", en],
  ["pt", pt],
  ["ar", ar],
  ["kn", kn],
] as const) {
  const prefix = locale === "en" ? "" : `/${locale}`;

  test(`help keeps message support and excludes fabricated contacts in ${locale}`, async ({
    page,
  }) => {
    await page.goto(`${prefix}/help`);
    await expect(page.locator("html")).toHaveAttribute(
      "lang",
      localeMeta[locale].hreflang,
    );
    await expect(
      page.locator('a[href^="tel:"], a[href*="wa.me/"]'),
    ).toHaveCount(0);
    await expect(
      page.getByText(messages.help.contact.phoneUnavailable),
    ).toBeVisible();
    const write = page.getByRole("link", {
      name: messages.help.contactStrip.write,
    });
    await expect(write).toHaveAttribute("href", `${prefix}/help/contact`);
    await write.click();
    await expect(page).toHaveURL(`${prefix}/help/contact`);
    await expect(
      page.getByRole("heading", { name: messages.help.contact.formHeading }),
    ).toBeVisible();
    await expect(
      page.getByText(messages.help.contact.phoneUnavailable),
    ).toBeVisible();
    await expect(
      page.locator('a[href^="tel:"], a[href*="wa.me/"]'),
    ).toHaveCount(0);
    await expect(
      page.getByText(messages.help.contact.unavailableBody),
    ).toBeVisible();
  });
}
