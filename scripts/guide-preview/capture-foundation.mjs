import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { chromium } from "@playwright/test";

const origin = process.env.GUIDE_FIXTURE_ORIGIN ?? "http://127.0.0.1:3228";
const location = new URL(origin);
if (
  location.protocol !== "http:" ||
  location.hostname !== "127.0.0.1" ||
  location.pathname !== "/" ||
  location.search ||
  location.hash ||
  location.username ||
  location.password
)
  throw new Error("Capture requires an isolated loopback HTTP origin.");
const output = path.resolve(
  "docs/delivery/evidence/platform-foundation-2026-10-28",
);
const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");
function check(condition, message) {
  if (!condition) throw new Error(message);
}
async function hashFile(file) {
  return hash(await readFile(file));
}
const clock = "2026-10-14T06:00:00Z";
const screens = [
  {
    name: "household-request",
    route: "/en/sell",
    width: 390,
    component: "src/components/sell/simple-recycling-flow.tsx",
  },
  {
    name: "household-receipt",
    route: "/en/t/guide-demo-token?receipt=1",
    width: 390,
    component: "src/components/track/receipt-sharing.tsx",
    receipt: true,
  },
  {
    name: "shop-workspace",
    route: "/en/app",
    width: 1440,
    component: "src/components/shop/kabadiwala-home.tsx",
  },
  {
    name: "business-material",
    route: "/en/app/lots?role=yard",
    width: 1440,
    component: "src/components/lots/lots-page.tsx",
  },
  {
    name: "services",
    route: "/en/account/services",
    width: 1440,
    component: "src/components/services/services-page.tsx",
  },
  {
    name: "admin",
    route: "/admin",
    width: 1440,
    component: "src/components/admin/console-home.tsx",
  },
];
const variants = [
  { locale: "en", theme: "dark", width: 390 },
  { locale: "en", theme: "light", width: 768 },
  { locale: "ar", theme: "light", width: 390 },
  { locale: "ur", theme: "dark", width: 390 },
];
const releaseVariants = [
  { locale: "en", theme: "light", width: 390 },
  { locale: "en", theme: "dark", width: 390 },
  { locale: "en", theme: "light", width: 768 },
  { locale: "en", theme: "dark", width: 768 },
  { locale: "en", theme: "light", width: 1440 },
  { locale: "en", theme: "dark", width: 1440 },
  { locale: "ar", theme: "light", width: 390 },
  { locale: "ur", theme: "dark", width: 390 },
  { locale: "kn", theme: "light", width: 390 },
  { locale: "kn", theme: "dark", width: 768 },
];
const releaseScreens = [
  {
    name: "account-removal",
    route: "/en/account/removal",
    component: "src/components/account/account-removal.tsx",
    removal: true,
  },
  {
    name: "account-removal-held",
    route: "/en/account/removal?removal=held",
    component: "src/components/account/account-removal.tsx",
    removal: true,
  },
  {
    name: "account-removal-reauth",
    route: "/en/account/removal?removal=reauth",
    component: "src/components/account/account-removal.tsx",
    removal: true,
  },
  {
    name: "employer-handover",
    route: "/en/app",
    component: "src/components/collection/worker-handovers.tsx",
    scrollNamespace: "workerHandover",
    scrollRecord: "Example pickup handover",
  },
  {
    name: "worker-handover",
    route: "/en/app?role=saathi",
    component: "src/components/collection/worker-handovers.tsx",
    scrollNamespace: "workerHandover",
    scrollRecord: "Example pickup handover",
  },
];
const plans = [
  ...screens.map((screen) => ({
    ...screen,
    locale: "en",
    theme: "light",
    primary: true,
  })),
  ...screens
    .filter((screen) => screen.name !== "admin")
    .flatMap((screen) =>
      variants.map((variant) => ({
        ...screen,
        ...variant,
        route: screen.route.replace("/en/", () => `/${variant.locale}/`),
        primary: false,
      })),
    ),
  ...[
    { theme: "light", width: 1440 },
    { theme: "dark", width: 390 },
    { theme: "light", width: 768 },
  ].map((variant) => ({
    ...variant,
    name: "admin-operations",
    route: "/admin/operations",
    component: "src/components/admin/operations/collection-reassignment.tsx",
    locale: "en",
    primary: false,
    scrollHeading: "Move a collection offer",
  })),
  ...[{ locale: "en", theme: "light", width: 1440 }, ...variants].map(
    (variant) => ({
      ...variant,
      name: "business-cost-entry",
      route: `/${variant.locale}/app/lots?role=yard`,
      component: "src/components/lots/lot-forms.tsx",
      primary: false,
      costDialog: true,
      height: 2400,
    }),
  ),
  ...releaseScreens.flatMap((screen) =>
    releaseVariants.map((variant) => ({
      ...screen,
      ...variant,
      route: screen.route.replace("/en/", () => `/${variant.locale}/`),
      primary: false,
    })),
  ),
  ...releaseVariants
    .filter((variant) => variant.locale === "en")
    .map((variant) => ({
      ...variant,
      name: "admin-account-removals",
      route: "/admin/account-removals",
      component: "src/components/admin/account-removals.tsx",
      primary: false,
    })),
  ...[
    {
      name: "household-request",
      route: "/kn/sell",
      width: 390,
      theme: "light",
      component: "src/components/sell/simple-recycling-flow.tsx",
    },
    {
      name: "shop-workspace",
      route: "/kn/app",
      width: 768,
      theme: "dark",
      component: "src/components/shop/kabadiwala-home.tsx",
    },
  ].map((screen) => ({ ...screen, locale: "kn", primary: false })),
  ...[{ locale: "en", theme: "light", width: 1440 }, ...variants].map(
    (variant) => ({
      ...variant,
      name: "stock-closing",
      route: `/${variant.locale}/app/stock`,
      component: "src/components/shop/stock-closing.tsx",
      primary: false,
      scrollNamespace: "stockClosing",
    }),
  ),
  ...[{ locale: "en", theme: "light", width: 1440 }, ...variants].map(
    (variant) => ({
      ...variant,
      name: "manufacturer-cost-entry",
      route: `/${variant.locale}/app/intake-example?role=manufacturer`,
      component: "src/components/shop/stock-intake.tsx",
      primary: false,
      intakeDialog: true,
      height: 2400,
    }),
  ),
];
const harnessEntries = await readdir("scripts/guide-preview");
const harnessSources = harnessEntries
  .filter((file) => /\.(?:ts|tsx|mts|mjs|html)$/.test(file))
  .map((file) => path.join("scripts/guide-preview", file));
