# Security and auth closeout

The owner authorizes fixing the twelve recorded production dependency advisories,
finishing independent auth review, pushing, creating a PR and squash merging after
all checks pass. Routine configuration and resolution choices are delegated. No
factor bypass, alert suppression, forced unsupported peer range, production data
migration, paid service activation or native release is authorized by this work.

Use the installed EGM Codebase Details persona and re-implementation standard.
Fresh read-only reviewers read this entire plan and their mapped owners. Do not
retrieve memory/history. Report concrete failing states, exact source references
and complete read manifests. Two consecutive clean auth rounds are required.
This is the owner-authorized continuation after the previous review cap.

## Auth contract

Use AGENTS.md section 9 and docs/architecture/auth.md. Phone identities remain
passwordless. All configured factors must complete before session/JWT access.
Ordinary SMS must not sign in a legacy email identity. Assured binding of an
unused phone preserves its existing identity/session/factors and does not enable
phone-only email-account login. Missing delivery disables new sends/resends with
an honest state; already-received code/factor completion remains usable.

Unmounted screens and nested helper waits cannot start the next request, clear a
newer browser draft, refresh another session or navigate. Already dispatched
server requests may complete. Shared browser HttpOnly cookies retain Better
Auth's response-order behavior; no device-wide concurrent-sign-in ordering is
promised. Private operations derive access from the current authoritative session.

Read all owners: convex/auth.ts, convex/lib/phoneTwoFactor.ts, convex/lib/access.ts,
convex/identity.ts; src/lib/phone-auth.ts, turnstile.ts, auth-session.ts, use-mounted.ts;
src/components/auth/login-flow.tsx, phone-form.tsx, verify-flow.tsx,
factor-challenge.tsx, resume-session.tsx, storage.ts; account/account-phone.tsx;
admin/admin-login.tsx, admin-setup.tsx, authenticator-step.tsx;
sell/phone-sign-in.tsx, confirm-step.tsx, simple-recycling-flow.tsx, use-auth-ready.ts,
use-draft.ts (component paths below src/components). Follow direct access/session
and handler/library dependencies. Read actual-handler tests and their fixtures.

## Dependency contract and selected approach

Compare current pnpm audit with the prior twelve records. Inspect the actual
installed package code, upstream fixes and each consumer range. Prefer compatible
published patches. Keep needed security patches when a newer published artifact
still lacks the fix. Where no compatible release exists, a narrow owned backport
must preserve public behavior, include a failing exploit regression, and be
reviewed against upstream source. A patched vulnerable version is still a raw
registry alert: report it honestly; do not rename versions, ignore advisories,
or treat absent optional features alone as a package fix.

Mapped owners: package.json, pnpm-workspace.yaml, pnpm-lock.yaml, patches/,
scripts/security/, apps/mobile/test/signature-verification.test.cjs and its vector,
installed better-auth/SQL adapters, @convex-dev/better-auth, Expo CLI Zod3,
node-forge, deepmerge, systeminformation, @hono/node-server. The latest supported
Convex auth peer contract and actual auth adapter behavior are part of compatibility.
Do not replace Zod3 with Zod4 inside Expo just to remove a version alert.

Preserve current main's privacy and native permission work. No preview deployment.
Run real handler/security regressions, auth schema generation, pnpm check,
format check, disconnected production build and relevant browser/native checks.
After push, inspect PR diff, all required and triggered CI, and review comments.
No admin override, disabled checks or merge on red. Merge only the checked head.

## Selected auth-library backport

Modify (Create owned pnpm patch files, not package versions): better-auth1.6.33
state.mjs, plugins/magic-link/index.mjs, plugins/oauth-proxy/index.mjs and device
routes/types. Create crypto/purpose.mjs from upstream ac54bfd. Use verification
namespaces auth-state: and magic-link: before adapter hashing. Magic records must
carry type=magic-link, a valid email and optional string name; reject malformed,
wrong-purpose or old unprefixed records with INVALID_TOKEN, before and after
atomic consumption. Keep phone/TOTP and stored factor crypto unchanged.

