import { expect, test } from "@playwright/test";

import arabic from "../messages/ar.json";
import english from "../messages/en.json";
import japanese from "../messages/ja.json";
import malayalam from "../messages/ml.json";
import malay from "../messages/ms.json";
import dutch from "../messages/nl.json";
import { localeMeta } from "../src/i18n/locales";

for (const { locale, copy } of [
  { locale: "en", copy: english },
  { locale: "ar", copy: arabic },
  { locale: "ml", copy: malayalam },
  { locale: "nl", copy: dutch },
  { locale: "ms", copy: malay },
  { locale: "ja", copy: japanese },
] as const) {
  for (const viewport of [
    { width: 320, height: 700 },
    { width: 768, height: 1024 },
  ]) {
    test(`${locale} menu exposes household navigation and language at ${String(viewport.width)}px`, async ({
      page,
    }) => {
      await page.setViewportSize(viewport);
      await page.emulateMedia({ reducedMotion: "reduce" });
      await page.goto(`/${locale}`);
      const header = page.getByRole("banner");
      await expect(
        header.getByRole("button", { name: copy.theme.label, exact: true }),
      ).toBeInViewport();
      const trigger = header.getByRole("button", {
        name: copy.afterlife.menu,
        exact: true,
      });
      await trigger.click();
      await expect(trigger).toHaveAttribute("aria-expanded", "true");
      const navigation = header.getByRole("navigation", {
        name: copy.afterlife.menu,
        exact: true,
      });
      await expect(trigger).toHaveAttribute(
        "aria-controls",
        (await navigation.getAttribute("id")) ?? "",
      );
      await expect(navigation).toBeVisible();
      await page.evaluate(async () => document.fonts.ready);
      const links = navigation.getByRole("link");
      await expect(links).toHaveCount(3);
      await expect(links.nth(0)).toHaveText(copy.afterlife.how);
      await expect(links.nth(1)).toHaveText(copy.afterlife.questions);
      await expect(links.nth(2)).toHaveText(copy.afterlife.business);
      const language = header.getByRole("button", {
        name: `${copy.common.language}: ${localeMeta[locale].label}`,
        exact: true,
      });
      await expect(language).toBeInViewport();
      const visibleLinks = await links.all();
      for (const link of visibleLinks) {
        await expect(link).toBeInViewport();
        expect(
          await link.evaluate(
            (element) => element.scrollWidth - element.clientWidth,
          ),
        ).toBeLessThanOrEqual(1);
      }
      expect(
        await navigation.evaluate(
          (element) => element.scrollWidth - element.clientWidth,
        ),
      ).toBeLessThanOrEqual(1);
      await links.first().focus();
      await page.keyboard.press("Escape");
      await expect(trigger).toHaveAttribute("aria-expanded", "false");
      await expect(trigger).toBeFocused();
      await expect(navigation).toBeHidden();
    });
  }
}
