# Returns and declared scheme evidence

Approved scope: D25/D29, TASK 07 paragraphs 123–131 and TASK 10 paragraphs 154–163, R042/R055, 27 October 2026.

## Full returns

A return is a compensating record against a completed, physically received material order. Either active trade party can propose it with a unique reference, reason, original seller as the explicit return destination, and buyer or seller as freight payer. This version supports the full accepted order quantity only. The original seller must still be active and eligible for the material. A different or specialist destination requires a separately verified route and is unavailable here.

The other party approves or rejects. Approval puts the source on hold and withdraws its declared scheme allocations in the same transaction. Buyer dispatch removes exact grams once; original seller receipt adds exact grams once. Existing accepted/open sale reservations must not consume the returned grams. The seller's historic recorded dispatch cost is restored when known; missing cost stays unknown. Neither record edits the original order or its quantities.

Physical return and financial reconciliation are separate. Only current live Cashfree collection, confirmed full refund and provider settlement reversal evidence can complete reconciliation. A refund alone does not add stock or close a return. Missing provider evidence leaves an honest pending state. Public actions cannot mark payment refunded or settlement reversed.

Every action checks active party membership, exact grams, destination eligibility, legal state and reference replay. Repeated identical actions do not move stock twice; changed retries fail. Each change appends audit evidence.

## Declared scheme allocations

These records state an organisation's claimed allocation under a named scheme and a supplied external issuer reference. They are labelled reported, unverified evidence. Luma does not issue or approve an official certificate or carbon credit.

Eligible source: an owned completed purchase with live-confirmed collection and the exact received inventory movement. Linked process evidence must still have current accepted tests. The source must have active eligible parties and material and no accepted return. Quantity is positive integer grams, no more than the owned received quantity. Active allocation totals for one source and scheme cannot exceed that quantity; source/operation references are idempotent. A scheme reference identifies one scheme inside the declaring organisation.

A party can withdraw its declaration with a reason. Accepted returns withdraw affected declarations atomically. Each read and allocation fails closed against current source/quality validity, so subsequent invalid source evidence cannot remain presented as active. Explicit validation records withdrawal audit evidence. Corrections do not edit past declarations or issuer references.

## Comparison limits

Listing eligibility remains mandatory before ranking. A price without recorded freight is a quote-required result, not a zero-freight delivered price. Distance and delivery availability can only rank when recorded. Missing inputs remain unknown; no invented delivered net value or provider acceptance is permitted.

## Implemented buyer comparison contract

New offers can record non-negative integer freight paise per kilogram, an earliest delivery time and an explicit expiry. Freight must be supplied to compute delivered cost; zero freight is accepted only when explicitly recorded. Delivery availability cannot be later than the offer expiry. Accepted orders retain these recorded terms. Cashfree collection remains the material amount; the UI states that freight is agreed and paid separately.

Rank only exact material and matching declared grade/specification groups. Within each group, a buyer sees known lower material-plus-freight cost first, then known shorter straight-line distance and earlier recorded availability. Unknown values remain quote-required or absent, not zero. Geography remains the current city rule for ordinary chain offers and the existing reviewed byproduct route; no new service-radius, permit, capacity or third-party freight verification is claimed.

Matching, requests and acceptance recheck seller stock against current listings, accepted undelivered orders and stock held by received quality disputes or approved returns. Failed concurrent acceptances cannot reserve the same remaining grams twice. Incoming return stock is separate from compensation for money; no refund callback restores inventory.
