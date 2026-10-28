import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import App from "../src/app";

const native = vi.hoisted(() => {
  const webProps: Record<string, unknown> = {};
  return {
    webProps,
    reload: vi.fn(),
    goBack: vi.fn(),
    stopLoading: vi.fn(),
    removeBack: vi.fn(),
    back: undefined as (() => boolean) | undefined,
    receive: vi.fn(),
    invalidate: vi.fn(),
    ready: vi.fn(),
    openUrl: vi.fn(),
    alert: vi.fn(),
  };
});

vi.mock("expo-constants", () => ({
  default: { expoConfig: { extra: { appOrigin: "https://luma.green" } } },
}));
vi.mock("expo-localization", () => ({
  getLocales: () => [{ languageTag: "en-IN" }],
}));
vi.mock("expo-status-bar", () => ({ StatusBar: () => null }));
vi.mock("react-native", async () => {
  const { createElement } = await import("react");
  return {
    ActivityIndicator: ({
      accessibilityLabel,
    }: {
      accessibilityLabel: string;
    }) =>
      createElement("span", {
        role: "status",
        "aria-label": accessibilityLabel,
      }),
    Alert: { alert: native.alert },
    BackHandler: {
      addEventListener: (_event: string, canHandleBack: () => boolean) => {
        native.back = canHandleBack;
        return { remove: native.removeBack };
      },
    },
    Linking: { openURL: native.openUrl },
    Pressable: ({
      children,
      onPress,
      accessibilityLabel,
    }: {
      children: ReactNode;
      onPress: () => void;
      accessibilityLabel: string;
    }) =>
      createElement(
        "button",
        { onClick: onPress, "aria-label": accessibilityLabel },
        children,
      ),
    StyleSheet: { create: (styles: unknown) => styles, absoluteFill: {} },
    Text: ({ children }: { children: ReactNode }) =>
      createElement("span", {}, children),
    useColorScheme: () => "dark",
    View: ({ children }: { children: ReactNode }) =>
      createElement("div", {}, children),
  };
});
vi.mock("react-native-safe-area-context", async () => {
  const { createElement } = await import("react");
  const Container = ({ children }: { children: ReactNode }) =>
    createElement("div", {}, children);
  return { SafeAreaProvider: Container, SafeAreaView: Container };
});
vi.mock("react-native-webview", async () => {
  const { createElement, forwardRef, useImperativeHandle } =
    await import("react");
  return {
    WebView: forwardRef(function TestWebView(
      props: Record<string, unknown>,
      ref,
    ) {
      native.webProps = props;
      useImperativeHandle(ref, () => ({
        reload: native.reload,
        goBack: native.goBack,
        stopLoading: native.stopLoading,
      }));
      return createElement("div", { "data-testid": "hosted-app" });
    }),
  };
});
vi.mock("../src/use-native-location", () => ({
  useNativeLocation: () => ({
    script: "true;",
    receive: vi.fn(),
    invalidate: vi.fn(),
  }),
}));
vi.mock("../src/use-native-updates", () => ({
  useNativeUpdates: () => ({
    script: "true;",
    ready: vi.fn(),
    receive: vi.fn(),
    invalidate: vi.fn(),
  }),
}));
vi.mock("../src/use-push-notifications", () => ({
  usePushNotifications: () => ({
    receive: native.receive,
    invalidate: native.invalidate,
    ready: native.ready,
  }),
}));

function isCallback(value: unknown): value is (...args: unknown[]) => unknown {
  return typeof value === "function";
}

function invoke(name: string, ...args: unknown[]) {
  const callback = native.webProps[name];
  if (!isCallback(callback))
    throw new Error(`Missing WebView callback: ${name}`);
  act(() => {
    callback(...args);
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  native.webProps = {};
});
afterEach(cleanup);

describe("WebView-only Android shell", () => {
  it("shows the hosted interface without permanent native toolbars", () => {
    render(<App />);
    expect(screen.getByTestId("hosted-app")).toBeTruthy();
    expect(screen.queryAllByRole("button")).toHaveLength(0);
    expect(native.webProps.source).toEqual({ uri: "https://luma.green/en" });
    expect(native.webProps.geolocationEnabled).toBe(true);
    expect(native.webProps.allowFileAccess).toBe(false);
    expect(native.webProps.allowUniversalAccessFromFileURLs).toBe(false);
  });

  it("offers retry only after a load failure and preserves the hosted instance for a network retry", () => {
    render(<App />);
    const hosted = screen.getByTestId("hosted-app");
    invoke("onError");
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(native.reload).toHaveBeenCalledOnce();
    expect(screen.getByTestId("hosted-app")).toBe(hosted);
    expect(screen.queryAllByRole("button")).toHaveLength(0);
  });

  it("uses Android Back for web history and removes the listener on unmount", () => {
    const view = render(<App />);
    expect(native.back?.()).toBe(false);
    invoke("onNavigationStateChange", {
      url: "https://luma.green/sell",
      canGoBack: true,
    });
    expect(native.back?.()).toBe(true);
    expect(native.goBack).toHaveBeenCalledOnce();
    view.unmount();
    expect(native.removeBack).toHaveBeenCalled();
  });

  it("remounts a crashed renderer at its last trusted page", () => {
    render(<App />);
    invoke("onNavigationStateChange", {
      url: "https://luma.green/sell",
      canGoBack: true,
    });
    const hosted = screen.getByTestId("hosted-app");
    invoke("onRenderProcessGone");
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(native.webProps.source).toEqual({ uri: "https://luma.green/sell" });
    expect(screen.getByTestId("hosted-app")).not.toBe(hosted);
    expect(native.reload).not.toHaveBeenCalled();
  });
});
