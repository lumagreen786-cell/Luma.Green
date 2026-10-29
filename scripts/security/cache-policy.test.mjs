import assert from "node:assert/strict";
import { createRequire } from "node:module";
import test from "node:test";

const desktopRequire = createRequire(
  new URL("../../apps/desktop/package.json", import.meta.url),
);
const builderRequire = createRequire(
  desktopRequire.resolve("electron-builder/package.json"),
);
const appBuilderRequire = createRequire(
  builderRequire.resolve("app-builder-lib/package.json"),
);
const getRequire = createRequire(
  appBuilderRequire.resolve("@electron/get/package.json"),
);
const gotRequire = createRequire(getRequire.resolve("got/package.json"));
const cacheRequire = createRequire(
  gotRequire.resolve("cacheable-request/package.json"),
);
const CachePolicy = cacheRequire("http-cache-semantics");
const request = {
  url: "https://downloads.example.test/app",
  method: "GET",
  headers: { host: "downloads.example.test" },
};

test("desktop download cache cannot use max-stale to serve a security-zeroed response", () => {
  for (const headers of [
    { "set-cookie": "session=synthetic" },
    { "cache-control": "no-store" },
    { "cache-control": "no-cache" },
    { "cache-control": "private" },
    { "cache-control": "proxy-revalidate" },
    { "cache-control": "s-maxage=0" },
    { vary: "*" },
  ]) {
    const policy = new CachePolicy(request, { status: 200, headers });
    assert.equal(
      policy.satisfiesWithoutRevalidation({
        ...request,
        headers: { ...request.headers, "cache-control": "max-stale=86400" },
      }),
      false,
    );
  }
  const publicPolicy = new CachePolicy(request, {
    status: 200,
    headers: { "cache-control": "public, max-age=3600" },
  });
  assert.equal(publicPolicy.satisfiesWithoutRevalidation(request), true);
});
