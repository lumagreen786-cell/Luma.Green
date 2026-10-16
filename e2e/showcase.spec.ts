import { expect, type Locator, type Page, test } from "@playwright/test";

import english from "../messages/en.json";
import urdu from "../messages/ur.json";

const roles = [
  "household",
  "kabadiwala",
  "yard",
  "recycler",
  "manufacturer",
  "saathi",
  "admin",
] as const;

const helpRoles = roles.filter((role) => role !== "admin");
const artworkRoutes = [
  "/en/how-it-works",
  "/en/participants",
  "/en/prices",
  "/en/standards",
  "/en/solar",
  "/en/join",
  "/en/contact",
  "/en/help",
  "/en/help/contact",
  ...helpRoles.map((role) => `/en/help/${role}`),
  "/ar/how-it-works",
];
const participantTitles = {
  household: english.participants.householdHeading,
  kabadiwala: english.participants.kabadiwala.name,
  yard: english.participants.yard.name,
  recycler: english.participants.recycler.name,
  manufacturer: english.participants.manufacturer.name,
  saathi: english.participants.saathi.name,
  admin: english.showcase.preview.roles.admin.title,
};

async function expectStoryImages(region: Locator, count: number) {
  const images = region.locator("img");
  await expect(images).toHaveCount(count);
  const imageElements = await images.all();
  for (const image of imageElements) {
    await image.scrollIntoViewIfNeeded();
    await expect
      .poll(async () =>
        image.evaluate(
          (element: HTMLImageElement) =>
            element.complete && element.naturalWidth > 0,
        ),
      )
      .toBe(true);
  }
}

async function expectNoDevicePreviews(page: Page) {
  await expect(
    page.getByRole("main").locator("figure[aria-label]"),
  ).toHaveCount(0);
  await page.evaluate(async () => document.fonts.ready);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth - innerWidth,
    ),
  ).toBeLessThanOrEqual(1);
}

async function expectHeaderArtworkLayout(
  page: Page,
  banner: Locator,
  width: number,
  isCompact: boolean,
) {
  const bounds = await banner.evaluate((element) => {
    const rect = element.getBoundingClientRect();
    return {
      width: rect.width,
      height: rect.height,
      left: rect.left,
      right: rect.right,
      top: rect.top,
      bottom: rect.bottom,
    };
  });
  if (isCompact) {
    expect(bounds.height).toBeGreaterThanOrEqual(80);
    expect(bounds.height).toBeLessThanOrEqual(width >= 1024 ? 176 : 112);
  }
  if (width >= 1024) {
    if (isCompact) {
      expect(bounds.width).toBeCloseTo(256, 0);
    } else {
      expect(bounds.width).toBeGreaterThanOrEqual(width * 0.3);
      expect(bounds.width / bounds.height).toBeCloseTo(4 / 3, 1);
    }
    const headingBounds = await page
      .getByRole("heading", { level: 1 })
      .evaluate((element) => {
        const rect = element.getBoundingClientRect();
        return {
          left: rect.left,
          right: rect.right,
          top: rect.top,
          bottom: rect.bottom,
        };
      });
    const isRtl = (await page.locator("html").getAttribute("dir")) === "rtl";
    expect(
      isRtl ? bounds.right : headingBounds.right,
      "The image and heading must not overlap",
    ).toBeLessThanOrEqual(isRtl ? headingBounds.left : bounds.left);
    expect(
      Math.min(bounds.bottom, headingBounds.bottom) -
        Math.max(bounds.top, headingBounds.top),
      "The image must sit beside the heading",
    ).toBeGreaterThan(0);
  } else {
    expect(
      bounds.width,
      "The banner must span the main reading area",
    ).toBeGreaterThanOrEqual(width * 0.7);
    expect(
      bounds.width / bounds.height,
      "The page artwork must have a wide shape",
    ).toBeGreaterThanOrEqual(1.6);
    const heading = await page.getByRole("heading", { level: 1 }).boundingBox();
    expect(heading).not.toBeNull();
    expect(
      bounds.top,
      "Phone artwork follows the heading",
    ).toBeGreaterThanOrEqual((heading?.y ?? 0) + (heading?.height ?? 0));
  }
  expect(bounds.left).toBeGreaterThanOrEqual(-1);
  expect(bounds.right).toBeLessThanOrEqual(width + 1);
}

