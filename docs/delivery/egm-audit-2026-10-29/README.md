# EGM installation and defect review — 29 October 2026

The complete `egm@egm` plugin, version 0.1.0, is installed and enabled in the
local Codex configuration. The install includes skills, reviewer prompts and
document standards. The skill picker refreshes on the next turn; upstream also
recommends a fresh session.

This pass used the installed `egm-drift-report` instructions to compare the
mobile/desktop package READMEs and native-app design with their implementation.
The [drift report](2026-10-29_DRIFT_REPORT.md) records the differences. This was
a scoped document-to-code review, not a fresh-agent Goldfish review or a claim
that every app design has been audited. Existing architecture and project rules
supplied the repair requirements; no new product design was introduced.

The first inspection used the preserved `feat/android-demo` checkpoint. Before
final verification, the task moved to `fix/egm-current-main` based on checked main
`f687bbb`. This retains main's dependency patches, regional-language restart
repair and restart-proof expiry. The frozen lockfile was installed without a
dependency change in this task. The original branch and unrelated files remain
intact. Earlier interrupted test runs are not final verification evidence.

## Repair method

For each suspected defect: locate the owning code, create a failing test, repair
that owner, and run the test again. There are three repair groups: restart safety,
mobile rollback handling, and desktop location permissions. No new fallback,
provider, permission or parallel screen was added. Guide/Word changes are deferred
under AGENTS.md.

The new browser cases use explicit synthetic pending-work elements on the actual
local homepage. The Electron smoke uses its loopback fixture and a held native
confirmation. These fixtures prove control behavior, not customer workflows,
provider execution, OS permission delivery or signed updates.

## How to use EGM

In the Codex skill picker, select the skill by name and enter the request. The
names below are skill names, not shell commands.

1. `egm-brainstorm`: describe one problem and the result you need. Example:
   “Design a safe retry for a failed recycling-photo upload. Preserve entered
   values and private access.” Review the choices before agreeing to a brief.
2. `egm-draft`: turn that brief into a design. Review each section. A useful
   design states inputs, outputs, failure behavior, access rules and tests.
3. `egm-review`: supply the saved design path. Fresh Goldfish agents read the
   document and selected source without the earlier conversation. This checks
   whether the design explains enough to implement safely.
4. Resolve the findings and approve the design, then ask Codex to implement it
   and run the app's checks. EGM review does not replace tests.
5. `egm-drift-report`: supply a design directory or a small set of package READMEs.
   Compare the written rules with current code. Check dates and status first:
   a planned feature or a held release is not automatically a defect.

The Elephant keeps project context. The Goldfish reviews with a fresh context.
Use the normal repair process for a small clear defect; use a design review when
the repair needs product or architecture choices.

## Verification

- `pnpm check` passed: 345 web/backend suites and 2,865 tests; two actual
  Engine.IO/ws security tests; 59 mobile policy tests; 17 mobile hook/component
  tests; 30 desktop tests; root and app type checks. Lint has zero errors and
  122 existing warnings. The final desktop owner edit also passed scoped lint.
- The disconnected production build passed and generated 3,252 pages.
- The full disconnected Chromium suite passed all 862 tests against that build,
  with two workers and retries disabled. Connected account/provider cases are
  excluded by the standard configuration and are not claimed as passed.
- The real unpackaged Electron smoke passed on the final permission repair.
  Twelve held confirmations cover location and notifications across full
  navigation, reload and away-and-back SPA navigation. The smoke also verifies
  the existing private PDF fixture, sandbox and offline recovery.
- Android and iOS Hermes exports passed with 693 modules each. These are
  JavaScript bundles, not signed installers or device acceptance.
- All 24 production update-control captures were visually inspected across
  English, Arabic, Urdu and Kannada, both themes, and 390/768/1440px widths.
  [Capture hashes and source hashes](captures.json) identify the exact inputs.
  These are synthetic update-status fixtures, not native delivery evidence.

Early interrupted runs were not counted. After baseline alignment, an old
development cache failed CSS resolution; a cold development cache restored
startup. An overloaded development-browser run hit timeouts and was stopped.
The completed production-browser run above had no retries or failures. One early
Electron attempt also lost its PDF popup; later complete smokes passed. The
cause of that transient popup closure is not established. No PDF source repair
is claimed.

The production-dependency audit on this baseline reports nine advisory records:
one critical, four high and four low. This is not a passing audit. The remaining
owners are Better Auth and its included SQL adapters, the existing patched
node-forge, Expo CLI's Zod 3 and Deepmerge tooling. Main already records the
[dependency dispositions](../dependency-security-2026-10-28.md). A fresh registry
check found Convex Better Auth 0.12.6 still requires Better Auth below 1.7, so it
does not permit the advisory's fixed 1.7 line. Existing real-handler tests keep
the affected optional authentication endpoints disabled. No peer range is forced
and no alert is suppressed.

Live OTP/TOTP, Surepass, payments, private customer workflows, signed mobile/desktop
updates and physical-device acceptance are outside the disconnected suite. This
pass does not activate feeds, publish updates, release binaries or deploy the app.

References: [upstream README](https://github.com/google/elephant-goldfish-model),
[Codex integration](https://github.com/google/elephant-goldfish-model/blob/main/docs/codex.md),
and [workflow guide](https://github.com/google/elephant-goldfish-model/blob/main/docs/getting_started.md).
