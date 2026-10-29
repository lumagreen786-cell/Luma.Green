# EGM repair pass — 29 October 2026

The owner asked Codex to use Elephant-Goldfish Model, make routine repair
choices without repeated questions, and report the result. This pass used the
installed EGM 0.1.0 plugin and fifteen fresh, read-only reviewers across five
rounds. The reviewed areas were native update/permission handling, authentication
and its direct booking consumers, and private paper upload/review. This is not a
claim that every app workflow has been audited or that the app has no bugs.

Status: local repairs and final verification completed.
Changes are local on `fix/egm-current-main`; no deployment is part of this pass.

## What changed

- Restart checks recheck the live document after preparation. New inputs,
  dialogs, hidden state, downloads or extra desktop windows block restart.
  A cancelled desktop navigation keeps the surviving document's update nonce.
- Mobile backgrounding invalidates pending native work. A bounded message
  envelope handles both installed Android transport shapes. Bare iframe
  messages cannot request push permission through the fallback transport.
- A valid SMS code cannot turn a legacy email account into phone-only sign-in.
  Recent, fully authenticated binding still preserves the same account,
  session and required factors. The tests call the real Better Auth handler
  and Convex adapter with synthetic identities.
- Removed sign-in, factor, binding and booking screens ignore late local results.
  They do not redirect the current screen or clear a newer tab draft. Bot checks
  and photo preparation also check lifetime before starting the next request.
  An already dispatched server request can finish.
- Admin and household SMS entry use the existing server availability result.
  Missing delivery prevents new sends/resends and shows an unavailable state.
  Account binding uses the server's five-minute resend interval and wall time.
- Paper edits survive another member's save. A conflict retains local text and
  requires explicit Load saved version. Confirmation belongs to the displayed
  revision. Successful saves reconcile the exact submitted snapshot even after
  switching away and reopening; newer edits survive. Late discard cannot close
  the next record. Typed source-integrity errors return private HTTP 503;
  inaccessible records remain concealed.
- Auth and native protocol documents now state these boundaries and limits.
  No schema migration or service activation was required. Platform user-guide
  screenshots, Word and Google Docs updates remain deferred under AGENTS.md.

## Decisions made without further questions

The [review plan](review-plan.md) records the chosen scope and exact repairs.
The [finding decisions](goldfish_review_report.md) record why each supported
finding was accepted. Existing owners were repaired; no auth framework rewrite,
forced dependency peer range, paid call or production-data change was selected.

One review requirement was too broad: UI guards cannot control the order in
which a browser applies HttpOnly cookies from concurrent completed sign-ins.
Better Auth retains that shared-browser behavior. Each completed sign-in still
requires all its factors. This limit is documented, not presented as a code fix.

| Round | Native             | Authentication                                | Private papers     |
| ----- | ------------------ | --------------------------------------------- | ------------------ |
| 1     | Findings; repaired | Findings; repaired or explicitly scoped       | Findings; repaired |
| 2     | Findings; repaired | Findings; repaired                            | Findings; repaired |
| 3     | Findings; repaired | Findings; repaired                            | Finding; repaired  |
| 4     | Clean              | Nested async findings; repaired               | Clean              |
| 5     | Clean              | Missing-delivery finding; repaired and tested | Clean              |

All reviewers completed their assigned persona, standard, target, mapped owners
and relevant dependencies. Native and papers reached two consecutive clean
reviews. Authentication did not. EGM's five-round cap was reached, so there is
no sixth reviewer and no overall convergence claim. The final auth repair has
local regression evidence; a later fresh auth review remains useful.

## Verification

- `VITEST_MAX_WORKERS=4 pnpm check` passed: 356 web/backend suites and 2,978
  tests, two real transport security tests, 61 mobile policy tests, 20 mobile
  hook/component tests and 34 desktop tests. Root, Convex, mobile and desktop
  type checks passed. Lint has zero errors and 123 warnings: 122 prior warnings
  and one full-navigation warning in the intentional Electron loopback fixture.
- Auth schema regeneration produced no change. Real-handler tests cover both
  denied legacy-email SMS sign-in and preserved assured binding with and without
  authenticator protection.
- The real unpackaged Electron smoke passed, including cancellation without a
  new document, stale permission replies, sandbox and offline recovery.
