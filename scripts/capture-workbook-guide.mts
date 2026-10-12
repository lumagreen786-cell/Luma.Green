/**
 * Real local account captures. Run only after the acceptance owner releases the runtime:
 * pnpm --config.verify-deps-before-run=false exec jiti scripts/capture-workbook-guide.mts --capture
 * No fixture server, auth injection, seed call, mail read, tracing, video or stored session.
 * Existing approved .convex/local-acceptance files are read privately, never copied.
 */
import { execFileSync } from "node:child_process";
import { createHash, randomInt } from "node:crypto";
import { mkdir, readdir, readFile, stat, writeFile } from "node:fs/promises";
import { setTimeout as delay } from "node:timers/promises";
import { parseEnv } from "node:util";

import {
  type Browser,
  type BrowserContext,
  chromium,
  expect,
  type Locator,
  type Page,
} from "@playwright/test";
import { z } from "zod";

import {
  isLoopbackHttpOrigin,
  LOCAL_ACCEPTANCE_PERSONAS,
} from "../convex/lib/localAcceptance";
import { currentCode } from "../e2e/connected/totp";
import ar from "../messages/ar.json";
import en from "../messages/en.json";
import kn from "../messages/kn.json";
import { localeMeta } from "../src/i18n/locales";
import { workbookGuideCases } from "./workbook-guide-plan";

const catalogs = { en, ar, kn };
type Locale = keyof typeof catalogs;
type Theme = "light" | "dark";
const viewports = [
  { width: 390, height: 844 },
  { width: 768, height: 1024 },
  { width: 1440, height: 1000 },
] as const;
const output = "docs/user-guide/screenshots";
const manifestPath = "docs/user-guide/workbook-captures.json";
const privateDirectory = ".convex/local-acceptance";
const accountSchema = z.object({
  key: z.string(),
  name: z.string(),
  email: z.email(),
  password: z.string().min(12),
});
const credentialSchema = z.object({
  version: z.literal(1),
  site: z.string().refine(isLoopbackHttpOrigin),
  accounts: z.array(accountSchema),
});
type Account = z.infer<typeof credentialSchema>["accounts"][number];
type CaseName = (typeof workbookGuideCases)[number]["name"];
const groups = [
  "kabadiwala",
  "preprocessor",
  "manufacturer",
  "auditor",
  "team-viewer",
  "admin",
].map((key) => ({
  key,
  cases: workbookGuideCases
    .filter((item) => item.persona === key)
    .map((item) => item.name),
}));
const paths = Object.fromEntries(
  workbookGuideCases.map((item) => [item.name, item.route]),
);
function planned(scenario: CaseName) {
  const item = workbookGuideCases.find((entry) => entry.name === scenario);
  if (!item) throw new Error("UNKNOWN_CAPTURE_CASE");
  return item;
}

interface Evidence {
  name: string;
  path: string;
  route: string;
  locale: Locale;
  theme: Theme;
  viewport: { width: number; height: number };
  captureKind: "viewport" | "section";
  section?: string;
  persona: string;
  authenticated: boolean;
  observedState: string;
  sha256: string;
  sourceDigest: string;
  capturedAt: string;
  privacyCheck: "passed";
  renderedFont: { family: string; custom: true; glyphCount: number };
  visualReview: "pending";
}
interface Skipped {
  name: string;
  reason: string;
}
interface Diagnostics {
  browserErrors: number;
  blockedRequests: number;
  blockedWrites: number;
  profileCalls: number;
  authRateLimits: number;
  authUnavailable: number;
}
const hash = (value: string | Uint8Array) =>
  createHash("sha256").update(value).digest("hex");

async function privateText(path: string) {
  const details = await stat(path);
  if ((details.mode & 0o077) !== 0) throw new Error("PRIVATE_FILE_PERMISSIONS");
  return readFile(path, "utf8");
}

