# India-wide operational geography

Status: implementation contract, 28 October 2026. This replaces the Bengaluru-only software scope. City is an explicitly entered operational locality, not a legal jurisdiction or a promise of local service.

## City input

The operational key is `City, State/UT`. The city part has 2–60 characters after Unicode NFC normalization, trimming and collapsing whitespace. It contains letters and may include marks, spaces, apostrophes, periods and hyphens. City case is normalized with space/hyphen word initials in upper case. The state/UT suffix must match one of the 36 current official reference names, ignoring case and repeated whitespace. For example, ` new   DELHI , delhi` becomes `New Delhi, Delhi`. Same-name localities such as `Bilaspur, Chhattisgarh` and `Bilaspur, Himachal Pradesh` remain separate query and price partitions.

The shared control captures city and state/UT separately and serializes them into the existing `city` field. There is no new state column, data migration, GST-code mapping, geocoding or address inference. The sole compatibility rule is the existing pilot: bare `Bengaluru` and explicit `Bengaluru, Karnataka` both resolve to the existing key `Bengaluru`. This is the documented legacy Karnataka partition. `Bengaluru, Maharashtra` is a different operational key; it is not remapped to the pilot.

All other bare or unknown-state inputs fail complete submission/discovery validation. Existing other-city rows stay unchanged but are not discoverable through new locality queries until an authorized owner explicitly reconfirms their state-qualified locality. No automated rewrite or guessed mapping is permitted. Operators and households must use the same locality spelling; this reference does not resolve duplicate place names within one state or translated spellings.

The source registry uses official state/UT names (28 states and 8 UTs), not GST state codes. Source: [National Portal](https://www.india.gov.in/explore-india/facts-of-india/states-ut-districts), with [Ministry of Panchayati Raj LGD background](https://panchayat.gov.in/en/lgd/) and the [current official directory](https://lgdirectory.gov.in/). Reviewed 29 October 2026. No protected directory scraping or token-bearing URL is required. State labels are reference data, not an independently verified facility jurisdiction or permit.

Stored application sections gain optional `city`; saved partial drafts may omit it. The shared complete submission schemas require it for shop, business and Saathi. Existing approved records and application snapshots stay unchanged. A legacy editable draft with no city must ask the person to enter it before resubmission. Projection rejects missing city instead of assigning Bengaluru. There is no migration or retrospective rewrite.

## Household discovery

`households.shops` input: `{ city: string, items: BasketItem[], near?: {lat, lng} }`. Invalid city fails with `INVALID_CITY`. The canonical city selects active shops with the existing `by_kind_city` index and a maximum of 200 rows. Output remains the existing shop offer array. An empty local result is an honest unavailable state. No national scan or fallback city is allowed. A supplied point ranks only these local results; radius, capacity, hours and acceptance rules remain in their existing owners. Reassignment stays local to the selected shop's city.

The household form requires city before shop discovery. A change clears the previous shop choice, but keeps entered name/address/photos. Stored household drafts add optional city so old drafts still load. Public price controls select city explicitly and pass it to the city-indexed price queries. Missing source data stays unavailable; no Bengaluru price is represented as a national rate.

Admin API contract: `adminCollections.board({})` returns only
`{ bookings: { id, label }[] }`. `adminCollections.shops({ bookingId })` returns
`{ city: string | null, shops: { id, label }[] }`. Both require the current
admin session and authenticator. `adminCollections.reassign({ bookingId, orgId,
reason })` keeps its existing input and checks.

Admin collection recovery lists the bounded requested/accepted pickup records, then
loads replacement shops for one selected booking ID. The server requires the
admin session and authenticator, derives the canonical locality from the booking's
current shop, and queries at most 100 active kabadiwalas in that exact locality.
It never accepts a caller-supplied city or scans national shop inventory. Missing,
unknown-state or non-actionable source locality returns no replacement choices.
Changing the selected booking clears the earlier shop choice. Loading, no
selection and no local replacement states are explicit. Sending still uses the
existing reassignment mutation's TOTP, city, radius, capacity and quote guards.

## Business trade

Regular eligible listings may be in another city. Discovery remains bounded by current indexed seller-kind/status queries. Discovery and request use the same material/role eligibility function, including ordinary material status, supported chain tier, accepted family and manufacturer-byproduct qualification. Request rechecks active seller/buyer, current offer, quantities, stock and lot evidence. Removing the city restriction does not activate a specialist route, legal filing, payment override, or unconfigured provider. Unknown delivery cost stays unknown.

## Preserved boundaries

Real phone authentication and required second factors; workspace permissions; private photos; exact grams/paise; audited mutations; no synthetic local prices; scoped facility permission; specialist/hazardous exclusions; full quantity payment policy. Optional stored fields remain additive. No native changes or provider activation.

## Acceptance

Regression tests cover non-Bengaluru provisioning, absent city on legacy editable drafts, whitespace/case normalization, bounded city-isolated household discovery and empty results, cross-city eligible B2B, and rejection of invalid material/tier/status/stock/evidence. Component tests cover city entry/query scope and retained values. Current browser evidence must check keyboard use and affected en/kn/ar/ur phone/tablet/desktop light/dark layouts. Tests do not establish live provider or legal acceptance.

## Manual address boundary

State qualification partitions discovery and prices; it is not proof of a household point. When coordinates are supplied, existing server radius checks apply. Without coordinates, manual address entry remains available and automatic acceptance is disabled. The accepting operator must review the full address and actual service coverage. Do not claim that state selection verifies an address or that manual pickup has a server-proven geographic radius.
