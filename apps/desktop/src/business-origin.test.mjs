import assert from "node:assert/strict";
import test from "node:test";

import { buildConfig } from "./config.mjs";
import { isAppUrl, mayRequestLocation } from "./policy.mjs";

test("explicit business configuration preserves exact-origin permissions", () => {
  const { appOrigin } = buildConfig({
    DESKTOP_APP_ORIGIN: "https://business.luma.green",
  });
  const url = `${appOrigin}/app/collections`;
  assert.equal(isAppUrl(url, appOrigin), true);
  assert.equal(isAppUrl("https://luma.green/app", appOrigin), false);
  assert.equal(
    isAppUrl("https://business.luma.green.evil.test/app", appOrigin),
    false,
  );
  assert.equal(
    mayRequestLocation("geolocation", url, url, appOrigin, true, true),
    true,
  );
  assert.equal(
    mayRequestLocation(
      "geolocation",
      "https://luma.green/app",
      url,
      appOrigin,
      true,
      true,
    ),
    false,
  );
});
