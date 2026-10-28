# Native apps

> Status checked: 29 October 2026. Shared Expo/Electron update controls and
> guarded restart are implemented in source. An Android demo has installed-device
> startup evidence. Signed update delivery, full device acceptance and store
> approval remain open. Decision: [ADR 0014](../decisions/0014-shared-web-ui-in-native-shells.md).

The 29 October source foundation is the scoped exception to the historical
native pause below. Native release builds and update publication remain paused.

## Historical owner update — 28 October 2026

Expo development and packaging are paused. Preserve the existing app work until
the owner resumes it. The queued Android build was cancelled. The current release
focus is the web platform and its documents. The earlier resumption below is
historical and does not authorize further native work.

## Historical foundation release — 27 October 2026

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

The repository has three application packages. The root Next.js package owns all
operational screens and calls the existing Convex backend. `apps/mobile` uses
Expo / React Native for iOS and Android. `apps/desktop` uses Electron for macOS
and Windows. Root `android/`, `ios/`, `macos/` and `windows/` folders contain the
platform entry guides; there are no duplicate applications in those folders.

The native packages load one exact trusted HTTPS origin. Both Expo and Electron
now default to https://luma.green. Release builds still require an explicit,
verified origin. Authentication must trust the selected origin through SITE_URL
or exact EXTRA_TRUSTED_ORIGINS on the matching Convex deployment. No native
package gets a backend admin key or copies a login token to the browser.

| Owner             | Responsibility                                                                                       |
| ----------------- | ---------------------------------------------------------------------------------------------------- |
| Root Next.js app  | All role screens, browser forms, auth proxy, client-side validation                                  |
| Convex            | Authentication, authorization, private files, durable records and business rules                     |
| `messages/*.json` | All 33 web and native control languages; admin remains English                                       |
| `apps/mobile`     | Safe areas, navigation, permission controls, optional Expo push, offline recovery, EAS updates       |
| `apps/desktop`    | Sandboxed windows, local menus, safe downloads, foreground notices, offline recovery, signed updates |
| `public/brand`    | Shared app icons, generated from the existing SVG by `scripts/generate-app-icons.mjs`                |

## Update behavior

| Change                                    | Delivery                                                                  | When it applies                                                           |
| ----------------------------------------- | ------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| Hosted operational UI                     | Deploy the trusted app origin                                             | Normal page navigation or reload; active forms are not forcibly refreshed |
| Mobile shell JavaScript/assets            | EAS Update, correct channel, compatible fingerprint, production signature | Later cold start or confirmed Restart                                     |
| Mobile native runtime/modules/permissions | New signed native binary and applicable store/test distribution           | OS installation/update                                                    |
| Desktop executable                        | Signed installer/ZIP plus generated feed metadata                         | Automatic download and explicit guarded Restart                           |

The app origin and backend must stay compatible with supported installed shells.
EAS Update updates the mobile shell, not the Next.js server. A native runtime
cannot be kept forever: security fixes and new permissions need binary releases.
The desktop updater also changes binaries; it removes the need to download each
installer by hand, but still needs a process exit or restart to apply it.

## Security and UX boundaries

Mobile navigation passes through an exact-origin policy. External destinations
require confirmation. Unknown schemes and blob URLs are blocked. Admin routes
open in the external browser because private blob documents require a different
file-handling path. Users sign in there separately. Offline recovery retains the
WebView's cookie store but does not allow offline transactions.

Electron does not expose Node, a preload bridge or arbitrary native IPC to hosted
pages. Context isolation and sandboxing stay on. Only app-origin navigation and
restricted private blob windows stay inside the app. Geolocation requires an
explicit grant. Foreground notifications require a separate main-window grant;
other native permissions are denied by default.

Native packages have their own TypeScript checks and dependency versions. Expo's
React version stays isolated from Next.js. Generated platform projects, app
bundles and signing secrets are ignored. Native controls use React Native
primitives and system fonts; DOM components remain in the web app.
The mobile package also uses the TypeScript version required by Expo, independently
of the web compiler; run both package checks before changing compiler versions.
Mobile runtime copy is a compact generated catalogue; its test rejects stale
output. Regenerate it with `pnpm --filter @luma/mobile messages:generate` after
editing the shared native/common/brand/notifications copy. Desktop extracts the same required
namespaces during `prepare:app`.

See the [mobile guide](../../apps/mobile/README.md) and
[desktop guide](../../apps/desktop/README.md) for platform behavior and tests.

## Notification boundary

