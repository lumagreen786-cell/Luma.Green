import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { gunzipSync } from "node:zlib";

import { expect, type Page, test } from "@playwright/test";

import ar from "../messages/ar.json";
import en from "../messages/en.json";

const browserErrors = new WeakMap<Page, string[]>();

interface VendorRequest {
  url: string;
  body: string;
}
async function interceptVendors(page: Page) {
  const requests: VendorRequest[] = [];
  const errors: string[] = [];
  browserErrors.set(page, errors);
  page.on("pageerror", (error) => {
    errors.push(error.message);
  });
  await page.route("**/*", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (
      (url.hostname === "127.0.0.1" || url.hostname === "localhost") &&
      !url.pathname.startsWith("/_vercel/insights/")
    ) {
      await route.continue();
      return;
    }
    const buffer = request.postDataBuffer();
    let body = buffer?.toString("utf8") ?? "";
    if (buffer?.[0] === 0x1f && buffer[1] === 0x8b)
      body = gunzipSync(buffer).toString("utf8");
    requests.push({ url: request.url(), body });
    await route.fulfill({
      status: 200,
      contentType:
        url.hostname === "www.googletagmanager.com" ||
        url.pathname === "/_vercel/insights/script.js"
          ? "application/javascript"
          : "application/json",
      body:
        url.hostname === "www.googletagmanager.com" ||
        url.pathname === "/_vercel/insights/script.js"
          ? "/* Test stub: real vendor execution is intentionally blocked. */"
          : '{"status":1}',
      headers: { "access-control-allow-origin": "*" },
    });
  });
  return requests;
}

const captures: Record<string, unknown>[] = [];
async function captureGuide(page: Page, filename: string) {
  if (process.env.GUIDE_CAPTURE !== "true") return;
  await page.evaluate(async () => {
    await document.fonts.ready;
  });
  const path = `docs/user-guide/screenshots/${filename}.png`;
  await page.screenshot({ path, fullPage: false, animations: "disabled" });
  const sha256 = createHash("sha256")
    .update(await readFile(path))
    .digest("hex");
  // The fixed Git command reads only the current source revision for provenance.
  // eslint-disable-next-line sonarjs/no-os-command-from-path
  const sourceRevision = execFileSync("git", ["rev-parse", "HEAD"], {
    encoding: "utf8",
  }).trim();
  const sourceHashes = Object.fromEntries(
    await Promise.all(
      [
        "src/components/providers/analytics-controls.tsx",
        "src/components/providers/analytics-enabled.tsx",
        "src/components/providers/analytics-provider.tsx",
        "src/lib/analytics-runtime.ts",
        "src/lib/analytics.ts",
        "src/components/site/home/hero.tsx",
        "src/components/site/action-name.ts",
        "src/components/site/public-effects.module.css",
        "src/components/site/site-header.tsx",
        "src/components/site/mobile-nav.tsx",
        "src/components/site/site-nav.tsx",
        "src/components/site/language-switcher.tsx",
        "src/components/brand/logo.tsx",
        "src/components/brand/logo.module.css",
        "src/components/theme/theme-toggle.tsx",
        "src/components/ui/button.tsx",
        "src/components/site/container.tsx",
        "src/app/globals.css",
        "src/lib/fonts.ts",
        "public/images/materials-hall.webp",
        "messages/en.json",
        "messages/ar.json",
      ].map(async (source): Promise<readonly [string, string]> => [
        source,
        createHash("sha256")
          .update(await readFile(source))
          .digest("hex"),
      ]),
    ),
  );
  captures.push({
    sourceHashes,
    browserErrors: browserErrors.get(page) ?? [],
    path,
    sha256,
    sourceRevision,
    url: page.url(),
    capturedAt: new Date().toISOString(),
    viewport: page.viewportSize(),
    reducedMotion: "reduce",
    browserVersion: page.context().browser()?.version(),
    fullPage: false,
    sourceKind: "current-local-configured-fake-keys",
    actualBrowserUI: true,
    syntheticRecords: false,
    externalRequestsIntercepted: true,
    productionProviderExecutionTested: false,
    note: "Actual application UI. Fake analytics keys enable controls. Every external browser request is intercepted, including any monitoring request from a compiled fake Sentry DSN; no vendor receives data. Convex is disabled.",
  });
  await writeFile(
    "docs/user-guide/analytics-captures.json",
    `${JSON.stringify({ captures }, null, 2)}\n`,
  );
}

