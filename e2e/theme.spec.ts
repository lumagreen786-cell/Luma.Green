import { expect, test } from "@playwright/test";

import arabic from "../messages/ar.json";
import english from "../messages/en.json";

for (const mode of ["light", "dark"] as const) {
  test(`${mode} choice persists across reload and admin navigation`, async ({
    page,
  }) => {
    await page.emulateMedia({
      colorScheme: mode === "dark" ? "light" : "dark",
    });
    await page.goto("/");
    await page
      .getByRole("banner")
      .getByRole("button", { name: english.theme.label, exact: true })
      .click();
    await page
      .getByRole("menuitemradio", { name: english.theme[mode], exact: true })
      .click();
    await expect(page.locator("html")).toHaveCSS("color-scheme", mode);
    expect(await page.evaluate(() => localStorage.getItem("luma-theme"))).toBe(
      mode,
    );
    await page.reload();
    await expect(page.locator("html")).toHaveCSS("color-scheme", mode);
    await page.goto("/admin/login");
    await expect(page.locator("html")).toHaveCSS("color-scheme", mode);
  });
}

test("system appearance follows device changes after an explicit choice", async ({
  page,
}) => {
  await page.goto("/");
  const appearance = page
    .getByRole("banner")
    .getByRole("button", { name: english.theme.label, exact: true });
  await appearance.click();
  await page
    .getByRole("menuitemradio", { name: english.theme.dark, exact: true })
    .click();
  await expect(page.locator("html")).toHaveCSS("color-scheme", "dark");
  await appearance.click();
  await page
    .getByRole("menuitemradio", { name: english.theme.system, exact: true })
    .click();
  expect(await page.evaluate(() => localStorage.getItem("luma-theme"))).toBe(
    "system",
  );
  for (const colorScheme of ["dark", "light", "dark"] as const) {
    await page.emulateMedia({ colorScheme });
    await expect(page.locator("html")).toHaveCSS("color-scheme", colorScheme);
  }
});

test("Arabic mobile appearance control is in the header and menu reaches sign-in", async ({
  page,
}) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await page.emulateMedia({ colorScheme: "dark" });
  await page.goto("/ar");
  const appearance = page
    .getByRole("banner")
    .getByRole("button", { name: arabic.theme.label, exact: true });
  await expect(appearance).toBeInViewport();
  await appearance.click();
  await page
    .getByRole("menuitemradio", { name: arabic.theme.light, exact: true })
    .click();
  await expect(page.locator("html")).toHaveCSS("color-scheme", "light");
  await page
    .getByRole("button", { name: arabic.nav.openMenu, exact: true })
    .click();
  const menu = page.getByRole("dialog");
  await expect(
    menu.getByRole("button", { name: arabic.theme.label, exact: true }),
  ).toHaveCount(0);
  await expect(
    menu.getByRole("link", { name: arabic.auth.metaTitle, exact: true }),
  ).toHaveAttribute("href", "/ar/login");
  await expect(
    menu.getByRole("link", { name: arabic.nav.sellScrap, exact: true }),
  ).toHaveAttribute("href", "/ar/sell");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
});

test("blocked storage permits session switching and sign-in access", async ({
  page,
}) => {
  await page.addInitScript(() => {
    Storage.prototype.setItem = () => {
      throw new DOMException("Blocked", "SecurityError");
    };
  });
  await page.emulateMedia({ colorScheme: "dark" });
  await page.goto("/");
  await expect(page.locator("html")).toHaveCSS("color-scheme", "dark");
  await page
    .getByRole("banner")
    .getByRole("button", { name: english.theme.label, exact: true })
    .click();
  await page
    .getByRole("menuitemradio", { name: english.theme.light, exact: true })
    .click();
  await expect(page.locator("html")).toHaveCSS("color-scheme", "light");
  await page.goto("/en/login");
  await expect(page.locator("html")).toHaveCSS("color-scheme", "dark");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
});

test("long translated navigation stays separate from header controls", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  for (const width of [1024, 1280]) {
    await page.setViewportSize({ width, height: 900 });
    for (const locale of ["en", "ta", "ml", "ar"]) {
      await page.goto(`/${locale}`, { waitUntil: "domcontentloaded" });
      await page.evaluate(async () => document.fonts.ready);
      const header = page.getByRole("banner");
      const boxes = await header
        .locator("a:visible, button:visible")
        .evaluateAll((elements) =>
          elements.map((element) => {
            const { x, y, width, height } = element.getBoundingClientRect();
            return { x, y, width, height };
          }),
        );
      for (let index = 0; index < boxes.length; index++) {
        const box = boxes[index];
        const otherBoxes = boxes.slice(index + 1);
        for (const other of otherBoxes) {
          const overlapWidth =
            Math.min(box.x + box.width, other.x + other.width) -
            Math.max(box.x, other.x);
          const overlapHeight =
            Math.min(box.y + box.height, other.y + other.height) -
            Math.max(box.y, other.y);
          expect(
            overlapWidth > 1 && overlapHeight > 1,
            `${locale} header controls overlap at ${String(width)}px`,
          ).toBe(false);
        }
      }
    }
  }
});
