import assert from "node:assert/strict";
import test from "node:test";
import { runInNewContext } from "node:vm";

import {
  isUpdateHome,
  parseMobileUpdate,
  parseUpdateNavigation,
  updateBridgeScript,
} from "../../shared/update-bridge.mjs";

/** @param {string} path @param {'mobile' | 'desktop'} transport */
function documentFixture(path = "/en", transport = "desktop") {
  /** @type {unknown[]} */
  const commands = [];
  /** @type {Array<() => void>} */
  const timers = [];
  const query = { blocked: false };
  const document = Object.assign(new EventTarget(), {
    readyState: "complete",
    hidden: false,
    documentElement: { lang: "en", inert: false },
    querySelector: () => (query.blocked ? {} : null),
  });
  /** @param {string} url */
  function navigate(url) {
    commands.push(url);
  }
  /** @param {string} raw */
  function send(raw) {
    commands.push(JSON.parse(raw));
  }
  const window = {
    open: navigate,
    location: {
      origin: "https://luma.green",
      pathname: path,
      search: "",
      hash: "",
      assign: navigate,
    },
    ReactNativeWebView: { postMessage: send },
  };
  Reflect.set(window, "top", window);
  const clock = { now: Date.now() };
  const context = {
    Date: { now: () => clock.now },
    window,
    document,
    Event,
    CustomEvent,
    /** @param {() => void} callback */ setTimeout: (callback) => {
      timers.push(callback);
      return 1;
    },
    clearTimeout: () => {
      /* Timers are invoked explicitly by the test. */
    },
  };
  // eslint-disable-next-line sonarjs/code-eval -- Execute our generated bridge against a private deterministic DOM fixture.
  runInNewContext(
    updateBridgeScript("https://luma.green", "token", "ready", transport),
    context,
  );
  return {
    window,
    document,
    query,
    commands,
    timers,
    clock,
    bridge: Reflect.get(window, "lumaAppUpdates"),
  };
}

test("bridge rejects work routes, hidden documents, forms and latched edits", () => {
  const work = documentFixture("/sell");
  work.bridge.request("restart");
  assert.equal(work.bridge.getState(), "blocked");
  assert.equal(work.commands.length, 0);
  const home = documentFixture();
  home.query.blocked = true;
  assert.equal(home.bridge.canRestart(), false);
  home.query.blocked = false;
  home.document.dispatchEvent(new Event("input"));
  home.window.location.pathname = "/";
  home.bridge.request("restart");
  assert.equal(home.commands.length, 0);
  assert.equal(home.document.documentElement.inert, false);
});

test("a deliberate safe restart freezes input and timeout recovers the page", () => {
  const home = documentFixture("/en", "mobile");
  assert.equal(home.commands.length, 0);
  home.bridge.request("restart");
  assert.deepEqual(home.commands, [
    { type: "luma.update", nonce: "token", action: "restart" },
  ]);
  assert.equal(home.document.documentElement.inert, true);
  assert.equal(home.bridge.canRestart(), false);
  home.timers[0]();
  assert.equal(home.document.documentElement.inert, false);
  assert.equal(home.bridge.getState(), "failed");
});

test("update notices never freeze, navigate or restart; task clicks latch unsafe", () => {
  const home = documentFixture();
  assert.equal(home.document.documentElement.inert, false);
  home.document.dispatchEvent(new Event("click"));
  home.bridge.request("restart");
  assert.equal(home.bridge.getState(), "blocked");
  assert.equal(home.commands.length, 0);
});

test("update protocol accepts only exact bounded commands from the trusted document", () => {
  const origin = "https://luma.green";
  const valid = JSON.stringify({
    type: "luma.update",
    nonce: "token",
    action: "check",
  });
  assert.equal(
    parseMobileUpdate(valid, origin, origin, origin, "token"),
    "check",
  );
  for (const [frame, top, token] of [
    ["https://evil.example", origin, "token"],
    [origin, origin, "stale"],
    [origin + "/admin", origin + "/admin", "token"],
  ])
    assert.equal(parseMobileUpdate(valid, frame, top, origin, token), null);
  assert.equal(
    parseMobileUpdate(valid + "x".repeat(257), origin, origin, origin, "token"),
    null,
  );
  assert.equal(
    parseUpdateNavigation("lumagreen-update://restart?token=token", "token"),
    "restart",
  );
  assert.equal(
    parseUpdateNavigation("lumagreen-update://restart?token=old", "token"),
    null,
  );
  assert.equal(
    parseUpdateNavigation(
      "lumagreen-update://restart?token=token&url=file:///",
      "token",
    ),
    null,
  );
  assert.equal(isUpdateHome(origin + "/app", origin), false);
  assert.equal(isUpdateHome(origin + "/en?next=/sell", origin), false);
  assert.equal(isUpdateHome(origin + "/ar", origin), true);
});

test("an expired restart lease cannot authorize a delayed native action", () => {
  const home = documentFixture();
  assert.equal(home.bridge.prepareRestart(), true);
  assert.equal(home.bridge.isRestartPending(), true);
  home.clock.now += 10_001;
  assert.equal(home.bridge.isRestartPending(), false);
  assert.ok(home.bridge.getRestartDeadline() < home.clock.now);
  home.timers[0]();
  assert.equal(home.document.documentElement.inert, false);
});