The web inbox owns records and read state. Convex binds optional browser or Expo
subscriptions to an authenticated profile and random installation ID. The mobile
shell exposes only enable/status requests from its exact current trusted
document; it does not accept user IDs, arbitrary URLs or backend commands.
Replies are discarded on navigation. Notification taps use a fixed localised
inbox route with normal session checks. Expo credentials stay in EAS and Convex.
Push is disabled until explicit configuration and user permission exist.

Electron uses the authenticated inbox for generic notices while running; it
has no closed-process push service. All lock-screen messages omit private record
contents. Sign-out must revoke the installation before it clears the session.
Actual APNs, FCM, browser-provider and OS display remain acceptance gates; local
unit checks and bundle exports do not prove them.

## Official references checked

- [Expo update runtimes](https://docs.expo.dev/eas-update/runtime-versions/) and
  [update signatures](https://docs.expo.dev/eas-update/code-signing/).
- [Electron security](https://www.electronjs.org/docs/latest/tutorial/security)
  and [desktop updates](https://www.electronjs.org/docs/latest/tutorial/updates).
- [Apple review guidelines](https://developer.apple.com/app-store/review/guidelines/):
  downloaded-code restrictions and minimum functionality still apply.
- [Google Play developer policy](https://support.google.com/googleplay/android-developer/answer/16313518):
  update mechanisms do not remove policy obligations.

## Four-platform foundation proposal — 28 October 2026

### Goal and limit

Let a person install Luma once and receive routine improvements with little
effort. Keep one web workflow and one Convex authority for all platforms.
Preserve entered values, full authentication factors, private file access and
exact money and mass units through every update.

An installed native app cannot avoid binary updates forever. Native modules,
permission declarations, entitlements and runtime security fixes can require a
new signed binary. Planning a permission now does not grant it on a device.
Do not add unused permissions or dormant features to avoid future review.

The owner approved the update icon, guarded Restart, Expo/Electron foundation,
tests, AGENTS.md rule and local commit on 29 October. Broader native features,
release builds, OTA/push activation, account creation, spending and store
submissions remain outside this change. The existing Android demo work is
preserved. User-guide work remains deferred.

### Approaches considered

| Approach                                                          | Benefit                                                                                  | Cost or limit                                                                  | Recommendation                                                            |
| ----------------------------------------------------------------- | ---------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ | ------------------------------------------------------------------------- |
| Existing Expo and Electron shells, hosted screens, signed updates | Reuses current work; desktop can update without a store; mobile gets routine web changes | Mobile binaries still need store updates; iOS utility and review remain gates  | Preferred for installed native apps                                       |
| Installable web app                                               | Product changes can use web deployment; no Luma native binary update path                | Browser limits and install experience differ; it is a separate delivery choice | Consider only if avoiding mobile store updates is an absolute requirement |
| Separate fully native products                                    | More control over native interaction                                                     | More duplicated UI and tests; native releases still need updates               | Defer; no current requirement justifies this rewrite                      |

### Delivery by platform

| Platform     | First public installation proposed                                        | Routine updates                                                             | Native binary updates                                                                          |
| ------------ | ------------------------------------------------------------------------- | --------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| Windows      | Signed per-user NSIS installer from Luma                                  | Hosted web changes; signed Electron feed                                    | Download through updater; apply on explicit safe Restart; no Store dependency                  |
| macOS        | Developer ID signed and notarized DMG from Luma, with ZIP update artifact | Hosted web changes; signed Electron feed                                    | Apply on explicit safe Restart; Intel and Apple Silicon artifacts; no Mac App Store dependency |
| Android      | Google Play signed production app                                         | Hosted web changes; policy-compliant, signed compatible EAS updates         | Play automatic updates or Play in-app update flow; Google Play still supplies the binary       |
| iOS / iPadOS | App Store signed production app                                           | Hosted web changes and only policy-compliant, signed compatible EAS updates | App Store update; use normal automatic updates and a clear store action when necessary         |

Android direct APK distribution is not the proposed public channel. It adds
installation consent and maintenance work and does not satisfy Play policy for
a Play-distributed app. Keep the existing internal demo separate. Mac App Store
distribution would also change the update owner; do not mix it with this direct
desktop feed. App Store automatic updates remain under the person's settings
and OS scheduling; Luma cannot guarantee an immediate silent installation.

Technical compatibility does not establish store-policy compliance. Apple
guidelines 2.5.2 and 2.5.19 restrict downloaded code and hidden features. Its
minimum-functionality rule 4.2 requires useful app behaviour beyond a repackaged
website. Assess actual recycling workflows, capture, location, notifications
and recovery before submission; adding a permission does not prove acceptance.

### Permission plan

Declare only capabilities required for the accepted first release. Ask after
the relevant user action. Opening the app must not trigger a set of prompts.
Translate explanations through the existing catalogue and test all native
permission strings in the generated platform configuration.

| Capability and trigger                                   | Android                                                                               | iOS / iPadOS                                                         | Windows                                                                  | macOS                                                                    | Denial or unavailable path                                          |
| -------------------------------------------------------- | ------------------------------------------------------------------------------------- | -------------------------------------------------------------------- | ------------------------------------------------------------------------ | ------------------------------------------------------------------------ | ------------------------------------------------------------------- |
| Location: Use my location                                | Foreground coarse/fine; accept approximate access                                     | When In Use; accept reduced accuracy                                 | Trusted-origin location grant plus available OS controls                 | Trusted-origin grant and OS Location Services                            | Enter address or choose location manually; confirm the pickup point |
| Photo: Take photo for booking, evidence or Saathi selfie | Existing delegated system-camera intent; CAMERA is blocked in current config          | Camera purpose string and action-time OS request                     | Selected-file upload first; live camera is deferred and currently denied | Selected-file upload first; live camera is deferred and currently denied | Select a suitable existing file; required evidence remains required |
| Existing photo or document: Add file                     | System picker; no broad storage/library access                                        | System photo/file picker; inspect actual WebView picker requirements | OS file dialog; selected files only                                      | OS file dialog; selected files only                                      | Cancel safely; retain form values and explain required evidence     |
| Notifications: Enable account alerts                     | Optional Android notification runtime permission on applicable OS versions; FCM setup | Optional notification authorization plus APNs setup                  | App opt-in and OS settings; existing process must run                    | App opt-in and OS settings; existing process must run                    | Account inbox remains usable                                        |
| Export: Save a document                                  | User-selected supported save/share route; no broad storage grant                      | User-selected Files/share route                                      | Existing guarded download and save dialog                                | Existing guarded download and save dialog                                | Cancel safely; never write an arbitrary path                        |
| Authentication: Enter phone code or TOTP                 | User entry and supported keyboard autofill; no SMS reader                             | User entry and supported keyboard autofill                           | User entry                                                               | User entry                                                               | Retry/recovery with existing server limits; never skip a factor     |

The iOS config currently has camera, photo-library and location reason strings.
Confirm which photo declaration the actual WebView path needs before removing
or expanding it. Desktop media capture is not enabled; do not claim camera parity.
If a first-release workflow needs direct desktop capture, design that separately
and review its OS privacy declarations and media permission handler first.

No current requirement needs microphone, contacts, call logs, SMS read,
background location, Bluetooth, nearby devices, all-files access, accessibility
service, screen capture, startup launch, tracking permission or APK installation
permission. Defer them. Biometrics, NFC and weighing-device links also need a
separate design. Adding them later may require a binary release.

Device permission never replaces a backend role or record-access check. Limit
native requests to the trusted current document; reject subframes, stale replies,
caller-supplied identities and arbitrary commands. Handle denial, permanent
denial, OS revocation, settings return and app resume. Do not repeat prompts in
a loop. Keep location and tokens out of logs and lock-screen messages generic.

### Update safety and compatibility

1. Keep web UI and business rules in their current owners. Deploy backend
   compatibility changes before frontend changes. Vercel releases stay Production
   only; local checks and native test channels do not authorize Vercel previews.
2. Inventory shell version, native runtime fingerprint, update channel and
   supported bridge capabilities. Web features must handle older shells without
   calling an absent native module. Define the support window before release;
   do not invent a permanent backward-compatibility guarantee.
3. Sign production EAS updates and match both runtime and channel. Keep the
   publishing private key outside Git and app bundles. Test certificate renewal,
   key rotation and recovery before expiry; do not assume a new trust root can
   be delivered to an old binary through OTA.
4. Download compatible updates without replacing an active form. Apply mobile
   code on a later cold start or an explicit safe restart. Apply desktop binaries
   only on an explicit safe Restart; normal quit does not install. Verify saved drafts before a planned
   restart. Failed saving must keep the current app open.
5. Keep the embedded mobile bundle usable if OTA is unavailable. Test Expo's
   supported rollback/error recovery with signed fixtures. Desktop recovery
   requires stopping a bad feed and issuing a known-good fix with a higher
   version; do not assume silent binary downgrade is safe or available.
6. Publish signed desktop artifacts before metadata. Separate OS, architecture
   and channel feeds. Keep publisher identity stable and reject bad signatures.
   Do not add future electron-builder v27 APIs to the installed v26 toolchain.
7. Test a small approved cohort before broader publication. A failed update
   stops promotion. Old supported clients must retain sign-in and compatible
   workflows. Define a minimum-safe-version rule and recovery route before
   enforcing it; an obsolete client must not lose its saved work silently.

### Work order and completion evidence

| Phase                                      | Foundation work                                                                                                                                                               | Evidence needed before the next phase                                                                    |
| ------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| 1. Confirm delivery choice                 | Review this proposal, including the mobile store exception; choose public channels                                                                                            | Owner decision recorded here; no release implied                                                         |
| 2. Review existing shell gaps              | Audit generated Android/iOS declarations, privacy manifests, entitlements, bridges, desktop paths and update controls; select supported OS versions and CPU targets           | Platform capability inventory; every permission tied to a workflow and denial path                       |
| 3. Prepare release settings after approval | Align trusted origin; define version/capability contract, channels, signing custody, key rotation, account ownership, APNs/FCM and feed host                                  | Reviewed configuration and secret names only; missing accounts/services stay unavailable                 |
| 4. Implement the approved foundation       | Small reviewed changes in existing shell/update owners; add focused regression tests                                                                                          | `pnpm check`, platform configuration checks, supported bundle/build checks; no unrelated native features |
| 5. Prove update behaviour                  | Install an older signed build and update it on each platform; test pending form, expired session, offline feed, bad signature, low storage, interrupted download and recovery | Device/OS/build/update IDs plus observed results; synthetic tests are separate                           |
| 6. Prepare release review                  | Permission descriptions, privacy disclosures, privacy manifests, account deletion requirements, review access and store utility assessment                                    | Separate owner release decision, signing proof, platform approval and real provider/device acceptance    |

Current implementation — 29 October: the shared hosted download icon and dialog
are connected to Expo's update hook and Electron's updater. They appear in
public navigation, the desktop workspace sidebar and the compact workspace
header. Ordinary browsers and older shells without the bridge see no native
update control. Disabled builds explain that updates are unavailable.

The native channel supports only status, check and restart. It does not expose
Node, general IPC, filesystem commands or arbitrary URLs. Expo validates the
current document and session nonce; a second frozen-document proof is required
before reload. Navigation/unmount invalidates pending proof. Electron cancels
the bounded custom navigation command before it can leave the page, validates
the main window and nonce, and checks document windows/downloads before restart.
The shared bridge is copied into desktop generated resources during preparation
and packaged with the app; Expo imports that same source.

The safety rule is conservative: restart only on a visible, loaded public home
document with no form, editable field, busy state or other dialog. Edits,
submissions and task clicks latch the document unsafe, including across SPA
navigation. Finish work and reopen Luma before restarting if latched. The page
freezes input during restart approval and recovers on timeout/failure.
No downloaded update automatically opens a modal, refreshes a page or installs
on quit. Keep flow-specific locks as a prerequisite for any future relaxation.
The rule protects against update-triggered interruption; it cannot prevent OS
termination or restore data a workflow has not saved.

Expo project linking does not alone enable signed OTA. Play in-app binary
updates are not implemented. Desktop signing/feed acceptance, mobile signed OTA,
physical iOS/Windows acceptance and production updates remain open. The root
app workflow now runs for web source changes too. AGENTS.md requires Expo and
Electron compatibility checks for each web change, without duplicating screens
or publishing native binaries for ordinary web updates.

Foundation implementation is separate from production release. The owner's
29 October request authorizes this source change and local commit, not accounts,
paid services, release builds, store submission or live update activation.
Guide/Word work remains deferred.

### Official basis checked on 28 October 2026

- [Apple review rules](https://developer.apple.com/app-store/review/guidelines/):
  sections 2.5.2, 2.5.19 and 4.2; Mac App Store updates also have their own rules.
- [Apple automatic app updates](https://support.apple.com/en-us/102629):
  automatic updates are available and remain user-controlled.
- [Google Play device and network policy](https://support.google.com/googleplay/android-developer/answer/16559646):
  Play binary updates must use Play; interpreted code still has policy duties.
- [Android in-app updates](https://developer.android.com/guide/playcore/in-app-updates):
  Play-managed flexible and immediate flows; not a private APK updater.
- [Android permission requests](https://developer.android.com/training/permissions/requesting),
  [location permissions](https://developer.android.com/develop/sensors-and-location/location/permissions)
  and [photo picker](https://developer.android.com/training/data-storage/shared/photo-picker).
- [Expo runtime compatibility](https://docs.expo.dev/eas-update/runtime-versions/)
  and [update signing](https://docs.expo.dev/eas-update/code-signing/):
  compatible native runtime and signed update trust are separate requirements.
- [electron-builder v26](https://www.electron.build/v26/) and
  [Electron signing](https://www.electronjs.org/docs/latest/tutorial/code-signing):
  use the installed toolchain's supported signed update path.
