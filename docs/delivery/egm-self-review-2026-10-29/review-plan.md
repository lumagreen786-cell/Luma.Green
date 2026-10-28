# App repair review

Status: review contract, not a claim that the requirements pass.

The owner asked Codex to use EGM, make routine repair decisions without repeated
questions, and report the result. This delegates review configuration, supported
repairs, and routine review checkpoints. It does not grant new provider, spending,
store, device or production-data permissions.

## Purpose and decisions

Use fresh Goldfish readers to challenge the existing app behavior against the
requirements below. The root agent retains project context and resolves findings
with source evidence. Review three bounded areas, not every app workflow. An
unreproduced suspicion stays unverified. Passing tests do not prove no bugs exist.

Use the installed `egm-review-loop` with three independent Codebase Details
reviewers. Each reviews its named section against the bundled re-implementation
standard and its linked source contracts. Use isolated conversation contexts,
read-only reviewers, no retrieved chat history, and no inherited parent answers.
Record reviewer completion and findings in separate round reports. The root
agent may contest only with checkable source evidence; accept supported repairs
and verify them. Two clean fresh rounds are needed to claim convergence; cap at
five. The owner's delegated decision instruction replaces routine question gates.

Alternatives: a same-context reread can retain the author's assumptions; tests
alone miss untested branches. A new framework or broad rewrite is unnecessary.
Keep existing code owners and repair only evidenced defects or inaccurate docs.

Baseline: local repair commit `c2a13f0`, combined with current main `45ad8a6`.
Only the handoff notes conflicted; keep both entries. Preserve unrelated files.
The previously reported nine dependency alerts are unresolved inventory, not
proof of reachable exploits. Keep the reviewed node-forge patch and optional
authentication exclusions. No dependency override or service activation is
authorized merely to make an audit number smaller.

## Native updates and permissions

Required behavior: download without interrupting work. An explicit Restart needs
a visible, complete, idle public home document, no form/editable content or task
dialog, and an unexpired frozen-document proof. Edits remain latched across
in-page navigation. Denial, failure and proof timeout must leave a usable page.
Older shells and ordinary browsers must remain usable without the update bridge.

Permission requests must come from the trusted main document. A pending location
or notification approval must be discarded after navigation, reload, or leaving
and returning through in-page navigation. Existing valid desktop grants are
process-local. No new permission is declared by this review.

Current contracts and owners (all existing):

- `docs/architecture/native-apps.md`, `apps/mobile/README.md`, `apps/desktop/README.md`.
- `apps/shared/update-bridge.mjs`, `apps/mobile/src/use-updates.ts`,
  `apps/mobile/src/use-native-updates.ts`, `apps/mobile/src/use-native-location.ts`.
- `apps/desktop/src/main.mjs`, `apps/desktop/src/policy.mjs`,
  `apps/desktop/src/updates.mjs`, `src/components/app/native-update-control.tsx`.
- Test infrastructure: `apps/desktop/scripts/smoke.mjs` and
  `e2e/native-updates.spec.ts`. Mock status proves UI behavior only.

## Authentication and sessions

Required behavior: keep phone users passwordless; keep required TOTP factors.
Do not restore a session before all required factors succeed. Private operations
must derive identity and access from the current session. A delayed UI result
must not update an unmounted identity boundary. Concurrent completed sign-ins in
one browser share Better Auth's cookies; their HTTP response ordering can select
the account. This review retains that framework behavior and does not claim
device-wide sign-in ordering. Every completed sign-in still needs its own full
required factors. A phone
binding must preserve the identity and its required factors. Missing delivery
must show an unavailable state; no simulated public sign-in path is allowed.

Current contracts and owners (all existing):

- `AGENTS.md` section 9 and `docs/architecture/auth.md`.
- `convex/auth.ts`, `convex/lib/access.ts`, `convex/lib/phoneTwoFactor.ts`.
- `src/lib/phone-auth.ts`, `src/lib/auth-session.ts`,
  `src/components/auth/login-flow.tsx`, `src/components/auth/phone-form.tsx`,
  `src/components/auth/factor-challenge.tsx`, `src/components/account/account-phone.tsx`.
