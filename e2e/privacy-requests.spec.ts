import { expect, test } from "@playwright/test";

import ar from "../messages/ar.json";

test("signed-out privacy requests return to the protected route after sign-in", async ({
  page,
}) => {
  await page.goto("/ar/account/privacy");
  await expect(page).toHaveURL(
    (url) =>
      url.pathname === "/ar/login" &&
      url.searchParams.get("next") === "/account/privacy",
  );
  await expect(
    page.getByRole("heading", { name: ar.auth.metaTitle, level: 1 }),
  ).toBeVisible();
  await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
  await expect(
    page.getByRole("button", { name: ar.privacyRequests.submit }),
  ).toHaveCount(0);
});
