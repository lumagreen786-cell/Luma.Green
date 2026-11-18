# Environments

> **Status:** updated for the approved local acceptance plan on 6 October 2026.
> The [handoff](../delivery/handoff.md) records the cloud reset. The
> [10 October test plan](../testing/launch-2026-10-10.md) owns test execution and
> release evidence. These instructions do not report a passed test run.

Keep local tests, external provider tests and production separate. Do not copy
credentials or disposable identities between them.

| Environment                    | Frontend                                      | Backend                                                                                    | Current boundary                                                                                            |
| ------------------------------ | --------------------------------------------- | ------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------- |
| **Local disconnected**         | Local build with empty optional configuration | None                                                                                       | Public rendering and unavailable states; no account or persistence proof                                    |
| **Local connected acceptance** | `http://localhost:3100` for this run          | Anonymous local Convex at `http://127.0.0.1:3210`; HTTP actions at `http://127.0.0.1:3211` | Synthetic accounts and records; all development verification stays local                                    |
| **Cloud development**          | No approved disposable-auth test frontend     | `glorious-rooster-470`                                                                     | Verified empty and paused after the 6 October reset; preserve recovery exports                              |
| **Preview / provider test**    | Separately configured test build              | Separately approved backend                                                                | Later provider gate; no local verification service, fixed-code bypass or production records                 |
| **Production**                 | Deployed public frontend                      | `outstanding-buzzard-942`                                                                  | Verified empty and paused after the 6 October reset; frontend availability does not prove a working backend |

The local processes have started. Session creation, restart persistence, private
storage and real role journeys still need acceptance evidence. Cloud development
is not the local backend.

## Rules

- **Only production can be indexed.** `src/app/robots.ts` blocks crawling
  unless `VERCEL_ENV === "production"`.
- **No live provider keys in local acceptance.** Email and phone verification
  must not send through Resend or MSG91. Keep external payment, telemetry and
  push delivery disabled unless a separate test requires it.
- **No production deploy key in `.env.local`.** Check the selected backend
  before every Convex command. A local frontend can write to a cloud backend.
- **Development verification is local only.** `AUTH_DEV_MODE` does not enable OTP
  delivery. `AUTH_LOCAL_TEST_MODE` must never enable cloud development, preview
  or production use.
  Check loopback origins and the local target on the server; a browser flag is
  insufficient. Do not expose the local inbox through a public tunnel.
- **Keep secrets private.** Local passwords and access procedures belong in the
  restricted annex or password manager, outside Git and the shared guide. Do
  not put passwords, codes or tokens in ordinary logs or captures.
- **Empty configuration must build and test.** A missing required provider
  blocks its workflow with an honest unavailable state. Optional configuration
  does not mean production signup or payment works without a provider.
- **CI has no application secrets.** Local tests do not prove hosted CI,
  deployment, provider delivery or launch approval.

## Local setup

Use the isolated checkout named in the handoff. Preserve an existing
`.env.local`; do not copy `.env.example` over it. Before starting Convex, check
that the shell and local files have no cloud deployment selector, cloud deploy
key or live provider key. Do not print secret values during this check.

For a fresh isolated checkout with no deployment binding, the installed CLI
supports anonymous local development:

```sh
CONVEX_AGENT_MODE=anonymous pnpm --config.verify-deps-before-run=false exec convex dev --local-cloud-port 3210 --local-site-port 3211
```

The CLI can download its local runtime. This does not authorize external email
or SMS. If the local backend is already running, reuse its recorded process and
configuration. Do not start a second process on its ports or select a cloud
backend to work around a local failure.

Set `NEXT_PUBLIC_CONVEX_URL=http://127.0.0.1:3210` and
`NEXT_PUBLIC_CONVEX_SITE_URL=http://127.0.0.1:3211` in local frontend configuration.
Set the local backend's `SITE_URL=http://localhost:3100` and use a private local
`BETTER_AUTH_SECRET`. Keep the exact origins consistent with auth settings.

```sh
pnpm --config.verify-deps-before-run=false dev --port 3100
```

