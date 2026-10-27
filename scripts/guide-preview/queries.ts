import { type FunctionReference, getFunctionName } from "convex/server";
import { ConvexError } from "convex/values";

import { inboxFixture, securityFixture } from "./account-fixtures";
import { financeFixture } from "./finance-fixtures";
import {
  complianceFixture,
  fixtures,
  impactFixture,
  invoiceFixture,
  myListingsFixture,
  offersFixture,
  onboardingFixture,
  priceQuotesFixture,
  sellableFixture,
  tradesFixture,
  unknownFactorImpactFixture,
  workspaceFixture,
} from "./fixtures";
import {
  operationalFixtures,
  routeHistoryFixture,
  routesFixture,
} from "./operational-fixtures";
import {
  workspaceListFixture,
  workspaceTeamFixture,
} from "./workspace-fixtures";

function failureQuery(name: string): { matched: boolean; value?: unknown } {
  if (window.location.pathname.endsWith("/failure.html")) {
    const scenario = new URLSearchParams(window.location.search).get(
      "scenario",
    );
    if (
      name === "identity:me" &&
      ["login", "totp", "setup"].includes(scenario ?? "")
    )
      return { matched: true, value: null };
    if (name === "identity:signInOptions")
      return { matched: true, value: { adminSetup: true } };
    if (name === "applications:mine")
      return {
        matched: true,
        value: {
          application: { kind: "kabadiwala", status: "draft", version: 0 },
        },
      };
  }
  return { matched: false };
}

function recyclingQuery(name: string): { matched: boolean; value?: unknown } {
  if (
    name === "applications:mine" &&
    new URLSearchParams(window.location.search).has("entry")
  )
    return {
      matched: true,
      value: { loginPhone: undefined, application: null },
    };
  if (
    !window.location.pathname.endsWith("/sell") ||
    window.location.pathname.includes("/app/")
  )
    return { matched: false };
  if (name === "identity:me")
    return { matched: true, value: { kind: "member", phone: "+919000000109" } };
  return name === "households:shops"
    ? {
        matched: true,
        value: [
          {
            id: "guide-shop",
            name: "Synthetic neighbourhood shop",
            area: "Bengaluru",
            address: "Sample shop address",
            offersPickup: true,
            fallbackCodes: [],
          },
        ],
      }
    : { matched: false };
}

/** No Convex client or connection is created in this documentation-only process. */
export function useQuery(
  query: FunctionReference<"query">,
  args?: unknown,
): unknown {
  if (args === "skip") return undefined;
  const name = getFunctionName(query);
  const failure = failureQuery(name);
  if (failure.matched) return failure.value;
  // Legacy synthetic trades have no financial lifecycle or provider evidence.
  // These read-only defaults cannot grant checkout or imply payment execution.
  if (name === "cashfreeLifecycle:status") return financeFixture(args);
  if (name === "cashfreePayments:status") return [];
  if (name === "cashfreePayments:availability")
    return {
      sandboxEnabled: false,
      canCheckout: false,
      liveCanCheckout: false,
    };
  const recycling = recyclingQuery(name);
  if (recycling.matched) return recycling.value;
  if (name === "identity:me" && window.location.pathname.includes("/join/"))
    return securityFixture("");
  if (name === "inbox:unreadCount")
    return inboxFixture(window.location.search).unreadCount;
  return name === "identity:me" &&
    window.location.pathname.endsWith("/account/security")
    ? securityFixture(window.location.search)
    : readFixture(name);
}
function impactScenario() {
  return window.location.pathname.endsWith("/app/impact") &&
    new URLSearchParams(window.location.search).get("scenario") ===
      "unknown-factor"
    ? unknownFactorImpactFixture
    : impactFixture;
}
function readFixture(name: string): unknown {
  if (Object.hasOwn(operationalFixtures, name))
    return operationalFixtures[name];
  switch (name) {
    case "householdPhotos:list": {
      return [];
    }
    case "workspace:mine": {
      return workspaceFixture();
    }
    case "workspace:list": {
      return workspaceListFixture;
    }
    case "workspace:team": {
      return workspaceTeamFixture;
    }
    default: {
      break;
    }
  }
  if (name === "market:browse") return offersFixture();
  if (
    name === "market:trades" &&
    window.location.pathname.endsWith("/app/trades")
  )
    return tradesFixture;
  if (name === "insights:compliance") return complianceFixture;
  if (name === "identity:signInOptions")
    return { adminSetup: false, phone: true, email: true };
  if (name === "insights:impact") return impactScenario();
  if (name === "market:receipt") return invoiceFixture;
  if (name === "market:sellable") return sellableFixture;
  if (name === "catalogue:priceQuotes") return priceQuotesFixture;
  if (name === "applications:mine") return onboardingFixture();
  if (
    name === "market:myListings" &&
    window.location.pathname.endsWith("/app/sell")
  )
    return myListingsFixture;
  if (!Object.hasOwn(fixtures, name))
    throw new Error(`Missing documentation fixture: ${name}`);
  return fixtures[name];
}
export function useConvexAuth() {
  return { isLoading: false, isAuthenticated: true };
}
export function usePaginatedQuery(query: FunctionReference<"query">) {
  const name = getFunctionName(query);
  if (name === "routePlans:mine" || name === "routePlans:history") {
    const fixture =
      name === "routePlans:mine" ? routesFixture : routeHistoryFixture;
    return {
      results: fixture.page,
      status: "Exhausted",
      loadMore: () => {
        throw new Error("Documentation fixture: pagination is exhausted.");
      },
    };
  }
  if (name !== "inbox:list")
    throw new Error(`Missing paginated documentation fixture: ${name}`);
  const fixture = inboxFixture(window.location.search);
  return {
    results: fixture.results,
    status: fixture.status,
    loadMore: () => {
      throw new Error("Documentation fixture: pagination is exhausted.");
    },
  };
}
function rejectWrite() {
  return window.location.pathname.endsWith("/failure.html") &&
    new URLSearchParams(window.location.search).get("scenario") === "support"
    ? Promise.reject(new ConvexError("SUPPORT_RATE_LIMITED"))
    : Promise.reject(new Error("Documentation fixture: writes are disabled."));
}
export function useMutation() {
  return rejectWrite;
}
export const useAction = useMutation;
