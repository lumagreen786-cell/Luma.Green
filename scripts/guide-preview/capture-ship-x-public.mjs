/** Capture local public UI and empty auth states. Never submit provider forms. */
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import { chromium } from "@playwright/test";

const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3011";
if (!["127.0.0.1", "localhost", "[::1]"].includes(new URL(baseURL).hostname)) {
  throw new Error("Capture requires a local server.");
}
const output = path.resolve(
  "docs/delivery/evidence/ship-x-redo-public-2026-11-11",
);
fs.mkdirSync(output, { recursive: true });
const digest = (bytes) => createHash("sha256").update(bytes).digest("hex");
// Exclude generated manifests: the capture writes them while it runs.
const sourceDiff = () =>
  execFileSync(
    "/usr/bin/git",
    [
      "diff",
      "HEAD",
      "--binary",
      "--",
      "src",
      "apps",
      "messages",
      "public",
      "scripts",
      "next.config.ts",
      "package.json",
      "pnpm-lock.yaml",
      "tsconfig.json",
    ],
    { maxBuffer: 64 * 1024 * 1024 },
  );
const publicRoutes = [
  "/en",
  "/en/how-it-works",
  "/en/participants",
  "/en/prices",
  "/en/standards",
  "/en/solar",
  "/en/join",
  "/en/contact",
  "/en/help",
  "/en/help/contact",
  "/en/help/kabadiwala",
  "/en/privacy",
  "/en/sell",
  "/en/sell/activity",
  "/en/sell/services",
  "/en/sell/footprint",
  "/en/sell/settings",
  "/en/login",
  "/en/login/verify",
];
const cases = publicRoutes.map((route) => ({
  route,
  width: 1440,
  height: 1000,
}));
for (const route of [
  "/en",
  "/en/login",
  "/en/sell",
  "/en/sell/services",
  "/en/sell/footprint",
  "/en/sell/settings",
  "/en/join",
  "/en/help/contact",
  "/ar",
  "/ar/login",
  "/ar/sell",
  "/ta",
  "/ta/sell",
])
  cases.push({ route, width: 390, height: 844 });
for (const route of ["/en", "/en/sell", "/ar/sell"])
  cases.push({ route, width: 768, height: 1024 });
for (const route of [
  "/admin/login",
  "/admin/setup",
  "/admin/forgot-password",
  "/admin/reset-password",
  "/en/login/email/reset",
  "/en/login/email/verify",
  "/en/login/email/complete",
])
  cases.push({ route, width: 1440, height: 1000 });
for (const route of ["/admin/login", "/admin/setup"])
  cases.push({ route, width: 390, height: 844 });
