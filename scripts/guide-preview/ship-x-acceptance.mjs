import { createHash } from "node:crypto";
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { chromium } from "@playwright/test";
import ts from "typescript";

const repository = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../..",
);
const output = path.join(
  repository,
  "docs/delivery/evidence/ship-x-redo-2026-11-11",
);
const entry = "scripts/guide-preview/main.tsx";
const source = await readFile(path.join(repository, entry), "utf8");
const tree = ts.createSourceFile(
  entry,
  source,
  ts.ScriptTarget.Latest,
  true,
  ts.ScriptKind.TSX,
);
const imports = new Map();
const screens = [];
const routeMaps = new Set([
  "adminPages",
  "recoveryPages",
  "operationalPages",
  "sellSelectionPages",
  "onboardingPages",
  "accountPages",
  "householdPages",
]);
for (const statement of tree.statements) {
  if (!(
    ts.isImportDeclaration(statement) &&
    ts.isStringLiteral(statement.moduleSpecifier)
  )) {
    continue;
  }

  const binding = statement.importClause?.namedBindings;
  if (binding && ts.isNamedImports(binding)) {
    for (const item of binding.elements)
      imports.set(item.name.text, statement.moduleSpecifier.text);
  }
  if (statement.importClause?.name)
    imports.set(
      statement.importClause.name.text,
      statement.moduleSpecifier.text,
    );
}
function componentSource(node) {
  let result;
  function visit(child) {
    if (
      !result &&
      (ts.isJsxOpeningElement(child) || ts.isJsxSelfClosingElement(child))
    ) {
      result = imports.get(child.tagName.getText(tree));
    }
    if (!result) ts.forEachChild(child, visit);
  }
  visit(node);
  return result?.startsWith("@/")
    ? `${result.replace("@/", "src/")}.tsx`
    : entry;
}
function visit(node) {
  if (
    ts.isVariableDeclaration(node) &&
    ts.isIdentifier(node.name) &&
    routeMaps.has(node.name.text) &&
    node.initializer &&
    ts.isObjectLiteralExpression(node.initializer)
  ) {
    for (const property of node.initializer.properties) {
      if (
        ts.isPropertyAssignment(property) &&
        ts.isStringLiteral(property.name)
      )
        screens.push({
          route:
            property.name.text === "/en/app/finance-example"
              ? `${property.name.text}?scenario=financial-hold`
              : property.name.text,
          component: componentSource(property.initializer),
        });
    }
  }
  ts.forEachChild(node, visit);
}
visit(tree);
screens.push(
  {
    route: "/en/join/roles?phone=verified",
    component: "src/components/join/participant-directory.tsx",
  },
  {
    route: "/en/app/market?procurement=pet&role=manufacturer",
    component: "src/components/market/market-page.tsx",
  },
  {
    route: "/en/app/trades?procurement=pet&role=manufacturer",
    component: "src/components/market/trades-page.tsx",
  },
  ...["kabadiwala", "yard", "recycler", "manufacturer", "saathi"].map(
    (role) => ({
      route: `/en/app?role=${role}`,
      component: "src/components/app/role-home.tsx",
    }),
  ),
  {
    route: "/en/app/requests/guide-booking",
    component: "src/components/shop/request-detail.tsx",
  },
  { route: "/en/sell", component: "src/components/sell/sell-flow.tsx" },
  {
    route: "/en/t/guide-booking",
    component: "src/components/track/track-view.tsx",
  },
  {
    route: "/en/login/factor",
    component: "src/components/auth/factor-challenge.tsx",
  },
);
const translated = new Set([
  "/en/app?role=kabadiwala",
  "/en/app?role=saathi",
  "/en/app/requests",
  "/en/app/requests/guide-booking",
  "/en/app/stock",
  "/en/app/facility",
]);
const allCaptures = [
  ...screens.map((screen) => ({ ...screen, locale: "en" })),
  ...["ar", "ur", "kn"].flatMap((locale) =>
    screens
      .filter((screen) => translated.has(screen.route))
      .map((screen) => ({
        ...screen,
        locale,
        route: screen.route.replace("/en/", () => `/${locale}/`),
      })),
  ),
];
const captures = process.env.SHIP_X_ROUTE
  ? allCaptures.filter((screen) => screen.route === process.env.SHIP_X_ROUTE)
  : allCaptures;
const captureWidths =
  process.env.SHIP_X_ROUTE || process.env.SHIP_X_SMOKE
    ? [390]
    : [1280, 768, 390];
