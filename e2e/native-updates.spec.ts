import { readFileSync } from "node:fs";

import { expect, test } from "@playwright/test";

import { updateBridgeScript } from "../apps/shared/update-bridge.mjs";

test("native update arrival does not interrupt a form or accept restart after editing", async ({
  page,
  baseURL,
}) => {
  const origin = new URL(baseURL ?? "http://localhost:3128").origin;
  await page.addInitScript(
    updateBridgeScript(origin, "test-token", "ready", "desktop"),
  );
  await page.goto("/sell");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  // Real native commands are intercepted: this is a hosted-control fixture,
  // not evidence of a signed update or provider delivery.
  await page.evaluate(() => {
    const api = Reflect.get(window, "lumaAppUpdates") as {
      request: (action: string) => void;
    };
    api.request("restart");
  });
  await expect
    .poll(() =>
      page.evaluate(() =>
        (
          Reflect.get(window, "lumaAppUpdates") as { getState: () => string }
        ).getState(),
      ),
    )
    .toBe("blocked");
  await expect(page).toHaveURL(/\/sell/);
  await page.evaluate(() => {
    document.dispatchEvent(new Event("input", { bubbles: true }));
    history.pushState({}, "", "/");
    (
      Reflect.get(window, "lumaAppUpdates") as {
        request: (action: string) => void;
      }
    ).request("restart");
  });
  await expect
    .poll(() =>
      page.evaluate(() =>
        (
          Reflect.get(window, "lumaAppUpdates") as { getState: () => string }
        ).getState(),
      ),
    )
    .toBe("blocked");
});

test("the update control offers check and restart without an arrival modal", async ({
  page,
  baseURL,
}) => {
  const origin = new URL(baseURL ?? "http://localhost:3128").origin;
  await page.addInitScript(
    updateBridgeScript(origin, "test-token", "ready", "desktop"),
  );
  await page.goto("/");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page
    .getByRole("button", { name: "An app update is ready.", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(page.getByRole("button", { name: "Restart now" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
});

for (const locale of ["en", "ar", "ur", "kn"]) {
  const messages = JSON.parse(
    readFileSync(process.cwd() + "/messages/" + locale + ".json", "utf8"),
  ) as {
    native: { updateReady: string; restart: string };
  };
  for (const width of [390, 768, 1440]) {
    for (const theme of ["light", "dark"] as const) {
      test(
        "update layout " + locale + " " + String(width) + " " + theme,
        async ({ page, baseURL }, testInfo) => {
          await page.setViewportSize({ width, height: 900 });
          await page.emulateMedia({ colorScheme: theme });
          const origin = new URL(baseURL ?? "http://localhost:3128").origin;
          await page.addInitScript(
            updateBridgeScript(origin, "fixture-token", "ready", "desktop"),
          );
          await page.goto(locale === "en" ? "/" : "/" + locale);
          const indicator = page.getByRole("button", {
            name: messages.native.updateReady,
            exact: true,
          });
          await expect(indicator).toBeVisible();
          await indicator.click();
          const dialog = page.getByRole("dialog");
          await expect(dialog).toBeVisible();
          const restart = page.getByRole("button", {
            name: messages.native.restart,
          });
          await expect(restart).toBeVisible();
          await expect(restart).toBeInViewport();
          expect(
            await page.evaluate(
              () => document.documentElement.scrollWidth <= window.innerWidth,
            ),
          ).toBe(true);
          await page.evaluate(() => document.fonts.ready);
          await page.screenshot({
            path: testInfo.outputPath("synthetic-native-update.png"),
            animations: "disabled",
          });
        },
      );
    }
  }
}

test("an idle home document freezes input only after an explicit restart", async ({
  page,
  baseURL,
}) => {
  const origin = new URL(baseURL ?? "http://localhost:3128").origin;
  await page.addInitScript(
    "window.ReactNativeWebView={postMessage:function(raw){window.__updateMessage=raw;}};",
  );
  await page.addInitScript(
    updateBridgeScript(origin, "test-token", "ready", "mobile"),
  );
  await page.goto("/");
  await page
    .getByRole("button", { name: "An app update is ready.", exact: true })
    .click();
  await page.getByRole("button", { name: "Restart now", exact: true }).click();
  await expect
    .poll(() => page.evaluate(() => document.documentElement.inert))
    .toBe(true);
  expect(
    await page.evaluate(() => Reflect.get(window, "__updateMessage") as string),
  ).toBe(
    JSON.stringify({
      type: "luma.update",
      nonce: "test-token",
      action: "restart",
    }),
  );
  await expect(page).toHaveURL(origin + "/");
});
