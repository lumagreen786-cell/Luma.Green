import { createHash } from "node:crypto";
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { setTimeout as delay } from "node:timers/promises";
import { parseEnv } from "node:util";

import { chromium, expect as baseExpect } from "@playwright/test";
import { z } from "zod";
const root = process.cwd();
const expect = baseExpect.configure({ timeout: 15_000 });
const config = JSON.parse(
  await readFile(`${root}/.convex/local-acceptance/credentials.json`, "utf8"),
);
const origin = new URL(config.site);
if (
  origin.protocol !== "http:" ||
  !["localhost", "127.0.0.1", "[::1]"].includes(origin.hostname)
)
  throw new Error("Local origin required");
if (process.argv.length !== 3 || process.argv[2] !== "--capture")
  throw new Error("Use --capture to create a new complete local matrix.");
const environment = parseEnv(await readFile(`${root}/.env.local`, "utf8"));
const backend = parseEnv(
  await readFile(`${root}/.convex/local-acceptance/backend.env`, "utf8"),
);
const allowedOrigins = new Set([origin.origin]);
for (const value of [
  environment.NEXT_PUBLIC_CONVEX_URL,
  environment.NEXT_PUBLIC_CONVEX_SITE_URL,
  backend.SITE_URL,
]) {
  const url = new URL(value);
  if (
    url.protocol !== "http:" ||
    !["localhost", "127.0.0.1", "[::1]"].includes(url.hostname) ||
    url.origin !== value
  )
    throw new Error("Local source agreement required");
  allowedOrigins.add(url.origin);
}
if (
  backend.AUTH_LOCAL_TEST_MODE !== "true" ||
  backend.SITE_URL !== origin.origin ||
  environment.NEXT_PUBLIC_SITE_URL !== origin.origin
)
  throw new Error("Matching local test settings required");
const accountSchema = z.object({
  key: z.string(),
  email: z.email(),
  password: z.string().min(12),
});
const credentialSchema = z.object({ accounts: z.array(accountSchema) });
credentialSchema.parse(config);
const output = `${root}/docs/user-guide/screenshots`;
await mkdir(output, { recursive: true });
const manifestPath = `${root}/docs/user-guide/lots-captures.json`;
const sourceHashes = {};
async function hashSources(dir) {
  const entries = await readdir(`${root}/${dir}`, { withFileTypes: true });
  for (const entry of entries) {
    const path = `${dir}/${entry.name}`;
    if (entry.isDirectory()) await hashSources(path);
    else if (/\.(tsx?|css|json)$/.test(path) && !path.includes(".test."))
      sourceHashes[path] = createHash("sha256")
        .update(await readFile(`${root}/${path}`))
        .digest("hex");
  }
}
for (const dir of ["src", "convex", "messages"]) await hashSources(dir);
sourceHashes["scripts/capture-lots-guide.mjs"] = createHash("sha256")
  .update(await readFile(`${root}/scripts/capture-lots-guide.mjs`))
  .digest("hex");
