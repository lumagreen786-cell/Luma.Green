# Isolated guide screenshot preview

## Foundation release evidence — 28 October 2026

`capture-foundation.mjs` captures six current component examples and an
English/Arabic/Urdu phone and tablet review matrix. Its default loopback origin
is `http://127.0.0.1:3228`. Start the Vite server with `--port 3228`, after the
current webpack production build. Restart that server after a rebuild so it
reads the current stylesheet and per-locale font files.

The retained baseline has 44 originals: six main examples, twenty responsive/theme
variants, three admin reassignment views, five acquisition-cost dialog views
and five daily closing/low-stock control views, plus five manufacturer intake
cost-dialog views. The cost dialogs use a 2,400px
tall documentation viewport; this does not claim that the whole form fits a
normal phone screen without scrolling. All other frames are 1,000px tall.
The manufacturer intake example supplies no approved material options or intake
history. It opens the actual form and scrolls to the cost fields; it does not
claim a classified byproduct or submit an intake. Its local `/app/intake-example`
route exists only in this documentation harness.

The final source refresh adds account removal (ready, held and recent-auth
required), retained-evidence admin review, assigned worker/employer handovers,
and Kannada phone/tablet examples. The complete plan now has 102 originals.
New screens cover English light/dark at phone, tablet and desktop widths, plus
Arabic/Urdu phone and Kannada phone/tablet examples. Removal remains open in
these fixtures; no closure, erasure or review action is performed. Handover
weights and IDs are made-up explanatory records, not proof of server linkage.
Specialist references are excluded from ordinary shop offers by the actual
shared specialist-material predicate.

The output is separate from the historical maintained guide:
`docs/delivery/evidence/platform-foundation-2026-10-28/`. Every image retains a
visible “Example screen — made-up data” label. The illustrative clock is fixed
at 14 October 2026; it is not the deployment date. All external requests and
HTTP writes are blocked. Fixture mutations and actions reject. The receipt
example shows an unconfirmed shop payment declaration, not a successful real
payment. The yard example shows unassessed material, not a verified permit or
certificate. None of these images proves live authentication or deployment.

The capture manifest records the original PNG hash, current component hash,
stylesheet hashes, adapter hashes, font loading and viewport dimensions. Wait
for theme transitions before capture. Inspect every original before changing
its visual review state from pending. Do not replace these images with generated
interfaces, or use this command to overwrite historical screenshots.
The command rejects a source change or build-ID change during a capture run.
The working-tree flag distinguishes current uncommitted source from its HEAD
checkpoint. Component and source hashes identify the exact captured content.

This harness renders the existing Luma.Green React components in Chromium.
It does not copy their markup or change their styles. It uses the current
production build's CSS and exact per-locale Geist/Noto font classes, read from its generated HTML. The yellow provenance banner is added
by the documentation harness outside the application shell.

All displayed accounts, applications, bookings, prices and report totals are
synthetic fixtures. The clock is fixed at 14 October 2026, 11:30 India time.
The screenshots show the interface with that sample data. They do not prove
successful sign-in, authorization, payment, provider execution or deployment.

## Capture again

Start from the repository root with dependencies installed and a current
production build. The build must contain `.next/static/css` and its font assets.
For this host, the supported build command is `pnpm exec next build --webpack`.

```sh
pnpm exec vite --config scripts/guide-preview/vite.config.mts
```

In another terminal:

```sh
node scripts/guide-preview/capture.mjs
```

The preview listens only on `127.0.0.1:3202`. If that port is already in use,
leave the existing process running and start a separate preview:

```sh
pnpm exec vite --config scripts/guide-preview/vite.config.mts --port 3203
GUIDE_FIXTURE_ORIGIN=http://127.0.0.1:3203 node scripts/guide-preview/capture.mjs
```

The origin override accepts only loopback HTTP origins. The harness does not use
port 3004 or alter its running production preview. Stop only the preview started
for the current capture after the work is complete.

Capture outputs go to `docs/user-guide/screenshots`. The script checks the
visible provenance label and each page heading, waits for fonts, rejects browser
errors and external network requests, then writes full-page PNG files. It records
routes, component paths and hashes, PNG hashes, production stylesheet hashes,
shared image/adapter source hashes, viewport sizes, scroll targets, the fixture clock and capture time in `fixture-captures.json`.
`sourceCommit` records HEAD at capture; individual source hashes identify the
component contents even when the working tree contains documentation changes.

