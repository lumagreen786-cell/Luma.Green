import { defineConfig, devices } from "@playwright/test";

const baseURL = "http://localhost:3106";

/** Isolated fake-key run. Vendor requests are intercepted by the browser spec. */
export default defineConfig({
  testDir: "./e2e-analytics",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 60_000,
  expect: { timeout: 15_000 },
  reporter: [["list"]],
  use: {
    baseURL,
    reducedMotion: "reduce",
    colorScheme: "light",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "off",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: "pnpm exec next start --hostname localhost --port 3106",
    url: baseURL,
    reuseExistingServer: false,
    timeout: 120_000,
    env: {
      NEXT_PUBLIC_TELEMETRY_ENABLED: "true",
      NEXT_PUBLIC_VERCEL_ANALYTICS_ENABLED: "true",
      NEXT_PUBLIC_BUSINESS_SITE_ENABLED: "true",
      NEXT_PUBLIC_GA_MEASUREMENT_ID: "G-LUMATEST",
      NEXT_PUBLIC_POSTHOG_KEY: "phc_luma_test",
      NEXT_PUBLIC_POSTHOG_HOST: "https://eu.i.posthog.com",
      NEXT_PUBLIC_SENTRY_DSN: "",
      NEXT_PUBLIC_CONVEX_URL: "",
      NEXT_PUBLIC_CONVEX_SITE_URL: "",
    },
  },
});