const uiSources = await readdir("src", { recursive: true });
const messageSources = await readdir("messages");
const sourceFiles = [
  ...harnessSources,
  ...uiSources
    .filter(
      (file) => /\.(?:ts|tsx|css)$/.test(file) && !file.includes(".test."),
    )
    .map((file) => path.join("src", file)),
  ...messageSources
    .filter((file) => file.endsWith(".json"))
    .map((file) => path.join("messages", file)),
];
async function sourceSnapshot() {
  const entries = await Promise.all(
    sourceFiles.map(async (file) => [file, await hashFile(file)]),
  );
  return Object.fromEntries(entries);
}
const initialSourceHashes = await sourceSnapshot();
const buildId = await readFile(".next/BUILD_ID", "utf8");
await mkdir(output, { recursive: true });
const browser = await chromium.launch();
const captures = [];
try {
  for (const plan of plans) {
    const context = await browser.newContext({
      viewport: { width: plan.width, height: plan.height ?? 1000 },
      colorScheme: plan.theme,
      reducedMotion: "reduce",
      deviceScaleFactor: 1,
    });
    const blocked = [];
    await context.route("**/*", async (route) => {
      const request = route.request();
      const url = new URL(request.url());
      if (["blob:", "data:"].includes(url.protocol)) {
        await route.continue();
        return;
      }
      if (url.origin !== origin || request.method() !== "GET") {
        blocked.push({ origin: url.origin, method: request.method() });
        await route.abort();
        return;
      }
      await route.continue();
    });
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", (error) => {
      errors.push(error.message);
    });
    await page.clock.setFixedTime(new Date(clock));
    await page.goto(`${origin}${plan.route}`);
    const banner = page.getByRole("note", {
      name: "Screenshot provenance",
      includeHidden: true,
    });
    await banner.waitFor({ state: "visible" });
    const bannerText = await banner.textContent();
    check(
      bannerText?.includes("Example screen — made-up data"),
      "Missing fixture label.",
    );
    await page.getByRole("heading").first().waitFor({ state: "visible" });
    if (plan.removal) {
      const copy = JSON.parse(
        await readFile(`messages/${plan.locale}.json`, "utf8"),
      );
      const confirmation = page.getByRole("checkbox", {
        name: copy.accountRemoval.confirm,
        exact: true,
      });
      await confirmation.waitFor({ state: "visible" });
      check(
        !(await confirmation.isChecked()),
        "Removal confirmation must stay unchecked.",
      );
      check(
        await page
          .getByRole("button", {
            name: copy.accountRemoval.action,
            exact: true,
          })
          .isDisabled(),
        "Removal action must stay disabled.",
      );
      if (plan.name === "account-removal-held")
        await page
          .getByText(copy.accountRemoval.held, { exact: true })
          .waitFor({ state: "visible" });
      else if (plan.name === "account-removal-reauth")
        await page
          .getByText(copy.accountRemoval.reauth, { exact: true })
          .waitFor({ state: "visible" });
    }
    await page.evaluate(async () => document.fonts.ready);
    if (plan.costDialog) {
      const copy = JSON.parse(
        await readFile(`messages/${plan.locale}.json`, "utf8"),
      );
      await page
        .getByRole("button", { name: copy.lots.declare, exact: true })
        .click();
    }
    if (plan.intakeDialog) {
      const copy = JSON.parse(
        await readFile(`messages/${plan.locale}.json`, "utf8"),
      );
      await page
        .getByRole("button", { name: copy.stockIntake.add, exact: true })
        .click();
      await page
        .getByLabel(copy.recordedCosts.acquisition, { exact: true })
        .scrollIntoViewIfNeeded();
    }
    await page.evaluate(async () => {
      await Promise.allSettled(
        document.getAnimations().map((animation) => animation.finished),
      );
    });
    if (plan.costDialog || plan.intakeDialog) {
      const noteBounds = await banner.boundingBox();
      const dialogBounds = await page.getByRole("dialog").boundingBox();
      check(
        noteBounds &&
          dialogBounds &&
          noteBounds.y + noteBounds.height <= dialogBounds.y,
        "The documentation label overlaps the application dialog.",
      );
    }
    if (plan.receipt) {
      const copy = JSON.parse(
        await readFile(`messages/${plan.locale}.json`, "utf8"),
      );
      await page
        .getByRole("region", { name: copy.track.review.title })
        .last()
        .evaluate((element) => {
          const note = document.querySelector(
            '[aria-label="Screenshot provenance"]',
          );
          window.scrollTo(
            0,
            element.getBoundingClientRect().top +
              window.scrollY -
              (note?.getBoundingClientRect().height ?? 0) -
              16,
          );
        });
    }
    if (plan.scrollHeading || plan.scrollNamespace) {
      const copy = JSON.parse(
        await readFile(`messages/${plan.locale}.json`, "utf8"),
      );
      const heading = plan.scrollHeading ?? copy[plan.scrollNamespace].title;
      const target = plan.scrollNamespace
        ? page.locator("summary").filter({ hasText: heading })
        : page.getByRole("heading", { name: heading, exact: true });
      if (plan.scrollNamespace) await target.click();
      await target.evaluate((element) => {
        const note = document.querySelector(
          '[aria-label="Screenshot provenance"]',
        );
        window.scrollTo(
          0,
          element.getBoundingClientRect().top +
            window.scrollY -
            (note?.getBoundingClientRect().height ?? 0) -
            16,
        );
      });
    }
    if (plan.scrollRecord) {
      await page
        .getByRole("heading", { name: plan.scrollRecord, exact: true })
        .evaluate((element) => {
          const note = document.querySelector(
            '[aria-label="Screenshot provenance"]',
          );
          window.scrollTo(
            0,
            element.getBoundingClientRect().top +
              window.scrollY -
              (note?.getBoundingClientRect().height ?? 0) -
              16,
          );
        });
    }
    check(await banner.isVisible(), "Fixture label is hidden.");
    const layout = await page.evaluate(() => ({
      viewport: innerWidth,
      documentWidth: document.documentElement.scrollWidth,
      fonts: document.fonts.status,
      loadedFonts: [...document.fonts]
        .filter((face) => face.status === "loaded")
        .map((face) => face.family),
      direction: document.documentElement.dir,
    }));
    check(
      layout.documentWidth <= layout.viewport,
      `Page overflow: ${plan.name}`,
    );
    check(layout.fonts === "loaded", "Fonts are not ready.");
    check(errors.length === 0, `Browser errors: ${errors.join("; ")}`);
    check(blocked.length === 0, "Unexpected external or write request.");
    const file = plan.primary
      ? `${plan.name}.png`
      : `${plan.name}-${plan.locale}-${plan.theme}-${plan.width}.png`;
    await page.screenshot({ path: path.join(output, file), fullPage: false });
    captures.push({
      ...plan,
      file,
      fixtureClock: clock,
      layout,
      capturedAt: new Date().toISOString(),
      componentSha256: hash(await readFile(plan.component)),
      screenshotSha256: await hashFile(path.join(output, file)),
      errors,
      blockedRequests: blocked,
      evidence:
        "Current components with made-up data. No authentication, provider or deployment acceptance.",
      visualReview: "pending",
    });
    process.stdout.write(`Captured ${file}\n`);
    await context.close();
  }
} finally {
  await browser.close();
}
const styleEntries = await readdir(".next/static/css");
const styles = styleEntries.filter((file) => file.endsWith(".css"));
const finalSourceHashes = await sourceSnapshot();
const finalBuildId = await readFile(".next/BUILD_ID", "utf8");
check(
  buildId === finalBuildId,
  "Build changed during capture; restart the preview and capture again.",
);
check(
  JSON.stringify(initialSourceHashes) === JSON.stringify(finalSourceHashes),
  "Source changed during capture; capture again after source owners finish.",
);
const styleHashes = await Promise.all(
  styles.map(async (file) => ({
    file,
    sha256: await hashFile(`.next/static/css/${file}`),
  })),
);
const workingTreeStatus = execFileSync(
  "/usr/bin/git",
  ["status", "--porcelain"],
  {
    encoding: "utf8",
  },
).trim();
await writeFile(
  path.join(output, "foundation-captures.json"),
  `${JSON.stringify(
    {
      sourceCommit: execFileSync("/usr/bin/git", ["rev-parse", "HEAD"], {
        encoding: "utf8",
      }).trim(),
      workingTreeDirty: Boolean(workingTreeStatus),
      buildId: buildId.trim(),
      sourceKind: "isolated-current-components-synthetic-fixtures",
      note: "Original browser PNGs from current components. Made-up data, fixed illustrative clock, all writes and external requests blocked. These captures do not prove production deployment or authentication.",
      sourceHashes: finalSourceHashes,
      styles: styleHashes,
      captures,
    },
    null,
    2,
  )}\n`,
);
