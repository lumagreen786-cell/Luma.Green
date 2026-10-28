import { expect, test } from "@playwright/test";

import ar from "../messages/ar.json";
import en from "../messages/en.json";

for (const { path, messages } of [
  { path: "/", messages: en },
  { path: "/ar", messages: ar },
]) {
  test(`public privacy and data requests are reachable ${path}`, async ({
    page,
  }) => {
    await page.goto(path);
    await page
      .getByRole("contentinfo")
      .getByRole("link", { name: messages.privacy.title, exact: true })
      .click();
    await expect(
      page.getByRole("heading", { name: messages.privacy.title, exact: true }),
    ).toBeVisible();
    await expect(page.locator("#requests")).toContainText(
      messages.privacy.requestsBody,
    );
    await expect(
      page.getByRole("link", {
        name: messages.accountRemoval.title,
        exact: true,
      }),
    ).toHaveAttribute("href", `${path === "/" ? "" : path}/account/removal`);
    await expect(
      page.getByRole("link", { name: "support@luma.green", exact: true }),
    ).toHaveAttribute("href", "mailto:support@luma.green");
    await page.reload();
    await expect(
      page.getByRole("heading", {
        name: messages.privacy.retentionTitle,
        exact: true,
      }),
    ).toBeVisible();
  });
}

for (const locale of ["en", "kn", "ta", "ar", "ur", "de", "ru"]) {
  test(`privacy fits translated scripts and device widths ${locale}`, async ({
    page,
  }, testInfo) => {
    test.setTimeout(60_000);
    for (const theme of ["light", "dark"] as const) {
      await page.emulateMedia({ colorScheme: theme });
      await page.goto(`/${locale}/privacy`);
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      await page.evaluate(() => document.fonts.ready);
      for (const width of [320, 768, 1440]) {
        await page.setViewportSize({ width, height: 900 });
        await expect
          .poll(() =>
            page.evaluate(
              () => document.documentElement.scrollWidth <= window.innerWidth,
            ),
          )
          .toBe(true);
        await expect
          .poll(() =>
            page.evaluate(() =>
              document.documentElement.classList.contains("dark"),
            ),
          )
          .toBe(theme === "dark");
        await expect(page.locator("#requests")).toContainText(/\S/);
        // A document can fit while a long word still spills out of its column.
        await expect
          .poll(() =>
            page
              .getByRole("contentinfo")
              .locator("li")
              .evaluateAll((items) =>
                items.every((item) => item.scrollWidth <= item.clientWidth + 1),
              ),
          )
          .toBe(true);
        await page.screenshot({
          path: testInfo.outputPath(
            `privacy-${locale}-${String(width)}-${theme}.png`,
          ),
          fullPage: true,
        });
      }
    }
  });
}
