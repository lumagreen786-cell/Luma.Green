import { expect, test } from "@playwright/test";

import ar from "../messages/ar.json" with { type: "json" };
import en from "../messages/en.json" with { type: "json" };
import kn from "../messages/kn.json" with { type: "json" };
import ml from "../messages/ml.json" with { type: "json" };
import ta from "../messages/ta.json" with { type: "json" };

/**
 * Sign-in as it ships before a Convex deployment is connected (see the
 * webServer env in playwright.config.ts): a labelled code preview with no
 * provider requests or authenticated access. The signed-in flows need a deployment and are
 * checked against the dev one — docs/architecture/auth.md#testing.
 */

test("/login is private and starts with a language choice", async ({
  page,
}) => {
  await page.goto("/login");

  await expect(page).toHaveTitle("Log in · Luma.Green");
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute(
    "content",
    "noindex, nofollow",
  );
  await expect(page.locator('link[rel="canonical"]')).toHaveCount(0);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    en.auth.chooseLanguage,
  );
});

test("sign-in speaks the visitor's language", async ({ page }) => {
  await page.goto("/kn/login");

  await expect(page.locator("html")).toHaveAttribute("lang", "kn-IN");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    kn.auth.chooseLanguage,
  );
});

for (const { locale, messages } of [
  { locale: "en", messages: en },
  { locale: "ar", messages: ar },
]) {
  for (const width of [320, 768, 1440]) {
    test(`${locale} language picker is searchable and keeps Continue reachable at ${String(width)}px`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.goto(`/${locale}/login?next=%2Fjoin%2Fsaathi`);
      const group = page.getByRole("radiogroup", {
        name: messages.common.language,
      });
      const search = page.getByRole("searchbox", {
        name: messages.common.search,
      });
      const continueButton = page.getByRole("button", {
        name: messages.auth.continue,
        exact: true,
      });
      await expect(group).toBeVisible();
      await page.evaluate(async () => document.fonts.ready);
      const bounds = await group.evaluate((element) => ({
        height: element.getBoundingClientRect().height,
        scrollHeight: element.scrollHeight,
        width: element.getBoundingClientRect().width,
        scrollWidth: element.scrollWidth,
      }));
      expect(bounds.height).toBeLessThanOrEqual(225);
      expect(bounds.scrollHeight).toBeGreaterThan(bounds.height);
      expect(bounds.scrollWidth).toBeLessThanOrEqual(bounds.width + 1);
      await expect(continueButton).toBeInViewport();
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);

      await search.fill("malayalam");
      await expect(group.getByRole("radio")).toHaveCount(1);
      await expect(group.getByRole("radio", { name: /മലയാളം/ })).toBeVisible();
      await search.fill("العربية");
      await expect(group.getByRole("radio")).toHaveCount(1);
      await expect(group.getByRole("radio", { name: /العربية/ })).toBeVisible();
      await search.fill("no-such-language");
      await expect(
        page.getByText(messages.help.search.emptyTitle),
      ).toBeVisible();
      await expect(continueButton).toBeEnabled();
      await continueButton.click();
      await expect(
        page.getByLabel(messages.auth.mobileLabel, { exact: true }),
      ).toBeVisible();
      await expect(page).toHaveURL(/\/login\?next=%2Fjoin%2Fsaathi$/);
    });
  }
}

test("language picker keyboard selection changes locale only after Continue", async ({
  page,
}) => {
  await page.goto("/login?next=%2Fjoin%2Fsaathi");
  const search = page.getByRole("searchbox", { name: en.common.search });
  await search.fill("Arabic");
  await search.press("Tab");
  const arabic = page.getByRole("radio", { name: /العربية/ });
  await expect(arabic).toBeFocused();
  await arabic.press("Space");
  await expect(arabic).toBeChecked();
  expect(
    await page.evaluate(() => localStorage.getItem("lg.languageChosen")),
  ).toBeNull();
  await page
    .getByRole("button", { name: en.auth.continue, exact: true })
    .click();
  await expect(page).toHaveURL(/\/ar\/login\?next=%2Fjoin%2Fsaathi$/);
  await expect(
    page.getByLabel(ar.auth.mobileLabel, { exact: true }),
  ).toBeVisible();
});