Derive keys through HKDF for oauth-state-cookie, oauth-proxy-package,
oauth-proxy-state and oauth-proxy-profile, on every matching encrypt/decrypt.
Keep versioned keys and legacySecret rotation through purpose derivation, but
never read global-key ciphertext as a fallback. Old optional OAuth challenges
expire rather than reopen cross-purpose access. Device owner receives the
stored client_id and scope after the existing ownership claim; other callers
receive no details. Keep existing status/expiry/claim behavior and update types.

Modify SQL adapters1.6.33 through patches. Drizzle's PostgreSQL outer update
repeats and(...clause, inArray(idColumn,targetIds)); Kysely applies applyWhere to
its update before selecting the target ID. Preserve one-row and other-provider
behavior. Create actual plugin exploit/control tests and real PostgreSQL
contention tests: twenty increments under used<5 yield exactly5; one pending
claim wins; a held row lock followed by guard change yields null; mapped fields
and ordinary updates work. CI must run that real PostgreSQL check explicitly.
No production database, new auth schema or optional plugin is enabled.

## Selected application auth repairs

Modify LoginSteps to restore a valid stored challenge independently of send
availability. VerifyForm reads current signInOptions; missing/loading delivery
blocks resend and explains unavailable state, without blocking code/factor
verification. AccountPhone retains a sent challenge when delivery disappears,
but guards and disables initial sends/resends. Reauthentication passes a screen
lifetime predicate through device revocation, checks it before dispatching logout,
and guards navigation after completion. Bind pending reauthentication to user and session identity; preserve already
revealed recovery codes across same-user session rotation. Already dispatched logout still completes global cleanup.
Extend deferred-result and configuration-change regressions in existing tests.

## Execution checkpoint

TaskStartSnapshot: aa66d90; merge of origin/main2875c58 is in progress, with all
text conflicts resolved by preserving both translation additions and handoffs.
Unrelated two untracked delivery paths stay untouched. Coordinator alone owns
Git/lockfile/package mutations. Delegated task owns only auth patch files and
its security fixtures/workflow. Other app fixes and Zod are coordinator-owned.

TDD Route: auto -> strict, selected for security behavior by the plan owner.
Authority: project requires change tests; this recorded route requires observed
exploit failures before retained backports. Compatibility and good-case controls
must pass. No live provider calls. Spec compliance and code quality review follow
the delegated patch before it can be treated as complete.

Application repair detail: challenge restoration still requires a configured
backend; an offline build cannot verify. Account binding's send owner receives
availability and enforces it before sends, while its saved phone keeps code entry
mounted. Public VerifyForm subscribes to signInOptions itself, so direct routes
and existing forms react to changes. Use existing translated unavailable text.
The optional logout lifetime predicate gates the next request after device
cleanup; once logout is dispatched, its global lifecycle must still complete.
Account secret forms stay keyed by user so same-user factor rotation does not
erase newly revealed recovery codes; a live session ref fences pending logout. No server session guarantee is invented.

Delegation checkpoint: the auth implementation child returned no work because an
automatic security screen flagged possible cybersecurity risk. No result is
accepted from it. The coordinator changes that slice to inline, limited to
published upstream patch application and local synthetic checks; no provider or
third-party exploitation is authorized. This is an execution-boundary change,
not a clean review. Zod remains an independent bounded implementation slice.

## Selected Zod backport

Create patches/zod@3.25.76.patch and scripts/security/zod-collections.test.mjs.
Keep Zod3 APIs and Expo's dependency major. In v3 array exact-length failure,
abort with INVALID when tooBig; in exceeded maxLength and maxSize set branches,
add the same issue then return INVALID before copying, iterating or parsing any
child, including async children and outer refinements. Minimum-only behavior,
ordinary child diagnostics/transforms, error maps, wrong types, record/map
contracts and unconstrained collections stay unchanged. Patch src/v3/types.ts,
v3/types.js and v3/types.cjs consistently.