async function configuration() {
  const credentials = credentialSchema.parse(
    JSON.parse(
      await privateText(`${privateDirectory}/credentials.json`),
    ) as unknown,
  );
  const local = parseEnv(await readFile(".env.local", "utf8"));
  const backend = parseEnv(
    await privateText(`${privateDirectory}/backend.env`),
  );
  const origin = process.env.GUIDE_BASE_URL ?? credentials.site;
  const endpoints = [
    origin,
    local.NEXT_PUBLIC_CONVEX_URL,
    local.NEXT_PUBLIC_CONVEX_SITE_URL,
  ];
  if (
    endpoints.some((value) => !isLoopbackHttpOrigin(value)) ||
    origin !== credentials.site ||
    backend.SITE_URL !== origin ||
    local.NEXT_PUBLIC_SITE_URL !== origin ||
    backend.AUTH_LOCAL_TEST_MODE !== "true"
  )
    throw new Error("LOCAL_CONFIGURATION_REQUIRED");
  for (const account of credentials.accounts) {
    const persona = LOCAL_ACCEPTANCE_PERSONAS.find(
      ({ key }) => key === account.key,
    );
    if (account.email !== persona?.email || account.name !== persona.name)
      throw new Error("APPROVED_SYNTHETIC_ROSTER_REQUIRED");
  }
  const origins = new Set(
    endpoints
      .filter((value): value is string => value !== undefined)
      .map((value) => new URL(value).origin),
  );
  const admin = z
    .object({
      email: z.literal("admin@luma.test"),
      password: z.string().min(12),
      secret: z.string().min(16),
    })
    .parse(
      JSON.parse(
        await privateText(`${privateDirectory}/admin.json`),
      ) as unknown,
    );
  if (backend.ADMIN_EMAIL !== admin.email)
    throw new Error("APPROVED_ADMIN_REQUIRED");
  return { origin, credentials, origins, admin };
}

/** Hash public source inputs once, not credentials, generated captures or session state. */
async function sourceFiles(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const result: string[] = [];
  for (const entry of entries) {
    const path = `${directory}/${entry.name}`;
    if (entry.isDirectory()) result.push(...(await sourceFiles(path)));
    else if (
      /\.(?:ts|tsx|css|js|webp|png|svg|woff2)$/.test(path) &&
      !/\.(?:test|spec)\./.test(path)
    )
      result.push(path);
  }
  return result;
}
async function provenance() {
  const files = [
    "scripts/capture-workbook-guide.mts",
    "scripts/workbook-guide-plan.ts",
    "e2e/connected/totp.ts",
    "next.config.ts",
    "package.json",
    "messages/en.json",
    "messages/ar.json",
    "messages/kn.json",
    ...(await sourceFiles("src")),
    ...(await sourceFiles("convex")),
    ...(await sourceFiles("public")),
  ].toSorted((a, b) => a.localeCompare(b));
  const sourceHashes = Object.fromEntries<string>(
    await Promise.all(
      files.map(async (path): Promise<[string, string]> => [
        path,
        hash(await readFile(path)),
      ]),
    ),
  );
  // eslint-disable-next-line sonarjs/no-os-command-from-path -- Read-only revision provenance from the installed Git.
  const sourceRevision = execFileSync("git", ["rev-parse", "HEAD"], {
    encoding: "utf8",
  }).trim();
  return {
    sourceRevision,
    sourceHashes,
    sourceDigest: hash(JSON.stringify(sourceHashes)),
  };
}

function networkOrigin(raw: string) {
  const url = new URL(raw);
  if (url.protocol === "ws:") url.protocol = "http:";
  return url.origin;
}

/** Forward real server replies unchanged. Reject business writes before transmission. */
async function guardNetwork(
  context: BrowserContext,
  origins: Set<string>,
  diagnostics: Diagnostics,
) {
  const stats = diagnostics;
  await context.route("**/*", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const isRead = request.method() === "GET" || request.method() === "HEAD";
    const isAllowedAuth =
      /^\/api\/auth\/(?:sign-in\/email|sign-out|two-factor\/verify-totp|convex\/token|get-session)$/.test(
        url.pathname,
      );
    if (!origins.has(url.origin)) {
      stats.blockedRequests += 1;
      await route.abort();
    } else if (!isRead && !isAllowedAuth) {
      stats.blockedWrites += 1;
      await route.abort();
    } else await route.continue();
  });
  await context.routeWebSocket("**/*", (socket) => {
    if (!origins.has(networkOrigin(socket.url()))) {
      stats.blockedRequests += 1;
      void socket.close().catch(() => {
        stats.browserErrors += 1;
      });
      return;
    }
    const server = socket.connectToServer();
    socket.onMessage((message) => {
      let frame: unknown;
      try {
        frame = JSON.parse(String(message)) as unknown;
      } catch {
        server.send(message);
        return;
      }
      const parsed = z
        .object({ type: z.string(), udfPath: z.string().optional() })
        .safeParse(frame);
      if (parsed.success && ["Mutation", "Action"].includes(parsed.data.type)) {
        if (
          parsed.data.type !== "Mutation" ||
          parsed.data.udfPath !== "identity:ensureProfile"
        ) {
          stats.blockedWrites += 1;
          void socket.close().catch(() => {
            stats.browserErrors += 1;
          });
          return;
        }
        stats.profileCalls += 1;
      }
      server.send(message);
    });
  });
}

