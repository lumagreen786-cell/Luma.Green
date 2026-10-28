import { expect, test } from "@playwright/test";
for (const { prefix, direction } of [
  { prefix: "", direction: "ltr" },
  { prefix: "/ar", direction: "rtl" },
]) {
  test(`service records require a real session ${prefix || "English"}`, async ({
    page,
  }) => {
    await page.goto(`${prefix}/account/services`);
    await expect(page).toHaveURL((url) => url.pathname === `${prefix}/login`);
    const url = new URL(page.url());
    expect(url.searchParams.get("next")).toBe("/account/services");
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute(
      "content",
      /noindex/,
    );
    await expect(page.locator("html")).toHaveAttribute("dir", direction);
  });
}
