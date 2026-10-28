# App release and account checklist

## Owner update — 28 October 2026

Expo development and packaging are paused. Do not start more iOS or Android
builds or store submissions until the owner resumes the work. The queued Android
build was cancelled. Preserve the existing source changes. Web deployment and
document work continue.

## Current foundation release on 27 October 2026

Expo development is resumed. The iOS and Android shells share the hosted web
screens at `https://luma.green`, with iOS tested first. Electron is outside this
release. Earlier proposals for a separate app hostname and a permanent mobile
toolbar do not apply to this version. Keep the current web navigation visible.

The mobile location bridge needs explicit foreground permission and the exact
trusted document. Backgrounding, navigation, sign-out and unmount invalidate late
results. Do not add background tracking. Optional push and signed updates remain
off without their required configuration. No EAS account or project is assumed.

Local type checks, policy tests and JavaScript exports do not prove a signed
installer, physical-device acceptance, TestFlight or store approval. Record those
separately in the delivery handoff.

> Status: implementation runbook, 2 October 2026. Apple, Google Play and Expo/EAS
> accounts are not yet set up, as confirmed by the founder. No account, paid build, store
> submission, signing identity or update feed was created by this change.

## Run checks without accounts

Use Node 24 and the pinned pnpm version from the root of the repository:

```sh
pnpm install --frozen-lockfile
pnpm apps:check
pnpm --filter @luma/mobile exec expo install --check
pnpm mobile:export
pnpm --filter @luma/desktop smoke
pnpm desktop:pack
```

The mobile export creates iOS/Android JavaScript bundles, not installable APK,
AAB or IPA files. Desktop packing makes an unsigned host-platform application
in `apps/desktop/release`. The desktop smoke test needs a graphical session.
None of these commands publishes a release.

The `App packages` GitHub workflow checks both packages and exports mobile code
on relevant pull requests. Its manual run also creates unsigned macOS and Windows
test packages. This workflow was added locally; a hosted run is separate proof.
Full mobile binaries use local SDK tools or EAS Build after setup below.

## Sign up and configure

| Setup                               | Required values                                                                      | Where to put them                                                                   |
| ----------------------------------- | ------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------- |
| App hostname and Vercel deployment  | `EXPO_PUBLIC_APP_URL`, `DESKTOP_APP_ORIGIN`, recommended `https://app.luma.green`    | Mobile build/update environment; desktop build environment                          |
| Matching Convex auth configuration  | `SITE_URL` or exact additional `EXTRA_TRUSTED_ORIGINS`                               | Convex deployment; see the [pilot checklist](launch-checklist.md) for backend keys  |
| Expo account and EAS project        | `EXPO_PUBLIC_EAS_PROJECT_ID` (real project UUID)                                     | Mobile build and update environments                                                |
| EAS production update signing       | `LUMA_UPDATE_CERTIFICATE`, `LUMA_UPDATE_KEY_ID`; matching private key for publishing | Public certificate at build time; private key in secured release storage, never Git |
| Apple Developer Program             | Registered iOS app ID, distribution credentials, App Store Connect record            | EAS credentials or secured native build runner                                      |
| Google Play Console                 | Android application ID, upload keystore, Play App Signing and test track             | EAS credentials / Play Console; keystore outside Git                                |
| macOS Developer ID and notarization | `CSC_NAME`, `APPLE_ID`, `APPLE_APP_SPECIFIC_PASSWORD`, `APPLE_TEAM_ID`               | macOS build runner keychain and secret store                                        |
| Windows code-signing provider       | `WIN_CSC_LINK`, `WIN_CSC_KEY_PASSWORD`, `DESKTOP_WINDOWS_PUBLISHER`                  | Windows runner; use an Electron Builder supported certificate/provider setup        |
| Public HTTPS desktop download host  | `DESKTOP_UPDATE_URL`, separate platform directories                                  | Desktop build environment; publish only signed public artifacts and feed files      |

