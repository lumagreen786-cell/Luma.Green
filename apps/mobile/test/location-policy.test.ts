import assert from "node:assert/strict";
import { test } from "node:test";
import { runInNewContext } from "node:vm";

import {
  locationBridgeScript,
  locationResultScript,
  parseLocationRequest,
} from "../src/location-policy.ts";

const origin = "https://luma.green";
const page = `${origin}/sell`;
const nonce = "test-native-session";
const request = {
  type: "luma.location.current",
  requestId: "a-1",
  nonce,
  options: { timeout: 5000, enableHighAccuracy: false },
};

void test("location requests require the exact trusted top document and bounded options", () => {
  const raw = JSON.stringify(request);
  assert.deepEqual(
    parseLocationRequest(raw, page, page, origin, nonce),
    request,
  );
  for (const [frame, top] of [
    [`${origin}/other`, page],
    ["https://other.example/sell", "https://other.example/sell"],
    [`${origin}/admin`, `${origin}/admin`],
  ]) {
    assert.equal(parseLocationRequest(raw, frame, top, origin, nonce), null);
  }
  for (const value of [
    { ...request, coords: { latitude: 1 } },
    { ...request, type: "unknown" },
    { ...request, nonce: "iframe-guessed" },
    { ...request, nonce: undefined },
    { ...request, options: { ...request.options, timeout: 30_001 } },
    { ...request, options: { ...request.options, timeout: -1 } },
    { ...request, options: { ...request.options, extra: true } },
  ]) {
    assert.equal(
      parseLocationRequest(JSON.stringify(value), page, page, origin, nonce),
      null,
    );
  }
});

const stubWatchPosition = () => 7;

function harness(url = page, isSubframe = false) {
  const sent: string[] = [];
  const callbacks = new Map<string, (event: { detail: unknown }) => void>();
  const timers = new Map<number, () => void>();
  const watchPosition = stubWatchPosition;
  const geolocation = { getCurrentPosition: () => null, watchPosition };
  const window: Record<string, unknown> = {
    location: new URL(url),
    ReactNativeWebView: {
      postMessage: (raw: string) => {
        sent.push(raw);
      },
    },
  };
  window.top = isSubframe ? {} : window;
  const context = {
    window,
    navigator: { geolocation },
    Map,
    Date,
    Number,
    JSON,
    TypeError,
    setTimeout: (callback: () => void) => {
      timers.set(timers.size + 1, callback);
      return timers.size;
    },
    clearTimeout: (id: number) => timers.delete(id),
    document: {
      addEventListener: (
        type: string,
        callback: (event: { detail: unknown }) => void,
      ) => callbacks.set(type, callback),
    },
  };
  // eslint-disable-next-line sonarjs/code-eval -- Execute only our generated bridge in an isolated test context.
  runInNewContext(locationBridgeScript(origin, nonce), context);
  return { context, sent, callbacks, timers, geolocation, watchPosition };
}

void test("the bridge is idempotent, leaves watchPosition intact, and relays callbacks", () => {
  const h = harness();
  const current = h.geolocation.getCurrentPosition;
  // eslint-disable-next-line sonarjs/code-eval -- Execute only our generated bridge in an isolated test context.
  runInNewContext(locationBridgeScript(origin, nonce), h.context);
  assert.equal(h.geolocation.getCurrentPosition, current);
  assert.equal(h.geolocation.watchPosition, h.watchPosition);
  let received: unknown;
  // The injected function has the browser callback signature, unlike the initial stub.
  const invoke = h.geolocation.getCurrentPosition as (
    success: (value: unknown) => void,
    error?: (value: unknown) => void,
    options?: unknown,
  ) => void;
  invoke((value) => {
    received = value;
  });
  const parsed: unknown = JSON.parse(h.sent[0]);
  assert.ok(parsed && typeof parsed === "object" && "requestId" in parsed);
  const position = {
    timestamp: 1,
    coords: { latitude: 1, longitude: 2, accuracy: 40 },
  };
  h.callbacks.get("luma-location-result")?.({
    detail: { requestId: parsed.requestId, position },
  });
  assert.deepEqual(received, position);
  assert.equal(h.timers.size, 0);
});

void test("timeouts and denied permission reach the error callback with web error codes", () => {
  const h = harness();
  const codes: number[] = [];
  const invoke = h.geolocation.getCurrentPosition as (
    success: () => void,
    error: (value: { code: number }) => void,
    options?: unknown,
  ) => void;
  invoke(
    () => null,
    (error) => {
      codes.push(error.code);
    },
    { timeout: 0 },
  );
  h.timers.values().next().value?.();
  assert.deepEqual(codes, [3]);
  invoke(
    () => null,
    (error) => {
      codes.push(error.code);
    },
  );
  const parsed: unknown = JSON.parse(h.sent[1]);
  assert.ok(parsed && typeof parsed === "object" && "requestId" in parsed);
  h.callbacks.get("luma-location-result")?.({
    detail: { requestId: parsed.requestId, error: { code: 1 } },
  });
  assert.deepEqual(codes, [3, 1]);
});

void test("untrusted origins, admin pages and isSubframes cannot install the bridge", () => {
  for (const [url, isSubframe] of [
    ["https://other.example/sell", false],
    [`${origin}/admin/login`, false],
    [page, true],
  ] as const) {
    const h = harness(url, isSubframe);
    assert.equal(h.callbacks.size, 0);
  }
  assert.match(
    locationResultScript(page, {
      requestId: "one",
      error: { code: 2, message: "" },
    }),
    /window\.top===window&&window\.location\.href/,
  );
});
