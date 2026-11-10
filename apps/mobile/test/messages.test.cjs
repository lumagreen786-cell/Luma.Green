const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { test } = require("node:test");

const {
  createShellCatalogue,
  outputPath,
} = require("../scripts/generate-messages.cjs");

test("committed shell translations match all shared catalogue locales and cannot silently go stale", () => {
  const committed = JSON.parse(readFileSync(outputPath, "utf8"));
  assert.deepEqual(
    committed,
    createShellCatalogue(),
    "Run pnpm --filter @luma/mobile messages:generate after changing shared shell text.",
  );
});

test("the native bundle contains only its shell namespaces, not the full web copy", () => {
  const catalogue = createShellCatalogue();
  for (const messages of Object.values(catalogue)) {
    assert.deepEqual(
      Object.keys(messages).toSorted((first, second) =>
        first.localeCompare(second),
      ),
      ["brand", "common", "homeReminder", "native", "notifications"],
    );
  }
});
