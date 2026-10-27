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

for (const width of [390, 1440]) {
  for (const route of artworkRoutes) {
    const hasSecondaryArtwork =
      route.includes("/help") ||
      ["/en/prices", "/en/solar", "/en/contact"].includes(route);

    test(`${route} keeps its task heading visible and fits at ${String(width)}px`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.emulateMedia({ reducedMotion: "reduce" });
      await page.goto(route);
      await expect(page.getByRole("heading", { level: 1 })).toBeInViewport();
      const main = page.getByRole("main");
      await expect(main.locator("[data-page-banner]")).toHaveCount(0);
      if (hasSecondaryArtwork) {
        const artwork = main.locator("figure").first();
        if (width < 1024) await expect(artwork).toBeHidden();
        else {
          await expectStoryImages(artwork, 1);
          await expect(artwork).toBeVisible();
          const bounds = await artwork.boundingBox();
          expect(bounds?.height).toBeLessThanOrEqual(112);
          expect(bounds?.width).toBeCloseTo(256, 0);
        }
      }
      await expectNoDevicePreviews(page);
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

test("home puts collection ahead of supporting content on a 360px phone", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.setViewportSize({ width: 360, height: 800 });
  await page.goto("/en");
  const hero = page.getByRole("region", { name: english.home.hero.title });
  await expect(hero.locator("img")).toBeVisible();
  const action = hero.getByRole("link", {
    name: english.home.hero.sell,
    exact: true,
  });
  await expect(action).toBeInViewport();
  await expectNoDevicePreviews(page);
  await action.focus();
  await page.keyboard.press("Enter");
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

test("Arabic sign-in and booking keep the task visible without decorative panels", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.setViewportSize({ width: 390, height: 844 });
  for (const route of ["login", "sell"]) {
    await page.goto(`/ar/${route}`);
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
    await expect(page.getByRole("heading", { level: 1 })).toBeInViewport();
    await expect(page.locator("main figure, aside figure")).toHaveCount(0);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth - innerWidth,
      ),
    ).toBeLessThanOrEqual(1);
  }
});

test("desktop household image loads while sign-in stays focused on its task", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/en");
  await expectStoryImages(
    page.getByRole("region", { name: english.home.hero.title }),
    1,
  );
  await page.goto("/en/login");
  await expect(page.getByRole("figure")).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: english.auth.sendCode, exact: true }),
  ).toBeInViewport();
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
});
