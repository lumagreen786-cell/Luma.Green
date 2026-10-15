import { afterEach, beforeEach, expect, it, vi } from "vitest";

import { requestBotToken } from "./turnstile";

const config = vi.hoisted(() => ({
  NEXT_PUBLIC_TURNSTILE_SITE_KEY: "site-key",
}));
vi.mock("./env", () => ({ clientEnv: config }));
const render = vi.fn();
const remove = vi.fn();
beforeEach(() => {
  config.NEXT_PUBLIC_TURNSTILE_SITE_KEY = "site-key";
  vi.stubGlobal("turnstile", { render, remove });
  render.mockReset();
  remove.mockReset();
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

it("gets a fresh token per send and removes each completed widget", async () => {
  let sequence = 0;
  render.mockImplementation(
    (
      _container: HTMLElement,
      options: { callback: (token: string) => void },
    ) => {
      const token = `token-${String(++sequence)}`;
      queueMicrotask(() => {
        options.callback(token);
      });
      return token;
    },
  );
  expect(await requestBotToken()).toBe("token-1");
  expect(await requestBotToken()).toBe("token-2");
  expect(remove).toHaveBeenCalledTimes(2);
  expect(document.querySelector("[data-turnstile-container]")).toBeNull();
});

it("rejects failures and leaves the next send retryable", async () => {
  render.mockImplementation(
    (_container: HTMLElement, options: { "error-callback": () => void }) => {
      queueMicrotask(() => {
        options["error-callback"]();
      });
      return "widget";
    },
  );
  await expect(requestBotToken()).rejects.toThrow();
  expect(remove).toHaveBeenCalledWith("widget");
});

it("times out instead of keeping the send button disabled forever", async () => {
  vi.useFakeTimers();
  render.mockReturnValue("stalled");
  const result = expect(requestBotToken()).rejects.toThrow();
  await vi.advanceTimersByTimeAsync(20_000);
  await result;
  expect(remove).toHaveBeenCalledWith("stalled");
});

it("does not load Cloudflare when not configured", async () => {
  config.NEXT_PUBLIC_TURNSTILE_SITE_KEY = "";
  expect(await requestBotToken()).toBeNull();
  expect(render).not.toHaveBeenCalled();
});

it("recovers from a blocked script on the next attempt", async () => {
  vi.stubGlobal("turnstile", undefined);
  const blocked = expect(requestBotToken()).rejects.toThrow();
  const script = document.querySelector(
    'script[src*="challenges.cloudflare.com"]',
  );
  expect(script).not.toBeNull();
  script?.dispatchEvent(new Event("error"));
  await blocked;
  expect(
    document.querySelector('script[src*="challenges.cloudflare.com"]'),
  ).toBeNull();
  const retry = requestBotToken();
  render.mockImplementation(
    (
      _container: HTMLElement,
      options: { callback: (token: string) => void },
    ) => {
      queueMicrotask(() => {
        options.callback("retry-token");
      });
      return "retry-widget";
    },
  );
  vi.stubGlobal("turnstile", { render, remove });
  document
    .querySelector('script[src*="challenges.cloudflare.com"]')
    ?.dispatchEvent(new Event("load"));
  expect(await retry).toBe("retry-token");
  document.querySelector('script[src*="challenges.cloudflare.com"]')?.remove();
});
