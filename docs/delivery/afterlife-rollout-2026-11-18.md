# Afterlife implementation — 18 November 2026

Owner approved Afterlife and requested full web theme adoption plus a public /
business hostname split. This is source implementation, not a production claim.

## Implemented

- Household homepage, business ecosystem, and collector landing rebuilt with
  approved imagery, dark photo overlays / white text in both appearances.
- Actual Luma logo; footer tagline below name; decorative summary cards removed.
- Book now is a direct wa.me link with encoded localized message. No modal and
  no site phone field. Missing recipient disables booking with honest copy.
- Rotating Apartments / Coffee shops / Offices. GSAP reveal has reduced-motion
  fallback, cleanup and no scroll hijacking. Phone has 15 looping conversations,
  familiar chat/map/photo UI, static reduced motion and offscreen pause.
- Shared app/admin/account/auth/join shells, records and controls use Afterlife
  tokens, Geist + Noto, bounded multi-line corners and aligned utility targets.
  Existing operational forms, data, access checks and exact units are preserved.
- Domain-aware routing, metadata and sitemap prepared behind
  NEXT_PUBLIC_BUSINESS_SITE_ENABLED. One Next app and existing Convex backend.
  Old operational apex paths remain for installed native shells and old links.
- New copy is localized in all registered catalogues; human language review is
  still advisable. No translations are represented as independently reviewed.

## Evidence and limits

- 42 isolated fixture layouts and 18 actual auth layouts inspected across
  390/768/1440, light/dark, including Arabic. Fixture adapters are not public
  authentication bypasses or evidence of successful sign-in.
- 54 actual public-page layout checks cover homepage, business, collectors,
  privacy, help, status, login, Arabic and Tamil. A Tamil overflow was fixed.
- Captures under output/design/afterlife-production and
  output/design/afterlife-platform-captures. See check receipts for exact scope.
- Validation passed: 411 test files / 3,346 tests; TypeScript for web and
  backend; 28 security tests; native compatibility checks; production build
  (3,681 static routes). Lint: zero errors, 134 existing warnings.
- Two actual-app Playwright checks passed, including direct booking behavior.
  The production build and individual pnpm check stages ran locally; no
  production deployment or real WhatsApp booking is implied.
- The owner clarified full page restyling now. Public, household, account,
  operational and admin compositions were reviewed and updated, not only shared
  tokens. Real-account acceptance is deferred by the owner. No new operational
  workflow is claimed from the visual preview.

## Activation requirements

- Owner supplies Luma WhatsApp recipient (international digits only).
- Browser access confirmed to Vercel team `luma-0f95`, project `luma-green`.
  CLI remains a separate account; unrelated projects were not changed.
- Spaceship confirms Cloudflare nameservers. Business CNAME added at Cloudflare
  using the exact Vercel target; existing apex/www records and nameservers kept.
- See ../operations/business-domain-rollout.md for DNS/TLS, Better Auth origins,
  private-file CORS, Turnstile, locale and native acceptance before enabling flag.
- DNS and the exact backend trusted-origin setting were configured as recorded
  below. No provider send, frontend deployment, binary or OTA publication occurred.

## Domain setup receipt — 18 November 2026

- Vercel `luma-0f95/luma-green`: added `business.luma.green` to Production.
  Vercel reports Valid Configuration after SSL issuance. HTTPS returns HTTP 200
  from the existing release; this is not Afterlife deployment acceptance.
- Cloudflare zone `luma.green`: added CNAME `business` to
  `59238d9ed9b5298a.vercel-dns-017.com`, DNS only, Auto TTL. Existing apex A
  and www CNAME remain proxied and unchanged. Spaceship nameservers remain
  `arturo.ns.cloudflare.com` and `diva.ns.cloudflare.com`.
- Verified Convex production `astute-peccary-795`; preserved `SITE_URL` as
  `https://luma.green`. Appended `https://business.luma.green` to
  `EXTRA_TRUSTED_ORIGINS`, retaining `https://luma-green-ten.vercel.app`.
  Turnstile enforcement variable is unset; enforcement was not changed.
