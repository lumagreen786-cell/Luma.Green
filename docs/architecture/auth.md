# Sign-in, roles and permissions

> **Status:** decided, 29 Sep 2026 —
> [ADR 0004](../decisions/0004-auth-phone-otp-and-admin-totp.md). Built first,
> with onboarding.

## Who signs in, and how

| Who                                                      | How                                                   | When                                        |
| -------------------------------------------------------- | ----------------------------------------------------- | ------------------------------------------- |
| Household                                                | Phone number + SMS code                               | Verified phone remains required for booking |
| Kabadiwala, preprocessor, recycler, manufacturer, Saathi | Phone number + SMS code                               | `/login`                                    |
| Admin (one person)                                       | Phone SMS code, then a 6-digit authenticator-app code | `/admin/login`                              |

A household phone confirmation creates a passwordless identity, so bookings and
points follow the number across devices. Email login and signup are disabled.
Existing records are not silently merged.

## How it's built

**Better Auth, running inside Convex** through the `@convex-dev/better-auth`
component. Built and tested on 29 Sep 2026.

- **Plugins:** `phoneNumber` and `twoFactor`. Email/password login and recovery endpoints are disabled.
- **Installed locally** (`convex/betterAuth/`). The component's tables come
  from our own plugin list: `pnpm auth:schema` writes
  `convex/betterAuth/generatedSchema.ts`, and `schema.ts` next to it adds our
  extra indexes. The packaged default schema lagged better-auth 1.6.33 — it
  had no room for the two-factor lockout fields — which is why. **Run
  `pnpm auth:schema` after changing a plugin or upgrading `better-auth`.**
- **Versions move together.** `@convex-dev/better-auth` 0.12 needs
  `better-auth` `>=1.6.11 <1.7`; the repo pins `~1.6.33` and Dependabot skips
  1.7+. Upgrade both in one PR, regenerate the schema, and test sign-in.
- **Next.js:** `convexBetterAuthNextJs` (`src/lib/auth-server.ts`) provides the
  `/api/auth/[...all]` proxy and server helpers (`isAuthenticated`,
  `getToken`). Protected layouts check the session on the server and redirect;
  a cookie check in `proxy.ts` alone is not security. On Vercel only the
  `.convex.cloud` URL is injected into builds, so the `.convex.site` URL is
  derived from it.
- **Browser:** sign-in and sign-out happen client-side through the auth client
  (`src/lib/auth-client.ts`); Convex queries are gated with `useConvexAuth`.
- **Convex functions** resolve the caller with `requireUser` / `requireAdmin`
  (`convex/lib/access.ts`), which use the component's session-validated user —
  never `ctx.auth.getUserIdentity()` alone — then load the `profiles` row.
- **Sessions** last 30 days from sign-in and are never extended
  (`disableSessionRefresh`); then a new phone sign-in. The admin's last 12 hours.
- **Rate limits** are stored in the database, so they hold across Convex
  requests: 10 requests a minute per client IP on the phone endpoints, 3 per
  10 seconds on two-factor. The client IP is Vercel's `x-forwarded-for`,
  passed through the Next.js proxy.
- **Public signing-key discovery:** only `GET /api/auth/convex/jwks` is exempt
  from the per-IP auth limiter through Better Auth's exact-path `customRules`.
  It returns public verification keys, creates no user session and grants no
  access. Convex verifiers share a network address; limiting their key fetches
  caused HTTP 429 responses and loss of client auth while login sessions remained
  valid. Other methods and auth routes retain their limits, including signup,
  sign-in, verification email, password recovery and token issuance. This rule
  does not cover the server-only `latest-jwks` route or expose private key fields.
  The JWKS limit exemption is implemented in the route-specific rate rules.
  A dedicated repeated-key-read regression is not in the current test suite;
  do not treat that route as covered by a 105-request test.

### SMS codes