- Follow direct calls to the owning profile/phone-binding function when needed.
  Existing actual-handler tests are relevant evidence; a UI mock is not provider
  or full authentication acceptance.

## Private paper uploads and review

Required behavior: an active business member operates only in the selected
workspace. A workspace change or lost membership must not attach a delayed
upload, source read, extraction or saved content to another workspace. Viewers
can read only. The original source stays private; no public URL or persistent
browser copy. Revoke preview object URLs on replacement, workspace change and
unmount. Keep edits through recoverable failures. Require an explicit reviewed
confirmation; this creates paper evidence, not stock, payment or a permit.

Provider extraction must stay disabled without configuration and consent. An
enabled call needs a server reservation, bounded timeout, duplicate protection
and no paid retry. Authentication and permission errors must not be reported as
ordinary provider failures. Preserve the immutable source and extracted result.

Current contracts and owners (all existing):

- `docs/api/paper-transcription.md` is the detailed data, access, limit and error contract.
- `convex/paperDrafts.ts`, `convex/lib/paper.ts`, `convex/lib/paperProvider.ts`,
  `convex/lib/paperSources.ts`, `convex/lib/paperSchema.ts`, `convex/lib/workspace.ts`.
- `src/components/papers/paper-page.tsx`, `src/lib/upload-image.ts`,
  `src/lib/upload-image-metadata.ts`.
- Follow direct imports to request/body or workspace-selection owners as needed.
  Existing paper tests use synthetic local records, not real customer evidence.

## Repair and verification plan

1. Reviewers read this file, their installed persona and standard, the applicable
   detailed contract, and all mapped source owners. Return exact file/line
   references and a concrete failing input/state for a code defect. Separate code
   contradictions from missing documentation. Report incomplete reads as not run.
2. The root agent records PROPOSE FIX, CONTEST, ESCALATE or DECLINE per finding,
   with checkable evidence. A comprehension gap needs a document repair. No
   unresolved external fact is silently treated as permission.
3. For an accepted code finding, Modify its existing owner and adjacent test;
   Create a focused regression only if no existing test fits. No Delete operation
   or schema migration is planned. Write the failing regression first, then the
   smallest owner-level fix. Update this contract with the selected exact repair
   before editing production logic. Do not invent a repair before a cause is known.
4. Run focused regressions and affected platform checks. UI changes also require
   the project design/i18n rules and current visual evidence. Server edits require
   the Convex rules and access/negative-path tests. Keep real services disabled.
5. Run `pnpm check`, relevant build/browser checks, and final independent review.
   Record failures, final results and uncovered provider/device cases. Keep guide
   work deferred under AGENTS.md. Save the report and a local Conventional Commit.
   No deployment, paid call, native binary or signed update is part of this pass.

## Selected repairs after round 1

- Modify `convex/auth.ts` and `convex/lib/phoneTwoFactor.ts`: use the phone
  plugin's existing verification callback, after its OTP check and before it
  creates a session, to reject ordinary SMS sign-in to a non-phone email identity.
  Keep assured `updatePhoneNumber: true` binding and synthetic admin identities.
  Extend `convex/auth-two-factor.test.ts` using the real handler/adapter, checking
  no new session/JWT and that an invalid OTP still fails before identity policy.
- Modify `apps/shared/update-bridge.mjs`: share the idle-document predicate
  between initial prepare and pending-proof validation. Recheck edits, visibility
  and task controls without rejecting the guard's own frozen flag. Extend the
  generated-script VM tests with late input, dialog and hidden-document cases.
- Modify `apps/desktop/src/updates.mjs`, its adjacent test and `main.mjs`: move
  the existing async restart proof check into a testable owner receiving fresh
  document snapshots. Apply the same window/download/loading/home predicates
  before and after the proof await. A newly opened document must block restart.
- Modify `apps/mobile/src/app.tsx` and its existing shell test: on background,
  reuse existing location/update/push invalidation. Drop new native commands
  while app state is not active. An ordinary inactive OS permission prompt is
  not background navigation; do not discard that prompt merely for being inactive.
