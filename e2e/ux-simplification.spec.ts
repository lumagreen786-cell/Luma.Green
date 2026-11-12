import { expect, test } from "@playwright/test";

import ar from "../messages/ar.json";
import en from "../messages/en.json";
import kn from "../messages/kn.json";
import { actionName } from "../src/components/site/action-name";

for (const [locale, copy] of [
  ["en", en],
  ["ar", ar],
  ["kn", kn],
] as const) {
  for (const width of [390, 768, 1440]) {
    for (const colorScheme of ["light", "dark"] as const) {
      test(`${locale} role selection and signup entry at ${String(width)}px ${colorScheme}`, async ({
        page,
      }, info) => {
        await page.setViewportSize({ width, height: 900 });
        await page.emulateMedia({ colorScheme, reducedMotion: "reduce" });
        await page.goto(`/${locale}`);
        const panel = page.getByRole("tabpanel");
        const role = panel.getByRole("link", {
          name: actionName(copy.join.start, copy.home.roles.kabadiwala.cta),
          exact: true,
        });
        await expect(role).toHaveCount(1);
        await expect(panel.getByRole("heading")).toHaveText(
          copy.home.roles.kabadiwala.title,
        );
        const image = panel.locator("img");
        await image.scrollIntoViewIfNeeded();
        await page.evaluate(async () => document.fonts.ready);
        await expect
          .poll(() =>
            image.evaluate(
              (element: HTMLImageElement) =>
                element.complete && element.naturalWidth > 0,
            ),
          )
          .toBe(true);
        await page.screenshot({ path: info.outputPath("role-card.png") });
        await role.focus();
        await expect(role).toBeFocused();
        await page.keyboard.press("Enter");
        await expect(page).toHaveURL(/\/login\?next=/u);
        await expect(
          page.getByLabel(copy.auth.mobileLabel, { exact: true }),
        ).toBeVisible();
        await expect(
          page.getByRole("heading", { name: copy.auth.chooseLanguage }),
        ).toHaveCount(0);
        await page.evaluate(async () => document.fonts.ready);
        await expect(
          page.getByRole("button", { name: copy.auth.sendCode, exact: true }),
        ).toBeInViewport();
        expect(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth,
          ),
        ).toBe(true);
        await page.screenshot({
          path: info.outputPath("phone-first.png"),
          fullPage: true,
        });
      });
    }
  }
}
