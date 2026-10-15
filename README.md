<p align="center">
  <img src="public/logo.svg" width="96" height="96" alt="Luma.Green" />
</p>

<h1 align="center">Luma.Green</h1>

**Continue development:** [Agent handoff](docs/delivery/handoff.md) — branch and
commit checkpoints, completed work, verification, setup gates and next tasks.

**Learn the platform:** [A-to-Z Word guide](output/docx/luma-green-user-guide.docx)
and [editable guide with screenshot evidence](docs/user-guide/README.md).

<p align="center"><strong>Cleaner Tomorrow in Motion</strong></p>

<p align="center">
  A city's whole recycling chain on one platform: from the household selling
  old newspaper to the factory buying recycled PET flakes. Fair prices, weighed
  pickups and every hand-off on the record. Piloting in Bengaluru, October 2026.
</p>

<p align="center">
  <a href="#see-it">See it</a> ·
  <a href="#try-it-with-the-demo-logins">Try it</a> ·
  <a href="docs/testing/README.md">Test it</a> ·
  <a href="#run-it-locally">Run it</a> ·
  <a href="docs/product/features.md">Features</a> ·
  <a href="docs/README.md">Docs</a>
</p>

> **Current scope:** local implementation and acceptance are in progress. The
> target is Saturday, 10 October 2026, subject to the
> [current launch plan](docs/testing/launch-2026-10-10.md). Both cloud backends
> were verified empty and paused on 6 October. Local checks do not prove a
> deployed service, provider delivery or launch approval. See [Status](#status).

## What Luma.Green is

Luma.Green records how recyclable material moves from a household to a factory.
It connects pickup, weighing, material records, stock and business trade. The
kabadiwala pays the household directly in cash or UPI; Luma records that payment.
Business payments require a verified gateway. Payment-dependent actions stay
blocked while that integration is unavailable.

```
Household → Kabadiwala → Preprocessor → Recycler → Manufacturer
scrap       buys, weighs  sorts, bales   makes raw   buys recycled
from home   and sorts                   material    material
```

Material names and grades can change after sorting or processing. Lot custody,
quality decisions and transformation records are evidence. They do not create
stock, prove payment or issue carbon credits or statutory certificates.

| Role                   | Who they are                                                                 | Current access boundary                                                                          |
| ---------------------- | ---------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| **Household**          | A person with scrap to sell                                                  | Pickup and tracking flows; optional account security and inbox                                   |
| **Kabadiwala**         | A local scrap shop                                                           | Approved workspace: pickup, direct household payment record, prices and stock                    |
| **Preprocessor**       | A business that sorts and bales material, often at a yard                    | Approved workspace: material buying, stock, lot evidence and selling                             |
| **Recycler**           | A business that turns sorted material into raw material                      | Approved workspace: material buying, processing evidence and selling                             |
| **Manufacturer**       | A business that buys recycled material                                       | Approved workspace: inputs, records and permitted non-hazardous byproduct offers                 |
| **Saathi**             | A person who takes pickup, sorting or shift jobs                             | Own approved work and earnings records                                                           |
| **Other stakeholders** | Material generators, cities, CSR teams, lenders, auditors, unions and brands | Account request and status; approval alone grants no business workspace or private-report access |
| **Platform admin**     | The configured operator                                                      | Separate email/password and required authenticator; reviews applications and support             |

Normal accounts can use verified email/password or verified phone OTP. Phone-only
accounts remain passwordless. These are separate identities: the app does not
merge them automatically. Email users enter their current password to manage
an authenticator. A session starts only after all required verification and
second-factor checks succeed. Better Auth runs on Convex; it needs no separate
Better Auth service account.

Business access also requires a workspace membership. Owner, admin, member and
viewer are workspace roles, separate from the platform administrator. Owners
and workspace admins manage permitted team actions; viewers have read-only
access. Invitations and access revocation use the account workspace screens.
The interface has 33 registered languages, including Kannada and right-to-left
Arabic and Urdu. Translation review and browser fit checks remain separate.

## What's in the prototype

This heading is retained for older links. See the
[maintained user guide](docs/user-guide/README.md) for current instructions and
[features](docs/product/features.md) for the route inventory.

- **Public pickup and tracking:** `/sell` and `/t/{code}`. A household confirms
  its phone for booking. The kabadiwala weighs the material and pays directly.
  A receipt records the actual amounts; it is not a gateway payment.
- **Account security and teams:** `/account/security` and `/account/workspaces`.
  These screens are also available to households and applicants. Team access
  requires an accepted invitation and a current membership.
- **Stakeholder requests:** `/join/stakeholder`. A submitted or approved request
  does not open a trading workspace or grant private data access.
- **Approved businesses:** `/app/requests`, `/app/prices`, `/app/stock`,
  `/app/market`, `/app/sell`, `/app/trades` and `/app/lots`, as allowed by role.
  Lot evidence remains separate from stock and money. An accepted order does
  not prove payment. The UI blocks payment-dependent progress without the
  required gateway evidence.
- **Saathi work:** permitted jobs and own work records under `/app`.
- **Platform admin:** `/admin` for verification, prices and support. Its sign-in
  and recovery remain separate from normal signup and account changes.
- **Public information:** `/prices`, `/standards`, `/solar`, `/help`, `/join`,
  `/how-it-works`, `/participants` and `/contact`. Samples and estimates must
  be labelled; an unavailable price source does not become a live quote.

Cashfree Payment Gateway with Easy Split is selected. The implemented backend
slice is sandbox-only and does not advance live trades, stock or settlement.
Merchant/use-case approval, Easy Split enablement, vendor KYC and actual
payment, payout and refund proof are still required. See
[payments](docs/architecture/payments.md).

## See it

These are **historical prototype captures** with synthetic data, at phone
(390 × 844) and desktop (1440 × 900) sizes. The image paths and older screen
labels remain for reference. They do not prove current authentication,
permissions, provider payments or deployment. Open an image for full size.
Use the [maintained guide capture procedure](docs/user-guide/README.md) for new
evidence; the [historical screenshot notes](docs/testing/README.md#screenshots)
explain the old list.

<details open>
<summary><strong>Households and the public site</strong>: home, prices, sell, tracking, join, help, solar, standards</summary>

| Screen                          |                                            Phone                                             |                                             Desktop                                              |
| ------------------------------- | :------------------------------------------------------------------------------------------: | :----------------------------------------------------------------------------------------------: |
| **Home**<br>`/`                 |      <img src="docs/screenshots/home-phone.png" width="180" alt="Home page on a phone">      |      <img src="docs/screenshots/home-desktop.png" width="460" alt="Home page on a desktop">      |
| **Prices**<br>`/prices`         |    <img src="docs/screenshots/prices-phone.png" width="180" alt="Price board on a phone">    |    <img src="docs/screenshots/prices-desktop.png" width="460" alt="Price board on a desktop">    |
| **Sell**<br>`/sell`             |    <img src="docs/screenshots/sell-phone.png" width="180" alt="Selling scrap on a phone">    |    <img src="docs/screenshots/sell-desktop.png" width="460" alt="Selling scrap on a desktop">    |
| **Tracking**<br>`/t/priyademo1` | <img src="docs/screenshots/tracking-phone.png" width="180" alt="Pickup tracking on a phone"> | <img src="docs/screenshots/tracking-desktop.png" width="460" alt="Pickup tracking on a desktop"> |
| **Join**<br>`/join`             |       <img src="docs/screenshots/join-phone.png" width="180" alt="Joining on a phone">       |       <img src="docs/screenshots/join-desktop.png" width="460" alt="Joining on a desktop">       |
| **Help**<br>`/help`             |     <img src="docs/screenshots/help-phone.png" width="180" alt="Help centre on a phone">     |     <img src="docs/screenshots/help-desktop.png" width="460" alt="Help centre on a desktop">     |
| **Solar**<br>`/solar`           |  <img src="docs/screenshots/solar-phone.png" width="180" alt="Solar calculator on a phone">  |  <img src="docs/screenshots/solar-desktop.png" width="460" alt="Solar calculator on a desktop">  |
| **Standards**<br>`/standards`   |   <img src="docs/screenshots/standards-phone.png" width="180" alt="Standards on a phone">    |   <img src="docs/screenshots/standards-desktop.png" width="460" alt="Standards on a desktop">    |

</details>

<details>
<summary><strong>Kabadiwala</strong>: home, requests, weigh and pay, rate card</summary>

| Screen                                    |                                                   Phone                                                    |                                                    Desktop                                                     |
| ----------------------------------------- | :--------------------------------------------------------------------------------------------------------: | :------------------------------------------------------------------------------------------------------------: |
| **Home**<br>`/app`                        |    <img src="docs/screenshots/kabadiwala-home-phone.png" width="180" alt="Kabadiwala home on a phone">     |    <img src="docs/screenshots/kabadiwala-home-desktop.png" width="460" alt="Kabadiwala home on a desktop">     |
| **Requests**<br>`/app/requests`           |  <img src="docs/screenshots/kabadiwala-requests-phone.png" width="180" alt="Pickup requests on a phone">   |  <img src="docs/screenshots/kabadiwala-requests-desktop.png" width="460" alt="Pickup requests on a desktop">   |
| **Weigh and pay**<br>`/app/requests/{id}` | <img src="docs/screenshots/kabadiwala-weigh-and-pay-phone.png" width="180" alt="Weigh and pay on a phone"> | <img src="docs/screenshots/kabadiwala-weigh-and-pay-desktop.png" width="460" alt="Weigh and pay on a desktop"> |
| **Rate card**<br>`/app/prices`            |     <img src="docs/screenshots/kabadiwala-rate-card-phone.png" width="180" alt="Rate card on a phone">     |     <img src="docs/screenshots/kabadiwala-rate-card-desktop.png" width="460" alt="Rate card on a desktop">     |

</details>

<details>
<summary><strong>Preprocessor, recycler and manufacturer</strong>: market, trades, recycler home, compliance</summary>

| Screen                                            |                                                     Phone                                                      |                                                      Desktop                                                       |
| ------------------------------------------------- | :------------------------------------------------------------------------------------------------------------: | :----------------------------------------------------------------------------------------------------------------: |
| **Preprocessor: buy**<br>`/app/market`            |   <img src="docs/screenshots/yard-market-phone.png" width="180" alt="The preprocessor's market on a phone">    |   <img src="docs/screenshots/yard-market-desktop.png" width="460" alt="The preprocessor's market on a desktop">    |
| **Preprocessor: trades**<br>`/app/trades`         |   <img src="docs/screenshots/yard-trades-phone.png" width="180" alt="The preprocessor's trades on a phone">    |   <img src="docs/screenshots/yard-trades-desktop.png" width="460" alt="The preprocessor's trades on a desktop">    |
| **Recycler: home**<br>`/app`                      |        <img src="docs/screenshots/recycler-home-phone.png" width="180" alt="Recycler home on a phone">         |        <img src="docs/screenshots/recycler-home-desktop.png" width="460" alt="Recycler home on a desktop">         |
| **Manufacturer: compliance**<br>`/app/compliance` | <img src="docs/screenshots/manufacturer-compliance-phone.png" width="180" alt="Compliance and EPR on a phone"> | <img src="docs/screenshots/manufacturer-compliance-desktop.png" width="460" alt="Compliance and EPR on a desktop"> |

</details>

<details>
<summary><strong>Saathi</strong>: jobs</summary>

| Screen             |                                            Phone                                            |                                             Desktop                                             |
| ------------------ | :-----------------------------------------------------------------------------------------: | :---------------------------------------------------------------------------------------------: |
| **Jobs**<br>`/app` | <img src="docs/screenshots/saathi-home-phone.png" width="180" alt="Saathi jobs on a phone"> | <img src="docs/screenshots/saathi-home-desktop.png" width="460" alt="Saathi jobs on a desktop"> |

</details>

## Try it with the demo logins

This legacy heading is retained for existing links. Shared demo logins and
fixed codes are withdrawn. Use the
[disposable local acceptance setup](scripts/local-acceptance/README.md) and
[current launch plan](docs/testing/launch-2026-10-10.md).

The runner uses supported signup, verification and sign-in handlers against
an isolated local backend. Existing approved synthetic accounts may be reused
for their recorded test run. Keep passwords and challenge access in the
restricted annex or a password manager, outside Git and the shared guide.
Never put credentials, contact details or recovery material in screenshots.
The [historical test catalogue](docs/testing/README.md) retains useful cases,
but its sample people and records are not a current account roster.

## Run it locally

Use Node 24 (`.nvmrc`) and the pinned pnpm 11 version. A disconnected clone
builds with optional services absent. Preserve an existing `.env.local`.

```sh
corepack enable
pnpm install
```

For connected acceptance, follow [environment setup](docs/operations/environments.md)
and [local account preparation](scripts/local-acceptance/README.md). The current
run uses `http://localhost:3100`, anonymous local Convex at
`http://127.0.0.1:3210`, and HTTP actions at `http://127.0.0.1:3211`.
Reuse existing processes. A local frontend must not point to a cloud backend.
Keep both cloud deployments paused.

Development verification requires `AUTH_LOCAL_TEST_MODE=true`, loopback
`SITE_URL`, and the system loopback `CONVEX_SITE_URL`. The guarded private local
inbox keeps verification delivery on the machine. Keep live provider keys
absent; no local verification bypass is allowed in cloud development, preview
or production. Do not run the old whole-table demo seed or reset. Cleanup must
remove only the selected run's recorded data.

Normal hosted email verification, password recovery and invitations require
Resend and a verified sender. Live phone OTP requires MSG91 account and
DLT/template proof. Missing configuration must show an unavailable state.
Optional AI, telemetry and push have their own provider gates; see the
[launch checklist](docs/operations/launch-checklist.md) and
[observability setup](docs/operations/observability.md).

```sh
pnpm check          # lint, types and unit tests before push
pnpm test           # focused unit and component checks
pnpm e2e            # browser tests with their documented local setup
pnpm build          # frontend production build, not a backend deployment
```

## Enable OTP bot protection in production

Turnstile protection for all phone OTP sends and resends is implemented locally
and **off until configured and deployed**. Create a Cloudflare account, then an
**Invisible Turnstile** widget with the exact domains that serve the app. No DNS
or hosting migration is needed. The Turnstile free plan supports this setup.

| Setting                          | Where to add it                 | Value                                                                                   |
| -------------------------------- | ------------------------------- | --------------------------------------------------------------------------------------- |
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY` | Vercel frontend environment     | Public widget site key                                                                  |
| `TURNSTILE_SECRET_KEY`           | Matching Convex deployment only | Private widget secret                                                                   |
| `TURNSTILE_HOSTNAMES`            | Matching Convex deployment only | Exact domains separated by commas, such as `luma.green,www.luma.green` if both are used |
| `TURNSTILE_ENABLED`              | Matching Convex deployment only | Set to `true` only after the checks below                                               |

1. Publish a privacy notice that references Cloudflare's Turnstile Privacy
   Addendum. Use the disclosure and links in the setup guide.
2. Deploy the backend with enforcement off. Add its secret and hostname list.
   Add the public site key to Vercel and rebuild/deploy the frontend.
3. Rebuild native shells with the challenge-frame support. In staging, test
   real member/admin login, sends/resends and native devices. Mock tests do not
   prove that the provider works.
4. Set production `TURNSTILE_ENABLED=true`, then test a consented real phone
   login and confirm a request without a bot token is rejected before SMS work.
5. If rollout fails, explicitly set `TURNSTILE_ENABLED=false` to disable bot
   enforcement while investigating. Existing OTP limits and factors remain.

Never put the secret in a `NEXT_PUBLIC_*` variable, Git or chat. Site-key changes
require a frontend rebuild. Full instructions, test limits and privacy disclosure:
[Turnstile setup](docs/operations/turnstile.md).

For the complete dashboard steps and exact variables, use the
[Cloudflare activation checklist](docs/operations/cloudflare-setup.md).

## Enable R2 quality-file storage

The first R2 stage is implemented locally and off by default. It covers new
quality attachments; application and identity files still use Convex storage.
Activate R2 in your Cloudflare account, create a **private Standard bucket**, and
create an **Object Read & Write** credential scoped to that bucket.

Add `R2_ACCOUNT_ID`, `R2_BUCKET_NAME`, `R2_ACCESS_KEY_ID` and
`R2_SECRET_ACCESS_KEY` to the matching **Convex deployment**. Deploy the backend,
then set `R2_ENABLED=true` in staging and test upload/private download first.
No Vercel public key, bucket CORS or public bucket URL is needed. Keep public
`r2.dev` access disabled. Never put R2 credentials in Git or chat.

Set `R2_ENABLED=false` to stop new R2 writes. Keep the credentials configured
so existing R2 attachments remain readable. See the
[R2 setup and verification steps](docs/architecture/r2-storage-plan.md).

## Storage and organization backend

R2 needs account configuration. Organization and collaboration APIs are implemented
locally; new screens are deferred for a later page-by-page pass:

- [R2 storage](docs/architecture/r2-storage-plan.md): implemented quality-file
  stage, private buckets, permissions, activation, recovery and costs.
- [Organization backend contract](docs/architecture/organizations.md): company
  grouping, independent site permissions, verified-phone invitations, record
  tasks/comments and internal Luma team scope. Includes API limits and deferred
  screens, reminders and new-site workflows.
- [Broader organization roadmap](docs/product/organization-workspaces-plan.md).

Expo/mobile and Electron/desktop work are on hold. Current work targets the web
backend; UI redesign will proceed only when requested.

## Android, iOS, macOS and Windows

The native apps reuse the hosted operational screens and the same Convex backend.
`apps/mobile` contains the Expo / React Native shell for Android and iOS.
`apps/desktop` contains the Electron shell for macOS and Windows.
They include native navigation, offline recovery and update configuration.

```sh
pnpm apps:check
pnpm mobile:export  # JavaScript bundles, not APK/IPA installers
pnpm desktop:pack   # unsigned desktop app for the host platform
```

Routine hosted content updates need no new installer. Compatible mobile shell
updates use EAS; desktop binaries use signed update feeds. New mobile native
features still need signed store releases. See the [architecture](docs/architecture/native-apps.md),
[account and release checklist](docs/operations/app-releases.md), and
[local verification record](docs/delivery/apps-and-motion.md).

## Tech stack

| Layer     | Choice                                                                                                                                                                                                                                                                                           |
| --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| App       | Next.js 16 (App Router, Turbopack), React 19, TypeScript in strict mode                                                                                                                                                                                                                          |
| Interface | Tailwind CSS v4, shadcn/ui on Radix, lucide icons, Noto fonts; light/dark/system themes, mobile first                                                                                                                                                                                            |
| Apps      | Expo 57 / React Native for iOS and Android; Electron for macOS and Windows                                                                                                                                                                                                                       |
| Backend   | Convex: database, server functions, file storage and live queries (EU West)                                                                                                                                                                                                                      |
| Sign-in   | Better Auth on Convex: verified email/password or phone OTP; separate admin password and required authenticator                                                                                                                                                                                  |
| Languages | next-intl: 33 languages, English URLs, right to left for Urdu and Arabic                                                                                                                                                                                                                         |
| Forms     | React Hook Form and Zod; the server checks the same rules again                                                                                                                                                                                                                                  |
| Quality   | Vitest, Testing Library, convex-test, Playwright; type-aware ESLint, Prettier, commitlint, CodeRabbit                                                                                                                                                                                            |
| Hosting   | Vercel for the web app, Convex for the backend; pnpm 11                                                                                                                                                                                                                                          |
| Waiting   | MSG91 and optional AI endpoint: implementation ready for account setup and provider checks. PostHog, GA4 and Sentry are implemented but need configured projects and delivery checks. Maps use browser location. Cashfree sandbox backend only; live gateway approval and execution remain gated |

## Docs

| Where                                                              | What's in it                                                                               |
| ------------------------------------------------------------------ | ------------------------------------------------------------------------------------------ |
| [docs/README.md](docs/README.md)                                   | The index: the plan, and the reasons behind it. Start here                                 |
| [docs/product/features.md](docs/product/features.md)               | Every feature: what's built (with URLs), what's sample data, what's next                   |
| [docs/testing/README.md](docs/testing/README.md)                   | Historical A-to-Z cases; current acceptance is in the 10 October plan                      |
| [docs/product/vision.md](docs/product/vision.md)                   | What and why, starting with the vision; roles, flows, onboarding and pricing sit beside it |
| [docs/architecture/overview.md](docs/architecture/overview.md)     | How it's built, then URLs, frontend, sign-in, data model and AI estimation                 |
| [docs/decisions/README.md](docs/decisions/README.md)               | One record per architecture decision                                                       |
| [docs/operations/environments.md](docs/operations/environments.md) | How it's run: environments, services, backups, data protection, incidents                  |
| [docs/delivery/roadmap.md](docs/delivery/roadmap.md)               | Week by week to the pilot, and the pilot plan                                              |
| [AGENTS.md](AGENTS.md)                                             | How code is written here, for people and agents alike                                      |
| [CONTRIBUTING.md](CONTRIBUTING.md) · [SECURITY.md](SECURITY.md)    | From branch to merge · reporting a vulnerability                                           |

## Status

The current target is **Saturday, 10 October 2026**, conditional on release
evidence in the [launch plan](docs/testing/launch-2026-10-10.md) and
[launch checklist](docs/operations/launch-checklist.md). Read the
[handoff](docs/delivery/handoff.md) for the current candidate and check results.
This README is not a test report or a launch approval.

- Local auth, workspace roles, stakeholder requests, material evidence and the
  bounded Cashfree sandbox backend are under combined acceptance. Local tests
  and synthetic records do not prove provider delivery or production access.
- Both cloud backends were verified empty and paused on 6 October. A frontend
  page does not prove its backend is active. Backend release, frontend release
  and post-deployment checks must be recorded separately.
- The kabadiwala pays the household directly. B2B payment-dependent actions
  remain blocked until verified gateway integration. Simulated escrow is not
  payment evidence and cannot authorize trade or stock changes.
- Prices, factors and solar estimates are samples or estimates where labelled.
  Historic application documents and participant names are synthetic. Lot and
  compliance evidence does not mint credits or certify legal compliance.
- Resend delivery, MSG91/DLT approval, Cashfree marketplace approval and Easy
  Split enablement, vendor KYC, payout/refund proof, native releases and cloud
  deployment remain separate release gates.
- The 33-locale interface needs native review and current visual evidence.
  The maintained guide source, screenshots and Word document must match the
  reviewed candidate before publication.

## Contributing

Read [AGENTS.md](./AGENTS.md) first: it's the source of truth for how code is
written here, and the index of the playbooks in `.claude/skills/`. Then
[CONTRIBUTING.md](./CONTRIBUTING.md) for the branch-to-merge workflow. Every
pull request runs Lint, Format, Typecheck, Unit tests and Build, and E2E when
app code changes; red checks don't merge.

## License

UNLICENSED: all rights reserved.
