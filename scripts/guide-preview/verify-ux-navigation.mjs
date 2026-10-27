import { readFile, writeFile } from "node:fs/promises";

import { chromium } from "@playwright/test";
import { createJiti } from "jiti";

const jiti = createJiti(import.meta.url);
const { locales } = await jiti.import("../../src/i18n/locales.ts");
const browser = await chromium.launch();
const results = [];
try {
  const page = await browser.newPage({ reducedMotion: "reduce" });
  const errors = [];
  page.on("pageerror", (error) => {
    errors.push(error.message);
  });
  await page.route("**/*", (route) => {
    const url = new URL(route.request().url());
    return ["127.0.0.1", "localhost"].includes(url.hostname)
      ? route.continue()
      : route.abort();
  });
  const selectedLocales = locales.filter(
    (value) =>
      !process.env.UX_NAV_LOCALE || value === process.env.UX_NAV_LOCALE,
  );
  for (const locale of selectedLocales) {
    const copy = JSON.parse(await readFile(`messages/${locale}.json`, "utf8"));
    await page.goto(`http://127.0.0.1:3218/${locale}/app?role=yard`);
    await page.getByRole("main").waitFor({ state: "visible" });
    await page.evaluate(async () => document.fonts.ready);
    for (const colorScheme of ["light", "dark"]) {
      await page.emulateMedia({ colorScheme });
      for (const width of [320, 390, 640, 768, 1024, 1280, 1440]) {
        await page.setViewportSize({ width, height: 900 });
        await page.getByRole("main").waitFor({ state: "visible" });
        await page.evaluate(async () => document.fonts.ready);
        const navigation = page.getByRole("navigation", {
          name: copy.app.navLabel,
          exact: true,
        });
        const controls = navigation
          .getByRole("link")
          .or(navigation.getByRole("button"));
        if (width < 1280) {
          await navigation
            .getByRole("button", { name: copy.app.more, exact: true })
            .waitFor({ state: "visible" });
          // Let ResizeObserver and React commit their measured capacity.
          await page.evaluate(async () => {
            await new Promise((resolve) => {
              requestAnimationFrame(resolve);
            });
            await new Promise((resolve) => {
              requestAnimationFrame(resolve);
            });
          });
          const invalid = await controls.evaluateAll((elements) =>
            elements.flatMap((element) => {
              const rect = element.getBoundingClientRect();
              const text = document.createRange();
              text.selectNodeContents(element);
              const painted = text.getBoundingClientRect();
              return rect.x < -1 ||
                rect.right > innerWidth + 1 ||
                rect.height < 44 ||
                painted.width > rect.width + 2
                ? [element.textContent]
                : [];
            }),
          );
          if (invalid.length > 0)
            throw new Error(
              `${locale} ${width} ${colorScheme}: navigation bounds ${JSON.stringify(invalid)}`,
            );
        }
        const overflow = await page.evaluate(
          () => document.documentElement.scrollWidth > innerWidth,
        );
        if (overflow || errors.length > 0)
          throw new Error(
            `${locale} ${width}: ${JSON.stringify({ overflow, errors })}`,
          );
        results.push({ locale, width, colorScheme });
      }
    }
  }
} finally {
  await browser.close();
  await writeFile(
    new URL(
      "../../docs/delivery/evidence/web-ux-2026-10-27/navigation.json",
      import.meta.url,
    ),
    JSON.stringify(results, null, 2),
  );
}
process.stdout.write(`Verified ${results.length} navigation views.\n`);