async function loginTabs(page: Page, locale: Locale) {
  const t = catalogs[locale];
  const chooser = page.getByRole("radiogroup", {
    name: t.common.language,
    exact: true,
  });
  await expect(
    chooser.or(page.getByRole("tab", { name: t.emailAuth.email, exact: true })),
  ).toBeVisible();
  if (await chooser.isVisible()) {
    await page
      .getByRole("button", { name: t.auth.continue, exact: true })
      .click();
  }
  await page.getByRole("tab", { name: t.emailAuth.email, exact: true }).click();
}

async function signIn(page: Page, origin: string, account: Account) {
  await page.goto(`${origin}/en/login?next=/account/workspaces`);
  await loginTabs(page, "en");
  await page
    .getByRole("textbox", { name: en.emailAuth.email, exact: true })
    .fill(account.email);
  await page
    .getByLabel(en.emailAuth.password, { exact: true })
    .fill(account.password);
  await page
    .getByRole("button", { name: en.emailAuth.signin, exact: true })
    .click();
  await expect
    .poll(() => new URL(page.url()).pathname, { timeout: 30_000 })
    .toMatch(/\/account\/workspaces$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    en.workspace.title,
  );
}

async function signOut(page: Page, origin: string) {
  await page.goto(`${origin}/en/account/security`);
  await page
    .getByRole("button", { name: en.nav.openMenu, exact: true })
    .click();
  await page.getByRole("button", { name: en.app.signOut, exact: true }).click();
  await expect.poll(() => new URL(page.url()).pathname).toMatch(/\/login$/);
}

async function renderedHeadingFont(page: Page, locale: Locale) {
  const family = {
    en: "Geist",
    ar: "Noto Sans Arabic",
    kn: "Noto Sans Kannada",
  }[locale];
  const session = await page.context().newCDPSession(page);
  try {
    await session.send("DOM.enable");
    await session.send("CSS.enable");
    const { root } = await session.send("DOM.getDocument");
    const { nodeId } = await session.send("DOM.querySelector", {
      nodeId: root.nodeId,
      selector: "h1",
    });
    const { fonts } = await session.send("CSS.getPlatformFontsForNode", {
      nodeId,
    });
    const font = fonts.find(
      (value) =>
        value.isCustomFont &&
        value.glyphCount > 0 &&
        value.familyName === family,
    );
    if (!font) throw new Error("REQUIRED_SCRIPT_FONT_NOT_RENDERED");
    return { family, custom: true as const, glyphCount: font.glyphCount };
  } finally {
    await session.detach();
  }
}

async function ready(page: Page, theme: Theme, locale: Locale) {
  progress.phase = "heading-readiness";
  // An open Radix select hides background semantics, while the page heading
  // remains physically visible. Keep that visual check for popup captures.
  // Assertions have a separate timeout from page actions. Allow the same
  // 30-second local data-loading budget while retaining the readiness checks.
  await expect(
    page.getByRole("heading", { level: 1, includeHidden: true }),
  ).toBeVisible({ timeout: 30_000 });
  progress.phase = "skeleton-readiness";
  await expect(page.locator('[data-slot="skeleton"]')).toHaveCount(0, {
    timeout: 30_000,
  });
  progress.phase = "locale-readiness";
  await expect(page.locator("html")).toHaveAttribute(
    "lang",
    localeMeta[locale].hreflang,
  );
  progress.phase = "theme-readiness";
  await expect
    .poll(() =>
      page.locator("html").evaluate((node) => node.classList.contains("dark")),
    )
    .toBe(theme === "dark");
  progress.phase = "font-readiness";
  await page.evaluate(async () => {
    await document.fonts.ready;
  });
  const renderedFont = await renderedHeadingFont(page, locale);
  progress.phase = "image-readiness";
  await page.waitForFunction(() =>
    [...document.images]
      .filter((image) => {
        const box = image.getBoundingClientRect();
        return (
          box.top < innerHeight &&
          box.bottom > 0 &&
          box.width > 0 &&
          box.height > 0
        );
      })
      .every((image) => image.complete && image.naturalWidth > 0),
  );
  return renderedFont;
}

