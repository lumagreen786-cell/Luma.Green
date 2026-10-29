import assert from "node:assert/strict";
import test from "node:test";

import {
  isAppBlob,
  isAppUrl,
  isCancelledLoad,
  isExternalUrl,
  isPdfViewerFrame,
  mayDownload,
  mayRequestLocation,
  mayRequestNotifications,
  secureWebPreferences,
} from "./policy.mjs";
const origin = "https://app.luma.green";

test("Turnstile can load only in its exact challenge subframe", () => {
  for (const url of ["about:blank", "about:srcdoc"]) {
    assert.equal(isBotChallengeFrame(url, false), true);
    assert.equal(isBotChallengeFrame(url, true), false);
  }
  const url =
    "https://challenges.cloudflare.com/cdn-cgi/challenge-platform/test";
  assert.equal(isBotChallengeFrame(url, false), true);
  assert.equal(isBotChallengeFrame(url, true), false);
  assert.equal(
    isBotChallengeFrame(
      "https://challenges.cloudflare.com.evil.test/cdn-cgi/challenge-platform/test",
      false,
    ),
    false,
  );
  assert.equal(
    isBotChallengeFrame(
      "https://user@challenges.cloudflare.com/cdn-cgi/challenge-platform/test",
      false,
    ),
    false,
  );
  assert.equal(
    isBotChallengeFrame("https://challenges.cloudflare.com/other", false),
    false,
  );
});

test("only exact configured HTTP(S) origin stays inside the main window", () => {
  for (const url of [`${origin}/ar/join`, `${origin}/admin`])
    assert.equal(isAppUrl(url, origin), true);
  for (const url of [
    "https://app.luma.green.evil.test",
    "https://evil.test/?https://app.luma.green",
    // eslint-disable-next-line sonarjs/no-clear-text-protocols, unicorn/prefer-https -- Negative fixture proves insecure origins are rejected.
    "http://app.luma.green",
    "https://user@app.luma.green",
    "https://app.luma.green:444/",
    `blob:${origin}/abc`,
    "javascript:alert(1)",
    "file:///tmp/a",
    "malformed",
  ])
    assert.equal(isAppUrl(url, origin), false, url);
});
test("only blobs created by the configured origin can open in a sandboxed document viewer", () => {
  assert.equal(isAppBlob(`blob:${origin}/id`, origin), true);
  for (const url of [
    "blob:https://evil.test/id",
    "blob:null/id",
    origin,
    `data:${origin}`,
  ])
    assert.equal(isAppBlob(url, origin), false);
});
test("OS navigation rejects executable and custom schemes, credentials and controls", () => {
  for (const url of [
    "https://example.com/a",
    "mailto:hello@example.com",
    "tel:+919876543210",
  ])
    assert.equal(isExternalUrl(url), true);
  for (const url of [
    // eslint-disable-next-line unicorn/prefer-https -- Negative fixture proves insecure URLs are rejected.
    "http://example.com",
    "file:///tmp",
    "javascript:alert(1)",
    "data:text/html,test",
    "ms-settings:foo",
    "blob:https://app.luma.green/id",
    "https://user:pass@example.com",
    "https://example.com\n",
    "tel:hello",
    "mailto:bad",
    "mailto:a@example.com?bcc=b@example.com",
    "mailto:a@example.com#subject",
    "mailto:a%0d%0a@example.com",
    "mailto://a@example.com",
    "tel:....",
    "tel:+91%0a123",
    "tel:*123%23",
    "tel://12345",
    "https://example.com/%0d%0a",
    "https://example.com/%zz",
  ])
    assert.equal(isExternalUrl(url), false, url);
});
test("location requires a trusted main frame in the main app window", () => {
  assert.equal(
    mayRequestLocation(
      "geolocation",
      `${origin}/join`,
      origin,
      origin,
      true,
      true,
    ),
    true,
  );
  for (const permission of [
    "media",
    "notifications",
    "clipboard-read",
    "display-capture",
    "unknown",
  ])
    assert.equal(
      mayRequestLocation(permission, origin, origin, origin, true, true),
      false,
    );
  assert.equal(
    mayRequestLocation(
      "geolocation",
      "https://evil.test",
      origin,
      origin,
      true,
      true,
    ),
    false,
  );
  assert.equal(
    mayRequestLocation(
      "geolocation",
      origin,
      "https://evil.test",
      origin,
      true,
      true,
    ),
    false,
  );
  assert.equal(
    mayRequestLocation(
      "geolocation",
      `blob:${origin}/id`,
      origin,
      origin,
      true,
      true,
    ),
    false,
  );
  for (const [isMainFrame, isMainWindow] of [
    [false, true],
    [true, false],
    [false, false],
  ]) {
    assert.equal(
      mayRequestLocation(
        "geolocation",
        origin,
        origin,
        origin,
        isMainFrame,
        isMainWindow,
      ),
      false,
    );
  }
  assert.equal(
    mayRequestLocation("geolocation", origin, origin, origin),
    false,
  );
});
test("private documents can download from trusted app or blob viewer only", () => {
  assert.equal(
    mayDownload(`blob:${origin}/id`, `${origin}/admin`, origin),
    true,
  );
  assert.equal(
    mayDownload(`blob:${origin}/id`, `blob:${origin}/id`, origin),
    true,
  );
  assert.equal(
    mayDownload("https://evil.test/file", `${origin}/admin`, origin),
    false,
  );
  assert.equal(
    mayDownload(`blob:${origin}/id`, "https://evil.test", origin),
    false,
  );
});
test("remote content has no Node or webview access and remains sandboxed", () => {
  assert.equal(secureWebPreferences.nodeIntegration, false);
  assert.equal(secureWebPreferences.contextIsolation, true);
  assert.equal(secureWebPreferences.sandbox, true);
  assert.equal(secureWebPreferences.webSecurity, true);
  assert.equal(secureWebPreferences.webviewTag, false);
});

