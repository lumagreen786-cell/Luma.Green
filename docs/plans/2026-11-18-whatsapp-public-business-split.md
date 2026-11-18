# WhatsApp booking and public/business site split

Status: planning. Updated 18 November 2026. No provider activation, DNS change,
implementation, or deployment is recorded by this plan.

## Owner decisions

- Homes and waste generators can book and manage collections through WhatsApp,
  without a Luma account or an app download.
- The website opens WhatsApp with a prefilled message. The customer taps Send
  to start the bot. Do not ask for a phone number on the website for this path.
- Use the selected Afterlife design. Keep the story-first household flow,
  real Luma logo, light/dark modes, and dark photo overlays with white text.
- Separate household marketing from the business ecosystem and workspaces.
- Use `luma.green` for public marketing and WhatsApp booking, and
  `business.luma.green` for the business ecosystem, applications, sign-in, and
  operational workspaces. The owner requested this domain split in the plan.

## Domain and page ownership

| Domain                | Audience and content                                                                                                                                                              | Main action                      |
| --------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------- |
| `luma.green`          | Homes, apartments, shops, offices, and other waste generators. Campaign landing page, pickup steps, accepted waste and service-area information, short FAQs, privacy and support. | Book pickup on WhatsApp          |
| `business.luma.green` | Kabadiwalas, preprocessors, recyclers, manufacturers, and Saathis. The full ecosystem, role details, applications, secure sign-in, and operational workspaces.                    | Choose a role, apply, or sign in |

The public site has a clear Work with Luma link to the business domain. The
business site links back to Book a pickup. Campaign links and QR codes lead to
the public domain. Keep the business ecosystem out of the household landing page.
Keep one codebase and one Convex backend; separate domain routing, page layouts,
navigation, and metadata. The domain split does not replace backend role checks.

Replace the existing marketing page collection with these focused destinations.
Map every old public URL before removal. Redirect to the relevant page or section,
preserve locale and useful campaign parameters, and avoid redirect loops. Keep
privacy, support, service status, existing booking access, and operational flows
reachable. Do not redirect existing booking links to a generic marketing page.
Keep the supported web booking option reachable for users who prefer it.
Confirm the admin host mapping during the route inventory; do not move or expose
admin routes merely because the public/business domains are split.

## Customer and operator flow

1. Customer opens the prefilled WhatsApp message and taps Send.
2. Bot collects private photos, service city, location/address, access details,
   and an available date/time. Confirm the city explicitly.
3. Customer reviews and confirms the request. A request receipt does not claim
   collector acceptance.
4. Existing eligible collectors receive the request in the web or Expo workflow.
5. Acceptance, rejection, reassignment, rescheduling, and collection updates return
   to the customer through the same Luma WhatsApp conversation.
6. Collector records measured quantities and payment. Customer receives the
   recorded outcome and can give feedback or ask for support.
7. Support one-time and repeat schedules, reminders, pause, skip, change, and
   cancellation. Each occurrence must pass current service and capacity rules.

Use a two-way booking conversation through Luma. Customer replies return to the
same booking. Human handoff pauses the bot. Do not require household weight
estimates or invent prices, receipts, payment execution, or collector acceptance.

## Provider and backend approach

Kapso is the working provider choice, subject to confirming the intended account,
Luma number, current features, eligibility, pricing, and approved spend. Use its
workflow tools for conversation steps. Convex owns booking state, authorization,
capacity, dispatch, recurrence, audit records, and reminder timing. Reuse the
existing collection code and private R2 file handling.

Use a low-cost LLM only for intent, language assistance, approved answers, and
support summaries. Validate structured results and show exact dates before
confirmation. Keep booking available when the model fails. Set usage limits;
do not send private records or full conversation history without a defined need.

Add a narrow authenticated provider entry point through Convex HTTP actions.
Verify webhooks, bind actions to the trusted sender, prevent replay and duplicate
bookings, and restrict each sender to their own channel-scoped records. Do not
link existing accounts solely by matching phone text. Preserve normal web and
business authentication. Keep secrets in the matching Convex deployment.

Record messaging and repeat-booking consent. Support opt-out. Use approved
templates when required outside the customer-service window. Native WhatsApp
form screens depend on current Meta eligibility. Define file/message retention
across Luma, Kapso, and Meta before live use.

## Visual direction

Use Story first with Orbit: dark-first and light appearance, lime/forest semantic
tokens, Geist/Geist Mono with Noto fallbacks, clear type hierarchy, restrained
chrome, and generous spacing. Follow current owner instructions when older local
design documents disagree. Use bounded corners for wrapping controls and 44px
header utility targets. Use UI/UX Pro Max OLED, UX, stack guidance, and the
pre-delivery checklist without replacing Luma tokens.

The public first screen has one main action: Book pickup on WhatsApp. Show the
prefilled-message/Send example, three short steps, and a Work with Luma link.
Keep illustrative chat clearly identified as an example. Business pages explain
the chain and route each role to its secure application or workspace.

## Delivery sequence