interface Prepared {
  target?: Locator;
  section?: string;
  observedState: string;
  skip?: string;
}
function textFor(locale: Locale, namespace: string, key: string) {
  const section: unknown = Reflect.get(catalogs[locale], namespace);
  if (!section || typeof section !== "object")
    throw new Error("MISSING_COPY_NAMESPACE");
  const text: unknown = Reflect.get(section, key);
  if (typeof text !== "string") throw new Error("MISSING_CAPTURE_COPY");
  return text;
}
async function prepare(
  page: Page,
  scenario: CaseName,
  locale: Locale,
): Promise<Prepared> {
  const item = planned(scenario);
  const label =
    item.namespace === "admin"
      ? item.label
      : textFor(locale, item.namespace, item.label);
  switch (item.action) {
    case "tab": {
      await page.getByRole("tab", { name: label, exact: true }).click();
      if (scenario === "admin-facilities") {
        // The form renders before its live facility query. Wait for the known
        // synthetic record created by the connected industry journey.
        await expect(
          page
            .getByRole("heading", {
              name: /Local test kabadiwala owner · Local industry line 1\d{12}/,
            })
            .first(),
        ).toBeAttached();
      }
      break;
    }
    case "dialog": {
      await page.getByRole("button", { name: label, exact: true }).click();
      await expect(
        page.getByRole("dialog", { name: label, exact: true }),
      ).toBeVisible();

      break;
    }
    case "section": {
      const heading = page.getByRole("heading", { name: label, exact: true });
      if (scenario === "quality-incoming") {
        // Put the intended decision form below the sticky mobile header;
        // an already visible heading at the viewport bottom is not enough.
        await heading.evaluate((element) => {
          element.scrollIntoView({ block: "start" });
          window.scrollBy({ top: -72 });
        });
      } else {
        await heading.scrollIntoViewIfNeeded();
      }
      break;
    }
    case "history": {
      await page
        .getByRole("button", { name: label, exact: true })
        .first()
        .click();
      await page
        .getByRole("heading", { name: label, exact: true })
        .scrollIntoViewIfNeeded();

      break;
    }
    // No default
  }
  if (item.persona === "team-viewer")
    await expect(
      page.getByRole("button", {
        name: catalogs[locale].logistics.add,
        exact: true,
      }),
    ).toHaveCount(0);
  return { observedState: item.description };
}
async function signInAdmin(
  page: Page,
  config: Awaited<ReturnType<typeof configuration>>,
) {
  await page.goto(`${config.origin}/admin/login`);
  await page.getByLabel("Email", { exact: true }).fill(config.admin.email);
  await page
    .getByLabel("Password", { exact: true })
    .fill(config.admin.password);
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await expect(
    page.getByLabel("Code from your authenticator app"),
  ).toBeVisible();
  await page
    .getByLabel("Code from your authenticator app")
    .fill(currentCode(config.admin.secret));
  await expect(
    page.getByRole("heading", { name: "Welcome, Local", exact: true }),
  ).toBeVisible();
}
async function assertSafePixels(
  page: Page,
  target: Locator | undefined,
  accounts: readonly Account[],
  additionalSecrets: readonly string[],
) {
  const url = new URL(page.url());
  if (url.search || url.hash) throw new Error("CAPTURE_URL_MUST_BE_CLEAN");
  if (target) await target.scrollIntoViewIfNeeded();
  const box = target
    ? await target.boundingBox()
    : { x: 0, y: 0, ...page.viewportSize() };
  if (box?.width === undefined || box.height === undefined || box.height > 2400)
    throw new Error("CAPTURE_REGION_INVALID");
  const sensitive = [
    ...accounts.flatMap(({ email, password }) => [email, password]),
    ...additionalSecrets,
  ];
  const isSafe = await page.evaluate(
    ({ box, sensitive }) => {
      const hasIntersection = (r: DOMRect) =>
        r.width > 0 &&
        r.height > 0 &&
        r.right > box.x &&
        r.left < box.x + box.width &&
        r.bottom > box.y &&
        r.top < box.y + box.height;
      const isVisible = (element: Element) =>
        getComputedStyle(element).visibility !== "hidden" &&
        hasIntersection(element.getBoundingClientRect());
      const isForbidden = (text: string) => {
        // Only these exact synthetic test-reference prefixes may contain the
        // 13-digit timestamp generated by connected specs. Pixels stay unmodified.
        const withoutSyntheticRun = text.replaceAll(
          /(?:Local (?:route|recipe|batch|PET definition|test destination|sourcing specification|industry line) |Production (?:source|output) |Output inspection |LOCAL-(?:QC|AUDIT|AGR|REL|SAMPLE)-|quality-|test-)1\d{12}/g,
          "SYNTHETIC_TEST_REFERENCE",
        );
        return (
          sensitive.some((value) => text.includes(value)) ||
          text.includes("@") ||
          /\p{Decimal_Number}{6}|(?:otpauth|token=|password=|code=)/u.test(
            withoutSyntheticRun,
          )
        );
      };
      const walker = document.createTreeWalker(
        document.body,
        NodeFilter.SHOW_TEXT,
      );
      while (walker.nextNode()) {
        const node = walker.currentNode;
        if (!node.parentElement || !isVisible(node.parentElement)) continue;
        const range = document.createRange();
        range.selectNodeContents(node);
        if (
          [...range.getClientRects()].some((rect) => hasIntersection(rect)) &&
          isForbidden(node.textContent ?? "")
        )
          return false;
      }
      for (const input of document.querySelectorAll<
        HTMLInputElement | HTMLTextAreaElement
      >("input, textarea")) {
        if (!isVisible(input)) continue;
        if (
          isForbidden(input.value) ||
          (input instanceof HTMLInputElement &&
            ["password", "email", "tel"].includes(input.type) &&
            input.value)
        )
          return false;
      }
      return [...document.images].every(
        (image) =>
          !isVisible(image) ||
          !/QR|authenticator|recovery|secret/i.test(image.alt),
      );
    },
    {
      box: { x: box.x, y: box.y, width: box.width, height: box.height },
      sensitive,
    },
  );
  if (!isSafe) throw new Error("PRIVATE_CONTENT_IN_CAPTURE_REGION");
}

