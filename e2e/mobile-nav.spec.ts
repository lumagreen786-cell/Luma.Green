import { expect, type Locator, test } from "@playwright/test";

import arabic from "../messages/ar.json";
import english from "../messages/en.json";
import japanese from "../messages/ja.json";
import malayalam from "../messages/ml.json";
import malay from "../messages/ms.json";
import dutch from "../messages/nl.json";
import { localeMeta } from "../src/i18n/locales";

async function bounds(control: Locator) {
  return control.evaluate((element) => {
    const { x, y, width, height } = element.getBoundingClientRect();
    return { x, y, width, height };
  });
}

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
    test(`${locale} menu puts account actions before navigation and settings at ${String(viewport.width)}px`, async ({
      page,
    }) => {
      await page.setViewportSize(viewport);
      await page.emulateMedia({ reducedMotion: "reduce" });
      await page.goto(`/${locale}`);
      await page
        .getByRole("banner")
        .getByRole("button", { name: copy.nav.openMenu, exact: true })
        .click();
      const menu = page.getByRole("dialog");
      await expect(menu).toBeVisible();
      await page.evaluate(async () => {
        await document.fonts.ready;
      });

      const navigation = menu.getByRole("navigation", {
        name: copy.nav.label,
        exact: true,
      });
      const navigationLinks = await navigation.getByRole("link").all();
      for (const link of navigationLinks) {
        const text = await link.evaluate((element) => {
          const range = document.createRange();
          range.selectNodeContents(element);
          const rectangles = [...range.getClientRects()];
          return {
            lines: new Set(
              rectangles.map((rectangle) => Math.round(rectangle.y)),
            ).size,
            overflow: element.scrollWidth - element.clientWidth,
          };
        });
        expect(text.lines).toBe(1);
        expect(text.overflow).toBeLessThanOrEqual(1);
      }
      const language = menu.getByRole("button", {
        name: `${copy.common.language}: ${localeMeta[locale].label}`,
        exact: true,
      });
      const appearance = menu.getByRole("button", {
        name: copy.theme.label,
        exact: true,
      });
      const login = menu.getByRole("link", {
        name: copy.auth.metaTitle,
        exact: true,
      });
      const sell = menu.getByRole("link", {
        name: copy.nav.sellScrap,
        exact: true,
      });

      for (const control of [language, appearance, login, sell]) {
        await expect(control).toBeInViewport();
        expect(
          await control.evaluate(
            (element) => element.scrollWidth - element.clientWidth,
          ),
        ).toBeLessThanOrEqual(2);
      }
      const appearanceBox = await bounds(appearance);
      const languageBox = await bounds(language);
      const loginBox = await bounds(login);
      const sellBox = await bounds(sell);
      const firstLinkBox = await bounds(navigation.getByRole("link").first());
      const lastLinkBox = await bounds(navigation.getByRole("link").last());
      const markBox = await bounds(
        menu.getByRole("img", { name: "Luma.Green", exact: true }),
      );
      // Primary actions come first; navigation and settings follow without
      // overlapping controls or large empty gaps.
      for (const gap of [
        sellBox.y - loginBox.y - loginBox.height,
        firstLinkBox.y - sellBox.y - sellBox.height,
        languageBox.y - lastLinkBox.y - lastLinkBox.height,
        appearanceBox.y - languageBox.y - languageBox.height,
      ]) {
        expect(gap).toBeGreaterThanOrEqual(0);
        expect(gap).toBeLessThanOrEqual(32);
      }
      expect(Math.abs(loginBox.x - firstLinkBox.x)).toBeLessThanOrEqual(1);
      expect(Math.abs(loginBox.width - firstLinkBox.width)).toBeLessThanOrEqual(
        1,
      );
      expect(markBox.width).toBeLessThanOrEqual(28);
      expect(
        await menu.evaluate(
          (element) => element.scrollWidth - element.clientWidth,
        ),
      ).toBeLessThanOrEqual(1);
    });
  }
}
