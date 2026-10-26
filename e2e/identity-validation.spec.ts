import { expect, type Page, test } from "@playwright/test";

import ar from "../messages/ar.json";
import en from "../messages/en.json";
import kn from "../messages/kn.json";

async function openRegisteredForm(
  page: Page,
  origin: string,
  locale: string,
  kind: string,
  yes: string,
  suffix = "",
) {
  await page.goto(`${origin}/${locale}/join/${kind}${suffix}`);
  await expect(page.getByText(/Synthetic interface fixture/u)).toBeVisible();
  await expect(page.locator("input").first()).toHaveCSS("height", "48px");
  const choices = await page
    .getByRole("radio", { name: yes, exact: true })
    .all();
  for (const choice of choices) await choice.check();
}

/** Isolated current components, synthetic metadata, no provider/auth acceptance. */
const origin = process.env.IDENTITY_FIXTURE_ORIGIN;
if (!origin || !/^http:\/\/127\.0\.0\.1:\d+$/u.test(origin))
  throw new Error("Use a loopback fixture origin");
for (const { locale, copy } of [
  { locale: "en", copy: en },
  { locale: "ar", copy: ar },
  { locale: "kn", copy: kn },
]) {
  for (const width of [390, 768, 1440]) {
    for (const theme of ["light", "dark"] as const) {
      test(`${locale} GST confirmation ${String(width)}px ${theme}`, async ({
        page,
      }, testInfo) => {
        await page.setViewportSize({ width, height: 1100 });
        await page.emulateMedia({
          colorScheme: theme,
          reducedMotion: "reduce",
        });
        await page.goto(`${origin}/${locale}/join/saathi`);
        await expect(
          page.getByRole("textbox", {
            name: copy.join.saathi.name,
            exact: true,
          }),
        ).toBeVisible();
        await expect(page.getByLabel(copy.join.identity.pan)).toHaveCount(0);
        await expect(
          page.getByRole("button", { name: copy.join.identity.check }),
        ).toHaveCount(0);
        await page.screenshot({
          path: testInfo.outputPath("saathi-no-pan.png"),
          fullPage: true,
        });
        for (const kind of ["kabadiwala", "yard"]) {
          await openRegisteredForm(
            page,
            origin,
            locale,
            kind,
            copy.join.form.yes,
          );
          await expect(
            page.getByText(/Synthetic interface fixture/u),
          ).toBeVisible();
          const gst = page.getByRole("textbox", {
            name: copy.join.form.gstin,
            exact: true,
          });
          await page.getByLabel(copy.join.identity.pan).fill("ABCDE1234F");
          await page
            .getByRole("button", {
              name: copy.join.discovery.find,
              exact: true,
            })
            .click();
          await expect(
            page.getByText("29ABCDE1234F1Z5", { exact: true }),
          ).toBeVisible();
          await expect(
            page.getByRole("button", {
              name: copy.join.discovery.inactive,
              exact: true,
            }),
          ).toBeDisabled();
          await page
            .getByRole("button", {
              name: copy.join.discovery.select,
              exact: true,
            })
            .click();
          await expect(gst).toHaveValue("29ABCDE1234F1Z5");
          await page
            .getByRole("button", {
              name: copy.join.identity.check,
              exact: true,
            })
            .click();
          await expect(
            page.getByText("Synthetic Recycling Works", { exact: true }),
          ).toBeVisible();
          await expect(
            page.getByText("Sample registered address, Bengaluru", {
              exact: true,
            }),
          ).toBeVisible();
          await page.evaluate(async () => document.fonts.ready);
          expect(
            await page.evaluate(
              () => document.documentElement.scrollWidth <= innerWidth,
            ),
          ).toBe(true);
          await page.screenshot({
            path: testInfo.outputPath(`${kind}-preview.png`),
            fullPage: true,
          });
          await page
            .getByRole("button", {
              name: copy.join.identity.confirm,
              exact: true,
            })
            .click();
          await expect(
            page.getByRole("button", { name: copy.auth.continue, exact: true }),
          ).toBeVisible();
          await expect(
            page.getByRole("textbox", {
              name: copy.join.form.gstin,
              exact: true,
            }),
          ).toHaveValue("29ABCDE1234F1Z5");
          await page.screenshot({
            path: testInfo.outputPath(`${kind}-confirmed.png`),
            fullPage: true,
          });
          await openRegisteredForm(
            page,
            origin,
            locale,
            kind,
            copy.join.form.yes,
            "?scenario=limit",
          );
          await page.getByLabel(copy.join.identity.pan).fill("ABCDE1234F");
          await page
            .getByRole("button", {
              name: copy.join.discovery.find,
              exact: true,
            })
            .click();
          await expect(
            page.getByText(copy.join.identity.limit, { exact: true }),
          ).toBeVisible();
          await expect(page.getByLabel(copy.join.identity.pan)).toHaveValue(
            "ABCDE1234F",
          );
        }
      });
    }
  }
}