Better Auth runs on Convex; no separate Better Auth service account is required.
Prove the real HTTP handler and Convex adapter work locally before the full role
run. Check sign-in, session reload, restart persistence and private storage. If
a component fails, fix or record the blocker; do not move verification to cloud.

Configure the [secured local inbox](../../scripts/local-auth/README.md) with
`AUTH_LOCAL_TEST_MODE`, `AUTH_LOCAL_EMAIL_INBOX_URL` and a private
`AUTH_LOCAL_EMAIL_INBOX_TOKEN` of at least 32 characters. Both `SITE_URL` and
the backend system `CONVEX_SITE_URL` must be loopback HTTP origins. Store local
server settings in the restricted ignored file described in the
[acceptance setup](../../scripts/local-acceptance/README.md). Keep live keys absent.

Use the guarded local acceptance tools after their target and delivery checks
pass. Create identities through supported signup flows and domain data through
validated APIs or scoped local fixtures. Cleanup removes only that run's data.
Do not run the old whole-table demo reset.

## Release and cloud reactivation

Approved implementation can continue. Keep both cloud backends paused until
the checked schema, functions, configuration and recovery procedure are ready.
Use the [launch checklist](launch-checklist.md) for account gates.

1. Finish local handler, adapter, role and browser checks on the combined
   candidate. Run repository checks and a production build. Record the candidate
   commit and current guide review.
2. Open a PR and confirm its five required checks. Check the actual Vercel build
   and target. A frontend preview does not prove a matching Convex preview exists.
3. Complete separately approved provider tests. Resend needs a verified sender
   for normal email verification, recovery and invitations. MSG91 live OTP needs
   account and DLT/template proof. Cashfree Payment Gateway with Easy Split is
   selected. Request account-manager enablement for marketplace recycling-material trades, complete vendor KYC and
   prove actual sandbox payment, split, payout and refund behavior. Provider
   eligibility, activation and live settlement remain unverified.
4. Follow protected-branch release controls. Deploy the checked backend and
   matching frontend, verify the targets and run smoke tests. A frontend build
   alone does not deploy the backend.
5. Record provider delivery, backend release, frontend release and the launch
   decision separately. Preserve the reset exports for recovery.

The repository's `pnpm build` builds only the frontend. For this release, deploy
and verify the checked Convex backend first, then merge the matching frontend
through the protected PR and verify the Vercel production deployment. Set the
production frontend URL to the verified regional Convex endpoint. Keep previews
disconnected until a separate preview backend is configured.

