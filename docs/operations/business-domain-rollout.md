# Public and business domain activation

Prepared 18 November 2026. Code preparation does not activate DNS or change a
Convex deployment. Both sites use the same Next.js project and existing Convex
production backend. Development continues to use its separate backend.

## Implemented routing contract

`NEXT_PUBLIC_BUSINESS_SITE_ENABLED=true` is the explicit Vercel frontend/build
switch. Unset, empty or false keeps the original host routing. It is a public
routing setting, not a provider secret. Redeploy to change it.

| Request                                                                          | Enabled behavior                                                 |
| -------------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| `business.luma.green/`                                                           | Rewrite internally to `/en/business`                             |
| `business.luma.green/ta`                                                         | Rewrite internally to `/ta/business`; preserve locale headers    |
| `luma.green/business`                                                            | Temporary redirect to business host root                         |
| Apex marketing `participants`, `how-it-works`, `standards`, `prices`, `/join`    | Temporary redirect to same localized path on business host       |
| Existing `/app/*`, `/account/*`, `/login/*`, `/join/*` workflows and email links | Remain compatible on original host; also served on business host |
| Household `/sell`, `/t/*`, privacy, help, status                                 | Remain reachable on original host                                |
| `/api/*`, `/admin/*`, framework/assets                                           | No domain redirects from this proxy                              |
| Localhost, other preview/unknown hosts                                           | No production-host redirects                                     |

Locale prefixes and query strings survive redirects. API calls are not redirected.
Targets are fixed first-party origins; forwarded host headers never form targets.
The redirect is 307 so rollback does not fight a cached permanent move. After
business acceptance and old-link audit, a later release can set permanent redirects.

`businessHref(path, locale)` creates localized business links. It stays local
until the split is enabled. Its business homepage is canonical at the business
origin root, not `/business`. Host-specific metadata must use that root for the
business landing page and the business origin for business routes. Household
metadata stays on `https://luma.green`. Do not use the request host blindly for
canonical URLs. Keep privacy/support metadata canonical to their chosen owner.

## Activate in order

1. Inventory and retain apex records, mail records and verification records.
   Check authoritative nameservers. Spaceship registration does not establish
   that Spaceship hosts DNS.
2. Add `business.luma.green` to the current Vercel project. Read its exact DNS
   target from Vercel. Create only the requested business record at the
   authoritative DNS host. Confirm ownership, propagation and TLS.
3. Keep the existing Convex production URLs. Add
   `https://business.luma.green` to Convex `EXTRA_TRUSTED_ORIGINS`, retaining
   existing exact origins. This list is already used by Better Auth and private
   file endpoints. Verify origin denial as well as success. No wildcard origin.
4. Verify login, OTP/TOTP, logout, cookie/session lifetime, invites, email links
   and recovery on both hosts. Existing host-only sessions do not migrate;
   business users may need to sign in again. Do not broaden cookie Domain to
   `.luma.green` merely to hide that fact. Keep Convex `SITE_URL` on its existing
   origin until outgoing auth/workspace email links have an explicit migration.
5. Configure Turnstile's permitted hostname and matching provider settings if
   enforcement is active. Verify token success, failure and replay. No paid SMS
   send or other provider call is implied by configuration checks.
6. Existing apex operational routes remain available so installed native shells
   keep working during migration. There are no apex operational redirects.
   Expo `apps/mobile/origin.cjs` and runtime config currently select one origin;
   `classifyNavigation` sends other HTTPS origins to the external browser.
   Electron `DESKTOP_APP_ORIGIN` and `isAppUrl` also trust one exact origin.
   For new configurations use `EXPO_PUBLIC_APP_URL=https://business.luma.green` (Expo)
   and `DESKTOP_APP_ORIGIN=https://business.luma.green` (Electron). Keep defaults
   unchanged until release acceptance. Test the chosen origin/config update with bridge, downloads,
   notifications, camera/location and safe-restart rules. Binary/OTA publication
   remains a separate release, not a consequence of this web deployment.
7. Verify metadata, sitemap/robots ownership and public consent-gated analytics.
   Domain routing adds no product event or private property and does not change
   Sentry hooks. Never capture auth queries or exact locations.
8. Deploy the checked code with `NEXT_PUBLIC_BUSINESS_SITE_ENABLED=true` only
   after the above readiness checks. Test each row in the routing table with
   English, a prefixed locale and RTL, plus authorized/denied record access.

## Rollback

Redeploy with the split flag false to retain local routes and stop new cross-host
redirects. Keep the business DNS and approved trusted origin during recovery
unless there is a specific security reason to remove them; existing links may
still arrive there. The previous frontend deployment is the second rollback
option. No database migration or deletion is needed for this split.

## Evidence boundary

Unit tests cover locale/query handling, fixed targets, activation default,
unknown hosts, preserved auth/API/admin/household routes and next-intl rewrite
headers. They do not prove DNS, TLS, provider delivery, production session behavior
or real native-device acceptance. Those checks remain required at activation.

## Homepage reference photograph

The illustrative phone conversation uses `used-box-recovery.webp` for cardboard
scenarios. Source: [Used Box Recovery](https://commons.wikimedia.org/wiki/File:Used_Box_Recovery.jpg),
Sherways Environmental Packaging, 17 November 2016, CC BY-SA 4.0. The author,
source and license are linked below the phone. The public sidecar
`/images/showcase/used-box-recovery.LICENSE.txt` records the resize and WebP
conversion and the derivative's unchanged license. The photo is a third-party
reference, not a customer upload or evidence of a Luma collection.
