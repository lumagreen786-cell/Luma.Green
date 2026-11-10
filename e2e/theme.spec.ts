import { expect, test } from "@playwright/test";

import arabic from "../messages/ar.json";

// Full document navigation to admin exercises the second root layout.
test("light appearance replaces a stored dark preference across reload and admin", async ({
  page,
}) => {
  await page.addInitScript(() => {
    localStorage.setItem("luma-theme", "dark");
  });
  await page.emulateMedia({ colorScheme: "dark" });
  for (const route of ["/", "/admin/login"]) {
    await page.goto(route);
    await expect(page.locator("html")).not.toHaveClass(/dark/);
    await expect(page.locator("html")).toHaveCSS("color-scheme", "light");
    await expect(
      page.getByRole("button", { name: "Appearance", exact: true }),
    ).toHaveCount(0);
    await page.reload();
    await expect(page.locator("html")).not.toHaveClass(/dark/);
  }
});

test("light appearance stays fixed when device appearance changes", async ({
  page,
}) => {
  await page.goto("/");
  for (const colorScheme of ["dark", "light", "dark"] as const) {
    await page.emulateMedia({ colorScheme });
    await expect(page.locator("html")).not.toHaveClass(/dark/);
    await expect(page.locator("html")).toHaveCSS("color-scheme", "light");
  }
});

test("Arabic mobile controls fit and the menu reaches sign-in", async ({
  page,
}) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await page.emulateMedia({ colorScheme: "dark" });
  await page.goto("/ar");
  await page
    .getByRole("button", { name: arabic.nav.openMenu, exact: true })
    .click();
  const menu = page.getByRole("dialog");
  await expect(
    menu.getByRole("button", { name: arabic.theme.label, exact: true }),
  ).toHaveCount(0);
  await expect(page.locator("html")).not.toHaveClass(/dark/);
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

test("blocked browser storage does not prevent light appearance or sign-in access", async ({
  page,
}) => {
  await page.addInitScript(() => {
    Storage.prototype.setItem = () => {
      throw new DOMException("Blocked", "SecurityError");
    };
  });
  await page.emulateMedia({ colorScheme: "dark" });
  await page.goto("/en/login");
  await expect(page.locator("html")).not.toHaveClass(/dark/);
  await expect(page.locator("html")).toHaveCSS("color-scheme", "light");
  await expect(
    page.getByRole("button", { name: "Appearance", exact: true }),
  ).toHaveCount(0);
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