Do not use `convex deploy --cmd 'pnpm build'` as a backend-first release step:
that command runs the frontend build before it finishes the backend deployment.
The [launch checklist](launch-checklist.md#backend-and-frontend-deployment) owns the release
sequence and target checks. The [Convex Vercel guide](https://docs.convex.dev/production/hosting/vercel)
describes the optional integrated build, which is not configured for this release.

The [Cashfree Easy Split documentation](https://www.cashfree.com/docs/payments/split/overview)
requires enablement through an account manager. Selection is a technical choice;
it is not merchant approval or proof that this use case is eligible. Record
actual provider decisions and payout/refund evidence before release.

## Where each variable lives

| Variable                                                                               | Frontend / build                                         | Convex or local backend                      | Boundary                                                                                                       |
| -------------------------------------------------------------------------------------- | -------------------------------------------------------- | -------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| `NEXT_PUBLIC_SITE_URL`                                                                 | Exact origin for that build                              | —                                            | Canonical URLs; verify domain setup before release                                                             |
| `NEXT_PUBLIC_CONVEX_URL`, `NEXT_PUBLIC_CONVEX_SITE_URL`                                | Loopback for acceptance; matching cloud URLs for release | —                                            | Set the site URL explicitly locally; a configured cloud build can inject/derive it                             |
| `CONVEX_DEPLOY_KEY`                                                                    | Intended cloud release environment only                  | —                                            | Separate preview and production keys; absent in local acceptance                                               |
| `CONVEX_DEPLOYMENT`                                                                    | Local CLI selection file, if used                        | —                                            | Must identify the isolated local target during this pass                                                       |
| `SITE_URL`                                                                             | —                                                        | Each auth backend                            | Exact frontend origin trusted by Better Auth                                                                   |
| `EXTRA_TRUSTED_ORIGINS`                                                                | —                                                        | Explicit approved origins only               | No wildcard or public tunnel for local acceptance                                                              |
| `BETTER_AUTH_SECRET`                                                                   | —                                                        | Each auth backend                            | Different private value per environment                                                                        |
| `ADMIN_EMAIL`, `ADMIN_SETUP_TOKEN`                                                     | —                                                        | Intended backend                             | Configured admin only; remove setup token after setup; retain required TOTP                                    |
| `RESEND_API_KEY`                                                                       | —                                                        | Approved external-provider environment       | Required for production email verification, recovery and invites; absent locally                               |
| `AUTH_FROM_EMAIL`                                                                      | —                                                        | Normal-user sender                           | Verified Resend sender for verification, recovery and invites; external delivery still needs evidence          |
| `ADMIN_RESET_FROM_EMAIL`                                                               | —                                                        | Configured admin recovery sender             | Preserve the separate admin identity and TOTP rules                                                            |
| `MSG91_AUTH_KEY`, `MSG91_OTP_TEMPLATE_ID`, status template IDs                         | —                                                        | Approved external-provider environment       | Live OTP only after account and DLT/template proof; absent locally                                             |
| `AUTH_LOCAL_TEST_MODE`, `AUTH_LOCAL_EMAIL_INBOX_URL`, `AUTH_LOCAL_EMAIL_INBOX_TOKEN`   | —                                                        | Guarded local acceptance backend only        | Loopback server/origin checks and private inbox token required; never cloud development, preview or production |
| `OPENROUTER_API_KEY`, `OPENROUTER_MODEL`, `PHOTO_ESTIMATE_DAILY_LIMIT`                 | —                                                        | Intended backend when enabled                | Optional; manual material entry works without AI                                                               |
| `NEXT_PUBLIC_TELEMETRY_ENABLED`                                                        | Explicitly enabled build only                            | —                                            | Master gate for PostHog, GA4 and Sentry                                                                        |
| `NEXT_PUBLIC_POSTHOG_KEY`, `NEXT_PUBLIC_POSTHOG_HOST`, `NEXT_PUBLIC_GA_MEASUREMENT_ID` | Intended build only                                      | —                                            | Analytics requires visitor opt-in; [setup](observability.md)                                                   |
| `NEXT_PUBLIC_SENTRY_DSN`                                                               | Intended build only                                      | —                                            | Error capture is separate from the analytics choice                                                            |
| `SENTRY_AUTH_TOKEN`, `SENTRY_ORG`, `SENTRY_PROJECT`                                    | Trusted build only                                       | —                                            | Optional private source-map upload credentials                                                                 |
| `NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION`, `NEXT_PUBLIC_BING_SITE_VERIFICATION`           | Intended public build                                    | —                                            | Public ownership tokens; [search setup](seo.md)                                                                |
| Cashfree Payment Gateway / Easy Split settings                                         | No secret in the browser                                 | Selected; integration and activation pending | Payment-dependent actions remain blocked until verified events; no manual paid flag or simulated escrow        |

For status-message settings and language maps, see
[sms-notifications.md](sms-notifications.md). Keep secrets in the password manager.
Rebuild when public build settings change. Local fake-key tests do not prove
provider receipt.

The kabadiwala pays a household directly. Luma records the receipt; it does not
collect or send household funds. This is separate from the B2B gateway.

## Backups and incidents

- Backups and restores: [backups.md](backups.md).
- When something breaks: [incidents.md](incidents.md).

## Afterlife public/business frontend settings

- `NEXT_PUBLIC_BUSINESS_SITE_ENABLED`: Vercel frontend/build flag, default false.
  Enable only after `business.luma.green` DNS/TLS and origin acceptance. It selects
  host routing, cross-site links and SEO; it grants no record access.
- `NEXT_PUBLIC_WHATSAPP_NUMBER`: public recipient in international digits, supplied
  by the owner. Needed by the rendered `wa.me` anchor. Blank means unavailable;
  there is no fabricated destination, chat popup or website phone collection.

No separate Convex backend is created for the business host. Backend trusted
origins and private-file CORS remain deployment-specific Convex settings.
