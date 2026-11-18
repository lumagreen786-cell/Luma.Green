# Overhaul continuation and checkout recovery

## Active India-wide goal

The owner expanded the active work to all states/Union Territories and all
industries on 18 November. PET remains an integration journey within the full
platform. The persistent goal is active. The consolidated implementation plan
is [India-wide platform completion](../plans/2026-11-18-india-platform-completion.md).
Use this file as the continuation checkpoint, rather than separate records
for every agent or slice.

Current branch: `codex/india-platform-completion`, based on merged main
`f744e8f9569ddf0aa0eb0bcf18d63c4e3a4fb4dd`. Three initial audits cover supplied
sources, national taxonomy/geography and shared workflow gaps. Agents own
bounded files; the coordinator owns shared schema/API integration and releases.

Audit findings: the 419 workbook rows are not a national taxonomy; all 36
state/UT names already exist; participant request approval is deliberately
separate from verified operational activation; processing evidence is not yet
connected to authoritative stock; ordinary trade still follows four business
tiers. Existing family access, apartment routes, saved electricity logs and
draft billing must be reused. The primary checkout already has unrelated
in-progress paper/R2 migration work; do not create a duplicate storage owner.

The exact original six documents and six printed image paths are unavailable.
Attributed repository extracts remain. Preserve that source limit and ignore
handwriting. The official NIC 2025 workbook and PDF were retrieved for the
national catalogue audit. Verify hierarchy discrepancies against the PDF;
never manufacture a missing row to match a published count.

Active work: source coverage record, official catalogue integrity, and the
explicit participant activation contract. Next: implement national reference
selection, reviewed activation, transactional processing stock and
capability-based orders at existing owners. Reference coverage, tested
functional coverage and external acceptance remain separate. No overall
completion percentage has been established.

### First national coverage candidate

Local changes now include the complete 1,887-subclass official catalogue and
its authenticated search/facility selection, all 36 jurisdiction references,
the current-source inventory, explicit next-step policies for all 41
participant types, and a named-lot offer reservation repair. The facility
screen keeps national activities, workbook evidence and jurisdiction
references separate. All eight new interface labels are localized across
33 catalogues; source titles and authority notes remain labelled English.

The importer verifies both official file hashes and reproduces the data.
It preserves 22 sections, 87 divisions, 258 observed groups, 463 classes
and 1,887 subclasses. The release's 257-group claim and missing workbook
parent headings remain recorded discrepancies. The source files and
temporary verification logs live under `/private/tmp`; no private originals
or settings are added to Git.

The final `pnpm check` passed 3,519 application tests in 419 suites, 28 security
tests, 35 desktop tests, 69 mobile policy tests and 21 mobile component tests.
Lint has zero errors and the existing 123 warnings. The matching production
build passed all 3,681 pages. Whole-repository formatting passed; initial
lint and fixture type issues were corrected before the final check.

Independent review caught a selector mismatch: reserved lots were still
advertised as choices. The query now uses the same ownership, classification,
quality and reservation checks as listing creation. Known ineligibility
removes a choice; bounded-read failures and unexpected errors propagate.
The final full check includes this correction and its regression tests.

The local browser matrix passed 24 cases across English, Kannada, Arabic and
Urdu, both appearances, and 390/820/1440-pixel widths. Four additional phone
cases verify keyboard typeahead and the longest jurisdiction label. All
external requests and HTTP writes were blocked. Representative originals were
visually inspected. The 52 captures remain under
`/private/tmp/luma-national-reference-2026-11-19`; three labelled examples and
their hashes are retained in `docs/delivery/evidence/india-platform-2026-11-19`.
The production browser chunks do not contain the national catalogue; the
local fixture adapter's catalogue import is documentation-only.

The final Convex production dry run targeted `astute-peccary-795`, accepted
the schema and proposed the named-lot listing index with no index removals.

The checked PR, matching backend deployment and Vercel Production release of
this candidate remain pending. Browser fixtures do not establish real-account,
provider, permitting or native-device acceptance.

