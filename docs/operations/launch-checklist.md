# Account and deployment checklist

> Current foundation status — 28 October 2026: use the
> [active release checkpoint](../delivery/platform-foundation-2026-10-27.md)
> for the candidate, checks and rollout status, and
> [AGENTS.md](../../AGENTS.md#9-integration-boundaries) for current authentication
> and provider rules. Phone sign-in is the current member path; email/password
> login and recovery are disabled. `luma.green` is connected to the Luma Vercel
> Production project. Expo is paused. The dated records below describe earlier
> preparation and do not prove acceptance of the foundation candidate.

> Status: approved setup plan, updated 7 October 2026. Account ownership and
> provider activation are unverified except the known GitHub, Convex and Vercel
> projects. No secret values belong in this file.

The founder should verify existing accounts before creating duplicates. The
required production paths are verified email/password and phone OTP, workspace
invites, and gateway-only B2B payments. Local development delivery is strictly
local. This plan supersedes older references to optional email, demo escrow or
cloud test-code delivery for this work. Email accounts and workspace invitations
are implemented locally. The complete post-bridge browser suite passed 55 of 55
cases against the local production build on 7 October. Both TypeScript checks,
137 focused financial backend tests and independent review, and 50 focused UI
tests passed. Live provider delivery, eligibility, acceptance and activation
remain open. Final capture review, Word/Google Docs publication, full checks,
CI and deployment remain required.
A production release is not yet verified. Use the [Saturday test plan](../testing/launch-2026-10-10.md)
for test steps and release criteria.

## Current handoff and first morning

Start with the [execution record](../testing/launch-2026-10-10.md#13-current-execution-record).
The final connected suite passed **55 of 55 browser cases in 4.3 minutes** on
the normal local production build on 7 October 2026
(`.convex/release-work/connected-restored-runtime.log`). It covers account
creation/recovery, all approved account groups, workspace permissions, material
flows, quality evidence, sourcing, logistics and the gateway boundary.

The 747-case disconnected public run passed 719 cases; all 28 failures were old
UI/copy expectations and were corrected. All 77 cases in the four affected specs
then passed. The five intercepted analytics-consent cases also pass. Full lint
passes with zero errors and 21 warnings; source formatting and both normal and
analytics production builds pass. These are local results.

Final connected capture review, the main Word rebuild, same-ID Google Docs
publication, full `pnpm check`, protected PR/CI and backend/frontend production
deployment remain pending. The team Word pack is reviewed at 72 pages. Provider
approval/delivery and real payment acceptance remain separate setup gates.

The locale audit covers 33 catalogues with 2,940 keys each. It does not replace
native-language review. Financial backend137 and financial UI50 focused tests
passed separately; these do not prove real money movement.

The existing Vercel project address is `https://lumagreen.vercel.app`. It is not
proof that the candidate is deployed. The `luma.green` custom domain is not yet
configured in that Vercel project. Use only the address and candidate commit in
the final release record when testing. The production administrator's live email
identity still needs to be supplied and configured; do not use a disposable
`@luma.test` identity for it.

1. **Founder, first 10 minutes:** read the release record and unresolved gates.
   Confirm the exact test URL, candidate commit and whether each provider is
   off, sandbox verified or live verified. A running page alone is not a release.
2. **Founder:** give the test lead the restricted credentials annex separately
   from the Google guide. Assign Tester A the seller/owner tasks and Tester B
   the buyer/member tasks. Each person uses a separate browser profile. The
   local address works only on the Mac running the local services; do not expose
   the local verification inbox or move disposable accounts to production.
3. **Test lead, next 10 minutes:** open the same Google guide, the
   [manual case list](../testing/team-end-to-end-manual.md) and an empty result
   sheet. Record browser, device, locale, theme and candidate. Mark provider-only
   cases BLOCKED until their setup and acceptance checks have passed.
4. **Both testers:** follow guide chapter 40's two-person first run. Start with
   login, workspace name and role, notifications and sign-out. Then run the
   assigned household, manufacturer, buyer and read-only viewer steps. Read
   each expected result before the action; record what actually happens.
5. **Test lead:** include own-production stock intake, grade/specification,
   facility references, multiple-input mass balance, controlled disposition and
   admin classification in the full manual pass. Use synthetic local data and
   the exact fixture references; do not classify a real material for convenience.
6. **Founder:** complete the account checklist below. Share secret values only
   through the approved secret store. Supply the production admin identity,
   verified email sender, SMS approval details and provider access to their
   named owners. These missing inputs cannot be replaced by a UI test.
7. **Engineer and test lead:** retest each corrected defect with its original
   steps, then its related permission and retry case. Preserve the failed result
   and link the new result. Do not repeatedly send invitations during a quota
   cooldown; wait for the permitted retry time.
8. **End of day:** record passed, failed, blocked and not-run counts separately,
   name the owner of each blocker and choose the next day's tests. The founder
   makes the launch decision for an explicit scope only after release checks
   and required provider evidence pass.

For a defect, include the case ID, URL without private tokens, role/workspace,
steps, expected and actual result, time and a safe screenshot. Exclude passwords,
authenticator QR codes, recovery codes, API keys and customer contact details.
The [manual](../testing/team-end-to-end-manual.md) contains the full report and
reset/retest routine.

## Accounts to prepare now

| Account or access                     | Founder action and proof required                                                                                                                                                                                                                                                                                                                                                                                              |
| ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| GitHub                                | Reuse the existing repository. Confirm owner/recovery access, protected main, Actions and the required checks on the release SHA. No new account if access works.                                                                                                                                                                                                                                                              |
| Convex                                | Reuse the existing project. Verify access to development `glorious-rooster-470` and production `outstanding-buzzard-942`. Both were reset empty and paused on 6 October. Keep them paused until the validated release action. Prepare correctly scoped deploy keys and backups.                                                                                                                                                |
| Vercel                                | Reuse project `luma_green`. Verify repository/branch binding, owner/billing access, build command, per-environment variables and exact release deployment. Do not create another empty project.                                                                                                                                                                                                                                |
| Domain registrar or DNS host          | Verify ownership and DNS access for `luma.green`. Configure only the records shown by Vercel and Resend. Verify HTTPS, canonical domain and any `www` redirect.                                                                                                                                                                                                                                                                |
| Better Auth                           | No account signup is needed for the self-hosted library already in the app. “Butter Auth” is interpreted as Better Auth. Configure the backend secret and approved origins; do not sign up for an unrelated product.                                                                                                                                                                                                           |
| Resend                                | Create an account or verify existing owner access. Verify an owned sending domain/subdomain through DNS, choose the sender and create a restricted sending API key. Normal-user verification, reset and invitation delivery paths are implemented locally. Verify actual provider inbox delivery, expiry and one-use links before activation.                                                                                  |
| MSG91 and India DLT access            | Create/verify MSG91 account, sender/entity access, approved header and content templates, OTP setup, matching language content, account balance and limits. Map approved DLT details into MSG91. Prove delivery on a controlled handset.                                                                                                                                                                                       |
| Cashfree Payment Gateway + Easy Split | Selected for implementation on 6 October. Create/verify the Cashfree business account and request Easy Split activation. The local sandbox interface and webhook handling exist; this is not provider acceptance. Confirm marketplace use-case eligibility, seller KYC, settlement bank details, refunds and disputes. Obtain sandbox access first, then live approval. Gateway access alone does not prove Easy Split access. |

Better Auth is installed as a library with an application secret; see
[its installation guide](https://better-auth.com/docs/installation). Resend
requires an owned verified domain and offers restricted API keys; follow
[domain setup](https://resend.com/docs/dashboard/domains/introduction) and
[API-key setup](https://resend.com/docs/dashboard/api-keys/introduction).

For India SMS, verify DLT entity/header/template and provider mapping status in
the actual dashboards. MSG91's [template setup](https://msg91.com/help/template/how-to-create-flow-id-to-send-sms-via-api)
requires matching approved content and sender details. Its
[DLT guidance](https://msg91.com/help/dlt-registration-in-india/dlt-content-template-faqs/)
mentions 2–4 business days for content-template approval. That is not a delivery
promise or an approval SLA. Start now; do not assume approval by Saturday.

[Cashfree Easy Split](https://www.cashfree.com/docs/payments/split/overview)
is the selected implementation. It supports vendor splits and settlement
reporting and requires account-manager enablement. Confirm Luma's use case
with Cashfree before treating the account as approved. Do not promise a payment
launch before provider fit, code, signed
webhook handling, sandbox reconciliation and live approval all pass.

## Required environment settings

“Existing” means the name is already used in this repository. It does not mean
the value is configured, the account is approved or the feature is ready.
“Proposed” means part of the approved implementation; confirm the final code
contract before setting it. Secrets go in provider/Convex secret storage or the
approved password manager. `NEXT_PUBLIC_*` values are public.

| Setting and status                                                                                 | Destination and use                                                                                                                                                                                                                                                       |
| -------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `NEXT_PUBLIC_SITE_URL` — existing                                                                  | Next.js/Vercel. Set the exact public HTTPS origin for production; use the chosen local origin in L1.                                                                                                                                                                      |
| `NEXT_PUBLIC_CONVEX_URL`, `NEXT_PUBLIC_CONVEX_SITE_URL` — existing                                 | Local frontend uses local backend/HTTP-action origins. Vercel should receive its matching backend URL through the reviewed deploy build command. Never point a preview at production.                                                                                     |
| `CONVEX_DEPLOYMENT` — existing                                                                     | Local CLI target only. Check the resolved target before any command; a saved name is not evidence that the cloud service is active.                                                                                                                                       |
| `CONVEX_DEPLOY_KEY` — existing secret                                                              | Vercel build secret: production key in Production scope, preview key in Preview scope. Never place the production key in local acceptance configuration.                                                                                                                  |
| `BETTER_AUTH_SECRET` — existing secret                                                             | Matching Convex backend. Unique random value of at least 32 characters per environment; keep it stable across normal deployments.                                                                                                                                         |
| `SITE_URL`, `EXTRA_TRUSTED_ORIGINS` — existing                                                     | Convex auth origin policy. Allow only required exact origins; no broad preview wildcard. Local tests use local origins only.                                                                                                                                              |
| `ADMIN_EMAIL`, `ADMIN_SETUP_TOKEN` — existing                                                      | Convex. Configured founder identity and separate private setup secret; remove the token after admin setup. Require admin TOTP.                                                                                                                                            |
| `RESEND_API_KEY` — existing secret                                                                 | Convex only. Used for admin recovery and normal verification/reset/invite. Actual provider delivery remains a separate acceptance check.                                                                                                                                  |
| `AUTH_FROM_EMAIL` — implemented, provider setup pending                                            | Convex only. Approved verified sender for normal email verification, recovery and invitation delivery. Exact sender value remains a founder choice.                                                                                                                       |
| `ADMIN_RESET_FROM_EMAIL` — existing                                                                | Convex only. Existing admin recovery sender; preserve the separate configured-admin recovery boundary and TOTP.                                                                                                                                                           |
| `MSG91_AUTH_KEY`, `MSG91_OTP_TEMPLATE_ID` — existing                                               | Convex only. Approved account key and OTP template ID. Keep absent from L1 to prevent real sends.                                                                                                                                                                         |
| `AUTH_LOCAL_TEST_MODE`, `AUTH_LOCAL_EMAIL_INBOX_URL`, `AUTH_LOCAL_EMAIL_INBOX_TOKEN` — implemented | Local acceptance only. Both configured site and system Convex HTTP origin must be loopback. Delivery uses a private in-memory inbox with a bearer token. The retired `AUTH_DEV_MODE` does not enable test delivery. Never configure these settings on hosted deployments. |
| `CASHFREE_MODE`, `CASHFREE_SANDBOX_CHECKOUT_ENABLED` — implemented, off by default                 | Convex only. Use `sandbox` plus explicit `true` only for approved sandbox testing. Live checkout uses its separate explicit activation flag and approved policy; sandbox cannot authorize stock movement.                                                                 |
| `CASHFREE_SANDBOX_CLIENT_ID`, `CASHFREE_SANDBOX_CLIENT_SECRET` — implemented secrets               | Convex only. Obtain sandbox keys from the approved Cashfree account. The secret verifies raw-body webhook signatures. No public payment key is needed.                                                                                                                    |
| `CASHFREE_LIVE_CLIENT_ID`, `CASHFREE_LIVE_CLIENT_SECRET` — implemented secrets, activation off     | Separate live credentials. Adding them alone does not enable live checkout. Complete financial code review, provider acceptance and the explicit policy/activation checks first.                                                                                          |

The current financial implementation also introduces two Convex-only settings:
`CASHFREE_LIVE_CHECKOUT_ENABLED` must explicitly be `true`, and
`CASHFREE_LIVE_POLICY_VERSION` must select an existing approved, immutable policy
version. Default is off. The configured administrator records the policy in
**Payment setup → Record approved policy**. The agreement owner supplies who
bears gateway fees, who funds refunds, the approved settlement-terms reference
and the actual provider-acceptance test reference. Do not invent these values
or save a placeholder policy to open checkout. Saving a policy does not switch
on the server flag, change existing order terms or prove a payment. The server
must also validate the provider/vendor and account requirements. Local financial
review and connected acceptance passed; final whole-project checks and real
provider acceptance remain pending.

Confirm the final auth implementation's local delivery controls with the
engineer. A browser flag cannot enable local verification. If local Better Auth
components or persistence fail, record the blocker; do not move these disposable
accounts to cloud development without a new explicit decision.

## Backend and frontend deployment

The repository's normal `pnpm build` builds the frontend only. For this release,
verify the exact production Convex target, resume it if paused, then deploy the
backend separately before Vercel publishes the matching frontend:

```sh
pnpm exec convex deploy --env-file /private/path/production-target.env --typecheck enable --codegen disable
```

The private target file must select `prod:outstanding-buzzard-942`. Confirm the
regional endpoint, current owner access and production type before running it.
Clear conflicting deployment-key and self-hosted overrides. Never place a local
test-mode setting or disposable account in production.

This is a backend mutation, not a local verification command. Verify the deployed
schema, functions and auth component before deploying the tested frontend commit
to Vercel project `luma_green`. Verify its public Convex URL matches the regional
production endpoint. Reactivating a paused backend is a separate release step;
inspect queued jobs before resuming. Preserve the reset exports and recovery
files. Do not rerun obsolete prototype migrations against the new schema.

The [official Convex Vercel setup](https://docs.convex.dev/production/hosting/vercel)
also documents a combined `convex deploy --cmd 'pnpm build'` command. Its build
command runs before the backend push. Do not use that combined command as proof
that backend deployment completed before frontend publication.

## Status SMS and optional service settings

Status SMS is separate from OTP. Existing Convex settings are
`MSG91_NOTIFICATION_TEMPLATES` (event/language to approved Flow ID map),
`SMS_NOTIFICATION_BASE_URL` and optional
`MSG91_NOTIFICATION_ENGLISH_FALLBACK`. Use the exact eight events and `VAR1`
contract in [SMS notifications](sms-notifications.md). The key is shared with
OTP; template IDs are not. A disabled event is not sent later merely because
keys are added. Verify provider acceptance and handset delivery separately.

These are optional feature accounts, not prerequisites for core onboarding:

| Account or service                             | Existing settings and activation proof                                                                                                                                                                                                                                                                         |
| ---------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| OpenRouter or self-hosted vision               | `OPENROUTER_API_KEY`, `OPENROUTER_MODEL`, `PHOTO_ESTIMATE_DAILY_LIMIT`; or `PHOTO_ESTIMATE_PROVIDER`, `PHOTO_ESTIMATE_ENDPOINT`, `PHOTO_ESTIMATE_API_KEY`, `PHOTO_ESTIMATE_MODEL`. Convex only. Choose one path, cap costs and evaluate representative photos. Manual entry stays available.                   |
| Sentry                                         | `NEXT_PUBLIC_TELEMETRY_ENABLED`, `NEXT_PUBLIC_SENTRY_DSN`; optional private build `SENTRY_AUTH_TOKEN`, `SENTRY_ORG`, `SENTRY_PROJECT`. Verify scrubbed error receipt.                                                                                                                                          |
| PostHog and GA4                                | Telemetry flag plus `NEXT_PUBLIC_POSTHOG_KEY`, `NEXT_PUBLIC_POSTHOG_HOST`, `NEXT_PUBLIC_GA_MEASUREMENT_ID`. Require visitor consent and safe public-page event receipt; no private form/record tracking.                                                                                                       |
| Google Search Console and Bing Webmaster Tools | DNS ownership or `NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION` / `NEXT_PUBLIC_BING_SITE_VERIFICATION`. Verify ownership and sitemap fetch; this does not prove indexing.                                                                                                                                              |
| NewsAPI                                        | Convex `INDUSTRY_NEWS_ENABLED`, `INDUSTRY_NEWS_API_KEY`, `INDUSTRY_NEWS_DAILY_LIMIT`. Verify a plan and rights that permit the intended production use.                                                                                                                                                        |
| data.gov.in and public weather data            | Convex `PUBLIC_DATA_ENABLED`, `DATA_GOV_IN_API_KEY`, `DATA_GOV_IN_AIR_RESOURCE_ID`, `MET_NORWAY_USER_AGENT`. Follow [public data](public-data.md); check source freshness, attribution and unavailable states.                                                                                                 |
| Browser push                                   | Convex `WEB_PUSH_ENABLED`, `WEB_PUSH_PUBLIC_KEY`, `WEB_PUSH_PRIVATE_KEY`, `WEB_PUSH_SUBJECT`. Generate the VAPID pair securely; obtain device permission and verify cleanup/revocation. No separate Mapbox or storage account.                                                                                 |
| Expo and mobile stores                         | Expo/EAS project; Apple Developer and Google Play Console for their store releases. `EXPO_PUBLIC_EAS_PROJECT_ID`, `EXPO_PUBLIC_APP_URL`; optional server `EXPO_PUSH_ENABLED`, `EXPO_PUSH_ACCESS_TOKEN` and platform push credentials. Verify signing, devices, updates and store approval.                     |
| Desktop signing and release host               | Apple Developer ID/notarization and Windows signing as applicable. `CSC_NAME`, `APPLE_ID`, `APPLE_APP_SPECIFIC_PASSWORD`, `APPLE_TEAM_ID`, `WIN_CSC_LINK`, `WIN_CSC_KEY_PASSWORD`, `DESKTOP_WINDOWS_PUBLISHER`, `DESKTOP_UPDATE_URL`, `DESKTOP_APP_ORIGIN`. Use secured build storage and signed update tests. |
| WhatsApp Business                              | Later channel. No current signup or launch requirement; approve its business/channel design before setup.                                                                                                                                                                                                      |
| CodeRabbit, uptime tool and backup destination | Optional operations/review tools. Verify existing access before adding accounts. Enable only a chosen service with an owner and tested alert/recovery path.                                                                                                                                                    |

Follow [observability](observability.md), [search](seo.md),
[push notifications](push-notifications.md) and [app releases](app-releases.md)
for the full feature contracts, including native update signing. Expo documents
store accounts and signing in its [build guide](https://docs.expo.dev/deploy/build-project/).
Keys alone do not prove delivery, store approval or a working release.

No Mapbox account is required now: location uses the browser. No Cloudflare R2
account is required now: private documents use Convex storage. No separate
Better Auth hosted subscription is needed for the library. Household cash/UPI
payment is between the kabadiwala and household; it does not require Luma to
open a gateway account for that payment.

## Founder setup record and acceptance

For each service record: owner, account/project alias, environment, requested
feature, approval status, expiry/rotation owner, cost limit, verification date
and evidence link. Never record a password, key, private token or full personal
identity document here. Use NOT STARTED, REQUESTED, APPROVED, CONFIGURED,
SANDBOX VERIFIED and LIVE VERIFIED as separate stages.

Before launch, run the dated test plan. In particular, prove both verified
signup methods, reset and TOTP, invite/revoke and cross-org denial, exact
household receipts, PET evidence, gateway blocking/reconciliation and signed-out
private-file denial. Check the actual inbox/handset for enabled messages.
Update the existing Google user guide from the reviewed Word source after the
browser tests; keep its document ID and sharing. Distribute local test passwords
only through the restricted annex to the named test team.

Current account blockers remain: the production admin identity and setup,
Resend domain/sender and delivery, MSG91/DLT
approval and handset delivery, Cashfree approval/onboarding, final deployment
and native release accounts where required. No new account was created by
writing this checklist. Saturday launch remains conditional on the tested scope.
