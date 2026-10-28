import { ConvexError } from "convex/values";

/** Error codes convex/market.ts throws, each with a `market.errors` message. */
export const MARKET_ERRORS = [
  "NOT_SIGNED_IN",
  "WRONG_ROLE",
  "NOT_FOUND",
  "OWN_LISTING",
  "LISTING_NOT_OPEN",
  "NOT_ENOUGH_LEFT",
  "NOT_ENOUGH_STOCK",
  "INVALID_WEIGHT",
  "INVALID_PRICE",
  "NOTE_TOO_LONG",
  "UNKNOWN_MATERIAL",
  "WRONG_STEP",
] as const;

export type MarketErrorKey = (typeof MARKET_ERRORS)[number] | "generic";

function codeOf(data: unknown): unknown {
  if (typeof data === "string") return data;
  return typeof data === "object" && data !== null && "code" in data
    ? data.code
    : undefined;
}

/** What to tell someone whose market action failed: a `market.errors` key. */
export function marketErrorKey(error: unknown): MarketErrorKey {
  if (!(error instanceof ConvexError)) return "generic";
  const code = codeOf(error.data);
  return code === "LISTING_EXPIRED"
    ? "LISTING_NOT_OPEN"
    : (MARKET_ERRORS.find((known) => known === code) ?? "generic");
}
