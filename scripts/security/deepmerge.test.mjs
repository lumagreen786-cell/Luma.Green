import assert from "node:assert/strict";
import { createRequire } from "node:module";
import test from "node:test";

const mobileRequire = createRequire(
  new URL("../../apps/mobile/package.json", import.meta.url),
);
const expoRequire = createRequire(mobileRequire.resolve("expo/package.json"));
const configRequire = createRequire(
  expoRequire.resolve("@expo/config/package.json"),
);
const merge = configRequire("deepmerge");

test("Expo config merge cannot inherit data through source or target prototype keys", () => {
  const poisoned = JSON.parse('{"__proto__":{"isAdmin":true},"safe":"kept"}');
  for (const target of [{}, Object.create(null), { child: null }]) {
    const result = merge(target, poisoned);
    assert.equal(Object.getPrototypeOf(result), Object.prototype);
    assert.equal(result.isAdmin, undefined);
    assert.equal(result.safe, "kept");
  }
  const copied = merge(poisoned, {});
  assert.equal(copied.isAdmin, undefined);
  assert.equal(Object.getPrototypeOf(copied), Object.prototype);
  assert.deepEqual(
    merge({ nested: { a: 1 }, values: [1] }, { nested: { b: 2 }, values: [2] }),
    { nested: { a: 1, b: 2 }, values: [1, 2] },
  );
  assert.equal({}.isAdmin, undefined);
});
