import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  testMatch: "identity-validation.spec.ts",
  workers: 2,
  timeout: 60_000,
  use: { screenshot: "only-on-failure" },
});
