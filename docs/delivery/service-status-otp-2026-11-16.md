# Service status and SMS repair — 16 November 2026

## Request and sources

The owner requested a public API status page, diagnosis and repair of missing
OTP messages, and merging valid open PRs. The three supplied onboarding images
and the shared Gemini chat are reference evidence. The Gemini chat includes
proposed stack replacements, simulations and broader product work; those are
not instructions to perform that work. Existing Convex/Next.js ownership,
privacy, provider limits and the active design contract remain authoritative.

The original `feat/orbit-redesign` commit `a2a5674` and three untracked PDFs
were preserved. This change starts from checked main, without including the
unmerged full redesign. The new page uses shared semantic theme tokens.

## Findings and repair

The public production auth session endpoint responded with HTTP 200. All five
OS Digital settings existed and passed format checks without printing values.
One production SMS was sent with the owner's explicit recipient and allowance
approval. OS Digital accepted it; the owner confirmed handset receipt. No
further SMS was sent. This establishes current provider delivery to that one
recipient, not the cause of every earlier failed sign-in attempt.

The code returned sign-in send success after scheduling, before provider
acceptance. It now awaits the provider action and returns 503 on rejection.
Request quotas, authentication, factors and replay checks are preserved.
An additive aggregate health table stores only provider acceptance and time.
No migration of existing records or removal is needed. The endpoint is read
only and sends no paid probe messages. Old evidence becomes unknown.

## Review and release

PR #54 was reviewed and merged with green checks. PR #55 does not match the
Expo SDK's required React Native versions. PR #56 changes the auth adapter
contract and fails types/build/tests. Those PRs are not valid to merge as-is.
Dependabot rebased #57 and replaced #58 with #59 after the security merge;
the new heads require fresh checks and review.

Validation, release identity and final PR outcomes will be recorded below.
Guide impact: a new public status page and more accurate sign-in failure
feedback. User-guide artifact work is deferred until requested. The new
translations are machine drafts and still need native-speaker review.

## Combined local release checks

The release also includes the bounded document follow-ups and radius/header
repair recorded in the adjacent audit reports. The owner's requested Ponytail
skill is vendored with its MIT license and source commit under
`.claude/skills/ponytail`; `AGENTS.md` makes it part of coding and review.

- The final clean `pnpm check` passed with an 8 GB Node heap and two Vitest
  workers. Full lint reported zero errors and 132 pre-existing warnings.
- Web and Convex typechecks passed. The final webpack Production build passed
  against checked main's Next.js 16.4.6. Turbopack's local worker binding was an
  environment limitation; no Production configuration was changed for it.
- All 3,290 unit tests passed across 404 files in the final clean check against
  the merged dependency tree. An earlier run hit host-load timeouts; those
  suites also passed independently. Focused status/auth, dwelling, rate and
  footprint checks passed.
- All 28 security checks passed. Desktop 34, mobile policy 68 and mobile
  component 21 checks passed. No signed native binary or device acceptance is
  claimed.
- All 41 affected public browser checks passed on the final build. Captures
  are in `evidence/service-status-2026-11-16`. Separate visual checks covered
  dark/light desktop headers, Arabic phone privacy/estimate layouts, Kannada
  tablet registration and the repaired mobile menu.
- The connected saved-reading browser test is added to the foundation config.
  It was not run because the provisioned loopback session fixtures are absent.
  Backend/UI tests cover consent, exact calculation, ownership, persistence
  operations and account cleanup; this does not replace device acceptance.

PR #57 was reviewed and merged after its checks passed. PR #59 needed a main
refresh; its refreshed dependency tree passed local checks in an isolated
checkout and all active GitHub checks, including 942 browser checks. It merged
as `5c7a1dcc08f5289a026729b62da78f8d70b1ed8d`. PRs #55 and #56 remain unmerged
for the compatibility failures above.

The additive backend will deploy before the matching frontend after the
implementation PR checks pass. No Production completion claim is made here.
