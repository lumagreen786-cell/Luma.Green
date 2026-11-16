import { expect, test } from "@playwright/test";

test("status remains useful when the API cannot be verified", async ({
  page,
}, testInfo) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.emulateMedia({ colorScheme: "light", reducedMotion: "reduce" });
  await page.goto("/status");
  await expect(
    page.getByRole("heading", { name: "Service status", exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("status")).toContainText("Website");
  await expect(page.getByRole("status")).toContainText("Not verified");
  await expect(
    page.getByRole("button", { name: "Check again", exact: true }),
  ).toBeEnabled();
  await page.getByRole("button", { name: "Check again", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Check again", exact: true }),
  ).toBeEnabled();
  await page.screenshot({
    path: testInfo.outputPath("status-desktop-light.png"),
  });
});

test("status supports RTL", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ colorScheme: "dark", reducedMotion: "reduce" });
  await page.goto("/ar/status");
  await expect(
    page.getByRole("heading", { name: "حالة الخدمة", exact: true }),
  ).toBeVisible();
  await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
  await page.screenshot({
    path: testInfo.outputPath("status-phone-rtl-dark.png"),
  });
});