const manifest = {
  capturedAt: new Date().toISOString(),
  baseURL,
  head: execFileSync("/usr/bin/git", ["rev-parse", "HEAD"], {
    encoding: "utf8",
  }).trim(),
  buildId: fs.readFileSync(".next/BUILD_ID", "utf8").trim(),
  trackedDiffSha256: digest(sourceDiff()),
  context:
    "Actual disconnected production build in isolated Chromium. No sign-in, OTP, provider submission or production acceptance. Redirects are recorded. Solar examples use clearly synthetic local inputs.",
  captures: [],
};
const browser = await chromium.launch({ headless: true });
try {
  const context = await browser.newContext({
    reducedMotion: "reduce",
    colorScheme: "light",
  });
  await context.addInitScript(() =>
    localStorage.setItem("lg.languageChosen", "1"),
  );
  const page = await context.newPage();
  async function capture(entry, file, selector) {
    const imagePath = path.join(output, file);
    // Keep sticky navigation at the document top in full-page evidence.
    if (!selector) {
      await page.evaluate(() =>
        window.scrollTo({ top: 0, behavior: "instant" }),
      );
      await page.evaluate(
        () =>
          new Promise((resolve) =>
            requestAnimationFrame(() => requestAnimationFrame(resolve)),
          ),
      );
    }
    // Full-page evidence must include images below the initial viewport.
    const brokenImages = await page.evaluate(async () => {
      await document.fonts.ready;
      const images = [...document.images];
      for (const image of images) image.loading = "eager";
      let timer;
      await Promise.race([
        Promise.allSettled(images.map((image) => image.decode())),
        new Promise((resolve) => {
          timer = setTimeout(resolve, 10_000);
        }),
      ]);
      clearTimeout(timer);
      return images
        .filter((image) => !image.complete || image.naturalWidth === 0)
        .map((image) => ({
          src: image.currentSrc || image.src,
          alt: image.alt,
          complete: image.complete,
        }));
    });
    if (selector)
      await page
        .locator(selector)
        .first()
        .screenshot({ path: imagePath, animations: "disabled" });
    else
      await page.screenshot({
        path: imagePath,
        fullPage: true,
        animations: "disabled",
      });
    const finalURL = page.url();
    const canonical = entry.route.replace(/^\/en(?=\/|$)/, "") || "/";
    const heading = (await page.locator("h1").count())
      ? await page.locator("h1").first().textContent()
      : null;
    manifest.captures.push({
      ...entry,
      file,
      finalURL,
      redirected: new URL(finalURL).pathname !== canonical,
      heading,
      brokenImages,
      passed:
        brokenImages.length === 0 && entry.status >= 200 && entry.status < 400,
      sha256: digest(fs.readFileSync(imagePath)),
      visualInspection: "pending",
      bounds: await page.evaluate(() => ({
        innerWidth,
        scrollWidth: document.documentElement.scrollWidth,
        height: document.documentElement.scrollHeight,
      })),
    });
    fs.writeFileSync(
      path.join(output, "manifest.json"),
      JSON.stringify(manifest, null, 2),
    );
  }
  for (const entry of cases) {
    await page.setViewportSize({ width: entry.width, height: entry.height });
    const response = await page.goto(baseURL + entry.route, {
      waitUntil: "networkidle",
    });
    await page.evaluate(() => document.fonts.ready);
    await capture(
      {
        ...entry,
        status: response?.status(),
        evidenceLabel: "Actual disconnected public UI",
      },
      entry.route.slice(1).replaceAll("/", "-") + "-" + entry.width + ".png",
    );
  }
  // Calculator-only example. Block all external requests; never touch its contact form.
  await context.route("**/*", (route) =>
    new URL(route.request().url()).origin === baseURL
      ? route.continue()
      : route.abort(),
  );
  await page.goto(baseURL + "/en/solar", { waitUntil: "networkidle" });
  await page.locator("#solar-amount").fill("3000");
  await page.locator("#solar-roof").fill("400");
  await page.evaluate(() => document.fonts.ready);
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 1000 });
    const entry = {
      route: "/en/solar",
      width,
      height: 1000,
      status: 200,
      evidenceLabel: "Synthetic local solar estimate",
      context:
        "Synthetic home example: monthly electricity bill INR 3000, roof 400 sq ft. Existing calculator assumptions; not an actual bill, quote, subsidy decision or measured savings. No submission; external network blocked.",
    };
    await capture(entry, `en-solar-example-${width}.png`);
    if (width === 1440)
      await capture(
        { ...entry, context: entry.context + " Cropped calculated chart." },
        "en-solar-example-chart-1440.png",
        "figure:has(svg)",
      );
  }
  manifest.finishedAt = new Date().toISOString();
  manifest.finalTrackedDiffSha256 = digest(sourceDiff());
  manifest.sourceUnchanged =
    manifest.finalTrackedDiffSha256 === manifest.trackedDiffSha256;
  manifest.passed =
    manifest.sourceUnchanged &&
    manifest.captures.every((capture) => capture.passed);
  if (!manifest.passed) process.exitCode = 1;
  fs.writeFileSync(
    path.join(output, "manifest.json"),
    JSON.stringify(manifest, null, 2),
  );
  process.stdout.write(
    `Captured ${manifest.captures.length} images in ${output}\n`,
  );
} finally {
  await browser.close();
}
