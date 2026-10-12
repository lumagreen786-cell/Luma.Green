import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

import { chromium, expect } from "@playwright/test";

const directory = path.dirname(fileURLToPath(import.meta.url));
const repository = path.resolve(directory, "../..");
const output = path.join(repository, "docs/user-guide/screenshots");
const origin = process.env.GUIDE_FIXTURE_ORIGIN ?? "http://127.0.0.1:3217";
const url = new URL(origin);
if (
  url.protocol !== "http:" ||
  url.hostname !== "127.0.0.1" ||
  url.pathname !== "/" ||
  url.search ||
  url.hash ||
  url.username ||
  url.password
)
  throw new Error("Failure fixtures require a loopback HTTP origin.");
const catalogues = Object.fromEntries(
  await Promise.all(
    ["en", "ar"].map(async (locale) => [
      locale,
      JSON.parse(
        await readFile(
          path.join(repository, `messages/${locale}.json`),
          "utf8",
        ),
      ),
    ]),
  ),
);
const sources = [
  "messages/en.json",
  "messages/ar.json",
  "src/app/globals.css",
  "src/lib/fonts.ts",
  "src/components/admin/errors.ts",
  "src/components/admin/schemas.ts",
  "src/components/admin/code-input.tsx",
  "src/components/app/format.ts",
  "src/components/admin/format.ts",
  "src/lib/money-format.ts",
  "src/components/ui/button.tsx",
  "src/components/ui/input.tsx",
  "src/components/ui/dialog.tsx",
  "src/components/ui/sonner.tsx",
  "scripts/guide-preview/capture-failures.mjs",
  "src/components/admin/admin-login.tsx",
  "src/components/admin/admin-setup.tsx",
  "src/components/admin/authenticator-step.tsx",
  "src/components/admin/auth-shell.tsx",
  "src/components/account/use-sign-out.ts",
  "src/components/admin/use-admin-sign-out.ts",
  "src/lib/sign-out.ts",
  "src/components/join/status-view.tsx",
  "src/components/join/file-slot.tsx",
  "src/components/app/app-shell.tsx",
  "src/components/help/contact-form.tsx",
  "src/components/help/contact-schema.ts",
  "src/components/theme/theme-provider.tsx",
  "src/components/market/listing-card.tsx",
  "src/components/market/buy-dialog.tsx",
  "convex/lib/chain.ts",
  "src/components/market/logic.ts",
  "scripts/guide-preview/failure.tsx",
  "scripts/guide-preview/failure.html",
  "src/components/account/account-links.tsx",
  "src/components/notifications/device-provider.tsx",
  "scripts/guide-preview/auth.ts",
  "scripts/guide-preview/provider.tsx",
  "scripts/guide-preview/queries.ts",
  "scripts/guide-preview/finance-fixtures.ts",
  "scripts/guide-preview/vite.config.mts",
];
const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");
const sourceHashes = Object.fromEntries(
  await Promise.all(
    sources.map(async (file) => [
      file,
      sha256(await readFile(path.join(repository, file))),
    ]),
  ),
);
const screenshots = [];
const viewports = Object.entries({
  phone: { width: 390, height: 844 },
  tablet: { width: 768, height: 1024 },
  desktop: { width: 1440, height: 1000 },
});
const browser = await chromium.launch();
await mkdir(output, { recursive: true });
try {
  for (const scenario of [
    "login",
    "totp",
    "setup",
    "file",
    "discard",
    "signout",
    "support",
    "market",
  ]) {
    const locales = ["login", "totp", "setup"].includes(scenario)
      ? ["en"]
      : ["en", "ar"];
    for (const locale of locales)
      for (const theme of ["light", "dark"])
        for (const [size, standardViewport] of viewports) {
          const viewport =
            scenario === "signout"
              ? { ...standardViewport, height: 1800 }
              : standardViewport;
          await test(`${scenario} ${locale} ${theme} ${size}`, async () => {
            const context = await browser.newContext({
              viewport,
              colorScheme: theme,
              reducedMotion: "reduce",
            });
            const page = await context.newPage();
            const problems = [];
            page.on("pageerror", (error) => {
              problems.push(error.message);
            });
            await context.route("**/*", (route) =>
              new URL(route.request().url()).origin === url.origin
                ? route.continue()
                : route.abort(),
            );
            const route = `/failure.html?scenario=${scenario}&locale=${locale}&role=kabadiwala&topic=trade`;
            await page.goto(`${url.origin}${route}`);
            await expect(
              page.getByRole("note", { name: "Screenshot provenance" }),
            ).toBeVisible();
            await page.evaluate(() => document.fonts.ready);
            expect(
              await page.evaluate(() =>
                [...document.fonts].some((font) => font.status === "loaded"),
              ),
            ).toBe(true);
            const messages = catalogues[locale];
            switch (scenario) {
              case "login":
              case "totp": {
                await page
                  .getByLabel("Email", { exact: true })
                  .fill("fixture@example.test");
                await page
                  .getByLabel("Password", { exact: true })
                  .fill("fixture-only-password");
                await page
                  .getByRole("button", { name: "Continue", exact: true })
                  .click();
                if (scenario === "totp") {
                  await page
                    .getByLabel("Code from your authenticator app")
                    .fill("123456");
                  await expect(
                    page.getByLabel("Code from your authenticator app"),
                  ).toBeEnabled();
                } else {
                  await page.getByLabel("Password", { exact: true }).fill("");
                  await expect(
                    page.getByRole("button", { name: "Continue", exact: true }),
                  ).toBeEnabled();
                }
                await expect(
                  page.getByText("Something went wrong. Try again.", {
                    exact: true,
                  }),
                ).toBeVisible();

                break;
              }
              case "setup": {
                await expect(
                  page.getByLabel("Setup token", { exact: true }),
                ).toHaveAttribute("type", "password");
                await expect(
                  page.getByLabel("Setup token", { exact: true }),
                ).toBeEmpty();

                break;
              }
              case "file": {
                const remove = page.getByRole("button", {
                  name: `${messages.join.files.remove}: example-document.pdf`,
                });
                await remove.click();
                await expect(
                  page.getByText(messages.common.error, { exact: true }),
                ).toBeVisible();
                await expect(remove).toBeEnabled();
                await expect(
                  page.getByText("example-document.pdf", { exact: true }),
                ).toBeVisible();

                break;
              }
              case "discard": {
                await page
                  .getByRole("button", {
                    name: messages.join.status.draft.changeRole,
                    exact: true,
                  })
                  .click();
                await page
                  .getByRole("button", {
                    name: messages.join.form.yes,
                    exact: true,
                  })
                  .click();
                await expect(
                  page.getByText(messages.common.error, { exact: true }),
                ).toBeVisible();
                await expect(page.getByRole("alertdialog")).toBeVisible();
                await expect(
                  page.getByRole("button", {
                    name: messages.join.form.yes,
                    exact: true,
                  }),
                ).toBeEnabled();

                break;
              }
              case "signout": {
                const direct = page.getByRole("button", {
                  name: messages.app.signOut,
                  exact: true,
                });
                if (await direct.isVisible()) await direct.click();
                else {
                  await page
                    .locator("header")
                    .getByRole("button", {
                      name: messages.app.more,
                      exact: true,
                    })
                    .click();
                  // Give the unchanged menu, error toast and documentation note
                  // separate space. Only the harness note is repositioned.
                  await page
                    .getByRole("note", {
                      name: "Screenshot provenance",
                      includeHidden: true,
                    })
                    .evaluate((note) => {
                      Object.assign(note.style, {
                        position: "fixed",
                        top: "auto",
                        bottom: "96px",
                        left: "0",
                        right: "0",
                      });
                    });
                  await page
                    .getByRole("dialog")
                    .getByRole("button", {
                      name: messages.app.signOut,
                      exact: true,
                    })
                    .click();
                }
                await expect(
                  page.getByText(messages.common.error, { exact: true }),
                ).toBeVisible();
                await expect(page).toHaveURL(`${url.origin}${route}`);
                if (viewport.width >= 1280) {
                  const toast = await page
                    .locator("[data-sonner-toast]")
                    .first()
                    .boundingBox();
                  const navigation = await page.locator("aside").boundingBox();
                  expect(toast).not.toBeNull();
                  expect(navigation).not.toBeNull();
                  if (toast && navigation) {
                    expect(
                      toast.x + toast.width <= navigation.x ||
                        navigation.x + navigation.width <= toast.x,
                    ).toBe(true);
                  }
                }

                break;
              }
              case "market": {
                await page
                  .getByRole("button", {
                    name: messages.market.buy.buttonLabel
                      .replace("{material}", () =>
                        locale === "ar" ? "ورق الصحف" : "Newspaper",
                      )
                      .replace("{seller}", "Fixture seller"),
                    exact: true,
                  })
                  .click();
                await page.getByLabel(messages.market.buy.kgLabel).fill("2");
                await page
                  .getByRole("button", {
                    name: messages.market.buy.submit,
                    exact: true,
                  })
                  .click();
                await expect(page.getByRole("alert")).toContainText(
                  messages.market.totalInvalid,
                );
                break;
              }
              default: {
                await page.locator("#contact-name").fill("Fixture Person");
                await page.locator("#contact-phone").fill("9000000000");
                await page
                  .locator("#contact-message")
                  .fill("Synthetic message for the failure fixture.");
                await page
                  .getByRole("button", {
                    name: messages.help.contact.submit,
                    exact: true,
                  })
                  .click();
                await expect(
                  page.getByText(messages.help.contact.errors.rateLimited, {
                    exact: true,
                  }),
                ).toBeVisible();
                await expect(page.locator("#contact-message")).toHaveValue(
                  "Synthetic message for the failure fixture.",
                );
              }
            }
            expect(problems).toEqual([]);
            expect(
              await page.evaluate(
                () => document.documentElement.scrollWidth <= window.innerWidth,
              ),
            ).toBe(true);
            expect(
              await page
                .locator('input[type="password"]')
                .evaluateAll((inputs) =>
                  inputs.every((input) => input.value === ""),
                ),
            ).toBe(true);
            expect(await page.locator("html").getAttribute("dir")).toBe(
              locale === "ar" ? "rtl" : "ltr",
            );
            await page.keyboard.press("Tab");
            await page.evaluate(() => {
              window.scrollTo(0, 0);
            });
            const name = `failure-${scenario}-${locale}-${theme}-${size}.png`;
            const image = await page.screenshot({
              path: path.join(output, name),
              fullPage: scenario !== "signout" || size === "desktop",
              animations: "disabled",
            });
            screenshots.push({
              file: `screenshots/${name}`,
              route,
              scenario,
              locale,
              theme,
              viewport: page.viewportSize(),
              sha256: sha256(image),
              provenance:
                "synthetic local failure fixture; actual components; no live authentication, writes or provider execution",
              checks: [
                "failure feedback and retry or setup control",
                "no page error",
                "no horizontal overflow",
                "empty password and token fields",
                "document direction",
                "loaded fonts",
              ],
            });
            await context.close();
          });
        }
  }
} finally {
  await browser.close();
}
await writeFile(
  path.join(repository, "docs/user-guide/failure-captures.json"),
  JSON.stringify(
    {
      capturedAt: new Date().toISOString(),
      sourceCommit: execFileSync("/usr/bin/git", ["rev-parse", "HEAD"], {
        cwd: repository,
        encoding: "utf8",
      }).trim(),
      sourceHashes,
      origin: url.origin,
      screenshots,
    },
    null,
    2,
  ) + "\n",
);
