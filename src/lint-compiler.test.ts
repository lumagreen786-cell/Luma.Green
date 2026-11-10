// @vitest-environment node
import { createRequire } from "node:module";

import { expect, it } from "vitest";

it("keeps Sonar and the lint parser on the project TypeScript compiler", () => {
  const require = createRequire(import.meta.url);
  const sonarRequire = createRequire(require.resolve("eslint-plugin-sonarjs"));
  const parserRequire = createRequire(require.resolve("typescript-eslint"));
  const compiler = require.resolve("typescript");

  expect(sonarRequire.resolve("typescript")).toBe(compiler);
  expect(parserRequire.resolve("typescript")).toBe(compiler);
});
