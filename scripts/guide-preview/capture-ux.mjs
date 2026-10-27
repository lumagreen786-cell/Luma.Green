import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { chromium, expect } from "@playwright/test";

const origin = "http://127.0.0.1:3218";
const output = path.resolve("docs/delivery/evidence/web-ux-2026-10-27");
await mkdir(output, { recursive: true });
const browser = await chromium.launch();
const records = [];
const isAdminOnly = process.env.UX_CAPTURE_SCOPE === "admin";
const captureLocales = isAdminOnly ? ["en"] : ["en", "ar", "kn"];
try {
  for (const locale of captureLocales) {
    const copy = JSON.parse(await readFile(`messages/${locale}.json`, "utf8"));
    for (const width of [390, 768, 1440]) {
      for (const colorScheme of ["light", "dark"]) {
        const context = await browser.newContext({
          viewport: { width, height: 1000 },
          colorScheme,
          reducedMotion: "reduce",
        });
        await context.route("**/*", (route) => {
          const url = new URL(route.request().url());
          return ["127.0.0.1", "localhost"].includes(url.hostname) ||
            ["data:", "blob:"].includes(url.protocol)
            ? route.continue()
            : route.abort();
        });
        const page = await context.newPage();
        const errors = [];
        page.on("pageerror", (error) => {
          errors.push(error.message);
        });
        async function capture(name) {
          await expect(
            page.getByRole("note", { name: "Screenshot provenance" }),
          ).toBeVisible();
          await page.evaluate(async () => document.fonts.ready);
          expect(
            await page.evaluate(
              () => document.documentElement.scrollWidth <= innerWidth,
            ),
          ).toBe(true);
          const file = `${locale}-${width}-${colorScheme}-${name}.png`;
          await page.screenshot({
            path: path.join(output, file),
            fullPage: true,
          });
          records.push({
            locale,
            width,
            colorScheme,
            name,
            file,
            errors: [...errors],
          });
          expect(errors).toEqual([]);
        }
        if (isAdminOnly) {
          await page.goto(`${origin}/admin/verification`);
          await page
            .getByRole("heading", { name: "Verification", exact: true })
            .waitFor({ state: "visible" });
          await capture("admin-queue");
          await page
            .getByRole("button", { name: "Review next", exact: true })
            .click();
          await page
            .getByRole("region", { name: "Application review", exact: true })
            .waitFor({ state: "visible" });
          await capture("admin-review");
          await context.close();
          continue;
        }
        await page.goto(`${origin}/${locale}/sell`);
        await page
          .getByLabel(copy.sell.when.nameLabel)
          .waitFor({ state: "visible" });
        await capture("booking-details");
        await page
          .getByLabel(copy.sell.when.nameLabel)
          .fill("Synthetic household");
        await page
          .getByLabel(copy.sell.when.addressLabel)
          .fill("Sample address, Bengaluru");
        await page
          .locator('input[type="file"]')
          .setInputFiles(
            path.resolve("public/images/showcase/material-yard.webp"),
          );
        await page
          .getByRole("button", { name: copy.sell.simple.next, exact: true })
          .click();
        await page
          .getByRole("radio", { name: /Synthetic neighbourhood shop/u })
          .click();
        const combos = page.getByRole("combobox");
        await combos.nth(0).click();
        await page.getByRole("option").first().click();
        await combos.nth(1).click();
        await page.getByRole("option").first().click();
        await capture("booking-review");
        await page.goto(`${origin}/${locale}/join/kabadiwala?entry=1`);
        await page
          .getByLabel(copy.join.consent.age)
          .waitFor({ state: "visible" });
        await capture("registration-entry");
        await page.goto(`${origin}/${locale}/app?role=yard`);
        await page.getByRole("main").waitFor({ state: "visible" });
        await capture("business-home");
        await context.close();
      }
    }
  }
} finally {
  await browser.close();
  await writeFile(
    path.join(output, isAdminOnly ? "admin-fixtures.json" : "fixtures.json"),
    JSON.stringify(
      {
        provenance:
          "Synthetic fixtures; real current components. All writes disabled. No provider acceptance.",
        records,
      },
      null,
      2,
    ),
  );
}
process.stdout.write(`Captured ${records.length} current component views.\n`);