- Optional invisible bot protection covers every send/resend at the Convex HTTP
  boundary before phone quota reservation. See [Turnstile setup](../operations/turnstile.md).
  Enabled deployments reject missing/invalid proofs and provider failures. The
  default unconfigured clone retains existing behavior; deployment alone does not
  enable protection.

- Six random digits, valid five minutes, with five verification attempts per code.
- Resend requires a user action after five minutes. The server reserves each send
  before generating a code, so a blocked resend does not invalidate the current code.
- Five sends per phone trigger a 24-hour lock from the fifth send. Quotas use a
  keyed phone digest and apply across sessions and IP addresses. Failed or uncertain
  sends count. Keep `BETTER_AUTH_SECRET` stable to preserve those identifiers.
- Better Auth schedules `convex/sms.ts` with the generated code. OS Digital uses
  the approved ENVRIN message. See setup below for its configuration and response checks.
- The secured local inbox is test-only: both site origins must be loopback HTTP,
  with `AUTH_LOCAL_TEST_MODE=true`, a loopback inbox URL and a private bearer token.
  See [local delivery](../../scripts/local-auth/README.md). There is no fixed code
  or OTP logging; `AUTH_DEV_MODE` does not enable delivery.
- Without a configured delivery path, `/login` shows an unavailable state and
  disables sending. It offers no code-entry preview or simulated sign-in.
- Per-IP limits supplement the phone quota. The direct Convex endpoint is public,
  so IP headers alone are not a reliable protection against SMS abuse.

### Optional authenticator for member accounts

Any signed-in household, applicant or business user can open
`/account/security`. Organisation approval is not required for account settings.
Phone identities remain passwordless. Authenticator enrollment, disable and
recovery-code replacement require recent sign-in proof. Legacy stored credentials
do not re-enable email login.

- A complete sign-in grants five minutes to enable protection, replace recovery
  codes or disable protection. If protection is already enabled, both the primary
  sign-in and an authenticator/recovery code must have passed. The proof is bound to
  the user and the current server session; client flags cannot grant it.
- Setup shows a local QR image and a manual key. Protection starts only after a
  valid authenticator code. Existing sessions are revoked at that point. The ten
  recovery codes are shown in the current screen only; they are not stored in
  browser storage, logs or screenshots. Cancelling setup leaves protection off.
- Subsequent SMS verification creates a ten-minute signed challenge. It creates
  no usable session or Convex JWT until the second factor passes. This also
  applies to the household booking sign-in form.
- Better Auth 1.6.33 does not challenge SMS verification by default. The small
  `phoneTwoFactor` plugin extends its existing challenge hook to that route and
  runs before the Convex JWT hook. It retains the library's one-use challenge,
  atomic recovery-code update and account attempt limits. Trusted-device bypass
  is disabled, including previously issued trust cookies.
- A challenge permits five failed attempts; the account lockout also spans
  separate challenges. Expired or exhausted challenges require a new phone code.
  Regenerating recovery codes invalidates the previous set. A recovery code does
  not disable protection.
- Lost authenticator and no recovery code means the account cannot pass the
  second factor. There is no automatic SMS-only reset. Support must follow a
  separately approved identity recovery process; one is not enabled by this UI.
- Direct phone-password and phone-password-reset endpoints are disabled. Ordinary
  phone identities cannot change their registered number. An existing verified
  non-admin email identity with no phone may bind an unused number after full
  authentication in the last five minutes. The server checks current session
  assurance before accepting `updatePhoneNumber: true`; binding preserves its
  identity, session and required authenticator. It does not enable SMS-only login
  for that legacy email identity. Ordinary SMS verification rejects a non-phone
  email identity after checking its OTP and before creating a session.
- The server checks forbidden number-change and trusted-device flags independently;
  a malformed unrelated option cannot disable either guard.
- Authenticator setup, enable/disable, recovery-code changes and password changes
  write audit events without secrets. Every private Convex operation still checks
  the stored session through `requireUser` / `requireAdmin`.

### The admin

