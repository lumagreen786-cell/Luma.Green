import { expect, type Locator, type Page, test } from "@playwright/test";

import arabic from "../messages/ar.json";
import english from "../messages/en.json";
import malayalam from "../messages/ml.json";
import tamil from "../messages/ta.json";
import urdu from "../messages/ur.json";
import {
  ALL_GUIDE_KEYS,
  HELP_ROLES,
  rolesWithGuide,
  slugFor,
} from "../src/components/help/content";
import { localeMeta, locales } from "../src/i18n/locales";

const headerSizes = [320, 390, 640, 768, 1024, 1280, 1440].map((width) => ({
  width,
  links: width < 1280 ? 1 : 7,
  // Appearance plus menu/language; tablet and desktop also expose page switcher.
  buttons: width < 640 ? 2 : 3,
  navigation: width < 1280 ? 0 : 1,
}));
const publicRoutes = [
  "",
  "/how-it-works",
  "/participants",
  "/prices",
  "/standards",
  "/solar",
  "/join",
  "/contact",
  "/help",
  "/help/contact",
  "/sell",
  "/no-such-public-page",
];
const roleRoutes = HELP_ROLES.map((role) => `/help/${role}`);
// Every distinct guide is exercised with a role that publishes that content.
const guideRoutes = ALL_GUIDE_KEYS.map((key) => {
  const role = rolesWithGuide(key).at(0);
  if (!role) throw new Error(`Guide ${key} has no public role`);
  return `/help/${role}/${slugFor(key)}`;
});

async function expectHeaderToFit(page: Page) {
  const header = page.getByRole("banner");
  await expect(header).toBeVisible();
  await expect
    .poll(
      async () =>
        header.evaluate((element) => {
          const controls = [...element.querySelectorAll("a[href], button")]
            .map((control) => {
              const rect = control.getBoundingClientRect();
              const clippedText: string[] = [];
              const walker = document.createTreeWalker(
                control,
                NodeFilter.SHOW_TEXT,
              );
              let node = walker.nextNode();
              while (node) {
                if (node.textContent?.trim()) {
                  const range = document.createRange();
                  range.selectNodeContents(node);
                  for (const textRect of range.getClientRects()) {
                    if (
                      textRect.width > 0 &&
                      (textRect.left < rect.left - 1 ||
                        textRect.right > rect.right + 1)
                    )
                      clippedText.push(node.textContent);
                  }
                }
                node = walker.nextNode();
              }
              return {
                label:
                  control.getAttribute("aria-label") ??
                  control.textContent.trim(),
                left: rect.left,
                right: rect.right,
                top: rect.top,
                bottom: rect.bottom,
                width: rect.width,
                height: rect.height,
                center: rect.top + rect.height / 2,
                clippedText,
              };
            })
            .filter((control) => control.width > 0 && control.height > 0);
          const issues: string[] = [];
          const centers = controls.map((control) => control.center);
          if (Math.max(...centers) - Math.min(...centers) > 1) {
            issues.push("Header controls occupy more than one row");
          }
          for (const [index, control] of controls.entries()) {
            if (control.clippedText.length > 0) {
              issues.push(`${control.label} text extends outside its control`);
            }
            if (control.left < -1 || control.right > innerWidth + 1) {
              issues.push(`${control.label} extends outside the viewport`);
            }
            const otherControls = controls.slice(index + 1);
            for (const other of otherControls) {
              const overlapWidth =
                Math.min(control.right, other.right) -
                Math.max(control.left, other.left);
              const overlapHeight =
                Math.min(control.bottom, other.bottom) -
                Math.max(control.top, other.top);
              if (overlapWidth > 1 && overlapHeight > 1) {
                issues.push(`${control.label} overlaps ${other.label}`);
              }
            }
          }
          return issues.length > 0 ? { issues, controls } : { issues };
        }),
      { message: "Header controls must fit on one row without overlap" },
    )
    .toEqual({ issues: [] });
}

async function expectPageToFit(page: Page) {
  await page.evaluate(async () => document.fonts.ready);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth - innerWidth,
    ),
    `${new URL(page.url()).pathname} must not scroll horizontally`,
  ).toBeLessThanOrEqual(1);
  await expectHeaderToFit(page);
}

async function expectControlTextToFit(control: Locator) {
  await control.scrollIntoViewIfNeeded();
  await expect(control).toBeInViewport();
  const outside = await control.evaluate((element) => {
    const bounds = element.getBoundingClientRect();
    const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
    const clipped: string[] = [];
    let node = walker.nextNode();
    while (node) {
      if (node.textContent?.trim()) {
        const range = document.createRange();
        range.selectNodeContents(node);
        for (const rect of range.getClientRects()) {
          if (
            rect.width > 0 &&
            (rect.left < bounds.left - 1 ||
              rect.right > bounds.right + 1 ||
              rect.top < bounds.top - 1 ||
              rect.bottom > bounds.bottom + 1)
          )
            clipped.push(node.textContent);
        }
      }
      node = walker.nextNode();
    }
    return clipped;
  });
  expect(outside, "Menu control labels must stay within their control").toEqual(
    [],
  );
}

