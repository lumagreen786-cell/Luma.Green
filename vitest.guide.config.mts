import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

import { guideTests } from "./vitest.config.mjs";

/** Existing artifact checks remain available for owner-requested guide updates. */
export default defineConfig({
  plugins: [react()],
  resolve: { tsconfigPaths: true },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./vitest.setup.ts"],
    include: guideTests,
  },
});
