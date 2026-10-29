import assert from "node:assert/strict";
import test from "node:test";

import { canRestartDocument, setupUpdates } from "./updates.mjs";
function mockUpdater() {
  /** @type {Map<string, (...args: unknown[]) => void>} */
  const handlers = new Map();
  const calls = { feeds: 0, checks: 0, installs: 0 };
  const updater = {
    autoDownload: false,
    autoInstallOnAppQuit: false,
    allowPrerelease: true,
    setFeedURL: () => {
      calls.feeds++;
    },
    checkForUpdates: async () => {
      calls.checks++;
    },
    quitAndInstall: () => {
      calls.installs++;
    },
    /** @param {string} event @param {(...args: unknown[]) => void} listener */
    on: (event, listener) => handlers.set(event, listener),
  };
  return { updater, calls, handlers };
}
test("missing feed and unpackaged apps never contact updater", async () => {
  for (const [feed, packaged] of /** @type {[string | null, boolean][]} */ ([
    [null, true],
    ["https://example.com/", false],
  ])) {
    const { updater, calls } = mockUpdater();
    const updates = setupUpdates(updater, feed, packaged, async () => false);
    await updates.check();
    await updates.check(true);
    assert.deepEqual(calls, { feeds: 0, checks: 0, installs: 0 });
  }
});
test("arrival publishes status without a modal, install or automatic quit update", async () => {
  const { updater, calls, handlers } = mockUpdater();
  /** @type {string[]} */
  const notifications = [];
  /** @type {string[]} */
  const states = [];
  let isSafe = false;
  const updates = setupUpdates(
    updater,
    "https://example.com/",
    true,
    async (state) => {
      notifications.push(state);
      return true;
    },
    (state) => {
      states.push(state);
    },
    async () => isSafe,
  );
  assert.equal(updater.autoDownload, true);
  assert.equal(updater.autoInstallOnAppQuit, false);
  assert.equal(updater.allowPrerelease, false);
  await updates.restart();
  assert.equal(calls.installs, 0);
  handlers.get("update-downloaded")?.();
  await Promise.resolve();
  assert.deepEqual(notifications, []);
  assert.deepEqual(states, ["ready"]);
  assert.equal(calls.installs, 0);
  await updates.restart();
  assert.equal(calls.installs, 0);
  assert.equal(states.at(-1), "blocked");
  isSafe = true;
  await updates.restart();
  assert.equal(calls.installs, 1);
});
test("restart fails closed when safety cannot be established", async () => {
  const { updater, calls, handlers } = mockUpdater();
  /** @type {string[]} */
  const states = [];
  const updates = setupUpdates(
    updater,
    "https://example.com/",
    true,
    async () => true,
    (state) => {
      states.push(state);
    },
    async () => {
      throw new Error("document gone");
    },
  );
  handlers.get("update-downloaded")?.();
  await updates.restart();
  assert.equal(calls.installs, 0);
  assert.equal(states.at(-1), "failed");
});
test("update failure does not reject the application check action", async () => {
  const { updater } = mockUpdater();
  updater.checkForUpdates = async () => {
    throw new Error("offline");
  };
  const updates = setupUpdates(
    updater,
    "https://example.com/",
    true,
    async () => false,
  );
  await assert.doesNotReject(updates.check());
});

test("manual update reports a late download failure once", async () => {
  const { updater, handlers } = mockUpdater();
  /** @type {string[]} */
  /** @type {string[]} */
  const notifications = [];
  const { promise: downloadPromise, reject: rejectDownload } =
    Promise.withResolvers();
  const downloadUpdater = {
    ...updater,
    checkForUpdates: async () => ({ downloadPromise }),
  };
  const updates = setupUpdates(
    downloadUpdater,
    "https://example.com/",
    true,
    async (state) => {
      notifications.push(state);
      return false;
    },
  );
  const pending = updates.check(true);
  await Promise.resolve();
  handlers.get("error")?.();
  rejectDownload(new Error("download offline"));
  await pending;
  assert.deepEqual(notifications, ["failed"]);
});

test("restart rechecks document windows after the asynchronous proof", async () => {
  const proof = Promise.withResolvers();
  const state = {
    contents: { executeJavaScript: async () => proof.promise },
    url: "https://luma.green/",
    token: "document",
    isHome: true,
    isLoading: false,
    activeDownloads: 0,
    windowCount: 1,
  };
  const pending = canRestartDocument(() => state);
  state.windowCount = 2;
  proof.resolve(Date.now() + 1000);
  assert.equal(await pending, false);
  state.windowCount = 1;
  assert.equal(await canRestartDocument(() => state), true);
});