The harness does not copy compiled CSS or fonts into Git. Rebuild them when
source styles change. Most screenshots are at 1440 × 1000 viewport pixels, with
reduced motion enabled. Household tracking uses a 480 × 1200 phone-width viewport. Most captures include the full page. The request overview,
weighing form and rate card use the unmodified 1440 × 1000 browser viewport so
the controls remain readable in the Word guide. The weighing capture scrolls to the
actual `#weigh` section; the documentation banner remains visible above it. No
image is cropped, repainted or composed after capture. `?role=` selects only the
harness fixture; it is not a production role-switching feature.

The shop and yard application captures show the upper form in the browser
viewport. The guide explains how to reach the remaining fields by scrolling.
This keeps field text readable in Word instead of shrinking a long form to one
page.

## Isolation and adapters

### Failure recovery matrix

Run `GUIDE_FIXTURE_ORIGIN=http://127.0.0.1:3217 node scripts/guide-preview/capture-failures.mjs`
against this isolated Vite server. Each named browser test uses the actual
component and local adapters. Requests reject without a backend, except the
synthetic transition from password entry to the authenticator input. This
transition creates no session. External requests are blocked.

The matrix captures phone (390 px), tablet (768 px) and desktop (1440 px), in
light and dark themes. Login, authenticator and setup remain English only.
File deletion, draft deletion, sign-out, support limits and unsafe trade totals
also run in Arabic. The setup captures show the empty token field and form
layout only; they do not show a failed or successful account creation.
Password and token fields are empty in every retained capture. No QR key,
backup code, real contact detail or customer file is used.

`docs/user-guide/failure-captures.json` records component/adapter hashes and
the hashes of the original `screenshots/failure-*.png` browser output. The
guide freshness test checks all 78 views. Each browser test verifies error
feedback, retained data or setup controls, retry availability where applicable,
document direction, no horizontal overflow and no page error. Desktop sign-out
uses a full-page frame to show the retry button below the provenance banner;
phone and tablet use a 1100 px-tall viewport so their fixed navigation stays in
place. For those sign-out views, the harness note moves above the lower navigation
to leave the unchanged menu header and error controls visible. The captures
are fixture evidence, not authentication, permission or provider proof.

- `main.tsx` imports actual `ConsoleShell`, `AppShell`, `JoinLayout` and page components.
- `fixtures.ts` contains sample data, with typed contracts for the main records.
- `queries.ts` replaces Convex hooks only in this Vite configuration. It creates
  no client, session, WebSocket or database connection. Unknown queries fail.
- Mutation and action adapters always reject. Sign-out also rejects. The harness
  cannot save a price, approve a business, send a message, or change an account.
- `locale.ts` loads the active route language from the real message catalogue. `translations.ts` resolves the actual async `HouseholdLayout` translation call from that same catalogue. Its markup is imported unchanged. All registered locales are supported by the harness.
- `image.tsx` uses local Vite image URLs in place of the Next optimizer. It preserves image classes, sizing and fill positioning. This adapter does not test production image delivery; production browser checks cover that. Remove it when authenticated Next captures replace the fixture harness.
- `navigation.tsx` adapts Next links, paths and initial query parameters to the standalone preview. Its `useSearchParams` adapter reads an initial snapshot; it does not subscribe to history changes. Open a Requests fixture with `?tab=today` or `?tab=done` to capture that state. Tab navigation behavior, Next router updates and server route guards require the connected tests and captures.
- The fixture route map has no Lots and quality route or traceability/quality query data. The shared navigation can display its link, but this preview cannot show or verify that destination. Use the actual connected lot captures; do not treat the preview's default home fallback as lot evidence.
- `process.env` is an explicit empty configuration plus `NODE_ENV`. No application
  environment file, credentials, development auth flag or backend URL is loaded.
- The capture script blocks every non-local HTTP request. No private attachment
  is loaded; the review fixture is a kabadiwala application without documents.
- No file under `src/`, no authentication code, and no production route is changed.

The business homes use zero synthetic trades and one synthetic material offer.
The separate trades page shows one synthetic accepted purchase. The compliance
page uses visibly fictional registration identifiers and report quantities.
They remain prototypes: an “escrow” label in a screenshot does not establish
real payment processing. The guide must explain this boundary in its text.

