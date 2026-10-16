import { expect, type Locator, test } from "@playwright/test";

import english from "../messages/en.json";
import kannada from "../messages/kn.json";
import malayalam from "../messages/ml.json";
import tamil from "../messages/ta.json";
import { actionName } from "../src/components/site/action-name";

const routes = [
  "/",
  "/participants",
  "/how-it-works",
  "/standards",
  "/prices",
  "/solar",
  "/help",
  "/help/household",
  "/help/contact",
  "/contact",
  "/join",
  "/login",
  "/sell",
  "/admin/login",
  "/admin/setup",
] as const;

async function expectActionTextToFit(action: Locator) {
  await expect(action).toBeVisible();
  const overflow = await action.evaluate((element) => {
    const button = element.getBoundingClientRect();
    const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
    const outside: string[] = [];
    let node = walker.nextNode();
    while (node) {
      if (node.textContent?.trim()) {
        const range = document.createRange();
        range.selectNodeContents(node);
        for (const rect of range.getClientRects()) {
          if (
            rect.left < button.left - 1 ||
            rect.right > button.right + 1 ||
            rect.top < button.top - 1 ||
            rect.bottom > button.bottom + 1
          ) {
            outside.push(node.textContent);
          }
        }
      }
      node = walker.nextNode();
    }
    return {
      outside,
      fitsViewport: button.left >= -1 && button.right <= innerWidth + 1,
    };
  });
  expect(
    overflow,
    "Action labels must remain inside their visible buttons",
  ).toEqual({
    outside: [],
    fitsViewport: true,
  });
}

for (const { locale, copy } of [
  { locale: "ta", copy: tamil },
  { locale: "ml", copy: malayalam },
]) {
  test(`${locale} action labels fit their buttons at 320px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: 320, height: 740 });
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto(`/${locale}`);
    await expect(
      page.getByRole("heading", { level: 1, name: copy.home.hero.title }),
    ).toBeVisible();
    await page.evaluate(async () => document.fonts.ready);
    for (const { content, labels } of [
      {
        content: copy.home.hero,
        labels: [
          actionName(copy.nav.sellScrap, copy.home.hero.sell),
          copy.home.hero.prices,
          copy.home.hero.join,
        ],
      },
    ]) {
      const section = page.getByRole("region", {
        name: content.title,
        exact: true,
      });
      for (const label of labels) {
        await expectActionTextToFit(
          section.getByRole("link", { name: label, exact: true }),
        );
      }
    }

    await page.goto(`/${locale}/login`);
    await page
      .getByRole("button", { name: copy.auth.continue, exact: true })
      .click();
    await page.evaluate(async () => document.fonts.ready);
    await expectActionTextToFit(
      page.getByRole("button", { name: copy.auth.sendCode, exact: true }),
    );
  });
}

test("business choices remain static, readable and keyboard accessible", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  const region = page.getByRole("region", {
    name: english.home.hero.join,
  });
  const links = region.getByRole("link");
  await expect(links).toHaveCount(5);
  const materialLinks = await links.all();
  for (const link of materialLinks) {
    await expect(link).toHaveCSS("animation-name", "none");
    await link.focus();
    await expect(link).toBeFocused();
    await expect(link).toHaveAttribute("href", /\/join\//);
  }
});

test("mobile navigation shows the brand mark and puts language in the side menu", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/kn");
  const header = page.locator("header").first();
  await expect(header.getByRole("img", { name: "Luma.Green" })).toBeVisible();
  await expect(header.getByText("Luma.Green", { exact: true })).toBeHidden();
  await expect(header.getByRole("button", { name: /ಕನ್ನಡ/ })).toHaveCount(0);
  await header.getByRole("button", { name: kannada.nav.openMenu }).click();
  const menu = page.getByRole("dialog");
  const language = menu.getByRole("button", { name: /ಕನ್ನಡ/ });
  await expect(language).toBeVisible();
  await language.click();
  await expect(
    page.getByRole("menuitemradio", { name: "العربية" }),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(language).toBeFocused();
});

for (const mode of [
  { width: 360, colorScheme: "dark" },
  { width: 1440, colorScheme: "light" },
] as const) {
  for (const route of routes) {
    test(`${route} remains readable at ${String(mode.width)}px in ${mode.colorScheme}`, async ({
      page,
    }) => {
      const errors: string[] = [];
      page.on("pageerror", (error) => {
        errors.push(error.message);
      });
      await page.setViewportSize({ width: mode.width, height: 900 });
      await page.emulateMedia({
        colorScheme: mode.colorScheme,
        reducedMotion: "reduce",
      });
      await page.goto(route);
      await page.evaluate(async () => document.fonts.ready);
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth - window.innerWidth,
        ),
        "The page must fit without horizontal scrolling",
      ).toBeLessThanOrEqual(1);
      const headings = page.getByRole("main").getByRole("heading");
      const clipped = await headings.evaluateAll((elements) =>
        elements
          .filter((element) => element.scrollWidth > element.clientWidth + 1)
          .map((element) => element.textContent),
      );
      expect(
        clipped,
        "Headings must not clip translated or large text",
      ).toEqual([]);
      expect(errors).toEqual([]);
    });
  }
}

for (const width of [360, 390, 768, 1024]) {
  for (const locale of ["ar", "kn", "ta", "ml"]) {
    test(`${locale} home and help fit at ${String(width)}px`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.emulateMedia({ reducedMotion: "reduce" });
      for (const route of ["", "/help", "/join"]) {
        await page.goto(`/${locale}${route}`);
        await page.evaluate(async () => document.fonts.ready);
        await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
        expect(
          await page.evaluate(
            () => document.documentElement.scrollWidth - window.innerWidth,
          ),
        ).toBeLessThanOrEqual(1);
      }
    });
  }
}
