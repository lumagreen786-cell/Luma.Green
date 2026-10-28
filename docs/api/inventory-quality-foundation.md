# Inventory and quality foundation contract

Approved scope: D16, D17, D18 and D24, 27 October 2026.

- A business sets its own positive integer offer. Reference prices do not set a compulsory minimum and cannot change an existing offer or order.
- A rate is current before its explicit expiry, or for 24 hours from its recorded time. Missing or stale rates cannot price a new receipt. Indicative city data is not a business offer. A market indication needs a nonblank source label and observation date. Without an observation time, use midnight in India on the stated date. Import time never refreshes an old indication. Admin `recordMarket` records a validated source, date, observation time and optional expiry with an audit record.
- Each real stock change appends one inventory movement and updates its cached balance in the same transaction. The source key identifies the event and material. Repeated keys return the existing event only when values match.
- Inventory mass and costs use safe integers. Known intake costs are recorded paise; unknown costs remain null. A stock decrease allocates its share with BigInt division and leaves the final remainder on stock. A full decrease removes all remaining cost.
- Material lots are separate custody and process evidence. They do not add to real stock. A transformed lot needs a current accepted inspection with results and specification before dispatch or another transformation. A production declaration needs that same accepted inspection.
- Inspection corrections append records. A pending correction does not replace the accepted result. Separate approval supersedes its previous result. Superseded results cannot release output.

No provider calls, paid quota or deployment are required for local verification.

## Local verification

Focused backend and component suites cover independent offers, stale rates, labelled indications, immutable accepted/superseded inspection records, rejected production declarations, release gates, duplicate stock sources, exact remaining cost, and Cashfree dispatch/receipt retries. All real stock writers use the shared movement helper, including provider-authorised movements. Local checks do not prove provider execution, authenticated browser access, store acceptance, or Production deployment.

## B2B offer validity

A new listing expires 24 hours after creation. The seller can supply an explicit `contractValidUntil` timestamp, after the server time and at most 90 days ahead. This bound limits a single offer record; it does not create a supply agreement. Changing or accepting a listing does not restart its clock. Expired listings remain in seller history with their expiry and an unavailable state. They cannot create or accept a new order and no longer reserve unsold stock. Accepted orders retain their copied price, quantity and specification and their existing payment gates after offer expiry.
