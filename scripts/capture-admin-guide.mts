/** Real local admin captures. No provider calls, business mutations or saved sessions. */
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { parseEnv } from "node:util";

import {
  type BrowserContext,
  chromium,
  expect,
  type Page,
} from "@playwright/test";
import { z } from "zod";

import { isLoopbackHttpOrigin } from "../convex/lib/localAcceptance";
import { currentCode } from "../e2e/connected/totp";
import { themeStorageKey } from "../src/components/theme/theme";

interface Stats {
  blockedRequests: number;
  blockedWrites: number;
  browserErrors: number;
  profileCalls: number;
}
const hash = (bytes: Buffer) =>
  createHash("sha256").update(bytes).digest("hex");
const files = [
  "scripts/capture-admin-guide.mts",
  "e2e/connected/totp.ts",
  "src/components/admin/console-shell.tsx",
  "src/components/admin/payment-setup.tsx",
  "src/components/admin/payment-lifecycle.tsx",
  "convex/cashfreeLifecycle.ts",
  "convex/cashfreeLifecycleActions.ts",
  "convex/cashfreeRefunds.ts",
  "convex/lib/cashfreeLifecycle.ts",
  "convex/lib/cashfreeLifecycleContract.ts",
  "convex/lib/cashfreeLifecycleProvider.ts",
  "convex/lib/cashfreeLifecycleSchema.ts",
  "src/components/admin/prices/catalogue-setup.tsx",
  "src/components/admin/prices/material-classification.tsx",
  "convex/byproductClassification.ts",
  "src/components/admin/prices/price-tables.tsx",
  "src/components/ui/dialog.tsx",
  "src/components/theme/theme.ts",
  "src/components/ui/tabs.tsx",
  "src/components/ui/button.tsx",
  "src/app/globals.css",
  "src/lib/fonts.ts",
  "convex/cashfreePayments.ts",
  "convex/cashfreeActions.ts",
  "convex/catalogue.ts",
  "convex/lib/access.ts",
  "src/components/account/use-sign-out.ts",
  "src/components/admin/use-admin-sign-out.ts",
  "src/lib/sign-out.ts",
];
const accountSchema = z.object({
  email: z.literal("admin@luma.test"),
  password: z.string().min(12),
  secret: z.string().min(16),
});
async function settings() {
  if (!process.argv.includes("--capture"))
    throw new Error("EXPLICIT_CAPTURE_FLAG_REQUIRED");
  const backend = parseEnv(
    await readFile(".convex/local-acceptance/backend.env", "utf8"),
  );
  const local = parseEnv(await readFile(".env.local", "utf8"));
  const origin = backend.SITE_URL;
  const endpoints = [
    origin,
    local.NEXT_PUBLIC_CONVEX_URL,
    local.NEXT_PUBLIC_CONVEX_SITE_URL,
  ];
  if (
    !origin ||
    endpoints.some((value) => !value || !isLoopbackHttpOrigin(value)) ||
    backend.AUTH_LOCAL_TEST_MODE !== "true" ||
    local.NEXT_PUBLIC_SITE_URL !== origin
  )
    throw new Error("LOCAL_CONFIGURATION_REQUIRED");
  const account = accountSchema.parse(
    JSON.parse(
      await readFile(".convex/local-acceptance/admin.json", "utf8"),
    ) as unknown,
  );
  if (backend.ADMIN_EMAIL !== account.email)
    throw new Error("APPROVED_ADMIN_REQUIRED");
  return {
    origin,
    account,
    origins: new Set(
      endpoints.filter((value): value is string => Boolean(value)),
    ),
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
  diagnostics: Stats,
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

async function capture(
  page: Page,
  name: string,
  secretValues: string[],
  stats: Stats,
) {
  await page.evaluate(async () => {
    await document.fonts.ready;
  });
  const text = await page.locator("body").innerText();
  if (
    secretValues.some((value) => text.includes(value)) ||
    /Vendor reference:(?! local_test_shop_vendor(?:\s|$))/.test(text)
  )
    throw new Error("PRIVATE_VALUE_CAPTURE_REJECTED");
  await expect(page.locator('input[type="password"]')).toHaveCount(0);
  if (stats.blockedRequests || stats.blockedWrites || stats.browserErrors)
    throw new Error("CAPTURE_DIAGNOSTICS_FAILED");
  const file = `${name}.png`;
  const path = `docs/user-guide/screenshots/${file}`;
  await page.screenshot({ path, fullPage: false });
  return {
    file,
    screenshotSha256: hash(await readFile(path)),
    capturedAt: new Date().toISOString(),
    sourceKind: "real-local-admin-current-ui",
    productionAuthenticationTested: false,
    localPasswordAndTotpAuthenticationTested: true,
    providerExecutionTested: false,
  };
}
async function main() {
  const config = await settings();
  await mkdir("docs/user-guide/screenshots", { recursive: true });
  const sourceHashes = Object.fromEntries<string>(
    await Promise.all(
      files.map(async (file): Promise<[string, string]> => [
        file,
        hash(await readFile(file)),
      ]),
    ),
  );
  const browser = await chromium.launch();
  const stats: Stats = {
    blockedRequests: 0,
    blockedWrites: 0,
    browserErrors: 0,
    profileCalls: 0,
  };
  const captures = [];
  try {
    const context = await browser.newContext({
      reducedMotion: "reduce",
      viewport: { width: 1440, height: 1000 },
    });
    await guardNetwork(context, config.origins, stats);
    const page = await context.newPage();
    page.on("pageerror", () => {
      stats.browserErrors += 1;
    });
    await page.goto(`${config.origin}/admin/login`);
    await page.getByLabel("Email", { exact: true }).fill(config.account.email);
    await page
      .getByLabel("Password", { exact: true })
      .fill(config.account.password);
    await page.getByRole("button", { name: "Continue", exact: true }).click();
    await expect(
      page.getByLabel("Code from your authenticator app"),
    ).toBeVisible();
    await page
      .getByLabel("Code from your authenticator app")
      .fill(currentCode(config.account.secret));
    await expect(
      page.getByRole("heading", { name: "Welcome, Local", exact: true }),
    ).toBeVisible();
    for (const theme of ["light", "dark"] as const) {
      await page.emulateMedia({ colorScheme: theme });
      await page.evaluate(
        ({ key, value }) => {
          localStorage.setItem(key, value);
        },
        { key: themeStorageKey, value: theme },
      );
      for (const width of [390, 768, 1440]) {
        await page.setViewportSize({
          width,
          height:
            new Map([
              [390, 844],
              [768, 1024],
            ]).get(width) ?? 1000,
        });
        const prefix = `admin-current-en-${theme}-${String(width)}`;
        const secrets = [
          config.account.email,
          config.account.password,
          config.account.secret,
        ];
        await page.goto(`${config.origin}/admin/prices`);
        if (theme === "dark")
          await expect(page.locator("html")).toHaveClass(/dark/);
        else await expect(page.locator("html")).not.toHaveClass(/dark/);
        await expect(page.locator("html")).toHaveCSS("color-scheme", theme);
        await expect(
          page.getByRole("heading", { name: "Prices", exact: true }),
        ).toBeVisible();
        // Catalogue captures represent settled local data, not query loading.
        await expect(
          page.getByLabel("Material to review", { exact: true }),
        ).toBeVisible();
        await expect(page.locator('[data-slot="skeleton"]')).toHaveCount(0);
        await page
          .getByRole("heading", {
            name: "Material catalogue setup",
            exact: true,
          })
          .evaluate((heading) => {
            heading.scrollIntoView({ block: "start" });
          });
        captures.push(
          await capture(page, `${prefix}-catalogue`, secrets, stats),
        );
        await page.getByLabel("Material to review", { exact: true }).click();
        await page.getByRole("option", { name: /PLASTIC-PET$/ }).click();
        await expect(
          page.getByLabel("New classification", { exact: true }),
        ).toBeVisible();
        await expect(
          page.getByText(
            "Reference: Local acceptance material review; test data only",
            { exact: true },
          ),
        ).toBeVisible();
        await page
          .getByRole("heading", {
            name: "Material classification",
            exact: true,
          })
          .evaluate((heading) => {
            heading.scrollIntoView({ block: "start" });
          });
        captures.push(
          await capture(page, `${prefix}-classification`, secrets, stats),
        );
        await page.goto(`${config.origin}/admin/payments`);
        await expect(
          page.getByRole("heading", { name: "Payment setup", exact: true }),
        ).toBeVisible();
        await expect(
          page.getByText("Provider credentials are not configured.", {
            exact: true,
          }),
        ).toBeVisible();
        await expect(
          page
            .getByRole("button", { name: "Add vendor reference", exact: true })
            .first(),
        ).toBeVisible();
        captures.push(
          await capture(page, `${prefix}-payments`, secrets, stats),
        );
        await page
          .getByRole("button", { name: "Add vendor reference", exact: true })
          .first()
          .click();
        await expect(page.getByRole("dialog")).toBeVisible();
        await expect(
          page.getByLabel("Cashfree vendor reference", { exact: true }),
        ).toHaveValue("");
        captures.push(
          await capture(page, `${prefix}-vendor-dialog`, secrets, stats),
        );
        await page.getByRole("button", { name: "Cancel", exact: true }).click();
        await page
          .getByRole("heading", {
            name: "Payment terms and activation",
            exact: true,
          })
          .evaluate((heading) => {
            heading.scrollIntoView({ block: "start" });
          });
        await expect(
          page.getByText("Not configured", { exact: true }),
        ).toBeVisible();
        captures.push(
          await capture(page, `${prefix}-policy-section`, secrets, stats),
        );
        await page
          .getByRole("button", { name: "Record approved policy", exact: true })
          .click();
        const policyDialog = page.getByRole("dialog", {
          name: "Record approved payment policy",
          exact: true,
        });
        await expect(policyDialog).toBeVisible();
        await expect(
          policyDialog.getByLabel("Policy version", { exact: true }),
        ).toHaveValue("");
        await expect(
          policyDialog.getByLabel("Approved settlement terms reference", {
            exact: true,
          }),
        ).toHaveValue("");
        await expect(
          policyDialog.getByLabel("Provider acceptance test reference", {
            exact: true,
          }),
        ).toHaveValue("");
        await expect(
          policyDialog.getByRole("button", {
            name: "Save approved version",
            exact: true,
          }),
        ).toBeDisabled();
        captures.push(
          await capture(page, `${prefix}-policy-dialog`, secrets, stats),
        );
        await policyDialog
          .getByRole("button", { name: "Close", exact: true })
          .click();
      }
    }
    await page.getByRole("button", { name: /^Sign out/ }).click();
    await expect(page.getByLabel("Email", { exact: true })).toBeVisible();
    await context.close();
  } finally {
    await browser.close();
  }
  await writeFile(
    "docs/user-guide/admin-current-captures.json",
    `${JSON.stringify(
      {
        version: 1,
        origin: config.origin,
        sourceHashes,
        captures,
        diagnostics: stats,
        businessWritesAllowed: false,
        providerCallsAllowed: false,
        visualReview: {
          status: "pending",
          note: "Inspect every original before publication.",
        },
      },
      null,
      2,
    )}\n`,
  );
  process.stdout.write(
    `Captured ${String(captures.length)} current local admin screens. Visual review pending.\n`,
  );
}
try {
  await main();
} catch {
  process.stderr.write(
    "Admin capture failed. Inspect locally without printing private configuration.\n",
  );
  process.exitCode = 1;
}
