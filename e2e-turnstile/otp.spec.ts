import path from "node:path";

import { expect, test } from "@playwright/test";
import { build } from "vite";

const fixture = { clientScript: "" };
test.beforeAll(async () => {
  const result = await build({
    configFile: false,
    logLevel: "silent",
    resolve: { alias: { "@": path.resolve("src") } },
    define: {
      "process.env": JSON.stringify({
        NEXT_PUBLIC_TURNSTILE_SITE_KEY: "fixture-site-key",
      }),
    },
    build: {
      write: false,
      lib: {
        entry: path.resolve("src/lib/phone-auth.ts"),
        name: "phoneAuth",
        formats: ["iife"],
      },
    },
  });
  const bundle = Array.isArray(result) ? result[0] : result;
  if (!("output" in bundle)) throw new Error("Unexpected fixture build");
  const chunk = bundle.output.find((item) => item.type === "chunk");
  if (!chunk) throw new Error("Missing fixture script");
  fixture.clientScript = chunk.code;
});

for (const isFailure of [false, true]) {
  test(`OTP browser boundary: ${isFailure ? "challenge failure blocks SMS" : "each resend uses a fresh token"}`, async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => {
      errors.push(error.message);
    });
    const tokens: string[] = [];
    await page.route(
      "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit",
      async (route) => {
        await route.fulfill({
          contentType: "application/javascript",
          body: `
        let sequence = 0;
        window.turnstile = {
          render(container, options) {
            const token = 'fixture-' + (++sequence);
            queueMicrotask(() => ${isFailure ? 'options["error-callback"]()' : "options.callback(token)"});
            return token;
          },
          remove() {}
        };
      `,
        });
      },
    );
    await page.route(
      "https://luma.test/api/auth/phone-number/send-otp",
      async (route) => {
        tokens.push(
          route.request().headers()["x-captcha-response"] ?? "missing",
        );
        await route.fulfill({
          contentType: "application/json",
          body: '{"status":true}',
        });
      },
    );
    await page.route("https://luma.test/", async (route) => {
      await route.fulfill({
        contentType: "text/html",
        body: `
        <!doctype html><html lang="en"><title>Isolated OTP test fixture</title>
        <body><button>Send code</button><p role="status"></p>
        <script>window.process = { env: { NODE_ENV: "production" }, browser: true };</script>
        <script>${fixture.clientScript}</script>
        <script>
          const button = document.querySelector('button');
          button.onclick = async () => {
            button.disabled = true;
            const error = await phoneAuth.requestPhoneCode('+919000000031');
            document.querySelector('[role=status]').textContent = error || 'sent';
            button.disabled = false;
          };
        </script></body></html>`,
      });
    });
    await page.goto("https://luma.test/");
    expect(errors).toEqual([]);
    const button = page.getByRole("button", { name: "Send code" });
    await button.click();
    await expect(page.getByRole("status")).toHaveText(
      isFailure ? "sendFailed" : "sent",
    );
    await expect(button).toBeEnabled();
    if (isFailure) expect(tokens).toEqual([]);
    else {
      await button.click();
      await expect(button).toBeEnabled();
      expect(tokens).toEqual(["fixture-1", "fixture-2"]);
    }
    await expect(page.locator("[data-turnstile-container]")).toHaveCount(0);
  });
}
