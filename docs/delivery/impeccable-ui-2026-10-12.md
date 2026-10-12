# Impeccable platform UI release — 12 October 2026

Status: implementation, browser evidence and both Word reviews are complete. Local release checks pass. Hosted PR and deployment verification are pending. No release is claimed.

## Scope and baseline

User request: review all open dependency-bot PRs; close unsuitable updates, retain needed updates; install Impeccable; rewrite platform UI pages; commit, push and deploy.

Baseline: origin/main `4f704d44f47c83bb4d527a4eff2eb7ec5afd5c6d`. Branch: `codex/impeccable-platform` in the managed `luma-impeccable-ui` checkout. The dirty primary prototype checkout is excluded.

Change necessity: consistent page composition, reading order and task density across public, account, application, operational and admin surfaces. Preserve the current UI contract, all locales, provider configuration, exact amounts and authentication boundaries. Architecture review: no new backend, schema, route or authorization owner; presentation and development guidance only, plus the reviewed framework security patch.

Impeccable 4.4.0 is vendored from the installed local skill with LICENSE and NOTICE. The project UI contract has priority. Skill tooling is development-only. The initial context launcher could not execute; source and product documentation provide the context directly.

## Dependency decisions

- #50: closed unmerged, head `0f395496043330bf5056178ab4a244b66854c517`. Expo validation rejects React Native 0.87.1 and safe-area 5.10.1; the installed SDK expects 0.86.3 and ~5.7.0.
- #51: closed unmerged, head `05f78007708f177d7b667597e23627d1dfa0c7aa`. Mobile React 19.3 conflicts with Expo's expected React/React DOM 19.2.3 and React types ~19.2.4.
- #53: closed unmerged, head `f14e78f4861e01e0f3b6c16019620b35f68c2222`. Optional test-tool patches are not required for this release; current guide evidence hashes fail after the manifest change. No application failure is inferred from those freshness failures.
- #54: closed unmerged, head `38e1eeff355e084db5383d1bf22d575330ecf32b`. Lint update reports 563 errors and 22 warnings, plus stale guide evidence. A separate lint migration is needed.
- #52: required security update from Next.js 16.3.6 to 16.3.8, with matching eslint-config-next. The two failed tests require current guide screenshots/source evidence. Patch retained in this release; the bot PR remains open until its replacement is verified and merged.

All five bot branches were preserved. Native desktop packaging was skipped by the PR workflow; this is not signed-app delivery evidence.

## Execution plan

1. Inventory every route family and inspect current UI. Establish a clear, practical reading order within the approved visual identity.
2. Update public composition, shared page headers, navigation frames, auth/application forms, account and operational layouts, and admin surfaces. Preserve workflow behavior and translations.
3. Add browser coverage for representative page families, responsive layouts, theme states and RTL. Retain existing behavioral tests.
4. Capture current public and protected evidence with accurate provenance. Update guide source, rebuild DOCX, inspect every rendered page, and record any cloud connection gate.
5. Run formatting, pnpm check, production build and browser checks. Review the complete diff; push a PR, require current-head CI, verify preview, merge and verify production.

## Current checkpoint

Completed: isolated checkout; bot review and four verified closures; Next.js patch applied; Impeccable added.
Completed: shared layout implementation and source formatting; 2,342 application tests; native checks; final type checks and production builds; 753 full public browser cases plus 11 final layout/theme cases; five consent cases; 126 fixture originals and 259 public/fixture/team originals reviewed; 72-page team Word review.
Completed: 450 lots, 246 refinement and 342 workbook views captured and independently reviewed; refinement retains 18 unavailable accepted-order states as skips. Current admin, prices, public, fixture and API evidence is also reviewed. The default `pnpm build` passes.
Completed: all 166 final platform Word pages and all 72 team Word pages pass visual review. The builders confirm current source, screenshot and DOCX hashes.
Completed: final `pnpm check` passes with 279 web test files / 2,369 tests, 49 mobile tests and 22 desktop tests. Lint has zero errors and 30 warnings; formatting and the default production build pass.
Pending: commit, push, PR, merge and production verification.

## Layout assessment and design direction

64 page definitions were inventoried: 14 public, 5 auth, 6 join, 5 account, 1 tracking, 21 operator and 12 admin. Shared error/not-found states are also in scope. An independent Impeccable layout assessment inspected 11 current committed browser captures and source. New local baseline captures also cover the home, prices and login pages.

The reading order is task, current state, next action, then supporting records. Story pages retain their split editorial imagery. Operating screens use the approved fixed 24/30px title hierarchy. Auth puts the form first; the support image is secondary. Operator identity/device controls remain visible while the destination list scrolls. Account pages gain desktop section navigation. Admin uses a continuous working surface. Team actions wrap together under the selector. Evidence dialogs have consistent spacing and recipe fields pair on wide screens. Unavailable prices retain one static placeholder row instead of implying a long loading list.

No product facts, prices, translations, mutations, access rules, dataset or provider configuration were changed by this layout pass.

## Review and verification checkpoint

The first independent Impeccable review inspected 22 original captures and accepted the shared layout direction. Its greeting-order finding is fixed. A second evidence review found RTL error notices over the sidebar controls; the shared toaster now follows the locale registry and keeps admin independent of the translation provider. The failure capture runner checks that desktop notices and the sidebar do not overlap. Active-page borders are retained as functional location markers, not decorative cards.

The first complete disconnected production browser suite passed all 753 cases. This run predates the final toast placement repair; targeted and final checks follow that repair. Four notice-direction tests cover English, Arabic, Urdu and English-only admin. The required Next.js patch is [16.3.8](https://github.com/vercel/next.js/releases/tag/v16.3.8).

The local test database was restored into this task's own directory using SQLite backup; its integrity check passed. The original saved database and credentials remain unchanged. The task uses a private copy of synthetic acceptance credentials and a copied local backend on ports 3210/3211; its frontend origin is 3115. No cloud deployment, production record, provider call or real customer data was used for this capture setup. An unrelated project owns port 3100 and was left running.

The Google Docs connector reported no connected document session. The existing document ID and sharing settings are preserved. Cloud publication is explicitly pending; do not infer a cloud update from the reviewed local Word file.

An independent final application diff review found no actionable regression in shared shells, auth/account layouts, RTL notices, workspace actions, production forms or price placeholders. Application diff SHA-256: `3eb595cffd75973fb920eb5f559b1591a677575dc8b5a65d9aac0b2b4885a0e8`. Capture helpers separately wait for image decode/paint, require settled admin data, and reject localized error boundaries. The changed capture helpers pass focused lint.

A final independent review of the nine capture/helper/test files found no actionable regression. The 30-second readiness assertions preserve the existing checks; privacy rules, real sign-in, blocked writes, rate-limit failures, source hashes and manual visual review remain required. The origin tests accept canonical loopback HTTP origins only.

The final Word review corrected split table rows, a wrapped step label and an orphaned screenshot provenance note. All 152 platform table rows now prohibit splitting. The final platform review verifies 127 exact page-image carryovers and 39 newly inspected pages; all 72 rebuilt team pages match the reviewed images exactly. These review methods and hashes are recorded beside each guide.
