# Analytics and error monitoring

Status: implementation and setup guide, 18 November 2026. No provider account,
production receipt or approved privacy notice is confirmed by this document.
This replaces the earlier deferral in [ADR 0012](../decisions/0012-pilot-analytics-in-convex.md);
[ADR 0016](../decisions/0016-optional-analytics-and-error-monitoring.md) records the prior opt-in design. The owner superseded its required-tap rule on 18 November 2026 with automatic cookieless public counts and an optional opt-out.

## Enable only the services you need

All services are optional. An empty deployment sends no analytics and starts
no Sentry transport. Set `NEXT_PUBLIC_TELEMETRY_ENABLED=true` in the intended
Next.js deployment and add the settings for the chosen services below. Public
settings are injected at build time: rebuild and redeploy after changing them.
Keep the flag empty or `false` in ordinary local and preview builds. The flag
is independent of `VERCEL_ENV`; it is an explicit operator decision.

| Service          | Public configuration                                  | Private build configuration                                                |
| ---------------- | ----------------------------------------------------- | -------------------------------------------------------------------------- |
| PostHog          | `NEXT_PUBLIC_POSTHOG_KEY`, `NEXT_PUBLIC_POSTHOG_HOST` | None                                                                       |
| Vercel Analytics | `NEXT_PUBLIC_VERCEL_ANALYTICS_ENABLED=true`           | None                                                                       |
| Sentry           | `NEXT_PUBLIC_SENTRY_DSN`                              | `SENTRY_AUTH_TOKEN`, `SENTRY_ORG`, `SENTRY_PROJECT` for source-map uploads |

The analytics project key, measurement ID and Sentry DSN are browser-visible
settings. Do not put a PostHog personal API key or Sentry auth token in a
`NEXT_PUBLIC_*` variable. Set provider budgets, quotas, retention and alerts
before enabling them. No paid plan is required by application code; account
limits and commercial terms must be checked with each provider.

## Cookieless public analytics

PostHog and configured Vercel public counts start without a required tap or initial
banner. A compact **Analytics settings** control opens the optional settings.
**Keep analytics off** stops capture and reloads to remove vendor listeners.
Saved denials under `luma.analytics.v1` remain honored; invalid saved choices,
failed reads and failed writes keep analytics off. An absent choice permits
cookieless counts without writing a consent grant. Clearing site data removes
the opt-out and restores the default. Choices are per browser origin, not account.
Google Analytics is not loaded by this flow, even with a legacy measurement ID
or saved grant. A future cookie-based integration needs its own explicit consent
and privacy review; the cookieless setting cannot enable it.

Only these pages, including their locale variants, send manual page views:
`/`, `/business`, `/business/collectors`, `/how-it-works`, `/participants`, `/prices`, `/standards`, `/solar`, `/help`.
New pages are excluded unless deliberately added to the allowlist. Login,
onboarding, `/sell`, contact forms, booking tracking, the business app and admin
are excluded. Moving from a measured page to an excluded route stops page
capture; returning resumes it only while the visitor has not opted out.

PostHog app properties are the normalized public path and locale. The page URL sent is
the origin plus that allowlisted path. Query strings, fragments, referral URLs,
DOM text, real page titles, form values, customer IDs and booking tokens are not
included by the app's event contract. Google Analytics is not activated.
Providers may still process browser/network metadata and IP addresses at their
network boundary. Do not describe this as fully anonymous or zero-data traffic.

### PostHog account

1. Create or select a project and confirm its region. Copy its project API key
   and ingestion host to the public values above. The default host is
   `https://eu.i.posthog.com`; use the host for the actual project.
2. Keep session replay, autocapture, surveys, feature flags, exception capture,
   performance capture and heatmaps disabled. No PostHog browser SDK is loaded;
   the runtime sends only manual `$pageview` events to the documented capture API.
3. Review retention and ingestion limits. There is no user identification or
   person profile creation. The runtime keeps its random identifier in memory;
   it does not persist that identity across reloads. Returning-user and
   cross-device analysis are therefore outside this implementation.