- One admin phone identity. Set `ADMIN_EMAIL` to the internal identity generated
  by `phoneEmail` for the approved phone, for example `919876543210@phone.luma.green`.
  This legacy variable name selects the role; it is not an email login or inbox.
  Do not use a real email address for a new deployment. The owner must approve
  the phone before changing this setting.
- `/admin/login` verifies an SMS code and then the authenticator. A pending
  authenticator challenge has no session or Convex JWT. Backup codes work once.
- First sign-in goes to `/admin/setup` for profile details and authenticator
  enrollment. Enrollment requires a server proof of phone verification from the
  last five minutes. Before enrollment, admin operations remain denied.
- The profile records name, phone, date of birth and last four Aadhaar digits.
  These details never authenticate an account.
- Admin sessions last at most 12 hours. `requireAdmin` checks the configured
  identity and enabled authenticator. Admin users cannot disable their factor.
- Email/password and reset HTTP endpoints reject requests, even with old
  credentials or reset tokens. The retired recovery URLs redirect to phone login.
- If both the authenticator and backup codes are lost, use owner-led recovery.
  There is no email fallback. The console is English only.

### Testing

- **Unit:** the rules live in pure functions (`convex/lib/*.test.ts`,
  `src/components/{auth,admin}/*.test.ts`); `convex/identity.test.ts` uses
  convex-test to check signed-out callers get nothing.
- **Handler integration:** `convex/auth-two-factor.test.ts` calls the actual
  Better Auth HTTP handlers and Convex component. It covers pending-session/JWT
  denial, old-session revocation, expiry, attempt limits, concurrent redemption,
  recovery replacement, admin phone challenges and retired password-reset boundaries.
- **E2E** (`e2e/auth.spec.ts` and `e2e/account-settings.spec.ts`) also checks the
  disconnected unavailable-delivery UI and protected route return paths. Fixtures do not prove
  live SMS/email delivery or an authenticated production walkthrough.
- **Local browser acceptance:** run the secured inbox and a local Convex backend.
  Create disposable users through actual signup/verification handlers. Retrieve
  tokens in the protected runner, never from logs or direct auth table insertion.
  `convex/auth-email.test.ts` verifies that retired email endpoints reject requests.
  Real-handler phone and two-factor tests cover expiry, quotas, challenges and
  session issuance. Local tests do not prove provider delivery.

## Roles and permissions

| Can…                                                  | Household | Applicant (not yet approved) | Approved kabadiwala / yard / recycler / manufacturer | Approved Saathi | Admin |
| ----------------------------------------------------- | :-------: | :--------------------------: | :--------------------------------------------------: | :-------------: | :---: |
| Create and track their own bookings                   |     ✓     |                              |                                                      |                 |   ✓   |
| Fill in and submit their own application              |           |              ✓               |             ✓ (edits go back to review)              |        ✓        |   ✓   |
| See and act on their org's requests, stock and prices |           |                              |                   ✓ (own org only)                   |                 |   ✓   |
| See a household's phone and address                   |           |                              |             After accepting that booking             |                 |   ✓   |
| Review applications, approve, reject, suspend         |           |                              |                                                      |                 |   ✓   |
| Edit minimum and fallback price tables                |           |                              |                                                      |                 |   ✓   |
| Open uploaded documents and IDs                       |           |          Their own           |                      Their own                       |    Their own    |   ✓   |

Every row is enforced inside Convex functions and covered by an authorisation
test ("org A can't read org B").

## Private files

A file URL from Convex storage works for anyone who has it, and can't be
revoked short of deleting the file. So:

- Photos, certificates and IDs are **never** handed out as plain storage URLs.
- They are served through a Convex **HTTP action** that checks the caller's
  session and permission on every request (files up to 20 MB — which is why
  video uploads are capped at 20 MB).
- If we need expiring links later, files move to Cloudflare R2 through the R2
  component.

## Later: team members

The admin will add team members after the pilot. The model already separates
platform staff (`profiles.kind = "admin"`) from business users; team members
become staff roles — _reviewer_ (verification only), _support_ (read-only plus
notes), _owner_ (everything) — with the permission table above gaining columns.
No schema rewrite is needed.

