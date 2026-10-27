# Web UX simplification — 27 October 2026

The owner approved the review list and authorised implementation, tests, commit,
push, checked PR merge and Production release to luma.green. No Preview deploys.

## Constraints

Preserve native work in the primary checkout. Use current Astryx actions,
semantic themes, Geist/Noto, all 33 locales and RTL. Preserve auth factors,
explicit age/privacy choices, provider limits, private files, exact units and
audited business transitions. No destructive record migration. Guide updates
remain deferred. Use read-only live checks; no live SMS or paid provider tests.

## Plan and acceptance

1. Sign-in: remove forced language selection, put phone/code in one journey,
   preserve number on edit, return destination and required factors. Add regressions.
2. Registration: integrate explicit consent with the first form, save it once per
   application, combine business details/documents, resume the incomplete section,
   expose workspace immediately after activation. Preserve drafts and failures.
3. Booking: keep two clear stages, progress/review and missing-item guidance; repair
   declined-booking retry for photo-first requests without exposing private files.
4. Public/daily work: whole-card navigation; role-specific mobile destinations;
   pending tasks before metrics; contextual records, list-state recovery, compact
   help and corrected obsolete copy; admin queue/detail and next-item navigation.
5. Verify: focused red/green regressions, full pnpm check, formatting, build and
   relevant browser suites. Inspect light/dark phone/tablet/desktop, RTL and scripts.
   Review the integrated diff, resolve findings, PR checks, merge, Production verify.

## Delivery ledger

- Baseline: isolated worktree from origin/main. Primary Android changes untouched.
- Approved review is the specification. New findings may be fixed within its scope.
- Protected fixtures prove UI behavior only; do not claim provider acceptance.

## Implemented scope

- Phone-first sign-in with optional language control; number and code on one
  route, number edit retained, pending code resumed after reload. Only a full
  verified session can finish; consumed challenges are cleared.
- Compact explicit registration consent, saved once on the application. Shop
  and Saathi entry include the first name field. Business entry leaves existing
  PAN discovery reachable and retains mandatory GST detail confirmation.
- Business details and documents stay mounted in one journey. Schema issues
  select the incomplete section. Activation opens the workspace directly.
- Two-stage photo booking adds progress, review, field errors, missing-choice
  guidance and explicit phone/location limitations. Back retains files/values.
- Declined retry preserves safe mode and a valid slot, clears the old shop and
  returns to the current form. Private tracking does not supply photos or contact
  fields; the screen explicitly asks for them again rather than copying files.
- Homepage role images, headings and actions share one link. Daily work precedes
  totals. Mobile navigation exposes up to four daily destinations and reduces
  that count when translated labels need more space, keeping More reachable.
- Market material and trade direction choices survive return navigation within
  their workspace. Request tabs and list positions recover. Report detail closes
  to its retained list, scroll position and keyboard target.
- Inspection links open permitted quality uploads/report creation with the
  inspection selected. Existing lot dispatch and trade receipt actions remain
  next to their records. The server still owns all record permissions.
- Admin queue and selected review share a workspace. Decisions retain their
  explicit confirmation; completed reviews offer the next pending application.
- All 33 catalogues correct photo-first help, private photo handling, five-minute
  OTP timing and manual shop retry. Translation drafts need native review.

## Review and recovery

The source review identified and corrected a stale trade tab after explicit
same-route navigation, focus recovery after a decided queue row disappears, and
OTP-stage loss after reload. The OTP reload test failed before the repair.
Focused baseline regressions also reproduced the inactive role images, two-item
mobile navigation and totals-before-work layout before their repairs.

The Mac application was restarted during validation because of limited resources.
Interrupted lint/build runs are not passing evidence. Resume from this worktree;
run one heavy job at a time with bounded test workers. No code was committed or
released before the restart. Do not include unrelated Android edits from the
primary checkout.

## Final local verification

- `pnpm check`: passed. Lint has zero errors and 65 existing warnings; web/backend
  tests passed 308 files and 2,602 tests. Native compatibility passed 50 mobile
  and 23 desktop tests. No native source changed.
- Public browser suite: 593 passed. Mobile navigation: 462 language/theme/width
  views passed, including hidden-desktop to narrow-phone resize recovery.
- Current evidence retains 84 labelled component captures and four public build
  captures. Representative layouts were visually reviewed. Protected fixtures
  disable writes and do not prove authenticated provider execution.
- Dark booking input computed styles use the expected semantic card token.
- Fresh Production build (`next build --webpack`): passed, all 3,119 pages.
  Existing Sentry/OpenTelemetry dependency warning remains. Hosted release
  status will be verified at the merged commit.