4. Verify the first automatic public event in the project's live events view. Confirm
   only the allowed properties appear and no events arrive from private pages.

### Legacy Google Analytics configuration

Google Analytics delivery was removed from the shared runtime. Existing settings
are accepted for configuration compatibility but do not load scripts or events.
Do not add a Google tag or Tag Manager to bypass the cookieless setting.

## Sentry errors

Sentry uses the operator flag and DSN. Its error reporting is **independent of
the visitor's analytics choice**, including on private pages. Describe this
separately in the platform's privacy information before enabling it.

1. Create a Sentry Next.js project in the intended organization and region.
   Set its DSN in the matching deployment and enable the telemetry flag.
2. For source maps, set `SENTRY_AUTH_TOKEN`, `SENTRY_ORG` and `SENTRY_PROJECT`
   only in the trusted build environment. Use the minimum upload permissions.
   Upload is disabled without the token; compiled stack traces may be harder to
   read. The build removes maps after upload. Build-plugin telemetry is off.
3. Set provider quotas, retention, access controls and notifications. Review
   provider-side data scrubbing and disable IP storage. A server-side scrubber
   cannot remove the network address used to connect to an ingestion endpoint.
4. Use a controlled test error containing no real user data. Confirm its
   arrival, source-map resolution if configured, and stripped payload before
   accepting the integration. Check browser and Next.js server errors separately.

Coverage includes browser errors, the global React error boundary and Next.js
request errors in its Node/edge runtimes. It does **not** instrument Convex
functions, React Native shell crashes or Electron main-process crashes. Use
those platforms' existing logs and device diagnostics.

Only exception events are retained. Allowed fields include error class,
sanitized source locations, event time/ID and release/environment metadata.
Error message values become `Error details removed for privacy`. User data,
request headers/body/URLs, tags, extra context, breadcrumbs, source contents and
unapproved event fields are removed. Unknown exception classes are normalized.
Tracing, profiling, session replay, SDK logs, session tracking and client reports
are disabled. This intentionally reduces diagnostic detail and can group
unrelated failures together; never restore raw payloads to fix grouping.

## Verification and shutoff

1. Run the analytics, monitoring and SEO tests, then the required `pnpm check`.
2. In a browser with fresh site storage, check no analytics network calls before
   choosing, after declining, or on private routes. Test English and Arabic.
3. Allow analytics and navigate between measured pages. Inspect outgoing
   payloads for query tokens, referral URLs, user details and duplicates.
4. Open a private workflow and confirm capture stops. Withdraw permission in
   Analytics settings and confirm it remains off after reload and in another
   same-origin tab. Test unavailable local storage.
5. Check controlled Sentry errors with analytics both allowed and denied.
   Inspect the actual received event, not only a successful network response.
6. Turn the operator flag off, rebuild and redeploy. Confirm all three runtime
   integrations remain off even if their keys are still set. Clear a service's
   key and rebuild to disable only that service.

These steps distinguish mock/local tests, browser requests and provider receipt.
None implies production deployment or complete privacy compliance. Keep the
Convex pilot report and audit records as the source of operational totals.
Search ownership and sitemap submission have a separate [setup guide](seo.md).

## Official references

