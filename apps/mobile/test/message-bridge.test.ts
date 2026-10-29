import assert from "node:assert/strict";
import { test } from "node:test";
import { runInNewContext } from "node:vm";

import {
  messageBridgeScript,
  parseNativeMessage,
} from "../src/message-bridge.ts";

const origin = "https://luma.green";
const url = origin + "/sell";
const nonce = "synthetic-native-session";
const envelope = {
  type: "luma.native.message",
  nonce,
  url,
  data: '{"type":"luma.push.enable","requestId":"x"}',
};
void test("both Android source shapes require the exact nonce and current document envelope", () => {
  for (const source of [origin, origin + "/", url])
    assert.equal(
      parseNativeMessage(
        JSON.stringify(envelope),
        source,
        url,
        origin,
        nonce,
        true,
      ),
      envelope.data,
    );
  assert.equal(
    parseNativeMessage(
      JSON.stringify(envelope),
      origin,
      url,
      origin,
      nonce,
      false,
    ),
    null,
  );
  assert.equal(
    parseNativeMessage(
      JSON.stringify(envelope),
      url,
      url,
      origin,
      nonce,
      false,
    ),
    envelope.data,
  );
  for (const value of [
    envelope.data,
    "{",
    JSON.stringify({ ...envelope, nonce: "guessed" }),
    JSON.stringify({ ...envelope, url: origin + "/other" }),
    JSON.stringify({ ...envelope, extra: true }),
    JSON.stringify({ ...envelope, data: "x".repeat(513) }),
    "x".repeat(2049),
  ])
    assert.equal(
      parseNativeMessage(value, origin, url, origin, nonce, true),
      null,
    );
  for (const source of [
    "https://foreign.example",
    origin + "/other",
    origin + ".evil",
  ])
    assert.equal(
      parseNativeMessage(
        JSON.stringify(envelope),
        source,
        url,
        origin,
        nonce,
        true,
      ),
      null,
    );
  assert.equal(
    parseNativeMessage(
      JSON.stringify({ ...envelope, url: origin + "/admin" }),
      origin,
      origin + "/admin",
      origin,
      nonce,
      true,
    ),
    null,
  );
});
void test("the injected top-page wrapper envelopes messages once and does not install in a frame", () => {
  const sent: string[] = [];
  const bridge = {
    postMessage: (raw: string) => {
      sent.push(raw);
    },
  };
  const window = {
    top: null as unknown,
    location: { origin, href: url },
    ReactNativeWebView: bridge,
  };
  window.top = window;
  const script = messageBridgeScript(origin, nonce);
  // eslint-disable-next-line sonarjs/code-eval -- Evaluate only the locally generated bridge in a VM without host APIs.
  runInNewContext(script, { window });
  // eslint-disable-next-line sonarjs/code-eval -- Evaluate only the locally generated bridge in a VM without host APIs.
  runInNewContext(script, { window });
  bridge.postMessage(envelope.data);
  assert.deepEqual(JSON.parse(sent[0]), envelope);
  const bare = (raw: string) => {
    sent.push(raw);
  };
  const frame = {
    ...window,
    top: {},
    ReactNativeWebView: { postMessage: bare },
  };
  // eslint-disable-next-line sonarjs/code-eval -- Evaluate only the locally generated bridge in a VM without host APIs.
  runInNewContext(script, { window: frame });
  assert.equal(frame.ReactNativeWebView.postMessage, bare);
  frame.ReactNativeWebView.postMessage(envelope.data);
  assert.equal(
    parseNativeMessage(sent[1], url, url, origin, nonce, true),
    null,
  );
});
