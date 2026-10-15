import { defineConfig, devices } from "@playwright/test";

/** Isolated browser fixture: bundles the real client helper, never sends SMS. */
export default defineConfig({
  testDir: "./e2e-turnstile",
  workers: 1,
  retries: 0,
  timeout: 30_000,
  use: { ...devices["Desktop Chrome"] },
});
