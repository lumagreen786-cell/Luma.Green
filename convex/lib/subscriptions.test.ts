import { describe, expect, it } from "vitest";

import { effectiveEntitlement, subscriptionPlans } from "./subscriptions";

describe("subscription targets and evidence", () => {
  it("keeps D39 monthly prices in exact paise and fixed member limits", () => {
    expect(
      subscriptionPlans.map((p) => [p.id, p.monthlyMinPaise, p.memberLimit]),
    ).toEqual([
      ["trader", 49_900, 3],
      ["centre", 249_900, 5],
      ["yard", 749_900, 10],
      ["processor", 1_499_900, 15],
      ["recycler", 2_999_900, 25],
      ["enterprise", 7_500_000, null],
      ["institution", 249_900, null],
    ]);
  });
  it("cannot make a paid entitlement from a flag or selected plan", () => {
    expect(effectiveEntitlement(null, true, 100)).toBeNull();
    expect(
      effectiveEntitlement(
        {
          plan: "trader",
          verifiedAt: 50,
          validFrom: 50,
          validUntil: 200,
          memberLimit: 3,
          siteLimit: 1,
          provider: "cashfree",
          providerSubscriptionId: "sub",
          providerEventId: "event",
        },
        false,
        100,
      ),
    ).toBeNull();
  });
  it("only trusts current valid Cashfree period evidence with fixed tier capacity", () => {
    const evidence = {
      plan: "trader" as const,
      verifiedAt: 50,
      validFrom: 50,
      validUntil: 200,
      memberLimit: 3,
      siteLimit: 1,
      provider: "cashfree" as const,
      providerSubscriptionId: "sub",
      providerEventId: "event",
    };
    expect(effectiveEntitlement(evidence, true, 100)?.memberLimit).toBe(3);
    expect(
      effectiveEntitlement({ ...evidence, validUntil: 100 }, true, 100),
    ).toBeNull();
    expect(
      effectiveEntitlement({ ...evidence, memberLimit: 100 }, true, 100),
    ).toBeNull();
    expect(
      effectiveEntitlement({ ...evidence, providerEventId: "" }, true, 100),
    ).toBeNull();
    expect(
      effectiveEntitlement({ ...evidence, validFrom: 110 }, true, 100),
    ).toBeNull();
  });
});
