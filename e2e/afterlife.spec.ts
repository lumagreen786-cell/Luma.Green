import { expect, test } from "@playwright/test";

test("household landing keeps booking direct and separates business", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toContainText(
    "Less waste.",
  );
  const book = page
    .getByRole("button", { name: "Book now", exact: true })
    .first();
  // The test environment has no WhatsApp recipient. Never invent one.
  await expect(book).toBeDisabled();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.getByRole("link", { name: "For business", exact: true }).click();
  await expect(page.getByRole("heading", { level: 1 })).toContainText(
    "Good materials.",
  );
  await page.getByRole("link", { name: "For collectors", exact: true }).click();
  await expect(page.getByRole("heading", { level: 1 })).toContainText(
    "More time collecting.",
  );
});

test("photo hero stays readable in light mode and phone remains a visual conversation", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce", colorScheme: "light" });
  await page.goto("/");
  const heading = page.getByRole("heading", { level: 1 });
  await expect(heading).toHaveCSS("color", "rgb(255, 255, 255)");
  await page.locator("#how").scrollIntoViewIfNeeded();
  await expect(page.getByRole("button", { name: /play|replay/i })).toHaveCount(
    0,
  );
  await expect(
    page.getByText("Homes & waste generators", { exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByText("No signup. No new app. Just WhatsApp.", { exact: true }),
  ).toHaveCount(0);
});
