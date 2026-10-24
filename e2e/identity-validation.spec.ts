import { expect, type Page, test } from "@playwright/test";

import ar from "../messages/ar.json";
import en from "../messages/en.json";
import kn from "../messages/kn.json";

async function fillRequiredGst(page: Page, label: string) {
  const inputs = await page
    .getByRole("textbox", { name: label, exact: true })
    .all();
  for (const input of inputs) {
    await input.fill("29ABCDE1234F1Z5");
  }
}

/** Run only with isolated loopback component adapters; no account/provider claims. */
const origin = process.env.IDENTITY_FIXTURE_ORIGIN;
if (!origin || !/^http:\/\/127\.0\.0\.1:\d+$/u.test(origin))
  throw new Error(
    "Use a loopback fixture origin with the dedicated test config",
  );
// Separate loopback fixture config owns these tests; production config excludes them.
for (const { locale, copy } of [
  { locale: "en", copy: en },
  { locale: "ar", copy: ar },
  { locale: "kn", copy: kn },
]) {
  for (const width of [390, 768, 1440]) {
    for (const theme of ["light", "dark"] as const) {
      test(`${locale} identity control ${String(width)}px ${theme}`, async ({
        page,
      }, testInfo) => {
        await page.setViewportSize({ width, height: 1100 });
        await page.emulateMedia({
          colorScheme: theme,
          reducedMotion: "reduce",
        });
        for (const kind of ["kabadiwala", "yard", "saathi"]) {
          await page.goto(`${origin}/${locale}/join/${kind}`);
          await expect(
            page.getByText(/Synthetic interface fixture/u),
          ).toBeVisible();
          await fillRequiredGst(page, copy.join.form.gstin);
          const pan = page.getByRole("textbox", {
            name: copy.join.identity.pan,
            exact: true,
          });
          await pan.fill("ABCDE1234F");
          await page
            .getByRole("button", {
              name: copy.join.identity.check,
              exact: true,
            })
            .click();
          await expect(
            page
              .getByText(copy.join.identity.verified, { exact: true })
              .first(),
          ).toBeVisible();
          await pan.fill("ABCDE1234G");
          await expect(
            page.getByText(copy.join.identity.verified, { exact: true }),
          ).toHaveCount(0);
          await page.evaluate(async () => document.fonts.ready);
          expect(
            await page.evaluate(
              () => document.documentElement.scrollWidth <= innerWidth,
            ),
          ).toBe(true);
          await page.screenshot({
            path: testInfo.outputPath(`${kind}.png`),
            fullPage: true,
          });
          await page.goto(`${origin}/${locale}/join/${kind}?scenario=limit`);
          await fillRequiredGst(page, copy.join.form.gstin);
          await page
            .getByRole("textbox", { name: copy.join.identity.pan, exact: true })
            .fill("ABCDE1234F");
          await page
            .getByRole("button", {
              name: copy.join.identity.check,
              exact: true,
            })
            .click();
          await expect(
            page.getByText(copy.join.identity.limit, { exact: true }).first(),
          ).toBeVisible();
          await expect(
            page.getByRole("textbox", {
              name: copy.join.identity.pan,
              exact: true,
            }),
          ).toHaveValue("ABCDE1234F");
        }
      });
    }
  }
}

// Page translators replace React-owned text with their own element wrappers.
test("typing survives translated autosave status updates", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => {
    errors.push(error.message);
  });
  await page.goto(`${origin}/en/join/saathi?scenario=delayed-save`);
  const pan = page.getByRole("textbox", {
    name: en.join.identity.pan,
    exact: true,
  });
  await pan.fill("ABCDE1234F");
  const saving = page.getByText(en.join.form.saving, { exact: true });
  await expect(saving).toBeVisible();
  await saving.evaluate((element) => {
    const node = [...element.childNodes].find(
      (child) => child.nodeType === Node.TEXT_NODE,
    );
    if (!node) throw new Error("Missing saving text");
    const replacement = document.createElement("span");
    replacement.textContent = node.textContent;
    node.replaceWith(replacement);
  });
  await expect(
    page.getByText(en.join.form.saved, { exact: true }),
  ).toBeVisible();
  await pan.fill("ABCDE1234G");
  await expect(saving).toBeVisible();
  await expect(
    page.getByText(en.join.form.saved, { exact: true }),
  ).toBeVisible();
  await expect(pan).toHaveValue("ABCDE1234G");
  expect(errors).toEqual([]);
});