const capturedSourceHashes = sourceHashes;
const browser = await chromium.launch({ headless: true });
const contexts = [];
const records = [];
const requestLog = [];
let stage = "start";
let completedGroups = 0;
async function account(key) {
  const person = config.accounts.find((row) => row.key === key);
  if (!person) throw new Error("Missing local actor");
  const context = await browser.newContext({
    baseURL: origin.origin,
    extraHTTPHeaders: {
      "X-Forwarded-For": `192.0.2.${config.accounts.indexOf(person) + 1}`,
    },
  });
  contexts.push(context);
  await context.route("**/*", async (route) => {
    const url = new URL(route.request().url());
    if (allowedOrigins.has(url.origin)) await route.continue();
    else {
      requestLog.push({
        actor: key,
        path: "external-request-blocked",
        status: 0,
      });
      await route.abort();
    }
  });
  context.on("response", (response) => {
    const url = new URL(response.url());
    if (url.pathname.startsWith("/api/auth/"))
      requestLog.push({
        actor: key,
        path: url.pathname,
        status: response.status(),
        at: new Date().toISOString(),
      });
  });
  const response = await context.request.post(
    `${origin.origin}/api/auth/sign-in/email`,
    {
      headers: {
        Origin: origin.origin,
        "X-Forwarded-For": `192.0.2.${config.accounts.indexOf(person) + 1}`,
      },
      data: { email: person.email, password: person.password },
    },
  );
  if (!response.ok()) throw new Error(`Local sign-in failed for ${key}`);
  const page = await context.newPage();
  return page;
}
async function focusByKeyboard(page, control) {
  const controls = await page
    .locator('button,input,textarea,select,a[href],[tabindex="0"]')
    .count();
  for (let index = 0; index <= controls; index++) {
    if (await control.evaluate((element) => document.activeElement === element))
      return;
    await page.keyboard.press("Tab");
  }
}
async function settled(page, title) {
  await expect(
    page.getByRole("heading", { level: 1, name: title, exact: true }),
  ).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
  await page.locator("main").waitFor({ state: "visible" });
}
async function capture(page, stateName, detail = {}) {
  const name = `lots-${stateName}`;
  const messages = JSON.parse(
    await readFile(`${root}/messages/${detail.locale}.json`, "utf8"),
  );
  // A visible error-boundary heading is not the requested operational state.
  await expect(
    page.getByRole("heading", {
      level: 1,
      name: messages.common.error,
      exact: true,
      includeHidden: true,
    }),
  ).toHaveCount(0);
  await page.evaluate(() => document.fonts.ready);
  await page.evaluate(async () => {
    await Promise.allSettled(
      document
        .getAnimations()
        .filter(
          (animation) => animation.effect?.getTiming().iterations !== Infinity,
        )
        .map((animation) => animation.finished),
    );
  });
  const metrics = await page.evaluate(() => {
    const candidates = [
      ...document.querySelectorAll('button,[role="combobox"]'),
    ].filter((el) => el.getClientRects().length > 0);
    const clipped = candidates
      .filter(
        (el) =>
          (el.textContent ?? "").trim().length > 0 &&
          (el.scrollWidth > el.clientWidth + 2 ||
            el.scrollHeight > el.clientHeight + 2),
      )
      .map((el) => (el.textContent ?? "").trim());
    return {
      width: innerWidth,
      height: innerHeight,
      scrollWidth: document.documentElement.scrollWidth,
      dir: document.documentElement.dir,
      dark: document.documentElement.classList.contains("dark"),
      clippedControls: clipped,
      loadedFonts: [...document.fonts]
        .filter((face) => face.status === "loaded")
        .map((face) => face.family),
    };
  });
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("DOM.enable");
  await cdp.send("CSS.enable");
  const doc = await cdp.send("DOM.getDocument");
  let selector = "main h1";
  if (await page.getByRole("dialog").count()) {
    selector = (await page.locator('[role="dialog"] nav').count())
      ? '[role="dialog"] nav a span'
      : '[role="dialog"] h2';
  }
  const { nodeId } = await cdp.send("DOM.querySelector", {
    nodeId: doc.root.nodeId,
    selector,
  });
  const platform = await cdp.send("CSS.getPlatformFontsForNode", { nodeId });
  await cdp.detach();
  metrics.glyphFonts = platform.fonts;
  const requiredFont = {
    en: selector.includes("nav a") ? "Noto Sans" : "Geist",
    ar: "Noto Sans Arabic",
    kn: "Noto Sans Kannada",
  }[detail.locale];
  if (
    requiredFont &&
    metrics.glyphFonts.every(
      (font) =>
        !(
          font.isCustomFont &&
          font.familyName === requiredFont &&
          font.glyphCount > 0
        ),
    )
  )
    throw new Error(`Required script font is not used: ${name}`);
  const isExpectedDark = detail.theme === "dark";
  if (
    metrics.dir !== (detail.locale === "ar" ? "rtl" : "ltr") ||
    metrics.dark !== isExpectedDark
  )
    throw new Error(`Wrong theme or direction: ${name}`);
  if (metrics.scrollWidth > metrics.width + 1)
    throw new Error(`Horizontal overflow: ${name}`);
  if (metrics.clippedControls.length > 0)
    throw new Error(
      `Clipped controls: ${name}: ${metrics.clippedControls.join(" | ")}`,
    );
  await page.screenshot({ path: `${output}/${name}.png`, fullPage: false });
  records.push({
    file: `${name}.png`,
    capturedAt: new Date().toISOString(),
    sha256: createHash("sha256")
      .update(await readFile(`${output}/${name}.png`))
      .digest("hex"),
    route: new URL(page.url()).pathname.replace(/\/lots\/[^/]+/, "/lots/[id]"),
    ...detail,
    ...metrics,
  });
  await writeFile(
    manifestPath,
    JSON.stringify(
      {
        version: 1,
        complete: false,
        sourceHashes: capturedSourceHashes,
        provenance:
          "Actual authenticated local application; reserved synthetic acceptance accounts; no external provider calls",
        capturedAt: new Date().toISOString(),
        records,
      },
      null,
      2,
    ),
  );
  process.stdout.write(`${name}\n`);
}
try {
  const owner = await account("kabadiwala"),
    receiver = await account("preprocessor");
  await receiver.goto("/en/app/lots");
  const en = JSON.parse(
    await readFile(`${root}/messages/en.json`, "utf8"),
  ).lots;
  await settled(receiver, en.title);
  const detailLink = receiver
    .locator('section[aria-labelledby="held-lots"]')
    .getByRole("link")
    .filter({ hasText: "Acceptance PET" })
    .first();
  await expect(detailLink).toBeVisible();
  const href = await detailLink.getAttribute("href");
  if (!href) throw new Error("No received acceptance lot");
  const path = href.replace(/^\/(en|ar|kn)(?=\/)/, "");
  for (const locale of ["en", "ar", "kn"]) {
    const messages = JSON.parse(
      await readFile(`${root}/messages/${locale}.json`, "utf8"),
    );
    const t = messages.lots;
    for (const theme of ["light", "dark"])
      for (const width of [390, 768, 1440]) {
        const height = width === 390 ? 844 : 1000;
        const prefix = `${locale}-${theme}-${width}`;
        stage = prefix;
        // Better Auth's configured quota resets after a quiet window; pace capture rather than renew sessions.
        if (completedGroups > 0) {
          process.stdout.write(
            "Quiet window before next capture group (11 seconds).\n",
          );
          await delay(11_000);
        }
        for (const page of [owner, receiver]) {
          await page.setViewportSize({ width, height });
          await page.emulateMedia({ colorScheme: theme });
          await page.goto(`/${locale}/app/lots`);
          await page.evaluate(
            (value) => localStorage.setItem("theme", value),
            theme,
          );
          await page.reload();
          await settled(page, t.title);
        }

        await capture(owner, `${prefix}-list`, {
          locale,
          theme,
          state: "list",
          actor: "kabadiwala",
        });
        if (width < 1280) {
          const opener = owner
            .getByRole("button", { name: messages.app.more, exact: true })
            .first();
          await opener.click();
          await expect(
            owner
              .getByRole("dialog")
              .getByRole("link", { name: t.title, exact: true }),
          ).toBeVisible();
          await capture(owner, `${prefix}-menu`, {
            locale,
            theme,
            state: "business navigation menu",
            actor: "kabadiwala",
          });
          await owner.keyboard.press("Escape");
          await expect(opener).toBeFocused();
        }
        if (width === 390) {
          await owner
            .getByRole("button", { name: t.declare, exact: true })
            .click();
          const form = owner.getByRole("dialog", {
            name: t.declare,
            exact: true,
          });
          await expect(form).toBeVisible();
          await capture(owner, `${prefix}-declare`, {
            locale,
            theme,
            state: "declare form",
            actor: "kabadiwala",
          });
          await owner.keyboard.press("Escape");
          await expect(
            owner.getByRole("button", { name: t.declare, exact: true }),
          ).toBeFocused();
        }
        await receiver.goto(`/${locale}${path}`);
        await settled(receiver, t.detail);
        await capture(receiver, `${prefix}-detail`, {
          locale,
          theme,
          state: "received lot detail",
          actor: "preprocessor",
        });
        await receiver.evaluate(() =>
          window.scrollTo(0, document.body.scrollHeight),
        );
        await capture(receiver, `${prefix}-detail-bottom`, {
          locale,
          theme,
          state: "received lot detail lower evidence",
          actor: "preprocessor",
        });
        await receiver.evaluate(() => window.scrollTo(0, 0));
        if (width === 390) {
          for (const action of ["transform", "dispatch"]) {
            await receiver
              .getByRole("button", { name: t[action], exact: true })
              .click();
            await expect(
              receiver.getByRole("dialog", { name: t[action], exact: true }),
            ).toBeVisible();
            if (action === "transform") {
              await receiver
                .getByRole("dialog")
                .getByRole("button", { name: t.addInput, exact: true })
                .click();
              await receiver
                .getByRole("dialog")
                .getByRole("region", { name: t.additionalInputs, exact: true })
                .scrollIntoViewIfNeeded();
            }
            await capture(receiver, `${prefix}-${action}`, {
              locale,
              theme,
              state: `${action} form`,
              actor: "preprocessor",
            });
            if (action === "transform") {
              const save = receiver
                .getByRole("dialog")
                .getByRole("button", { name: t.save, exact: true });
              await focusByKeyboard(receiver, save);
              await expect(save).toBeFocused();
              await capture(receiver, `${prefix}-transform-bottom`, {
                locale,
                theme,
                state: "transform form bottom reached by keyboard",
                actor: "preprocessor",
              });
            }
            await receiver.keyboard.press("Escape");
            await expect(
              receiver.getByRole("button", { name: t[action], exact: true }),
            ).toBeFocused();
          }
        }
        await receiver
          .getByRole("button", { name: t.inspection, exact: true })
          .click();
        const dialog = receiver.getByRole("dialog", {
          name: t.inspection,
          exact: true,
        });
        await expect(dialog).toBeVisible();
        await capture(receiver, `${prefix}-inspection-top`, {
          locale,
          theme,
          state: "inspection form top",
          actor: "preprocessor",
        });
        const save = dialog.getByRole("button", { name: t.save, exact: true });
        await focusByKeyboard(receiver, save);
        await expect(save).toBeFocused();
        await capture(receiver, `${prefix}-inspection-bottom`, {
          locale,
          theme,
          state: "inspection form bottom reached by keyboard",
          actor: "preprocessor",
        });
        await receiver.keyboard.press("Escape");
        await expect(
          receiver.getByRole("button", { name: t.inspection, exact: true }),
        ).toBeFocused();
        completedGroups++;
      }
  }

  // The Saathi dashboard shares the operational layout, with its own compact earnings row.
  const saathi = await account("saathi");
  for (const locale of ["en", "ar", "kn"])
    for (const theme of ["light", "dark"])
      for (const width of [390, 768, 1440]) {
        const prefix = `${locale}-${theme}-${width}-saathi`;
        stage = prefix;
        await delay(11_000);
        await saathi.setViewportSize({
          width,
          height: width === 390 ? 844 : 1000,
        });
        await saathi.emulateMedia({ colorScheme: theme });
        await saathi.goto(`/${locale}/app`);
        await saathi.evaluate(
          (value) => localStorage.setItem("theme", value),
          theme,
        );
        await saathi.reload();
        await expect(
          saathi.locator("main").getByRole("heading", { level: 1 }),
        ).toBeVisible();
        await expect(saathi.locator("main [aria-busy=true]")).toHaveCount(0);
        await capture(saathi, prefix, {
          locale,
          theme,
          state: "Saathi home",
          actor: "saathi",
        });
      }
  const manufacturer = await account("manufacturer");
  for (const locale of ["en", "ar", "kn"])
    for (const theme of ["light", "dark"])
      for (const width of [390, 768, 1440]) {
        await delay(11_000);
        const messages = JSON.parse(
          await readFile(`${root}/messages/${locale}.json`, "utf8"),
        );
        for (const [page, actor, route, suffix] of [
          [manufacturer, "manufacturer", "/app/sell", "manufacturer-sell"],
          [owner, "kabadiwala", "/app/market", "kabadiwala-buy"],
          [
            manufacturer,
            "manufacturer",
            "/app/trades?tab=selling",
            "manufacturer-selling",
          ],
          [owner, "kabadiwala", "/app/trades?tab=buying", "kabadiwala-buying"],
        ]) {
          stage = `${locale}-${theme}-${width}-${suffix}`;
          await page.setViewportSize({
            width,
            height: width === 390 ? 844 : 1000,
          });
          await page.emulateMedia({ colorScheme: theme });
          await page.goto(`/${locale}${route}`);
          await page.evaluate(
            (value) => localStorage.setItem("theme", value),
            theme,
          );
          await page.reload();
          await expect(
            page.locator("main").getByRole("heading", { level: 1 }),
          ).toBeVisible();
          await expect(page.locator("main [aria-busy=true]")).toHaveCount(0);
          await expect(
            page
              .locator("main")
              .getByText("Local test paper offcuts", { exact: false })
              .first(),
          ).toBeVisible();
          if (
            suffix === "manufacturer-selling" ||
            suffix === "kabadiwala-buying"
          ) {
            // Each trade loads its financial state separately from the list.
            // Wait for every rendered lifecycle before recording the screen.
            await expect(
              page.locator("main").getByRole("status").filter({
                hasText: messages.common.loading,
              }),
            ).toHaveCount(0);
            await expect(
              page
                .locator("main")
                .getByText(messages.tradeLifecycle.state.awaiting_payment, {
                  exact: true,
                })
                .first(),
            ).toBeVisible();
          }
          if (suffix === "manufacturer-sell") {
            await page
              .getByRole("checkbox", {
                name: messages.marketSpecification.enable,
                exact: true,
              })
              .check();
            await page
              .getByLabel(messages.marketSpecification.grade, { exact: true })
              .fill("Local draft grade");
            await page
              .getByLabel(messages.marketSpecification.specification, {
                exact: true,
              })
              .fill("Synthetic draft quality specification for the guide");
            await page
              .getByRole("group", {
                name: messages.marketSpecification.title,
                exact: true,
              })
              .scrollIntoViewIfNeeded();
          } else {
            const actualGrade = page
              .getByText(/^Local browser offer .* grade$/, { exact: true })
              .first();
            await expect(actualGrade).toBeVisible();
            await actualGrade.scrollIntoViewIfNeeded();
            // Keep the page heading below the sticky shell after grade scrolling.
            await page.evaluate(() => window.scrollTo(0, 0));
          }
          await capture(page, stage, { locale, theme, state: suffix, actor });
        }
        const prefix = `${locale}-${theme}-${width}`;
        await owner
          .getByRole("button", {
            name: messages.sandboxPayment.title,
            exact: true,
          })
          .first()
          .click();
        await expect(
          owner
            .getByRole("dialog")
            .getByText(messages.sandboxPayment.unavailable, { exact: true }),
        ).toBeVisible();
        await capture(owner, `${prefix}-sandbox-unavailable`, {
          locale,
          theme,
          state: "sandbox checkout unavailable without provider setup",
          actor: "kabadiwala",
        });
        await owner.keyboard.press("Escape");
        await manufacturer.goto(`/${locale}/app/evidence`);
        await settled(manufacturer, messages.evidence.title);
        await expect(
          manufacturer
            .getByRole("heading", { name: /^LOCAL-EVIDENCE-/ })
            .first(),
        ).toBeVisible();
        await capture(manufacturer, `${prefix}-evidence-history`, {
          locale,
          theme,
          state: "reported document reference history",
          actor: "manufacturer",
        });
        for (const [action, suffix] of [
          ["record", "evidence-form"],
          ["correct", "evidence-correction"],
        ]) {
          await manufacturer
            .getByRole("button", {
              name: messages.evidence[action],
              exact: true,
            })
            .first()
            .click();
          await expect(manufacturer.getByRole("dialog")).toBeVisible();
          await capture(manufacturer, `${prefix}-${suffix}`, {
            locale,
            theme,
            state: suffix,
            actor: "manufacturer",
          });
          await manufacturer.keyboard.press("Escape");
        }
        await manufacturer.goto(`/${locale}/app/stock`);
        await settled(manufacturer, messages.shop.stock.title);
        const intakeSection = manufacturer.getByRole("region", {
          name: messages.stockIntake.title,
          exact: true,
        });
        await expect(
          intakeSection
            .getByRole("heading", { name: /^LOCAL-INTAKE-/ })
            .first(),
        ).toBeVisible();
        await intakeSection
          .getByRole("heading", {
            name: messages.stockIntake.title,
            exact: true,
          })
          .scrollIntoViewIfNeeded();
        await capture(manufacturer, `${prefix}-stock-intake-history`, {
          locale,
          theme,
          actor: "manufacturer",
          state: "explicit own-production stock receipt history",
        });
        await intakeSection
          .getByRole("button", { name: messages.stockIntake.add, exact: true })
          .click();
        await expect(manufacturer.getByRole("dialog")).toBeVisible();
        await capture(manufacturer, `${prefix}-stock-intake-form`, {
          locale,
          theme,
          actor: "manufacturer",
          state: "own-production stock intake form, not submitted",
        });
        await manufacturer.keyboard.press("Escape");
        // All records below come from the connected industry acceptance journey.
        await owner.goto(`/${locale}/app/facility`);
        await settled(owner, messages.facility.title);
        const facilityRow = owner
          .getByRole("listitem")
          .filter({
            has: owner.getByRole("heading", { name: /^Local industry line / }),
          })
          .first();
        await expect(facilityRow).toBeVisible();
        await capture(owner, `${prefix}-facility-list`, {
          locale,
          theme,
          actor: "kabadiwala",
          state: "self-declared facility list",
        });
        await facilityRow
          .getByRole("button", { name: messages.facility.edit, exact: true })
          .click();
        const facilityForm = owner.getByRole("dialog");
        await facilityForm
          .getByRole("button", { name: messages.industry.select, exact: true })
          .click();
        await expect(facilityForm.getByRole("searchbox")).toBeVisible();
        await capture(owner, `${prefix}-facility-form`, {
          locale,
          theme,
          actor: "kabadiwala",
          state: "facility editor and original-English sector picker",
        });
        await owner.keyboard.press("Escape");
        const explorer = owner
          .locator("main section")
          .filter({
            has: owner.getByRole("heading", {
              name: messages.industry.title,
              exact: true,
            }),
          })
          .first();
        await explorer.getByRole("searchbox").fill("plastic");
        await explorer
          .getByRole("button", { name: messages.industry.view, exact: true })
          .first()
          .click();
        const detail = owner.getByRole("region", {
          name: messages.industry.selected,
          exact: true,
        });
        await expect(detail).toBeVisible();
        await detail.scrollIntoViewIfNeeded();
        await capture(owner, `${prefix}-industry-reference`, {
          locale,
          theme,
          actor: "kabadiwala",
          state: "unverified original-English workbook reference",
        });
        await facilityRow
          .getByRole("button", {
            name: messages.facility.registration.title,
            exact: true,
          })
          .click();
        const registration = facilityRow.getByRole("region", {
          name: messages.facility.registration.title,
          exact: true,
        });
        await expect(
          registration.getByText(/^LOCAL-CORRECTED-/).first(),
        ).toBeVisible();
        await registration.scrollIntoViewIfNeeded();
        await capture(owner, `${prefix}-registration-history`, {
          locale,
          theme,
          actor: "kabadiwala",
          state: "reported dates and append-only facility reference history",
        });
        await registration
          .getByRole("button", {
            name: messages.facility.registration.correct,
            exact: true,
          })
          .first()
          .click();
        await expect(owner.getByRole("dialog")).toBeVisible();
        await capture(owner, `${prefix}-registration-correction`, {
          locale,
          theme,
          actor: "kabadiwala",
          state: "append-only facility reference correction",
        });
        await owner.keyboard.press("Escape");
        await owner.goto(`/${locale}/app/lots`);
        await settled(owner, messages.lots.title);
        const residual = owner
          .locator('section[aria-labelledby="held-lots"]')
          .getByRole("link")
          .filter({ hasText: /Local classified PET .* residual_waste/ })
          .first();
        await expect(residual).toBeVisible();
        await residual.click();
        await settled(owner, messages.lots.detail);
        await expect(
          owner.getByText(messages.lots.controlledBlocked, { exact: true }),
        ).toBeVisible();
        await capture(owner, `${prefix}-controlled-detail`, {
          locale,
          theme,
          actor: "kabadiwala",
          state: "controlled residual lot with disposition evidence",
        });
        await owner
          .getByRole("button", {
            name: messages.lots.recordDisposition,
            exact: true,
          })
          .click();
        await expect(owner.getByRole("dialog")).toBeVisible();
        await capture(owner, `${prefix}-controlled-disposition`, {
          locale,
          theme,
          actor: "kabadiwala",
          state: "controlled disposition evidence form",
        });
        await owner.keyboard.press("Escape");
      }
  if (records.length !== 450)
    throw new Error("Incomplete capture state matrix");
  const endHashes = {};
  for (const path of Object.keys(sourceHashes))
    endHashes[path] = createHash("sha256")
      .update(await readFile(`${root}/${path}`))
      .digest("hex");
  const changed = Object.keys(sourceHashes).filter(
    (path) => endHashes[path] !== sourceHashes[path],
  );
  if (changed.length > 0)
    throw new Error(
      "Source changed during capture; run a new complete capture.",
    );
  if (requestLog.some((row) => row.status === 429 || row.status === 0))
    throw new Error(
      "Rate-limited or blocked external request during final capture",
    );
  await writeFile(
    manifestPath,
    JSON.stringify(
      {
        version: 1,
        complete: true,
        sourceHashes: capturedSourceHashes,
        provenance:
          "Actual authenticated local application with synthetic accounts and stock. No external provider execution.",
        capturedAt: new Date().toISOString(),
        records,
      },
      null,
      2,
    ),
  );
  process.stdout.write(
    `Captured ${records.length} original screenshots; bounds and keyboard checks passed.\n`,
  );
} catch (error) {
  process.stderr.write(
    `Capture failed at ${stage}: ${error instanceof Error ? error.name : "Unknown error"}\n`,
  );
  process.exitCode = 1;
} finally {
  for (const context of contexts) await context.close();
  await browser.close();
}
