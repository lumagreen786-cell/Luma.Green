# Platform code review and repair

Status: active, 25 October 2026.

User request: review the platform and fix all confirmed findings. Explain the approach in simple, controlled English.

Baseline: `226f79e`, branch `codex/platform-review-fixes`, isolated checkout `/private/tmp/luma-platform-review`. The original checkout remains on `codex/gst-only-registration`. Required sources read: AGENTS.md, current delivery handoff, docs index, architecture overview, testing and CI rules. Domain reviewers must read the owning contract and schema before edits.

Scope: web, backend, access, onboarding, household bookings, trading, payment evidence, private files, shared services and build checks. Native code can be reviewed but remains on hold. Preserve records, auth factors, exact units, translation support and all provider gates. Do not call paid services, seed data, deploy, merge or release native apps.

Method: map the code; review independent domains; confirm findings with a failing test; repair each owning rule; run focused tests and integrated checks; independently review the combined diff. Avoid speculative changes and style-only cleanup.

Success evidence: a findings report with causes and fixes, passing regression tests, `pnpm check`, format and production build results, review coverage and explicit external verification limits. A static review cannot establish that no further defects exist.