Six role home screens also have a `-phone` capture at 390 × 844 pixels to check
mobile navigation. Operational phone screenshots use the actual viewport only,
so fixed bottom navigation remains at the bottom of the image. This also applies
to the stock and impact phone examples. Full-page screenshots of these screens
would place the fixed navigation over content in the middle of the long image.

## Current capture set

| File stem                     | Actual component                                             |
| ----------------------------- | ------------------------------------------------------------ |
| `admin-overview`              | `ConsoleHome` inside `ConsoleShell`                          |
| `admin-verification`          | `VerificationQueue` inside `ConsoleShell`                    |
| `admin-review`                | `ApplicationReview` inside `ConsoleShell`                    |
| `admin-support`               | `SupportInbox` inside `ConsoleShell`                         |
| `admin-prices`                | `PriceTables` inside `ConsoleShell`                          |
| `admin-pilot`                 | `PilotNumbers` inside `ConsoleShell`                         |
| `kabadiwala-overview`         | `KabadiwalaHome` through `RoleHome` inside `AppShell`        |
| `kabadiwala-request`          | `RequestDetail` inside `AppShell`                            |
| `kabadiwala-request-overview` | `RequestDetail` at the top of the browser viewport           |
| `kabadiwala-weigh`            | Actual `#weigh` section of `RequestDetail`, viewport capture |
| `kabadiwala-ratecard`         | `RateCardPage` inside `AppShell`, viewport capture           |
| `yard-overview`               | `BusinessHome` through `RoleHome` inside `AppShell`          |
| `recycler-overview`           | `BusinessHome` through `RoleHome` inside `AppShell`          |
| `manufacturer-overview`       | `BusinessHome` through `RoleHome` inside `AppShell`          |
| `saathi-overview`             | `SaathiHome` through `RoleHome` inside `AppShell`            |
| `household-tracking`          | `TrackView` inside the actual `HouseholdLayout`              |
| `kabadiwala-requests`         | `RequestsPage` inside `AppShell`, viewport capture           |
| `yard-market`                 | `MarketPage` inside `AppShell`, viewport capture             |
| `yard-trades`                 | `TradesPage` inside `AppShell`, viewport capture             |
| `manufacturer-compliance`     | `CompliancePage` inside `AppShell`                           |

## Loaded report chart evidence

The `pilot:summary` adapter returns a typed synthetic summary with eight bookings
and two material rows. The same `PilotNumbers`, `BookingOutcomeChart` and
`MaterialWeightChart` components used by the app render these records. The capture
script requires both SVG charts to have usable dimensions and visible bars before
it writes any pilot screenshot. It also captures the full report in dark mode and
at phone width. Separate outcome and material viewport screenshots keep the guide
charts readable. These values are examples, not measured pilot results.

## Added protected-screen coverage

The capture script also registers the following eight outputs. Capture and visual
review must finish before these are used as guide evidence. Existing capture
names, routes and provenance rules remain unchanged.

| File stem                | Actual component and state                                    | Heading       | Viewport    |
| ------------------------ | ------------------------------------------------------------- | ------------- | ----------- |
| `kabadiwala-stock-phone` | `StockPage`, one synthetic newspaper stock row                | Stock         | 390 × 844   |
| `yard-sell`              | `SellPage`, one synthetic open listing and available stock    | Sell          | 1440 × 1000 |
| `yard-invoice`           | `InvoicePage`, synthetic prototype escrow receipt             | Trade receipt | 1440 × 1000 |
| `recycler-impact`        | `ImpactPage` / `OrgImpactView`, synthetic material totals     | Your impact   | 1440 × 1000 |
| `recycler-impact-phone`  | Same impact example at phone width                            | Your impact   | 390 × 844   |
| `join-kabadiwala-phone`  | `KabadiwalaJoin` / `KabadiwalaForm`, existing synthetic draft | Your shop     | 390 × 844   |
| `join-yard`              | `BusinessJoin` / `BusinessForm`, existing synthetic draft     | Your yard     | 1440 × 1000 |
| `join-status-phone`      | `StatusView`, submitted synthetic shop application            | Under review  | 390 × 844   |

The three onboarding views use the current `JoinLayout` and query the isolated
`applications:mine` adapter. The forms start with synthetic draft values. The
capture script does not edit fields, submit a form, request location, upload files
or run autosave. No login number or customer contact details are supplied.
All mutations and actions still reject through the same write-disabled adapter.
Production session checks and application code are unchanged.

