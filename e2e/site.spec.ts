import { expect, test } from "@playwright/test";

import ar from "../messages/ar.json";
import en from "../messages/en.json";
import ur from "../messages/ur.json";

/**
 * The public site: home booking and business navigation stay distinct,
 * supporting routes remain available, and pages keep their locale when
 * navigating or switching language, and lay out right-to-left in /ar.
 *
 * Playwright runs without Convex (playwright.config.ts), so live panels
 * show their "not connected" state; the solar calculator is pure and runs
 * in full.
 */

// Pages other areas own are only checked for a heading and the title suffix,
// so their copy can change without breaking this suite.
const pages = [
  {
    path: "/how-it-works",
    link: "How it works",
    heading: /\S/,
    title: /· Luma\.Green$/,
  },
  {
    path: "/prices",
    link: "Prices",
    heading: "Material prices",
    title: `${en.prices.metaTitle} · Luma.Green`,
  },
  { path: "/help", link: "Help", heading: /\S/, title: /· Luma\.Green$/ },
  {
    path: "/join",
    link: "Join",
    heading: en.join.title,
    title: "Join Luma.Green · Luma.Green",
  },
] as const satisfies readonly {
  path: string;
  link: string;
  heading: string | RegExp;
  title: string | RegExp;
}[];

test("home offers direct booking, a business path and useful pickup guidance", async ({
  page,
}) => {
  await page.goto("/");
  const main = page.getByRole("main");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    en.afterlife.heroTitle + en.afterlife.heroTitleEnd,
  );
  await expect(
    main
      .getByRole("button", { name: en.afterlife.bookNow, exact: true })
      .first(),
  ).toBeDisabled();
  await expect(
    main.getByRole("link", { name: en.afterlife.workWith, exact: true }),
  ).toHaveAttribute("href", "/business");
  await expect(page.locator("#how")).toContainText(en.afterlife.phoneTitle);
  await expect(page.locator("#questions")).toContainText(en.afterlife.faqTitle);
  await expect(page).toHaveTitle("Luma.Green — Cleaner Tomorrow in Motion");
  await expect(main.locator("[data-product-preview]")).toHaveCount(0);
  await expect(main.locator("#demo-testimonials-heading")).toHaveCount(0);
});

test("home booking has no form or intermediate popup", async ({ page }) => {
  await page.goto("/");
  await expect(
    page
      .getByRole("main")
      .locator('form,input,textarea,select,[contenteditable="true"]'),
  ).toHaveCount(0);
  await expect(page.getByRole("dialog")).toHaveCount(0);
});

for (const item of pages) {
  test(`public route ${item.path} keeps its title and main heading`, async ({
    page,
  }) => {
    await page.goto(item.path);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      item.heading,
    );
    await expect(page).toHaveTitle(item.title);
  });
}

