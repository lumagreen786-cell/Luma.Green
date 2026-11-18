# Afterlife admin pages — 18 November 2026

## Scope

The admin uses the same Afterlife tokens, typography and light/dark appearances as
the public and business app. This is one admin, one authentication system and one
Convex backend. No separate admin service was added for the business subdomain.

This pass changes page composition, not records or permissions. It preserves
phone-code and authenticator checks, server authorization, retained evidence,
exact money/weight formatting, provider checks and explicit action dialogs.

## Route changes

| Route                                             | Composition and actions                                                                                                                                                                                                                                                                          |
| ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `/admin`                                          | Large task heading and report action. Open three-column queue summary with real counts. Priority applications remain before recent account records. Supporting task links sit in a narrow column.                                                                                                |
| `/admin/verification`                             | Open queue sections with compact headings, real counts and tables. Selecting a record keeps the queue mounted in a narrow desktop column, with a separated detail workspace. Phone focus/return behavior is unchanged. Stakeholder review is a separate open section below.                      |
| `/admin/verification/[id]`                        | Record title, status and metadata above application/document/history tabs. Checklist and decision actions stay in a bounded adjacent panel. On phones the content stacks. Private document controls, checklist gating and decisions are unchanged.                                               |
| `/admin/prices`                                   | City scope and reference rules in a narrow context column; editable price groups in the wider record column. City controls stack within the narrow desktop column. Catalogue setup, translations and classification sit below the price workspace, rather than inside the price record column.   |
| `/admin/operations`                               | Open material/facility/destination tabs. Evidence forms use divided sections and paired fields. Collection reassignment and apartment route forms sit below in two desktop columns. Scope warnings, references and eligibility checks remain visible.                                            |
| `/admin/payments`                                 | Heading, provider activation boundary and organization reference list align in two columns. Payment policy/evidence sections use dividers. Draft price-book and invoice forms sit beside each other on desktop and stack on phones. Saving a reference or policy still does not enable payments. |
| `/admin/pilot`                                    | Period controls, open metric strip, divided chart/table sections and a separate measurement-limit section. All numbers still come from the existing query and retain their units.                                                                                                                |
| `/admin/support`                                  | Filter strip above full-width ticket rows, replacing two-column nested cards. Contact, evidence and resolution actions stay with their request. Privacy requests remain a separate divided section.                                                                                              |
| `/admin/account-removals`                         | Open request rows with status/time on the left and evidence review or retry controls on the right. Retention warnings and references remain visible.                                                                                                                                             |
| `/admin/login`, `/admin/setup`                    | Existing image and dark scrim, white task title on the left, one bounded form panel on the right. Mobile layout stacks title and form. Shared header retains the logo and appearance control. No login shortcut was added.                                                                       |
| `/admin/forgot-password`, `/admin/reset-password` | Existing redirects to the current phone-code sign-in remain unchanged.                                                                                                                                                                                                                           |
| Admin error boundaries                            | Auth failures use the same focused shell. Console errors use an open recovery section. Session recovery copy now correctly names phone code and authenticator.                                                                                                                                   |

The console masthead uses a flat navigation strip with a lime active underline.
All eight destinations remain visible. It becomes two columns on small phones.
Name, appearance and sign-out controls remain accessible. Loading/denied states
retain the existing authorization boundary.

## Checks and evidence

- `VITEST_MAX_WORKERS=2 pnpm exec vitest run src/components/admin 'src/app/admin/(console)/layout.test.tsx' --testTimeout=15000`:
  **35 files, 152 tests passed**. Tests cover authorization gates, queue focus,
  decisions, private files, exact values, failure retention and payment controls.
- The first run found one obsolete assertion that required the old navigation
  panel class; that assertion was removed. The behavioral navigation assertions
  remain. The payment policy test exceeded the default 5-second timeout under
  concurrent local load; it passed unchanged with the explicit 15-second bound.
- Admin source ESLint and a subsequent `pnpm exec tsc --noEmit` passed. Final
  application build belongs to the shared release check.
  An earlier parallel typecheck saw missing `.next/dev/types` files during the
  dev-server restart; this was not reported as a passing typecheck.
- Actual local `/admin/login` rendered at 320, 768 and 1440 pixels in both themes
  with no document overflow. No OTP was sent and no authenticated acceptance is
  claimed from these captures.
- Nine isolated component fixtures were rendered from existing component tests
  and inspected in the browser at 320 and 1440 pixels in both themes. The captures
  carry a visible synthetic-fixture notice. They are layout evidence only.
  They do not establish live admin access, provider execution or real records.
- Temporary fixture test files were removed. No public fixture route or
  authentication bypass was added.
- Local capture directory: `/private/tmp/afterlife-admin-fixtures/`.
  `layout-results.json` records the initial matrix; `shell-layout-results.json`
  supersedes its shell rows, which initially used an oversized mocked appearance
  label and an extra outer wrapper. The corrected shell uses the real theme
  control, with document width equal to viewport width in both themes.
- Logs: `/private/tmp/afterlife-admin-tests-final.log`,
  `/private/tmp/afterlife-admin-lint-final.log`.

## Boundaries and remaining acceptance

No additional product event or error hook is needed: this changes composition
without adding a journey or mutation. Existing PostHog consent boundaries and
Sentry handling remain unchanged. No private form content is captured.

Authenticated browser acceptance across every populated route, alternate form
state and provider response is still required with authorized test access.
Component fixtures and unit tests do not replace it. Admin is English-only;
translated and RTL coverage is owned by the shared/public app pass. No native
binary or device acceptance is claimed. No screenshots or user-guide artifacts
were regenerated for publication. No commit, push or deployment was made by this
admin subtask.