for (const locale of locales) {
  test(`${locale} header stays on one row across phone tablet and desktop widths`, async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto(`/${locale}`, { waitUntil: "domcontentloaded" });
    await expect(page.locator("html")).toHaveAttribute(
      "lang",
      localeMeta[locale].hreflang,
    );
    for (const size of headerSizes) {
      await test.step(`${String(size.width)}px`, async () => {
        await page.setViewportSize({ width: size.width, height: 900 });
        await expectPageToFit(page);
        const header = page.getByRole("banner");
        await expect(header.getByRole("link")).toHaveCount(size.links);
        await expect(header.getByRole("button")).toHaveCount(size.buttons);
        await expect(header.getByRole("navigation")).toHaveCount(
          size.navigation,
        );
      });
    }
  });
}

for (const width of [320, 768, 1440]) {
  for (const group of [
    { label: "public routes", routes: publicRoutes },
    { label: "role help pages", routes: roleRoutes },
    { label: "all guide variants", routes: guideRoutes },
  ]) {
    test(`${group.label} fit at ${String(width)}px`, async ({ page }) => {
      test.setTimeout(90_000);
      await page.setViewportSize({ width, height: 900 });
      await page.emulateMedia({ reducedMotion: "reduce" });
      for (const route of group.routes) {
        await test.step(route || "home", async () => {
          const response = await page.goto(`/en${route}`, {
            waitUntil: "domcontentloaded",
          });
          expect(response?.status()).toBe(
            route === "/no-such-public-page" ? 404 : 200,
          );
          await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
          await expectPageToFit(page);
        });
      }
    });
  }
}

// Every locale exercises the main page bodies as well as the compact header.
// Translation length and script metrics can break a layout that fits English.
for (const locale of locales) {
  test(`${locale} main pages fit on phones and tablets`, async ({ page }) => {
    test.setTimeout(90_000);
    await page.emulateMedia({ reducedMotion: "reduce" });
    for (const width of [320, 768]) {
      await page.setViewportSize({ width, height: 900 });
      for (const route of publicRoutes) {
        await test.step(`${String(width)}px ${route || "home"}`, async () => {
          const response = await page.goto(`/${locale}${route}`, {
            waitUntil: "domcontentloaded",
          });
          expect(response?.status()).toBe(
            route === "/no-such-public-page" ? 404 : 200,
          );
          await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
          await expectPageToFit(page);
        });
      }
    }
  });
}

for (const { locale, copy } of [
  { locale: "en", copy: english },
  { locale: "ta", copy: tamil },
  { locale: "ml", copy: malayalam },
  { locale: "ar", copy: arabic },
  { locale: "ur", copy: urdu },
] as const) {
  for (const width of [320, 768]) {
    test(`${locale} side menu keeps navigation and settings usable at ${String(width)}x480`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height: 480 });
      await page.emulateMedia({ reducedMotion: "reduce" });
      await page.goto(`/${locale}`);
      const trigger = page.getByRole("banner").getByRole("button", {
        name: copy.nav.openMenu,
        exact: true,
      });
      await expect(trigger).toBeEnabled();
      await trigger.focus();
      await expect(trigger).toBeFocused();
      await page.keyboard.press("Enter");
      const menu = page.getByRole("dialog");
      await expect(menu).toBeVisible();
      await expect
        .poll(() =>
          menu.evaluate((element) => element.contains(document.activeElement)),
        )
        .toBe(true);
      const theme = menu.getByRole("button", {
        name: copy.theme.label,
        exact: true,
      });
      const language = menu.getByRole("button", {
        name: `${copy.common.language}: ${localeMeta[locale].label}`,
        exact: true,
      });
      for (const control of [
        menu.getByRole("link", { name: copy.auth.metaTitle, exact: true }),
        menu.getByRole("link", { name: copy.nav.sellScrap, exact: true }),
        language,
      ]) {
        await expectControlTextToFit(control);
      }
      expect(
        await menu.evaluate(
          (element) => element.scrollWidth - element.clientWidth,
        ),
      ).toBeLessThanOrEqual(1);
      await expect(theme).toHaveCount(0);
      await page.emulateMedia({ colorScheme: "dark" });
      await expect(page.locator("html")).toHaveClass(/dark/u);
      await language.click();
      await expect(page.getByRole("menuitemradio")).toHaveCount(locales.length);
      await page.keyboard.press("Escape");
      await expect(language).toBeFocused();
      await page.keyboard.press("Escape");
      await expect(menu).toBeHidden();
      await expect(trigger).toBeFocused();
      await page.keyboard.press("Enter");
      await expect(menu).toBeVisible();
      const destination = menu.getByRole("link", {
        name: copy.nav.howItWorks,
        exact: true,
      });
      await destination.focus();
      await page.keyboard.press("Enter");
      await expect(page).toHaveURL(
        locale === "en" ? "/how-it-works" : `/${locale}/how-it-works`,
      );
      await expect(menu).toBeHidden();
      await expectPageToFit(page);
    });
  }
}

test("resizing an open compact menu restores desktop navigation", async ({
  page,
}) => {
  await page.setViewportSize({ width: 768, height: 800 });
  await page.goto("/how-it-works");
  await page
    .getByRole("button", { name: english.nav.openMenu, exact: true })
    .click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.setViewportSize({ width: 1440, height: 900 });
  await expect(page.getByRole("dialog")).toBeHidden();
  await expect(
    page
      .getByRole("banner")
      .getByRole("link", { name: english.nav.prices, exact: true }),
  ).toBeVisible();
  await expectPageToFit(page);
  await page.setViewportSize({ width: 768, height: 800 });
  const trigger = page.getByRole("button", {
    name: english.nav.openMenu,
    exact: true,
  });
  await expect(trigger).toBeVisible();
  await trigger.click();
  await expect(page.getByRole("dialog")).toBeVisible();
});