The package also exports old v4/core/mini. Adapt upstream a0ebf97 leading
upper-size check behavior to src/v4/core/schemas.ts and v4/core/schemas.js/.cjs,
using that installed core's check runner rather than copying unrelated new core
APIs. An exceeded leading upper bound must abort before child traversal; checks
with transformations before a bound must retain transform order and normal
behavior. No arbitrary global issue cap or new size limit. The upstream fix
bounds constrained collections; no claim that unconstrained schemas have a new
resource limit. Check every exported CJS/ESM family used by these sources.

Regression: huge sparse arrays/sets that throw if traversed reject by bounds
without child or outer-refinement calls, sync/async. Preserve issue paths/custom
messages/error maps, normal/equal size, transforms/preprocess, minimum errors,
and unconstrained record/map behavior. Test temporary unpatched versus patched
artifacts, then the actual installed consumer. No package version relabeling.

Zod review decision: retain upstream predicate timing. An early false `when` may
run again after child parsing; exactly-once invocation is not promised. Spec and
independent quality reviews approved all six targets and 158 regression controls.

## Account-wide factor counter repair

Round 5 found a separate Convex adapter gap: no native `incrementOne` and no
transaction around the core read/write fallback. Concurrent failures can lose
counter increments, although per-challenge limits remain. Both compatible Convex
integration artifacts 0.12.5 and 0.12.6 lack the native method.

Selected internal contract: add a local Better Auth component mutation that reads
and changes the existing `twoFactor.failedVerificationCount` in one Convex
transaction. It supports the current library's ID-only +1 failure operation and
its ID plus expired `lockedUntil` guard for reset to zero/null. The wrapper must
validate the exact current operation shape and reject unknown factor operations;
other models retain their existing adapter. Missing/null legacy counts start at
zero, overflow rejects, an absent factor returns null and a false expiry guard
returns null. Preserve the adapter's public ID/date output transformations.
No schema change, new table, migration or provider call. The component method is
internal to the root application's component boundary; do not expose it as a
browser endpoint. Generate types offline or define an exact typed component
reference, without widening any type or manually falsifying generated output.

Acceptance: actual-adapter concurrent failure accounting, legacy/normal controls,
expired/nonexpired lock guards, actual handler tests and full checks. Record a
meaningful failure before repair. Independent spec and quality review plus fresh
EGM auth convergence must include this owner. New mapped sources are
`convex/betterAuth/atomic.ts`, `convex/lib/auth-atomic.ts`,
`convex/auth-atomic.test.ts`, and the `convex/auth.ts` database wiring.

The owner's explicit request to finish the auth review and self-answer routine
decisions authorizes continuing corrective rounds beyond the default cap. The
coordinator retains the two consecutive clean rounds requirement. This does not
turn any incomplete or failed round into a clean one.

Counter contract extension: the installed recovery-code handler also uses
`incrementOne` with ID plus exact old encoded backup codes, empty increments and
`set.backupCodes`. Preserve this supported flow through an exact atomic
compare-and-replace operation in the same component mutation. Only one matching
claim may win; it must not change counters or locks. The component function must
be public within the component so its parent can invoke it, while remaining
unexposed as a root browser endpoint. Retain the base adapter's date mapping;
do not overlay unchanged raw numeric lock dates on mapped output.

The direct database rate-limiter also uses the same nontransactional fallback.
Extend the owned native adapter boundary to its two exact supported operations:
key equality plus prior lastRequest upper bound resets count=1/lastRequest; key
equality plus current-window lower bound and count<max atomically increments
count and updates lastRequest. Read and test each guard in one transaction.
Unknown guarded-update shapes reject. Keep key uniqueness, existing indexes,
public ID/date mapping and existing auth update audit callbacks. The same real
adapter test must show twenty concurrent calls admit exactly five at count<5.
