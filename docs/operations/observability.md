# Analytics and error monitoring

Status: implementation and setup guide, 1 October 2026. No provider account,
production receipt or approved privacy notice is confirmed by this document.
This replaces the earlier deferral in [ADR 0012](../decisions/0012-pilot-analytics-in-convex.md);
the current decision is [ADR 0016](../decisions/0016-optional-analytics-and-error-monitoring.md).

## Enable only the services you need

All services are optional. An empty deployment loads no analytics SDK and starts
no Sentry transport. Set `NEXT_PUBLIC_TELEMETRY_ENABLED=true` in the intended
Next.js deployment and add the settings for the chosen services below. Public
settings are injected at build time: rebuild and redeploy after changing them.
Keep the flag empty or `false` in ordinary local and preview builds. The flag
is independent of `VERCEL_ENV`; it is an explicit operator decision.

| Service            | Public configuration                                  | Private build configuration                                                |
| ------------------ | ----------------------------------------------------- | -------------------------------------------------------------------------- |
| PostHog            | `NEXT_PUBLIC_POSTHOG_KEY`, `NEXT_PUBLIC_POSTHOG_HOST` | None                                                                       |
| Google Analytics 4 | `NEXT_PUBLIC_GA_MEASUREMENT_ID` (`G-...`)             | None                                                                       |
| Sentry             | `NEXT_PUBLIC_SENTRY_DSN`                              | `SENTRY_AUTH_TOKEN`, `SENTRY_ORG`, `SENTRY_PROJECT` for source-map uploads |

The analytics project key, measurement ID and Sentry DSN are browser-visible
settings. Do not put a PostHog personal API key or Sentry auth token in a
`NEXT_PUBLIC_*` variable. Set provider budgets, quotas, retention and alerts
before enabling them. No paid plan is required by application code; account
limits and commercial terms must be checked with each provider.

## PostHog and Google Analytics

The visitor must select **Allow analytics** before the app loads an analytics
SDK. **Keep analytics off** leaves analytics disabled. The choice is stored in
this browser under `luma.analytics.v1`; it is not saved to the user account.
**Analytics settings** on the measured pages lets the visitor change it. A
withdrawal stops capture and reloads the page to remove vendor listeners. If
browser storage fails, analytics stays off. Clearing site data removes the
choice and causes a new prompt.

Only these pages, including their locale variants, send manual page views:
`/`, `/how-it-works`, `/participants`, `/prices`, `/standards`, `/solar`, `/help`.
New pages are excluded unless deliberately added to the allowlist. Login,
onboarding, `/sell`, contact forms, booking tracking, the business app and admin
are excluded. Moving from a measured page to an excluded route stops page
capture; returning resumes it only while the saved choice is still allowed.

App properties are the normalized public path and locale. The page URL sent is
the origin plus that allowlisted path. Query strings, fragments, referral URLs,
DOM text, real page titles, form values, customer IDs and booking tokens are not
included by the app's event contract. GA uses the fixed title `Luma.Green`.
Providers may still process browser/network metadata and IP addresses at their
network boundary. Do not describe this as fully anonymous or zero-data traffic.

### PostHog account

1. Create or select a project and confirm its region. Copy its project API key
   and ingestion host to the public values above. The default host is
   `https://eu.i.posthog.com`; use the host for the actual project.
2. Keep session replay, autocapture, surveys, feature flags, exception capture,
   performance capture and heatmaps disabled. The runtime disables these
   features and permits only manual `$pageview` events.
3. Review retention and ingestion limits. There is no user identification or
   person profile creation. The SDK keeps its random identifier in memory;
   it does not persist that identity across reloads. Returning-user and
   cross-device analysis are therefore outside this implementation.
4. Verify the first consented event in the project's live events view. Confirm
   only the allowed properties appear and no events arrive from private pages.

### Google Analytics account

1. Create a GA4 property and web data stream. Set the public measurement ID,
   including its `G-` prefix.
2. In the web stream settings, **disable Enhanced Measurement entirely**.
   Disable automatic page views, including browser history change measurement.
   The app supplies manual page views with `send_page_view=false` on config.
   Automatic measurement can duplicate events or record excluded interactions.
3. Keep Google Signals, advertising personalization, user-provided data and
   advertising integrations disabled. The runtime denies advertising consent
   and disables Google Signals and personalization signals.
4. Do not install a second Google tag, Google Tag Manager container or platform
   analytics integration for this same property. This app owns its tag.
5. Review retention, data sharing and region settings. GA can use analytics
   cookies after the visitor allows it; withdrawal does not promise to delete
   historical provider records. Follow the provider's deletion controls when
   removal is required.
6. Check Realtime and browser network requests after an allowed page visit.
   Confirm one manual page view per route transition, a safe page URL and no
   events from private routes. Provider settings are part of this check.

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
2. Review the privacy notice. State that optional public analytics needs visitor
   consent and that error reporting has a separate purpose and operator gate.
3. Set the provider controls in the account instructions above. Do not enable
   extra products offered during setup. Existing GA4 is optional; avoid duplicate
   traffic reports unless there is a clear reporting need.
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

| Event           | Provider         | Permitted app properties                                                                                            | Intended chart                                                | Limit                                                         |
| --------------- | ---------------- | ------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------- | ------------------------------------------------------------- |
| `$pageview`     | PostHog          | Normalized public `page`, supported `locale`; transport key and random in-memory distinct ID; sanitized origin/path | Daily page views, public path share, language share           | No account identity; reloads start a new identifier           |
| `page_view`     | GA4, if selected | Same page/locale; safe origin/path; fixed title and empty referrer                                                  | Public page views by path/language                            | GA consent cookies and provider settings need separate review |
| Exception event | Sentry           | Error class, sanitized code location, event time/ID, release/environment metadata                                   | New errors and regressions by release; affected code location | Error values, request data and private context are removed    |

Create one small public-traffic dashboard in PostHog: page views over time, path
and language. Label it **consented public traffic**. Do not label distinct IDs as
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

| Check                                                 | Required evidence                                                           | Current status                                       |
| ----------------------------------------------------- | --------------------------------------------------------------------------- | ---------------------------------------------------- |
| Empty flag/keys                                       | No initialized SDK transport in a fresh build                               | Covered by local tests; live pending                 |
| DSN only, operator flag off                           | No Sentry initialization from either entry file                             | Covered by local tests; live pending                 |
| No consent / decline / storage unavailable            | No PostHog or GA load/event                                                 | Covered by local tests; live pending                 |
| Consent on `/ar/prices` with synthetic query/fragment | One safe manual page view; only allowed fields at receiver                  | Covered by local tests; live pending                 |
| Navigate into login/join/booking/app/admin            | No analytics event from excluded routes                                     | Covered by local tests; live pending                 |
| Withdraw, reload and change another same-origin tab   | Capture stays off; no stale delayed load sends events                       | Local contract tests exist; browser/provider pending |
| Controlled browser error and Next.js request error    | Received scrubbed exception, no message/request/body/user/breadcrumb fields | Local scrubber tests pass; receiver pending          |
| Error with analytics declined                         | Same error-only behavior, independent of analytics consent                  | Local gates are separate; receiver pending           |
| Source maps and release                               | Safe test error maps to this deployed code; release matches commit          | Build/account pending                                |
| Account controls                                      | Access, region, privacy settings, actual retention, cap and alert verified  | Pending                                              |
| Shutoff                                               | Flag off plus rebuild stops all three integrations with keys retained       | Local gates tested; hosted pending                   |

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
