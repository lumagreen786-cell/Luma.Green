# Luma Green account and API setup checklist

Checked 28 October 2026. The web foundation is already live at
[luma.green](https://luma.green). This checklist enables the optional services
and closes the remaining account setup gates. It does not require another OTP
provider, another database or a new Vercel project.

**Start with the existing accounts.** Confirm the Vercel plan and Convex backup
plan. Create PostHog and Sentry projects, a Trigger.dev project and the required
Cloudflare resources. Set a spending limit for each usage service. We can then
install the settings and test each service separately. Keep a service off until
its test passes. No plan has been bought by this task.

## Plans to select

USD prices exclude tax, extra seats and usage. Prices were checked against the
linked official pages on 28 October. The account checkout sets the actual bill.

| Account or service                                                                  | Plan to start with                                             | Cost and owner action                                                                                                                                                                                                                                            |
| ----------------------------------------------------------------------------------- | -------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [Vercel](https://vercel.com/pricing)                                                | Pro for the commercial web platform                            | USD20/month base. Reuse the Luma team and existing project. The current team dashboard shows Hobby. Upgrade this existing team to Pro for commercial use.                                                                                                        |
| [Convex](https://www.convex.dev/pricing)                                            | Professional recommended for Production backups and logs       | USD25/developer/month. Reuse the existing project. Confirm daily backups and who can restore them. Starter can run the app; Professional is an operations recommendation.                                                                                        |
| [Trigger.dev](https://trigger.dev/pricing)                                          | Free initially                                                 | USD0; includes USD5 monthly credits, 20 concurrent runs and 10 schedules. The current worker fits. Hobby at USD10/month is optional for seven-day logs; Pro at USD50 is not needed now.                                                                          |
| [PostHog](https://posthog.com/pricing)                                              | Free product analytics                                         | First one million monthly events free. Keep the other capture products off.                                                                                                                                                                                      |
| [Sentry](https://sentry.io/pricing/)                                                | Free Developer for one person                                  | Team starts at USD26/month with annual billing and default prepaid data if team access is needed. Extra data and products cost more.                                                                                                                             |
| [Cloudflare R2](https://developers.cloudflare.com/r2/pricing/)                      | Standard usage billing                                         | First 10 GB-month Standard storage free, then USD0.015/GB-month; operations have separate allowances and charges. Internet egress is free. Confirm billing activation in the existing account.                                                                   |
| [Cloudflare Turnstile](https://developers.cloudflare.com/turnstile/plans/)          | Free                                                           | No paid Cloudflare plan is needed for this widget.                                                                                                                                                                                                               |
| [Google Geocoding](https://developers.google.com/maps/billing-and-pricing/overview) | Billing-enabled Google Cloud project                           | Usage billing, with quotas and billing alerts. No fixed Maps subscription is needed. Check the applicable India/global SKU in the billing account.                                                                                                               |
| [Resend](https://resend.com/pricing)                                                | Free initially                                                 | 3,000 emails/month, maximum 100/day. Pro is USD20/month for 50,000 emails if the daily limit is too small. Optional email invitations. Verified-phone invitations work without it.                                                                               |
| [GitHub](https://github.com/pricing)                                                | Current Free plan is sufficient for public-repository scanning | This repository is public. CodeQL and dependency review do not need a paid security add-on here. Free scans are now active. Saving main-branch protection needs owner email verification in the open browser tab. The command-line account has push access only. |
| [CodeRabbit](https://www.coderabbit.ai/pricing)                                     | Optional Essentials                                            | USD24/developer/month with annual billing; check the monthly checkout quote if preferred. Install its GitHub App on this repository only.                                                                                                                        |
| Existing OTP, Surepass and Cashfree                                                 | Keep the current vendor accounts                               | Confirm balance, subscribed products and merchant approval. Charges follow the existing contracts. No replacement provider is requested.                                                                                                                         |

**Recommended hosting base for one developer: USD45/month**
(Vercel20 + Convex25 + Trigger Free), before tax and usage. This is a plan
recommendation, not a claim about the current bill. PostHog, Sentry Developer,
Turnstile and initial Resend can start free. CodeRabbit and paid Sentry are
optional additions. Expo, Apple and Google Play purchases are deferred while
the app work is paused. No AWS account, paid IDE or second authentication
service is needed for this web release.

## How to supply settings

Use project invitations or enter keys directly in the provider settings. Do not
paste secret keys into chat, Word files, screenshots, GitHub issues or commits.
The public checklist contains setting names only.

Operational keys go in **Convex Production environment settings**. Public web
settings and approved source-map build settings go in **Vercel Production**.
Provider acceptance uses a controlled flag-on test window. Leave the service
off if that test fails; a disabled flag cannot prove provider execution.
Local development settings do not configure Production. Public web changes need
a new Production build. Do not enable Vercel Preview deployments.

A private worksheet is available on this Mac at
`/Users/syedabdulmuqeeth/.codex/private-artifacts/luma-provider-setup-2026-10-28/provider-inputs.env`.
It has restricted file permissions. Most values are blank. A new Web Push key
pair is already generated there. It has not been installed or enabled. This is
an operator worksheet, not a file to import into one service: settings have
different owners below. Keep it private.

For every new project, supply the owner email, project name, selected region,
alert recipient and approved usage budget. Keys alone cannot settle retention,
business terms or provider approval.

## Existing access and keys to retain

- [ ] **Vercel:** use the existing Luma team and `luma-green` project. Browser
      access and main-branch Production deployment have worked. The team currently
      shows Hobby. Upgrade it to Pro for commercial use. No personal Vercel
      API token is needed for this setup. Confirm billing and project access.
- [ ] **Convex:** use the existing project and Production deployment
      `astute-peccary-795` in Sydney. Current operator deployment access works.
      Confirm the backup plan, recovery contact and protected off-site copy. No new
      database or replacement authentication secret is needed.
- [ ] **OS Digital ENVRIN OTP:** Production already has `OSDIGITAL_API_KEY`,
      `OSDIGITAL_ENTITY_ID`, `OSDIGITAL_SENDER_ID`, `OSDIGITAL_TEMPLATE_ID` and
      `OSDIGITAL_OTP_MESSAGE`. Confirm approved sender/template and funded balance.
      Do not send these values again. Real delivery still needs a controlled test.
- [ ] **Surepass:** Production already has `SUREPASS_API_TOKEN` and
      `SUREPASS_ENABLED=true`. Confirm GSTIN by PAN and GSTIN Advanced subscriptions
      and balance. Shared quota remains 20 paid attempts per verified account per
      India day. Development paid calls remain off. No new catalogue API is approved.
- [x] **GitHub free security checks:** the existing owner browser session enabled
      Dependency graph, Dependabot vulnerability and malware alerts, and security
      update PRs. `LUMA_DEPENDENCY_REVIEW_ENABLED=true` is installed. A real hosted
      dependency-review run passed after activation. No new API key is needed.
- [ ] **GitHub owner verification:** the main-branch rule is prepared with the
      five required checks, PRs, zero approvals for the solo team, conversation
      resolution, linear history and no bypass. GitHub requires the owner to
      complete **Verify via email** before it saves. The rule is not yet active.
      Finish that step in the open GitHub tab, then verify the saved rule using
      [GitHub owner settings](github-owner-settings.md). Do not send a password
      or unrestricted personal token.

CodeQL passed its hosted 103-rule scan with zero reported results on the tested
revision. Dependency review initially stopped because Dependency graph was off.
The graph is now enabled and its repeat passed. Its activation variable is
retained so future environments can still wait for account setup. The current
passed check is separate from the earlier skipped and failed attempts.

Installed names were checked without printing secret values. Presence does not
prove provider delivery, balance or approval. The new Convex Production has no
Cashfree, R2, Trigger, Google, Resend, Turnstile or Web Push setting names at this
check. Vercel has only the three Production public site and Convex URL
settings, with no shared variables linked. Telemetry and Turnstile public
settings are not installed there yet.

## Analytics and error reports

### PostHog

- [ ] Create or select a project on the Free plan. Supply its region and actual
      ingestion host.
- [ ] Vercel public settings: `NEXT_PUBLIC_POSTHOG_KEY` and
      `NEXT_PUBLIC_POSTHOG_HOST`. Use the project ingestion key, not a personal API key.
- [ ] After configuration, set `NEXT_PUBLIC_TELEMETRY_ENABLED=true` in Vercel.
      The same flag also controls the optional Sentry and GA integrations.
- [ ] We test visitor consent, permitted public-page events and consent removal.
      Replay, autocapture, identity profiles and private-form capture remain off.

### Sentry

- [ ] Create a project and supply `NEXT_PUBLIC_SENTRY_DSN` to Vercel. The DSN is
      browser-visible; it is not an account administration token.
- [ ] For readable source maps, also supply `SENTRY_ORG`, `SENTRY_PROJECT` and a
      narrowly scoped `SENTRY_AUTH_TOKEN` as private Vercel build settings. The token
      is optional for basic error capture. Never prefix it with `NEXT_PUBLIC_`.
- [ ] Select alert recipients, retention and a spend cap. We test a scrubbed
      error event. Replay, tracing and profiling stay off. This does not add Convex
      or native crash monitoring; use Convex logs and alerts separately.

### Google Analytics optional

- [ ] Only if wanted in addition to PostHog: create a GA4 web stream and supply
      `NEXT_PUBLIC_GA_MEASUREMENT_ID` in Vercel. No API secret, service account or
      Tag Manager container is needed.
- [ ] Disable Enhanced Measurement, automatic/history page views, Google Signals
      and advertising features. The app sends consented public-page views itself.

See [observability](observability.md) for the capture contract and acceptance steps.

## Cloudflare storage and bot checks

### Private R2 bucket

- [ ] Create a private Standard bucket in the existing Cloudflare account.
- [ ] Convex settings: `R2_ACCOUNT_ID`, `R2_BUCKET_NAME`, `R2_ACCESS_KEY_ID` and
      `R2_SECRET_ACCESS_KEY`. Create bucket-scoped S3 credentials with Object Read
      and Write permissions. Do not supply a global Cloudflare API key.
- [ ] We test upload, allowed download and denied access before setting
      `R2_ENABLED=true`. No public bucket URL, public `r2.dev` access or browser key
      is needed. Server-relayed uploads need no browser CORS change.
- [ ] This integration covers new quality attachments. Application and identity
      documents retain their existing private Convex storage path.

### Turnstile

- [ ] Create an Invisible widget, allow `luma.green` and only other explicitly
      approved hostnames. The Free plan is sufficient.
- [ ] Vercel public setting: `NEXT_PUBLIC_TURNSTILE_SITE_KEY`.
- [ ] Convex settings: `TURNSTILE_SECRET_KEY` and `TURNSTILE_HOSTNAMES`.
- [ ] Install both sides, then test success, failure and missing tokens before
      setting `TURNSTILE_ENABLED=true`. Do not enforce an unconfigured widget.

## Background jobs and address lookup

### Trigger dev

- [ ] Create a Free project. Supply `TRIGGER_PROJECT_REF` to the worker deployment
      configuration and permit CLI deployment through the account login.
- [ ] Convex secret: `TRIGGER_SECRET_KEY` for this project's Production environment.
- [ ] Trigger runtime setting: `TRIGGER_CONVEX_URL` for the actual Sydney
      Production deployment. Do not give Trigger a Convex administrator key.
- [ ] We deploy and test `private-stock-report`, its permission checks and failed
      result handling before setting `TRIGGER_JOBS_ENABLED=true` in Convex. Current
      worker limits are 60 seconds, concurrency two and three attempts. No new
      recurring schedule or provider retry is added automatically.

### Google reverse geocoding

- [ ] Enable billing and the Geocoding API in a Google Cloud project. Create a
      server API key restricted to that API and approved server IP restrictions.
- [ ] Convex secret: `GOOGLE_GEOCODING_API_KEY`. No browser Maps key or mobile
      Maps SDK key is required for the current feature.
- [ ] Set quotas and billing alerts. We verify key restrictions against the
      actual Sydney Convex outbound ranges, then test lookup and unavailable states
      before setting `GOOGLE_GEOCODING_ENABLED=true`.
- [ ] Keep `GOOGLE_GEOCODING_ADDRESS_SAVE_ENABLED=false` until the approved Google
      terms permit this stored-address use. A key alone is not permission for
      indefinite storage. Manual address entry remains available.

The current [geocoding runbook](geocoding.md) and
[Convex networking reference](https://docs.convex.dev/production/networking)
own the outbound IP list. Recheck it at activation; shared regional IP ranges
are not proof of application identity.

## Email and browser notifications

### Optional Resend email invitations

Phone-based workspace invitations already work without Resend. For email:

- [ ] Create or select the sending account. Verify the chosen sending domain
      using its DNS records. Confirm a working sender address.
- [ ] Convex settings: scoped sending `RESEND_API_KEY` and `AUTH_FROM_EMAIL`.
      `SITE_URL` is already installed; retain its verified Production value.
- [ ] We test invitation receipt and its normal acceptance path. Provider
      acceptance alone is not inbox delivery. This does not enable email/password
      login or password recovery, which are disabled by the current auth policy.

### Browser push

- [ ] Supply a working operations contact for `WEB_PUSH_SUBJECT` using a
      `mailto:` or HTTPS value. No Firebase account or paid push vendor is needed.
- [ ] We install the already-generated `WEB_PUSH_PUBLIC_KEY` and
      `WEB_PUSH_PRIVATE_KEY` from the private worksheet in Convex.
- [ ] We test explicit device permission, generic notification text, delivery,
      revocation and sign-out before setting `WEB_PUSH_ENABLED=true`.

### Optional MSG91 notifications

- [ ] Keep OS Digital as primary OTP. Only if MSG91 fallback/status messages are
      wanted, supply existing `MSG91_AUTH_KEY`. OTP fallback also needs
      `MSG91_OTP_TEMPLATE_ID`. Status messages instead need approved Flow mappings
      in `MSG91_NOTIFICATION_TEMPLATES`.
- [ ] Use `SMS_NOTIFICATION_BASE_URL=https://luma.green`. Set
      `MSG91_NOTIFICATION_ENGLISH_FALLBACK` only for approved fallback templates.
      Sender, DLT and per-locale template approvals are vendor account work.
      The account inbox works without paid SMS.

## Cashfree business payments

- [ ] Reuse the existing merchant account. Confirm KYC, recycling marketplace
      use, Payment Gateway and Easy Split approval. Confirm each seller vendor is
      active. API credentials alone cannot grant these permissions.
- [ ] Convex sandbox keys: `CASHFREE_SANDBOX_CLIENT_ID` and
      `CASHFREE_SANDBOX_CLIENT_SECRET`.
- [ ] Convex live keys: `CASHFREE_LIVE_CLIENT_ID` and
      `CASHFREE_LIVE_CLIENT_SECRET`. Keep them separate from sandbox keys.
- [ ] Configure approved checkout origins and the matching Convex HTTP webhooks
      `/payments/cashfree/sandbox` and `/payments/cashfree/live`. There is no extra
      invented webhook secret; verification uses the matching client secret.
- [ ] Confirm the fee payer, refund funder, refund authority and settlement terms.
      Save the immutable policy through the normal admin authenticator flow.
- [ ] We test sandbox acceptance first using `CASHFREE_MODE=sandbox` and
      `CASHFREE_SANDBOX_CHECKOUT_ENABLED`. Sandbox cannot move real inventory.
- [ ] Live activation needs the approved saved policy version in
      `CASHFREE_LIVE_POLICY_VERSION`, `CASHFREE_MODE=live` and
      `CASHFREE_LIVE_CHECKOUT_ENABLED=true`, plus provider/vendor acceptance.
      Keep live checkout off until these checks pass. A real-money test needs an
      agreed amount and owner authorization; this checklist does not spend funds.

See [payments](../architecture/payments.md) for the full acceptance record.

## Optional later accounts and business inputs

- [ ] **Photo assistance:** only if wanted, supply a budget-capped
      `OPENROUTER_API_KEY`, an approved vision `OPENROUTER_MODEL` and
      `PHOTO_ESTIMATE_DAILY_LIMIT` to Convex. `PHOTO_ESTIMATE_PROVIDER=openrouter`
      selects it. Review model retention and licensing. Manual entry works without it.
      The 29 October paper workflow adds separate reviewed transcription evidence.
      It does not import stock or issue official documents. Assisted extraction
      requires `PAPER_TRANSCRIPTION_ENABLED=true` and an explicit
      `PAPER_TRANSCRIPTION_DAILY_LIMIT` from 1 to 100 in Convex, as well as the
      approved OpenRouter key/model and per-image user consent. It has additional
      three/account/day and ten/organization/day caps and never retries a paid
      extraction automatically. Keep it off until privacy, budget and real-paper
      accuracy acceptance pass. Manual paper review works without the model.
      Originals use private, atomic database chunks, capped at 100 MiB raw source
      bytes and 100 retained sources per organization including confirmed
      evidence; metadata/index overhead is additional database storage. These
      are separate from the existing R2 quality-attachment scope.
- [ ] **CodeRabbit:** install the GitHub App on this repository and select a
      plan. No app API key is required. Review a real PR before counting it as active.
- [ ] **Search ownership:** Google Search Console and Bing can use DNS
      verification. Optional metadata settings are
      `NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION` and `NEXT_PUBLIC_BING_SITE_VERIFICATION`.
      These are verification values, not API keys. Verification does not prove indexing.
- [ ] **Public data:** leave `PUBLIC_DATA_ENABLED=false` until actual feeds,
      contact information and dataset licences are confirmed. Weather can use
      `MET_NORWAY_USER_AGENT` with a working contact. Optional air data needs
      `DATA_GOV_IN_API_KEY` and `DATA_GOV_IN_AIR_RESOURCE_ID`. Production news needs
      appropriate rights plus `INDUSTRY_NEWS_API_KEY`, `INDUSTRY_NEWS_DAILY_LIMIT`
      and explicit `INDUSTRY_NEWS_ENABLED`. These are not launch requirements.
- [ ] **Operations:** choose the alert recipient, recovery owner, protected
      off-site backup destination and recovery-key custodian. Then verify a cloud
      backup schedule and a restore on a separate approved cloud target.
- [ ] **Business acceptance:** provide real specialist permit/process approvals,
      real operating recipes and recipients, approved prices and payment terms when
      those services launch. We will not seed invented permits, payments or official
      credits. These are business evidence gaps, not missing API keys.

## Work completed without new keys

The foundation code, reference seeds and the reviewed platform documents are
already shipped. The key-free follow-up passed 343 local suites with 2,850 tests,
plus the hosted checks, and merged through PR11 at commit `739d1d4`. This follow-up adds three integrated offline acceptance tests
for booking assignment and expiry, delivered-cost ranking and recurring
institution requests with revocable aggregate sharing. It also proves a local
workload with 50 verified phone sessions, 100 photo bookings, 50 concurrent
authenticated readers and 50 denied cross-person reads. A real local restore
preserved 2,584 data rows, original IDs, 104 private files and existing sessions.
All 28 canonical test participants also passed the local Production-build browser
check with their expected roles, saved form reloads and private-record denials.
That is local synthetic-data evidence, not live-provider or real-user acceptance.

See [local workload and restore evidence](../delivery/local-operations-drill-2026-10-28.md)
and [remaining key-free acceptance](../delivery/key-free-acceptance-2026-10-28.md).
Cloud recovery, provider delivery and merchant acceptance remain separate tests.
This checklist records inputs; it does not claim that each optional account has
already been created or activated.