for (const { locale, messages, width } of [
  { locale: "en", messages: en, width: 360 },
  { locale: "ar", messages: ar, width: 360 },
  { locale: "ta", messages: ta, width: 320 },
  { locale: "ml", messages: ml, width: 320 },
]) {
  test(`${locale} unavailable mobile sign-in never sends SMS`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 800 });
    await page.addInitScript(() => {
      localStorage.setItem("lg.languageChosen", "1");
    });
    const authRequests: string[] = [];
    page.on("request", (request) => {
      if (request.url().includes("/api/auth/"))
        authRequests.push(request.url());
    });
    await page.goto(`/${locale}/login?next=%2Fjoin%2Fsaathi`);
    const phone = page.getByLabel(messages.auth.mobileLabel, { exact: true });
    const action = page.getByRole("button", {
      name: messages.auth.sendCode,
      exact: true,
    });
    await expect(action).toBeVisible();
    await expect(action).toBeDisabled();
    await expect(
      page.getByText(messages.auth.unavailableBody, { exact: true }),
    ).toBeVisible();
    expect(
      await action.evaluate(
        (button) => button.scrollWidth <= button.clientWidth,
      ),
    ).toBe(true);
    await phone.fill("9876543210");
    await phone.press("Enter");
    await expect(page).toHaveURL(/\/login\?next=%2Fjoin%2Fsaathi$/);
    expect(authRequests).toEqual([]);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.goto(`/${locale}/login/verify`);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      messages.auth.metaTitle,
    );
    await expect(
      page.getByRole("button", { name: messages.auth.sendCode, exact: true }),
    ).toBeDisabled();
    expect(authRequests).toEqual([]);
  });
}

test("admin sign-in is English, never indexed, and off without Convex", async ({
  page,
}) => {
  const response = await page.goto("/admin/login");

  expect(response?.headers()["x-robots-tag"]).toBe("noindex, nofollow");
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await expect(page).toHaveTitle("Sign in · Luma.Green admin");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Admin sign-in",
  );
  await expect(
    page.getByText("The admin console isn't switched on here"),
  ).toBeVisible();
});

test("/admin stays outside the locale segment", async ({ page }) => {
  await page.goto("/admin");

  await expect(page).toHaveURL(/\/admin$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Admin console",
  );
});

for (const { locale, messages } of [
  { locale: "en", messages: en },
  { locale: "ar", messages: ar },
]) {
  for (const width of [390, 1440]) {
    for (const theme of ["light", "dark"] as const) {
      test(`${locale} centered OTP entry ${String(width)} ${theme}`, async ({
        page,
      }, testInfo) => {
        await page.setViewportSize({ width, height: 900 });
        await page.emulateMedia({
          colorScheme: theme,
          reducedMotion: "reduce",
        });
        await page.addInitScript(() => {
          localStorage.setItem("lg.languageChosen", "1");
        });
        await page.goto(`/${locale}/login`);
        await expect(
          page.getByRole("heading", {
            name: messages.auth.metaTitle,
            exact: true,
          }),
        ).toBeVisible();
        await page.evaluate(async () => document.fonts.ready);
        const main = await page.getByRole("main").boundingBox();
        const header = await page.getByRole("banner").boundingBox();
        if (!main || !header) throw new Error("Sign-in layout is missing");
        expect(
          Math.abs(main.x + main.width / 2 - width / 2),
        ).toBeLessThanOrEqual(1);
        expect(
          Math.abs(main.y + main.height / 2 - (900 + header.height) / 2),
        ).toBeLessThanOrEqual(2);
        await expect(
          page.getByRole("button", {
            name: messages.auth.sendCode,
            exact: true,
          }),
        ).toBeDisabled();
        await expect(
          page.getByText(messages.auth.unavailableBody, { exact: true }),
        ).toBeVisible();
        expect(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth,
          ),
        ).toBe(true);
        await page.screenshot({
          path: testInfo.outputPath("login-centered.png"),
        });
      });
    }
  }
}
