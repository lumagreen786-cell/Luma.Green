import assert from "node:assert/strict";
import { test } from "node:test";

import { parseNativeMessage } from "../src/message-bridge.ts";
import { classifyNavigation } from "../src/navigation.ts";
import { runtimeOrigin } from "../src/runtime-config.ts";

void test("business configuration keeps navigation and bridge limited to one exact origin", () => {
  const origin = runtimeOrigin(
    { appOrigin: "https://business.luma.green" },
    false,
  );
  const url = `${origin}/app/collections`;
  const nonce = "test-document-nonce";
  const envelope = (documentUrl: string) =>
    JSON.stringify({
      type: "luma.native.message",
      nonce,
      url: documentUrl,
      data: "location",
    });
  assert.equal(classifyNavigation(url, origin), "internal");
  assert.equal(
    classifyNavigation("https://luma.green/app", origin),
    "external",
  );
  assert.equal(
    classifyNavigation("https://business.luma.green.evil.test/app", origin),
    "external",
  );
  assert.equal(
    parseNativeMessage(envelope(url), url, url, origin, nonce, false),
    "location",
  );
  const apex = "https://luma.green/app";
  assert.equal(
    parseNativeMessage(envelope(apex), apex, apex, origin, nonce, false),
    null,
  );
});