Phase 2 design must establish reviewed site capabilities before introducing
genuine trader, service-provider and generator kinds. Current generic homes
and unrestricted-kind `requireOrg` callers need explicit capability guards.
Also remove new-account promotion of reference fallback prices into live
rate cards. Phase 3 requires source balances and debit allocations at the
existing inventory ledger; unlinked aggregate stock cannot prove a receipt's
remaining physical source. The offer reservation repair alone does not enable
source-backed processing. See the two API contracts for these next slices.

## Restored files

The primary project remains at
`/Users/syedabdulmuqeeth/Developer/SandBox/luma.green`.
The separate historical checkout was removed on 12 November after a private
backup. It was restored on 18 November at
`/Users/syedabdulmuqeeth/.codex/worktrees/luma-overhaul/luma.green`.

The source archive SHA-256 is
`fa2638ef541ddb3cf48bd6e29e9cc3095f86a7fd92050a4b9dbde1cf6b8e65f2`.
All 3,843 restored file contents, internal skill links, staged Git status and
the unstaged patch match the archive. The Git history bundle verifies. The
checkout is registered as a linked worktree and attached to this chat again.
Its archived settings remain private. Dependencies and generated builds were
excluded from the original archive.

The current work continues from `f5b360f` in a separate linked checkout at
`/Users/syedabdulmuqeeth/.codex/worktrees/luma-overhaul-current/luma.green`,
on `codex/pet-quality-release`. The primary checkout's launch integration
changes and the historical recovered source remain intact.

## Quality release correction

An accepted inspection previously allowed a processed lot to proceed even
when an unresolved rejected or conditional inspection existed for the same
lot, inspecting organisation, buyer and specification revision. A later
passing inspection could hide that hold.

A declared lot can still proceed without an inspection. Once its holder
records an inspection, a failed or conditional result also requires a quality
release before processing or dispatch. The existing custody privacy test now
uses an accepted result so it exercises an eligible hand-off.

The shared release check now checks the same scope for unresolved failures.
Closing a failed inspection requires the existing separately approved
correction. Proposed corrections do not replace approved evidence. Original
results and approvals remain available in history. Specifications for a
different buyer or revision keep their own result.

The normal dispatch and transformation calls, release history and explicit
inspection selection use the shared check. The indexed lookup reads at most
101 rows per failure decision and stops release if the bounded review cannot
be completed. The new index requires the checked Convex deployment before
the matching web release.

Regression tests reproduced the failed and conditional release cases and
then covered approved correction, unchanged lot quantities, later passing
observations and independent specification scopes. This remains a local
regression suite; the matching checked change is released as recorded below.

The change adds no new browser analytics event. These are private quality
records. Expected release refusals continue through the existing typed
errors and translated error UI. Existing Sentry scrubbing remains in force.

## Verification

The focused quality, traceability, cost, production and market tests passed
103 cases. The complete `pnpm check` passed 3,388 application tests in 413
suites, 28 security tests, 35 desktop tests, 69 mobile policy tests and 21
mobile component tests. Lint reported zero errors and 123 warnings.

The Convex production dry run resolved to `astute-peccary-795`, validated the
schema, proposed the new inspection index and proposed no index removals.
The production build passed with 3,681 generated pages and formatting passed.
The first build timed out on a Google font download. The font URL returned
HTTP 200 and the unchanged build passed on retry.

All hosted checks passed on `ea88f0f551f88f1747b21c930a24b622a5c0480b`.
The production Convex deployment succeeded at `astute-peccary-795`, adding
only the inspection index and deleting no indexes. PR #63 then merged as
`f744e8f9569ddf0aa0eb0bcf18d63c4e3a4fb4dd`; the merged tree matches the
tested candidate. Vercel Production deployment
`2b9GCCmLrGE9RWHedZyrrfnWRAbG` is Ready for that exact main commit and
assigned to `luma.green`. Read-only HTTP checks returned 200 on both public
and business roots. A default Python HTTP client first received a 403;
ordinary browser-agent requests succeeded. No production records were created
to test quality holds, and no native-device acceptance is claimed.

## Remaining overhaul work

The original full scope remains open. Review and complete the physical stock
and PET process integration, downstream manufacturer routes and orders,
the linked evidence pack, source coverage, provider acceptance and iOS/Android
device checks against the current code. The historical archived processing
draft is a reference for unfinished work and requires its own verification.
