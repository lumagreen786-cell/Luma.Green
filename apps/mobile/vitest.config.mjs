import { createRequire } from "node:module";
import path from "node:path";

import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

const rootRequire = createRequire(
  new URL("../../package.json", import.meta.url),
);

export default defineConfig({
  plugins: [react()],
  define: { __DEV__: false },
  resolve: {
    // Use the renderer's React instance when native controls are tested in jsdom.
    alias: {
      react: path.dirname(rootRequire.resolve("react/package.json")),
    },
  },
  test: {
    environment: "jsdom",
    include: ["apps/mobile/test/*.test.tsx"],
  },
});
