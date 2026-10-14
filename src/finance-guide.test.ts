import { afterEach, describe, expect, it, vi } from "vitest";

import { financeFixture } from "../scripts/guide-preview/finance-fixtures";

afterEach(() => {
  vi.unstubAllGlobals();
});
function location(pathname: string, search: string) {
  vi.stubGlobal("window", { location: { pathname, search } });
}

describe("isolated financial guide examples", () => {
  it("does not inject financial state into ordinary trade fixtures", () => {
    location("/en/app/trades", "?scenario=authorized-dispatch");
    expect(financeFixture({ tradeId: "guide-finance-example" })).toBeNull();
  });
  it("requires the exact example identity and an explicit scenario", () => {
    location("/en/app/finance-example", "?scenario=authorized-dispatch");
    expect(financeFixture({ tradeId: "other-trade" })).toBeNull();
    expect(financeFixture(undefined)).toBeNull();
    location("/en/app/finance-example", "?scenario=unknown");
    expect(() => financeFixture({ tradeId: "guide-finance-example" })).toThrow(
      "explicit synthetic",
    );
  });
  it("provides only the selected synthetic dispatch interface state", () => {
    location("/kn/app/finance-example", "?scenario=authorized-dispatch");
    expect(financeFixture({ tradeId: "guide-finance-example" })).toMatchObject({
      state: "authorized",
      actions: ["dispatch"],
      grams: 1000,
      settlement: "pending",
      refund: "none",
    });
  });
  it("holds the example without an actionable financial operation", () => {
    location("/ar/app/finance-example", "?scenario=financial-hold");
    expect(financeFixture({ tradeId: "guide-finance-example" })).toMatchObject({
      state: "hold",
      collection: "review",
      actions: [],
    });
  });
});