- PR #61: build, types, lint, unit, security and format checks passed on the
  initial revision. Browser job timed out on old design assertions. Follow-up
  updates preserve meaningful coverage and fix mobile menu keyboard handling
  and a Tamil layout issue; rerun remains required.

- Live non-mutating checks: private-file preflight accepts business and apex
  origins (204 with exact allowed origin), denies an unrelated origin (403),
  and business `/api/auth/get-session` and `/login` return 200. This does not
  prove signed-in access, OTP delivery, upload or recovery acceptance.

## Full-platform scope clarification

One Afterlife design and one admin console apply to all 82 source pages and
hosted mobile/desktop screens. Per-group records:

- [Public, account and household](afterlife-public-account-pages.md)
- [Workspace compositions](afterlife-workspace-pages.md)
- [Admin compositions](afterlife-admin-pages.md)

Operational source/detail coverage is recorded separately after the final
fixture matrix. Mobile native chrome and Electron offline presentation match
the web palette; binary/OTA publication remains separate. The owner will test
real accounts later, so that acceptance is explicitly deferred, not passed.

## Production switch preparation

Vercel Production now has `NEXT_PUBLIC_BUSINESS_SITE_ENABLED=true`. Saving the
setting succeeded; it needs the next checked deployment to take effect. No
redeploy of the old frontend was requested. Real-account acceptance is deferred
by the owner. The WhatsApp recipient remains unset.

## Full-platform final local checks

- Final production build passed (all page groups included).
- Full lint: zero errors, 122 warnings; web and Convex TypeScript passed.
- Full unit suite: 411 files, 3,346 tests passed with two workers.
- Security suite: all 28 passed with local loopback permission. The first
  sandbox run blocked its listener; that was an environment failure.
- Browser suite: 950 cases, 931 initially passed. All 19 obsolete presentation
  assertions were corrected, preserving image loading, fit, heading readability
  and keyboard checks. Focused reruns passed: motion 1, showcase 37 (including
  14 failed cases), join 4. This is combined evidence, not a clean full rerun.
- Workspace visual matrix: 112 captures, zero overflow or page errors.
- Operational visual matrix: 180 route captures and 21 secondary tabs, zero
  overflow or page errors. See the group records for fixture-state limits.
- Read-only review preserved tab drafts, record focus and one admin/backend.
  Fixed the desktop offline keyboard focus outline in dark mode.

Hosted CI must pass on the final commit before merge. Real-account testing,
provider delivery and native-device acceptance remain owner-deferred.

## Checked production release

PR #61 passed all hosted checks, including the complete Playwright job (28m1s),
isolated OTP checks and configured analytics tests. It merged as
`17ad1250eaac4d485032d2a1571cb3df87ef032d` on 18 November 2026.
Vercel deployment `Ad7A6EGuJbmKNauBijm15H52R9qg` is Ready on Production and
serves both domains from that commit.

Live read-only verification: both roots return 200; apex `/business` redirects
307 to business root; Arabic prefix and query survive the cross-host redirect;
business Arabic root returns 200. Apex `/app` redirects to its existing login,
both admin login URLs return 200, and the business session endpoint returns 200.
Public and business heroes were visually inspected, including the business dark
appearance. This does not replace the owner's deferred signed-in/device tests.

The owner then requested Vercel Analytics, PostHog and Sentry. That integration
is a separate follow-up. Sentry `luma-jb/luma-web` was created on the existing free
Developer plan, IP storage disabled, and its public DSN plus telemetry flag saved
in Vercel Production. A controlled local test using the application scrubber
arrived as event `78b7eb12074940df8def3ad4ac2d253a` in environment `setup-check`;
message and request URL were removed. Provider coarse geography remains. This
proves provider delivery from local source, not a production browser exception.
No private source-map upload token or paid Sentry plan was created.
