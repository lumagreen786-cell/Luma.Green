import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

import { useNativeUpdates } from "../src/use-native-updates";

const mock = vi.hoisted(() => ({
  state: "ready",
  check: vi.fn(),
  restart: vi.fn(),
  inject: vi.fn(),
}));
vi.mock("expo-constants", () => ({ default: { sessionId: "test-session" } }));
vi.mock("../src/use-updates", () => ({
  useShellUpdates: () => ({
    state: mock.state,
    check: mock.check,
    restart: mock.restart,
  }),
}));
const origin = "https://luma.green";
function setup(url = origin + "/en") {
  const currentUrl = { current: url };
  const webView = { current: { injectJavaScript: mock.inject } };
  // The production hook uses only this deliberately narrow WebView method.
  const hook = renderHook(() =>
    useNativeUpdates({
      origin,
      currentUrl,
      webView,
    }),
  );
  const command = (action: string, frameUrl = currentUrl.current) =>
    hook.result.current.receive(
      JSON.stringify({ type: "luma.update", nonce: "test-session", action }),
      frameUrl,
    );
  return { ...hook, currentUrl, command };
}
beforeEach(() => {
  vi.clearAllMocks();
  mock.state = "ready";
});
afterEach(cleanup);

it("does not restart when an update arrives, and rejects work pages and foreign frames", async () => {
  const hook = setup(origin + "/sell");
  expect(mock.restart).not.toHaveBeenCalled();
  await act(() => hook.command("restart"));
  await act(() => hook.command("restart", "https://other.example/en"));
  expect(mock.restart).not.toHaveBeenCalled();
});

it("requires the frozen-document proof and discards it after navigation", async () => {
  const hook = setup();
  await act(() => hook.command("restart"));
  expect(mock.restart).not.toHaveBeenCalled();
  const script = String(mock.inject.mock.calls.at(-1)?.[0]);
  const match = /var message=(.+);message.expiresAt=/.exec(script);
  if (!match) throw new Error("Missing native safety challenge");
  const message = JSON.parse(match[1]) as {
    type: string;
    nonce: string;
    proof: string;
  };
  const expired = JSON.stringify({ ...message, expiresAt: Date.now() - 1 });
  await act(() =>
    hook.result.current.receive(expired, hook.currentUrl.current),
  );
  expect(mock.restart).not.toHaveBeenCalled();
  const payload = JSON.stringify({ ...message, expiresAt: Date.now() + 5000 });
  await act(() =>
    hook.result.current.receive(payload, hook.currentUrl.current),
  );
  expect(mock.restart).toHaveBeenCalledWith(true);
  mock.restart.mockClear();
  await act(() => hook.command("restart"));
  act(() => {
    hook.result.current.invalidate();
  });
  await act(() =>
    hook.result.current.receive(payload, hook.currentUrl.current),
  );
  expect(mock.restart).not.toHaveBeenCalled();
});

it("checks once automatically only when updates are enabled and idle", () => {
  mock.state = "idle";
  const hook = setup();
  hook.rerender();
  expect(mock.check).toHaveBeenCalledOnce();
  hook.unmount();
  mock.check.mockClear();
  mock.state = "unavailable";
  setup();
  expect(mock.check).not.toHaveBeenCalled();
});
