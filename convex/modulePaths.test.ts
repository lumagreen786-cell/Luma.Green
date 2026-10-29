// @vitest-environment node
import { readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { expect, it } from "vitest";

it("keeps deployed Convex module paths valid", () => {
  const root = fileURLToPath(new URL("./", import.meta.url));
  const invalid = readdirSync(root, { recursive: true })
    .filter((entry): entry is string => typeof entry === "string")
    .filter((entry) => /\.(?:ts|js)$/.test(entry))
    .filter((entry) => !entry.endsWith(".test.ts"))
    .filter((entry) => !entry.endsWith(".d.ts"))
    .filter((entry) =>
      entry.split(/[\\/]/).some((part) => !/^[\w.]+$/.test(part)),
    );
  expect(invalid).toEqual([]);
});
