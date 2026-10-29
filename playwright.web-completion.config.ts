import { readFileSync, statSync } from "node:fs";
import path from "node:path";
import { parseEnv } from "node:util";

import { defineConfig, devices } from "@playwright/test";
import { z } from "zod";

import { isLoopbackHttpOrigin } from "./convex/lib/localAcceptance";

// Run from the disposable clone. Never load, replace or provision root sessions.
process.env.PLAYWRIGHT_NO_COPY_PROMPT = "1";
const privateDir = path.resolve(".convex/local-acceptance");
const rosterPath = path.join(privateDir, "phone-sessions.json");
if (
  (statSync(privateDir).mode & 0o077) !== 0 ||
  (statSync(rosterPath).mode & 0o077) !== 0
)
  throw new Error(
    "Private local session files require restricted permissions.",
  );
const artifact = z
  .object({ site: z.string().refine(isLoopbackHttpOrigin) })
  .parse(JSON.parse(readFileSync(rosterPath, "utf8")));
const frontend = parseEnv(readFileSync(".env.local", "utf8"));
const backend = parseEnv(
  readFileSync(path.join(privateDir, "backend.env"), "utf8"),
);
const local = z
  .object({
    NEXT_PUBLIC_CONVEX_URL: z.string().refine(isLoopbackHttpOrigin),
    NEXT_PUBLIC_CONVEX_SITE_URL: z.string().refine(isLoopbackHttpOrigin),
  })
  .parse(frontend);
const auth = z
  .object({
    SITE_URL: z.string().refine(isLoopbackHttpOrigin),
    AUTH_LOCAL_TEST_MODE: z.literal("true"),
    AUTH_LOCAL_EMAIL_INBOX_URL: z.url(),
  })
  .parse(backend);
const inbox = new URL(auth.AUTH_LOCAL_EMAIL_INBOX_URL);
if (
  new URL(auth.SITE_URL).origin !== new URL(artifact.site).origin ||
  !isLoopbackHttpOrigin(inbox.origin) ||
  inbox.pathname !== "/deliver"
)
  throw new Error(
    "Connected acceptance requires matching loopback app, backend and inbox settings.",
  );
const effectiveSettings = Object.entries({ ...frontend, ...backend });
for (const [name, value] of effectiveSettings) {
  if (!value) continue;
  const isProviderCredential =
    /CASHFREE|SUREPASS|OPENROUTER|MSG91|OS_DIGITAL|RESEND|MAPBOX|R2_|CLOUDFLARE|TRIGGER/.test(
      name,
    ) && /KEY|SECRET|TOKEN|PASSWORD|CLIENT_ID/.test(name);
  const isEnabledProviderPath =
    value === "true" &&
    [
      "PAPER_ASSISTANCE_ENABLED",
      "PAPER_TRANSCRIPTION_ENABLED",
      "CASHFREE_LIVE_CHECKOUT_ENABLED",
      "CASHFREE_SANDBOX_CHECKOUT_ENABLED",
    ].includes(name);
  if (isProviderCredential || isEnabledProviderPath)
    throw new Error(
      "Connected keyless acceptance requires provider credentials and paid paths to remain off.",
    );
}

// Public loopback addresses only; no session or private environment is exported.
export const webCompletionTarget = {
  site: new URL(artifact.site).origin,
  convex: new URL(local.NEXT_PUBLIC_CONVEX_URL).origin,
  convexSite: new URL(local.NEXT_PUBLIC_CONVEX_SITE_URL).origin,
  rosterPath,
};

export default defineConfig({
  testDir: "./e2e/connected",
  testMatch: "web-completion-phone.spec.ts",
  outputDir: path.join(privateDir, "web-completion-results"),
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 180_000,
  expect: { timeout: 20_000 },
  reporter: "list",
  use: {
    baseURL: webCompletionTarget.site,
    trace: "off",
    screenshot: "off",
    video: "off",
    serviceWorkers: "block",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
