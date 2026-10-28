## EGM autonomous self-review — 29 October 2026

The owner delegated routine review and repair choices. Fifteen fresh read-only
Goldfish agents completed five rounds across native, auth/direct booking consumers
and private papers. See [review plan, decisions and verification](egm-self-review-2026-10-29/README.md).
Native and papers have two clean final rounds; authentication reached the five-round
cap with a final missing-delivery fix, so no overall EGM convergence is claimed.

This local branch combines prior repair `c2a13f0` with main `45ad8a6`; both handoff
entries were preserved during conflict resolution. New repairs cover live restart
proofs, post-await window checks, background invalidation, cancelled desktop
navigation, bounded Android message transport, legacy email SMS policy, nested
late auth/upload/booking results, unavailable delivery, and paper revision/edit
reconciliation. Auth schema regeneration produced no change. No migration,
provider setting, paid call or production data change was needed.

Final local verification passed: `VITEST_MAX_WORKERS=4 pnpm check` with 2,978
web/backend tests, two transport security tests, 61 mobile policy tests, 20 mobile
component tests and 34 desktop tests; all types; zero lint errors (123 warnings).
The disconnected build generated 3,285 pages and all 864 browser tests passed
with two workers and retries disabled. Real unpackaged Electron smoke and both
694-module Hermes exports passed. Fifty-four current synthetic component captures
were visually inspected; paper actions fit all 33 locales at 320/390px. The
report retains source/capture hashes, decisions, limits and a skill usage guide.
Physical Android/iOS envelope execution, OS prompts/background transitions,
installed Windows and signed update delivery remain untested. No binary, feed,
OTA, store submission or deployment is part of this pass. Guide/Word changes are
deferred; impacted screens are paper conflict recovery, unavailable inline/admin
SMS and account phone binding. The new screen captures use synthetic component
fixtures and do not establish authenticated or provider acceptance.

The fresh dependency audit reports 12 advisory records, superseding the previous
nine-record inventory for the current registry snapshot. No dependency versions
or peer ranges changed in this pass. Keep existing node-forge patch and disabled
optional auth paths. Details are in the linked report.

## EGM installation and defect repair — 29 October 2026

The complete EGM 0.1.0 plugin is installed and enabled in local Codex. The task
used its drift-report process to compare the native design and package READMEs
with code, then repaired reproduced defects. This was not a Goldfish design
review. See the [usage guide and evidence](egm-audit-2026-10-29/README.md).

The repair branch is `fix/egm-current-main`, based on checked main `f687bbb`.
It preserves main's dependency patches, regional-language home guard and restart
proof expiry. The original `feat/android-demo` branch and unrelated files remain
intact. The shared restart guard now blocks empty/plaintext/uppercase editable
content, alert dialogs and open native HTML dialogs. Mobile checks stage embedded
rollback directives. Desktop location requires the main frame/window, and both
location and notification prompts reject replies after full navigation, reload
or away-and-back SPA navigation. Existing valid grants remain process-local.

Local verification passed: `pnpm check` with 2,865 web/backend tests, two transport
security tests, 59 mobile policy tests, 17 mobile hook/component tests and 30
desktop tests; root/app types; zero lint errors and 122 existing warnings.
The production build generated 3,252 pages. All 862 disconnected browser tests
passed against it with retries disabled. The real unpackaged Electron smoke
passed, Android/iOS Hermes exports passed, and 24 synthetic update-control
captures were visually inspected. The report records earlier interrupted and
failed attempts separately, including one PDF-popup closure whose transient
cause is not established; later complete Electron smokes passed.

The production-dependency audit still reports nine advisory records. Preserve
the existing node-forge patch and disabled optional auth paths; the latest
Convex Better Auth component still requires Better Auth below 1.7. Do not force
its peer range or suppress alerts. No backend/schema/provider setting, permission
declaration or production record changed. These repairs are local source work;
no native binary, feed, OTA update, store submission or deployment is included.
Live provider, signed update and physical-device acceptance remain open.
Guide/Word changes remain deferred under AGENTS.md.

## India-wide follow-up - 29 October 2026

The owner replaced the Bengaluru-only software scope with India-wide web
coverage and delegated official-source research and ordinary defaults. Read
[the active delivery record](india-platform-2026-10-29.md) and
[the implementation plan](../plans/2026-10-28-india-research-readiness.md).
The task branch is `codex/india-research-readiness`, based on main `b6bcd56`, with checked main updates through `f687bbb`
combined before release.
New code covers state-qualified localities, guarded cross-city trade, local
admin reassignment, safe preacceptance address redaction, dated regulatory
references and private human-reviewed paper transcription. Paper extraction
stays off without its separate enabled flag, explicit allowance and consent.
Originals use atomic private database chunks with retained-source caps.

All 53 team-form answers are labelled by evidence type. The owner delivery
folder contains the editable research-filled form, a ten-page linked companion,
37-URL source register and eight downloaded official PDFs with a hash manifest.
Public research does not establish actual permits, recipes, contracts, provider
approval, real-paper accuracy, cloud recovery or official carbon-market access.
The newer geographic contract supersedes Bengaluru-first statements in older
planning artifacts; preserve those as dated history rather than acceptance proof.

Check the release PR and `Final_Release_Evidence/india-web-release-2026-10-29.json`
for actual hosted and Production state. This handoff alone does not prove a
release. Expo remains paused; unrelated primary-checkout changes are preserved.
The owner left GitHub email verification/main protection queued. Keep checked
PRs, backend-before-frontend and Production-only deployment.

## Production verification and locale restart repair — 29 October 2026

PR #22 was squash-merged as 48dceea. Vercel marked that exact source Ready,
Production and Current for luma.green. Live checks passed for 53 routes,
including all 33 locale home pages. The 24-layout matrix covered English,
Arabic, Urdu and Kannada at 390, 768 and 1440 pixels in both themes. Actual
viewport widths were recorded; fonts loaded with no horizontal overflow or
broken visible images. Public household and role-entry screens were inspected.
No OTP, paid provider call, booking or payment was submitted. Existing sessions
were preserved. Evidence is local under
`docs/delivery/evidence/web-production-2026-10-29/`.

Live verification found that regional HTML tags (for example kn-IN and ur-IN)
did not match canonical home routes (/kn and /ur) in the shared restart guard.
The guard now uses the primary language subtag. A regression first failed on
the old code and passes with the repair; work routes remain blocked. Both Expo
and Electron consume this shared source. No native binary, OTA update, feed,
permission or backend schema changed. Installed native builds still need a
separate release and device acceptance. Guide changes remain deferred.

## Checked release integration — 29 October 2026

The owner authorized push, PR creation and merge into main after all checks pass.
The foundation was applied to current main b6bcd56 in the task-owned
native-update-release checkout on codex/native-update-foundation-release.
The original feat/android-demo checkout and unrelated files remain intact.
Current web foundation and historical delivery records are preserved.

Restart proof now carries the frozen document's expiry time. Mobile and desktop
reject a delayed action after that lease expires, even if a timer or reply was
delayed. Tests cover expired proof and delayed native actions. Shared controls
still require explicit intent and a fresh safe document.

Fresh combined-source checks passed: pnpm check, the production build (3,252
pages), Expo dependency compatibility, Android/iOS JavaScript export, the local
Electron smoke, and 27 production-build browser cases. The captures in the
evidence folder were refreshed against this combined source. Hosted CI and
review remain the merge gate; local checks do not imply a completed merge.
No schema, provider quota, native release build, signed update feed or store
submission changes are included. Main's normal Production-only web deployment
remains separate from native app publication.

## Shared Expo/Electron update foundation — 29 October 2026

This supersedes the planning-only status in the 28 October entry below. The
owner authorized source implementation, an update icon and explicit Restart
for all four platforms, the future-web-change rule in AGENTS.md, tests and a
local commit. No push, release build, OTA/feed activation, store submission or
deployment is part of this checkpoint. Work remains on feat/android-demo.

The repo already contains Expo and Electron. Their shared hosted control is
now in public navigation and workspace sidebar/compact header. Browser and
older-shell views remain unchanged. Both app defaults use https://luma.green.
Disabled update builds show an honest unavailable state.

Downloads do not open a modal, reload a page or install on quit. Restart needs
explicit intent and a fresh idle-home check. Forms, editable fields, busy
dialogs and prior edits/task clicks latch the document unsafe across SPA
navigation. Finish work and reopen Luma when latched; flow-specific work locks
are needed before relaxing this conservative guard. Expo requires a second
frozen-document proof and drops it on navigation/unmount. Electron also blocks
restart with a document window or active download. A timeout/failure unfreezes
the document. These controls cannot prevent OS termination or recover unsaved
workflow data after an ordinary user-initiated exit.

The bridge accepts only status, check and restart. Electron cancels its
nonce-bound window-open command without navigating the current page; it adds
no preload or general IPC. Shared bridge source is copied into generated
desktop resources and included in packaging. Desktop typecheck prepares those
resources so checks also work in a fresh clone. Expo imports the same source.

The root App packages workflow now includes web source changes. AGENTS.md
requires Expo/Electron compatibility review, generated-copy updates when
needed, app checks and honest device-test limits for every web change. It does
not require a new native binary for an ordinary hosted web update.

Final local verification: pnpm check passed with 2,551 web/backend tests,
59 mobile policy tests, 14 mobile component/hook tests and 28 desktop tests,
both app type checks and root lint/types. Lint has 65 existing warnings and no
errors. The 27-case browser suite passed, including the 24-layout matrix;
captures were visually reviewed. Android and iOS Hermes exports passed
(693 modules). The real local unpackaged Electron smoke passed, including the
nonce-bound status command without navigation. Formatting and diff whitespace
checks passed. No production build or signed installer was created.

Browser captures use a synthetic native update-ready state and prove
layout/control behaviour only.
See [the evidence record](evidence/native-updates-2026-10-29/README.md).
Native binary changes still require the applicable store/distribution path.
Signed update delivery, signing continuity/rotation, bad signed artifacts,
interrupted install recovery and physical Windows/iOS acceptance remain open.
Existing Android device permission/camera acceptance is not upgraded by these
tests. Guide and Word work remains deferred.

## Four-platform update and permission planning — 28 October 2026