async function sourceFiles(directory) {
  const entries = await readdir(path.join(repository, directory), {
    withFileTypes: true,
  });
  const result = [];
  for (const item of entries) {
    if (["dist", ".expo", "node_modules", "android", "ios"].includes(item.name))
      continue;
    const file = `${directory}/${item.name}`;
    if (item.isDirectory()) result.push(...(await sourceFiles(file)));
    else if (/\.(?:tsx?|mjs|cjs|json|css)$/u.test(file)) result.push(file);
  }
  return result;
}
const sourceGroups = await Promise.all(
  ["src", "apps/mobile", "messages", "scripts/guide-preview"].map((directory) =>
    sourceFiles(directory),
  ),
);
const files = sourceGroups
  .flat()
  .toSorted((left, right) => left.localeCompare(right));
const hash = createHash("sha256");
for (const file of files)
  hash.update(file).update(await readFile(path.join(repository, file)));
const sourceHash = hash.digest("hex");
const buildStyles = [];
const styleDirectory = path.join(repository, ".next/static");
const styleFiles = await readdir(styleDirectory, { recursive: true });
const styles = styleFiles
  .filter((file) => file.endsWith(".css"))
  .toSorted((left, right) => left.localeCompare(right));
if (styles.length === 0)
  throw new Error(
    "No built CSS found. Build the app before capturing review fixtures.",
  );