function assertDiagnostics(diagnostics: Diagnostics) {
  if (
    diagnostics.browserErrors ||
    diagnostics.blockedRequests ||
    diagnostics.blockedWrites ||
    diagnostics.authRateLimits ||
    diagnostics.authUnavailable
  )
    throw new Error("BROWSER_OR_NETWORK_GUARD_FAILED");
}

const variants = (Object.keys(catalogs) as Locale[]).flatMap((locale) =>
  viewports.flatMap((viewport) =>
    (["light", "dark"] as const).map((theme) => ({ locale, viewport, theme })),
  ),
);
const progress = {
  step: "configuration",
  phase: "configuration",
  authStatus: 0,
  retryAfterSeconds: 0,
};
const captureSchedule = { viewsPerBatch: 4, quietMilliseconds: 11_000 };
const clientNetwork = randomInt(1, 255);

/** Unload the app so session polling stops for the documented limiter quiet window. */
async function quietWindow(page: Page) {
  await page.goto("about:blank");
  await delay(
    Math.max(
      captureSchedule.quietMilliseconds,
      progress.retryAfterSeconds * 1000,
    ),
  );
}
async function captureView({
  page,
  config,
  scenario,
  variant,
  sourceDigest,
  diagnostics,
  persona,
  isAuthenticated,
}: {
  page: Page;
  config: Awaited<ReturnType<typeof configuration>>;
  scenario: CaseName;
  variant: (typeof variants)[number];
  sourceDigest: string;
  diagnostics: Diagnostics;
  persona: string;
  isAuthenticated: boolean;
}): Promise<Evidence | Skipped> {
  const { locale, theme, viewport } = variant;
  const name = `workbook-${scenario}-${locale}-${String(viewport.width)}-${theme}`;
  progress.step = name;
  progress.phase = "navigate";
  const localePrefix = paths[scenario].startsWith("/admin") ? "" : "/" + locale;
  await page.goto(`${config.origin}${localePrefix}${paths[scenario]}`);
  progress.phase = "initial-readiness";
  await ready(page, theme, locale);
  progress.phase = "prepare";
  const prepared = await prepare(page, scenario, locale);
  if (prepared.skip) return { name, reason: prepared.skip };
  progress.phase = "capture-readiness";
  const renderedFont = await ready(page, theme, locale);
  progress.phase = "privacy";
  await assertSafePixels(page, prepared.target, config.credentials.accounts, [
    config.admin.email,
    config.admin.password,
    config.admin.secret,
  ]);
  progress.phase = "diagnostics";
  assertDiagnostics(diagnostics);
  const path = `${output}/${name}.png`;
  const options = {
    path,
    animations: "disabled" as const,
    caret: "hide" as const,
  };
  progress.phase = "screenshot";
  if (prepared.target) await prepared.target.screenshot(options);
  else await page.screenshot(options);
  return {
    name,
    path,
    route: paths[scenario],
    locale,
    theme,
    viewport,
    captureKind: prepared.target ? "section" : "viewport",
    section: prepared.section,
    persona,
    authenticated: isAuthenticated,
    observedState: prepared.observedState,
    sha256: hash(await readFile(path)),
    sourceDigest,
    capturedAt: new Date().toISOString(),
    privacyCheck: "passed",
    renderedFont,
    visualReview: "pending",
  };
}