The owner requested a Windows, macOS, Android and iOS foundation plan with
minimal update effort after installation. The proposal is in
[native apps](../architecture/native-apps.md#four-platform-foundation-proposal--28-october-2026).
It covers public distribution choices, update boundaries, scoped permissions,
denial paths, signing, compatibility, recovery and acceptance evidence.

The key owner decision remains open: whether occasional store-delivered mobile
binary updates are acceptable. Native apps cannot promise that all future
updates avoid stores. An installable web app is the alternative to assess if
that condition is absolute. No new native code, account, build, release, store
submission, push activation or OTA activation is authorized by this proposal.
Existing Android demo changes are preserved. Guide/Word work remains deferred.

Source review found that the current mobile shell does not connect its existing
update hook to visible update controls. Play in-app updates are not implemented.
Desktop signing/update source exists, but production feed/device acceptance is
unproven. Validate current accounts and generated platform declarations before
implementation; older account-setup notes are historical.

## WebView-only shell and native permission support — 26 October 2026

After the first installed demo, the owner confirmed Recycle opens successfully
and requested removal of the permanent native header/footer. The normal screen
now shows the hosted interface only, with native safe areas and Android Back.
Native recovery buttons appear only after load failure. No page refresh or
forced update interrupts a form.

The Saathi selfie input is the agreed camera acceptance case. System camera
capture and photo/document selection remain delegated through Android WebView;
no broad photo/storage or microphone access is required. No startup permission
prompt was added. A trusted on-demand Expo Location bridge replaces the
WebView's FINE-only request, which can reject approximate Android permissions.
It validates the active document and a native session nonce, accepts approximate
access, bounds calls, serialises underlying native requests, and drops stale
results after navigation/unmount. Native errors use standard geolocation error
codes without returning provider details or logging coordinates.

Four shell component tests and five location-hook tests cover chrome removal,
Back, retry/remount, trusted access, denial, approximate location, timeout,
concurrency and stale results. Pure bridge tests also exercise injected script
callbacks and hostile/malformed messages. No additional library was required.
Build profiles pin Node 24.18.0/pnpm 11.24.0; the SDK57 internal APK increments
versionCode. The upload filter keeps required mobile source, icons, catalogues
and the security patch, excluding web imagery, captures and local secrets.
Full `pnpm check` passed: 2,549 web/backend, 59 mobile policy, 9 shell/hook
and 23 desktop compatibility tests, lint and both type checks. Android Hermes
export passed. A new hook-dependency warning was then removed; scoped lint and
integrated mobile checks passed after that correction.

The first revised upload stopped before remote build creation when local disk
space ran out. Only task-created temporary inspection copies were removed.
Retry submitted build `64034687-f237-4c87-9355-f31e439ae2ef`, versionCode 3,
using the existing signing identity. VersionCode 2 has no submitted APK build.
The current upload is 211 MB (prior upload 353 MB); Git checkout metadata is
still included by the EAS archiver. The user requested installation before the
camera test. The phone was not detected at the last connection check. An
authorised monitor checks completion and installs with app data preserved if
exactly one authorised phone is connected; otherwise it notifies to reconnect.
Real-device camera/location and revised-layout acceptance remain pending.
Guide/Word updates remain deferred.

## Android demo installed on device — 26 October 2026

Build `4f29436f-7010-494d-af06-a234ff6e0ff0` installed successfully on the
owner-connected Samsung Galaxy A51 (SM-A515F), Android 13, after USB debugging
was authorised. Installed package: `green.luma.app`, version 0.1.0 (1),
minSdk 24, targetSdk 36. APK SHA-256:
`1c688c1d3b5278c979ed9a9b1be01c1fc1a98320450a600b3b62188b782719d5`.
ZIP integrity passed. The cold launch completed successfully and the app process
remained running. The actual dark homepage was visually inspected: current
Luma artwork, fonts, primary actions and native controls render on this device.
Capture: `docs/delivery/evidence/android-demo-2026-10-26/home-dark.png`.
Scoped AndroidRuntime/ReactNativeJS error-log check returned no entries.
Chromium logged page-paint timing warnings; no app crash was observed.

The owner is testing the public Recycle action next. Navigation, light mode,
translated scripts, OTP/TOTP, camera, location, offline recovery, session
persistence and completed workflows are not yet device-accepted. No OTP was
sent, no booking/application was submitted, and no OS permission was granted
by this installation check. This is a device startup check, not store-release
acceptance. Guide/Word changes remain deferred.

## Android Expo demo resumed — 26 October 2026

The owner explicitly resumed Android work for a demo and deferred phone
connection until the installer is built. This supersedes the Android hold only
for this work; iOS and desktop releases remain on hold. Changes are on
`feat/android-demo`. Preserve the unrelated untracked Surepass design document.

The existing Expo WebView reuses the current web interface and imagery. Its
default origin is now `https://luma.green`, and each EAS profile explicitly uses
that Production origin. The internal `preview` profile emits an APK; it does not
create a Vercel Preview deployment. Expo project linking uses the existing owner
`lumagreens-team`, slug `lumagreen`. OTA and push remain off without their
separate explicit configuration. Native controls now mirror web light/dark
tokens and follow device appearance; manual web theme overrides do not yet
synchronize native chrome. No new UI libraries were required.

Full `pnpm check` passes: 2,549 web/backend tests, 55 mobile tests,
23 desktop policy tests, both type checks and lint (65 existing warnings).
Android Hermes export
passes (689 modules). Live origin launcher check passes outside the network
sandbox. These do not prove an installable APK or device acceptance.

The Mac initially had 7.3 GiB free and no JDK/Android SDK. Official Android
platform-tools 37.0.1 were downloaded to `/tmp/luma-android-tools`; adb runs.
No full SDK/emulator/JDK was installed. EAS CLI 25.3.0 is installed separately
in `/tmp/luma-eas-tools`, with the reviewed workspace node-forge patch applied
through its own pnpm-workspace.yaml. The actual EAS CLI and certificate consumer
each reject the upstream malformed-signature vector and pass valid
SHA-1/256/384/512 controls, cross-checked with Node crypto. Re-verify after any
CLI reinstall. Expo CLI device authentication completed as `luma.green`;
cloud internal APK build `4f29436f-7010-494d-af06-a234ff6e0ff0` finished
successfully on 26 October. Its 75,640,091-byte APK download returned HTTP 200.
Build page: https://expo.dev/accounts/lumagreens-team/projects/lumagreen/builds/4f29436f-7010-494d-af06-a234ff6e0ff0.
The readiness monitor was deleted after notification. Phone installation and
all real-device acceptance checks remain pending.
Expo generated the Android keystore remotely. No store submission or paid plan
was requested. Android CNG prebuild passes: app name/icon, DayNight appearance,
RTL, foreground location, camera intent delegation, disabled backups and blocked
camera/microphone/broad-storage/background-location permissions are generated.
The source archive includes the local uncommitted demo changes; its displayed
Git commit is the base revision and does not by itself identify the uploaded bytes.

Device acceptance, native camera/location/auth and store release remain separate.
Guide/Word updates remain deferred.

## Web UX simplification — 27 October 2026

## Platform foundation shipped and account setup follow up 28 October 2026

The foundation shipped through [checked PR10](https://github.com/lumagreen786-cell/Luma.Green/pull/10).
Main commit `d90c94548ac4354eaea096555f93ad2d670f0219` is live on
Vercel Production at [luma.green](https://luma.green). The Production Convex
backend was deployed first. Reference seeding added 51 material labels,
32 draft definitions and 17 service kinds; the repeat inserted zero.
All eleven specialist references remain inactive. No live prices, permits,
payments or identities were invented.

Final local checks passed 342 suites and 2,847 tests. Hosted checks passed,
including 830 public browser cases, two OTP boundary cases and five analytics
consent cases. Production Ready and live route checks are recorded in the
owner's `Downloads/Luma_Platform_Planning/Final_Release_Evidence` folder.
The reviewed 36-page specification, 16-page storybook and 10-page walkthrough
are in the same planning delivery folder. All 102 example captures are approved
and labelled as test data; they do not prove provider execution.

The tested follow-up merged through [PR11](https://github.com/lumagreen786-cell/Luma.Green/pull/11)
at `739d1d44babe0ba7e09349a22617f40fe485670d`. It passed 343 local suites
and 2,850 tests, the hosted CI checks, the public browser suite and configured
consent/bot-boundary checks. Current documentation closeout is on
`docs/provider-setup-final-status`. Read the
[exact account and API checklist](../operations/owner-setup-checklist-2026-10-28.md),
[key-free acceptance report](key-free-acceptance-2026-10-28.md) and
[local restore and workload report](local-operations-drill-2026-10-28.md).
New offline tests close joint-proof gaps without changing product behavior.
The local recovery drill proved 50 normal phone sessions, 100 photo bookings,
50 concurrent signed-in readers, scoped denials and exact restoration of
2,584 data rows and 104 files. All 28 canonical test participants passed the
Production-build local browser run with expected-role assertions. A stricter
development-server run had an intermittent syntax/loading failure; it did not
reproduce in that Production-build run. No product fix is claimed. Cloud recovery
and provider acceptance remain open.
Check this follow-up PR for its own verification; earlier checks do not prove
new changes passed.

Existing Production OTP and Surepass key names are installed. Development paid
Surepass calls remain off. Do not print or request existing secret values.
Optional accounts still need the scoped settings and acceptance listed in the
checklist. The repository is public: public CodeQL and dependency review can run
free. Hosted CodeQL passed (103 rules, zero reported results). The owner browser
session enabled Dependency graph and Dependabot vulnerability/malware alerts and
security updates, then installed `LUMA_DEPENDENCY_REVIEW_ENABLED=true`.
The repeat dependency-review job passed. CLI access is still push-only; no new
owner token was requested. Main protection was prepared but GitHub stopped its
save at owner email verification. The owner must finish that authentication step
and verify the saved five-check rule; do not claim main is protected yet.

Expo remains paused. The original primary checkout contains unrelated mobile
work; keep it intact. The foundation's temporary no-migration/demo-data deletion
authority expired when it shipped; preserve current records for future changes.
Do not infer whole-platform provider or legal acceptance from this web release.
The older entries below are historical.

## PAN discovery empty-draft repair — 26 October 2026

Production request `c549689970622512` failed in
`identityDiscovery.current` with `VALIDATION_REQUIRED`. The form subscribes
before its first autosave, while `applications.start` creates no business
section. Reusing paid-lookup eligibility for this read made that normal empty
state throw and activated the page error boundary.

The read now returns null when the owned business draft has no GST section or
is not GST registered. Phone verification, application ownership, business role,
parent-workspace access and editability remain required. Paid lookup and
selection still require GST registration and valid saved input. No migration,
quota reset or provider retry is needed. Regression tests cover all four fresh
business roles, removal of GST registration, and the unchanged paid-call gate.
Verification: all 2,571 web/backend tests and the type checks passed; the
Production build generated all 3,119 pages. The aggregate local check stopped
on missing native dependencies in this isolated checkout (155 native lint
errors); the repair does not change native code. Hosted CI must pass before
merge. Guide/Word updates remain deferred. Release status is recorded in the PR.

## PAN discovery and GST Advanced — 26 October 2026 (in progress)

Owner scope: registered shop, preprocessor, recycler and manufacturer onboarding
now accepts PAN, lists associated GSTINs and allows active-registration selection.
Saathi, household and admin flows stay excluded. Development work is isolated on
`feat/pan-gstin-onboarding`; primary checkout native changes belong to other work.
The implementation plan and verification ledger are
[pan-gstin-onboarding-plan.md](pan-gstin-onboarding-plan.md); the public contract is
[pan-gstin-discovery.md](../api/pan-gstin-discovery.md).

Surepass Production GSTIN Advanced became active during this task. A single
browser request using its published sample returned matching active registration
and business details. Its nested principal address supplies the required address
when the top-level field is null. Existing detail lookup now uses this fixed
Advanced endpoint without extra flags or automatic fallback. Standard GSTIN, IRN
and other requested PAN variants still showed unsubscribed at the latest check.
Earlier permission requests did not grant Production access. Total observed
operator spend across three sample calls: INR9.44 of the authorized INR100.
No retries or applicant records were created by those browser checks.

The PAN path reuses verified-phone application access, shared20/account/India-day
quota, duplicate/cooldown guards, 24-hour positive-proof reuse and safe audits.
Selection alone cannot satisfy GST business confirmation or activate a business.
New proof fields and a server-owned optional application marker are additive;
see the migration note. Clearing optional PAN restores direct GST confirmation.
Raw Advanced payloads, DOB enrichment, IRN and unrelated PAN APIs are outside
this bounded change. Guide/Word updates remain deferred at the owner's request.
Final local suite passed 2,566 tests; 18 synthetic browser cases passed, and
current captures were visually inspected. Web/backend types and production webpack
build passed. Development Convex schema/functions deployed successfully to
proper-caterpillar-111; SUREPASS_ENABLED remains false. Hosted CI and Production
website/backend rollout and real-applicant acceptance remain separate gates.
Full isolated native lint is blocked by missing native dependency links; primary
native changes are unrelated and preserved. No Vercel Preview is authorized.

## GST-only registration and automatic activation — 25 October 2026

This owner correction supersedes optional PAN and manual onboarding approval
requirements in earlier entries. All applicant PAN fields are removed. Mandatory
GSTIN for yard/preprocessor, recycler and manufacturer, and conditional GST for
registered kabadiwalas, now uses Corporate GSTIN lookup. The applicant sees the
provider name/address, explicitly confirms the business, then completes the
remaining form. Household booking stays unchanged; Saathi keeps ID/selfie uploads.

New valid submissions activate in one transaction through the same provisioning
owner used by existing administrative recovery. Snapshot, file-version and audit
history remain intact. Existing admin authentication, workspace permissions,
moderation, payment/evidence reviews and historical records remain unchanged.
Old GSTIN-by-PAN proof cannot satisfy the new confirmation requirement. Optional
proof metadata is additive; no database records are deleted or backfilled.

The shared 20 attempts per authenticated account per India day, no paid retries,
24-hour proof cache and duplicate/cooldown guards remain enforced. Provider
secrets stay only on the new Convex deployments. Development paid calls stay off.
A read-only bounded production check found one draft and no submitted applications;
no existing pending records require a review-state migration.

Surepass's Corporate GSTIN product is **not subscribed**. At the owner's request,
the console activation was attempted; Surepass returned **forbidden** and the
product remained inactive. The provider must enable `merchant/corporate-gstin`.
No successful live business-name lookup is established. UI fixtures and mocked
provider tests do not establish live provider acceptance. Do not spend repeated
applicant attempts while access is unavailable.

The typing-crash repair and production-only policy merged separately as
`faf4d26`. AGENTS.md and the shipping playbook prohibit Vercel previews;
`vercel.json` permits automatic Git deployments only for `main`. Main deploys
Production at `https://luma.green`; manual releases must explicitly use Production.
Guide/Word updates remain deferred at the owner's request.

Verification: `pnpm check` passed lint (65 existing warnings), both type checks,
2,507 web/backend tests and 73 native compatibility tests. The webpack production
build passed all 3,119 pages after clearing generated cache to recover disk space.
The 18-case browser matrix passed across three forms, English/Arabic/Kannada,
three widths and both themes. Development and production Convex schema/functions
were deployed to the new Sydney targets with no deleted indexes. Paid development
calls remain disabled. Website release status must be checked separately.

## Form typing crash repair — 25 October 2026

Production revision `36b441d` was reported to throw React `removeChild`
`NotFoundError` while typing. A regression reproduced that exact exception when
an external translator replaced the autosave indicator's conditional text node.
The shared SaveIndicator now keeps a stable text element across saving, saved
and failed states. No auth, paid-call, quota or draft persistence rules change.
A neighboring translated PAN/GST result clears safely without a code change.
The reported GST trace was VALIDATION_REQUIRED in reservation, before provider
transport; invalid format or a PAN/GST mismatch must be corrected, not retried as
a provider outage. No paid call was sent during this diagnosis.

## PAN/GST validation — 25 October 2026

The new Convex project owns Surepass PAN and GST calls. Both deployments have
`SUREPASS_API_TOKEN` saved and privately verified; development paid requests stay
off. Production `SUREPASS_ENABLED=true`; the operator example switch is false after the live test. No credential values belong in source or Vercel. See
[the reviewed contract](../api/surepass-validation.md) and
[implementation plan](surepass-plan.md).

The optional PAN field and explicit consent/check action are shared by shop,
yard, recycler, manufacturer and Saathi applications. GSTIN is mandatory for
yards/preprocessors, recyclers and manufacturers; kabadiwalas need it only when
they declare registration. Its embedded PAN supplies the lookup input. Household
flows have no PAN/GST fields. Saathi ID and selfie uploads remain required by
explicit owner confirmation; PAN remains optional. Checks require verified phone access to an
editable owned application. Submission requires current successful proof for
supplied identifiers. Proof expires after 24 hours and cannot validate changed
input. Provider checks do not replace admin application approval.

The owner corrected the earlier global allowance on 25 October: one
transactional profile/day counter reserves at most 20 combined PAN/GST attempts
per verified account per India calendar day, across all its applications.
The authenticated application access check supplies the profile ID. Another
account has its own allowance; total platform usage can exceed 20 with higher
provider charges. `identityCheckDays` tracks aggregate usage without imposing an
applicant cap. Operator example checks have a separate 20/day allowance and at
most one attempt per kind/day; they never spend an applicant allowance. Errors/timeouts consume attempts. There are no
paid retries. Pending requests are blocked for 24 hours if their result is
unknown; failed requests have a one-minute cooldown. Successful proof reuse does
not spend another attempt. Production and development counters are separate,
so paid development calls must stay disabled to preserve the total allowance.

Surepass saved all six official Sydney IPv4 egress addresses. Its console did
not persist either documented IPv6 CIDR range after repeated saves and reload.
Do not describe IPv6 allowlisting as complete or remove the IPv4 restriction.
Local `pnpm check` passed: lint, types, 2,498 web/backend tests and 73 native compatibility tests. Formatting and the 3,119-page webpack production build passed. Eighteen isolated browser cases covered both business forms at three widths, in English/Arabic/Kannada and both themes. At the owner’s later request, two production operator example calls ran from Convex using Surepass’s documented sample: PAN and GST each returned HTTP 422. Both attempts were counted, no applicant proof or application was created, and the temporary operator switch was disabled again. These are transport/rejection observations, not successful identity verification.
A valid owner-supplied PAN/GST check is still required to establish successful verification.
Guide/Word updates remain deferred. Browser UI checks use explicitly labelled
synthetic adapters and do not prove authentication or Surepass execution.

## Account migration — 24 October 2026

The owner requested migration to new GitHub, Convex and Vercel accounts. This
section supersedes historical account and deployment targets below. Preserve
historical records; do not deploy to the old targets during routine work.

- GitHub: `lumagreen786-cell/Luma.Green`. All six source branch heads matched
  the old repository after copying. `origin` points to the new repository;
  the old personal remote has been removed at the owner’s request. The new repository
  still needs owner-level branch protection configuration.
- Convex team/project: `muhammad-saif-ulla-c-m-252fb:luma-green`.
- Development: `proper-caterpillar-111.ap-southeast-2.convex.cloud` and the
  matching `.convex.site` HTTP actions address. Local `.env.local` selects it.
- Production: `astute-peccary-795.ap-southeast-2.convex.cloud` and the matching
  `.convex.site` address. The existing schema, indexes, functions and Better Auth
  component deployed to both new environments without a data import or seed.
- Vercel: team `luma-0f95`, project `luma-green`; website
  `https://luma.green` (production). `www.luma.green` redirects to the root
  domain with HTTP 308. `https://luma-green-ten.vercel.app` remains a production
  alias. The new project imports the new GitHub repository. The ignored local
  Vercel link selects the new team/project.
- Production frontend variables select only the new production Convex URLs and
  website address. Production Convex `SITE_URL=https://luma.green`;
  development uses `http://localhost:3000`. Both environments have distinct fresh
  authentication secrets. Production `EXTRA_TRUSTED_ORIGINS` retains the
  existing Vercel alias during the domain transition. Existing administrator
  identity and OS Digital OTP
  settings are migrated privately; no credential values belong in this file.
- `PUBLIC_DATA_ENABLED=false` keeps automatic data imports off, as requested.
  Do not enable imports, seed records, or send an OTP as part of migration checks.
  Unused old Vercel keys do not establish a configured backend service. Email,
  payments, R2, telemetry and push remain subject to their existing setup gates.

Before the website build, read-only verification found all 86 application and
seven Better Auth tables empty in each new deployment, with no stored files.
Vercel production deployment `dpl_24uj14htiSYzL5vbwve82mkR8LYD` published
commit `8dde08d2e0338292b74c926bc0d6c3f70eaa4aa2`. Homepage, member/admin
login and Arabic routes returned HTTP 200. Public browser bundles contain only
`astute-peccary-795`, with no old or development deployment names. The canonical
URL uses the new website address. A current desktop capture was visually checked;
no browser errors were reported. Local `pnpm check` passed all 2,480 web/backend
and 73 native compatibility tests, lint and types. No live OTP
or authenticator acceptance is established.

The custom domain uses Spaceship nameservers. The root A record is
`@ → 216.198.79.1`; the www CNAME is
`www → 59238d9ed9b5298a.vercel-dns-017.com`, both with a 30-minute TTL.
Authoritative and public DNS checks matched these values. Validated HTTPS checks
returned 200 for the root homepage/login and 308 from www to `https://luma.green/`.
The same-origin auth proxy returned 200 with no session. Vercel
`NEXT_PUBLIC_SITE_URL=https://luma.green` is saved. Production rebuild
`dpl_B5jY6KZeZ9c3nmnST1EEjT6NGTK3` completed and is ready. The root homepage
publishes `https://luma.green` as its canonical URL. The login page returns 200
and does not publish a canonical tag. The owner
reported that live OTP login works on `luma.green` on 24 October. This is owner
acceptance evidence; no agent-observed SMS/TOTP execution or native acceptance
is claimed.

The owner requested deletion of only the old Luma Vercel and Convex projects
after successful login on the new domain. Keep all other projects and both new
environments. Private old-development/production exports, including Better Auth
and file storage, are saved under the ignored local directory
`.convex/account-migration-backups/2026-10-24/`. Both ZIP integrity checks passed.
Old Convex environment recovery files and non-secret old Vercel project settings
are also saved there. Do not print or commit those recovery files. The owner reported the live login test passed. Old Vercel project
`thehelds-projects/luma_green` (`prj_ceMcCzKReKt06pJ3fIYcSexsoLd1`) was then
deleted successfully. Its only assigned domain was `lumagreen.vercel.app`; the
new root/www domain mappings are on the new project. The owner then reported
that they deleted the old Convex project themselves. No agent-executed or
independent verification of that deletion is claimed. Never delete the new
Convex project or either of its deployments.
Cloudflare, PAN/GST APIs and provider-specific IP allowlisting are next steps;
they are not configured by this migration. The old GitHub repository and
accounts have not been deleted by this task. Old Vercel deletion is verified;
old Convex deletion is owner-reported as described above.

Guide/Word changes remain deferred; no user-guide update was requested. Native
apps remain on hold. This migration changes no application flow or native code.

## Latest household recycling and homepage direction — 16 October 2026

The owner reviewed localhost and authorized commit and push after testing. This
supersedes the earlier hold below. Do not infer authorization to merge this new
revision from the earlier PR58 merge. Native apps remain on hold.

The animated homepage is removed. A newly generated household recycling banner
leads with Recycle; image-led business sections follow, including a generated
recycling-chain illustration. Demo testimonials are removed. The shared public
and login header, mobile menu and footer are redesigned. Material records now
follow the active light/dark theme; repetitive divider decoration is reduced.

The household form now asks for photos, name, pickup address/location, pickup or
drop-off, a nearby shop and a time, then real phone OTP. It no longer asks for
material categories, weights or an invented estimate. Private photos upload only
after authentication. The shop later records actual material/weight/payment.
See [the photo contract](../architecture/household-photos.md). Exact retries keep
the original request arguments so a lost response cannot create a second booking.
Existing item-based internal bookings remain supported. No data was deleted.

Current verification: `pnpm check` passed with 2,480 web/backend tests and 73
native compatibility tests, lint and web/backend/native types. The 17-case final
visual run passed all four form cases and phone/navigation cases; eight tablet/
desktop cases first hit an ambiguous price-link selector, then all eight passed
with a selector for the actual button. Hero actions are side by side at tablet/
desktop widths. Current local captures are in `captures/2026-10-16-recycling`.
The clean webpack production build passed all 3,119 pages. The additive backend
is deployed to verified production `outstanding-buzzard-942.eu-west-1.convex.cloud`
with no index removals. Production function metadata confirms the new photo API.
No SMS/provider acceptance is claimed. The matching development deployment
`glorious-rooster-470` also passed. Source checkpoint `28111d0` contains the
verified implementation; this documentation update does not change runtime code.
Read current GitHub state for the final merge result. Recovery history and the
pre-release working tree are saved under
`/tmp/luma-20261016-release-recovery/`. Only `main` is to remain after cleanup. Earlier screenshots and
2,435-test combined-run results below do not certify this latest revision. No SMS
has been sent. Convex reports that the team is above Free-plan limits. This is an account
usage warning; no service purchase or upgrade was performed.

The owner now explicitly authorizes the protected-main PR merge, closing other
PRs and removing non-main branches. Save recovery material first. Stop after the
merge triggers Vercel; do not wait for or monitor Vercel's deployment build.

## Astryx web redesign and application repair — 16 October 2026

PR #58 was squash-merged as `c81aca9`. The owner requested a larger redesign
using Astryx and reported four `applications:start` errors. Current work is on
`feat/astryx-web-redesign`; it is not deployed yet. The owner requires local
review before any commit, push or pull request. Do not perform those actions
until the owner approves the local version.

All four supplied production request IDs were `NOT_A_MEMBER`: the administrator
account was shown member consent. The web gate now routes administrators to the
admin console or required authenticator setup before showing consent. The server
member-only rule remains intact. The login page now resumes a confirmed existing
session, instead of showing the phone form again. The public header now shows the account action for a confirmed session.
Session lifetime and required factors have not changed. A separate member account is required to test operator
onboarding. Regression tests cover member consent, administrator routing, session
loading and safe return paths; existing adapter tests retain server coverage.

Astryx components now use the existing Luma light/dark palette. The owner explicitly rejected the Matcha colour change; original colours are restored. Luma keeps its Geist/Noto fonts,
locale handling and existing permissions. Entry forms are centred without a side
panel; role selection uses large photos and short descriptions. Public pages use
new task-first compositions; the homepage now has a booking walkthrough with
clearly labelled sample data, real UI controls, pause/replay and reduced motion. Shared controls, account navigation, operational
layouts, workspaces and admin surfaces use the same theme. Native apps remain on
hold. No new Cloudflare settings are required by this UI change.

The owner then rejected the remaining old composition and requested shorter,
task-first flows across the web. See [current rebuild coverage](ux-rebuild-2026-10-16.md).
Login now has one compact action; applications use validated stages; booking
shows one material family at a time. Public explanations are optional. Work
screens separate tasks and retain visited drafts; record detail has keyboard
focus and a close path. Admin review keeps approval checks visible.

Sign-in now uses real Send OTP wording across all 33 locales. The five-minute
resend display uses the successful-send time and survives refresh; server quota
enforcement remains unchanged. Fake OTP preview navigation has been removed.
The centred login passed 55 focused tests and 24 browser checks; no SMS was sent.

Current checks: the clean webpack production build passed with all 3,119 pages,
and web/backend type checks passed. After that build, only workspace spacing,
a Malayalam button label, narrow-screen time-field layout and test-clock code changed; no new CSS utilities or
server behavior were added. Full lint findings were repaired and the
reported files passed the scoped lint check. The homepage preview passed 11
unit tests, 14 browser checks (English/Arabic, light/dark, 390/768/1440px), and a
final explicit-Play regression. Current captures are in
`/tmp/luma-preview-split-results`; they use labelled sample data.

The final full run passed 2,429 of 2,435 tests. Four files hit five-second
timeouts under concurrent visual-check load; one long OTP test clock loop also
caused two later assertions to fail. The OTP tests now advance the wall clock
directly without changing server behavior. All four affected files passed in a
quiet single-worker rerun (23/23), covering all six failures without increased
timeouts. This is combined-run evidence, not a claim of a single green full run.

Protected operational review passed 28 synthetic captures with no page errors
or horizontal overflow; English/Arabic phone-light and desktop-dark views were
inspected. A duplicate workspace divider was removed and separately recaptured.
Signup/basket review passed 22 fixture visits across English/Arabic and a
320px Malayalam check. One clipped Malayalam submit label was shortened and
rechecked in both themes; basket family changes also passed. Native time inputs
now stack below the small breakpoint; their full AM/PM values were visually
confirmed at 320px in both themes (`/tmp/luma-entry-hours-fixed`). Saathi lacks a
dedicated fixture capture and remains a visual coverage gap. These fixtures do
not prove live authentication, provider delivery or mutation execution.
The earlier 2,412-test check and old guide screenshots do not certify this pass.
The build required network access for configured Google fonts; earlier disk-space
failures were resolved by removing only this checkout's generated build output.
Normal configured development is restored at `http://localhost:3000` (log
`/tmp/luma-local-configured-review.log`); homepage and centred real Send OTP
screen were inspected. No SMS was sent. All temporary fixture servers are stopped.
No deployment or SMS/provider execution is claimed. Guide and Word updates remain
deferred until requested. Do not monitor production after merge: the owner asked
to perform their own deployed testing.

## Web platform redesign — 15 October 2026

The prior technical release is merged as `c24ae79` (PR #57), with Convex deployed
and Vercel production verified in the release turn. The owner has now resumed
web UI work and approved adapted IMAI skills, explicitly removing Impeccable.
Current branch: `feat/imai-web-forms`. See
[web UI scope and verification](entry-forms-2026-10-15.md).

Native apps remain on hold. Repo-local Impeccable is removed; eleven adapted
IMAI skills have Codex discovery links. The owner expanded this pass to the whole
web platform: public pages, login/signup, household recycling, shared operational
layouts, accounts, workspaces and admin. Use open sections and solid surfaces;
avoid nested cards, decorative gradients and repeated explanations. Existing
authentication, provider controls, server validation and application permissions
remain the owners of behavior.

Old guide/team-review captures are historical after the redesign. The unchanged
team-review artifact freshness tests now join the optional `pnpm guide:check`
suite, consistent with documentation maintenance on request. New UI tests and
current browser captures provide this release's evidence.

Local `pnpm check` passed: 2,396 web/backend tests and 73 native policy tests,
lint and type checks. The clean production build and formatting passed. The
771-case browser run exposed three outdated image assertions and three host-load
retries; the corrected showcase/Spanish rerun passed all 52 cases. All 48 isolated
fixture cases passed against fresh CSS. See the linked scope document for current
screenshots and verification limits. PR checks, preview and production verification
remain release gates.

## Technical release closeout — 15 October 2026

Owner authorization now includes finishing backend work, tests, commit, push and
production deployment. UI redesign and new organization/task screens remain on
hold. Native work is still on hold. Earlier approved Turnstile native policy
edits are preserved. The owner also approved only the Expo 57.0.30 patch and
required dependency updates after hosted compatibility checks requested it.
No native binaries are released.

New-site requests now use separate application IDs, canonical validation and
platform approval. Personal onboarding keeps its original no-argument reader.
Identity files remain applicant/admin-only. Assignment/comment inbox notices and
scheduled due reminders check current record access; stale timers and duplicate
notices are ignored, and revoked access cancels pending push.

Cloudflare setup is consolidated in `docs/operations/cloudflare-setup.md`, linked
from the README. Production Convex has no R2/Turnstile settings at this check.
Older R2 settings exist in Vercel, but the runtime needs `R2_BUCKET_NAME` and the
credentials on Convex. Do not assume those old entries are valid credentials.
The verified production alias is `lumagreen.vercel.app`; `luma.green` was not
configured as an alias and did not resolve during the check. Public browser
bundles confirm the `outstanding-buzzard-942` backend. An attempted full Vercel
environment export was rejected by automatic approval review because it would
download unrelated secrets; the public-bundle check avoided that export.
Both optional services stay off. A public translated privacy notice remains a
Turnstile activation gate. No Cloudflare account or paid service was created.

The isolated local backend accepted the final schema/functions. The production
Convex dry run passed, with no index deletions. It reported that the Convex team
is above free-plan limits; billing was not changed. Final local `pnpm check` passed: 281 test files / 2,396 tests, web/Convex
type checks, lint (31 existing warnings, no errors), and 73 native policy tests
plus their type checks. Formatting and diff checks passed. Both isolated
Turnstile browser tests passed. The production build passed with optional Convex/Turnstile settings empty.
Its first attempt ran out of local disk space; deleting only this checkout's
generated `.next` tree and rebuilding succeeded. All 753 standard local browser tests passed. Core commit `62c327c` passed the
five required hosted web checks and produced a ready Vercel preview. Its native
compatibility check required Expo 57.0.30; the approved patch now passes local
compatibility and all 73 native policy tests/types. Remote checks for the patch
and production deployment remain release gates.

The first full unit run passed 2,393 tests and exposed a team-review capture hash
change from a duplicated notification catalog key. Task notices now reuse the
existing generic translated title. All catalogs and capture hashes remain
unchanged, and the original freshness assertions remain enabled. The focused
notification, collaboration and team-review suites passed 24 tests afterward.
No guide or Word rebuild was performed.

## Organization backend and UI hold — 15 October 2026

The owner approved organization/workspace implementation, then explicitly put
all UI redesign on hold for a later page-by-page pass. Expo/mobile and
Electron/desktop work are also on hold. `AGENTS.md` records these priorities.
Earlier native Turnstile changes remain intact; this increment did not edit
native files or public web screens.

Company governance now sits above existing approved sites. Site membership
remains the operational authority. Verified-phone invitations support either
scope without email/password enrollment or automatic SMS. Record tasks and
versioned comments cover pickups, trades, inspections and assigned Saathi jobs;
internal Luma tasks have a separate scope. Role changes protect the final owner,
sensitive grants require a recent session, and state changes write audit events.

Read `docs/architecture/organizations.md` for the actual API contract and limits.
The larger proposal is a roadmap, not a completion claim: company/team screens,
phone-invite pages and task controls remain UI work. The later closeout above
adds inbox reminders and regulated-site requests. Existing support messaging is retained.
No automatic parent-wide operational access, new legal recipient inheritance,
cross-site stock transfer or migration framework was introduced.

Core backend verification: all 280 unit-test files / 2,387 tests passed with
one worker and a local 30-second test limit. The ordinary five-second limit
hit timeouts under host load; the first full attempt was stopped and rerun
without changing assertions or CI settings. The 17 initial new tests also passed
at the normal limit; the final suite includes 20 new tests. The 88 related
workspace/messaging/quality-file tests passed. Web and Convex type checks passed.
Full lint passed with 31 existing warnings and no errors. Formatting and
`git diff --check` passed. The isolated anonymous backend on ports 3290/3291
accepted the new schema and functions after a retry: its first attempt exceeded
the one-second auth-config execution limit under load. Cloud bindings were
explicitly cleared. No hosted deployment was changed.

No production release or provider account configuration is claimed. All changes remain local
on `feat/otp-turnstile` with the prior Turnstile/R2 work. Guide impact is deferred:
there are no new screens to capture and the owner did not request a guide update.

## R2 quality storage implementation — 15 October 2026

The owner approved R2 implementation and confirmed that this is an internal
prototype with no real user data. `AGENTS.md` now records permission to change
schemas/reset prototype data without migration until rollout is declared.
No existing data was deleted. Organization/workspace runtime changes remain on
hold as a plan; its migration notes now defer to the prototype policy.

New quality attachments support private R2 through the existing validated byte
action. The 2 MiB limit and private HTTP download contract remain. Application
and identity documents still use Convex. Unconfigured quality uploads also use
Convex. This is deliberate optional-service behavior, not an outage fallback.
R2 uses a server-only aws4fetch signer, recorded account/bucket/key, SHA-256 read
checks, quota reservations and a retryable cleanup cron. No browser signed URL
or new native origin is required. No cloud resources or credentials were created.

Verification: 278 unit-test files / 2,367 tests passed; the focused storage suite
passed 48 tests. Type checks passed. Full lint passed with 31 existing warnings
and no errors. Convex code generation succeeded. An isolated temporary anonymous
backend on ports 3290/3291 accepted the schema/functions and ran cleanup with
zero failures; it contained no cloud binding or R2 credentials. One retry was
rejected by automatic review for not explicitly clearing inherited cloud bindings;
the corrected command cleared them and succeeded. No cloud deployment was made.
Live R2 upload/read/delete and native-device acceptance remain unverified until
the owner configures a private bucket. See the README and R2 setup document.
No UI layout changed and no user-guide rebuild was requested.

## Storage and organization planning — 15 October 2026

The owner requested a durable setup reminder and plans for R2 and collaboration.
The root README now includes Turnstile configuration and activation steps.
`docs/architecture/r2-storage-plan.md` and
`docs/product/organization-workspaces-plan.md` are proposals only. No R2 or
organization runtime changes, bucket provisioning or migration were made.
Existing org/team access and private file routes informed the plans. The parent
model, phone-bound invitations, site approval and parent access policy need review
before implementation. Existing Turnstile changes remain local and uncommitted.
No user-guide rebuild was requested; these documents do not change the UI.

## OTP bot protection — 15 October 2026

Owner approved invisible Turnstile for all phone-code sends/resends. Shared client
and Convex HTTP-hook enforcement are implemented; deployment remains off until
keys, hostnames and enforcement are configured. Native shell challenge-frame
allowances need rebuilt binaries and real device acceptance. No external account,
provider keys, production deployment or storage migration was created.
See `docs/operations/turnstile.md` for rollout, test boundaries and pricing.
Public privacy-notice publication (with Cloudflare's addendum link) remains an
explicit activation gate. Guide impact is deferred per owner policy: background
bot verification uses existing loading/error UI; no guide rebuild was requested.

Local verification: 277 unit-test files / 2,336 tests passed; 73 native tests
passed; the two isolated browser tests passed. Web, Convex, mobile and desktop
type checks passed. Full lint passed with existing warnings and no errors.
The production build passed with optional Convex and Turnstile public settings
empty; the build required network access for fonts.
These tests mock Cloudflare/SMS and do not establish live provider acceptance.
Checks ran individually with pnpm dependency auto-verification disabled because
the installed workspace otherwise attempted an interactive dependency reinstall.

## Branch consolidation — 14 October 2026

The owner requested one main branch and integration of open PRs. PR #56 was
blocked by the old admin password-recovery browser expectation. Its approved
phone-only contract redirects both retired recovery routes to `/admin/login`.
The browser regression now verifies both redirects, absence of email/password
inputs, and retained noindex metadata. All nine focused account/email-route
browser tests pass. Required full and hosted checks must pass before merge.

The primary checkout's unfinished prototype and SMS files were reviewed against
current main and PR #56. The SMS delta is superseded by the newer guarded PR
implementation; the older admin setup lacks the PR's session-change/unmount
protection. The prototype route depends on the excluded public
`demoWorkspace.prototype` function, while current main retains only the guarded
preview. Later product interview decisions supersede the old interview state.
Old screenshots and generated guide artifacts do not prove the current UI.
Do not merge this stale checkout over the release.

All pre-cleanup refs and unfinished tracked/untracked files are preserved in
`.git/luma-cleanup-20261014/` with a verified Git bundle and checksums. This is
local recovery material, not a deployment artifact. Old branch names may be
removed without claiming their unique commits were merged.

Guide impact: this consolidation changes tests and repository state only; no
screen or workflow changes beyond the existing PR. No guide rebuild is needed
for this regression correction. PR #56's previously deferred guide work remains
deferred; historical captures are not current-release proof.

# Agent handoff — updated 12 October 2026

## Impeccable platform UI release — 12 October 2026

The owner authorized the dependency PR review, platform UI rewrite, skill installation,
commit, push and deployment. Work is isolated on `codex/impeccable-platform` from
main `4f704d44f47c83bb4d527a4eff2eb7ec5afd5c6d`; the dirty primary prototype checkout
is unchanged. Read `impeccable-ui-2026-10-12.md` for the full review and release gates.

Dependency PRs #50, #51, #53 and #54 were closed unmerged after compatibility and
check review. Required Next.js 16.3.8 and eslint-config-next 16.3.8 are retained in
this replacement release. Keep #52 open until that patch lands through the protected
branch. Bot source branches are preserved.

Impeccable 4.4.0 is installed under `.claude/skills/impeccable` with its license and
notice. The existing product, design and translation owners remain canonical.
The 64-route inventory is addressed through shared public, auth, join, account,
operational and admin layouts. Task titles, action placement, form grouping and
navigation spacing are consistent. Arabic and Urdu notices follow the locale
direction. No route, authorization, business mutation, money/mass calculation,
provider setting or native installer changed.

Guide impact: affected screenshots have been recaptured from current source and visually reviewed.
The platform Word source describes the new navigation and form layout. The platform Word document has 166 reviewed pages; the team
Word document has 72 reviewed pages. Table rows stay on one page, step labels fit
and the queue provenance note stays with its screenshot. Both build records match
the current source and screenshot inputs. Capture uses this task's isolated database
on ports 3210/3211 and frontend 3115 with approved synthetic accounts; it does not
access hosted records. Parallel capture caused local database timeouts, so the
final matrices completed sequentially. Error screens cannot be recorded as operational
screens. The old source-compatibility record remains historical evidence only.

Google Docs publication is pending because no document session is connected.
Reuse document `17B40PdN8IyvydXhAH4r2nsfgy9Nt15cyzW5WZw6ecFY` and preserve its
sharing and user edits. Read `docs/user-guide/cloud.json` before publication.

Current checkpoint: all browser and Word evidence is reviewed. Local application,
native, production-build and browser checks have passed as recorded in the release
note. Final `pnpm check` passes: 279 web test files / 2,369 tests, 49 mobile
tests and 22 desktop tests. Lint has zero errors and 30 warnings. Formatting and
the default production build pass. PR checks, merge and production verification
remain gates.
No release is claimed by this checkpoint.

## Investor demo seed — 10 October 2026

The owner requested a populated production and development investor demonstration.
The additive `investor-2026-10-10` batch is now imported into
`outstanding-buzzard-942` and `glorious-rooster-470`. Each environment contains
140 fictional password identities (five examples of each of 28 persona templates),
40 organisations, 60 stakeholder accounts, 558 facility examples, 240 stock rows,
120 lots and 60 requested/accepted trades. No platform administrator was created.
All identities and businesses are visibly labelled DEMO. Real business research
is background only, not evidence of customers or affiliation.

Both deployments passed count, five-cohort integrity and 40-page reference checks:
3,903 manifest references exist, with no missing/duplicate references, stock
mismatches, seeded admin profiles or provider-payment records. The import gates
were removed after each run. Hosted local auth flags are absent; the obsolete
`AUTH_DEV_MODE` was removed from development. Existing public signup and factor
rules were not changed. Development was resumed after confirming no queued jobs.

No production export was performed: automatic approval review rejected copying
unrelated production records. Import receipts are an exact additive inventory;
they do not represent a backup. Later cleanup must review these receipts and
subsequent user activity before removal. Do not run a broad reset.

Normal email UI sign-in and sign-out passed initially in both environments.
The short investor guide has 14 reviewed pages and 12 fresh development browser
screenshots. Full role checks found and reproduced an explicit sign-out race:
Convex revoked the token before Better Auth cleared its cached session. The
correction pauses queries only for that exact deliberate logout after device
revocation; failure restores ordinary recovery, and a different session remains
fully verified. Its 60 focused tests, four repeated browser logout cases and independent review pass. Full checks,
frontend release and post-fix browser acceptance are being finalised; read
`docs/investor-demo` for the final evidence. Phone verification, gateway payment,
email delivery, regulatory approvals and physical material events remain unproved.
Convex warned that the team is above Free plan limits; no plan upgrade was made.

Private credentials and annexes are preserved in the primary checkout under
`.convex/investor-demo/{development,production}` with restricted permissions.
Never add these files to Git or the shared platform guide. Production uses
<https://lumagreen.vercel.app>; cloud-development frontend testing uses local
<http://localhost:3102> and requires the local server to run.

Guide impact: no public route, control, permission or normal auth flow changed.
The separate short investor tour has fresh seeded browser evidence. The maintained
platform guide keeps its original images, timestamps and review records.
An explicit nonvisual source compatibility record binds the changed internal
seed/schema/config files and the sign-out ordering fix. Seven affected screenshot
matrices retain their original source snapshots and an explicit compatibility review.
Dedicated browser checks, not historical screenshots, prove the corrected sign-out. A rebuild matched all 165 Word ZIP member payloads;
the original DOCX bytes and 167-page review remain unchanged. Google Docs body
content did not change. See `docs/user-guide/investor-source-compatibility.json`.

## Production frontend verified — 7 October 2026

PR #47 merged through the protected branch as
`23fefc792d9e8a3b8014ce6ba135faf012096a03`. All five required checks and native
validation passed. The hosted browser workflow passed all 747 public cases and
all five analytics-consent cases. Vercel production
`dpl_2ptn9SYtcu3ZPdNfrj3M8ZYjFkgU` is Ready and serves
<https://lumagreen.vercel.app>. Home, login, join and the anonymous auth-session
endpoint returned HTTP 200. Both live sign-in tabs were inspected in the browser;
no browser error logs were observed. This did not create an account or prove
email, SMS or payment-provider delivery.

The production backend is running. Readback at 04:16 UTC confirmed the correct
site URL, an auth secret, no local test mode, no production admin identity and no
live payment activation. The admin identity, provider setup/acceptance, custom
domain and signed native releases remain launch gates. The Word guide now states
the verified production release and has 167 reviewed pages. The same Google Doc
is updated and verified: 147 screenshot placements, 12 tables, 12 native dates
and 170 reviewed PDF pages. See `docs/user-guide/cloud.json` and its publication
review record for exact hashes, historical records and native accessibility limits.
The final guide `pnpm check` passed. No application code changed. Four inactive
task worktrees were archived with recoverable Git snapshots and preserved private
evidence. The integration worktree remains until its local database, credentials
and runtime are preserved and verified. `recycling-ui` belongs to another chat;
the managed tool refused to attach it, so it was not removed.

Private evidence: primary `.convex/guide-release/hosted-e2e-release.log`,
`production-http-verification.json`, `production-login-2026-10-07.jpg` and the
integration `.convex/release-work/production-readiness.json`. The source PR also
records the exact preview, merge and production state.

## Production backend deployed — 7 October 2026

The tested backend is deployed to `outstanding-buzzard-942`. Fresh readback
confirms running state, 76 schema tables, 278 functions, the Better Auth component,
zero application rows and zero stored files. Local test mode and live payment
activation are absent. The production admin identity is unconfigured. The Vercel
frontend is still awaiting PR #47, final hosted checks and merge; this backend
result does not establish a frontend release.

The first hosted native check found four newer Expo SDK 57 patch requirements.
Those packages and the lockfile were updated, preserving dependency security
settings. Native tests, compatibility and Android/iOS export pass locally.

## Release checkpoint — 7 October 2026

Application commit `f5c5b91` contains the final implementation and the report
approval fix. Pending corrections and superseded inspections cannot be shared.
The quality regression tests pass 21 cases; the real local sharing and revocation
browser flow passes. Normal commit hooks passed. Mobile checks pass 49 tests and
desktop checks pass 22 tests. The final lots matrix has 450 captures: 77 newly
inspected originals and 373 exact-byte carryovers. Its two freshness tests pass.
The refinement matrix has 246 reviewed views and 18 honest unavailable skips;
its five tests pass. The public matrix has 37 reviewed views and no external or
authentication requests. The public screenshot margin has been corrected.
The workbook matrix has 342 reviewed views, no skipped views and two passing
freshness tests. All final manifests bind to this application revision. The final
Word guide has 167 visually reviewed pages and 147 screenshot uses; its source,
image and document hashes pass the freshness check. The production build passes. Rejected capture runs are not release evidence.

Fresh production preflight confirms paused state, zero rows, zero files, zero
queued scheduled functions, no application components, an empty active schema,
no deployed functions and no cron definitions. There are 76 empty table names in
the metadata. This is an empty dataset, not evidence that no table definitions
exist. No deletion or production deployment was performed at this checkpoint.
Local verification and live-payment activation remain absent from production.
The production administrator identity is still unconfigured.

The current release scan checks 1,302 text/XML files against 35 private values
and common key patterns, with zero matches. Local logs are in the ignored
`.convex/release-work` directory. The final main Word has 167 reviewed pages. The team manual has 72 pages;
reconstructed old/new renders match exactly after the shared builder refresh.
The complete `pnpm check` passes: 2,324 web/backend tests, 49 mobile tests and
22 desktop tests, with types and lint passing. The production build and formatting
check pass. Protected PR/CI, backend-before-frontend publication and cloud-guide
readback remain open. Logs: `.convex/release-work/release-final-check-2.log`,
`final-production-build.log` and `release-final-format.log`.

## Restored local runtime acceptance — 7 October 2026

A runtime interruption removed temporary logs and stopped local services. The
repository and private local database survived. The local backend was restarted
with explicit loopback bindings on ports 3210 and 3211; the local inbox and the
existing production web build were restored. All **55 connected browser tests
passed again in 4.3 minutes**. Current durable evidence is the ignored
`.convex/release-work/connected-restored-runtime.log` in the integration checkout.
Earlier `/private/tmp` paths below are historical records and no longer exist.
No production data or deployment was changed during recovery.

## Final connected acceptance passed — 7 October 2026

The normal Turbopack production build passed. All **55 connected browser cases
passed in 4.7 minutes** on the isolated local backend
(`/private/tmp/luma-final-connected-menu-acceptance.log`). All five analytics
consent cases passed in 7.1 seconds with intercepted vendors; both analytics
originals were visually inspected. Full lint passes with zero errors and 21
warnings. All source files pass Prettier. The final known-secret scan checked
2,821 candidate files and DOCX XML against 33 private values and common key
patterns, with zero matches. It does not replace provider or security acceptance.

Public37 and fixture126 were recaptured after the AccountMenu fix, with current
source/PNG review bindings. Workbook342, lots450 and refinement246 refreshes are
running against the final local build. Main guide copy now includes all workbook
routes and correct conditional gateway instructions. Team Word72 and planning
Word13/12 remain reviewed. Final main Word/full checks, protected PR/CI,
production deployment, same-ID Google Docs update and worktree cleanup remain.

## Public browser acceptance passed — 7 October 2026

The full 747-case disconnected public suite completed with 719 passes and 28
failures in 7.3 minutes (`/private/tmp/luma-release-public-e2e-menu-fixed.log`).
The failures were stale expectations for renamed preprocessors, gateway wording,
compact secondary page artwork, and two alert selectors that also matched Next's
route announcer. No image-loading, resolution, content or layout check was removed.
All 77 cases across the four affected specs pass after repair
(`/private/tmp/luma-final-public-repaired-specs.log`, 18.3 seconds).
Together these runs cover every case in the public suite on the current build.

The prior disconnected AccountMenu session-hook defect was fixed and verified:
five focused unit tests and all preview no-auth-request browser checks pass.
The image-quality test now checks decoded dimensions against rendered width and
height for the approved direct WebP assets. Its ten browser cases pass.

The 37 public screenshots were recaptured after the menu fix. Every new PNG is
byte-identical to its directly inspected original; current source hashes and
explicit carry-forward review bindings are recorded. The remaining connected
and fixture capture refresh, analytics checks, main Word rebuild, full checks,
protected PR/CI, same-ID Google Docs update and production deployment are pending.
Team Word is reviewed at 72 pages; planning outputs are reviewed at 13 and 12 pages.
The main/team DOCX artifact marker ran once for two edits; do not repeat it.

## Final visual-review correction — 7 October 2026

Original-image review found that Stock and the shop Home summary labelled a sum
of priced rows as the complete valuation, even when some held materials had no
price. `stock.mine` now returns a null total for incomplete pricing; both screens
show a dash and the existing translated missing-price message. Empty stock still
has a true zero value. Regression tests reproduced four failures before the fix
and pass 20/20 after it. Schema and money arithmetic are unchanged. The local
backend reload passed. The production webpack build and focused connected byproduct check (2/2 in
9.6 seconds) pass. Final capture refresh is in progress. Guide chapter 11
explains the distinction.

The first final capture review completed36 admin and2 price originals; their
source hashes and review records match. Account recovery captured36 originals,
verified six manual recoveries/sign-outs and passed visual review. These use
local disposable accounts and do not prove a live provider or production login.

## Production preparation and copy review — 7 October 2026

Production `outstanding-buzzard-942` remains paused. Exact owner authorization
verified its production type and regional endpoint. The read-only scheduled-table
command returned no records (exit0). A deployment dry run with type checking
passed; no functions or schema were deployed. The authorized release preparation
set only `SITE_URL=https://lumagreen.vercel.app` and a fresh private
`BETTER_AUTH_SECRET`. Private readback matched both values, confirmed paused
state, and confirmed no local test mode or production admin identity. No provider
was activated. Production admin identity remains a founder setup requirement.
Private setup files and readback are in the primary checkout's ignored
`.convex/platform-release-2026-10-06` directory. Never print their values.

The first final246-image review found outdated source-chain wording in business
Home and Buy. Four message keys are now corrected in all33 locales; Buy explains
approved material scope for kabadiwalas too. Focused locale/buyer/home tests pass
110/110. The webpack production build passes (the existing third-party Sentry
instrumentation warning remains). The repeated connected55-case run passed55/55 in4.6 minutes against this updated
source (`/private/tmp/luma-final-connected-scope-copy.log`). Final capture review
is in progress. Prior246 originals
are diagnostic layout evidence only, not final content approval.

## Current verified candidate — 7 October 2026

The final combined connected suite passed **55 of 55 browser cases in 4.6 minutes**
against the local production build on 7 October 2026. Evidence:
`/private/tmp/luma-final-connected-scope-copy.log`. This includes the new sourcing,
route/load, governed operations, private quality-file/report-sharing and dialog
keyboard journeys, plus the existing account, workspace, material and financial
flows. Full lint passed with zero errors and 20 warnings; production build,
web/backend types and native tests (49 mobile, 22 desktop) passed.

Final responsive captures and original-image review, maintained Word rebuilds,
same-ID Google Docs publication and the final full `pnpm check` remain pending.
The latest full preflight passed 2,306 of 2,322 tests in 79.58 seconds. All
16 remaining failures concern capture/document freshness. Web/backend type
checks and native checks (49 mobile, 22 desktop) pass. Protected PR/CI, backend-before-frontend deployment, production
smoke tests and actual provider acceptance are separate pending gates. Local
results do not establish production or provider execution.

Planning Word documents are rebuilt and reviewed: interview 13 pages and launch 12
pages. Every final page is covered by original-image inspection; clickable
repository/external hyperlinks are verified. Hash-bound evidence is in
[planning document review](planning-documents-review.json). This does not complete
the main platform guide, team review pack or Google Docs publication.

Earlier dated sections below retain the audit history and are superseded by this
checkpoint where their current-state counts differ. Application source is frozen
for final captures. No production seed is included in release.

## Workbook completion active; production release requested — 7 October, 03:05 IST

The source freeze is lifted for the eight account-free workflow gaps in
[the workbook completion plan](../plans/2026-10-07-workbook-completion.md).
Sourcing, quality files/report sharing, route planning, governed definitions,
production declarations and facility/destination review are integrated in source.
All 33 locale fragments are merged. Focused results so far: sourcing 30,
quality/sharing 24, logistics 15, root operations backend 8 and UI 3 passes.
Independent cross-review is active; integrated checks and real browser journeys
for this new source remain pending. Earlier 50-case browser acceptance and 246
reviewed captures below are historical checkpoints, not final current evidence.
The founder explicitly requested Vercel production deployment; proceed through
the existing protected PR and backend-before-frontend release checks. Do not
claim deployment before verification. Estimated progress shared with the founder:
80% implementation, 60% complete launch handoff, approximate rather than measured.
Guide impact: add all new workflows, capture the final UI, rebuild/review Word,
update the existing Google Doc, and retain private credentials separately.

## Workbook verification checkpoint — 7 October, 03:23 IST

Full preflight: 2,294 tests passed, 23 failed. Twenty-one failures concern pending
capture/Word evidence; the two others were Italian upload copy and the seven-link
admin navigation expectation. Locale validation now passes all33 catalogues and
2,940 messages; focused locale101 and admin navigation6 tests pass. Full lint has
zero errors and20 warnings. The production build passes.
The second new browser run passed4/5, including operations, sourcing, logistics
and keyboard dialog scrolling. Private-file download remains under diagnosis by
auth_release. Final combined old/new acceptance and all final evidence remain
pending; do not treat preflight as a green `pnpm check`.
Vercel project luma_green access is verified. Its production public Convex endpoint
is the regional outstanding-buzzard-942.eu-west-1.convex.cloud host. Sensitive
values pulled by Vercel are redacted; do not mistake redaction placeholders for
actual settings or propagate them into a deployment. Both cloud Convex targets
remain paused with no application tables. No cloud mutation or PR has occurred.

## Workbook first browser run and local credential rotation

The first new-workflow run passed logistics and dialog keyboard scrolling,
but failed operations, quality sharing and sourcing (2/5). The operations page
was outside the admin `(console)` layout; it is now moved under that existing
authenticated layout. Quality's test matched a populated draft before the save;
sourcing's test omitted the visible dates around the status. Both test assertions
are corrected without changing application rules. A rebuilt rerun is required.

A process diagnostic accidentally printed the local instance credential. The
local instance secret and admin key were rotated, with a private database backup.
The previous key is rejected; the new key reads all78 table mappings. Cloud keys
were not involved. Backup/config stay under ignored mode0700/0600 storage.
A new local runtime runs in session89120. No source or credential reset was made.

## Production-mode local acceptance passed; final visual review active

The complete post-bridge suite passed **50 of 50** browser cases in 4.0 minutes
against the local production build on 7 October. Log:
`/private/tmp/luma-final-connected-production.log`. Build:
`/private/tmp/luma-connected-production-build-final.log`. This includes actual
local signup, verification, recovery, phone binding, all account roles, workspace
permissions, inactive policy save and unpaid order cancellation. No provider or
cloud execution is implied. The first visual matrix is complete: 246 actual browser captures passed original-image
review, with all image and source hashes checked. Eighteen accepted-purchase views
remain explicit skips because that account has no accepted purchase. The separate
buyer/material matrix is next. That checkpoint source was frozen for evidence collection; the newer workbook scope above supersedes it.

The earlier development-mode exception below did not repeat in this complete
run. Private development logs contain a Turbopack CSS hot-reload rejection,
`No link element found for chunk <CSS_PATH>`, from `DEV_BACKEND.reloadChunk`.
Its exact correlation with the original account event remains unproven because
those log lines lack timestamps. No application assertion or quota was changed.

Full web/backend type checks passed. The full unit preflight passed 2,218 cases
and found four stale trade-page mock failures plus 19 documentation freshness
failures. The mock was corrected and all six tests in that file passed. The 19
capture/Word checks remain required; final `pnpm check` follows rebuilt evidence.
Full lint's capture-script and test-only errors were corrected with scoped
passes. Final full checks, guide publication, CI and deployment remain pending.

## Integrated browser result under investigation

The first post-bridge combined run passed 49 of 50 cases in 4.9 minutes
(`/private/tmp/luma-final-connected-5.log`). The city-official journey passed
its screen and permission assertions but recorded one unexpected browser
exception. The exception is not waived. Auth review owns a private diagnostic
reproduction before the capture freeze; all other cases, including inactive
policy save and unpaid cancellation, passed. No production or final visual
acceptance is claimed from this run.

## Financial source frozen; integrated checks pending — 7 October 2026

A financial audit found missing payment-to-trade code that could be completed
without provider accounts or keys. That implementation is now in source, authorized by
the founder's instruction to finish all such work. The reviewed financial
backend is now frozen; root has restored the source freeze for integrated
checks. The final connected run must pass before capture resumes.
`business_release` owns the backend and its tests; root owns integration and any
required UI; `auth_release` reviews the financial and permission boundaries;
`guide_release` reconciles the handoff, guide, manual and launch records.

The 49/49 connected browser pass below is the **pre-bridge baseline**, not
acceptance of the new payment code. The 2,167 application-test passes and existing
type/lint evidence have the same scope. Re-run affected financial, permission,
stock, replay and connected tests after implementation and independent review.
The contract must distinguish collected funds, trade allocation, cancellation,
refund and seller settlement. Record the final supported behavior from code;
do not imply that provider keys alone complete it.

Root stopped the earlier 264-view capture run. Final capture and Word render/review
queues await the revised frozen source's integrated checks. Partial
images and previously rebuilt documents are not final evidence for this change.
Capture/Word freshness gates remain open, including the new financial fixture
manifest; the earlier failure count is not a current total. Do not waive them. Provider
approval, actual sandbox execution, live activation and the production admin
identity remain separate external gates. No deployment is claimed.

### Financial backend checkpoint — 7 October 2026

The backend owner reports the reviewed source frozen with **137 of 137 focused
financial tests passed**, backend TypeScript and scoped lint passed, and no
remaining actionable independent-review finding in that boundary. See
[payment lifecycle completion](payment-lifecycle-completion.md) for the exact
scope and logs. Whole-project integration, the planned 50-case browser suite,
visual evidence, final documents and release gates are still pending. The admin
browser case now includes a local synthetic policy-form save; this does not
select a live production policy or activate checkout.

The contract is one full quantity, one INR collection and one seller split.
Collection authorizes dispatch without moving stock; dispatch deducts seller
stock once and receipt adds buyer stock once. No-live-order cancellation releases
only the accepted commitment. A live order requires terminal unpaid provider
proof; expiry alone does not release it. Refunds use the frozen authority/funder,
keep one refund identity, and leave the trade held without automatic stock
restoration. Existing receipt/refund/reconciliation retains frozen terms when
new checkout is paused. Approved policy values and actual provider acceptance
remain required; no real provider or cloud operation occurred.

### Financial UI checkpoint — 7 October 2026

The root-owned financial UI latest focused run passed **50 of 50 tests** across
eight files. Log: `/private/tmp/luma-financial-ui-tests-final-2.log`. Focused lint
passed with warnings only. This supersedes the earlier 46-case focused run. Coverage includes explicit live
mode and mismatch handling, provider-derived status, visible cancellation holds,
viewer denial, retained action/reference drafts and a pending policy save.
The new screens are `src/components/market/financial-lifecycle.tsx` and
`src/components/admin/payment-lifecycle.tsx`; the existing checkout component
now has an explicitly selected live path as well as sandbox mode. Local UI tests
and injected provider state do not prove real payment or provider acceptance.

A real-browser cancellation case was added, bringing the planned combined suite
to **50 cases**. It has not yet run against the final financial implementation.
At that UI checkpoint, backend implementation and independent review were still
ongoing; the newer backend checkpoint above supersedes that status.
Whole-project type checks are running after a test-only type correction;
there is no final passing type result for this checkpoint yet.

Automatic approval review rejected automatic trade cancellation after a refund.
The retained boundary is deliberate: a confirmed refund leaves the trade held
for review and does not automatically restore stock. The founder has been
informed. Do not describe a refund as physical return, completed trade
cancellation or inventory restoration. Remaining code/review and business
agreement gates are separate from provider keys; do not say only keys remain.

## Overnight completion instruction — 6 October 2026

The founder explicitly requested completion of all work possible without new
account signups, API keys or other external setup. This includes final visuals,
updated documentation, the production release and a practical work routine.
Update the existing Google Doc in place with current screenshots and detailed
screen-by-screen instructions for two teammates who have never used Luma.
Complete the manual test document and keep remaining setup/manual checks clear.
This authorizes release through the existing protected PR and verification path;
it does not authorize fake payment success, production test bypasses, credentials
in the shared guide or removal of failing checks.

Current owners: root integrates/releases and updates Google Docs; `auth_release`
reviews auth and commercial boundaries; `business_release` owns facility/lot UI
and its capture matrix; `guide_release` owns guide/manual copy and fixture/admin
captures. All use the existing integration worktree. Serialize heavy runtime jobs
on this Mac and preserve source, private local state and credentials before
worktree cleanup.

The pre-bridge connected browser run passed **49 of 49** cases on 7 October in
4.6 minutes, including the new intake, admin classification and multi-input
processing flows. Log: `/private/tmp/luma-final-connected-4.log`. The real local
invitation restored the test member before this run; no quota or record was
reset. The 264-view refinement capture was stopped when the payment source freeze was revoked. The complete lot
matrix has 450 views and the current admin matrix has 36. The guide owner also
plans 36 explicitly synthetic financial interface examples. Final original-image
review, Word/Google Docs refresh, full `pnpm check`, build, CI and deployment are
still pending. Full web/backend type checks pass. The unit run passed 2,167;
capture and Word freshness checks remain pending, including the new financial
fixture manifest. Do not bypass them. The only full-lint errors were in test
diagnostic code; these were fixed and scoped lint passed. Final whole-repository
lint remains part of `pnpm check`.

Earlier combined local browser runs passed **48 of 49** cases. The first exposed an
invitation stuck at Loading after a failed authentication request. The page now
shows an error and explicit retry while retaining the invitation in memory.
Eight component tests and a real injected-failure/retry journey passed. The
second combined run reached that honest error state instead of the expected
wrong-recipient denial. The test clients now use one consistent address per
browser context for both HTTP calls and navigation; no quota was disabled or
reset. The third complete run again passed **48 of 49**, now failing when sending
the member invitation. A private read confirmed the workspace had reached its
real limit of 20 invitations in one hour. Its first records expire from that
window after 00:54 IST on 7 October; sufficient capacity for restoration and a
new complete run returns after 00:58. No record or limit was reset. The run left
the test member removed, so restore it through an actual invitation before the
role preconditions run. Root prepared a private loopback-only restoration script.
The specific limit message now preserves the draft; nine UI tests passed.
The complete passing run above supersedes those failed attempts. All 33 catalogues
now have 2,742 messages with zero mechanical coverage issues; native review is pending.
Full lint found four capture-script errors, now repaired with a focused pass;
the final whole-repository check is still required. Word/capture freshness
checks must pass after final rendering and visual inspection, without bypasses.

The new industry/material/byproduct/CPCB workbook is imported as versioned,
unverified reference data: 419 sector rows, 99 industry examples, 33 lifecycle
rows and 30 byproduct examples. Facility process capabilities, append-only
registration references, material stream/handling classes and controlled
residual disposition now have backend/UI and real local browser coverage.
Sector classifications never grant commercial permission. Seller grade and
specification snapshots are retained on orders; optional evidence links require
explicit non-hazardous, non-residual classification and existing material scope.
A final restriction repair passed 56 focused market/date regression tests.
The first facility journey and 17 related UI/logic tests passed. The capture
runner now requires 450 original lot/facility/market views; final captures and
readable inspection remain pending. The master requirements and beginner manual
record workbook source defects, supported behavior and undelivered roadmap items.

The clean-account review found a launch gap hidden by local seeded stock:
manufacturers could offer their byproducts but could not record their own new
stock. The business owner added an immutable, audited own-production intake
with source/weighing references, exact grams, approved material scope and
idempotent reference handling. Eighteen focused tests and a real browser intake,
offer, request and acceptance journey passed. The auth owner added the admin UI
for the existing material-classification review mutation; nine tests and the
actual password/TOTP browser flow passed. Multi-input processing now accepts up
to 20 distinct held inputs, consumes exact grams atomically and retains input
edges and own-workspace parent history. Thirty-two tests and the real two-input
industry journey passed. The independent review found and repaired private
sibling-input exposure after a remainder hand-off; cross-business process
history remains private. That earlier feature freeze was revoked for the payment
bridge work described at the top of this handoff.
Validated recipe specifications, supplier qualification, recurring demand and
purpose-scoped auditor reports are not proved delivered.

Release target readback: the existing Vercel project is `luma_green` under
`thehelds-projects`, ID `prj_ceMcCzKReKt06pJ3fIYcSexsoLd1`. Its current production
alias is `https://lumagreen.vercel.app`; `luma.green` was not found as a configured
domain in that scope. Both named cloud Convex deployments still read paused and
empty. Production environment-name readback contains no Better Auth secret or
site URL. Development contains the legacy `AUTH_DEV_MODE` name; its value was
not established by that name-only check. The Vercel settings export redacts
values as `[SENSITIVE]`; those redactions are not evidence of invalid settings.
Preserve existing provider settings rather than deleting or copying redacted
values. No cloud deployment or reactivation occurred during these checks.

## Platform refinement implementation in progress

The founder requested the full teammate PET-workbook scope, local tests,
production backend release and Vercel deployment. Continue in the managed
worktree `/Users/syedabdulmuqeeth/.codex/worktrees/platform-refinement/luma.green`,
branch `codex/platform-refinement`, based on fetched `origin/main` at `40beddb`.
The original `/Users/syedabdulmuqeeth/Developer/SandBox/luma.green` checkout
contains unrelated changes and must remain intact. The current requirements
record and reviewed editable Word copy are
`docs/product/platform-refinement-interview.md` and
`output/docx/luma-green-platform-refinement-interview.docx`.

The founder has **approved implementation** of normal-user email/password and
phone-OTP signup, workspace roles and team invites, disposable local test users,
real-browser acceptance, and a restricted credentials annex. The detailed plan
is in the 6 October account section of the interview record and its
reviewed Word copy. The founder confirmed both verified signup methods with a
local-only test path, and selected disposable development credentials in a
restricted annex. The later instruction “Go ahead, don't wait on me” and renewed
parallel-agent authorization supersede the earlier plan-first hold. The broadly
shared Google user guide will not carry passwords;
after implementation, update its existing document ID with the reviewed guide
and distribute the annex only to the named test team.

Decisions: a kabadiwala buys household material and pays the household; Luma
does not handle that payment. Cashfree Payment Gateway with Easy Split was
selected on 6 October under the founder's delegated provider choice. Provider
approval, seller verification and live activation remain pending. Every B2B
payment must use the gateway; simulated escrow cannot authorize live
trade. A manufacturer may offer a non-hazardous recyclable byproduct to any
approved buyer handling that material. City, CSR, lender, auditor, union,
brand and material-generator accounts need default-deny permissions. Use
“preprocessor” for the actor and “non-household material generators” for
source sites. The S2P/P2P boundary remains open.

The founder-approved full Convex reset finished on 6 October. Both saved export
archives passed ZIP integrity checks. Development `glorious-rooster-470` and
production `outstanding-buzzard-942` now each verify **zero** tables, rows,
users, stored files, functions and crons; both deployments are paused. The
empty backend deployment unmounted Better Auth before its component records
were deleted. The former data does not need a migration, but the new schema
and live release still require validation, deployment and reactivation. The
original exports are recovery points. The production site has no active
Convex backend during this implementation period.

Integrated commits on this branch add externally reported commercial
references (`3accbe3`), PET lot custody and quality evidence (`68fb1d1`),
site/origin classification (`0f840f4`), stakeholder accounts (`2740b5c`),
material-generator account requests (`5f9eb8b`) and the synchronized interview
document (`b142388`). All new records are evidence only; they do not add
inventory, prove payment or issue certificates. The combined focused backend
suite passed 66 tests and `pnpm typecheck` passed at that earlier checkpoint.
Regenerate Convex API types from the final combined schema before release.
Check schema deployment and live configuration before reactivating
either backend.

Gateway-only server rules (`5ffbedc`), market UI copy in 33 locales (`c152539`),
and stakeholder request/review screens (`0b2eb0e`) are integrated. Local Convex
deployment exposed unsupported iterator helpers; `779ac9e` replaces them with
array operations and adds the Convex runtime TypeScript check. Its focused
regression passed 98 tests plus scoped lint and backend typecheck.

Task-start checkpoint for the resumed 6 October pass: integration HEAD is
`779ac9e`. Existing uncommitted docs, launch-plan Word files and local acceptance
runner files belong to this task and must be preserved. Auth implementation is
in `commerce-evidence/luma.green`; workspace roles are in
`roles-onboarding/luma.green`, both under the managed worktree root. Fresh agents
continue those existing diffs. Root owns Git integration and the local runtime.
The primary checkout remains out of scope. This is a high-impact auth/permission
change; independent review, real adapter tests and browser acceptance are needed.

The isolated anonymous Convex deployment uses `127.0.0.1:3210` and HTTP actions
at `127.0.0.1:3211`; Next uses `http://localhost:3100`. It successfully deployed
the baseline schema and Better Auth component before the interruption. Restart
the local processes and verify them before acceptance. Private configuration is
under ignored `.convex/local-acceptance/` with mode 0700/0600. No hosted auth-test
fallback is authorized. Never run the old broad demo seed or fake escrow flow.
The new narrow runner creates identities through the actual signup/verification
handlers and records synthetic domain fixtures; it is still under implementation.

Email auth and workspace roles/invites are now the concurrent code tasks.
The launch test plan and provider inventory are drafted; the 9-page launch Word
and 10-page interview Word were visually reviewed. They are plans, not executed
acceptance evidence. Detailed test cases are in
`docs/testing/launch-2026-10-10.md`. Saturday 10 October is conditional on passing
release gates. Integrate agent changes after review, then run `pnpm check`,
`pnpm build`, required e2e and browser visual checks, guide capture/rebuild,
protected-branch CI, Convex backend deployment and Vercel production
verification. The current guide source changed for source classification but
its screenshot manifest and maintained Word guide are stale; this is an
explicit release gate. Do not claim a live B2B gateway, payment, certificate
or production release until actual provider/deployment evidence exists.

### Local account and payment checkpoint — 6 October 2026

Integration HEAD is `9146ce6`. Auth, workspace, payment, lot/quality UI and
current documentation changes remain uncommitted. Root owns Git, local runtime
and release. Preserve the task changes, local fixtures and original checkout.
The current execution log is section 13 of
`docs/testing/launch-2026-10-10.md`; it distinguishes focused local passes from
unrun full, provider and deployment gates.

Twenty-eight disposable email identities were created through real signup,
verification and sign-in, followed by `identity.ensureProfile` and the strict
local domain fixture. No auth rows were inserted directly. Local Next is on
localhost:3100, Convex is on 127.0.0.1:3210/3211, and the protected in-memory
inbox is on 127.0.0.1:3215. Private configuration and credentials are in ignored
`.convex/local-acceptance/` with directory mode 0700 and file mode 0600. Do not
print secrets or put them in Git, screenshots, traces or the shared guide.

The 28-account browser access run passed all account cases but initially failed
its workspace invitation case. The invitation return-link repair passed a
focused retest. Email lifecycle, existing admin password/TOTP/logout, optional
user TOTP setup/recovery display/removal, household pickup/receipt and the
lot/quality/custody journey have separately passed real local browser tests.
Fresh admin setup after the remount repair and a final combined run remain
required. See the execution log for exact evidence limits and arithmetic.

Repairs preserve app children through same-user session rotation and clear
secret-owning forms on identity change. Push cleanup checks the expected
session before removing a subscription rebound to a new session. Independent
review and 127 focused auth/notification tests passed. Public GET JWKS reads
are exempt from the shared auth rate bucket; credential/token limits remain.
Continuous screenshot navigation later hit `/convex/token`429 while the cookie
session remained valid. The adapter treated temporary failure as signed-out.
The canonical server guard now distinguishes a missing session from temporary
auth-service failure. It preserves the quota and presents a safe retry screen.
Explicit reload restores the provider with the existing session. Independent
review, 54 focused tests and actual local recovery/admin browser tests passed.
Capture runners respect the quota's quiet window; they must not hide failures
with relogin or remove the quota.

The Cashfree capture/vendor verification increment is integrated and passes
102 focused payment/market tests. No provider call or funds movement has run.
Live checkout and payment-dependent trade transitions remain blocked. The
founder has been asked who bears gateway, refund and chargeback costs; no fee
or funding policy may be invented. The lot/quality UI and scoped read APIs are
integrated; 144 focused navigation, lot and catalogue tests passed. The actual
browser journey passed custody and correction permissions. Lot records do not
alter inventory, ownership, payments or certificates.

The full regression run passed lint and both TypeScript checks, then reported
1,953 passing, 27 failing and 10 skipped unit tests. These included stale guide
records, old prototype copy, test setup problems and in-progress RTL tests.
Focused repairs passed 81 tests across 12 files. The required final full run is
still pending. Separately, 49 mobile and 22 desktop checks passed. Arabic tab
and stakeholder Select direction repairs passed focused tests. An actual glyph
check then found an early Arial fallback; explicit empty fallback lists on
Geist/Noto Sans fixed the font order, with 13 script browser cases passing.
Keep all required checks. Guide
source labels historical screenshots; seven capture sets, current authenticated
captures, the maintained guide DOCX/build record, the team test DOCX and the
existing Google Doc update must be completed. No deployment has occurred.

### Whole-platform UI pass and storage — 6 October 2026

The founder requested a UI pass across every page after rejecting the oversized
phone/email switch. The route inventory and owner split are in
`docs/delivery/ui-refinement-2026-10-06.md`. Shared tabs now use an underline,
44px targets and correct Radix orientation. Auth/account/join, operational,
public/help/admin and household/track pages are being revised in parallel.
Styling retains the existing brand, semantics, data and permission boundaries.
The household pass moved first material choices into the desktop viewport.
Focused shared-tab checks passed 21 tests; household/track passed 89 tests.
Auth/account UI checks passed 103 tests, and operational checks passed 187.
The latest combined connected browser suite finished with 37 passing and four
failing tests. Admin authentication, the exact household receipt, lot custody,
six responsive tab cases, optional TOTP, quota recovery and email lifecycle
passed. Three role cases failed during sign-in or navigation, and the workspace
case failed when a pending invitation did not appear. These failures remain
under investigation. The earlier inbox query race was fixed and passed seven
focused tests plus a real local browser probe. Final screenshots, visual review
and guide rebuild remain open. Serialize test, build and capture processes on
this Mac; concurrent jobs previously caused resource-related test timeouts.

The founder also requested removal of all Luma worktrees after implementation.
Do not discard work to reclaim space. Preserve committed/uncommitted changes,
unmerged commits and the required ignored local environment, database and
restricted credentials before archiving. The original project stays intact.
The retired temporary Next dev cache at
`/private/tmp/luma-next-dev-before-font-refresh-20261006` was removed after the
replacement runtime passed checks; its measured size was 4.1GB. No worktree was
removed. The subsequent filesystem check showed approximately 18GiB available.
Later builds reduced free space to 8.6GiB. A second storage check found an unused
4.3GB generated `.next` directory in the `recycling-ui` worktree. No running
Node process used that checkout, no process arguments referenced it, and Git
tracked none of its generated files. Only that cache was removed; its source
checkout and Git state remain. The subsequent check showed 12.9GiB free.

The restricted credentials Word annex is mode 0600 in the ignored local
directory. All 28 password values were checked against its private source. Its
eight-page placeholder layout twin was rendered and inspected; secrets were
not rendered into screenshots. Admin TOTP/recovery values are excluded.

## Approved recycling UI release — 3 October 2026

The founder approved the design and authorized commit, checked PR, Vercel release
and the existing Google Doc update. Active work is in
`/Users/syedabdulmuqeeth/.codex/worktrees/recycling-ui/luma.green`, branch
`codex/recycling-ui-release`. It starts at current main `c087a68` and applies only
the approved UI delta from local snapshot `7f1e135`. The prototype backend commits
are excluded. The original dirty checkout remains intact.

The accepted direction uses Mobbin recycling and inventory references, a household
collection entry, clearer material wording and compact business workspaces.
See the current design contract for sources and scope. Authentication, Convex,
integer money/mass, material identifiers and audit ownership are unchanged.

Guide impact: public entry pages, translated actions, collection progress and
shared household, applicant, business and admin layouts changed. The maintained
platform Word guide has 103 reviewed pages with 99 screenshot placements; the
team pack has 47 reviewed pages. Both source/build checks pass. Final review
corrected the remaining Market instruction to Buy in source and Google Docs.

The same Google Doc is now published from reviewed guide commit `364ecd6`.
Its link, folder and sharing are unchanged. All 40 chapters, six tables, 99 images
and four native date fields were verified. The 105-page native export passed
full-page review with exact unchanged-page comparisons after two final repairs.
All 99 native image descriptions remain absent; visible captions remain editable.
See `docs/user-guide/cloud.json` for exact hashes, revision and accessibility limits.

Verification: the disconnected Webpack production build passes with 2,622 pages.
The final home/navigation/motion run passes 34 cases; the separate 86-case public
responsive suite passed all 33 locales and required header widths. Five isolated
analytics tests pass with fake keys and intercepted provider requests. The
976-case protected-fixture audit found one Malayalam metric-label overflow;
the shared fix passed its 320/768 px retest. Tamil/Malayalam collection labels
were repaired and visually rechecked. Current public, protected, failure,
industry API, sample-price and analytics screenshots passed visual inspection.
All 33 catalogues retain their keys; 2,301 values changed, including 91 English
values. No English value contains “scrap”. Native copy was regenerated.
The release branch passes a fresh production build (2,622 pages), formatting,
lint, TypeScript and the full test suite: 1,695 web/backend, 49 mobile and
22 desktop tests. The earlier local snapshot included 11 unrelated prototype
tests; those are excluded from this release. The existing native-language review
TODO remains a lint warning. The local preview is `http://localhost:3107`;
fixture screens use `http://127.0.0.1:3217`. Protected previews use synthetic data
and do not prove authentication or provider execution. Native-speaker copy
review and authenticated acceptance remain separate launch gates.

The approved application source is `732283d`; the final reviewed guide source is
`364ecd6`. Changes reuse existing components, semantic tokens and data owners.
No backend, auth or calculation code changed. Main remains protected and receives
the change only through a checked PR. PR #34 is open. All five required checks,
native checks and the Vercel preview build passed on head `fec1261`. The protected
preview returned HTTP 200 for home and collection routes with the new copy;
robots.txt disallows indexing.

The first hosted browser run exposed old preparation text, hero accessible names,
removed hero animation and an outdated action count. The complete local browser
run then passed 729 cases and found eight desktop banner assertions that still
expected the previous full-width layout. All 40 showcase cases pass after those
assertions were updated to check the approved split heading, image size, alignment
and non-overlap in LTR and RTL. Mobile and help-page width checks remain intact.
The tests retain text-fit, keyboard, normal-motion and reduced-motion assertions.
Both repairs passed independent review. Final-head hosted checks, including the
complete browser/analytics workflow, must pass before squash merge. Production
must be verified against the exact merged SHA; preview success alone is not
production proof.

## Current work: final account and notification integration

Continue on `feat/account-notifications-detail`. Pushed checkpoint `a3c890e`
contains account security, inbox/push, native controls, account navigation,
public page content and the industry API in all 33 locales. Its five required
hosted checks, 734 browser cases and five analytics cases passed. Main then
advanced to security repair `2ba8246`; the current working merge preserves
those fixes alongside this pass. Read [the pass record](account-notifications-and-content.md).
Do not stage the unrelated root `luma-green-user-guide.pdf`.

PR 29 is the existing delivery PR, with remote branch
`feat/responsive-locales-review`. Push the final checked HEAD to that branch and
rewrite the PR around the combined scope. Main is protected: require all checks
for the actual final head before merge. Do not create a duplicate PR or override
red checks. No frontend deployment monitoring is requested.

The earlier PR unit timeout was scoped to the five full-catalogue seed cases;
all assertions remain. Its browser run passed 713 cases but reached the old
20-minute job cap during the separate analytics build. The job now allows
30 minutes, with every case retained. That run passed on `a3c890e`; the new
security integration needs its own final hosted checks.

Evidence for `a3c890e`: the complete `pnpm check` passed with lint, TypeScript,
1,496 web/backend tests, 40 mobile tests and 21 desktop tests. Formatting,
110 catalogue checks, 36 focused browser cases and five isolated
analytics cases pass. All 144 public visual captures were inspected. The team
Word document has 47 reviewed pages and a 92-case manual. The platform guide
has 99 reviewed pages, 40 chapters and 93 image placements; all 13 document
tests and both builder freshness checks pass. The final disconnected production
build passes with 2,622 generated pages. Hosted CI must pass on the final PR
head before merge. Exact evidence belongs in the pass record; do not present old checkpoint counts
as current totals. The new `2ba8246` integration has a passing production build,
1,567 non-document tests, 62 focused browser cases, 43 mobile tests, 22 desktop
tests and lint. Its current guide has 103 reviewed pages, 40 chapters and 99
image placements. The team pack has 47 reviewed pages and a 92-case manual.
The complete `pnpm check` passes: lint, TypeScript, 1,582 web/backend tests,
43 mobile tests and 22 desktop tests. Formatting and all 15 document freshness
tests pass. The final commit still requires hosted checks before merge.

Apple, Google Play and Expo/EAS accounts are not set up. Code and local app
checks are complete; signing, physical-device tests, push credentials and store
review remain external gates. Auth/inbox backend release must preserve the
parallel recycling schema additions. Do not deploy this checkout over them.
The existing Google Doc is verified through main `2ba8246`; its ID and sharing
remain unchanged. The newer reviewed Word revision will be synced in place by
the coordinated security followup after PR 29 merges. That followup also owns
the combined backend rollout. Before merging the final green PR head into main,
hold for that owner's verified additive backend release from the same head.
Vercel does not deploy Convex as part of its frontend build. Preserve the
already-deployed recycling schema in the combined release. The cloud document
update follows the main merge. Local Word artifacts are current for this pass.

Final CI repair: `6a20089` passed all five required checks and native checks.
Its browser run passed 727 cases but failed nine menu cases; one other menu
case passed on retry. All ten retry traces show the keyboard test focusing a
disabled, pre-hydration trigger. The tests now wait for an enabled control and
assert focus before Enter. The held-script tests also check keyboard reopening
after hydration. Runtime behavior and all existing assertions remain unchanged.
The production-build regression passed 30 repeated menu cases with zero retries
and three delayed-script pointer/keyboard cases.
The guide's final route table restores the API connections entry; the Word file
and review record are rebuilt together. No screen changed in this repair, so
the current browser captures remain valid. Recheck CI on the repair commit.

The final security repair checks forbidden auth flags independently and holds
push registration blocked through the entire sign-out transaction. The real
HTTP/control regressions pass, along with 127 focused auth tests, 69 focused
notification/sign-out tests, scoped lint, TypeScript and the production build.
The auth patch also passed an independent 23-test handler rerun. Refresh affected
guide captures, rebuild/review Word, run the full checks and require green
actual-head CI before completing the release order above.

The server repair also binds push devices to validated Better Auth sessions and
rejects new delivery claims after that session ends. It covers a second-client
registration during sign-out, beyond the frontend's same-runtime lock. Legacy
unbound records require authenticated renewal. Preserve the additive session
field and its migration notes in the combined backend release. No live provider
delivery is claimed by the local HTTP regression.

Final local check passes with 1,603 web/backend tests, 43 mobile tests and 22
desktop tests, plus lint and TypeScript. All 33 final production-browser cases
pass with zero retries. Independent server review passed 62 auth/push cases and
the original cross-client regression unchanged. The 240 affected captures and
103-page guide / 47-page team pack passed visual review; 15 document tests pass.
Require formatting and hosted checks on the final committed head, then follow
the backend-before-main release order above.

## Integrated industry API checkpoint

The account checkpoint bc986f4 is combined with origin/main af2e295. The following industry API evidence describes its earlier branch, not the combined build. Combined captures, guide rebuild, visual review and local checks are complete; hosted CI remains pending on the final PR head. Preserve all 33 locale catalogues and both account and API workflows.

**Industry API work:** `feat/industry-api` adds REST v1 for an approved business's
organization, material catalogue, stock, buying/selling trades and optional
material-family news. Owners can create scoped, expiring keys and revoke them
from Compliance → API access. Convex owns current membership checks, key
hashes, business isolation, accepted-read limits and audit writes. The API exports
integer grams/paise; trade payments remain simulated. There are no ledger writes,
GraphQL or MCP endpoints in this release. The industry plan records those later
contracts and their release gates.

Local proof: the full check passed with two Vitest workers: lint, types, 1,267 web
unit tests, 27 mobile tests and 20 desktop tests. Formatting, production builds,
155 Chromium checks with zero retries and five isolated analytics checks passed.
The maintained Word guide has 71 visually reviewed pages and eight passing
freshness tests. See the PR for hosted checks and merge state.

See [industry API delivery](industry-api.md) for current verification and
[the API contract](../architecture/industry-api.md) for setup and examples.
The schema change is additive; deploy its tables, indexes and functions before
the web release. News remains off until an operator configures an appropriate
provider plan and explicitly enables it in Convex. Local tests do not prove
provider execution or a deployed integration.

Guide impact: a new API setup and key-management section, current Compliance
capture and API screen captures in every registered language, light/dark themes,
phone/tablet/desktop sizes and RTL. Protected examples have synthetic data and
writes disabled. The maintained Word document, visual review record and source
hashes travel with this change. The existing Google Docs copy retains its stable
ID and sharing; its in-place update remains a separate connection gate.

## Selection and production demo-price checkpoint

The follow-up on `feat/responsive-locales-review` replaces large selection
blocks with a searchable first-login language picker and compact form controls.
It fixes the remaining narrow Tamil labels, basket alignment and explicit RTL
direction. All 36 targeted phone/tablet/desktop selection scenes passed, with
each browser capture visually inspected. All 15 auth browser cases passed.
The normal disconnected build and a separate connected development build passed.
Final `pnpm check` passed with 1,296 web tests, 27 mobile tests and 20 desktop
tests, plus lint and TypeScript. Formatting passed. Hosted checks must be read
again for the new commit before merge.

At the founder's request, `demoPrices:seed` was deployed and run on both Convex
environments. Production now has 26 materials, 26 reference prices and 780
sample daily prices. Development and production price-board values match for
all 26 materials and 30 dates. Existing records were preserved. This is a
price-only import, not the full platform demo seed. Read
[the import and cleanup record](selection-prices-and-account-ux.md).

Guide impact: the editable platform guide now has 75 reviewed pages and 73
image placements. Fresh public and protected captures include the new picker,
selection controls and two read-only connected development price views.
The team document has 38 reviewed pages and 12 image placements. Their exact
hashes and capture provenance are in the respective build records. The stable
Google Docs copy remains pending an in-place update; its ID and sharing remain
unchanged. The connected development captures do not prove a production page
load, authentication or provider delivery.

The next authorised slice is more page-specific imagery and descriptions,
optional authenticator protection after phone sign-in, in-app/browser push,
and Expo/Electron integration. Apple, Google Play and Expo/EAS accounts are not
set up: finish code and local checks, then document account, credential,
signing, store and real-device gates. Do not claim those gates are complete.
The founder excluded frontend deployment monitoring. Use the protected PR path
for integration into main, and keep the unrelated root PDF untracked.

## Release snapshot

This snapshot records the local release evidence for
`feat/responsive-locales-review`, based on `c1ed004`. The founder requested
commit, push and integration into `main`. Use the protected PR path, with all
required checks green. Read the live Git/PR state before resuming; this document
is not a substitute for hosted CI or deployment status.

The founder merged the earlier PR #28 at 03:27 UTC. Its `dfb7de2` head passed
all five required checks, Chromium and native policy checks. Vercel reported
production `c1ed004` successful, and its How it works page returned HTTP 200.
That checkpoint contains the initial UI pass, banners, logo motion and offline
seed manifest. This follow-up contains the final responsive and language work.

`9930381` records durable UI rules, the 62-case team manual, the proposed
October–March plan, India-first legal preparation and the corrected offline
seed gap. The founder confirmed that the entity is not registered. The UI
contract in `docs/design/designer-system.md` supersedes historical visual rules.

### What changed

- Compact public and operational phone/tablet menus, one-row desktop navigation,
  tight section spacing and complete single-line action text. The final narrow
  pass also stacks pickup contact actions and lets long form labels wrap.
- 21 additional complete catalogues: 33 locales, script-font priority repair,
  localized numeric input, root-error and native-shell copy generation.
- Real-price loading placeholders and restrained public text/button/mesh effects.
  Public static rendering and private/live data boundaries are preserved.
- Maintained Word guide and illustrated team pack with light/dark pairs,
  translated examples, role/edge-case testing, roadmap and API/legal gates.

### Local verification

`pnpm check` passed: 1,272 web tests, 27 mobile tests and 20 desktop tests,
plus lint and TypeScript. Formatting passed. The normal webpack production build
emits 2,521 static routes. All 706 Chromium cases passed with one worker; all five
configured-analytics checks passed in an isolated build with intercepted provider
requests. The last German selector-label correction received a fresh 101-test
message check and all 33 narrow control-bound checks before the final rebuild.

The protected fixture matrix initially passed 777 of 784 cases. Seven genuine
layout defects were fixed; all 160 affected cases then passed. All 99 operational
navigation states and the 33-locale descendant-text bounds checks passed. This
catches text hidden inside a control as well as page overflow. Original browser
PNGs were visually reviewed. Fixtures have synthetic records, reject writes and
do not prove authenticated access or backend/provider execution.

The language audit covers 33 × 2,260 message values and 26 material names per
locale, with no mechanical coverage issues. Native-speaker review remains
required. The 35 separate offline seed tests pass; no seed import or reset ran.
See the [responsive record](responsive-performance-locales.md) and
[cache audit](rendering-cache-audit.md) for scope and repeatable checks.

### Guide impact and external gates

The platform guide has 69 reviewed pages and 65 image placements. Its current
public, analytics and protected captures and exact DOCX hash are recorded in
`docs/user-guide/build.json`. The team pack has 38 reviewed pages and 12 image
placements, with its own freshness record. The 62-case manual is a test plan;
its staging/provider/device cases have not been claimed as executed.

The existing Google Docs ID and sharing are unchanged. Its in-place update is
explicitly pending in `docs/user-guide/cloud.json`; use the current local Word
file for this revision. Demo isolation still needs the founder's choice before
import work. Stored material names require the separate authenticated, audited
repair after backend deployment. Live SMS/provider acceptance, native signing,
real-device tests and legal review remain release gates. No live provider send,
payment, credit issuance or legal filing ran in this pass.

Preserve the unrelated root PDF and pre-existing previews on ports 3004/3202.
The task preview uses port 3009; the isolated fixture preview uses port 3203.

## Earlier checkpoints

**Logo motion follow-up:** after `8975575`, the founder requested an eased logo
spin on hover. The shared SVG mark makes one 900ms turn on fine-pointer hover
and home-link keyboard focus. The wordmark stays still. Reduced motion disables
the effect, including a turn already in progress. This is CSS only; no client
boundary or dependency was added. The brand playbook records this approved
exception to the previous rotation rule.

Production build, scoped lint, three logo unit tests and all eight motion browser
checks passed. The browser tests cover hover, keyboard focus, the still wordmark,
return to rest and preference changes. Refreshed public captures match the previous
PNG files exactly. The guide remains 66 pages: 64 rendered pages match the reviewed
banner edition pixel for pixel; the changed cover and appearance page passed a
new visual review. The local Word guide and build record are current. Its existing
Google Docs copy remains pending an in-place update under the recorded connection
gate. The local preview on port 3009 serves this revision.

**Banner follow-up:** on `feat/ui-detail-pass`, after `ff7bb64`, the founder
requested banner images on How it works and every main public page. Public
headers now require a scene and display a full-width image below the title.
Join and Help Contact gained images; the main Help and role-help pages use the
same banner treatment. Mobile crops are taller. Existing compressed artwork is
reused; there are no new image downloads, dependencies or card containers. The
home hero, article layouts, sign-in forms and operational workspaces are unchanged.

The production build, scoped lint, 143 affected component tests and six guide
freshness tests passed. All 113 affected public browser
checks passed, including 32 new banner cases at 390px and 1440px with Arabic
coverage. Public and role-image screenshots were refreshed. The guide remains
66 pages with 62 image placements; 54 rendered pages have identical pixels to the
previously reviewed edition, and the 12 changed pages received a new visual review.
Use `docs/user-guide/build.json` for the exact reviewed document hash. The same
Google Docs update gate remains; no cloud document or sharing setting was changed.

**Active refinement:** `feat/ui-detail-pass`, based on merged main `3b29ea7`
(PR #27). The founder requested detail across all screens while keeping the
current identity, with no content-card grids. Source work covers all 41 route
wrappers through public, auth/join, household, operator and admin components.
The mobile wordmark is hidden; language uses its native name. Public material
marquee and clearly labelled demo testimonials are included. The founder approved
sample quotes explicitly; these are not customer reviews.

Phone and code screens remain visible before SMS setup. The code screen is an
explicit preview: no send, verification, session or private access is simulated.
This changes presentation and navigation only; backend authentication and ledger
contracts remain intact. New translations remain machine drafts for native review.

Local verification passed: normal webpack production build, lint, types, 1,181
web component/logic tests plus six guide freshness tests, 27 mobile tests and 20
desktop tests. All 115 Chromium checks and five isolated configured analytics
checks passed. The browser checks include 320px Tamil/Malayalam button text,
mobile endonym controls, RTL, reduced motion and the inert phone/code preview.
Independent review found and fixed a preview hint that promised an SMS and a
long translated action label that exceeded its button.

Guide impact: refreshed 27 public captures, four role-image captures, two
analytics captures and 40 protected-component fixtures. Added phone and OTP
preview, demo testimonials, onboarding forms/status, stock, sale, invoice and
impact figures. The Word guide has 62 image placements and 66 rendered pages;
all pages passed visual review. The exact DOCX and input hashes are recorded in
`docs/user-guide/build.json`.
Public captures use the actual disconnected build. Protected captures show
synthetic records with a visible banner; all writes reject.

The existing native Google Docs copy is explicitly pending this revision. The
connector can create a new import but cannot replace the same native document
from this DOCX. Its ID, URL, sharing and last verified revision are preserved in
`docs/user-guide/cloud.json`. Local checks do not prove hosted CI, deployment,
live authentication, provider execution, native signing or real-device acceptance.

Preserve the unrelated root PDF and pre-existing previews on ports 3004 and 3202. The task's final production preview uses port 3009. Work is on the local
feature branch; no production deployment was made by this pass.

The earlier checkpoint below is history for the integrated PR #27, not the active
branch. Use the verification record above for this refinement.

**Current slice:** designer system polish and an expanded homepage on
`feat/design-system-polish`, based on main `e403503`. The founder rejected the
previous theme and approved a full public, role and admin redesign. Read
[the design plan](../design/designer-system.md) and the
[route review](designer-review.md). The source pass uses neutral light/dark
surfaces, Geist display with Noto scripts, shared Lucide icons and consistent
controls. Six new home sections explain the existing product. Admin pilot charts
use actual query values through Recharts; text/table equivalents remain visible.

PR #26 was merged into main as `e403503` before this slice. Do not resume the old
`feat/pilot-readiness-cleanup` branch. The root `luma-green-user-guide.pdf` is an
unrelated user file and must remain untouched and unstaged.

Local verification passed: `pnpm check` (1,171 web, 27 mobile, 20 desktop
unit tests), formatting, clean production build, all 107 Chromium checks with the
CI worker setting and five configured analytics checks. Independent review found
and closed translated-layout and dark chart-label defects. The maintained Word
guide has 56 reviewed pages and 51 screenshot placements; all six guide freshness
tests pass. Public screenshots are actual disconnected pages. Protected screens
remain explicitly labelled synthetic fixtures, not live account acceptance.

The reviewed guide was imported into native Google Docs. Read
[`cloud.json`](../user-guide/cloud.json) for its verification state and stable
document URL. Preserve that document ID on future updates. Git integration and
hosted checks must be verified separately; do not infer production or provider
readiness from local results.

[Future enhancements](../product/enhancement-proposal.md) remain an unapproved
research proposal. Native signing, real device testing, store approval and live
provider acceptance remain separate release gates. This work changes presentation,
not ledger, authentication or provider contracts.

## Resume procedure

1. Read `AGENTS.md`, this page, and the task-specific `.claude/skills` playbooks.
2. Check `git status -sb`, `git log -15 --oneline`, `git remote -v` and
   `git worktree list`. Preserve new user changes. Fetch `origin` and compare the
   branch with its upstream before editing or pushing.
3. Read the implementation records below, especially the latest
   [UI redesign](ui-redesign.md). The earlier visual and guide
   checkpoints are integrated; do not repeat them.
4. Pick a task from the ordered queue. Distinguish code implementation, local
   tests, hosted CI, deployment, provider execution and store approval in reports.
5. Update this page as work progresses. Commit meaningful verified slices.
   Keep secrets, local environments and temporary output out of Git. The
   maintained Word user guide and browser captures are required tracked artifacts.

Repository: `https://github.com/ungaaaabungaaa/Luma.Green.git`.
Branch: `feat/design-system-polish`.
Starting base for this slice: `e403503`, merged main at task start.
Local checkout: `/Users/syedabdulmuqeeth/Developer/SandBox/luma.green`.

For a new machine only:

```sh
git clone https://github.com/ungaaaabungaaa/Luma.Green.git
cd Luma.Green
pnpm install --frozen-lockfile
pnpm check
```

Use Node 24 and the pnpm version pinned in `package.json`. Do not clone over an
existing checkout. No app secret is needed for local build/tests.

## Commit checkpoints

These commits are reachable from the continuation branch. Do not cherry-pick
them again into that branch or restart from the old base.

| Commit    | Completed work                                                                 |
| --------- | ------------------------------------------------------------------------------ |
| `bb3eb1b` | Deferred analytics and removed unused service packages                         |
| `cfcad80` | Twelve-locale material names and message-contract validation                   |
| `e949586` | Pickup dispatch, expiry/reassignment and pilot safeguards                      |
| `af9a027` | Accessible UI cleanup and admin pilot reports                                  |
| `c6b51a0` | Auth recovery after failed sends and delayed sessions                          |
| `caf87bf` | Optional bounded photo estimates; manual entry preserved                       |
| `85b9d73` | Booking/application status-message outbox and adapter                          |
| `acd549e` | Pilot setup and implementation evidence                                        |
| `9ec96ce` | Expo and Electron shells, guarded updates, GSAP and imagery                    |
| `e6d0e3a` | Expo-compatible isolated mobile TypeScript version                             |
| `e218556` | Native architecture, account setup and release evidence                        |
| `2183515` | Image compression, compact queries, caches and self-hosted inference adapter   |
| `f94fa6b` | Agent handoff and continuation checkpoints                                     |
| `db62fb7` | Premium public/app design, compressed art, parallax and motion checks          |
| `0f0ce43` | Illustrated platform guide and mandatory guide maintenance rules               |
| `6ca9391` | Optional PostHog/GA4, error-only Sentry, search setup and updated guide        |
| `9fb82cd` | Role images and earlier app previews; previews removed in the current redesign |

Detailed records: [UI and pilot](cleanup-progress.md),
[apps and motion](apps-and-motion.md), [cost optimization](cost-optimization.md),
[visual refinement](premium-ui.md), [platform user guide](user-guide.md),
[analytics and SEO](observability.md), [role app showcases](app-showcases.md).

No unfinished agent edits, stashes or active secondary worktrees were present at
handoff inspection. The five earlier managed worktrees are archived: UI,
translations, pilot readiness, photo estimates and SMS. Their work is integrated.
They are recovery snapshots, not continuation checkouts.

## Architecture to preserve

- Next.js and Convex own operational UI and data. Money is integer paise; mass
  is integer grams. Permission checks and transaction records stay authoritative.
- `apps/mobile` uses Expo/React Native for Android/iOS. `apps/desktop` uses
  Electron for macOS/Windows. Both reuse the hosted web UI and backend.
- Hosted UI, compatible signed JavaScript updates and native binaries have
  separate release paths. New native capabilities can still require a binary
  or store update. Do not promise permanent freedom from app updates.
- Root message catalogues are the editable translation source. Regenerate
  mobile copy with `pnpm --filter @luma/mobile messages:generate` after shared
  native/common/brand copy changes.
- Photo inference uses one configured OpenRouter or authenticated HTTPS endpoint.
  No paid fallback; models never set prices. Router/model suitability is unverified.
- Image preparation is local and never increases upload bytes. JPEG/PNG private
  metadata is removed while orientation stays correct. PDF/video/WebP bytes and
  embedded metadata stay unchanged. Server validation remains in place.
- Photo-result memory cache: three replies, five minutes, cleared on account
  change/unmount. No persistent image/result cache. Current prices stay reactive.
- Convex remains the database. Its current backend and GSAP are not MIT/Apache-only;
  see the cost guide before making license claims.

Read [ADR 0014](../decisions/0014-shared-web-ui-in-native-shells.md),
[ADR 0015](../decisions/0015-bounded-photo-cache-and-selectable-inference.md),
[native architecture](../architecture/native-apps.md) and
[AI architecture](../architecture/ai-estimation.md) before changing these contracts.

## Verification checkpoint

Current role-preview checks are recorded in [app-showcases.md](app-showcases.md).
Analytics/SEO checks are recorded in [observability.md](observability.md).
That record includes configured and default builds, consent browser checks,
regressions and the updated guide. Provider receipt, hosted CI and deployment
remain separate gates.

Historical implementation checks at `db62fb7`:

| Check                            | Evidence                                                                      |
| -------------------------------- | ----------------------------------------------------------------------------- |
| `pnpm check`                     | Lint/types; 1,065 web tests in 136 files; 23 mobile and 19 desktop unit tests |
| `pnpm format:check`              | Passed                                                                        |
| `pnpm exec next build --webpack` | Passed; 925 generated pages                                                   |
| `CI=1 PORT=3100 pnpm e2e`        | 48 Chromium tests passed against production build                             |
| Public image cache               | Content-hashed source, immutable headers, optimizer `MISS` then `HIT`         |
| Upload fixture                   | 4,980,609 → 490,212 bytes; inspected synthetic scan remains legible           |
| Compact prices                   | 832 → at most 52 documents; 50,832 → 1,113 response bytes in fixture          |

Earlier checks include both Hermes exports, Android configuration prebuild, real
macOS Electron isolation/PDF/recovery smoke and unsigned macOS ARM64 packaging.
These do not prove mobile native compilation, Windows execution or signed updates.
The default Turbopack build hit a host worker-port restriction; Webpack passed.
Clean production builds need network access for configured Google fonts.

The historical checks above cover the visual refinement. Its last heading offset and
browser-test selector fixes also passed focused ESLint and the production suite.
The first incremental build emitted stale CSS; moving the compile cache aside and
building again produced the correct styles. A computed hero-size smoke check now
catches that failure. The production homepage was inspected and the two repository
homepage screenshots were refreshed. The image-cache/upload/price fixture rows
above are historical evidence from `2183515`; those paths were not changed by this
visual pass. No application source changed after the final build/browser checks.

The local preview was refreshed at `http://localhost:3004/`. Check its process on
resume; it is not a deployed service. Use `PORT=3004 pnpm start` after a successful
build if needed. Generated artifacts are ignored: `apps/mobile/dist`, generated
mobile Android/iOS projects and `apps/desktop/release/mac-arm64/Luma.Green.app`.
Rebuild on a new machine. `/tmp` screenshots/logs are not required resume inputs.

## Maintained user guide

The guide now covers every role, access, the admin console, household pickups,
business trades, native updates and owner setup. Read
[the editable guide](../user-guide/guide.md) and
[its update workflow](../user-guide/README.md). `AGENTS.md` requires a guide-impact
assessment for each user-facing change and updated source/captures/DOCX in the
same commit when affected. The Word guide uses current browser captures; protected
screens use clearly labelled synthetic records in actual application components.
No connected authentication or live provider result is established by those figures.

Historical documentation checks at `0f0ce43`: `pnpm check` passed lint/types, 1,068 web tests in
137 files, 23 mobile tests and 19 desktop tests. Three new tests enforce guide
input, screenshot/component and PDF hashes. The PDF was rendered and every page
inspected. No production source, dependencies or native runtime changed.
The analytics edition added English and Arabic consent captures and owner setup.
The earlier PDF visual edition had 50 pages. The current Word edition uses 18 public captures,
four public role photograph captures and 28 synthetic protected-screen
fixtures (including six phone layouts and two dark views). Generated scenes are illustrations, not
evidence of operations. Only the analytics captures use test keys; their external
requests are intercepted. Shared image/adapter hashes now enforce recapture.
Guide impact was assessed and its source, captures, build record and DOCX updated
in the same delivery. The guide tooling uses a separate local preview and Python
build dependencies.
See the [delivery record](user-guide.md) for capture coverage and remaining limits.

## Ordered next-work queue

| Priority | Task                                                       | Completion evidence / dependency                                                                                                                                                                                                                                                                                        |
| -------- | ---------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1        | Open/review a PR for the branch; run hosted checks         | Review the full diff and obtain green required CI plus relevant browser/native jobs. A branch push alone does not run the current PR-only checks. No direct main push or red-check merge.                                                                                                                               |
| 2        | Stage the connected pilot flows                            | Configure intended Convex/site environments. Deploy schema/functions before dependent frontend. Test real sign-in, private upload, dispatch, expiry, receipt and admin report with staging users. Accounts/keys are external prerequisites.                                                                             |
| 3        | Complete signed native previews                            | Configure the dedicated trusted origin and signing/update credentials. Build Android/iOS and macOS/Windows artifacts. Test login, camera/gallery/location, private files, recovery and updates on each platform. Full Xcode, Android SDK/JDK or EAS builds are required; this host lacked mobile native toolchains.     |
| 4        | Activate and verify SMS                                    | Obtain MSG91/DLT/template approval. Check OTP and status events. Record API acceptance and handset delivery separately. No real send was made during implementation.                                                                                                                                                    |
| 5        | Validate optional self-hosted AI                           | Configure an authenticated HTTPS gateway, pin an evaluated vision model, and test cold/warm latency within eight seconds, accuracy and cost. Manual entry works without AI.                                                                                                                                             |
| 6        | Run launch UX and cost acceptance                          | Review populated app/admin screens with staging accounts; native-speaker review of launch languages; low-end device/RTL checks; real scan legibility; staging usage measurements and restore drill. Replace placeholder support contact details before launch. Local savings are fixture measurements, not a live bill. |
| 7        | Implement remaining operational gaps if required for pilot | SMS delivery webhook/status handling and explicit resend policy; bounded SMS outbox retention; identify/exclude demo rows in pilot metrics. Define retention and idempotency first. Current adapters/reports do not implement these.                                                                                    |
| 8        | Activate analytics and search only when ready              | Create selected PostHog/GA4/Sentry projects, set explicit deployment flag and keys, disable GA4 Enhanced Measurement, set quotas and verify received events/errors. Verify Search Console/Bing ownership and submit the deployed sitemap. No accounts or production services were activated in this pass.               |
| 9        | Continue later product work from its requirements          | Large-city spatial dispatch; consented photo conversion/accuracy instrumentation; real escrow/payments and regulated carbon work. Existing prototypes and sample figures are not live services.                                                                                                                         |

Setup checklists:

- [Launch](../operations/launch-checklist.md): Convex, hosting, SMS and core environment.
- [App releases](../operations/app-releases.md): Expo/EAS, Apple, Google, macOS/Windows signing and updates.
- [Low-cost operation](../operations/low-cost-operation.md): exact self-hosted AI variables, gateway, licenses and measurements.
- [SMS](../operations/sms-notifications.md): template/event contracts.
- [Backups](../operations/backups.md): exports and restore checks.
- [Observability](../operations/observability.md): PostHog, GA4, Sentry, consent and quotas.
- [Search](../operations/seo.md): canonical host, ownership tags, sitemap and indexing.

## Publication and next-agent instruction

This checkpoint is integrated through PR #26. Verify equality after fetching with
`git rev-list --left-right --count HEAD...@{upstream}`; expect `0 0` before claiming
synchronization. Check clean status separately. Find the latest delivery with
`git log -1 --grep='redesign themes'`. Preserve the pre-existing untracked
root `luma-green-user-guide.pdf`; the maintained artifact is now under `output/docx`.
Do not stage or delete it. No main merge, hosted CI result or deployment is
claimed by this handoff.

PR #26 runs the required hosted checks before squash merge. Read its current
head, checks and merge metadata for the exact integration result. Deployment,
provider execution and store release require separate evidence. No background
agent or scheduled monitor is left running. Resume with the ordered queue and
update this record.

## Current guide and demo boundary

The Word guide replaces the former PDF maintenance requirement. The current
source remains `docs/user-guide/guide.md`; output is
`output/docx/luma-green-user-guide.docx`. Retain actual browser captures and
provenance, rebuild, render and inspect every page after screen changes. The old
PDF is archived. Preserve the unrelated root `luma-green-user-guide.pdf`.
The Google Docs link and synchronization evidence belong in the guide directory
after verified import. Update that same document for future changes; creating a
new document on every run breaks the shared link. UI commits alone do not sync a
cloud document. AGENTS.md requires the cloud update or an explicit pending gate.

Local desktop demo artifacts are ignored build outputs under
`apps/desktop/release/demo`. Mac ARM64 runs locally; Windows x64 was cross-built
but still needs execution on Windows. Both load a local website on port 3004.
The demo origin is immutable and loopback-only, with separate cookies and no
update feed. Production HTTPS/signing guards remain.

Mobile launchers and Android/iOS JavaScript bundles are verified locally. This
host has no full Xcode, simulator, JDK or Android SDK; no mobile installer or
real-device acceptance is claimed. Follow the mobile demo record rather than
assuming Expo Go is compatible. Signed releases and provider execution remain
separate launch gates.

## Merge review follow-up

Independent review of the full branch found and fixed two edge cases. Pickup
acceptance now rejects an offer at or after its deadline, even when the scheduled
expiry job runs late. Tests cover that boundary, unchanged records on rejection,
later audited reassignment and legacy bookings without deadlines. The desktop
app now recreates its main window on activation when a document window is still
present; the Electron lifecycle regression failed before the fix and passed after.

Guide impact: the fixes enforce behavior already described in the guide. No
screen, copy, access rule or setup instruction changes; current screenshots and
the reviewed Word artifact remain valid. Google Docs publication is still pending.
The Vercel preview reports deployment success but is sign-in protected; public
HTTP inspection confirms the login boundary and `noindex`, not the hosted app UI.

## Offline demo checkpoint — 2 October 2026

The versioned [demo manifest](../product/demo-seed-manifest.md) and
[import plan](../product/demo-seed-plan.md) are ready for review. They describe
48 business plans, 82 synthetic identities and all 26 material codes. The
manifest records six explicit coverage/import gaps. Its 35 offline regression
checks, strict script types, lint and formatting pass. No database, provider,
authentication or production change was made. Import isolation is still pending.

Guide impact: these offline files change no route, screen, role, permission or
workflow. They need no new guide screenshot. The parallel responsive/language
and visual-polish pass remains uncommitted while its matching guide is refreshed.

## Security and failure review — 2 October 2026

Work is isolated on `fix/security-failure-review`, based on `c1ed004`, in the
managed `security-failure-review` worktree. The concurrent responsive/locales
checkout is preserved. See [the review record](security-failure-review.md) for
findings, fixes, remaining risks, current checks and delivery evidence.

Guide impact: account setup now requires a private operator token; failed admin
login, file removal, draft discard, sign-out, invalid money totals and support
quota feedback have explicit recovery behavior. The guide source, labelled
browser fixtures, capture manifests, reviewed Word artifact and build record are
updated together. Native navigation fixes change no screen or control. Google
Docs publication remains pending at the existing document ID; sharing is unchanged.

Deployment must apply the support phone/time index and server functions before
the frontend. Remove the bootstrap token after setup. Review/revoke existing admin
sessions if the vulnerable phone/setup endpoints were exposed. The open node-forge
advisory, real-device acceptance, live authentication/provider tests and production
deployment remain separate gates. This report does not claim launch readiness.

The security repair branch preserves the industry API feature merged through PR #30 at `af2e295`. Its additive schema and API guide chapter are retained. The combined source was reviewed for access boundaries and checked again. A slow-loading phone menu also keeps its trigger disabled until interactive, preventing lost first clicks. The current guide includes both revisions.

Final local evidence: `pnpm check` passed (1,345 web/backend, 30 mobile and 21 desktop tests), formatting passed, both production build formats passed, and all 158 browser tests passed without retries. The reviewed Word guide has 76 pages and 72 screenshot placements. Capture hashes match the combined source. Hosted checks and protected squash-merge evidence belong to the associated security repair PR; production backend deployment and the cloud guide update are not implied.

## Security rollout follow-up — 2 October 2026

The follow-up branch `fix/security-rollout-followup` starts at merged PR #31
(`2ba8246`) and keeps the concurrent PR #29 checkout separate. The node-forge
advisory now has a reviewed local backport of upstream commit
`ceba34402e329f0365134f23fe19898756527d65`. All three Expo consumer paths reject
the upstream forgery vector; valid signing controls pass. The registry still
reports one high advisory because no patched version has been published. See
[patch provenance](../../patches/README.md); separate EAS installations remain
gated for signing.

Local verification passed: `pnpm check` (1,345 web/backend, 36 mobile and 21
desktop tests), production build, complete formatting, and an independent patch
review. Guide impact: the dependency patch changes no user-facing route, screen,
copy, role or native update behavior. The reviewed source/DOCX/screenshots remain
valid. Operator release instructions now identify the separate EAS dependency
boundary. Cloud synchronization and backend rollout are being verified separately.

Read-only session inspection found no active admin sessions in development or
production. Development has one configured password/TOTP admin with consistent
profile records; production has no auth users and no configured admin. No session
or account records were changed. A production dry run found 15 indexes belonging
to the separately deployed ecosystem backend that current main would delete.
That deployment was not applied. Complete the combined schema integration with
PR #29 and ecosystem backend commit `dc41665` before either environment is pushed.

The isolated follow-up now includes the already-deployed ecosystem backend from
`dc41665`, without its unmerged frontend. This preserves the live messaging,
workforce, material-demand, public-data and isolated-demo owners during the
security rollout. Both membership index orders, the industry API schema and all
PR #31 guards remain. Independent merge review passed; 154 tests in nine focused
suites and TypeScript pass. Live job inspection found zero business jobs needing
the optional city backfill (production has zero jobs; development has seven and
all have cities), so no migration was run. The public-data runbook is retained.

The stock overflow follow-up has 32 new regressions and one shared stock-balance
check. Trade receipts and multi-line pickup completion now reject unsafe or
invalid legacy quantities atomically. Existing valid boundaries and error codes
are preserved. Guide impact: these are backend invariant and compatibility
repairs; no new user-facing screen or copy is introduced. The ecosystem frontend
remains separate. Guide freshness tests remain required after the final PR #29
integration.

### Final combined security source — 3 October 2026

The isolated follow-up integrates final PR #29 head `593dfa2` with the retained
ecosystem backend and all security repairs. Independent review found and fixed
malformed auth-flag bypasses and notification registration during sign-out,
including a real second-client HTTP logout case. The authoritative push session
binding is additive; legacy unbound devices stay inactive until authenticated
renewal. The reviewed guide includes these rules and the in-flight delivery limit.

The combined full check passed 1,695 web/backend, 49 mobile and 22 desktop tests,
lint and types. Build passed 2,622 static pages; formatting passed. The final
production dry run validates existing data, adds 16 indexes and deletes none.
Deployment will run before PR #29's frontend merge, because Vercel currently
builds the frontend without deploying Convex. Actual rollout proof follows.
The 103-page Word guide has 99 images and SHA-256
`a4cbbe1f589e0e84bc95aa2aa1723e17e9c637e48a752eefb71330478f660fd3`.
Its existing Google Doc awaits the verified in-place update after the source
merges; the latest published record and native description are preserved.

### Verified rollout and protected account merge

Source `e1fc138` deployed to development `glorious-rooster-470` and production
`outstanding-buzzard-942` before the frontend merge. Both post-deployment checks
prove 75 indexes, 137 functions, null anonymous identity and `NOT_SIGNED_IN`
for private review, integration-key and inbox queries. Production added 16
indexes and deleted none. Both environments have zero active admin sessions;
production has no auth users or configured admin. No account/session changes,
secret rotation, provider enablement or inferred data backfill was needed.

PR #29 then merged at `53dae4db62432119505bd06d7d9ac85284c0c386` with all required
checks, 737 browser tests, five analytics checks and native validation/export
green. Reconciliation commit `b0db178` preserves all tested runtime source bytes.
The reviewed 103-page platform guide can now be synchronized in place. The
separate team Word artifact is preserved. Production admin provisioning, live
password/TOTP acceptance, SMS and signed device delivery remain separate gates.

### Final security delivery and Google publication

PR #32 merged at `7f584854896b991ea3970d91e0a20d43ed1cca2f` with all five
required checks, 737 browser tests, five analytics tests, native validation/export
and Vercel green. Remote main runtime matches tested/deployed `e1fc138`.
The existing Google Doc now matches the reviewed 103-page Word source: 40
chapters, 659 body paragraphs, six tables, 99 images and three original native
dates. All 104 final native export pages are verified after a spacing repair.
Document identity, folder and sharing remain unchanged. `cloud.json` records
the exact source hash, readback revision, export hash and visual coverage.

Google's image replacement removed the previous sole native description and
has no description setter. All 99 images retain captions but lack native alt
semantics; the original description text is saved for a supported editor repair.
Native UI work stayed stopped to preserve user focus. This limitation,
production admin/provider setup and separately installed release-signing tools
remain explicit; they do not invalidate the tested source repairs.

Guide impact: no source, screenshot or DOCX content changed after PR #29's
reviewed build. This final documentation-only delivery records cloud publication
and rollout evidence. The separate team-review Word artifact is preserved.

## Vercel image loading repair — 4 October 2026

Production image transforms return HTTP 402 with
`OPTIMIZED_IMAGE_REQUEST_PAYMENT_REQUIRED`. The corresponding content-hashed
static WebP files return HTTP 200. `next.config.ts` now serves existing compressed
image sources directly, without the Vercel optimizer. The image loading regression
blocks the optimizer and checks every homepage image plus shared role art in
English and Arabic.

Guide impact: no text, screen layout, artwork, route or workflow changes. This
repair restores the existing artwork shown in the guide; its source, captures and
Word artifact remain valid. No cloud document update is needed. The unrelated
prototype checkout remains untouched.

Validation: `pnpm check` passes (lint, types, 1,695 web/backend tests, 49
mobile tests and 22 desktop tests). Production build and full formatting pass.
Both image-loading browser regressions pass with the optimizer returning 402.
Local browser inspection confirms restored image rendering in English and Arabic,
including phone and desktop views. Hosted checks, preview and main deployment
must be verified on the final PR head.

## Dependency bot refinement — 5 October 2026

Dependabot now separates security updates by production/development dependencies,
keeps routine related updates together (including Convex/auth, Expo and Tailwind),
and leaves major upgrades outside routine groups. Routine npm releases wait
3 days for patches, 7 for minor versions and 14 for major versions; security
updates do not use this cooldown. The Node type-major and Better Auth >=1.7
limits remain. GitHub Actions minor/patch updates share a monthly PR.
The root pnpm workspace remains the single update owner. Groups help review;
they do not prove peer compatibility, Expo SDK compatibility or provider execution.
No guide change is needed: no user screen, permission or workflow changed.
Validation: Prettier YAML parsing/format checks and diff whitespace checks.
Hosted Dependabot PR creation must be verified after this configuration lands
on the default branch. No dependency versions, lockfile or merge policy changed.

## ENVRIN phone-only login — 14 October 2026 (in progress)

Task branch `feat/envrin-phone-login` starts from current release `4f704d4` in the
managed `envrin-phone-login` worktree. The older dirty prototype checkout is
preserved. Its schema failed validation before any backend deployment; no tables
were deleted. Current release schema deployed successfully to development.

OS Digital ENVRIN credentials and exact approved template are configured in Convex.
The provider dashboard test delivered successfully. A real platform OTP was sent,
and the owner entered it successfully and reached admin profile setup. The owner
confirmed successful authenticator setup and admin login. No production
OTP or deployment is claimed yet. The approved test number is the admin identity;
its internal phone email is configured, not an email sign-in method.

Release checks: `VITEST_MAX_WORKERS=2 pnpm check` passed: 274 web/backend files,
2,313 tests, native checks, lint and types. Focused lifecycle tests cover late
authenticator responses and identity/session changes. Local browser inspection
covered phone login in Arabic light/dark and Urdu tablet layout. The owner
confirmed the real dev admin flow. `pnpm build` and formatting passed. Production Convex deploy succeeded without
schema/index deletion. Push and hosted frontend verification are in progress.
A stale original-checkout process still owned port 3000 after WTS reported exited;
it was stopped and the current worktree restarted. Earlier local UI captures
therefore do not prove this branch, while the successful live SMS/TOTP test used
the deployed development backend. Email redirect browser tests are rerun against
the current worktree.
Production ENVRIN settings and the approved admin phone identity are configured;
production accounts are separate and require first-time authenticator enrollment.
Guide and Word updates are explicitly deferred by the owner; AGENTS.md now makes
them opt-in. Existing artifact tests remain available as `pnpm guide:check`; code
and runtime fixture tests stay required. No Google Docs update was requested. No automatic SMS retries;
five-minute spacing, five sends then a 24-hour lock from the fifth send.