## Household selection coverage

Three further phone captures use `HouseholdLayout` and the actual selection
components at 390 × 844. Their visible fixture banner identifies the isolated
preview. These routes are documentation harness paths, not application routes.

| File stem                | Harness route     | Actual component                                               | Heading                |
| ------------------------ | ----------------- | -------------------------------------------------------------- | ---------------------- |
| `household-basket-phone` | `/en/sell/basket` | `BasketStep`, three canonical materials and local draft state  | What do you have?      |
| `household-mode-phone`   | `/en/sell/shop`   | `ModeChoice` only, without a live shop-offer list              | Who buys it?           |
| `household-when-phone`   | `/en/sell/when`   | `WhenStep`, sample shop hours and a fixed 14 October 2026 date | When should they come? |

The sample prices come from the canonical catalogue. These components keep
changes in local React state only. They do not submit bookings, authenticate a
user, reserve a time, send a message or write to a backend. These three images
extend the original 40-view capture set.

## Account and notification evidence

The account set adds 29 captures of the actual account layout, menu, inbox,
security settings, empty authenticator/recovery challenge and admin password
recovery components. Together the capture script registers 72 images. English,
Arabic and Tamil examples cover phone/tablet widths and both themes. Operator
menus show the new account links.

The provider adapter selects the data branch without constructing a client or
loading a backend URL. The auth adapter supplies only a truthy fixture marker;
it is not a session. It has no phone number, token, session ID or private user ID.
The paginated inbox contains three synthetic event rows, with separate empty and
loading variants. The error example clicks Read all and captures the real error
from the rejecting mutation adapter. Device permission is unavailable because
no notification provider is mounted. No permission request or delivery occurs.

Security captures show on/off states only. Authenticator and recovery challenge
fields remain empty. Every auth method rejects, including enrollment, reset and
sign-out; no QR code, setup key, backup code, password or reset token is supplied.
Admin reset images show the missing-token error. These fixtures cannot prove
authentication, authorization, a successful reset or provider execution.

When a sheet opens, the capture script moves only the harness provenance note to
the bottom of the viewport and checks that it does not cover menu controls. It
does not alter the application's sheet geometry or styles. Longer operator
menus use a 1,100-pixel viewport height so all controls and the note are visible.

## Responsive fixture audit

The isolated preview also accepts `/ar`, `/ta` and `/ml` paths. It renders the
committed locale catalogues and sets the corresponding document direction.
Admin pages remain English. These adapters do not change application routing or
authentication.

Run the repeatable layout audit after rebuilding the application CSS and
restarting the task-owned preview:

```sh
GUIDE_FIXTURE_ORIGIN=http://127.0.0.1:3203 node scripts/guide-preview/responsive-audit.mjs
```

It checks all 40 registered fixture views at 320, 390, 640, 768, 1024 and 1440 px,
plus eight representative Arabic workspace views at the same widths. It checks
page overflow, clipped text controls and heading/label text bounds. Intentional
table scroll regions are reported separately. Larger invisible Radix hit areas
and progress fills inside clipped tracks are not text-layout faults. External
requests are blocked and no write actions are performed.

Results and unchanged browser PNGs for failures go to a unique
`luma-responsive-fixtures-*` directory under the OS temporary directory,
separate from the maintained guide evidence. The script prints the full path.
`GUIDE_AUDIT_OUTPUT` can select another output directory. `GUIDE_AUDIT_SCREEN`
filters view names for a targeted follow-up. Inspect every reported failure;
geometry checks do not replace visual or keyboard review.

The sale example has 260 kg of stock, a 60 kg open listing and 200 kg available.
The separate receipt example is an illustrative prototype state, not proof of
payment. The impact totals, including 100 kg of CO₂e, are synthetic. They must not
be described as measured recovery, verified emissions reductions or issued
credits. Add these screenshots to the stock, business sale, trade receipt, impact
and onboarding guide chapters only after browser capture and visual review.

## Industry API capture matrix

The API page uses `api-main.tsx` with the actual `ApiAccess` and `AppShell`
components. Its single key row is synthetic metadata; no raw key is created or
displayed. Creation and revocation callbacks always reject. Start it separately:

```sh
pnpm exec vite --config scripts/guide-preview/api-vite.config.mts
node scripts/guide-preview/api-capture.mjs
```

