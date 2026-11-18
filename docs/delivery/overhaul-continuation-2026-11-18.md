# Overhaul continuation and checkout recovery

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
candidate until the required checks and PR pass.

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
HTTP 200 and the unchanged build passed on retry. Hosted checks, actual
backend deployment and the web release still require completion evidence.

## Remaining overhaul work

The original full scope remains open. Review and complete the physical stock
and PET process integration, downstream manufacturer routes and orders,
the linked evidence pack, source coverage, provider acceptance and iOS/Android
device checks against the current code. The historical archived processing
draft is a reference for unfinished work and requires its own verification.
