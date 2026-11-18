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
- This shared rollout establishes the selected language across all existing web
  screens. Detailed page-by-page refinement and protected-state acceptance remain
  a separate review, as the owner requested. No new operational workflow is
  claimed from the visual preview.

## Activation requirements

- Owner supplies Luma WhatsApp recipient (international digits only).
- Vercel account/project that owns luma.green; current CLI account does not list
  Luma in its available team projects. Existing unrelated projects untouched.
- Spaceship/authenticated authoritative DNS access. Read exact Vercel DNS target
  before adding business record; preserve apex, mail and verification records.
- See ../operations/business-domain-rollout.md for DNS/TLS, Better Auth origins,
  private-file CORS, Turnstile, locale and native acceptance before enabling flag.
- No provider spend, production backend mutation, DNS, deployment, binary or OTA
  publication has occurred in this implementation.
