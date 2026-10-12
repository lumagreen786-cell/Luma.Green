import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import prettier from "eslint-config-prettier/flat";
import jestDom from "eslint-plugin-jest-dom";
import playwright from "eslint-plugin-playwright";
import simpleImportSort from "eslint-plugin-simple-import-sort";
import sonarjs from "eslint-plugin-sonarjs";
import testingLibrary from "eslint-plugin-testing-library";
import unicorn from "eslint-plugin-unicorn";
import tseslint from "typescript-eslint";

/**
 * Lint config for Luma.Green.
 *
 * Layers, in order — later layers win:
 *   1. ignores
 *   2. Next.js (core-web-vitals + typescript)
 *   3. typescript-eslint, type-aware: strict + stylistic
 *   4. sonarjs and unicorn for bug patterns and modern idioms
 *   5. house rules — the ones specific to this product
 *   6. per-area overrides (tests, e2e, config files, vendored UI, convex)
 *   7. prettier last, to switch off everything formatting-related
 *
 * Type-aware rules need a real TS program, which makes linting slower but
 * catches the class of bug that matters here: a floating promise in a
 * settlement mutation, an unchecked nullable in a carbon calculation.
 */
const eslintConfig = defineConfig([
  globalIgnores([
    // Vendored upstream design tooling; not application source.
    ".claude/skills/impeccable/**",
    ".next/**",
    "out/**",
    "build/**",
    "coverage/**",
    "playwright-report/**",
    "test-results/**",
    "next-env.d.ts",
    "apps/*/dist/**",
    "apps/*/release/**",
    "apps/desktop/generated/**",
    "apps/mobile/.expo/**",
    "apps/mobile/ios/**",
    "apps/mobile/android/**",
    // Written by `convex dev`. Committed so CI is hermetic, but never linted.
    "convex/_generated/**",
    "convex/*/_generated/**",
  ]),

  // Expo's config uses CommonJS. Next's base omits .cjs, so include it before
  // applying the shared React/import/accessibility rules below.
  ...nextVitals.map((config) =>
    config.name === "next"
      ? { ...config, files: ["**/*.{js,jsx,mjs,cjs,ts,tsx,mts,cts}"] }
      : config,
  ),
  ...nextTs,

  // --- TypeScript, type-aware -------------------------------------------
  ...tseslint.configs.strictTypeChecked,
  ...tseslint.configs.stylisticTypeChecked,
  {
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },

  // --- Bug patterns and modern idioms -----------------------------------
  sonarjs.configs.recommended,
  unicorn.configs.recommended,

  // --- House rules -------------------------------------------------------
  {
    plugins: { "simple-import-sort": simpleImportSort },
    rules: {
      // Import order is mechanical; let the fixer own it.
      "simple-import-sort/imports": "error",
      "simple-import-sort/exports": "error",

      // Unused code is either a mistake or dead weight. `_` opts out.
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
        },
      ],
      // Type-only imports keep the runtime bundle honest.
      "@typescript-eslint/consistent-type-imports": [
        "error",
        { prefer: "type-imports", fixStyle: "inline-type-imports" },
      ],
      "@typescript-eslint/no-import-type-side-effects": "error",
      // A dropped promise in a settlement or credit mutation loses money
      // silently. This is the single most valuable rule in the file.
      "@typescript-eslint/no-floating-promises": "error",
      "@typescript-eslint/no-misused-promises": "error",
      "@typescript-eslint/return-await": ["error", "in-try-catch"],
      // Exhaustiveness over trade/listing/credit status unions: adding a
      // status should break every switch that forgot about it.
      "@typescript-eslint/switch-exhaustiveness-check": "error",
      // `any` and `!` are how a type system stops helping.
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/no-non-null-assertion": "error",
      "@typescript-eslint/prefer-nullish-coalescing": "error",
      "@typescript-eslint/prefer-optional-chain": "error",

      // General correctness
      eqeqeq: ["error", "always", { null: "ignore" }],
      "no-console": ["warn", { allow: ["warn", "error"] }],
      "no-debugger": "error",
      "no-alert": "error",
      "no-var": "error",
      "prefer-const": "error",
      "object-shorthand": ["error", "always"],
      "no-implicit-coercion": "error",
      "no-param-reassign": ["error", { props: true }],
      "no-nested-ternary": "error",

      // Locale-aware navigation only. `next/link` and the raw
      // `next/navigation` helpers drop the active locale — a failure that is
      // invisible in English and breaks all eleven other locales.
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "next/link",
              message: "Import { Link } from '@/i18n/navigation' instead.",
            },
            {
              name: "next/navigation",
              importNames: ["redirect", "usePathname", "useRouter"],
              message:
                "Import locale-aware helpers from '@/i18n/navigation' instead.",
            },
          ],
        },
      ],

      // Money and dates must not be formatted by hand or with a hardcoded
      // locale — use next-intl's formatter so output follows the user.
      "no-restricted-syntax": [
        "error",
        {
          selector:
            "CallExpression[callee.property.name='toLocaleString'], CallExpression[callee.property.name='toLocaleDateString'], CallExpression[callee.property.name='toLocaleTimeString']",
          message:
            "Use next-intl's useFormatter/getFormatter so output follows the active locale.",
        },
        {
          selector: "TSEnumDeclaration",
          message:
            "Use a union of string literals or a const object — enums don't erase cleanly.",
        },
      ],

      // Accessibility beyond what Next enables by default.
      "jsx-a11y/alt-text": "error",
      "jsx-a11y/anchor-is-valid": "error",
      "jsx-a11y/aria-props": "error",
      "jsx-a11y/aria-role": "error",
      "jsx-a11y/no-autofocus": ["warn", { ignoreNonDOM: true }],
      "jsx-a11y/no-redundant-roles": "error",
      "jsx-a11y/role-has-required-aria-props": "error",

      // React
      "react/jsx-no-useless-fragment": ["error", { allowExpressions: true }],
      "react/self-closing-comp": "error",
      "react/jsx-boolean-value": ["error", "never"],

      // unicorn v74 ships `defaultOptions: [null]` for this rule, which ESLint 9
      // rejects as schema-invalid. Passing explicit options replaces it.
      "unicorn/logical-assignment-operators": [
        "error",
        "always",
        { enforceForIfStatements: true },
      ],

      // unicorn is opinionated; these are the opinions that don't fit here.
      "unicorn/prevent-abbreviations": "off", // `props`, `params`, `env`, `ref`
      "unicorn/name-replacements": "off", // wants `utilities.ts`, `serverEnvironment`
      "unicorn/single-line-block-comment-style": "off", // Prettier owns comments
      "unicorn/filename-case": [
        "error",
        { cases: { kebabCase: true }, ignore: [/^README\.md$/] },
      ],
      "unicorn/no-null": "off", // Convex and React both use null meaningfully
      "unicorn/prefer-top-level-await": "off", // not available in this runtime
      "unicorn/no-array-reduce": "off", // reduce is fine when it reads well
      "unicorn/prefer-global-this": "off", // `window`/`document` read clearer
      "unicorn/no-nested-ternary": "off", // covered by core no-nested-ternary
      "unicorn/expiring-todo-comments": "off",

      // sonarjs duplicate-string is noisy in JSX class strings.
      "sonarjs/no-duplicate-string": "off",
      "sonarjs/todo-tag": "warn",
      // Would have every component's props wrapped in Readonly<>. React props
      // are already immutable by contract; the wrapper is noise, not safety.
      "sonarjs/prefer-read-only-props": "off",
    },
  },

  // --- Server-side code: no client-only escapes --------------------------
  {
    files: ["convex/**/*.ts"],
    rules: {
      // Convex's declared ES2023 runtime does not include iterator helpers.
      "unicorn/prefer-iterator-helpers": "off",
      "unicorn/prefer-iterator-to-array": "off",
      // Convex module paths can't contain hyphens, and its own convention is
      // camelCase (e.g. the local `convex/betterAuth/` component).
      "unicorn/filename-case": [
        "error",
        { cases: { camelCase: true, kebabCase: true } },
      ],
      // The Convex validator DSL is deeply nested by design:
      // `defineTable({ x: v.optional(v.union(v.literal("a"), ...)) })`.
      "unicorn/max-nested-calls": "off",
      // Convex functions run on the server; a stray console.log there ends up
      // in production logs with whatever data was in scope.
      "no-console": ["error", { allow: ["warn", "error"] }],
      "no-restricted-globals": [
        "error",
        { name: "window", message: "Convex functions run on the server." },
        { name: "document", message: "Convex functions run on the server." },
      ],
    },
  },

  {
    // Convex builds the app config and the HTTP router by calling methods on
    // them at module load. That is the framework's API, not a stray effect.
    files: ["convex/convex.config.ts", "convex/http.ts"],
    rules: { "unicorn/no-top-level-side-effects": "off" },
  },

  // --- The i18n layer is what wraps the unsafe APIs ----------------------
  {
    files: ["src/i18n/**", "src/proxy.ts", "src/app/**/layout.tsx"],
    rules: { "no-restricted-imports": "off" },
  },

  // --- The admin console: English only, outside the locale segment -------
  {
    // `/admin` has no locale to lose (docs/architecture/urls.md), so it uses
    // Next's own `Link` and router. Its copy is English and lives in the
    // components — the console is never translated.
    files: ["src/app/admin/**", "src/components/admin/**"],
    rules: { "no-restricted-imports": "off" },
  },

  // --- Vendored shadcn primitives ----------------------------------------
  {
    // These are generated by the shadcn CLI and re-generated on update.
    // Lint them for correctness, not for our house style.
    files: ["src/components/ui/**"],
    rules: {
      "unicorn/filename-case": "off",
      "sonarjs/no-nested-conditional": "off",
      "react/jsx-no-useless-fragment": "off",
      "@typescript-eslint/no-unnecessary-condition": "off",
      "@typescript-eslint/no-unsafe-assignment": "off",
      "@typescript-eslint/no-unsafe-argument": "off",
      "@typescript-eslint/restrict-template-expressions": "off",
      "@typescript-eslint/prefer-nullish-coalescing": "off",
    },
  },

  // --- Unit tests ---------------------------------------------------------
  {
    files: ["src/**/*.{test,spec}.{ts,tsx}", "vitest.setup.ts"],
    ...testingLibrary.configs["flat/react"],
    ...jestDom.configs["flat/recommended"],
  },
  {
    files: [
      "src/**/*.{test,spec}.{ts,tsx}",
      "convex/**/*.test.ts",
      "vitest.setup.ts",
    ],
    rules: {
      // Tests deliberately poke at edge cases and untyped fixtures.
      "@typescript-eslint/no-non-null-assertion": "off",
      "@typescript-eslint/no-unsafe-assignment": "off",
      "@typescript-eslint/no-unsafe-member-access": "off",
      "sonarjs/no-duplicate-string": "off",
      "unicorn/no-null": "off",
    },
  },

  // --- Playwright ---------------------------------------------------------
  {
    files: ["e2e/**/*.ts", "e2e-analytics/**/*.ts"],
    ...playwright.configs["flat/recommended"],
    rules: {
      ...playwright.configs["flat/recommended"].rules,
      // A fixed sleep is the root of every flaky suite. Use web-first
      // assertions, which retry until the timeout.
      "playwright/no-wait-for-timeout": "error",
      "playwright/no-force-option": "error",
      "playwright/prefer-web-first-assertions": "error",
      "playwright/expect-expect": "error",
    },
  },

  // --- Config files at the repo root -------------------------------------
  {
    // Standalone Playwright evidence runners use assertions directly;
    // they write capture manifests rather than registering test cases.
    files: [
      "scripts/capture-lots-guide.mjs",
      "scripts/guide-preview/capture-finance.mjs",
    ],
    rules: { "sonarjs/assertions-in-test-cases": "off" },
  },
  {
    files: ["*.{mjs,ts,mts}", ".husky/**"],
    rules: {
      // Next types `headers()`/`redirects()` as async even when the body has
      // nothing to await.
      "@typescript-eslint/require-await": "off",
      "no-console": "off",
      "import/no-anonymous-default-export": "off",
      "unicorn/filename-case": "off",
    },
  },
  {
    // Plain JS config files have no type information to lint against.
    files: ["**/*.{js,mjs,cjs}"],
    extends: [tseslint.configs.disableTypeChecked],
  },
  {
    // Expo loads its config before Metro; Node also runs the CJS config tests.
    files: ["apps/mobile/app.config.js", "apps/mobile/**/*.cjs"],
    rules: { "@typescript-eslint/no-require-imports": "off" },
  },
  {
    files: ["apps/mobile/app.config.js"],
    rules: { "unicorn/prefer-module": "off" },
  },

  // Must stay last: turns off every stylistic rule Prettier owns.
  prettier,
]);

export default eslintConfig;
