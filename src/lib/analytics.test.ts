import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  analyticsChoiceKey,
  analyticsPage,
  analyticsProperties,
  readAnalyticsChoice,
  saveAnalyticsChoice,
} from "./analytics";

beforeEach(() => {
  saveAnalyticsChoice("denied");
  localStorage.clear();
});
afterEach(() => vi.restoreAllMocks());

describe("public analytics boundary", () => {
  it.each(["/", "/prices", "/ar/prices", "/ur/help", "/kn"])(
    "accepts the explicitly public route %s",
    (path) => {
      expect(analyticsPage(path)).toBeDefined();
    },
  );

  it.each([
    "/app",
    "/ar/app/trades/customer-secret",
    "/admin",
    "/admin/login",
    "/login",
    "/privacy",
    "/ar/account/privacy",
    "/join",
    "/join/status",
    "/sell",
    "/track/private-booking",
    "/help/contact",
    "/prices/private-id",
    "/new-public-route",
  ])("does not opt the route %s into tracking", (path) => {
    expect(analyticsPage(path)).toBeUndefined();
  });

  it("removes URL tokens before producing a public route", () => {
    expect(analyticsPage("/ar/prices?phone=secret#token=secret")).toBe(
      "/prices",
    );
    expect(analyticsProperties("/prices", "ar")).toEqual({
      page: "/prices",
      locale: "ar",
    });
  });
});

describe("analytics consent storage", () => {
  it.each([null, "true", "yes", "GRANTED", '{"granted":true}'])(
    "does not interpret %s as permission",
    (value) => {
      if (value !== null) localStorage.setItem(analyticsChoiceKey, value);
      expect(readAnalyticsChoice()).toBeNull();
    },
  );

  it.each(["granted", "denied"] as const)(
    "saves and reads the explicit choice %s",
    (choice) => {
      expect(saveAnalyticsChoice(choice)).toBe(true);
      expect(readAnalyticsChoice()).toBe(choice);
    },
  );

  it("returns no consent if the browser blocks storage reads", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new DOMException("Storage is blocked", "SecurityError");
    });
    expect(readAnalyticsChoice()).toBeNull();
  });

  it("reports failed writes instead of claiming consent was saved", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("Storage is full", "QuotaExceededError");
    });
    expect(saveAnalyticsChoice("granted")).toBe(false);
    expect(readAnalyticsChoice()).toBe("denied");
  });
});

it("blocks an earlier grant for this visit if saving withdrawal fails", () => {
  expect(saveAnalyticsChoice("granted")).toBe(true);
  const storage = vi
    .spyOn(Storage.prototype, "setItem")
    .mockImplementation(() => {
      throw new DOMException("Blocked", "SecurityError");
    });
  expect(saveAnalyticsChoice("denied")).toBe(false);
  expect(localStorage.getItem(analyticsChoiceKey)).toBe("granted");
  expect(readAnalyticsChoice()).toBe("denied");
  storage.mockRestore();
  expect(saveAnalyticsChoice("granted")).toBe(true);
  expect(readAnalyticsChoice()).toBe("granted");
});
