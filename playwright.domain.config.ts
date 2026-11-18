import { defineConfig, devices } from "@playwright/test";

const port = Number(process.env.DOMAIN_TEST_PORT ?? 3112);

export default defineConfig({
  testDir: "./e2e-domain",
  workers: 1,
  reporter: "list",
  use: {
    ...devices["Desktop Chrome"],
    baseURL: "https://business.luma.green",
    ignoreHTTPSErrors: true,
    launchOptions: {
      args: [
        `--host-resolver-rules=MAP business.luma.green 127.0.0.1:${String(port)}`,
        "--no-proxy-server",
      ],
      executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH,
    },
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
  },
  webServer: {
    command:
      process.env.LUMA_DOMAIN_REUSE_BUILD === "true"
        ? "node e2e-domain/server.mjs"
        : "pnpm build && node e2e-domain/server.mjs",
    url: `https://127.0.0.1:${String(port)}`,
    ignoreHTTPSErrors: true,
    timeout: 240_000,
    reuseExistingServer: false,
    env: {
      NEXT_PUBLIC_BUSINESS_SITE_ENABLED: "true",
      NEXT_PUBLIC_CONVEX_URL: "",
      NEXT_PUBLIC_CONVEX_SITE_URL: "",
      NEXT_PUBLIC_TELEMETRY_ENABLED: "false",
    },
  },
});
