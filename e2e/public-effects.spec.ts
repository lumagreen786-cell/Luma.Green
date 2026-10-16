import { expect, test } from "@playwright/test";

import arabic from "../messages/ar.json";
import english from "../messages/en.json";
import { actionName } from "../src/components/site/action-name";
import { locales } from "../src/i18n/locales";

const languages = [
  { locale: "en", messages: english },
  { locale: "ar", messages: arabic },
] as const;

for (const { locale, messages } of languages) {
  for (const colorScheme of ["light", "dark"] as const) {
    for (const width of [390, 768]) {
      test(`${locale} public effects keep content readable at ${String(width)}px in ${colorScheme}`, async ({
        page,
      }) => {
        await page.setViewportSize({ width, height: 900 });
        await page.emulateMedia({ colorScheme, reducedMotion: "reduce" });

        for (const content of [
          { route: "", title: messages.home.hero.title },
          { route: "/how-it-works", title: messages.howItWorks.title },
          { route: "/join", title: messages.join.title },
        ]) {
          await page.goto(`/${locale}${content.route}`);
          await page.evaluate(async () => document.fonts.ready);
          const heading = page.getByRole("heading", { level: 1 });
          await expect(heading).toHaveText(content.title);
          await expect(heading).toBeVisible();
          await expect(heading).toHaveCSS("opacity", "1");
          await expect(heading).toHaveCSS("transform", "none");
          await expect(heading).toHaveCSS("animation-name", "none");
          expect(
            await page.evaluate(() => document.documentElement.scrollWidth),
          ).toBeLessThanOrEqual(width);
        }

        await page.goto(`/${locale}`);
        for (const content of [messages.home.hero, messages.home.closing]) {
          const region = page.getByRole("region", { name: content.title });
          await expect(region).toHaveCSS("background-image", "none");
          const action = region.getByRole("link", {
            name: actionName(messages.nav.sellScrap, content.sell),
            exact: true,
          });
          await action.focus();
          await expect(action).toBeFocused();
          await expect(action).toHaveAttribute("href", /\/sell$/);
          expect(
            await action.evaluate(
              (element) => getComputedStyle(element, "::before").animationName,
            ),
          ).toBe("none");
        }

        const testimonials = page.getByRole("region", {
          name: messages.home.testimonials.title,
        });
        await expect(testimonials).toHaveCSS("background-image", "none");
        await testimonials.scrollIntoViewIfNeeded();
        await expect(
          testimonials.getByText(messages.home.testimonials.note),
        ).toBeVisible();
        const quotes = await testimonials.locator("blockquote").all();
        for (const quote of quotes) {
          await expect(quote).toHaveCSS("opacity", "1");
          await expect(quote).toHaveCSS("transform", "none");
          await expect(quote).toHaveCSS("animation-name", "none");
        }
      });
    }
  }
}

test("public motion keeps headings readable and collection actions usable", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.goto("/how-it-works");
  const animatedHeading = page.getByRole("heading", { level: 1 });
  await expect(animatedHeading).toHaveText(english.howItWorks.title);
  await expect(animatedHeading).toHaveCSS("animation-name", /heading-arrive/);
  await expect(animatedHeading).toHaveCSS("opacity", "1");
  await expect(animatedHeading).toHaveCSS("transform", "none");

  await page.goto("/");
  const heading = page.getByRole("heading", { level: 1 });
  await expect(heading).toHaveText(english.home.hero.title);
  await expect(heading).toHaveCSS("animation-name", "none");
  await expect(heading).toHaveCSS("opacity", "1");
  await expect(heading).toHaveCSS("transform", "none");
  const action = page
    .getByRole("region", { name: english.home.hero.title })
    .getByRole("link", {
      name: actionName(english.nav.sellScrap, english.home.hero.sell),
      exact: true,
    });
  await action.focus();
  await expect(action).toBeFocused();
  expect(
    await action.evaluate(
      (element) => getComputedStyle(element, "::before").animationName,
    ),
  ).toBe("none");
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/sell$/);

  await page.goto("/");
  const closingAction = page
    .getByRole("region", { name: english.home.closing.title })
    .getByRole("link", {
      name: actionName(english.nav.sellScrap, english.home.closing.sell),
      exact: true,
    });
  await closingAction.focus();
  await expect(closingAction).toBeFocused();
  expect(
    await closingAction.evaluate(
      (element) => getComputedStyle(element, "::before").animationName,
    ),
  ).toBe("none");
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/sell$/);
});

for (const locale of locales) {
  test(`${locale} public buttons keep complete labels on one line`, async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    for (const route of ["", "/help", "/help/contact"]) {
      for (const width of [320, 640, 1024]) {
        await page.setViewportSize({ width, height: 900 });
        await page.goto(`/${locale}${route}`);
        await page.evaluate(async () => document.fonts.ready);
        const failures = await page
          .locator('main [data-slot="button"]')
          .evaluateAll((buttons) =>
            buttons.flatMap((button) => {
              const bounds = button.getBoundingClientRect();
              const lines: number[] = [];
              let isClipped = false;
              const walker = document.createTreeWalker(
                button,
                NodeFilter.SHOW_TEXT,
              );
              for (
                let node = walker.nextNode();
                node;
                node = walker.nextNode()
              ) {
                if (
                  !node.textContent?.trim() ||
                  node.parentElement?.closest('.sr-only, [aria-hidden="true"]')
                )
                  continue;
                const range = document.createRange();
                range.selectNodeContents(node);
                for (const rect of range.getClientRects()) {
                  if (lines.every((top) => Math.abs(top - rect.top) >= 3))
                    lines.push(rect.top);
                  if (
                    rect.left < bounds.left ||
                    rect.right > bounds.right ||
                    rect.top < bounds.top ||
                    rect.bottom > bounds.bottom
                  )
                    isClipped = true;
                }
              }
              return isClipped || lines.length > 1
                ? [button.getAttribute("aria-label") ?? button.textContent]
                : [];
            }),
          );
        expect(
          failures,
          `${locale}${route} buttons at ${String(width)}px`,
        ).toEqual([]);
        const namedActions = await page
          .locator('main a[data-slot="button"][aria-label]')
          .evaluateAll((buttons) =>
            buttons.map((button) => ({
              name: button.getAttribute("aria-label") ?? "",
              visible:
                button instanceof HTMLElement
                  ? // Hidden responsive labels must not count as visible text.
                    // eslint-disable-next-line unicorn/prefer-dom-node-text-content
                    button.innerText.replaceAll(/\s+/gu, " ").trim()
                  : "",
            })),
          );
        const expectedActions = { "": 4, "/help": 0, "/help/contact": 2 };
        expect(namedActions).toHaveLength(
          expectedActions[route as keyof typeof expectedActions],
        );
        for (const action of namedActions) {
          expect(action.visible).not.toBe("");
          expect(action.name.replaceAll(/\s+/gu, " ")).toContain(
            action.visible,
          );
        }
      }
    }
  });
}
