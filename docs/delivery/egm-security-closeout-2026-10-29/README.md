# Security and auth closeout — 29 October 2026

The owner requested repair of the twelve recorded dependency advisories,
completion of the auth review, then a checked PR and merge. No service was
activated, production data migrated, native binary published or factor bypassed.

## Advisory disposition

| Recorded package/advisory                                        | Resolution                                                                                                                                |
| ---------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| node-forge GHSA-86w9-cpqp-85rv                                   | Current main selected 1.4.2; actual Expo verifier rejection and valid-signature controls pass. Retired 1.4.0 patch stays unregistered.    |
| systeminformation GHSA-4vjg-vx72-qq4g and GHSA-7648-jmwf-vw7j    | Compatible 5.33.16 override, inside owner major ranges.                                                                                   |
| @hono/node-server GHSA-rmxm-3fg6-px4f                            | Compatible 2.1.3 override.                                                                                                                |
| Zod GHSA-mrhx-c7xc-m3w5                                          | Owned upstream backport to Expo's 3.25.76, six source/runtime targets; bounded-collection controls fail stock and pass installed patches. |
| Better Auth GHSA-q84f-53jg-9ppm                                  | Owned backport exposes device request client/scope only to its claimed owner.                                                             |
| Better Auth GHSA-r4xp-prcw-77qf and GHSA-965c-763c-88jm          | Owned purpose-key and record-namespace backport, strict record validation and no unsafe legacy fallback.                                  |
| GHSA-44jh-23m7-hpcf, three Better Auth/SQL adapter audit records | Owned guarded outer-update backports; real PostgreSQL contention checks pass.                                                             |
| deepmerge GHSA-gcqx-w48m-w2h4                                    | Current main's CJS/UMD source patch and behavioral controls retained.                                                                     |

The twelve records include duplicate package entries for one SQL advisory.
Four raw alerts disappear with supported package updates. Eight raw version-based
alerts remain visible for patched versions. They are not suppressed or relabelled.
`registry-alerts.json` records this result; it is not an audit-zero claim.

The installed Convex auth integration requires Better Auth <1.7.0, and Expo CLI
requires Zod 3. Forcing incompatible major versions would not be a safe repair.
Patch sources, removal rules and limitations are in `patches/README.md`,
`patch-provenance.json` and `zod-evidence.md`.

## Auth repairs

- Existing codes remain usable when SMS becomes unavailable. New sends and
  resends stop, including the compatibility Change number route and phone binding.
- Removed screens stop local continuation. Sign-out checks both the current
  session and the screen before dispatch after device cleanup; a newer observed
  session also prevents old navigation. Already-dispatched logout retains global
  lifecycle cleanup. Shared HttpOnly cookie response order is not a device-wide
  concurrent-sign-in guarantee.
- Notification revocation receives the same lifetime/session predicate and checks
  it after nested waits before further cleanup. Cancellation retains the pending
  marker so notification registration fails closed until explicit cleanup.
- Repeated admin authenticator setup retains the original primary-auth expiry.
  A real handler test reproduced acceptance after the original five minutes;
  the repaired handler rejects it. Same-user session rotation still preserves
  displayed recovery codes.
- Connected availability acceptance uses real local phone handlers and the
  protected loopback inbox, instead of the retired email login. It respects
  resend/phone quotas and does not reuse or invalidate the saved session artifact.
  These connected browser cases were source/type checked, not executed here.

## Review and evidence

Fresh EGM Codebase Details reviewers reconstruct the complete mapped auth owners
under `review-plan.md`. Findings and repairs are retained in the final checkpoint.
Zod has independent spec and quality approvals. Auth library backports have an
independent source/compatibility review; direct installed plugin controls pass.
The proxy profile callback and cookie-state round trip are executed locally;
full provider OAuth proxy exchange remains a source review, not provider acceptance.

`captures/` contains 72 current-component synthetic fixtures for VerifyFlow,
its edit-number form and AccountPhone binding in en/ar/ur/kn, light/dark, 390/768/1440px. Captures check
font loading, horizontal bounds, action labels, disabled sends and keyboard
navigation. They do not prove an authenticated account or SMS provider execution.
Representative captures were visually inspected across scripts, widths and themes.
The platform user guide remains deferred at the owner's instruction.

## Final local checkpoint

Authentication reached two consecutive clean fresh reviews in rounds 7 and 8.
See `goldfish_review_report.md` for findings, decisions, read scope and limits.
The prior `egm-self-review-2026-10-29` report remains historical evidence for
`aa66d90`; this closeout owns the later auth review and current checks.

