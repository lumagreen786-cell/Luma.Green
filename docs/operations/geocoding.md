# Google Maps address lookup

Status: optional source implementation, 27 October 2026. No Google account,
billing, key, terms acceptance or paid call was created by this work. Manual
address entry remains available. The same hosted controls run in web, iOS and
Android when native work resumes. Expo is paused; native build and device
acceptance steps below are deferred. No Maps SDK or new native permission is
required for the shared web reverse-geocoding controls.

## Request and data boundary

A person first chooses the existing location action. A separate consent checkbox
and Find address action send the selected point to Google Maps through a Convex
action. A live, verified-phone session and its server-derived member profile own
the request. The server uses only Google's fixed HTTPS Geocoding JSON endpoint.
This implements the documented latitude/longitude reverse lookup, with the
selected interface language. See [reverse geocoding requests](https://developers.google.com/maps/documentation/geocoding/requests-reverse-geocoding).

Ten attempts are allowed per account per India calendar day, across forms. A
five-second interval blocks rapid new requests. A keyed digest suppresses repeat
point/language requests for that account/day. The digest is not a plain coordinate
hash. Failed calls and timeouts consume their reserved attempt; there are no
paid retries. Calls have an eight-second timeout and a 200 KB response limit.
The provider request cannot follow a redirect. This account limit does not cap
the total bill across all accounts.

Only daily usage, keyed request fingerprints and safe audit metadata are saved.
The provider address, raw response, coordinates and key are not written to the
quota table, audit log, console, analytics or error reporting. Treat action inputs
as private operational data when granting Convex dashboard access. The returned
address exists only in the current screen's memory. A repeat lookup on that
screen can reuse that temporary result without another provider call. Address,
point or account changes and unmount discard it. No browser storage is used.

A suggestion never replaces entered text automatically. Saving provider-derived
address text is disabled by default. After a documented policy review permits
that use, a person must check the proposed address and explicitly choose Use
this address. A GPS point is not proof that the suggested building is correct.

## Owner setup

1. Review the current agreement, storage rules and privacy/terms obligations.
   Publish the required public disclosures before enabling requests. Review
   whether copying an address into a durable application or booking is permitted
   for the intended use. Leave the saving switch off until this is resolved.
2. In an owner-controlled Google Cloud project, enable billing and only the
   Geocoding API. Use a separate server key for each environment. Restrict the
   key to Geocoding API. Follow [Google's setup guide](https://developers.google.com/maps/documentation/geocoding/get-api-key).
3. Apply server IP restrictions for the current Convex deployment's documented
   egress addresses. Confirm the actual region and provider-supported address
   families. Do not use website-referrer, Android-package or iOS-bundle
   restrictions for this server call. Do not remove restrictions to make a failed
   call succeed. Follow [Google's key security guidance](https://developers.google.com/maps/api-security-best-practices).
4. Set a small Google Cloud API daily quota and a suitable per-minute limit
   before activation. Add billing alerts and named ownership. Google's quota day
   follows Pacific time; the application allowance follows India time. Review
   current India eligibility and the actual account price in the billing console;
   do not assume an old promotional credit applies. See [usage and billing](https://developers.google.com/maps/documentation/geocoding/usage-and-billing).
5. Save the following only in the matching Convex environment, separately for
   development and Production. Do not put the key in Vercel, Expo, public build
   variables, a client SDK, source control or screenshots.

| Variable                                | Setting                                                                                         |
| --------------------------------------- | ----------------------------------------------------------------------------------------------- |
| `GOOGLE_GEOCODING_API_KEY`              | Restricted server API key                                                                       |
| `GOOGLE_GEOCODING_ENABLED`              | `true` only after explicit billing and provider setup approval; absent keeps lookup unavailable |
| `GOOGLE_GEOCODING_ADDRESS_SAVE_ENABLED` | Absent/false until documented policy review permits durable address use                         |

Development paid requests remain disabled. Do not enable an integration merely
because a key can access it. No new billing account, paid plan, free-trial terms,
quota increase or service purchase is authorized by this implementation.

## Attribution and storage review

The compact address result displays the exact brand text Google Maps in the same
container. The text stays untranslated, unwrapped and protected from browser
translation. It uses normal sans-serif text at 14 px with an attribution-specific
light/dark color. Do not attach the attribution to manually entered addresses or
non-Google content. No map is shown. If a map is added later, reassess Google's
map-display rules first.

Google's current policy generally restricts content caching/storage and exempts
place IDs. This implementation does not persist Google content or place IDs.
The owner must resolve durable address use and any third-party attribution
before enabling the address-saving switch. Read the current
[Geocoding policy and attribution rules](https://developers.google.com/maps/documentation/geocoding/policies).

## Acceptance and failure handling

Local tests use synthetic provider responses. They check authentication, consent,
account quota, duplicate suppression, safe errors, transient results, attribution,
manual fallback, required confirmation and stale-result disposal. They do not
prove Google account approval or a paid provider result.

After setup, authorize one bounded acceptance call with an approved test point.
Check request accounting, the returned language, attribution and manual recovery
for denied/over-quota/unavailable responses. Record only non-sensitive evidence.
Never put a request URL, key, real location or raw provider response in a report.
Test the same hosted controls in the signed iOS build first, then Android. GPS,
camera/picker permissions, native signing and store acceptance remain separate.

APK/IPA builds use the existing Expo application and EAS profiles. A JavaScript
export is not an installer. The parent delivery task owns EAS whoami/project
availability, approved build submission and account/credential gates. This change
does not link a new EAS project or read signing secrets. Follow the
[mobile build guide](../../apps/mobile/README.md#updates-and-releases).
