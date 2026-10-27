import { readFileSync } from "node:fs";

import { defineConfig, devices } from "@playwright/test";
import { z } from "zod";

import { isLoopbackHttpOrigin } from "./convex/lib/localAcceptance";

// Automatic failure snapshots can contain authenticated private record contents.
process.env.PLAYWRIGHT_NO_COPY_PROMPT = "1";
const artifact = z
  .object({ site: z.string().refine(isLoopbackHttpOrigin) })
  .parse(
    JSON.parse(
      readFileSync(".convex/local-acceptance/phone-sessions.json", "utf8"),
    ),
  );
export default defineConfig({
  testDir: "./e2e/connected",
  testMatch: "foundation-phone.spec.ts",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 120_000,
  expect: { timeout: 20_000 },
  reporter: "list",
  use: {
    baseURL: artifact.site,
    trace: "off",
    screenshot: "off",
    video: "off",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
