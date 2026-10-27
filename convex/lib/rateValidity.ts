/** Explicit validity overrides the standard 24-hour offer window. */
export function isRateCurrent(
  rate: { updatedAt: number; expiresAt?: number },
  now = Date.now(),
) {
  return (
    rate.updatedAt <= now &&
    now < (rate.expiresAt ?? rate.updatedAt + 24 * 60 * 60 * 1000)
  );
}

export const OFFER_MAX_VALIDITY_MS = 90 * 24 * 60 * 60 * 1000;

/** Listing creation time is immutable; an update cannot refresh an old offer. */
export function isListingOfferCurrent(
  offer: { createdAt: number; expiresAt?: number },
  now = Date.now(),
) {
  return isRateCurrent(
    { updatedAt: offer.createdAt, expiresAt: offer.expiresAt },
    now,
  );
}
