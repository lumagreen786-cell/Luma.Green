/** Capture real, disconnected public pages for the maintained user guide. */
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";

import { chromium } from "@playwright/test";

import ar from "../messages/ar.json";
import en from "../messages/en.json";

const origin = new URL(process.env.GUIDE_BASE_URL ?? "http://localhost:3004");
if (!["localhost", "127.0.0.1"].includes(origin.hostname)) {
  throw new Error(
    "Use a local documentation preview, without real customer data.",
  );
}
const directory = "docs/user-guide/screenshots";
const shots: readonly (readonly [string, string, string?])[] = [
  ["public-home", "/"],
  ["public-home-dark", "/"],
  [
    "public-home-materials",
    "/",
    'section[aria-labelledby="materials-heading"]',
  ],
  ["public-home-pickup", "/", 'section[aria-labelledby="pickup-heading"]'],
  ["public-home-shop", "/", 'section[aria-labelledby="shop-workday-heading"]'],
  [
    "public-home-payment",
    "/",
    'section[aria-labelledby="weight-payment-heading"]',
  ],
  [
    "public-home-records",
    "/",
    'section[aria-labelledby="material-records-heading"]',
  ],
  [
    "public-home-questions",
    "/",
    'section[aria-labelledby="home-questions-heading"]',
  ],
  ["public-participants", "/participants"],
  ["public-participants-dark", "/participants"],
  ["public-arabic-dark", "/ar"],
  ["public-prices", "/prices"],
  ["public-sell", "/sell"],
  ["public-join", "/join"],
  ["public-login", "/login"],
  ["public-login-languages-phone", "/login"],
  ["public-login-languages-phone-dark", "/login"],
  ["public-login-phone", "/login"],
  ["public-login-otp-phone", "/login"],
  [
    "public-demo-testimonials",
    "/",
    'section[aria-labelledby="demo-testimonials-heading"]',
  ],
  ["public-admin-login", "/admin/login"],
  ["public-admin-setup", "/admin/setup"],
  ["public-help", "/help"],
  ["public-standards", "/standards"],
  ["public-solar", "/solar"],
  [
    "public-solar-details",
    "/solar",
    'section[aria-labelledby="solar-details"]',
  ],
  ["public-contact", "/help/contact"],
  ["public-contact-info", "/contact"],
  ["public-how-it-works", "/how-it-works"],
  [
    "public-sorting-guide",
    "/how-it-works",
    'section[aria-labelledby="sorting-guide-heading"]',
  ],
  [
    "public-price-guide-dark",
    "/prices",
    'section[aria-labelledby="price-guide-heading"]',
  ],
  [
    "public-join-preparation",
    "/join",
    'section[aria-labelledby="join-preparation-heading"]',
  ],
  [
    "public-help-topics",
    "/help",
    'section[aria-labelledby="help-topic-stories"]',
  ],
  ["public-arabic", "/ar"],
  ["public-navigation-phone", "/how-it-works"],
  ["public-navigation-tablet", "/how-it-works"],
  ["public-navigation-arabic-phone", "/ar/help"],
] as const;
await mkdir(directory, { recursive: true });
// eslint-disable-next-line sonarjs/no-os-command-from-path -- invoke the developer-installed Git only for read-only capture provenance.
const revision = execFileSync("git", ["rev-parse", "HEAD"], {
  encoding: "utf8",
}).trim();
const sharedSources = [
  "src/components/showcase/role-story-image.tsx",
  "src/components/site/sorting-guide.tsx",
  "src/components/prices/price-guide.tsx",
  "src/components/join/join-preparation.tsx",
  "src/components/help/topic-stories.tsx",
  "src/components/standards/norms.tsx",
  "src/app/[locale]/(site)/how-it-works/page.tsx",
  "src/app/[locale]/(site)/prices/page.tsx",
  "src/app/[locale]/(site)/join/page.tsx",
  "src/app/[locale]/(site)/help/page.tsx",
  "src/app/[locale]/(site)/standards/page.tsx",
  ...[
    "material-sorting",
    "fair-weighing",
    "recycled-pellets",
    "electronics-sorting",
    "household-preparation",
    "yard-dispatch",
  ].map((name) => `public/images/showcase/${name}.webp`),
  "src/app/globals.css",
  "src/lib/fonts.ts",
  "src/lib/number-input.ts",
  "src/components/solar/calc.ts",
  "src/components/solar/solar-planner.tsx",
  "src/components/solar/choice-group.tsx",
  "src/components/sell/draft.ts",
  "src/components/site/site-header.tsx",
  "src/components/site/mobile-nav.tsx",
  "src/components/site/site-nav.tsx",
  "src/components/site/section-heading.tsx",
  "src/components/site/page-header.tsx",
  "src/components/site/page-banner.tsx",
  "src/components/help/help-hero.tsx",
  "src/components/help/contact-panel.tsx",
  "src/components/help/contact-strip.tsx",
  "src/components/motion/reveal-targets.ts",
  "src/app/[locale]/(site)/participants/page.tsx",
  "src/components/site/closing-cta.tsx",
  "src/components/site/public-effects.module.css",
  "src/components/site/action-name.ts",
  "src/components/site/home/chain-diagram.tsx",
  "src/components/site/home/role-benefits.tsx",
  "src/components/site/home/hero.tsx",
  "src/components/site/home/material-directory.tsx",
  "src/components/site/home/pickup-journey.tsx",
  "src/components/site/home/shop-workday.tsx",
  "src/components/site/home/weight-payment.tsx",
  "src/components/site/home/material-records.tsx",
  "src/components/site/home/home-questions.tsx",
  "src/components/site/home/material-marquee.tsx",
  "src/components/site/home/material-marquee.module.css",
  "src/components/site/home/demo-testimonials.tsx",
  "src/components/site/home/price-teaser.tsx",
  "src/components/prices/price-board.tsx",
  "src/components/prices/price-placeholder.tsx",
  "src/components/join/role-cards.tsx",
  "src/components/site/language-switcher.tsx",
  "src/components/brand/logo.tsx",
  "src/components/brand/logo.module.css",
  "src/components/auth/phone-form.tsx",
  "src/components/auth/language-choice.tsx",
  "src/components/auth/login-flow.tsx",
  "src/components/auth/auth-progress.tsx",
  "src/components/auth/email-form.tsx",
  "src/components/auth/factor-challenge.tsx",
  "src/components/account/account-menu.tsx",
  "src/components/ui/tabs.tsx",
  "src/components/auth/storage.ts",
  "src/app/[locale]/(auth)/layout.tsx",
  "src/i18n/locales.ts",
  "src/components/auth/verify-preview.tsx",
  "messages/en.json",
  "messages/ar.json",
  "src/components/ui/button.tsx",
  "src/components/ui/input.tsx",
  "src/components/ui/label.tsx",
  "src/components/ui/radio-group.tsx",
  "public/images/materials-hall.webp",
] as const;
const sourceHashes = Object.fromEntries<string>(
  await Promise.all(
    sharedSources.map(async (file): Promise<[string, string]> => [
      file,
      createHash("sha256")
        .update(await readFile(file))
        .digest("hex"),
    ]),
  ),
);
const browser = await chromium.launch();
const captures = [];
try {
  for (const [name, route, sectionSelector] of shots) {
    const isLanguagePicker = name.startsWith("public-login-languages-");
    const isPhoneEntry =
      name === "public-login-phone" || name === "public-login-otp-phone";
    let viewport = { width: 1280, height: 900 };
    if (name.endsWith("-tablet")) {
      viewport = { width: 1024, height: 768 };
    } else if (name.startsWith("public-arabic") || name.includes("-phone")) {
      viewport = { width: 390, height: 844 };
    }
    const page = await browser.newPage({
      viewport,
      reducedMotion: "reduce",
      locale: "en-IN",
      colorScheme: name.endsWith("-dark") ? "dark" : "light",
    });
    const browserErrors: string[] = [];
    const blockedRequests: string[] = [];
    const authRequests: string[] = [];
    page.on("pageerror", (error) => {
      browserErrors.push(error.message);
    });
    if (isPhoneEntry) {
      await page.addInitScript(() => {
        localStorage.setItem("lg.languageChosen", "1");
      });
    }
    await page.route("**/*", async (route) => {
      const requestUrl = new URL(route.request().url());
      if (requestUrl.pathname.startsWith("/api/auth/")) {
        authRequests.push(requestUrl.pathname);
        await route.abort();
      } else if (requestUrl.origin === origin.origin) {
        await route.continue();
      } else {
        blockedRequests.push(new URL(route.request().url()).origin);
        await route.abort();
      }
    });
    try {
      const url = new URL(route, origin).href;
      const response = await page.goto(url);
      if (!response?.ok())
        throw new Error(
          `Cannot capture ${route}: ${String(response?.status() ?? "no response")}`,
        );
      await page.getByRole("heading", { level: 1 }).waitFor();
      if (isPhoneEntry) {
        await page.getByLabel(en.auth.mobileLabel, { exact: true }).waitFor();
      }
      if (isLanguagePicker) {
        await page
          .getByRole("searchbox", { name: en.common.search, exact: true })
          .waitFor();
        await page
          .getByRole("radiogroup", { name: en.common.language, exact: true })
          .waitFor();
      }
      if (name === "public-login-otp-phone") {
        throw new Error(
          "OTP captures require a configured test runtime. Disconnected OTP previews are disabled.",
        );
      }
      if (route === "/help/contact") {
        // Wait for the disconnected client state, not its Suspense skeleton.
        await page
          .locator('section[aria-labelledby="contact-form-heading"]')
          .getByRole("status")
          .waitFor();
      }
      if (name.startsWith("public-navigation-")) {
        const labels = route.startsWith("/ar") ? ar : en;
        await page
          .getByRole("button", { name: labels.nav.openMenu, exact: true })
          .click();
        await page
          .getByRole("dialog")
          .getByRole("button", { name: labels.theme.label, exact: true })
          .waitFor();
      }
      if (sectionSelector) {
        const sectionBounds = await page.locator(sectionSelector).boundingBox();
        if (!sectionBounds || sectionBounds.height > 1600) {
          throw new Error(
            "Home section must fit in a bounded documentation image.",
          );
        }
        // Keep the whole section below the sticky header so locator capture does
        // not scroll a tall target beneath it or include a partial header.
        await page.setViewportSize({
          width: 1280,
          height: Math.ceil(sectionBounds.height) + 160,
        });
        await page.locator(sectionSelector).evaluate((section) => {
          const header = document.querySelector("header");
          const offset = (header?.getBoundingClientRect().height ?? 0) + 16;
          window.scrollTo(
            0,
            section.getBoundingClientRect().top + window.scrollY - offset,
          );
        });
      }
      await page.evaluate(() => document.fonts.ready);
      // Keep capture readiness bounded if an optimizer response stalls.
      await page.waitForFunction(() =>
        [...document.images]
          .filter((image) => {
            const bounds = image.getBoundingClientRect();
            return (
              bounds.top < window.innerHeight &&
              bounds.bottom > 0 &&
              bounds.width > 0 &&
              bounds.height > 0
            );
          })
          .every((image) => image.complete && image.naturalWidth > 0),
      );
      // A completed network load can precede image decode and browser paint.
      // Wait for both so a guide capture cannot retain a gray image frame.
      await page.evaluate(async () => {
        const visibleImages = [...document.images].filter((image) => {
          const bounds = image.getBoundingClientRect();
          return (
            bounds.top < window.innerHeight &&
            bounds.bottom > 0 &&
            bounds.width > 0 &&
            bounds.height > 0
          );
        });
        await Promise.all(visibleImages.map((image) => image.decode()));
        await new Promise<void>((resolve) => {
          requestAnimationFrame(() => {
            requestAnimationFrame(() => {
              resolve();
            });
          });
        });
      });
      if (isLanguagePicker) {
        const list = await page
          .getByRole("radiogroup", { name: en.common.language, exact: true })
          .boundingBox();
        const continueAction = await page
          .getByRole("button", { name: en.auth.continue, exact: true })
          .boundingBox();
        if (
          !list ||
          !continueAction ||
          list.height > viewport.height * 0.4 ||
          continueAction.y + continueAction.height > viewport.height
        ) {
          throw new Error(
            "The language list must stay bounded and Continue must remain visible on the captured phone viewport.",
          );
        }
      }
      const path = `${directory}/${name}.png`;
      const sectionCapturePadding = name === "public-price-guide-dark" ? 16 : 0;
      if (sectionSelector && sectionCapturePadding > 0) {
        // Retain the real page gutter around the guide heading. This is a
        // browser clip of unchanged DOM, not image padding or a layout edit.
        const bounds = await page.locator(sectionSelector).boundingBox();
        const size = page.viewportSize();
        if (
          !bounds ||
          !size ||
          bounds.x < sectionCapturePadding ||
          bounds.y < sectionCapturePadding ||
          bounds.x + bounds.width + sectionCapturePadding > size.width ||
          bounds.y + bounds.height + sectionCapturePadding > size.height
        ) {
          throw new Error(
            "The guide section must fit with its real page gutter.",
          );
        }
        await page.screenshot({
          path,
          animations: "disabled",
          caret: "hide",
          clip: {
            x: bounds.x - sectionCapturePadding,
            y: bounds.y - sectionCapturePadding,
            width: bounds.width + sectionCapturePadding * 2,
            height: bounds.height + sectionCapturePadding * 2,
          },
        });
      } else if (sectionSelector) {
        await page
          .locator(sectionSelector)
          .screenshot({ path, animations: "disabled", caret: "hide" });
      } else {
        await page.screenshot({ path, animations: "disabled", caret: "hide" });
      }
      if (
        browserErrors.length > 0 ||
        blockedRequests.length > 0 ||
        authRequests.length > 0
      ) {
        throw new Error(
          `Capture ${route} had browser errors or external traffic`,
        );
      }
      captures.push({
        browserErrors,
        blockedRequests,
        authRequests,
        sourceHashes,
        name,
        route,
        sectionSelector,
        sectionCapturePadding,
        captureKind: sectionSelector ? "section" : "viewport",
        viewport: page.viewportSize(),
        theme: name.endsWith("-dark") ? "dark" : "light",
        path,
        url: page.url(),
        revision,
        capturedAt: new Date().toISOString(),
        kind: "current-local-disconnected",
        sha256: createHash("sha256")
          .update(await readFile(path))
          .digest("hex"),
      });
      process.stdout.write(`Captured ${route}\n`);
    } finally {
      await page.close();
    }
  }
} finally {
  await browser.close();
}
await writeFile(
  "docs/user-guide/public-captures.json",
  `${JSON.stringify(captures, null, 2)}\n`,
);
