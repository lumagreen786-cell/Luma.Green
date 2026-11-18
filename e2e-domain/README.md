# Business-domain hydration regression

Run `pnpm exec playwright test --config playwright.domain.config.ts`.
Install Playwright Chromium first. For a locally cached executable, set
`PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` to its absolute path. The TLS fixture uses
`/usr/bin/openssl` (macOS/Linux).

CI can set `LUMA_DOMAIN_REUSE_BUILD=true` after a build with
`NEXT_PUBLIC_BUSINESS_SITE_ENABLED=true`. This skips only the build; the real
HTTPS server, rewrite, hydrated navigation and strict error checks still run.

This suite builds the actual app with the business split enabled and telemetry
and Convex disconnected. It serves the production build through Next's request
handler with `business.luma.green` as the hostname. Chromium maps that hostname
and its HTTPS port to a loopback-only server. A temporary self-signed certificate
is used only for this local test. It does not contact the production domain.

Both English `/` and Arabic `/ar` must keep their visible URL, render the business
page through the real proxy rewrite, and hydrate the business navigation and
appearance control with no console errors or page errors. HTML and middleware
responses are not mocked. Canonical HTTPS redirects and route prefetches use the
same local server. Reused configured builds contain test telemetry keys, so only
PostHog/Sentry/GA provider requests and the Vercel insights endpoint are served
deterministic test responses. First-party page/script/navigation requests remain
real. Every console error and page error still fails the test.

The original static build reproduced React 418 for both routes: the server
prerender saw `/business` while the browser saw `/`. Header navigation now reads
both pathname and host inside the existing external-store client snapshot. A
stable public-navigation fallback is used for server rendering and hydration;
business navigation replaces it after mount. No `suppressHydrationWarning` or
error filtering is used. This follows the Next.js documented rewrite pattern:
https://nextjs.org/docs/app/api-reference/functions/use-pathname#avoid-hydration-mismatch-with-rewrites