### Server session availability

Protected locale routes and the admin console use `hasServerSession` for the
server gate. It calls the configured Convex token endpoint with only the incoming
cookie, authorization and client IP headers. The check has no token cache and no
automatic retry. A valid token response permits rendering; explicit HTTP 401/403
keeps the sign-in redirect. HTTP 429, other failed responses, malformed success
responses and network failures stop private rendering and reach a recovery
boundary above the guarded layouts. These failures never claim that a valid
session has ended.

Recovery is an explicit current-page reload. It also recreates a browser auth
client that retained a failed token request; a segment-only retry does not do
that in the installed adapter. The existing token quota remains in force. Local
capture tools use separate client IPs and bounded quiet intervals that respect
`X-Retry-After`. Better Auth 1.6.33 resets its counter after the full quiet window
since the last accepted request, so a continuous capture can otherwise reach the
quota over more than one nominal window. No capture may silently sign in again.

### OS Digital OTP setup

OS Digital uses HTTPS JSON POST at `https://www.bulksmsindia.app/V2/http-api-post.php`.
Set `OSDIGITAL_API_KEY`, `OSDIGITAL_SENDER_ID`, `OSDIGITAL_ENTITY_ID`,
`OSDIGITAL_TEMPLATE_ID` and `OSDIGITAL_OTP_MESSAGE` in Convex. Never expose the
key in a `NEXT_PUBLIC_` variable. The approved message must contain exactly one
`{#var#}` placeholder. The server replaces only that placeholder with the code.
The selected sender is ENVRIN. Confirm both DLT IDs in the account before enabling.

The message approved by the owner is: “Your OTP is {#var#} to Verify Your ENVIRON
INDIA account. Please do not share with anyone.” Keep it on one line in the setting.
Partial OS Digital settings disable sending; they never fall back to MSG91 or
code logging. With no OS Digital settings, the existing MSG91 configuration
continues to work. Status notifications retain their separate provider setup.

Each request contains one Indian mobile number. Credentials and message content
stay in the JSON body. Requests reject redirects, stop after eight seconds, and
never retry automatically. Acceptance requires `status: OK` and exactly one matching
recipient with `status: SUBMITTED` and a message ID. Acceptance is not handset
delivery. Provider and transport failures have a generic error without keys or codes.
A failed or uncertain send still consumes quota. Resend is always a user action.
The five failed verification attempts per code remain separate from send limits.

The existing HTTP endpoint queues delivery, so its response confirms scheduling,
not provider acceptance. Confirm both provider acceptance and receipt on the handset
before claiming live setup. Registration and household sign-in use this same code path.

### Late results

Removed sign-in, binding and factor forms ignore late local results. Household
booking checks its screen lifetime after each wait, profile request, upload and
booking request; an old completion cannot clear a newer draft or navigate.
A dispatched server request can still complete. Better Auth uses shared browser
cookies: concurrent completed sign-ins can select the account in HTTP response
order. These UI guards do not control HttpOnly cookie writes. Every sign-in still
requires all of its configured factors.

### Atomic auth updates

The installed Convex auth adapter has no native `incrementOne` and does not wrap
its read/write fallback in a transaction. Luma routes the installed library's
factor-failure increment, expired-lock reset, guarded backup-code replacement
and database rate-limit operations through `convex/betterAuth/atomic.ts`.
Each guard and update executes in one transaction. Backup replacement keeps its
existing audit callback in that transaction. The adapter wrapper accepts only
the known operation shapes and keeps the existing ID/date mapping. There is no
new root browser endpoint, table or data migration. Retain the concurrent
actual-adapter and HTTP-handler tests when updating either auth dependency.

Phone binding also checks the observed session after each wait and within its
send helper. A same-user session rotation keeps entered values but prevents an
old result from dispatching, reporting success or refreshing the newer session.
The account form remains keyed by user so required same-user factor rotation
does not erase revealed recovery codes.