test("home header links reach pickup guidance and the business site", async ({
  page,
}) => {
  await page.goto("/");
  const header = page.getByRole("banner");
  await header
    .getByRole("link", { name: en.afterlife.how, exact: true })
    .click();
  await expect(page).toHaveURL(/#how$/);
  await header
    .getByRole("link", { name: en.afterlife.business, exact: true })
    .click();
  await expect(page).toHaveURL("/business");
  await expect(
    header.getByRole("link", { name: en.afterlife.signIn, exact: true }),
  ).toHaveAttribute("href", "/login");
  await header
    .getByRole("link", { name: en.afterlife.collectors, exact: true })
    .click();
  await expect(page).toHaveURL("/business/collectors");
});

test("the footer leads to help, privacy and service status", async ({
  page,
}) => {
  await page.goto("/");
  const footer = page.getByRole("contentinfo");
  for (const [name, href] of [
    [en.afterlife.help, "/help"],
    [en.afterlife.privacy, "/privacy"],
    [en.afterlife.status, "/status"],
  ]) {
    await expect(
      footer.getByRole("link", { name, exact: true }),
    ).toHaveAttribute("href", href);
  }
});

test("the price board explains itself when prices can't load", async ({
  page,
}) => {
  await page.goto("/prices");

  await expect(page.getByText(en.prices.unavailable.title)).toBeVisible();
  await expect(
    page.getByRole("main").getByRole("link", { name: en.nav.sellScrap }),
  ).toHaveAttribute("href", "/sell");
});

test("the standard lays out every norm, with a jump list", async ({ page }) => {
  await page.goto("/standards");

  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "The Luma.Green standard",
  );
  await expect(page).toHaveTitle("The Luma.Green standard · Luma.Green");
  for (const heading of [
    "One code for every material",
    "Grading: dry, sorted, clean",
    "Fair weighing",
    "Receipts and chain of custody",
    "Verification",
    en.standards.escrow.title,
  ]) {
    await expect(
      page.getByRole("heading", { name: heading, level: 2 }),
    ).toBeVisible();
  }

  await page
    .getByRole("navigation", { name: "On this page" })
    .getByRole("link", { name: en.standards.escrow.nav, exact: true })
    .click();
  await expect(page).toHaveURL(/#escrow$/);
  await expect(page.locator("details#escrow")).toHaveAttribute("open", "");
  await expect(
    page.getByText(en.standards.escrow.body, { exact: true }),
  ).toBeVisible();
  await expect(page.locator("#escrow")).not.toContainText("simulated escrow");
});

test("the solar calculator estimates a home system and cites the scheme", async ({
  page,
}) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await page.goto("/solar");

  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Rooftop solar for your home or business",
  );
  await page
    .getByRole("textbox", { name: "Monthly electricity bill" })
    .fill("3000");

  await expect(page.getByText("3.5 kW", { exact: true })).toBeVisible();
  await expect(page.getByText("− ₹78,000")).toBeVisible();
  await expect(page.getByText("3.2–4.2 years")).toBeVisible();
  await page
    .locator("summary")
    .filter({ hasText: en.solar.subsidy.title })
    .click();
  await expect(
    page.getByRole("link", { name: /pmsuryaghar\.gov\.in/ }),
  ).toHaveAttribute("href", "https://pmsuryaghar.gov.in");

  const business = page.getByRole("radio", { name: "My business" });
  expect(
    await business.evaluate((element) => {
      const label = element.closest("label");
      return label ? label.scrollWidth <= label.clientWidth : false;
    }),
  ).toBe(true);
  await business.click();
  await expect(page.getByText("Not for businesses")).toBeVisible();
});

test("each page canonicalises to its own locale", async ({ page }) => {
  await page.goto("/ta/prices");

  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
    "href",
    /\/ta\/prices$/,
  );
  await expect(page.locator('link[hreflang="x-default"]')).toHaveAttribute(
    "href",
    /\/prices$/,
  );
});

test("switching language keeps the current page", async ({ page }) => {
  await page.goto("/prices");

  await page.getByRole("button", { name: "Language: English" }).click();
  await page.getByRole("menuitemradio", { name: "தமிழ்" }).click();

  await expect(page).toHaveURL("/ta/prices");
  await expect(page.locator("html")).toHaveAttribute("lang", "ta-IN");
});

test("links stay inside the active locale", async ({ page }) => {
  await page.goto("/hi");

  await expect(
    page.getByRole("banner").getByRole("link").first(),
  ).toHaveAttribute("href", "/hi");
  await expect(
    page.getByRole("main").getByRole("link", { name: /./ }).last(),
  ).toHaveAttribute("href", /^\/hi\//);
});

test("Arabic pages lay out right-to-left", async ({ page }) => {
  await page.goto("/ar/prices");

  await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
  const header = page.getByRole("banner");
  const logo = await header.getByRole("link").first().boundingBox();
  const viewport = page.viewportSize();

  expect(logo).not.toBeNull();
  expect(viewport).not.toBeNull();
  // The logo sits on the inline start, which is the right edge in RTL.
  expect((logo?.x ?? 0) + (logo?.width ?? 0) / 2).toBeGreaterThan(
    (viewport?.width ?? 0) / 2,
  );
});

test("mobile menu opens, navigates and closes", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");

  const toggle = page.getByRole("button", {
    name: en.afterlife.menu,
    exact: true,
  });
  await toggle.click();
  const menu = page
    .getByRole("banner")
    .getByRole("navigation", { name: en.afterlife.menu });
  await expect(menu).toBeVisible();
  await expect(toggle).toHaveAttribute("aria-expanded", "true");
  await menu
    .getByRole("link", { name: en.afterlife.business, exact: true })
    .click();
  await expect(page).toHaveURL("/business");
  await expect(menu).toBeHidden();
  await expect(toggle).toHaveAttribute("aria-expanded", "false");
});