The proposed identifiers are `green.luma.app` for mobile and
`green.luma.desktop` for desktop. Verify ownership before the first signed
release. Public variables are embedded in installed applications. They must not
contain secrets. An Expo account does not prove access to every paid feature;
check current [EAS code-signing availability](https://docs.expo.dev/eas-update/code-signing/)
before selecting a plan. Signing keys and desktop publisher identities must stay
stable across updates.

## Build, test, then release

**Mobile signing gate:** the workspace's node-forge security patch does not
apply to a globally installed EAS CLI or `pnpm dlx eas-cli`; each uses a separate
dependency tree. Before running the mobile guide's signed build or update
commands, verify that the actual release toolchain uses a published fixed
version or the reviewed patch with passing signature regression tests. Keep
signed releases blocked until that proof is recorded. See the
[patch provenance and checks](../../patches/README.md). A local JavaScript
export does not clear this gate.

1. Deploy and test the chosen HTTPS app origin with its correct backend and auth
   allowlist. A hostname default in source code does not provision that service.
2. Follow the [mobile release guide](../../apps/mobile/README.md#updates-and-releases)
   for preview APK/device builds, production store builds, signed EAS updates and
   rollback tests. Keep preview and production channels separate.
3. Follow the [desktop release guide](../../apps/desktop/README.md#signed-releases-and-automatic-updates)
   on macOS and Windows. Verify OS signatures and notarization, then publish
   artifacts first and generated feed metadata last.
4. Test a previous signed install upgrading to the candidate. Confirm that Later
   keeps an active form intact, Restart requires a choice, and sign-in survives.
   Test a bad signature, an unavailable feed and recovery to a known-good version.
5. Run real-device tests: login/logout/session expiry, uploads and camera,
   location permission denial, offline recovery, Android back, private files,
   RTL, large text and screen readers. Record build IDs, device models and OS versions.
6. Complete store privacy declarations, permission reasons, review credentials,
   screenshots and the selected test track. Store acceptance is not established
   by successful compilation. Reassess minimum functionality before submission.

Use the [delivery record](../delivery/apps-and-motion.md) for local evidence.
Operational work needs an internet connection. There is no background location,
offline write queue or independent native ledger. Push is optional and remains
disabled until the setup and device checks below pass.

## Notification setup

These steps are for the team after account approval. No paid account, credential,
provider message, native release or store submission was created in this pass.
Keep development and production projects and credentials separate.

1. **Expo/EAS:** create the team account and app project. Record its actual UUID
   as `EXPO_PUBLIC_EAS_PROJECT_ID`, plus the exact HTTPS app origin. Enable Expo
   push access-token security. Store its token only as `EXPO_PUSH_ACCESS_TOKEN`
   in the matching Convex deployment; set `EXPO_PUSH_ENABLED=true` only after
   credentials and testing are ready. Set `EXPO_PUBLIC_PUSH_ENABLED=true` in the
   matching mobile build environment. Leave both flags absent to keep push off.
2. **Apple:** choose the enrollment identity before registration. The entity is
   not registered yet; do not claim an organisation enrollment or legal owner.
   Review [Apple enrollment](https://developer.apple.com/programs/enroll/), then
   register the approved app ID and APNs signing key through EAS credentials.
   Keep the key outside Git. Build and install the signed development app.
3. **Android:** create a Firebase project with the matching `green.luma.app`
   Android client. Supply its public `google-services.json` via the build file
   variable `LUMA_ANDROID_GOOGLE_SERVICES_FILE`. Upload the separate FCM v1
   service-account credential to EAS; never embed that private JSON in the app.
   Follow [Expo's FCM guide](https://docs.expo.dev/push-notifications/fcm-credentials/).
   Google Play Console setup, signing and a test track are still required for
   store distribution; Firebase setup alone does not create them.
4. **Browser Web Push:** generate a VAPID key pair in a trusted local tool.
   Store `WEB_PUSH_PUBLIC_KEY`, `WEB_PUSH_PRIVATE_KEY` and `WEB_PUSH_SUBJECT`
   (`mailto:` support address or HTTPS contact URL) on Convex. Enable with
   `WEB_PUSH_ENABLED=true`. Only the public key reaches the browser. Serve the
   app and `/push-sw.js` over HTTPS. Inbox records remain available without
   push credentials. On iOS, assess the installed web app and OS requirements
   separately from the native Expo application.
5. **Device acceptance:** follow [Expo's setup guide](https://docs.expo.dev/push-notifications/push-notifications-setup/).
   Use approved test users and builds. Enable from Account → Notifications;
   check slow approval, deny, OS-disabled permission, app reopen, token renewal,
   inbox ownership, sign-out, account switch and delivery failure. Test generic
   lock-screen copy and taps in foreground, background and cold start. Tap twice
   with another page visit between taps. Do not use a public endpoint to send
   arbitrary notifications or log tokens in evidence.
6. **Desktop:** test signed macOS and installed Windows builds. Notices are
   available only while the app process is running. Keep the Windows shortcut
   and AppUserModelID aligned. Confirm OS notification controls and denied
   permission behavior; unsigned smoke tests cannot establish this result.

Record the deployment, app build, device/OS, event, expected recipient, send
receipt and observed result. A provider ticket or successful registration is not
proof that a notification reached the device. Do not mark the channel live until
its acceptance record is complete. Revoke test device bindings after testing.