The default origin is `http://127.0.0.1:3213`. Override the local origin with
`GUIDE_API_FIXTURE_ORIGIN` if needed. The capture script reads the authoritative
locale registry. It captures English and Arabic at 360, 390, 768, 1024 and 1440
pixels in light and dark mode, plus every other registered language at 390 pixels
in both themes. Phone captures retain the viewport so the fixed navigation stays
at the bottom. Larger captures include the page.

`industry-api-captures.json` records source and image hashes, layout dimensions,
font loading, browser errors and the explicit fixture boundary. English and Arabic also have scrolled phone controls and revoke-dialog captures
in both themes. Their keyboard checks reach expiry, each scope, Create key and
Revoke, then close the dialog with Escape without confirming a write. A successful
script is not a visual review: inspect the images before recording completion.
It does not prove key issuance, revocation, provider execution, authentication or
production deployment. Do not click Create key during a guide capture.

## Current refinement matrix

`capture.mjs` now plans **126** original fixture views: the retained 72 plus
18 named unknown-factor impact views and 36 phone-verification views. The new
views cover English, Arabic and Kannada, light/dark, and 390/768/1440 px.
Unknown-factor views keep measured grams and show unavailable CO₂e. Phone views
show either a blank form or verified status for a fictional verified email
identity; all account mutations reject. The fixture banner is always visible.

The separate real-local admin script plans **36** originals (catalogue setup, material classification,
payment setup, blank vendor dialog, payment-policy section and blank policy
dialog × two themes × three widths):

```sh
pnpm --config.verify-deps-before-run=false exec jiti scripts/capture-admin-guide.mts --capture
```

It requires existing private local admin credentials with completed TOTP and the
approved loopback backend with live activation off. It does not enroll an admin,
save a vendor or policy, reconcile, refund, cancel or call a provider. The exact synthetic `local_test_shop_vendor` reference may be shown;
any other displayed vendor reference fails the privacy guard. Inspect originals
before changing its manifest's pending visual review to passed.

Legacy synthetic trades in the fixture harness have no financial lifecycle.
Their lifecycle query returns null, provider orders are empty, and sandbox and
live checkout availability are false. These defaults do not fabricate payment
evidence; every fixture mutation or action still rejects.

## Financial interface examples

The separate `capture-finance.mjs` runner plans **36** originals: an authorized
seller's blank dispatch-reference form and an order held for financial review,
in EN/AR/KN, light/dark, at 390/768/1440 px. It mounts the actual
`FinancialLifecycle` component in the existing isolated preview. The exact
`/app/finance-example` preview route, named scenario and fictional trade ID are
all required. Ordinary synthetic trades still return no financial lifecycle.

```sh
GUIDE_FIXTURE_ORIGIN=http://127.0.0.1:3203 node scripts/guide-preview/capture-finance.mjs
```

Both the persistent fixture banner and the adjacent simulated-state notice must
be visible. The dispatch example opens the form but leaves its reference empty;
Confirm remains disabled. The hold example has no financial action. No mutation,
provider call, session or real payment record is created. External and non-read
HTTP requests are rejected. These examples explain controls and cannot prove
authentication, approval, payment, allocation, dispatch or settlement.

The runner writes `finance-fixture-captures.json` with source, production CSS,
original-image and font evidence. Visual review starts pending. Inspect every
original before marking it passed or inserting a selected figure in the guide.
Use `finance-fixture-authorized-dispatch-en-light-1440.png` for the chapter 12
example, captioned as a synthetic interface example only. Keep the existing
126-view and 78-view manifests separate.

The three operator-menu fixtures use an 1800 px-tall viewport after the workbook
modules added navigation entries. This keeps the complete, unchanged scrollable
menu and the separate provenance note visible without overlap. Width remains
390 px for English/Arabic and 768 px for Tamil; this is a documentation frame,
not evidence that every menu entry fits a normal phone screen without scrolling.

The sign-out failure examples also use a tall 1800px documentation viewport. This keeps the long navigation, retry control, provenance label and error toast visible together. It is not a claim that the whole menu fits a normal phone viewport.

API access tablet screenshots use a 1600px tall documentation viewport. This keeps fixed navigation below the complete form; it is not evidence that the form fits a normal tablet screen without scrolling. Phone captures retain 844px height and include separate lower-control and dialog views.