test("only built-in PDF extension frames inside trusted blob viewers are allowed", () => {
  const viewer = "chrome-extension://mhjfbmdgcfjbbpaeojofohoefgiehjai/document";
  assert.equal(isPdfViewerFrame(viewer, `blob:${origin}/id`, origin), true);
  assert.equal(isPdfViewerFrame(viewer, origin, origin), false);
  assert.equal(
    isPdfViewerFrame(viewer, "blob:https://evil.test/id", origin),
    false,
  );
  assert.equal(
    isPdfViewerFrame(
      "chrome-extension://other/id",
      `blob:${origin}/id`,
      origin,
    ),
    false,
  );
});

test("desktop notifications require the trusted main window and requesting main frame", () => {
  assert.equal(
    mayRequestNotifications(
      `${origin}/account/notifications`,
      origin,
      origin,
      true,
      true,
    ),
    true,
  );
  assert.equal(
    mayRequestNotifications(origin, origin, origin, false, true),
    false,
  );
  assert.equal(
    mayRequestNotifications(origin, origin, origin, true, false),
    false,
  );
  for (const untrusted of [
    "https://evil.test",
    `${origin}.evil.test`,
    `blob:${origin}/id`,
    "file:///tmp/page",
    "data:text/html,hello",
  ]) {
    assert.equal(
      mayRequestNotifications(untrusted, origin, origin, true, true),
      false,
    );
    assert.equal(
      mayRequestNotifications(origin, untrusted, origin, true, true),
      false,
    );
  }
});

test("cancelled loads do not replace a newer navigation with the offline screen", () => {
  const cancelled = Object.assign(new Error("cancelled"), {
    code: "ERR_ABORTED",
    errno: -3,
  });
  assert.equal(isCancelledLoad(cancelled), true);
  assert.equal(isCancelledLoad({ code: "ERR_ABORTED" }), true);
  assert.equal(isCancelledLoad({ errno: -3 }), true);
  for (const error of [
    Object.assign(new Error("offline"), {
      code: "ERR_INTERNET_DISCONNECTED",
      errno: -106,
    }),
    new Error("unknown failure"),
    { code: "ERR_FAILED", errno: -2 },
    null,
    undefined,
  ])
    assert.equal(isCancelledLoad(error), false);
});
import { isBotChallengeFrame } from "./policy.mjs";
