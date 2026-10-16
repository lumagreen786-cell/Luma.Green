import { readFileSync } from "node:fs";

import { expect, type Page, test } from "@playwright/test";

import en from "../messages/en.json";
import { localeMeta, locales } from "../src/i18n/locales";

const widths = [320, 390, 640, 768, 1024, 1440] as const;
const languages = locales.map((locale) => ({
  locale,
  copy: JSON.parse(
    readFileSync(`messages/${locale}.json`, "utf8"),
  ) as typeof en,
  direction: localeMeta[locale].dir,
}));

for (const width of [390, 768, 1024, 1440]) {
  test(`join role gallery keeps large images above readable choices at ${String(width)}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/join");
    const recycler = page.getByRole("main").getByRole("link", {
      name: new RegExp(en.join.roles.recycler.title),
    });
    await expect(recycler).toBeVisible();
    await page.evaluate(async () => document.fonts.ready);
    const image = await recycler.locator("figure").boundingBox();
    const title = await recycler
      .getByText(en.join.roles.recycler.title, { exact: true })
      .boundingBox();
    expect(image).not.toBeNull();
    expect(title).not.toBeNull();
    if (!image || !title) throw new Error("Role image and title must render");
    expect(image.width).toBeGreaterThan(200);
    expect(title.y).toBeGreaterThanOrEqual(image.y + image.height);
    await expect(recycler).toHaveAttribute("href", /\/join\/recycler$/);
    await expect(recycler).toContainText(en.join.roles.recycler.body);
    await expectFormToFit(page);
  });
}

/** Check actual text bounds: a hidden overflow rule must not hide a regression. */
async function expectFormToFit(page: Page) {
  await page.evaluate(async () => document.fonts.ready);
  const result = await page.getByRole("main").evaluate((main) => {
    function textFits(element: Element, bounds: DOMRect) {
      const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
      let node = walker.nextNode();
      while (node) {
        const range = document.createRange();
        range.selectNodeContents(node);
        if (
          node.textContent?.trim() &&
          [...range.getClientRects()].some(
            (rect) =>
              rect.width > 0 &&
              (rect.left < bounds.left - 1 || rect.right > bounds.right + 1),
          )
        )
          return false;
        node = walker.nextNode();
      }
      return true;
    }
    const failures: string[] = [];
    const elements = main.querySelectorAll(
      "h1, h2, h3, label, legend, button, [data-slot='button']",
    );
    for (const element of elements) {
      const bounds = element.getBoundingClientRect();
      if (bounds.width <= 1 || bounds.height <= 1) continue;
      const style = getComputedStyle(element);
      if (style.visibility === "hidden" || style.display === "none") continue;
      const label = element.textContent.trim();
      if (bounds.left < -1 || bounds.right > innerWidth + 1) {
        failures.push(`Outside viewport: ${label}`);
      }
      if (!textFits(element, bounds)) failures.push(`Clipped text: ${label}`);
      for (const child of element.querySelectorAll("*")) {
        const childStyle = getComputedStyle(child);
        if (
          childStyle.textOverflow === "ellipsis" &&
          child.clientWidth > 0 &&
          child.scrollWidth > child.clientWidth + 1
        ) {
          failures.push(`Truncated inner label: ${child.textContent.trim()}`);
        }
      }
    }
    return {
      horizontalOverflow: document.documentElement.scrollWidth - innerWidth,
      failures: [...new Set(failures)],
    };
  });
  expect(
    result.horizontalOverflow,
    "The page must not scroll sideways",
  ).toBeLessThanOrEqual(1);
  expect(
    result.failures,
    "Headings, labels and actions must remain visible",
  ).toEqual([]);
}

// These production-route tests exercise the disconnected build. Protected join
// routes must show their sign-in guard; this does not claim authenticated form
// coverage. The isolated documentation harness covers those actual components.
for (const { locale, copy, direction } of languages) {
  for (const width of widths) {
    test(`${locale} unavailable OTP sign-in fits at ${String(width)}px without SMS`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.emulateMedia({ reducedMotion: "reduce" });
      const authRequests: string[] = [];
      await page.route("**/api/auth/**", async (route) => {
        authRequests.push(route.request().url());
        await route.abort();
      });
      await page.goto(`/${locale}/login?next=%2Fjoin%2Fsaathi`);
      await expect(page.locator("html")).toHaveAttribute("dir", direction);
      await expect(page.getByRole("heading", { level: 1 })).toHaveText(
        copy.auth.chooseLanguage,
      );
      await expectFormToFit(page);
      await page
        .getByRole("button", { name: copy.auth.continue, exact: true })
        .click();
      await expect(page.getByRole("heading", { level: 1 })).toHaveText(
        copy.auth.metaTitle,
      );
      await expectFormToFit(page);
      await page
        .getByLabel(copy.auth.mobileLabel, { exact: true })
        .fill("9000000000");
      await expect(
        page.getByRole("button", { name: copy.auth.sendCode, exact: true }),
      ).toBeDisabled();
      await expect(
        page.getByText(copy.auth.unavailableBody, { exact: true }),
      ).toBeVisible();
      await expectFormToFit(page);
      expect(
        authRequests,
        "Unavailable SMS must never make an authentication request",
      ).toEqual([]);
      expect(page.url()).not.toContain("9000000000");
      await page.goto(`/${locale}/login/verify`);
      await expect(page.getByRole("heading", { level: 1 })).toHaveText(
        copy.auth.metaTitle,
      );
      await expect(
        page.getByRole("button", { name: copy.auth.sendCode, exact: true }),
      ).toBeDisabled();
      await expectFormToFit(page);
    });

    test(`${locale} household setup states and join guards fit at ${String(width)}px`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.emulateMedia({ reducedMotion: "reduce" });
      await page.goto(`/${locale}/join`);
      await expect(
        page.getByRole("main").getByRole("link", {
          name: new RegExp(copy.join.roles.kabadiwala.title),
        }),
      ).toBeVisible();
      await expectFormToFit(page);
      for (const route of ["/sell", "/t/responsive-demo-token"]) {
        await test.step(route, async () => {
          await page.goto(`/${locale}${route}`);
          await expect(page.getByRole("main")).toBeVisible();
          await expect(
            page
              .getByRole("main")
              .getByText(copy.sell.unavailable.title, { exact: true }),
          ).toBeVisible();
          await expectFormToFit(page);
        });
      }
      for (const route of [
        "/join/kabadiwala",
        "/join/yard",
        "/join/yard/documents",
        "/join/saathi",
        "/join/status",
      ]) {
        await test.step(`Protected template ${route}`, async () => {
          await page.goto(`/${locale}${route}`);
          await expect(page).toHaveURL(
            new RegExp(String.raw`/login\?next=${encodeURIComponent(route)}$`),
          );
          await expect(page.getByRole("heading", { level: 1 })).toHaveText(
            copy.auth.chooseLanguage,
          );
          await expectFormToFit(page);
        });
      }
    });
  }
}
