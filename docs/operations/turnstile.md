# Turnstile for phone codes

Status: implemented locally, off until configured. Provider and signed native
acceptance remain production activation gates.

## Scope and design

Every current phone-code form calls `requestPhoneCode`: member/admin login,
verification-page resends, household sign-in and account phone binding. Each call
obtains a new token from an **Invisible** Cloudflare Turnstile widget. The script
loads only when a code is requested. Tokens are not cached, logged or persisted.
Existing translated send-failure messages handle bot failures; buttons recover
after errors or bounded timeouts. No new user-facing copy or layout is introduced.

The Better Auth HTTP hook in Convex validates the proof before reserving a phone
quota or creating a code. This also protects callers that bypass the Next.js
proxy. Cloudflare must return `success: true`, action `otp_send`, and an exact
configured hostname. Verification has an eight-second timeout and no automatic
retry. Cloudflare enforces single use and five-minute expiry. Missing, invalid,
expired or reused tokens are denied. Outages and invalid enabled configuration
fail closed. No authentication factor, session or phone quota is bypassed.

This is an HTTP hook, not a new Better Auth plugin; no auth schema change is
needed. Native shells allow the exact HTTPS Cloudflare challenge subframe and its
local `about:blank`/`about:srcdoc` frames, only below the trusted app document.
These receive no native bridge trust or device permissions. Rebuild native apps
before enforcing the gate for their users. Hosted WebViews must use the normal
trusted site URL, not a local HTML or `about:blank` wrapper.

Existing third-party-cookie blocking remains in the mobile shell. The real-device
gate must check cookie/storage behavior against Cloudflare's
[mobile guidance](https://developers.cloudflare.com/turnstile/get-started/mobile-implementation/).
Do not enable the production gate for native users until that acceptance passes.

## Account and settings

Create one Cloudflare account at <https://dash.cloudflare.com/sign-up> if you do
not already have one. Enable account two-factor authentication. Add a Turnstile
widget named `Luma.Green production`, select **Invisible**, and add only the
hostnames that actually serve the app. No DNS or hosting migration is required.
Use a separate widget and secret for staging.

| Setting                          | Where                             | Value                                                              |
| -------------------------------- | --------------------------------- | ------------------------------------------------------------------ |
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY` | Vercel frontend build environment | Public widget site key                                             |
| `TURNSTILE_SECRET_KEY`           | Matching Convex deployment only   | Private widget secret                                              |
| `TURNSTILE_HOSTNAMES`            | Matching Convex deployment only   | Comma-separated exact hostnames, no scheme, path, port or wildcard |
| `TURNSTILE_ENABLED`              | Matching Convex deployment only   | `true` to enforce; absent or `false` leaves the gate off           |

Example host list, **only if all these hosts are in use**:
`luma.green,www.luma.green,lumagreen.vercel.app`. The host is the frontend where
the widget runs, not the Convex API host. Cloudflare allows subdomains through
its widget configuration, but this app deliberately requires exact matches.
Public site key changes require a new frontend build. Never put the private
secret in Vercel public settings, Git, screenshots or chat. Cloudflare's dummy
test secrets are explicitly rejected by the backend, including on staging.
Local unconfigured clones keep working; automated tests mock the provider.

## Activation sequence

1. Publish the site's privacy notice before enabling the widget. Invisible mode
   requires a reference to the [Turnstile Privacy Addendum](https://www.cloudflare.com/turnstile-privacy-policy/).
   The current repository has no complete public privacy-policy page. This is an
   explicit launch gate, not a claim that an internal document satisfies it.
   Include this disclosure in the reviewed, translated notice:
   “We use Cloudflare Turnstile to limit automated requests for sign-in codes.
   Cloudflare processes browser and device signals for this check. Luma.Green
   sends the challenge token to Cloudflare for verification; it does not send
   your phone number or SMS code to Cloudflare. See the Cloudflare Turnstile
   Privacy Addendum.”
2. Deploy the backend code with enforcement still off. Set its secret and exact
   hostname list. Deploy the frontend with the public site key and rebuild the
   mobile/desktop shells that have the old frame restrictions.
3. In staging, enable enforcement and test real normal/admin sends, resends,
   authenticator challenges, account phone binding, and household login. Test
   current iOS/Android WebViews and desktop binaries on their trusted HTTPS site.
   Verify keyboard use, retry states, light/dark themes and RTL scripts. Mock
   responses and policy tests do not prove Cloudflare or native-device acceptance.
4. Set production `TURNSTILE_ENABLED=true`. A direct request without the header
   must return 403 before SMS work. Test one consented real phone flow and check
   Cloudflare token-validation analytics. Keep tokens and OTPs out of evidence.
5. If rollout fails, investigate key/hostname alignment first. An operator can
   explicitly set `TURNSTILE_ENABLED=false` to roll back enforcement. That removes
   bot protection but preserves all previous auth controls; never auto-fail-open.

The frontend and backend cannot atomically receive configuration. Use a short,
controlled activation window. Old open tabs without the new client need a reload.

## Tests

- `convex/turnstile.test.ts`: actual Better Auth HTTP handler and Convex adapter,
  missing proof, invalid result, hostname/action mismatch, provider outage,
  configuration errors, repeated verification and test-secret rejection.
- `convex/auth-sms.test.ts`: valid bot proof proceeds through real code creation,
  and early resends still fail without replacing the original code. SMS is mocked.
- Browser helper and shared phone-client tests cover new tokens, script failure,
  cleanup and bounded waits. Existing form and factor tests remain in place.
- `pnpm exec playwright test --config playwright.turnstile.config.ts`: isolated
  browser fixture bundles the real shared send helper and intercepts both vendors.
  It proves token forwarding, new resend tokens and blocking before SMS on failure.
  It is not a screenshot of the application or proof of live provider execution.
- Native policy tests check exact subframe origin/path and top-level rejection.

## Cost and one-account strategy

Checked 15 October 2026 against the official pricing pages:

- [Turnstile](https://developers.cloudflare.com/turnstile/plans/): free, including
  invisible widgets and unlimited challenges; up to 20 widgets and 10 hostnames
  per widget. It works independently of other Cloudflare products.
- [R2 Standard](https://developers.cloudflare.com/r2/pricing/): monthly free tier
  of 10 GB-month storage, 1 million Class A and 10 million Class B operations.
  Above that: $0.015/GB-month, $4.50/million Class A and $0.36/million Class B;
  direct egress is free. Operations still cost money above the allowance.
- The same Cloudflare account can later hold DNS/CDN/security configuration,
  R2 buckets and Workers. Each product has separate setup, limits and billing.

Convex remains the owner of application data and identity documents. Private
quality attachments can use the implemented [R2 path](../architecture/r2-storage-plan.md).
Public media, release files and backup workflows need separate designs. No bucket, storage migration, DNS change or paid
subscription is created by this implementation.