- Android and iOS Hermes exports passed with 694 modules each. These are
  JavaScript bundles, not installers or device acceptance.
- All 54 synthetic component captures were visually inspected in both themes at
  390/768/1440px. Paper and household states cover English, Arabic, Urdu and
  Kannada; the English-only admin state covers both themes and all three widths.
  All 33 locale paper actions fit at both 320px and 390px. Keyboard recovery passed all 24 paper
  cases. [Paper source/capture hashes](captures/manifest.json) and
  [unavailable-state hashes and label checks](captures/unavailable-and-labels.json)
  retain the inputs and results. Native-speaker translation acceptance is open.
- The disconnected production build passed and generated 3,285 pages. All
  864 Chromium tests passed against that build in 9.6 minutes, with two workers
  and retries disabled. The standard configuration excludes connected account
  and provider acceptance tests; those are not claimed as passed.

Early runs caught typing/style issues and two SMS fixtures that still expected
legacy-email phone login. Those fixtures now use canonical phone identities;
the new policy was retained. Early failed/interrupted runs and a fixture-only
catalogue loading mistake are not counted as passes or current visual evidence.

The screen fixture renders actual current components with synthetic records and
disabled writes. It proves layout and control behavior only. It does not prove
live authentication, source permission, provider delivery or a customer workflow.

## Lessons from these repairs

- Check screen lifetime after each wait, including waits inside helper functions.
  A check after the outer helper returns cannot stop work that helper already sent.
- Match a save result to the submitted content and revision. The latest visible
  editor may contain newer work, even when it shows the same record.
- Bind confirmation to the version the person reviewed. A checkbox from an older
  version cannot confirm a new version received from the server.
- Test the host library's real message shape. A mock with a full page address
  missed Android's origin-only transport and its older frame-label behavior.

## How to use the installed skill

EGM is a group of skills. The Elephant keeps the project context and resolves
findings. Fresh Goldfish reviewers read the written requirements and selected
source without the earlier conversation. Tests then check each repair.

In Codex, select the named skill in the skill picker and give it a saved target
file. Skill names are not terminal commands. If the new plugin is absent from an
existing chat's picker, start a new Codex chat and select it there. This pass
loaded the installed skill files directly and used real fresh-context agents.

A useful request is:

> Use egm-review-loop on docs/delivery/egm-self-review-2026-10-29/review-plan.md.
> Review authentication and its direct consumers. Use fresh Codebase Details
> reviewers and the re-implementation standard. Resolve routine findings from
> source evidence. Reproduce defects with tests, repair their existing owners,
> and report passed checks, limits and remaining findings. Do not deploy or
> enable paid services.

Use `egm-brainstorm` to define a new problem, `egm-draft` to write a design,
`egm-review` for one review, `egm-review-loop` for repeated review,
`egm-resolve` to resolve findings, and `egm-drift-report` to compare current code
with an existing design. Choose a bounded workflow and its success evidence.
EGM is most useful when the target explains inputs, access, outputs, failures
and tests. It does not replace app tests, device checks or provider acceptance.

Installed source: [EGM review-loop skill](/Users/syedabdulmuqeeth/.codex/plugins/cache/egm/egm/0.1.0/skills/egm-review-loop/SKILL.md).
Upstream: [Elephant-Goldfish Model](https://github.com/google/elephant-goldfish-model).

## Dependency and acceptance limits

A fresh [production dependency audit](dependency-audit.json) reports 12 advisory
records: one critical, four high, two moderate and five low. The audit does not
pass. This differs from the earlier nine-record inventory because the current
registry also reports Systeminformation and Hono alerts. The upstream
[Systeminformation advisory](https://github.com/advisories/GHSA-4vjg-vx72-qq4g)
and [Hono advisory](https://github.com/advisories/GHSA-rmxm-3fg6-px4f) name patched
versions; those dependencies were not changed in this bounded review pass.
The existing node-forge patch and disabled optional Better Auth paths remain.
Do not interpret an advisory count as proof that a path is reachable, or the
absence of a reproduced exploit as proof that the dependency is safe.

Live SMS delivery and authenticator-app acceptance, Surepass, payments, customer records, extraction provider
execution, signed update feeds, physical Android/iOS devices and installed
Windows acceptance remain open. No service was enabled and no release was made.
