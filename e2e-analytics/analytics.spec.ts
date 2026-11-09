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
    if (url.hostname === "127.0.0.1" || url.hostname === "localhost") {
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
        url.hostname === "www.googletagmanager.com"
          ? "application/javascript"
          : "application/json",
      body:
        url.hostname === "www.googletagmanager.com"
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

test("choice is required and a refusal keeps all vendor requests off", async ({
  page,
}) => {
  const requests = await interceptVendors(page);
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/");
  await expect(
    page.getByRole("button", { name: en.analytics.accept }),
  ).toBeVisible();
  await expect(page.getByRole("main")).toBeVisible();
  expect(requests).toEqual([]);
  await captureGuide(page, "analytics-choice");
  await page.getByRole("button", { name: en.analytics.decline }).click();
  await expect(
    page.getByRole("button", { name: en.analytics.settings }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole("button", { name: en.analytics.settings }),
  ).toBeVisible();
  await expect(page.getByRole("main")).toBeVisible();
  expect(requests).toEqual([]);
});

test("a simulated human can consent to manual public page views without URL secrets", async ({
  page,
}) => {
  const requests = await interceptVendors(page);
  // PostHog deliberately drops navigator.webdriver traffic. Model a human only
  // in this accepted-consent case; keep the production bot filter enabled.
  await page.addInitScript(() => {
    Object.defineProperties(navigator, {
      webdriver: { get: () => false },
      userAgentData: {
        get: () => ({
          brands: [{ brand: "Google Chrome", version: "153" }],
          mobile: false,
          platform: "Windows",
        }),
      },
    });
  });
  await page.goto("/?phone=private-phone#private-token");
  expect(await page.evaluate(() => navigator.webdriver)).toBe(false);
  await page.getByRole("button", { name: en.analytics.accept }).click();
  await expect
    .poll(
      () =>
        requests.filter(
          ({ url }) =>
            url.includes("posthog.com") &&
            (url.includes("/i/") || url.includes("/e/")),
        ).length,
    )
    .toBeGreaterThan(0);
  const posthogRequest = requests.find(
    ({ url }) =>
      url.includes("posthog.com") &&
      (url.includes("/i/") || url.includes("/e/")),
  );
  expect(posthogRequest?.body).toContain("$pageview");
  expect(posthogRequest?.body).toContain('"page":"/"');
  const commands = await page.evaluate(() =>
    (window.dataLayer ?? []).map((command) =>
      Array.from({ length: command.length }, (_, index) => command[index]),
    ),
  );
  expect(commands).toContainEqual([
    "event",
    "page_view",
    expect.objectContaining({
      page: "/",
      locale: "en",
      page_location: "http://localhost:3106/",
      page_referrer: "",
    }),
  ]);
  expect(JSON.stringify(commands)).not.toContain("private-");
  expect(JSON.stringify(requests)).not.toContain("private-");
  await page.goto("/prices?phone=private-phone#private-token");
  await expect
    .poll(async () =>
      page.evaluate(
        () =>
          window.dataLayer?.filter((command) => command[0] === "event")
            .length ?? 0,
      ),
    )
    .toBe(1);
  expect(
    await page.evaluate(() =>
      (window.dataLayer ?? []).map((command) =>
        Array.from({ length: command.length }, (_, index) => command[index]),
      ),
    ),
  ).toContainEqual([
    "event",
    "page_view",
    expect.objectContaining({
      page: "/prices",
      page_location: "http://localhost:3106/prices",
    }),
  ]);
  await expect(page.getByRole("main")).toBeVisible();
  const count = requests.length;
  await page.goto("/sell?phone=private-phone#private-token");
  await expect(page.getByRole("main")).toBeVisible();
  expect(requests).toHaveLength(count);
  expect(
    await page.evaluate(() =>
      (window.dataLayer ?? []).map((command) =>
        Array.from({ length: command.length }, (_, index) => command[index]),
      ),
    ),
  ).toEqual([]);
});

test("the privacy notice lets a visitor withdraw analytics consent in one action", async ({
  page,
}) => {
  const requests = await interceptVendors(page);
  await page.goto("/");
  await page.getByRole("button", { name: en.analytics.accept }).click();
  await expect
    .poll(() => requests.some(({ url }) => url.includes("googletagmanager")))
    .toBe(true);
  const beforePrivacy = requests.length;
  await page.goto("/privacy");
  await expect(
    page.getByRole("button", { name: en.analytics.withdraw }),
  ).toBeVisible();
  expect(requests).toHaveLength(beforePrivacy);
  await Promise.all([
    page.waitForEvent("load"),
    page.getByRole("button", { name: en.analytics.withdraw }).click(),
  ]);
  await expect(
    page.getByRole("complementary", { name: en.analytics.title }),
  ).toHaveCount(0);
  await expect(page.getByRole("main")).toBeVisible();
  const count = requests.length;
  await page.reload();
  await expect(
    page.getByRole("complementary", { name: en.analytics.title }),
  ).toHaveCount(0);
  await expect(page.getByRole("main")).toBeVisible();
  expect(requests).toHaveLength(count);
  expect(
    await page.evaluate(() => localStorage.getItem("luma.analytics.v1")),
  ).toBe("denied");
  await page.goto("/");
  await expect(
    page.getByRole("button", { name: en.analytics.settings }),
  ).toBeVisible();
  expect(requests).toHaveLength(count);
  expect(
    await page.evaluate(() =>
      (window.dataLayer ?? []).map((command) =>
        Array.from({ length: command.length }, (_, index) => command[index]),
      ),
    ),
  ).toEqual([]);
});

test("a storage error leaves analytics off and the controls usable", async ({
  page,
}) => {
  const requests = await interceptVendors(page);
  await page.addInitScript(() => {
    Object.defineProperty(Storage.prototype, "setItem", {
      value() {
        throw new DOMException("Test storage failure", "QuotaExceededError");
      },
    });
  });
  await page.goto("/");
  await page.getByRole("button", { name: en.analytics.accept }).click();
  await expect(
    page
      .getByRole("complementary", { name: en.analytics.title })
      .getByRole("alert"),
  ).toHaveText(en.analytics.unavailable);
  await expect(
    page.getByRole("button", { name: en.analytics.decline }),
  ).toBeEnabled();
  await page.getByRole("button", { name: en.analytics.decline }).click();
  await expect(
    page
      .getByRole("complementary", { name: en.analytics.title })
      .getByRole("alert"),
  ).toHaveText(en.analytics.unavailable);
  await expect(page.getByRole("main")).toBeVisible();
  expect(requests).toEqual([]);
});

test("Arabic controls retain RTL layout on a narrow phone", async ({
  page,
}) => {
  const requests = await interceptVendors(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/ar");
  await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
  await expect(
    page.getByRole("button", { name: ar.analytics.accept }),
  ).toBeVisible();
  await expect(page.getByRole("main")).toBeVisible();
  await captureGuide(page, "analytics-choice-arabic");
  await page.getByRole("button", { name: ar.analytics.decline }).click();
  await expect(
    page.getByRole("button", { name: ar.analytics.settings }),
  ).toBeVisible();
  expect(requests).toEqual([]);
});