for (const file of styles) {
  const bytes = await readFile(path.join(styleDirectory, file));
  buildStyles.push({
    file,
    sha256: createHash("sha256").update(bytes).digest("hex"),
  });
}
const origin = "http://127.0.0.1:3231";
const manifest = {
  provenance:
    "Isolated synthetic component fixtures; no live account, provider or operational proof. Automated checks do not replace visual review.",
  origin,
  startedAt: new Date().toISOString(),
  sourceHash,
  sourceFiles: files,
  buildStyles,
  captures: [],
};
await mkdir(output, { recursive: true });
await writeFile(
  path.join(output, "layout-manifest.json"),
  JSON.stringify(manifest, null, 2),
);
const browser = await chromium.launch();
try {
  for (const screen of captures) {
    let shouldSkipWidths = false;
    for (const width of captureWidths) {
      if (shouldSkipWidths) continue;
      const height = 900;
      const name = `${screen.route.replaceAll(/[^a-z0-9]+/giu, "-").replaceAll(/^-|-$/gu, "")}-${width}`;
      const record = {
        ...screen,
        width,
        height,
        file: `${name}.png`,
        sourceHash,
        componentHash: createHash("sha256")
          .update(await readFile(path.join(repository, screen.component)))
          .digest("hex"),
        errors: [],
        blockedRequests: [],
        failedRequests: [],
      };
      const context = await browser.newContext({
        viewport: { width, height },
        reducedMotion: "reduce",
        colorScheme: "dark",
      });
      await context.route("**/*", async (route) => {
        const request = route.request();
        const target = new URL(request.url());
        if (
          (target.origin === origin &&
            ["GET", "HEAD"].includes(request.method())) ||
          ["data:", "blob:"].includes(target.protocol)
        )
          return route.continue();
        record.blockedRequests.push({
          url: request.url(),
          method: request.method(),
        });
        return route.abort();
      });
      const page = await context.newPage();
      const runtimeFailure = Promise.withResolvers();
      page.on("pageerror", (error) => {
        record.errors.push(error.message);
        runtimeFailure.resolve(false);
      });
      page.on("console", (message) => {
        if (message.type() === "error") record.errors.push(message.text());
      });
      page.on("requestfailed", (request) => {
        record.failedRequests.push({
          url: request.url(),
          failure: request.failure()?.errorText,
        });
      });
      try {
        await page.clock.setFixedTime(new Date("2026-10-14T06:00:00Z"));
        await page.goto(`${origin}${screen.route}`, {
          waitUntil: "domcontentloaded",
          timeout: 30_000,
        });
        const waitForProvenance = async () => {
          await page
            .getByRole("note", { name: "Screenshot provenance" })
            .waitFor({ timeout: 10_000 });
          return true;
        };
        const didRender = await Promise.race([
          waitForProvenance(),
          runtimeFailure.promise,
        ]);
        if (!didRender)
          throw new Error("Fixture render failed before provenance banner");
        const expected = new URL(screen.route, origin).pathname.replace(
          `/${screen.locale}/`,
          "/en/",
        );
        await page.waitForFunction(
          (route) => document.documentElement.dataset.previewRoute === route,
          expected,
          { timeout: 10_000 },
        );
        await page.evaluate(async () => {
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
        });
        record.layout = await page.evaluate(() => ({
          matchedRoute: document.documentElement.dataset.previewRoute,
          title: document.querySelector("h1")?.textContent ?? null,
          headings: [...document.querySelectorAll("h1,h2")]
            .slice(0, 12)
            .map((element) => element.textContent),
          documentWidth: document.documentElement.scrollWidth,
          viewportWidth: innerWidth,
          hasOverflow: document.documentElement.scrollWidth > innerWidth + 1,
          direction: document.documentElement.dir,
          lang: document.documentElement.lang,
          colorScheme: getComputedStyle(document.documentElement).colorScheme,
          isDark: document.documentElement.classList.contains("dark"),
          fontFamily: getComputedStyle(document.body).fontFamily,
          fontStatus: document.fonts.status,
          fonts: [...document.fonts].map((font) => ({
            family: font.family,
            status: font.status,
          })),
          clippedControls: [
            ...document.querySelectorAll("button, a, [role=tab]"),
          ]
            .filter(
              (element) =>
                element instanceof HTMLElement &&
                !element.classList.contains("sr-only") &&
                element.getBoundingClientRect().width > 0 &&
                element.textContent.trim() &&
                element.scrollWidth > element.clientWidth + 2,
            )
            .map((element) => ({
              tag: element.tagName,
              text: element.textContent.trim().slice(0, 100),
            })),
          brokenImages: [...document.images]
            .filter((image) => !image.complete || image.naturalWidth === 0)
            .map((image) => image.currentSrc || image.src),
        }));
        if (record.layout.headings.length === 0)
          record.errors.push("No page heading rendered");
        if (record.layout.clippedControls?.length)
          record.errors.push("Clipped control labels");
        if (record.layout.hasOverflow)
          record.errors.push("Document horizontal overflow");
        if (record.layout.isDark || record.layout.colorScheme.includes("dark"))
          record.errors.push("Dark appearance remains active");
        if (
          record.layout.fontStatus !== "loaded" ||
          record.layout.fonts.every((font) => font.status !== "loaded")
        )
          record.errors.push("No loaded application fonts");
        const scriptFont = { kn: /Kannada/iu, ar: /Arabic/iu, ur: /Arabic/iu }[
          screen.locale
        ];
        if (
          scriptFont &&
          record.layout.fonts.every(
            (font) => font.status !== "loaded" || !scriptFont.test(font.family),
          )
        )
          record.errors.push("Expected script font was not loaded");
        if (record.layout.brokenImages.length > 0)
          record.errors.push("Broken images");
        if (screen.locale !== "en" && record.layout.lang !== screen.locale)
          record.errors.push("Locale mismatch");
        if (
          ["ar", "ur"].includes(screen.locale) &&
          record.layout.direction !== "rtl"
        )
          record.errors.push("RTL direction missing");
        await page.screenshot({
          path: path.join(output, record.file),
          fullPage: true,
        });
      } catch (error) {
        record.errors.push(
          error instanceof Error ? error.message : String(error),
        );
        try {
          await page.screenshot({
            path: path.join(output, record.file),
            fullPage: false,
          });
        } catch (captureError) {
          record.errors.push(
            `Failure screenshot unavailable: ${String(captureError)}`,
          );
        }
      } finally {
        await context.close();
      }
      record.passed =
        record.errors.length === 0 && record.blockedRequests.length === 0;
      manifest.captures.push(record);
      await writeFile(
        path.join(output, "layout-manifest.json"),
        JSON.stringify(manifest, null, 2),
      );
      process.stdout.write(
        `${record.passed ? "PASS" : "FAIL"} ${screen.route} ${width}\n`,
      );
      if (
        record.errors.some(
          (error) =>
            error.includes("Missing documentation fixture") ||
            error.includes("Fixture render failed"),
        )
      )
        shouldSkipWidths = true;
    }
  }
} finally {
  await browser.close();
  manifest.finishedAt = new Date().toISOString();
  const finalHash = createHash("sha256");
  for (const file of files)
    finalHash.update(file).update(await readFile(path.join(repository, file)));
  manifest.finalSourceHash = finalHash.digest("hex");
  manifest.sourceUnchanged = manifest.finalSourceHash === sourceHash;
  manifest.passed =
    manifest.sourceUnchanged &&
    manifest.captures.every((capture) => capture.passed);
  await writeFile(
    path.join(output, "layout-manifest.json"),
    JSON.stringify(manifest, null, 2),
  );
}
if (!manifest.passed) process.exitCode = 1;
