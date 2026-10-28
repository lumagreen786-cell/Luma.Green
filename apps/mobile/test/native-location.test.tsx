import { act, cleanup, renderHook } from "@testing-library/react";
import type { WebView } from "react-native-webview";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useNativeLocation } from "../src/use-native-location";

const location = vi.hoisted(() => ({ permission: vi.fn(), position: vi.fn() }));
vi.mock("expo-constants", () => ({
  default: { sessionId: "test-native-session" },
}));
vi.mock("expo-location", () => ({
  requestForegroundPermissionsAsync: location.permission,
  getCurrentPositionAsync: location.position,
  Accuracy: { Balanced: 3, High: 4 },
}));

const origin = "https://luma.green";
const page = `${origin}/sell`;
const raw = (id = "request-1", timeout = 5000) =>
  JSON.stringify({
    type: "luma.location.current",
    requestId: id,
    nonce: "test-native-session",
    options: { timeout, enableHighAccuracy: false },
  });
const position = {
  timestamp: 123,
  coords: {
    latitude: 12.97,
    longitude: 77.59,
    accuracy: 1200,
    altitude: null,
    altitudeAccuracy: null,
    heading: -1,
    speed: -1,
  },
};

function setup() {
  const injectJavaScript = vi.fn();
  const currentUrl = { current: page };
  const webView = { current: { injectJavaScript } as unknown as WebView };
  const hook = renderHook(() =>
    useNativeLocation({ origin, currentUrl, webView }),
  );
  return { ...hook, currentUrl, injectJavaScript };
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.resetAllMocks();
  location.permission.mockResolvedValue({
    granted: true,
    android: { accuracy: "coarse" },
  });
  location.position.mockResolvedValue(position);
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("on-demand native location", () => {
  it("does not prompt on startup or from an untrusted frame and accepts approximate access", async () => {
    const h = setup();
    expect(location.permission).not.toHaveBeenCalled();
    await act(() =>
      h.result.current.receive(raw(), "https://untrusted.example/sell"),
    );
    expect(location.permission).not.toHaveBeenCalled();
    await act(() =>
      h.result.current.receive(
        raw().replace("test-native-session", "iframe-guessed"),
        page,
      ),
    );
    expect(location.permission).not.toHaveBeenCalled();
    await act(() => h.result.current.receive(raw(), page));
    expect(location.permission).toHaveBeenCalledOnce();
    expect(location.position).toHaveBeenCalledWith({ accuracy: 3 });
    expect(h.injectJavaScript).toHaveBeenCalledOnce();
    expect(h.injectJavaScript.mock.calls[0][0]).toContain('"accuracy":1200');
    expect(h.injectJavaScript.mock.calls[0][0]).toContain('"heading":null');
  });

  it("returns denied permission and provider failure as web geolocation errors", async () => {
    const h = setup();
    location.permission.mockResolvedValueOnce({ granted: false });
    await act(() => h.result.current.receive(raw(), page));
    expect(location.position).not.toHaveBeenCalled();
    expect(h.injectJavaScript.mock.calls[0][0]).toContain('"code":1');
    location.position.mockRejectedValueOnce(
      new Error("provider detail must not be relayed"),
    );
    await act(() => h.result.current.receive(raw("two"), page));
    expect(h.injectJavaScript.mock.calls[1][0]).toContain('"code":2');
    expect(h.injectJavaScript.mock.calls[1][0]).not.toContain(
      "provider detail",
    );
  });

  it("drops delayed permission results on navigation and never requests coordinates", async () => {
    const h = setup();
    const permission = Promise.withResolvers<{ granted: boolean }>();
    location.permission.mockReturnValueOnce(permission.promise);
    const pending = h.result.current.receive(raw(), page);
    h.result.current.invalidate();
    h.currentUrl.current = `${origin}/other`;
    await act(async () => {
      permission.resolve({ granted: true });
      await pending;
    });
    expect(location.position).not.toHaveBeenCalled();
    expect(h.injectJavaScript).not.toHaveBeenCalled();
  });

  it("bounds waiting, rejects concurrent requests, and drops late coordinates", async () => {
    const h = setup();
    const reading = Promise.withResolvers<typeof position>();
    location.position.mockReturnValueOnce(reading.promise);
    const pending = h.result.current.receive(raw(), page);
    await act(async () => {
      await Promise.resolve();
    });
    await act(() => h.result.current.receive(raw("two"), page));
    expect(location.permission).toHaveBeenCalledOnce();
    expect(h.injectJavaScript.mock.calls[0][0]).toContain('"code":2');
    await act(async () => {
      await vi.advanceTimersByTimeAsync(5000);
      await pending;
    });
    expect(h.injectJavaScript.mock.calls[1][0]).toContain('"code":3');
    await act(() => h.result.current.receive(raw("three"), page));
    expect(location.permission).toHaveBeenCalledOnce();
    await act(async () => {
      reading.resolve(position);
      await Promise.resolve();
    });
    expect(h.injectJavaScript).toHaveBeenCalledTimes(3);
  });

  it("drops coordinates after unmount and rejects zero-time requests without prompting", async () => {
    const h = setup();
    await act(() => h.result.current.receive(raw("zero", 0), page));
    expect(location.permission).not.toHaveBeenCalled();
    const reading = Promise.withResolvers<typeof position>();
    location.position.mockReturnValueOnce(reading.promise);
    const pending = h.result.current.receive(raw(), page);
    await act(async () => {
      await Promise.resolve();
    });
    h.unmount();
    await act(async () => {
      reading.resolve(position);
      await pending;
    });
    expect(h.injectJavaScript).toHaveBeenCalledOnce();
  });
});