- Modify `src/components/papers/paper-page.tsx` and its adjacent test: keep editor
  identity stable across remote revisions. Retain dirty content and its original
  expected revision, including when switching between records. Block save,
  confirmation, extraction and discard during a conflict. Show a translated
  warning and explicit Load saved version action; retain local text until that
  action. Clean editors follow saved updates. Successful local saves clear dirty
  memory without a false conflict. No automatic overwrite or server force flag.
  Add two copy keys to all catalogues and exercise RTL and narrow layouts.
- Modify `convex/paperDrafts.ts` and its existing HTTP tests: keep 401 for no
  session and 404 for access/not-found failures. Return 503 for inaccessible source
  typed source-integrity failure, with the same private
  headers and generic body. No schema or API argument shape changes.
- Correct the removed login-preview claim in `docs/architecture/auth.md` and
  document the existing bounded native-update protocol in its architecture owner.
  The broad cross-tab ordering claim above was a review-plan overstatement, not
  a missing guarantee in AGENTS.md. Record the browser-cookie limit explicitly
  instead of adding an unreviewed authentication layer.

Root follow-up regressions also require confirmation to bind to the displayed
revision, and an unmounted editor's delayed discard to leave the next record
open. Both failed before their owner fixes. The HTTP 503 repair is deliberately
limited to the chunk owner's typed integrity error; opaque lookup failures
remain concealed as 404, including malformed IDs.

## Round 2 selected repairs

Keep the update nonce attached to the committed desktop document. Invalidate
permission approvals when navigation starts, but rotate the update nonce only
when a new main document commits. Test cancellation with the real Electron host.

Stop unmounted phone-send, verify, resend and profile completions before they
change local state, challenge storage or navigation. This does not claim to
control the browser's shared HttpOnly cookie response ordering.

Reconcile a completed paper save with board memory even after editor unmount.
Clear only the exact submitted content and baseline revision. Preserve any newer
edits made after reopening the same record. Test both completion orders.

## Round 3 selected repairs

Propagate paper save acknowledgements to a reopened editor as a clean snapshot,
matched by submitted object identity and original revision. The reopened editor
must accept that acknowledgement without discarding newer edits.

Apply the same lifetime rule to all directly linked auth consumers: household
number/code/factor, admin phone/factor/enrolment, account phone binding and the
two household booking continuations. Check lifetime after each awaited boundary;
an already dispatched server request can finish, but must not start the next
request, clear a newer browser draft, show a stale toast or navigate after unmount.
Align binding resend with the existing five-minute server limit, using wall time.
Document the verified legacy-email binding exception and remove stale preview copy.

Add one bounded mobile message envelope at the existing WebView boundary. A
main-document-only injected wrapper attaches the native nonce and exact document
URL to each message. The shell validates these before invoking unchanged feature
parsers. Android's native event URL may be the trusted origin or full document;
iOS still requires the full document. Bare fallback-iframe messages must fail.
Do not accept an origin match alone. Keep the feature payload bounds and navigation
invalidators. Test both installed Android transport shapes, foreign origins,
missing/wrong nonce, stale URL, oversized payload and nested-frame injection.
This requires no native module, permission or binary change.

## Round 4 selected repairs

Pass the caller's lifetime predicate into the shared phone-code sender. Check it
before bot verification and after that wait, before dispatching SMS. An abandoned
bot check must not consume phone quota. Keep this optional for non-UI callers.

Give the photo-upload owner its own screen lifetime guard. Check before each
file and after preparation, byte reads and upload completion. Removal stops later
uploads and booking; it cannot cancel a request that already reached the server.
Extend the tests with deferred preparation, bytes and first-file upload.

## Round 5 selected repair and stop condition

Use the existing `identity.signInOptions.phone` result for admin and inline
household SMS entry. While loading, prevent sending. If false, show unavailable
delivery and prevent new sends/resends; retain already-received code and factor
completion. No new service is enabled. Add regressions for configured backend
with delivery off. The five-round cap is reached: native and papers have two
consecutive clean rounds; authentication does not. Do not claim overall EGM
convergence or that all app defects are eliminated. Verify the final repair with
local tests and record the need for a later independent auth review.