- `pnpm check`: 3,023 web/backend tests, 185 installed security controls,
  64 mobile policy tests, 20 mobile UI tests and 34 desktop tests pass. Root,
  Convex and shell types pass. Lint has zero errors and 123 existing warnings.
- Real PostgreSQL adapter contention: 10/10 pass against an isolated local
  PostgreSQL 17 fixture. CI now runs this same explicit gate.
- Empty-configuration production build: 3,318 pages generated. Chromium:
  873/873 pass, two workers, retries disabled. Bot-check browser controls: 2/2 pass.
- Real unpackaged Electron smoke passes. Both Expo Hermes exports pass with
  694 modules per platform; Expo dependency compatibility passes.
- Auth schema regeneration produces no difference. No data migration is needed.
- Frozen-lockfile installation, indexed clean-tree formatting and redacted secret
  scanning pass. Source digest metadata is represented as file/hash records,
  preserving evidence without adding scanner exceptions. The existing unrelated
  untracked Surepass design file is not edited or included in the PR.
- Existing optional test-tool peer warnings remain: Unicorn expects ESLint 10,
  and Better Auth's optional test peer lists Vitest through 4 while the repo
  uses 5. Neither was introduced by this repair; supported auth/Expo runtime
  major ranges were preserved and the actual suites pass.

The Convex counter repair uses the existing fields in one mutation for failure
increments and guarded lock resets. Recovery-code consumption retains its
atomic compare-and-replace and audit callback. Database limiter guards and
changes also share one transaction. A stock-adapter test lost concurrent updates;
20 increments now return counts 1 through 20, and 20 count<5 attempts admit five.
The real handler test locks the account after ten concurrent wrong recovery
codes on separate challenges and denies the next attempt without a session.

The final UI copy keeps the current account and no longer directs people to
retired email sign-in. All 33 catalogues were updated. New local captures include
that current copy. Native-speaker language acceptance remains open.

## PR security follow-up

GitHub dependency review identified an additional advisory on the initially
selected systeminformation 5.33.14:
[GHSA-3f7j-7jwc-fxfj](https://github.com/advisories/GHSA-3f7j-7jwc-fxfj).
The override now selects the published fixed 5.33.16, released 19 October and
within both consumers' supported major ranges and the existing age policy.
No age exception or advisory ignore was added. The installed Windows services
formatter is checked through both actual consumer paths with all subprocess
entry points inert. Stock 5.33.14 fails; 5.33.16 passes Unicode-input and benign
controls. This is formatting evidence, not Windows device acceptance.

CodeQL also identified a permission-check/read race in the connected fixture.
It now opens once, checks the same descriptor with fstat, reads that descriptor
and closes it in finally. The final auth product owners remain unchanged from
the two clean reviews. These follow-ups require the PR's new checks to pass.

The full local check and disconnected build pass again after the dependency
follow-up. Earlier browser/shell captures remain tied to the unchanged app
sources at 762617f; final remote CI checks the new complete dependency cohort.

## Current main integration

Integrated main `20dfc8e` and preserved its paper assistance, billing and service
work. The paper editor keeps the reviewed save/conflict callback and the new
assistance section. Two fresh source reviews found no defects in the combined
paper boundary; 51 focused paper tests pass. Auth product owners did not change.
The connected fixture reuses main's tested private-file descriptor helper.

The combined `pnpm check` passes: 370 suites, 3,092 app/backend tests, 185 security
controls, 64 mobile policy, 20 mobile UI and 34 desktop tests; zero lint errors
and 126 warnings. The disconnected production build generates 3,351 pages.
All 72 synthetic auth captures were refreshed against the combined catalogues.
The earlier 873-case browser proof belongs to the earlier source; the combined
browser suite and final PR checks remain separate gates.

## Production module-path correction after PR28

PR28 merged as `959a4a1` after all 12 active checks passed: 875 remote browser
cases, 2 bot-check and 5 analytics cases included. The Production dry run then
rejected `lib/auth-atomic.ts`: deployed Convex paths cannot contain hyphens.
The automatic frontend build was canceled before publication. The current public
release stays on `20dfc8e` while the correction follows checked PR controls.

Rename the helper to `lib/authAtomic.ts` and update its one import. The helper's
implementation bytes do not change. A filesystem regression test fails against
the old path and prevents invalid module names across deployed Convex sources.
The corrected Production dry run passes for `astute-peccary-795`; no indexes
are deleted. Deploy the checked backend before merging the corrected frontend.
No provider flags, secrets, schema, records or native releases change.