1. Inventory current pages, booking links, applications, auth callbacks, native
   links, canonical URLs, sitemap, robots rules, and admin routes. Define the
   two-host route and redirect map before changing routing.
2. Implement the selected page design and domain-aware navigation. Replace old
   marketing pages with relevant destinations and retain required support/legal
   access. Update translations and domain-specific metadata.
3. Connect Kapso to existing collection rules: intake, review, booking, operator
   acceptance, private photos, and status replies.
4. Add two-way messages, repeat scheduling, reminders, feedback, opt-out, and
   human handoff with delivery status and failure handling.
5. Configure DNS and deployment hostnames for the exact approved domains. Review
   Better Auth trusted origins, callback URLs, cookie scope, session behavior,
   cross-origin protections, and uploads. Do not widen cookies or trusted origins
   as a shortcut.
6. Validate, follow checked PR controls, deploy the backend before dependent
   frontend changes, and verify both Production hosts and live provider behavior.

## Acceptance and release checks

- Tests cover forged/replayed/duplicate webhooks, unauthorised booking access,
  private media, full slots, unsupported locations, rejection, rescheduling,
  recurrence, opt-out, delayed delivery, and model/provider failure.
- Cross-domain navigation, sign-in/out, callbacks, sessions, uploads, tracking
  links, and redirects work with the intended locale and destination.
- Review Expo and Electron navigation allowlists, hosted-screen links, external
  WhatsApp opening, and auth returns. Preserve shared screens and existing update
  guards. Native binaries, OTA, and store publication remain separate.
- Inspect actual pages in both themes at phone, tablet, and desktop widths,
  including long translations and RTL. Check fonts, labels, focus, and overlap.
- Run `pnpm check`, the Production build, and relevant browser/platform checks.
- Review PostHog and Sentry: consented public events only, redacted failures, no
  phone numbers, photos, exact locations, message contents, or private records.
- Verify DNS/TLS, both Production hosts, correct canonical URLs, and old-link
  redirects. Verify real WhatsApp delivery separately with an approved recipient
  and allowance. Local tests do not prove provider acceptance.

## Open setup decisions

- Confirm the Kapso account and dedicated or existing Luma WhatsApp number.
- Choose the first service cities, languages, and messaging/LLM budget.
- Decide whether repeat pickups need customer confirmation for each occurrence;
  customer confirmation is the current recommendation, not a recorded decision.
- Confirm DNS access and existing domain/auth configuration before mutation.
- Finalise webhook trust, retention, template approval, and the admin host mapping.

No domain configuration, paid setup, template approval, live message delivery,
or production availability is established by this planning document.

## Domain rollout sequence — 18 November owner update

Use one Next.js deployment and the existing production Convex backend for both
hosts. No second production database is needed. Keep the separate development
Convex environment. Hostnames select pages; Convex authorization selects records.

1. Inventory existing locale routes, protected routes, email links, booking links,
   auth callbacks, and native shell URLs. Record each destination and redirect.
2. Add host-aware routing in the shared Next.js proxy. The apex serves household
   marketing. The business host serves ecosystem, role, application and workspace
   pages. Preserve explicit locale prefixes and admin protection. Unknown hosts
   must not select a privileged surface. Keep localhost preview routing explicit.
3. Use host-specific navigation, canonical metadata, robots rules and sitemaps.
   Old business URLs on the apex redirect to their matching business-host routes,
   preserving locale and safe query parameters. Avoid blanket homepage redirects.
4. Verify Better Auth trusted origins, callback URLs, cookie scope, logout,
   invitation/password-reset links and session expiry on the business host.
   Prefer host-only cookies; do not widen cookies across subdomains by default.
   Keep the apex auth proxy reachable until old links and native shells are checked.
5. Add business.luma.green to the existing Vercel project. Read the exact DNS
   record Vercel supplies. At Spaceship, first verify the authoritative DNS host;
   if it is elsewhere, make the record there. Add only the business record. Do not
   alter apex, mail, verification, or unrelated records. Wait for DNS and TLS.
6. Verify both hosts, locale links, auth, authorized/denied access, private photos,
   collector flows, WhatsApp entry, Expo/Electron hosted links and analytics consent.
   Update allowed Turnstile hosts only if used. Production backend settings stay
   in Convex; only frontend/build settings belong in Vercel.
7. Release through checked PRs. Keep an explicit rollback to the previous routing
   and deployment. DNS/TLS success is separate from login and booking acceptance.

Spaceship sign-in can happen when the route changes and Vercel domain target are
ready. Do not put account credentials into chat. No DNS or provider settings have
been changed by this plan.

## Homepage motion preview

Magic UI's iPhone frame hosts a labelled WhatsApp-style example: customer message,
photo, location and slot, request receipt, then collector acceptance. It loops through 15 conversations while visible, without playback controls or
in-chat example labels. Reduced-motion users see a static conversation. The brand
icon comes from Simple Icons. Existing GSAP supports a brief section entrance.
Keep native page scrolling. Marquees or scroll snapping are optional, not required
for this flow. No animations imply real provider activity or a real booking.