test("unknown pages get the localised 404 inside the site shell", async ({
  page,
}) => {
  const response = await page.goto("/ta/no-such-page");

  expect(response?.status()).toBe(404);
  await expect(page.getByRole("banner")).toBeVisible();
  await expect(page.locator("html")).toHaveAttribute("lang", "ta-IN");
  await expect(page.getByRole("link", { name: /./ }).last()).toBeVisible();
});

test("the skip link jumps past the header", async ({ page }) => {
  await page.goto("/");
  await page.keyboard.press("Tab");

  const skip = page.getByRole("link", { name: "Skip to content" });
  await expect(skip).toBeFocused();
  await skip.press("Enter");
  await expect(page).toHaveURL(/#main$/);
  await expect(page.getByRole("main")).toBeFocused();
});

test("language changes preserve a page query and help anchor", async ({
  page,
}) => {
  await page.goto("/help?role=yard#contact");
  await page.getByRole("button", { name: "Language: English" }).click();
  await page.getByRole("menuitemradio", { name: "தமிழ்" }).click();
  await expect(page).toHaveURL("/ta/help?role=yard#contact");
});

for (const locale of ["en", "ar", "ur"] as const) {
  test(`${locale} mobile menu supports keyboard opening and closing`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: 360, height: 700 });
    await page.goto(locale === "en" ? "/" : `/${locale}`);
    const label = { en, ar, ur }[locale].afterlife.menu;
    const trigger = page
      .getByRole("banner")
      .getByRole("button", { name: label, exact: true });
    const menu = page
      .getByRole("banner")
      .getByRole("navigation", { name: label });
    await trigger.focus();
    await page.keyboard.press("Enter");
    await expect(menu).toBeVisible();
    await expect(trigger).toHaveAttribute("aria-expanded", "true");
    await page.keyboard.press("Escape");
    await expect(menu).toBeHidden();
    await expect(trigger).toBeFocused();
    await page.keyboard.press("Space");
    await expect(menu).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(trigger).toBeFocused();
  });

  test(`${locale} navigation fits phones and tablets with accessible targets`, async ({
    page,
  }) => {
    for (const width of [360, 768, 1000]) {
      await page.setViewportSize({ width, height: 700 });
      await page.goto(locale === "en" ? "/" : `/${locale}`);
      const label = { en, ar, ur }[locale].afterlife.menu;
      const header = page.getByRole("banner");
      const menuButton = header.getByRole("button", {
        name: label,
        exact: true,
      });
      const target = await menuButton.boundingBox();
      expect(target?.width).toBeGreaterThanOrEqual(44);
      expect(target?.height).toBeGreaterThanOrEqual(44);
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth),
      ).toBeLessThanOrEqual(width);
      await menuButton.click();
      const menu = header.getByRole("navigation", { name: label });
      await expect(menu).toBeVisible();
      await expect
        .poll(async () => {
          const box = await menu.boundingBox();
          return box !== null && box.x >= 0 && box.x + box.width <= width;
        })
        .toBe(true);
      await page.keyboard.press("Escape");
      await expect(menu).toBeHidden();
      await expect(menuButton).toBeFocused();
    }
  });
}

test("mobile navigation respects reduced motion", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await page
    .getByRole("button", { name: en.afterlife.menu, exact: true })
    .click();
  await expect(
    page
      .getByRole("banner")
      .getByRole("navigation", { name: en.afterlife.menu }),
  ).toHaveCSS("animation-name", "none");
});
