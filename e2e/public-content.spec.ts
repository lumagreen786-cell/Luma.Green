import { expect, test } from "@playwright/test";

import ar from "../messages/ar.json";
import en from "../messages/en.json";
import ml from "../messages/ml.json";
import ta from "../messages/ta.json";

test("the chain page leads from preparation details to the complete guide", async ({
  page,
}) => {
  await page.goto("/how-it-works");
  const guide = page.getByRole("region", { name: "Get your materials ready" });
  await expect(
    guide.getByText("Set gadgets and batteries aside"),
  ).toBeVisible();
  await guide.getByRole("link").click();
  await expect(page).toHaveURL("/help/household/get-ready");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Get your materials ready",
  );
});

test("the price explanation stays usable when live prices cannot load", async ({
  page,
}) => {
  await page.goto("/prices");
  await expect(
    page.getByText("Prices aren't available right now"),
  ).toBeVisible();
  await page
    .locator("summary")
    .filter({ hasText: en.help.guides.weighingAtDoor.title })
    .click();
  const guide = page.getByRole("region", {
    name: "Weighing and payment at your door",
  });
  await guide.getByRole("link").click();
  await expect(page).toHaveURL("/help/household/weighing-at-door");
});

test("Arabic help topics preserve the locale on phones", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/ar/help");
  await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
  await page.getByRole("searchbox").fill(ar.help.guides.verifyBusiness.title);
  const guide = page.locator('main a[href="/ar/help/yard/verify-business"]');
  await guide.click();
  await expect(page).toHaveURL("/ar/help/yard/verify-business");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(390);
});

for (const [route, selector] of [
  ["/how-it-works", 'section[aria-labelledby="sorting-guide-heading"] img'],
  ["/prices", 'section[aria-labelledby="price-guide-heading"] img'],
  ["/join", 'main a[href="/join/yard"] img'],
  ["/participants", 'section[aria-labelledby="participant-yard"] img'],
] as const) {
  test(`tablet detail artwork has enough pixels at ${route}`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.goto(route);
    if (route === "/prices")
      await page
        .locator("summary")
        .filter({ hasText: en.help.guides.weighingAtDoor.title })
        .click();
    const image = page.locator(selector);
    await image.scrollIntoViewIfNeeded();
    await expect
      .poll(() =>
        image.evaluate((element: HTMLImageElement) => {
          if (!element.currentSrc) return false;
          const rendered = element.getBoundingClientRect();
          // Direct WebP delivery has no optimizer width parameter. Check the
          // decoded pixels in both axes so object-cover never needs to upscale.
          return (
            element.complete &&
            rendered.width > 0 &&
            rendered.height > 0 &&
            element.naturalWidth >= rendered.width &&
            element.naturalHeight >= rendered.height
          );
        }),
      )
      .toBe(true);
  });
}

for (const [locale, width, prefix, copy] of [
  ["en", 768, "", en],
  ["ta", 320, "/ta", ta],
  ["ml", 320, "/ml", ml],
] as const) {
  test(`the join action fits one line in ${locale} at ${String(width)}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 1024 });
    await page.goto(`${prefix}/join`);
    const link = page.locator(`aside a[href="${prefix}/sell"]`);
    await expect(link).toHaveAccessibleName(copy.nav.sellScrap);
    await link.scrollIntoViewIfNeeded();
    await page.evaluate(() => document.fonts.ready);
    const lines = await link.evaluate((element) => {
      const tops: number[] = [];
      const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
      for (let node = walker.nextNode(); node; node = walker.nextNode()) {
        if (!node.textContent?.trim()) continue;
        const range = document.createRange();
        range.selectNodeContents(node);
        for (const rect of range.getClientRects()) {
          if (tops.every((top) => Math.abs(top - rect.top) > 2))
            tops.push(rect.top);
        }
      }
      return tops.length;
    });
    expect(lines).toBe(1);
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBeLessThanOrEqual(width);
    const bounds = await link.boundingBox();
    expect(bounds).not.toBeNull();
    expect((bounds?.x ?? width) + (bounds?.width ?? width)).toBeLessThanOrEqual(
      width,
    );
    await link.focus();
    await expect(link).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(new RegExp(`${prefix}/sell$`));
  });
}