for (const width of [390, 1440]) {
  for (const route of artworkRoutes) {
    // Task pages keep compact secondary artwork; story pages keep editorial art.
    const isCompact =
      route.includes("/help") ||
      ["/en/prices", "/en/solar", "/en/contact", "/en/join"].includes(route);

    test(`${route} keeps its page image loaded and aligned at ${String(width)}px`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.emulateMedia({ reducedMotion: "reduce" });
      await page.goto(route);
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      const main = page.getByRole("main");
      await expect(main.locator("[data-page-banner]")).toHaveCount(
        isCompact ? 0 : 1,
      );
      const banner = main.locator("figure").first();
      await expect(banner).toHaveCount(1);
      await banner.scrollIntoViewIfNeeded();
      await expect(banner).toBeInViewport();
      await expectStoryImages(banner, 1);
      await expect(banner.locator("img")).toBeVisible();
      await page.evaluate(async () => document.fonts.ready);
      await expectHeaderArtworkLayout(page, banner, width, isCompact);
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth - innerWidth,
        ),
        "The page must fit without horizontal scrolling",
      ).toBeLessThanOrEqual(1);
    });
  }
}

test("participants show role photos without device mockups or illustration captions", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/en/participants");
  await expectNoDevicePreviews(page);
  await expect(
    page.getByText(english.showcase.preview.label, { exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByText(english.showcase.scene, { exact: true }),
  ).toHaveCount(0);
  for (const role of roles) {
    await expectStoryImages(
      page.getByRole("region", { name: participantTitles[role], exact: true }),
      1,
    );
  }
});

test("home role directory keeps its household action on a 360px phone", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.setViewportSize({ width: 360, height: 800 });
  await page.goto("/en");
  const roleSection = page.getByRole("region", {
    name: english.home.roles.heading,
  });
  await expectStoryImages(roleSection, 6);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth - innerWidth,
    ),
  ).toBeLessThanOrEqual(1);
  await roleSection
    .getByRole("link", { name: english.home.roles.household.cta, exact: true })
    .click();
  await expect(page).toHaveURL(/\/sell$/u);
});

test("Arabic participant sections fit a phone without device mockups", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/ar/participants");
  await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
  await expectNoDevicePreviews(page);
});

test("Urdu join photos fit a phone and cards lead to the selected role", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/ur/join");
  const roleLink = page.getByRole("link").filter({
    has: page.getByText(urdu.join.roles.kabadiwala.title, { exact: true }),
  });
  const roleList = page
    .getByRole("main")
    .getByRole("list")
    .filter({ has: roleLink });
  await expectStoryImages(roleList, 5);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth - innerWidth,
    ),
  ).toBeLessThanOrEqual(1);
  await roleLink.focus();
  await expect(roleLink).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/ur\/join\/kabadiwala$/u);
});

test("each role help page keeps guides reachable without device previews", async ({
  page,
}) => {
  test.setTimeout(60_000);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.setViewportSize({ width: 390, height: 844 });
  for (const role of helpRoles) {
    await page.goto(`/en/help/${role}`);
    await expectNoDevicePreviews(page);
    await page
      .getByRole("link", { name: english.help.role.guidesHeading, exact: true })
      .click();
    await expect(page).toHaveURL(/#guides$/u);
    await expect(
      page.getByRole("heading", {
        name: english.help.role.guidesHeading,
        exact: true,
      }),
    ).toBeInViewport();
  }
});

test("public information scenes load without adding controls or overflowing a phone", async ({
  page,
}) => {
  test.setTimeout(60_000);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.setViewportSize({ width: 390, height: 844 });
  for (const route of ["solar", "prices", "standards", "contact"]) {
    await page.goto(`/en/${route}`);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    const scene = page.getByRole("main").locator("figure").first();
    await expectStoryImages(scene, 1);
    await expect(scene.locator("img")).toHaveAttribute("alt", "");
    await expect(scene.locator("button, a, input, [tabindex]")).toHaveCount(0);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth - innerWidth,
      ),
    ).toBeLessThanOrEqual(1);
  }
});

test("Arabic sign-in and booking keep phone artwork compact and loaded", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.setViewportSize({ width: 390, height: 844 });
  for (const route of ["login", "sell"]) {
    await page.goto(`/ar/${route}`);
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
    await expect(page.getByRole("heading", { level: 1 })).toBeInViewport();
    const artwork = page.locator("figure:visible");
    await expect(artwork).toHaveCount(1);
    await expectStoryImages(artwork, 1);
    const imageBounds = await artwork.boundingBox();
    expect(imageBounds).not.toBeNull();
    expect(imageBounds?.width).toBeLessThanOrEqual(88);
    expect(imageBounds?.height).toBeLessThanOrEqual(88);
    await expect(artwork.locator("button, a, input, [tabindex]")).toHaveCount(
      0,
    );
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth - innerWidth,
      ),
    ).toBeLessThanOrEqual(1);
  }
});

test("desktop role and sign-in scenes load with real task links", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/en");
  await expectStoryImages(
    page.getByRole("region", { name: english.home.roles.heading }),
    6,
  );
  await page.goto("/en/login");
  await expectStoryImages(page.getByRole("figure"), 1);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
});
