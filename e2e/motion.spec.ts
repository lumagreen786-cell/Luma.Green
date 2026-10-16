import { expect, type Locator, test } from "@playwright/test";

import english from "../messages/en.json";

async function pauseLogoAtMidSpin(mark: Locator) {
  await expect
    .poll(async () =>
      mark.evaluate((element) => element.getAnimations().length),
    )
    .toBe(1);
  const spin = await mark.evaluate((element) => {
    const animation = element.getAnimations().at(0);
    const timing = animation?.effect?.getTiming();
    if (!animation || !timing || typeof timing.duration !== "number")
      return null;
    animation.pause();
    animation.currentTime = timing.duration / 2;
    return {
      iterations: timing.iterations,
      rotated: !new DOMMatrixReadOnly(getComputedStyle(element).transform)
        .isIdentity,
    };
  });
  expect(spin).toEqual({ iterations: 1, rotated: true });
}

async function finishLogoSpin(mark: Locator) {
  await mark.evaluate((element) => {
    for (const animation of element.getAnimations()) animation.finish();
  });
  await expect(mark).toHaveCSS("transform", "none");
}

test("the logo mark spins once on hover and keyboard focus while its name stays still", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.goto("/en");
  const header = page.getByRole("banner");
  const mark = header.getByRole("img", { name: "Luma.Green", exact: true });
  const wordmark = header.getByText("Luma.Green", { exact: true });
  const homeLink = header.getByRole("link", { name: "Home", exact: true });
  await expect(mark).toHaveCSS("transform", "none");
  await mark.hover();
  await pauseLogoAtMidSpin(mark);
  await expect(wordmark).toHaveCSS("transform", "none");
  await finishLogoSpin(mark);

  await page.mouse.move(1400, 850);
  await page.keyboard.press("Tab");
  await expect(
    page.getByRole("link", { name: "Skip to content" }),
  ).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(homeLink).toBeFocused();
  expect(
    await homeLink.evaluate((element) => element.matches(":focus-visible")),
  ).toBe(true);
  await pauseLogoAtMidSpin(mark);
  await expect(wordmark).toHaveCSS("transform", "none");
  await finishLogoSpin(mark);
});

test("reduced motion prevents logo spins and cancels one already in progress", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/en");
  const header = page.getByRole("banner");
  const mark = header.getByRole("img", { name: "Luma.Green", exact: true });
  const homeLink = header.getByRole("link", { name: "Home", exact: true });
  await mark.hover();
  await expect(mark).toHaveCSS("animation-name", "none");
  await expect(mark).toHaveCSS("transform", "none");
  expect(await mark.evaluate((element) => element.getAnimations().length)).toBe(
    0,
  );

  await page.mouse.move(1400, 850);
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await mark.hover();
  await pauseLogoAtMidSpin(mark);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect(mark).toHaveCSS("transform", "none");
  expect(await mark.evaluate((element) => element.getAnimations().length)).toBe(
    0,
  );

  await page.mouse.move(1400, 850);
  await page.keyboard.press("Tab");
  await page.keyboard.press("Tab");
  await expect(homeLink).toBeFocused();
  await expect(mark).toHaveCSS("animation-name", "none");
  await expect(mark).toHaveCSS("transform", "none");
});

test.describe("home content without JavaScript", () => {
  test.use({ javaScriptEnabled: false });

  test("keeps headings and primary links visible", async ({ page }) => {
    await page.goto("/en");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(
      page
        .getByRole("main")
        .getByRole("link", { name: english.nav.sellScrap, exact: true })
        .first(),
    ).toBeVisible();
    await expect(page.getByRole("heading", { level: 2 }).first()).toHaveCSS(
      "opacity",
      "1",
    );
  });
});

test("reduced motion keeps Arabic content still and controls usable", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/ar");
  await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
  const heading = page.getByRole("heading", { level: 1 });
  await expect(heading).toBeVisible();
  await expect(heading).toHaveCSS("transform", "none");
  const action = page.getByRole("main").getByRole("link").first();
  await action.focus();
  await expect(action).toBeFocused();
  await expect(action).toHaveCSS("transition-duration", "0s");
  expect(
    await action.evaluate((element) => element.getBoundingClientRect().height),
  ).toBeGreaterThanOrEqual(44);
});

test("motion leaves no hidden content after navigation and preference changes", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.goto("/en");
  const heading = page.getByRole("heading", { level: 1 });
  await expect(heading).toBeVisible();
  const reveal = page.locator("#roles-heading");
  await reveal.scrollIntoViewIfNeeded();
  await expect(reveal).toBeVisible();
  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect(reveal).toHaveCSS("transform", "none");
  await expect(reveal).toHaveCSS("opacity", "1");
  await expect(heading).toHaveCSS("transform", "none");
  await expect(heading).toHaveCSS("opacity", "1");
  await page
    .getByRole("main")
    .getByRole("link", { name: english.nav.sellScrap, exact: true })
    .first()
    .click();
  await expect(page).toHaveURL(/\/sell$/u);
  await page.goBack();
  await expect(heading).toBeVisible();
  await expect(heading).toHaveCSS("transform", "none");
});

test("hero image stays stable while scrolling and booking remains available", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/en");
  const hero = page.getByRole("region", {
    name: english.home.hero.title,
  });
  const artwork = hero.locator("img");
  await expect(artwork).toBeVisible();
  await expect(artwork).toHaveCSS("transform", "none");
  await page.evaluate(() => {
    window.scrollTo(0, 450);
  });
  await expect(artwork).toHaveCSS("transform", "none");
  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect(artwork).toHaveCSS("transform", "none");
  await hero
    .getByRole("link", { name: english.nav.sellScrap, exact: true })
    .click();
  await expect(page).toHaveURL(/\/sell$/u);
});

for (const locale of ["en", "ar"]) {
  test(`small-screen artwork and public pages stay within the ${locale} viewport`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: 360, height: 800 });
    await page.emulateMedia({ reducedMotion: "reduce" });
    for (const route of [
      "",
      "/how-it-works",
      "/participants",
      "/prices",
      "/sell",
      "/join",
    ]) {
      await page.goto(`/${locale}${route}`);
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - window.innerWidth,
      );
      expect(
        overflow,
        `${locale}${route} must not scroll horizontally`,
      ).toBeLessThanOrEqual(1);
    }
  });
}