async function captureVariants({
  page,
  config,
  group,
  sourceDigest,
  diagnostics,
  isAuthenticated,
  captures,
  skipped,
}: {
  page: Page;
  config: Awaited<ReturnType<typeof configuration>>;
  group: (typeof groups)[number];
  sourceDigest: string;
  diagnostics: Diagnostics;
  isAuthenticated: boolean;
  captures: Evidence[];
  skipped: Skipped[];
}) {
  let viewsInBatch = 0;
  for (const variant of variants) {
    await page.setViewportSize(variant.viewport);
    await page.emulateMedia({
      colorScheme: variant.theme,
      reducedMotion: "reduce",
    });
    for (const scenario of group.cases) {
      if (group.key === "admin" && variant.locale !== "en") continue;
      if (viewsInBatch === captureSchedule.viewsPerBatch) {
        await quietWindow(page);
        viewsInBatch = 0;
      }
      const result = await captureView({
        page,
        config,
        scenario,
        variant,
        sourceDigest,
        diagnostics,
        persona: group.key,
        isAuthenticated,
      });
      if ("reason" in result) skipped.push(result);
      else captures.push(result);
      viewsInBatch += 1;
    }
  }
}

async function captureGroup(
  browser: Browser,
  config: Awaited<ReturnType<typeof configuration>>,
  group: (typeof groups)[number],
  sourceDigest: string,
  captures: Evidence[],
  skipped: Skipped[],
) {
  const diagnostics = {
    browserErrors: 0,
    blockedRequests: 0,
    blockedWrites: 0,
    profileCalls: 0,
    authRateLimits: 0,
    authUnavailable: 0,
  };
  const context = await browser.newContext({
    viewport: viewports[0],
    reducedMotion: "reduce",
    colorScheme: "light",
    locale: "en-IN",
    serviceWorkers: "block",
    // One fixed synthetic address per context separates concurrent local test clients.
    // It never rotates within a session and does not change the server quota.
    extraHTTPHeaders: {
      "x-forwarded-for": `198.18.${String(clientNetwork)}.${String(groups.indexOf(group) + 1)}`,
    },
  });
  const page = await context.newPage();
  page.setDefaultTimeout(30_000);
  page.on("response", (response) => {
    if (!new URL(response.url()).pathname.startsWith("/api/auth/")) return;
    const status = response.status();
    if (status === 429) {
      diagnostics.authRateLimits += 1;
      progress.authStatus = status;
      const responseHeaders = response.headers();
      const seconds = Math.max(
        Number(responseHeaders["retry-after"] ?? "0"),
        Number(responseHeaders["x-retry-after"] ?? "0"),
      );
      if (Number.isFinite(seconds) && seconds > 0)
        progress.retryAfterSeconds = Math.max(
          progress.retryAfterSeconds,
          seconds,
        );
    } else if (status >= 500) {
      diagnostics.authUnavailable += 1;
      progress.authStatus = status;
    }
  });
  page.on("pageerror", () => {
    diagnostics.browserErrors += 1;
  });
  await guardNetwork(context, config.origins, diagnostics);
  const account = config.credentials.accounts.find(
    ({ key }) => key === group.key,
  );
  let isAuthenticated = false;
  try {
    if (group.key === "admin") {
      await signInAdmin(page, config);
      isAuthenticated = true;
    } else if (group.key) {
      if (!account) throw new Error("MISSING_APPROVED_ACCOUNT");
      await signIn(page, config.origin, account);
      isAuthenticated = true;
    }
    await captureVariants({
      page,
      config,
      group,
      sourceDigest,
      diagnostics,
      isAuthenticated,
      captures,
      skipped,
    });
    assertDiagnostics(diagnostics);
    return diagnostics;
  } finally {
    try {
      if (isAuthenticated) {
        await quietWindow(page);
        if (group.key === "admin") {
          await page.goto(`${config.origin}/admin/operations`);
          await page.getByRole("button", { name: /^Sign out/ }).click();
          await expect(page.getByLabel("Email", { exact: true })).toBeVisible();
        } else await signOut(page, config.origin);
      }
    } finally {
      await context.close();
    }
  }
}

