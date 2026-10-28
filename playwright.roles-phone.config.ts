import path from "node:path";

import { defineConfig, devices } from "@playwright/test";

process.env.PLAYWRIGHT_NO_COPY_PROMPT = "1";
export default defineConfig({
  testDir: "./e2e/connected",
  outputDir: path.join(
    process.env.LOCAL_ROLE_ACCEPTANCE_DIR ?? ".convex/local-role-acceptance",
    "browser-results",
  ),
  testMatch: "roles-phone.spec.ts",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 900_000,
  expect: { timeout: 20_000 },
  reporter: "list",
  use: { trace: "off", screenshot: "off", video: "off" },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
