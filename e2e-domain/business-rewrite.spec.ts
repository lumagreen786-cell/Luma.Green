import { expect, test } from "@playwright/test";

import arabic from "../messages/ar.json";
import english from "../messages/en.json";

for (const { path, copy } of [
  { path: "/", copy: english },
  { path: "/ar", copy: arabic },
]) {
  test(`business hostname ${path} hydrates its actual rewritten page`, async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => {
      errors.push(error.message);
    });
    page.on("console", (message) => {
      if (message.type() === "error") errors.push(message.text());
    });
    // Reused CI builds contain fake telemetry keys. Stub only provider traffic;
    // all app HTML, Next scripts, rewrites and navigation remain real.
    await page.route("**/*", async (route) => {
      const url = new URL(route.request().url());
      const isVercel =
        url.hostname === "business.luma.green" &&
        url.pathname.startsWith("/_vercel/insights/");
      const isProvider =
        url.hostname.endsWith(".posthog.com") ||
        url.hostname.endsWith(".sentry.io") ||
        url.hostname === "example.invalid" ||
        url.hostname === "www.googletagmanager.com" ||
        url.hostname === "www.google-analytics.com";
      if (isVercel || isProvider) {
        const isScript =
          url.pathname.endsWith(".js") || url.pathname === "/gtag/js";
        await route.fulfill({
          status: 200,
          contentType: isScript ? "application/javascript" : "application/json",
          body: isScript
            ? "/* Domain test: provider runtime stub. */"
            : '{"status":1}',
          headers: { "access-control-allow-origin": "*" },
        });
        return;
      }
      await route.continue();
    });
    const response = await page.goto(path);
    expect(response?.status()).toBe(200);
    // The real proxy rewrite keeps the public URL but serves the business page.
    expect(new URL(page.url()).pathname).toBe(path);
    await expect(page.getByRole("heading", { level: 1 })).toContainText(
      copy.afterlife.businessTitle,
    );
    const header = page.getByRole("banner");
    await expect(
      header.getByRole("link", { name: copy.afterlife.ecosystem, exact: true }),
    ).toBeVisible();
    await expect(
      header.getByRole("link", { name: copy.afterlife.signIn, exact: true }),
    ).toBeVisible();
    // An interactive control proves hydration has completed before error checks.
    await header
      .getByRole("button", { name: copy.theme.label, exact: true })
      .click();
    await expect(
      page.getByRole("menuitemradio", { name: copy.theme.light, exact: true }),
    ).toBeVisible();
    await page.keyboard.press("Escape");
    expect(errors).toEqual([]);
  });
}