async function main() {
  if (process.argv.length !== 3 || process.argv[2] !== "--capture")
    throw new Error("EXPLICIT_CAPTURE_ARGUMENT_REQUIRED");
  const config = await configuration();
  const source = await provenance();
  await mkdir(output, { recursive: true });
  const browser = await chromium.launch();
  const captures: Evidence[] = [];
  const skipped: Skipped[] = [];
  const diagnostics: Diagnostics[] = [];
  try {
    for (const group of groups)
      diagnostics.push(
        await captureGroup(
          browser,
          config,
          group,
          source.sourceDigest,
          captures,
          skipped,
        ),
      );
    const after = await provenance();
    if (
      after.sourceDigest !== source.sourceDigest ||
      after.sourceRevision !== source.sourceRevision
    )
      throw new Error("SOURCE_CHANGED_DURING_CAPTURE");
    if (
      skipped.length > 0 ||
      captures.length !==
        workbookGuideCases.reduce(
          (total, item) => total + (item.persona === "admin" ? 6 : 18),
          0,
        )
    )
      throw new Error("CAPTURE_MATRIX_INCOMPLETE");
    await writeFile(
      manifestPath,
      `${JSON.stringify({ version: 1, kind: "current-local-connected", ...source, origin: config.origin, backendOrigins: [...config.origins].filter((origin) => origin !== config.origin).toSorted((a, b) => a.localeCompare(b)), siteAgreement: true, captureSchedule, capturedAt: new Date().toISOString(), provenance: "Unmodified browser screenshots of the actual local UI. Real email sign-in and admin TOTP; approved disposable aliases and existing synthetic domain records. The script creates no domain records or invitations and fabricates no authentication proof. Sessions come only from real sign-in.", authentication: "actual-browser-email-password-and-admin-totp", writes: "Authentication session lifecycle and the UI's existing identity.ensureProfile only", emailDelivery: "Not exercised; existing verified email accounts", externalProvidersTested: false, cloudDeploymentTested: false, trace: false, video: false, storageStateSaved: false, visualReview: "pending", diagnostics, captures, skipped }, null, 2)}\n`,
    );
    console.warn(
      `Captured ${String(captures.length)} safe views; ${String(skipped.length)} unavailable views skipped. Visual review is pending.`,
    );
  } finally {
    await browser.close();
  }
}

// Playwright and validation errors can contain entered values or URLs. Emit no raw errors.
try {
  await main();
} catch (error) {
  let reason = "unknown";
  if (error instanceof Error)
    reason = /^[A-Z_]+$/.test(error.message) ? error.message : error.name;
  console.error(
    `Workbook capture stopped at ${progress.step} (${progress.phase}: ${reason}; auth status ${String(progress.authStatus)}; Retry-After seconds ${String(progress.retryAfterSeconds)}). No manifest completion is claimed. Check local state, source stability and privacy guards before retrying.`,
  );
  process.exitCode = 1;
}
