import { expect, test } from "@playwright/test";

import ar from "../messages/ar.json";
import en from "../messages/en.json";
import kn from "../messages/kn.json";
import ur from "../messages/ur.json";

for (const [locale, copy] of [
  ["en", en],
  ["ar", ar],
  ["kn", kn],
  ["ur", ur],
] as const) {
  for (const width of [390, 768, 1440]) {
    for (const colorScheme of ["light", "dark"] as const) {
      test(`household navigation keeps ${locale} labels on one line at ${String(width)}px in ${colorScheme}`, async ({
        page,
      }, testInfo) => {
        await page.setViewportSize({ width, height: 900 });
        await page.emulateMedia({ colorScheme });
        await page.goto(`/${locale}/sell/footprint`);
        await page.evaluate(async () => document.fonts.ready);
        const navigation = page.getByRole("navigation", {
          name: copy.householdTools.navigation,
        });
        await expect(navigation.getByRole("link")).toHaveCount(5);
        const isFits = await navigation
          .locator("a span")
          .evaluateAll((labels) =>
            labels.every((label) => {
              const range = document.createRange();
              range.selectNodeContents(label);
              return range.getClientRects().length === 1;
            }),
          );
        expect(isFits).toBe(true);
        expect(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth,
          ),
        ).toBe(true);
        await page.screenshot({
          path: testInfo.outputPath("household-navigation.png"),
          fullPage: true,
        });
      });
    }
  }
}

test("opens the household footprint and estimates measured grid electricity", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/sell");
  await page
    .getByRole("navigation", { name: en.householdTools.navigation })
    .getByRole("link", { name: en.householdTools.footprint })
    .click();
  await expect(page).toHaveURL("/sell/footprint");
  const calculate = page.getByRole("button", {
    name: en.householdTools.calculate,
  });
  await calculate.click();
  await expect(page.getByRole("main").getByRole("alert")).toHaveText(
    en.householdTools.invalidReading,
  );
  await page.getByLabel(en.householdTools.electricityReading).fill("100");
  await calculate.click();
  await expect(page.locator("output")).toHaveText(
    "Estimated grid emissions: 67.5 kg CO₂",
  );
});

test("downloads the household reminder in calendar format", async ({
  page,
}) => {
  await page.goto("/sell/settings");
  await page.getByLabel(en.homeReminder.time).fill("07:30");
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: en.homeReminder.add }).click();
  const calendar = await download;
  expect(calendar.suggestedFilename()).toBe("luma-reminder.ics");
});

test("keeps the manual solar calculator available when location lookups are off", async ({
  page,
}) => {
  await page.goto("/sell/services");
  await page.getByText(en.householdTools.airQuality, { exact: true }).click();
  await expect(
    page
      .getByText(en.householdTools.lookupUnavailable, { exact: true })
      .first(),
  ).toBeVisible();
  await expect(
    page.getByRole("main").getByRole("link", { name: en.footer.solar }),
  ).toHaveAttribute("href", "/solar");
});
