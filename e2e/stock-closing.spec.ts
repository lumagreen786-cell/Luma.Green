import { expect, test } from "@playwright/test";

test("stock review and alert settings remain behind real sign-in", async ({
  page,
}) => {
  await page.goto("/app/stock");
  await expect(page).toHaveURL((url) => url.pathname === "/login");
  // The shared workspace guard resumes at the workspace home after sign-in.
  expect(new URL(page.url()).searchParams.get("next")).toBe("/app");
  await expect(page.getByLabel("Daily stock review")).toHaveCount(0);
});
