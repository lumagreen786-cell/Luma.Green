# Native packaging — 28 October 2026

## Current status: paused by the owner

The owner has deferred the Expo app. No further native development, packaging
or release is authorized until resumed. The EAS command confirmed cancellation
of queued Android build `0be3df67-9dbb-4d93-a48c-8c2cb85e8b65`.
Existing app changes are preserved. The web release and documents continue.
The following sections record work done before this pause.

## Authority and project

The owner authorized APK and IPA/TestFlight build work, with iOS first. Reuse
existing accounts and signing credentials. Do not buy a plan, accept terms,
create signing identities or submit a store release without the corresponding
owner setup. The original dirty Android checkout remains untouched.

The authenticated Expo account was verified by the parent task. A read-only
project check through the approved toolchain confirmed the existing project
`@lumagreens-team/lumagreen`, ID `f0e526e7-20d3-4657-8c45-78afb801cfdf`.
No account, project or permission change was made.

`LUMA_EAS_PROJECT_ID` now links binary builds through `extra.eas.projectId`.
It is optional and validates a UUID. The Preview and Production profiles name
this verified existing project. Fresh local configuration needs no account.
The separate `EXPO_PUBLIC_EAS_PROJECT_ID` continues to control update setup.
Build linking alone leaves OTA and optional push disabled. Conflicting build
and update project IDs fail validation. No unsigned OTA service was enabled.

## Release toolchain verification

The initially cached official EAS CLI 26.0.0 resolved unpatched node-forge 1.4.0.
Both its direct dependency and certificate consumer accepted the repository's
known-bad nested DigestAlgorithm vector. That tree was not used for signing.

A temporary pinned EAS CLI installation was created at
`/tmp/luma-native-release-tools` using the repository's existing reviewed
node-forge patch in its own pnpm workspace settings. No global cache package or
repository dependency was changed. Both actual EAS dependency consumers then
rejected the malicious vector and passed positive SHA-1, SHA-256, SHA-384 and
SHA-512 verification controls. Test keys were synthetic, temporary and not saved.
No production credential value was read or printed. The CLI used for the build
attempts is `/tmp/luma-native-release-tools/node_modules/.bin/eas`.

Temporary tooling may be removed by the OS. If it is absent later, recreate the
reviewed patched toolchain and rerun the signature proof before using another
CLI. An unpatched fresh `pnpm dlx eas-cli` does not inherit the source patch.

## iOS first: blocked before queue

Attempted from `apps/mobile`:

```sh
LUMA_EAS_PROJECT_ID=f0e526e7-20d3-4657-8c45-78afb801cfdf /tmp/luma-native-release-tools/node_modules/.bin/eas build --platform ios --profile production --non-interactive --no-wait
```

The Production profile was selected to produce the requested IPA for a later
TestFlight path. EAS stopped during credential setup: existing distribution
credentials are not configured and interactive setup is required. No iOS job
or IPA was created. No Apple login, certificate or provisioning profile was
created or downloaded. EAS initialized its remote iOS build number to `1`.

EAS also reported that `ios.infoPlist.ITSAppUsesNonExemptEncryption` has no
boolean declaration. The owner's export-compliance answer must be confirmed;
this task did not infer a legal declaration. Apple account membership, app ID,
existing distribution credentials/provisioning and the declaration must be
resolved before another iOS attempt. TestFlight upload and acceptance remain
separate from an IPA build.

## Android second: submitted

Attempted from `apps/mobile`:

```sh
LUMA_EAS_PROJECT_ID=f0e526e7-20d3-4657-8c45-78afb801cfdf /tmp/luma-native-release-tools/node_modules/.bin/eas build --platform android --profile preview --non-interactive --no-wait
```

EAS reused the existing remote Android keystore. No keystore was created or
exported. The 366 MB source archive uploaded successfully. Build ID:
`0be3df67-9dbb-4d93-a48c-8c2cb85e8b65`. The requested profile is Preview, with
internal distribution and APK output. The first authenticated status read returned
`IN_QUEUE`; creation time was `2026-10-27T18:37:24.634Z` (28 October in India).
Artifact URLs are intentionally omitted;
use the authenticated project dashboard or a private account download after the
build succeeds. Submission is not proof of a completed APK.

The parent task owns subsequent status polling and any resulting installer:

```sh
LUMA_EAS_PROJECT_ID=f0e526e7-20d3-4657-8c45-78afb801cfdf /tmp/luma-native-release-tools/node_modules/.bin/eas build:view 0be3df67-9dbb-4d93-a48c-8c2cb85e8b65 --json
```

Keep returned download URLs private. Do not publish access-bearing URLs in the
handoff, screenshots or public source.

## Local evidence and remaining acceptance

Mobile TypeScript, 60 policy/config/security tests and 10 mocked native
component tests passed after the build-link separation. Scoped mobile config
ESLint and whitespace checks passed. Earlier iOS/Android JavaScript exports are
source-bundle evidence; no new native device acceptance is claimed here.

Both platforms retain the existing camera/file chooser and foreground location
bridge, without background tracking or a public authentication bypass. The
same hosted Production website supplies the operational screens. The parent
release can update those hosted screens without a separate native JavaScript
release.

After a successful binary build, test login and required factors, session
expiry/logout, camera/picker allow and deny, approximate/denied location,
private uploads, offline recovery, Android Back/iOS gestures, translated RTL
layouts and accessibility on actual devices. Record build ID, device and OS.
No Google paid call, notification provider send or store submission occurred.