test.afterEach(({ page }) => {
  expect(browserErrors.get(page) ?? []).toEqual([]);
});

test("public counts start without a banner or required tap; saved opt-out stops them", async ({
  page,
}) => {
  const requests = await interceptVendors(page);
  await page.goto("/");
  await expect(
    page.getByRole("button", { name: en.analytics.settings }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: en.analytics.accept }),
  ).toHaveCount(0);
  await expect
    .poll(() => requests.some(({ body }) => body.includes("$pageview")))
    .toBe(true);
  expect(requests.some(({ url }) => url.includes("googletagmanager"))).toBe(
    false,
  );
  expect(
    await page.evaluate(() => localStorage.getItem("luma.analytics.v1")),
  ).toBeNull();
  await captureGuide(page, "analytics-choice");
  await page.getByRole("button", { name: en.analytics.settings }).click();
  await page.getByRole("button", { name: en.analytics.decline }).click();
  await expect(
    page.getByRole("button", { name: en.analytics.settings }),
  ).toBeVisible();
  const count = requests.length;
  await page.reload();
  await expect(
    page.getByRole("button", { name: en.analytics.settings }),
  ).toBeVisible();
  expect(requests).toHaveLength(count);
});

test("automatic PostHog views strip URL secrets and exclude private routes", async ({
  page,
}) => {
  const requests = await interceptVendors(page);
  await page.goto("/?phone=private-phone#private-token");
  await expect
    .poll(() => requests.some(({ body }) => body.includes("$pageview")))
    .toBe(true);
  expect(JSON.stringify(requests)).not.toContain("private-");
  const count = requests.length;
  await page.goto("/sell?phone=private-phone#private-token");
  await expect(page.getByRole("main")).toBeVisible();
  expect(requests).toHaveLength(count);
});

test("privacy settings allow opt-out without measuring the privacy page", async ({
  page,
}) => {
  const requests = await interceptVendors(page);
  await page.goto("/privacy");
  await page.getByRole("button", { name: en.analytics.settings }).click();
  await page.getByRole("button", { name: en.analytics.decline }).click();
  await expect(
    page.getByRole("button", { name: en.analytics.settings }),
  ).toBeVisible();
  expect(
    await page.evaluate(() => localStorage.getItem("luma.analytics.v1")),
  ).toBe("denied");
  await page.goto("/");
  await expect(
    page.getByRole("button", { name: en.analytics.settings }),
  ).toBeVisible();
  expect(requests).toEqual([]);
});

test("storage failure leaves analytics off", async ({ page }) => {
  const requests = await interceptVendors(page);
  await page.addInitScript(() => {
    Object.defineProperty(Storage.prototype, "getItem", {
      value() {
        throw new DOMException("Test storage failure", "SecurityError");
      },
    });
  });
  await page.goto("/");
  await expect(
    page.getByRole("button", { name: en.analytics.settings }),
  ).toBeVisible();
  expect(requests).toEqual([]);
});

test("Arabic optional settings fit a narrow phone", async ({ page }) => {
  await interceptVendors(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/ar");
  await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
  await page.getByRole("button", { name: ar.analytics.settings }).click();
  await expect(
    page.getByRole("button", { name: ar.analytics.accept }),
  ).toBeVisible();
  await captureGuide(page, "analytics-choice-arabic");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});
