import { readFileSync } from "node:fs";
import { setTimeout as quietWindow } from "node:timers/promises";

import { expect, type Page, test } from "@playwright/test";
import { z } from "zod";

const accountSchema = z.object({
  key: z.string(),
  email: z.email(),
  password: z.string(),
});
const credentialsSchema = z.object({
  site: z.url(),
  accounts: z.array(accountSchema),
});
const credentialsSource: unknown = JSON.parse(
  readFileSync(".convex/local-acceptance/credentials.json", "utf8"),
);
const credentials = credentialsSchema.parse(credentialsSource);
const origin = new URL(credentials.site);
if (
  origin.protocol !== "http:" ||
  !["localhost", "127.0.0.1", "[::1]"].includes(origin.hostname)
) {
  throw new Error(
    "Operational layout acceptance requires a local test origin.",
  );
}

function localAccount(key: string) {
  const account = credentials.accounts.find((row) => row.key === key);
  if (!account) throw new Error(`Missing local acceptance account: ${key}`);
  return account;
}
async function checkTabLayout(page: Page) {
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  const tabs = await page.getByRole("tab").all();
  for (const tab of tabs) {
    const metrics = await tab.evaluate((node) => ({
      height: node.getBoundingClientRect().height,
      width: node.getBoundingClientRect().width,
      contentFits: node.scrollWidth <= node.clientWidth,
      parentWidth: node.parentElement?.getBoundingClientRect().width ?? 0,
    }));
    expect(metrics.height).toBeGreaterThanOrEqual(44);
    expect(metrics.contentFits).toBe(true);
    expect(metrics.width).toBeLessThan(metrics.parentWidth / 2);
  }
}

async function checkRequestsUrl(
  page: Page,
  route: string,
  tab: "new" | "today",
) {
  if (route !== "/app/requests") return;
  await expect(page).toHaveURL(
    tab === "today" ? /[?]tab=today$/ : /\/app\/requests$/,
  );
}

for (const locale of ["en", "ar", "kn"] as const) {
  for (const [key, route] of [
    ["kabadiwala", "/app/requests"],
    ["preprocessor", "/app/trades"],
  ] as const) {
    test(`${locale} ${key} tabs retain readable touch targets and keyboard access at all widths`, async ({
      browser,
    }) => {
      // Better Auth's rate window needs a quiet gap, not a new session or a wider quota.
      await quietWindow(11_000);
      const account = localAccount(key);
      const context = await browser.newContext({
        baseURL: origin.origin,
        extraHTTPHeaders: {
          "X-Forwarded-For": `192.0.2.${String(credentials.accounts.indexOf(account) + 1)}`,
        },
      });
      try {
        const response = await context.request.post("/api/auth/sign-in/email", {
          headers: { Origin: origin.origin },
          data: { email: account.email, password: account.password },
        });
        expect(
          response.ok(),
          `Local sign-in for ${key}: HTTP ${String(response.status())}`,
        ).toBe(true);
        const page = await context.newPage();
        await page.goto(`/${locale}${route}`);
        const tabs = page.getByRole("tab");
        await expect(tabs.first()).toBeVisible();
        await expect(page.getByRole("tablist")).toHaveAttribute(
          "data-variant",
          "default",
        );
        for (const theme of ["light", "dark"] as const) {
          await page.emulateMedia({ colorScheme: theme });
          await expect
            .poll(() =>
              page.evaluate(() =>
                document.documentElement.classList.contains("dark"),
              ),
            )
            .toBe(false);
          for (const width of [390, 768, 1440]) {
            await page.setViewportSize({
              width,
              height: width === 390 ? 844 : 1000,
            });
            await page.evaluate(() => document.fonts.ready);
            await checkTabLayout(page);
            await tabs.first().click();
            await page.keyboard.press(
              locale === "ar" ? "ArrowLeft" : "ArrowRight",
            );
            await expect(tabs.nth(1)).toBeFocused();
            await expect(tabs.nth(1)).toHaveAttribute("aria-selected", "true");
            await expect(page.getByRole("tabpanel")).toHaveAttribute(
              "aria-labelledby",
              (await tabs.nth(1).getAttribute("id")) ?? "",
            );
            await checkRequestsUrl(page, route, "today");
            await page.keyboard.press(
              locale === "ar" ? "ArrowRight" : "ArrowLeft",
            );
            await expect(tabs.first()).toBeFocused();
            await expect(tabs.first()).toHaveAttribute("aria-selected", "true");
            await checkRequestsUrl(page, route, "new");
          }
        }
      } finally {
        await context.close();
      }
    });
  }
}
