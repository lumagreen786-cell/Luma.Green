import { defineConfig, devices } from "@playwright/test";

const port = Number(process.env.PORT ?? 3000);
const baseURL =
  process.env.PLAYWRIGHT_BASE_URL ?? `http://localhost:${String(port)}`;

export default defineConfig({
  testDir: "./e2e",
  // Authenticated local acceptance uses its own provisioned runtime and config.
  testIgnore: ["**/connected/**", "**/identity-validation.spec.ts"],
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  // One worker in CI: GitHub's free runners are 2-core and a flaky-under-load
  // suite is worse than a slow one.
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI
    ? [["github"], ["html", { open: "never" }]]
    : [["list"]],
  timeout: 30_000,
  expect: { timeout: 5000 },
  use: {
    baseURL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "off",
  },
  // Chromium only by default — it catches ~all regressions for a fraction of
  // the CI minutes. Add WebKit/Firefox projects before a public launch.
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: process.env.CI ? "pnpm start" : "pnpm dev",
    // Always test the build as it ships before Convex is connected — the same
    // in CI and locally, whatever .env.local says. (Next never lets .env files
    // override a variable that is already set, even to "".)
    env: { NEXT_PUBLIC_CONVEX_URL: "", NEXT_PUBLIC_CONVEX_SITE_URL: "" },
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
