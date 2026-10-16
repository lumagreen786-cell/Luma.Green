import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

// Artifact freshness is opt-in per AGENTS.md; runtime fixture tests remain here.
export const guideTests = [
  "src/user-guide.test.ts",
  "src/refinement-guide.test.ts",
  "src/finance-guide-artifact.test.ts",
  "src/workbook-guide.test.ts",
  "src/lots-guide.test.ts",
  "src/team-review.test.ts",
];

export default defineConfig({
  plugins: [react()],
  // Native resolution of the `@/*` alias from tsconfig.json.
  resolve: { tsconfigPaths: true },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./vitest.setup.ts"],
    // Convex tests sit next to the functions. Pure helpers run in jsdom like
    // everything else; files using convex-test opt into `edge-runtime` with a
    // `@vitest-environment` comment, as the Convex runtime isn't Node.
    include: ["src/**/*.{test,spec}.{ts,tsx}", "convex/**/*.test.ts"],
    // Playwright owns `e2e/` — Vitest must never try to run those.
    exclude: [
      "e2e/**",
      "e2e-analytics/**",
      "node_modules/**",
      ".next/**",
      ...guideTests,
    ],
    server: { deps: { inline: ["convex-test"] } },
    coverage: {
      provider: "v8",
      reporter: ["text-summary", "lcov"],
      reportsDirectory: "./coverage",
      include: ["src/**/*.{ts,tsx}", "convex/**/*.ts"],
      exclude: [
        "src/**/*.{test,spec}.{ts,tsx}",
        "convex/**/*.test.ts",
        "convex/_generated/**",
        "src/components/ui/**",
        "src/**/*.d.ts",
      ],
      // Thresholds start off. Raise them as real modules land — see
      // `.claude/skills/testing/SKILL.md` for the ratchet policy.
    },
  },
});