- [PostHog privacy controls](https://posthog.com/docs/privacy)
- [PostHog anonymous and identified events](https://posthog.com/docs/data/anonymous-vs-identified-events)
- [GA4 manual page views](https://developers.google.com/analytics/devguides/collection/ga4/views)
- [GA4 Enhanced Measurement](https://support.google.com/analytics/answer/9216061)
- [Sentry Next.js configuration](https://docs.sentry.io/platforms/javascript/guides/nextjs/configuration/options/)
- [Sentry data scrubbing](https://docs.sentry.io/security-legal-pii/scrubbing/)

## Foundation setup record — 27 October 2026

The owner requested monitoring from the start. Account creation and configuration
will follow later. This section is a setup plan, not a record of live acceptance.
No account, paid quota, alert destination or production key was added in this work.
The app stays off until the operator sets the existing flag and service keys.

Both browser entry files now use `src/instrumentation-client.ts` and
`src/lib/monitoring.ts`. The old root entry had a second Sentry setup with a DSN-only
gate and trace sampling. The installed Next.js webpack alias checks `src/` first;
this finding does not prove that the old setup ran in Production. The root entry
now imports the shared entry, so both paths enforce the same controls. There is
no router tracing hook. SDK-provided release/environment metadata may survive the
scrubber; this work does not add user, workspace or record tags. Verify that the
received release matches the deployed commit when account setup is complete.

### Setup sequence and owners

The platform owner selects accounts, regions, retention and spend limits. The
release operator configures keys and checks received events. The operator records
the result below without copying keys or user data into this file.

1. Select a PostHog project and Sentry project with restricted team access and
   MFA. Record their region and the owner who can disable ingestion.
2. Review the privacy notice. State that public counts start automatically without
   analytics cookies, offer an opt-out, and that error reporting is separate.
3. Set the provider controls in the account instructions above. Do not enable
   extra products offered during setup. Google Analytics is inactive; do not add
   a second analytics script outside the shared runtime.
4. Set only the existing public build settings in Vercel Production. Keep the
   source-map token private to the trusted build. Keep all operational provider
   secrets on Convex. Rebuild through the normal checked release process.
5. Complete the provider matrix below with a fresh browser. Use approved test
   data. Do not trigger paid identity, OTP, payment or AI services as a probe.
6. Record the deployed commit, date, region, retained field list, retention,
   chosen spend cap and alert owner. Mark a check accepted only after reading
   the received provider event. A request status alone is insufficient.

### Event catalogue and dashboards

These are the only implemented analytics events. Consent and the path allowlist
apply at send time, including after a delayed SDK import.

| Event           | Provider           | Permitted app properties                                                                                            | Intended chart                                                | Limit                                                      |
| --------------- | ------------------ | ------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------- | ---------------------------------------------------------- |
| `$pageview`     | PostHog            | Normalized public `page`, supported `locale`; transport key and random in-memory distinct ID; sanitized origin/path | Daily page views, public path share, language share           | No account identity; reloads start a new identifier        |
| Manual pageview | Vercel, if enabled | Canonical public URL; guarded first-party referrer and vendor network metadata                                      | Public page counts                                            | Re-audit hosted attribution guard before release           |
| Exception event | Sentry             | Error class, sanitized code location, event time/ID, release/environment metadata                                   | New errors and regressions by release; affected code location | Error values, request data and private context are removed |

Create one small public-traffic dashboard in PostHog: page views over time, path
and language. Label it **public traffic with optional opt-out**. Do not label distinct IDs as
customers. Do not report public page sequences as signup or pickup conversion:
login, join, booking, account and operational routes are excluded. The proposed
public action and private funnel contracts are on the
[enhancement review list](../product/api-ux-enhancement-review-2026-10-27.md).
They are not implemented or approved by this setup work.

Create a Sentry issues view for the Production release. Keep error class and
sanitized stack location visible. The scrubber can group distinct causes into
one issue; investigate through authorized application records and platform logs.
Do not restore raw error text or request bodies to improve grouping.

### Platform dashboards and suggested alerts

These settings are proposed operator tasks. No alert rule or destination was
created. A dashboard feature may require a paid plan. Check account entitlement
before making it a launch dependency.

| Owner                  | Inspect first                                                                          | Proposed initial alert                                                          | Response                                                                                                |
| ---------------------- | -------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| Vercel                 | Production deployment failures, request errors, latency and usage                      | Failed Production deployment; sustained server errors over five minutes         | Check deployment and server logs; roll back the frontend only when backend compatibility is established |
| Convex                 | Deployment health, failed functions, latency, transaction conflicts and scheduled jobs | Repeated failed critical function/job, or growing job backlog                   | Filter dashboard logs by function/status; inspect authorized records and audit events                   |
| Trigger.dev            | Run state, retries, duration, queues and usage                                         | Terminal failed or timed-out report job; queue delay exceeds its service target | Inspect sanitized job logs; verify idempotency before an operator retry                                 |
| Sentry                 | New issue or regression for the current release                                        | First new Production issue, then rate-limit duplicate notifications             | Read the scrubbed event; reproduce with approved test data                                              |
| Provider billing pages | Usage and current caps                                                                 | Notify at 50% and 80% of the selected cap where supported                       | Check traffic and disable the optional service before increasing spend                                  |
| GitHub                 | Dependabot/security PRs and required checks                                            | Repository-native security notifications                                        | Review the patch, run required checks and merge through a checked PR                                    |

Use one owner-approved alert destination. Avoid copying private payloads into
email or chat alerts. Public third-party status pages help distinguish a vendor
incident from an app defect; they do not prove that this app is healthy.
Vercel [Observability](https://vercel.com/docs/observability),
Convex [dashboard logs](https://docs.convex.dev/dashboard/deployments/logs) and
Trigger.dev [runs](https://trigger.dev/docs/runs) describe their own coverage.
Convex [log streams](https://docs.convex.dev/production/integrations/log-streams)
can export more information than our Sentry scrubber permits. Do not connect
that export to PostHog or another log store without a separate field review.
The existing Dependabot configuration covers grouped package and Actions
updates; dependency checks do not prove runtime health.

### Retention and spend plan

Start with no paid subscription or card change. The published
[PostHog pricing page](https://posthog.com/pricing) shows one million analytics
events per month in its free allowance. The published
[Sentry pricing page](https://sentry.io/pricing/) shows a $0 Developer plan for
one user and Team from $26/month when billed annually with default prepaid data.
These are public prices checked on 27 October 2026, in USD before applicable
taxes; they are not account-specific quotes. Recheck at setup. Free replay or
trace allowances are not permission to enable these products.

Proposed pilot limits: at most 100,000 analytics events and 5,000 scrubbed errors
per month, with alerts before each cap. These are operating targets, not
implemented app counters or guaranteed provider hard stops. Set enforceable
provider caps when available. If the selected plan cannot enforce a hard stop,
keep paid overage disabled or select a lower-risk plan before activation.

Proposed retention: 30 days for event-level analytics and errors, and the shortest
useful platform-log retention. Confirm that each plan supports the selected
period. If it cannot, record its actual period and obtain owner acceptance before
activation. Limit exports and access. Deleting analytics does not delete the
financial, stock or audit records which Convex owns. Neither browser consent
withdrawal nor changing a key deletes historical provider data.

### Provider acceptance matrix

All live checks below are **pending account setup**. Local tests prove only the
configured contract and mocked SDK calls.

| Check                                                | Required evidence                                                           | Current status                                       |
| ---------------------------------------------------- | --------------------------------------------------------------------------- | ---------------------------------------------------- |
| Empty flag/keys                                      | No initialized SDK transport in a fresh build                               | Covered by local tests; live pending                 |
| DSN only, operator flag off                          | No Sentry initialization from either entry file                             | Covered by local tests; live pending                 |
| Saved opt-out / storage unavailable                  | No analytics load/event                                                     | Covered by local tests; live pending                 |
| Automatic `/ar/prices` with synthetic query/fragment | PostHog safe page view; Vercel rejects query/fragment                       | Covered by local tests; live pending                 |
| Navigate into login/join/booking/app/admin           | No analytics event from excluded routes                                     | Covered by local tests; live pending                 |
| Withdraw, reload and change another same-origin tab  | Capture stays off; no stale delayed load sends events                       | Local contract tests exist; browser/provider pending |
| Controlled browser error and Next.js request error   | Received scrubbed exception, no message/request/body/user/breadcrumb fields | Local scrubber tests pass; receiver pending          |
| Error with analytics declined                        | Same error-only behavior, independent of analytics consent                  | Local gates are separate; receiver pending           |
| Source maps and release                              | Safe test error maps to this deployed code; release matches commit          | Build/account pending                                |
| Account controls                                     | Access, region, privacy settings, actual retention, cap and alert verified  | Pending                                              |
| Shutoff                                              | Flag off plus rebuild stops all three integrations with keys retained       | Local gates tested; hosted pending                   |

### Incident and shutoff steps

For a suspected leak, turn off the operator flag, rebuild and release through the
approved Production route. Disable ingestion at the provider while that build is
pending if the provider supports it. Restrict access to the affected events and
follow the provider's deletion controls. Do not paste the suspected payload into
an issue or chat. Record only the affected service, time range, release and safe
incident reference. Investigate before re-enabling.

For ordinary failures, start with the owning platform dashboard. Record the
failure class and time, check recent changes, and reproduce with approved test
data. Check audit records before retrying a job that can affect records or money.
Use a service-specific key removal and rebuild when only one optional service
must stop. Validate shutoff from a fresh browser and the receiving provider.

Current primary references for the SDK controls are
[PostHog JavaScript configuration](https://posthog.com/docs/libraries/js/config),
[Sentry Next.js options](https://docs.sentry.io/platforms/javascript/guides/nextjs/configuration/options/)
and [Sentry filtering](https://docs.sentry.io/platforms/javascript/guides/nextjs/configuration/filtering/).
SDK upgrades must retain the privacy regression tests; current provider defaults
can differ from the installed version.

## Public service status — 16 November 2026

`/status` is public and refreshes every 30 seconds. The read-only Convex HTTP
endpoint `/health` checks database access and returns an aggregate SMS result.
It does not call the SMS provider. `accepted` means the provider accepted a
recent request, not that a handset received it. After 15 minutes the result is
`unknown`. Missing settings, unconfirmed acceptance and an unreachable API are
separate states. Unconfirmed acceptance can mean rejection, timeout or an unreadable
response; it does not prove explicit rejection or non-delivery. The page stays
usable during a backend outage if the web host works.
A complete web-host outage also prevents this page loading; an external uptime
monitor can probe the independent Convex endpoint. No external monitor or alert
subscription is activated by this change.

`serviceHealth` stores one aggregate SMS observation: service name, acceptance
flag and time. It stores no phone, OTP, provider body or message ID. The internal
SMS action records the result; the sign-in endpoint waits for provider
acceptance and returns 503 on failure. Existing request limits still apply;
ambiguous sends are never retried automatically.

PostHog continues to use the existing public page view with an opt-out. Polls
and provider results add no analytics event and no new Sentry capture: public
poll failures are expected availability states, while existing sanitized error
monitoring remains in place. Never send provider payloads or SMS arguments to
telemetry. Native shells use the same hosted page; no native module, permission
or release change is needed.

### Afterlife public/business split (18 November 2026)

The homepage and business landing reuse automatic public-page analytics with an opt-out and
sanitized Sentry reporting. No new event payload sends phone numbers, prefilled
message text, simulated chat content or booking details. The animated phone is
local illustrative content; its message changes are not product events. Check
page views for both approved hostnames after DNS activation, and verify opted-out
visitors remain untracked. A WhatsApp link click is not a completed booking.

### Analytics deployment preparation — 18 November 2026

The allowlist now includes `/business` and `/business/collectors`. On
`business.luma.green`, `/` is reported as `/business`, including localized roots.
No hostname property is added. Choices remain separate for each origin; an opt-out
on the public site does not change the business site setting. These hosted web
changes also apply inside Expo and Electron; no native SDK or permissions change.

PostHog and Sentry retain the existing event and error limits. Configure the
Luma-specific PostHog project and host, and Luma Sentry project DSN, using the
settings above. Provider configuration and live received-event acceptance are
separate from passing local tests. No new Sentry hook is needed for page views.

#### Vercel deployment and vendor-specific limitation

The owner approved metered Vercel Analytics and automatic cookieless public counts.
`@vercel/analytics` 2.0.1 uses manual pageviews only, with automatic tracking and
custom events disabled. `NEXT_PUBLIC_VERCEL_ANALYTICS_ENABLED` defaults to false
and stays false until deployment setup and acceptance. The shared telemetry flag
must also be enabled. Unknown origins, private routes, query strings, fragments,
credentials and sensitive or external referrers block loading and delivery.
Only an empty referrer or exact first-party public URL is allowed. Existing
opt-outs and storage failures block delivery. The callback repeats these checks
synchronously before each send, including after private SPA navigation.

The hosted Vercel runtime adds referrer and stored attribution after `beforeSend`.
The adapter reads `__va_attribution` without changing it: any present value,
including an empty string, or a storage exception blocks loading and delivery.
No `identify`, custom events or attribution-writing code is installed. This is a
vendor-specific defense, not a supported full-payload sanitization API. It depends
on the inspected hosted runtime's current storage key and synchronous send order.
Re-audit it whenever the SDK or hosted runtime changes; the hosted script is not
pinned by the package version. If Vercel changes this behavior, turn the flag off
until the guard is updated or supported vendor filtering becomes available.

Approved public referrer paths and browser/network metadata can reach Vercel.
Neither this implementation nor the notice promises anonymity or zero network
data. PostHog keeps its stricter property allowlist and memory-only identifier.
Sentry remains automatic and separate from the analytics setting. Do not enable
replay, heatmaps, advertising, persistent profiles or paid add-on features.

Browser tests serve local app content under intercepted first-party origins and
stub the documented Vercel script queue. Every ingestion request is intercepted.
They verify default-on counts, opt-out, route/query/referrer boundaries and
attribution added before or after load. They do not prove the hosted vendor's
final payload. Inspect actual received payloads and headers during live
acceptance, with approved test traffic only. No raw private values may appear.

### Direct PostHog transport and provider setup receipt

The PostHog SDK was replaced with a small direct call to the documented
[capture API](https://posthog.com/docs/api/capture). Its retry queue can resend an
already-captured event after opt-out or private navigation without calling the
application's sanitization hook again. The installed SDK's supported fetch options
do not provide a safe cancellation boundary. No SDK internals or retry patches
are used.

The direct call posts only the project API key, `$pageview`, normalized public
URL, locale, ephemeral in-memory distinct ID and `$process_person_profile:false`.
Only exact US/EU PostHog cloud ingestion origins are accepted. Fetch omits cookies
and the Referer header; an AbortController cancels outstanding requests on stop.
There is no retry, unload beacon, keepalive queue, identification or profile API.
Resuming creates a new controller, leaving prior requests aborted. Already received
events cannot be recalled by a later opt-out. Cross-tab changes do not reload a
private form or discard drafts.

Provider setup reported and verified by the release operator on 18 November 2026:
PostHog organization **Luma.Green**, project **746365**, US Cloud ingestion
`https://us.i.posthog.com`; free tier shows 1 million product events, no card and
no upgrade. Authorized domains are `luma.green` and `business.luma.green`.
Autocapture, heatmaps, web vitals and replay are off. **Discard client IP data**
is on; provider GeoIP/bot transforms may process the IP before discard. Production
public key/host and Vercel Analytics flag are saved for the next checked release.
Direct-ingestion receipt still needs verification after that release. Never copy
secret keys into this record.

Sentry project **luma-jb/luma-web** received the operator's scrubbed test event
`78b7eb12074940df8def3ad4ac2d253a`. No URL or user identity was present; provider
coarse geography remained and IP storage was blocked. Public DSN and telemetry
flag were saved for Production. The project uses the free Developer plan. No
source-map upload token was created; this receipt does not prove source mapping
or a controlled error from the new deployed application.
