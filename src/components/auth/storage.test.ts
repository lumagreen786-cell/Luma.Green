import { afterEach, expect, it, vi } from "vitest";

import { readPhone, readPhoneSentAt, rememberPhone } from "./storage";
afterEach(() => {
  sessionStorage.clear();
  vi.useRealTimers();
});
it("stores only a successfully sent phone and its timestamp in this tab", () => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-10-16T08:00:00Z"));
  sessionStorage.setItem("lg.signInPreview", "+919876543210");
  expect(readPhone()).toBeNull();
  rememberPhone("+919876543211");
  expect(readPhone()).toBe("+919876543211");
  expect(readPhoneSentAt()).toBe(Date.now());
  expect(sessionStorage.getItem("lg.signInPreview")).toBeNull();
  expect(localStorage.getItem("lg.signInPhone")).toBeNull();
});
it("rejects an invalid stored send timestamp", () => {
  sessionStorage.setItem("lg.signInSentAt", "invalid");
  expect(readPhoneSentAt()).toBeNull();
});
