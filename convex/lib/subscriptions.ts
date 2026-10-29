import { ConvexError, type Infer } from "convex/values";

import { isBusinessSubscriptionsEnforced } from "../../src/lib/env";
import type { Id } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";
import type { vSubscriptionPlan } from "./subscriptionSchema";

export type SubscriptionPlan = Infer<typeof vSubscriptionPlan>;
export const subscriptionPlans = [
  {
    id: "trader",
    monthlyMinPaise: 49_900,
    monthlyMaxPaise: 49_900,
    memberLimit: 3,
    siteLimit: 1,
    priceKind: "target",
  },
  {
    id: "centre",
    monthlyMinPaise: 249_900,
    monthlyMaxPaise: 249_900,
    memberLimit: 5,
    siteLimit: 1,
    priceKind: "target",
  },
  {
    id: "yard",
    monthlyMinPaise: 749_900,
    monthlyMaxPaise: 749_900,
    memberLimit: 10,
    siteLimit: 1,
    priceKind: "target",
  },
  {
    id: "processor",
    monthlyMinPaise: 1_499_900,
    monthlyMaxPaise: 1_499_900,
    memberLimit: 15,
    siteLimit: 1,
    priceKind: "target",
  },
  {
    id: "recycler",
    monthlyMinPaise: 2_999_900,
    monthlyMaxPaise: 2_999_900,
    memberLimit: 25,
    siteLimit: 1,
    priceKind: "from",
  },
  {
    id: "enterprise",
    monthlyMinPaise: 7_500_000,
    monthlyMaxPaise: null,
    memberLimit: null,
    siteLimit: null,
    priceKind: "from",
  },
  {
    id: "institution",
    monthlyMinPaise: 249_900,
    monthlyMaxPaise: 999_900,
    memberLimit: null,
    siteLimit: null,
    priceKind: "range",
  },
] as const;
interface Evidence {
  provider: string;
  providerSubscriptionId: string;
  providerEventId: string;
  plan: SubscriptionPlan;
  verifiedAt: number;
  validFrom: number;
  validUntil: number;
  memberLimit: number;
  siteLimit: number;
}
/** Server-owned evidence only. Preferences, credentials and browser claims grant nothing. */
export function effectiveEntitlement(
  evidence: Evidence | null,
  isEnabled: boolean,
  now: number,
) {
  if (!isEnabled || !evidence) return null;
  const plan = subscriptionPlans.find((p) => p.id === evidence.plan);
  if (
    !plan ||
    evidence.provider !== "cashfree" ||
    !evidence.providerSubscriptionId.trim() ||
    !evidence.providerEventId.trim() ||
    [
      evidence.verifiedAt,
      evidence.validFrom,
      evidence.validUntil,
      evidence.memberLimit,
      evidence.siteLimit,
    ].some((value) => !Number.isSafeInteger(value)) ||
    evidence.verifiedAt > now ||
    evidence.verifiedAt < 0 ||
    evidence.validFrom > now ||
    evidence.validFrom < 0 ||
    evidence.validUntil <= now ||
    evidence.memberLimit < 1 ||
    evidence.memberLimit > 100 ||
    evidence.siteLimit < 1 ||
    evidence.siteLimit > 100 ||
    (plan.memberLimit !== null && evidence.memberLimit !== plan.memberLimit) ||
    (plan.siteLimit !== null && evidence.siteLimit !== plan.siteLimit)
  )
    return null;
  return {
    plan: evidence.plan,
    memberLimit: evidence.memberLimit,
    siteLimit: evidence.siteLimit,
    validUntil: evidence.validUntil,
  };
}
export async function siteEntitlement(ctx: QueryCtx, orgId: Id<"orgs">) {
  if (!isBusinessSubscriptionsEnforced()) return null;
  const evidence = await ctx.db
    .query("businessSubscriptionEntitlements")
    .withIndex("by_org", (q) => q.eq("orgId", orgId))
    .unique();
  return effectiveEntitlement(evidence, true, Date.now());
}
/** Called only for a net-new membership, inside its existing insertion transaction. */
export async function requireSubscriptionMemberCapacity(
  ctx: QueryCtx,
  orgId: Id<"orgs">,
  currentMembers: number,
) {
  const entitlement = await siteEntitlement(ctx, orgId);
  if (entitlement && currentMembers >= entitlement.memberLimit)
    throw new ConvexError("SUBSCRIPTION_MEMBER_LIMIT");
}
