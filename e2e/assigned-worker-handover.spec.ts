import { expect, test } from "@playwright/test";

test("assigned-worker handover controls require a real account session", async ({
  page,
}) => {
  await page.goto("/app");
  await expect(page).toHaveURL((url) => url.pathname === "/login");
  expect(new URL(page.url()).searchParams.get("next")).toBe("/app");
  await expect(
    page.getByText("Collection handover", { exact: true }),
  ).toHaveCount(0);
});
