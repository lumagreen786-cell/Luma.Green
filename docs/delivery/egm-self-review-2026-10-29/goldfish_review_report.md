# Goldfish review decisions

Status: five review rounds completed; all supported findings have selected repairs.
Focused regressions, whole-project checks, production build and all 864
disconnected browser tests pass. No overall EGM convergence claim.
Target: `review-plan.md`. Reviewers used fresh conversation contexts with no
parent history. All three reported completed reads of their persona, standard,
target section, detailed contract, all named source owners and direct dependencies.
No reviewer edited files or ran tests. Runtime reproduction belongs to the root.

The owner delegated routine review decisions in chat. Configuration and resolution
gates are answered here under that delegation. No external approval is inferred.
Round 1 was not clean: seven Major and two Nit findings were reported.

| ID         | Severity | Finding                                                          | Decision and evidence                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| ---------- | -------- | ---------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| native-1-1 | Major    | A frozen proof checks only deadline, not new unsafe content      | PROPOSE FIX. `update-bridge.mjs` pending predicate omits the live idle-document check. Reuse that owner predicate and test late changes.                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| native-1-2 | Major    | Desktop window count is not checked after the proof wait         | PROPOSE FIX. `main.mjs` checks window count only before `executeJavaScript`. Use one snapshot policy before and after the wait.                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| native-1-3 | Major    | Mobile backgrounding does not invalidate location work           | PROPOSE FIX. `app.tsx` invalidates on navigation but has no app-state listener. Reuse those same invalidators on background and reject background commands.                                                                                                                                                                                                                                                                                                                                                                                                                      |
| native-1-4 | Major    | Native wire/API contract is not fully documented                 | PROPOSE FIX (document). Add exact bounds, payloads, nonce, deadline, methods/events and failure recovery. No new protocol is proposed.                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| auth-1-1   | Major    | A bound phone can sign a legacy email identity in through SMS    | PROPOSE FIX. The actual phone plugin calls its verification callback after OTP validation and before session creation; use that supported seam. Binding remains a separate assured path.                                                                                                                                                                                                                                                                                                                                                                                         |
| auth-1-2   | Major    | An older HTTP sign-in response can replace a newer shared cookie | PROPOSE FIX (review contract) and record limitation. The reviewer accurately challenged an overbroad new requirement. AGENTS.md requires all factors and session/identity access; it does not promise cross-tab response ordering. `IdentityProvider` remounts React work when identity leaves. HttpOnly cookies are applied by the browser, so a client generation ref cannot cancel a response's Set-Cookie. Retain Better Auth's shared-browser ordering, require each full sign-in, and remove the invented ordering guarantee. No new auth layer or claim of a code repair. |
| auth-1-3   | Nit      | Auth docs still describe a removed code-entry preview            | PROPOSE FIX (document). `LoginSteps canSend=false` renders unavailable delivery and no preview transition.                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| papers-1-1 | Major    | A remote save silently removes unsaved editor text               | PROPOSE FIX. `PaperDetail` keys by server revision and rejects memory from an earlier revision. Keep dirty content with its expected revision and expose a conflict recovery action.                                                                                                                                                                                                                                                                                                                                                                                             |
| papers-1-2 | Nit      | Source integrity/storage failures are mapped to 404              | PROPOSE FIX. The HTTP contract specifies 503 for storage failure. Preserve access concealment while separating operational failures.                                                                                                                                                                                                                                                                                                                                                                                                                                             |

Read manifests: native read all eight named source owners, three detailed
contracts, both test-infrastructure files, and the shell/location/push integration.
Auth read all nine named source owners, AGENTS section 9, auth architecture,
binding/session owners, the actual phone/TOTP library handlers and real-handler
test infrastructure. Papers read all nine named source owners, the full paper
contract, workspace/access/config/CORS/sniffing owners and paper fixtures.

No finding is marked as a passing implementation based only on a reviewer report.
Fresh re-review rounds must check the repaired source. A fixed finding can reopen;
the documented shared-cookie limitation is settled unless its assumptions change.

## Round 2

Not clean: three Major findings. All three reviewers completed their assigned
persona, standard, target, contract, mapped source owners and direct dependencies.

- native-2-1: PROPOSE FIX. Navigation start rotates the update nonce even when
  navigation is cancelled and the old document survives. Rotate at commit.
- auth-2-1: PROPOSE FIX. Late phone/profile completions can change challenge storage
  and navigation after unmount. Add lifecycle guards to the existing owners.
- papers-2-1: PROPOSE FIX. A successful save after switching records leaves stale
  dirty memory. Reconcile the exact submitted snapshot, preserving newer edits.

## Round 3

Not clean. All three fresh reviewers completed their assigned reads.

- papers-3-1 Major: PROPOSE FIX. Reopening the same editor before completion
  copies dirty memory; clearing board memory later does not reconcile its buffer.
- auth-3-1 through auth-3-4 Major: PROPOSE FIX. Household SMS, shared factors,
  admin sign-in/enrolment and already-started booking continuations still have
  unguarded late callbacks. Include directly mapped account-phone local effects.
- auth-3-doc Major: PROPOSE FIX (document). Explain the existing assured legacy
  email binding exception. Two Nits: remove another stale preview claim; align
  account binding resend with the existing five-minute server minimum.
- native-3-1 and native-3-2 Major: PROPOSE FIX. Installed Android WebView sends
  origin-only URL in modern transport and top URL for every fallback sender.
  Exact-URL parsing rejects valid modern requests; bare push messages from a
  fallback iframe can reach permission handling. Add a bounded nonce/document
  envelope; do not weaken the feature parsers to accept origins blindly.

## Round 4

Native: clean after complete reads including the installed Android sender.
Papers: clean after complete reads, including all save acknowledgement orders.
Auth: not clean after complete reads. Two Major findings accepted as PROPOSE FIX:
`requestPhoneCode` starts SMS after a delayed bot check even if its caller left;
the nested photo-upload loop can start later uploads after screen removal.
The outer component guards do not cover these nested waits. Repair their owners.

## Round 5 — cap reached

Native and papers: clean, with complete fresh read manifests. Rounds 4 and 5 give
these two domains two consecutive clean reviews.

Auth: not clean. Major auth-5-1 accepted as PROPOSE FIX: backend-configured,
SMS-disabled admin and inline household entry ignore `signInOptions.phone` and
still offer sending. Gate their initial send and resend controls using that
existing server result. Keep already-received code/factor completion usable.

No sixth reviewer is dispatched. Final source tests can verify the selected fix,
but do not create an independent clean auth review. Overall EGM convergence is
not achieved in this capped pass. No claim of an app with no remaining bugs.
