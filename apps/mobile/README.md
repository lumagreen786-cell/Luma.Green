# Luma.Green mobile

> Implemented shell, 1 October 2026. Android and iOS JavaScript exports are
> verified. Android config generation (`prebuild --no-install`) is also verified;
> it emits the system-camera intent query and CAMERA permission removal. Signed native builds, device acceptance, EAS delivery and store
> approval are separate release steps.

One Expo 57 / React Native app serves Android and iOS. Its web view loads
`https://luma.green`. Next.js and Convex continue to run on servers. The
mobile app does not contain a copy of the Next server or an offline ledger.
The operator can deploy the app origin separately from the public website.
Keep the app origin compatible with supported shell versions.

The web view keeps its own cookies and uses the existing `/api/auth` proxy.
Phone sign-in remains inside it. External browser sessions are separate.
Admin routes require an explicit browser handoff and a fresh browser sign-in.
Private document previews and downloads remain in the browser or desktop app;
the shell never creates a public storage URL or transfers a bearer token to an
external browser. Blob URLs and unknown URL schemes are blocked.

## Local commands

From the repository root, install the pnpm workspace once. Then:

```sh
pnpm --filter @luma/mobile check
pnpm --filter @luma/mobile export
pnpm --filter @luma/mobile start
```

The export writes ignored iOS and Android Hermes bundles to `apps/mobile/dist`.
It does not produce an APK, AAB or IPA and does not prove native permissions.
`start` can use Expo Go for basic web-view checks; a development build is needed
for this app's real permissions, update settings and identity.

```sh
pnpm --filter @luma/mobile ios
pnpm --filter @luma/mobile android
```

These commands generate `apps/mobile/ios` and `apps/mobile/android` with Expo
Continuous Native Generation (CNG), then use local native build tools. Generated
projects are ignored. Make native changes through app config or config plugins.
Do not create a second app in the root `ios/` or `android/` folders.

Local builds need full Xcode and an iOS simulator, or a JDK, Android SDK and
emulator/device. At implementation time this Mac had only Apple's Command Line
Tools, with no Xcode app, working Java runtime or Android SDK. None were installed
by this change. EAS Build is an alternative after account setup.

## Demo commands

Start the web preview in another terminal first (`PORT=3004 pnpm start`, after
building the root app). Then use one of these commands from the repository root:

```sh
pnpm --filter @luma/mobile demo:ios --check
pnpm --filter @luma/mobile demo:android --check
pnpm --filter @luma/mobile demo:ios
pnpm --filter @luma/mobile demo:android
```

The `--check` option tests that the web origin responds, then exits. The full
command starts Metro for an **already installed development build**. Use `i`
for an available iOS simulator or `a` for an Android emulator in Metro. The
commands do not compile or install a native app. Build the development app with
`ios` or `android` above once the local native tools are available. Use the same
origin environment when building it.

```sh
# First native build, after installing the required local toolchain:
EXPO_PUBLIC_APP_URL=http://localhost:3004 EXPO_PUBLIC_ALLOW_LOCAL_HTTP=1 pnpm --filter @luma/mobile ios
EXPO_PUBLIC_APP_URL=http://10.0.2.2:3004 EXPO_PUBLIC_ALLOW_LOCAL_HTTP=1 pnpm --filter @luma/mobile android
```

The default web origin is `http://localhost:3004` on iOS and
`http://10.0.2.2:3004` on the Android emulator. Set `EXPO_PUBLIC_APP_URL` before
the command to choose another validated origin. The readiness check translates
the Android emulator alias to localhost on the host computer. It rejects server
errors and redirects to another origin, but does not prove sign-in or API health.

For a physical phone, deploy a tested HTTPS app origin with the correct Convex
auth configuration. Use an installed development build and connect the phone
and computer to the same trusted Wi-Fi for Metro:

```sh
EXPO_PUBLIC_APP_URL=https://your-tested-app.example pnpm --filter @luma/mobile demo:device
```

Replace the example origin with your own deployment. Scan Metro's code with
the installed development client. A phone cannot use the computer's localhost;
plain LAN HTTP remains blocked. Metro's local transport and the WebView's
trusted app origin are separate connections. This launcher does not create a
public tunnel, register an account or send OTPs. Without a configured backend,
show the public pages and role guides; protected operational screens still need
normal sign-in and approved test accounts.

Expo Go can be used only if its SDK/runtime is compatible. It does not apply
this app's native configuration and cannot prove production permissions or OTA.
These demo commands deliberately select the development client instead of
assuming that an Expo Go installation supports SDK 57.

See [mobile demo evidence](../../docs/delivery/mobile-demo.md) for what was
actually tested and what this machine still needs.

## Configuration

All values are optional for local checks. Set values before building or exporting.
They are public app configuration, not places to put secrets.

| Variable                            | Purpose                                                                                                                  |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `EXPO_PUBLIC_APP_URL`               | Exact HTTPS origin, default `https://luma.green`. No path, credentials, query or fragment.                               |
| `EXPO_PUBLIC_ALLOW_LOCAL_HTTP`      | `1` enables loopback HTTP only in explicit development. Release runtimes reject it.                                      |
| `EXPO_PUBLIC_PUSH_ENABLED`          | `true` enables optional push registration; default is off. Requires a real EAS project.                                  |
| `LUMA_ANDROID_GOOGLE_SERVICES_FILE` | Build-time path to Firebase public `google-services.json` for `green.luma.app`. Never use a service-account private key. |
| `EXPO_PUBLIC_EAS_PROJECT_ID`        | Actual EAS project UUID. When absent, OTA is disabled.                                                                   |
| `LUMA_UPDATE_CERTIFICATE`           | Path to the public RSA update-signing certificate, relative to this package or absolute.                                 |
| `LUMA_UPDATE_KEY_ID`                | Signing key ID that matches the published update metadata.                                                               |

For simulator development against the root Next dev server:

```sh
EXPO_PUBLIC_APP_URL=http://localhost:3000 EXPO_PUBLIC_ALLOW_LOCAL_HTTP=1 pnpm --filter @luma/mobile start
```

Use `http://10.0.2.2:3000` for an Android emulator. A physical phone's localhost
is the phone itself; use a trusted HTTPS development deployment for real devices.
The origin is selected at build/update time, not from a deep link or user input.
Preview and production builds reject local origins even if the development flag
is present. `originWhitelist=['*']` routes every navigation through our policy
instead of letting the WebView library automatically open unknown schemes.

`app.config.js` sets the app IDs to `green.luma.app`. The Android demo uses the
linked Expo project described below. Confirm platform account and app-ID
ownership before a store release; project linking does not prove store approval. It uses
the repository's branded PNG icons. Permission purpose strings are generated from all 33 root catalogues for iOS
system dialogs. Supported locales also configure Android language settings; its
OS owns the standard permission text. Native-speaker/device review is still required.
The normal screen contains the hosted web interface within native safe areas.
Native recovery controls appear only after a load failure and use system script
fonts. The web interface keeps its Geist/Noto fonts. Safe areas and recovery
controls follow device appearance; manual web theme choices apply within the page.

## Shared shell translations

Edit the root `messages/*.json` catalogues. After changing the `native`, `common`
`brand` or `notifications` namespace, regenerate the compact committed shell catalogue:

```sh
pnpm --filter @luma/mobile messages:generate
```

`src/messages.json` contains only these four namespaces for every registered
locale. Do not edit it by hand. The mobile tests compare it with the root
catalogues and fail on stale output. The native bundle imports this compact
file; its English catalogue import is type-only.

## Device behavior

- Web navigation stays on the exact app origin. Other HTTPS, phone and email
  links require confirmation before opening an OS handler. File, blob, data,
  JavaScript and arbitrary app schemes are blocked.
- Safe areas and Android hardware back are native. There is no permanent native
  header, footer or update-status strip.
  Web-view load errors show Retry without erasing the session. An outage does
  not queue writes or provide offline transactions.
- The page's location control uses a trusted bridge to Expo Location. It requests
  native foreground permission on demand, including approximate-only access. There
  is no startup location request. Only the page submits coordinates; background
  location is blocked. Navigation/unmount discard late responses, requests are
  bounded, and untrusted frames cannot request native access.
- Android web file inputs delegate photo capture to the system camera app. The
  shell does not request its own CAMERA permission; it explicitly blocks that
  permission from dependency manifests. A small Expo config plugin adds the
  IMAGE_CAPTURE intent query so Android can discover the system camera. No
  separate permission-toolbar step is required. On iOS, the system asks when
  the web input opens the camera. Photo/document selection uses the system
  WebView file chooser. Microphone and broad storage permissions are explicitly
  blocked. Android device backups are disabled to keep its session storage out
  of app backups.
- Initial language comes from the device. Later native navigation events update
  the shell language from the locale path. An unprefixed app path means English,
  matching the web router's `as-needed` locale prefix. Test client-side Next navigation on
  both OS versions: Android WebView history events can differ from iOS. There
  is no general web-to-native command bridge.
- Optional push uses a narrow trusted-document bridge. There is no universal-link
  association, custom file-sharing bridge or native account/token store.

## Optional account notifications

Open Account → Notifications in the hosted app and choose Enable. The native
shell first explains the choice, then asks for OS permission. Nothing prompts at
startup. With permission already granted and this installation opted in, a later
load can refresh its token without another prompt. The web app binds the token
to the current authenticated profile; sign-out revokes that installation first.
A failed revoke keeps the session open so the person can retry.

The bridge accepts only `luma.push.enable` and `luma.push.status` from the exact
trusted document. It returns a result to that document only; navigation and
unmount discard stale work. Tokens are never logged or put in browser storage.
A separate random installation ID contains no identity or token. Provider keys
remain on Convex. The lock-screen notice contains generic translated copy;
its tap always opens the protected localised inbox. Remote payloads cannot pick
a URL or private record. Repeated taps reopen the inbox even after navigating
elsewhere. Foreground mobile banners are suppressed while the inbox is active.

The module and config plugin are included, but push stays off without
`EXPO_PUBLIC_PUSH_ENABLED=true`, a valid EAS project and configured backend.
Android also needs the matching public Firebase client file at the path supplied
through `LUMA_ANDROID_GOOGLE_SERVICES_FILE`. APNs/FCM credentials are held by EAS;
they are not that public file. Adding this module requires a new native build,
not an update to an older binary. Use a development build to test it, not Expo Go.
See the [account and push setup steps](../../docs/operations/app-releases.md#notification-setup).

## Updates and releases

There are three different releases:

1. **Hosted pages:** deploy the app origin. New page loads use that deployment.
   Keep backend changes compatible with supported clients. Do not force refresh
   an active form to push a page change.
2. **Shell JavaScript/assets:** EAS Update can change code that fits the installed
   native runtime. The `fingerprint` runtime policy prevents a new native module
   from being sent to an old binary. The startup check can download an update;
   it applies on a later cold start or an explicit safe Restart. The hosted
   download icon shows update status without opening a modal. Restart requires
   a fresh idle public home document. Forms, editable content, task dialogs and
   prior edits/task clicks block it. Finish work and reopen Luma if the guard
   remains latched. An embedded rollback directive is staged through the same
   check/fetch path and requires the same restart guard. Expo Go does not prove
   production OTA behavior.
3. **Native binary:** new native modules, permissions, Expo/RN versions or native
   identity settings need a new signed store build. EAS Update does not replace
   this step. A permanently fixed base install is not promised.

Profiles in `eas.json`: development (development client), preview (internal APK
or registered iOS devices), production (store binary). Each has a distinct update
channel. No project ID or signing credential is invented. OTA stays off until a
valid project ID is configured. Invalid IDs, incomplete signing settings,
unreadable/invalid/expired certificates, private keys mixed into public certificate
files and non-RSA certificates fail config. A production profile, or `NODE_ENV=production` without an explicit development/preview
profile, with OTA enabled also requires an explicit app origin and certificate/key ID pair.

Before the first production release:

1. Create/verify the Expo project and Apple/Google developer accounts; confirm
   app IDs, organization ownership and signing credentials.
2. Set the real project ID and the app origin in each EAS environment. Use a
   production environment for both production builds and production updates.
3. Generate an update signing key and public certificate using Expo's current
   code-signing procedure. Keep the private key in secured release storage.
   **Production OTA requires code signing**, even though account-free local
   checks allow it to be absent. Set the certificate and key ID at build time;
   use the matching private key when publishing. Changing trust material needs
   a new binary. Protect release access and test a tampered update rejection.
4. Build preview binaries, run the acceptance checks below, then test a signed
   update, deferred restart and rollback on those exact binaries.
5. Submit native binaries through the intended store/test track. Provide privacy
   declarations, camera/location reasons, review login access and device screenshots.
   A wrapper with native controls does not guarantee App Store approval. Confirm
   sufficient useful native app behavior under Apple's minimum-functionality rule.
6. Publish only compatible, policy-compliant OTA updates. Treat a material change
   to the reviewed app's function as a store-review decision, not an OTA loophole.

These are operator commands after setup, not commands run by this change.
**Do not run them for signed releases until the
[mobile signing gate](../../docs/operations/app-releases.md#build-test-then-release)
is cleared.** `pnpm dlx eas-cli` and global EAS installations do not inherit the
workspace's node-forge patch. Verify the actual release toolchain's fixed or
patched dependency and signature tests first; see the
[patch provenance](../../patches/README.md).

```sh
# Run in apps/mobile with the approved EAS CLI and actual account configuration.
pnpm dlx eas-cli build --profile preview --platform all
pnpm dlx eas-cli build --profile production --platform all
EAS_BUILD_PROFILE=production pnpm dlx eas-cli update --channel production --environment production --private-key-path /secure/path/private-key.pem
```

Official references: [Expo runtime versions](https://docs.expo.dev/eas-update/runtime-versions/),
[update code signing](https://docs.expo.dev/eas-update/code-signing/),
[Apple review rules](https://developer.apple.com/app-store/review/guidelines/),
[Google developer policy](https://support.google.com/googleplay/android-developer/answer/16313518).

## Acceptance before release

Unit checks cover URL policy, admin/browser separation, locale detection,
release config, malformed signing inputs and the explicit update-restart rule.
Typecheck and both JS exports are local proof only. The existing web E2E suite
covers shared browser flows; it does not replace these checks in native binaries:

- Phone login, optional authenticator/recovery code, app close/reopen, expired session, sign-out, and network loss.
- Notification allow, deny, slow approval, disabled OS settings, token renewal,
  sign-out/re-login and account switching. Test foreground/background/cold-start
  taps and two taps separated by normal page navigation. Check generic lock-screen
  text, inbox authorisation and network failure during revoke.
- File picker, camera allow/deny, JPEG/PNG preparation and iPhone HEIC rejection.
- Location allow/deny, approximate location, and disabled OS location services.
- Admin handoff with a fresh browser login; private document viewing there.
- Arabic/Urdu layout, large text, screen reader names, keyboard, back, and locale
  changes through Next client navigation on both platforms.
- Download/browser handoff, external URL confirmation, unsafe URL blocking.
- Preview update download, no mid-form reload, explicit restart, cold-start
  application, signing rejection, and recovery to a known-good release.

Record device/OS versions and the signed build/update identities with the results.

## Android demonstration — 26 October 2026

The owner resumed Android work for an installable demo. iOS and desktop release
work remains on hold. The Expo project is `@lumagreens-team/lumagreen`.
Project linking alone does not enable OTA updates or push.

The `preview` EAS profile produces an internal APK. This Expo profile name is
not a Vercel Preview deployment: the APK loads the existing Production website
at `https://luma.green`. It reuses the actual web images, fonts, translations and
forms. Internet access is required. It does not need Metro to run after installation.

After Expo CLI sign-in and the release-toolchain verification described above:

```sh
# From apps/mobile, using the verified EAS CLI installation:
eas build --platform android --profile preview
```

An Expo account with project access and an available build allowance is needed.
No Google Play account or local Android Studio/JDK is needed for this cloud-built
APK. Do not buy a plan or submit a store release as part of the demo.
Install the resulting APK on the test phone and allow installation from the
chosen trusted source when Android asks. USB debugging is only needed for
computer-driven installation, captures and device diagnostics.

Test public screens, device light/dark mode, Kannada/Arabic, Back, offline Retry,
photo selection/capture and location. Login must use the normal verified phone
flow and any required authenticator. Live bookings and submissions create real
records; use owner-approved test data. A successful bundle export does not prove
APK compilation, installation or phone acceptance.

## WebView-only Android revision

The owner requested removal of the permanent native controls after the first
Galaxy A51 test. The hosted page supplies all normal navigation and task actions.
Android Back remains active; a native error screen offers Try again and browser
handoff only after a failed load.

Required capability paths remain native: Expo Location supplies foreground
location when the trusted page asks, Android WebView delegates image capture to the system camera, and
opens the system photo/document chooser for file inputs. These choices do not
require unrestricted file storage or photo-library access. Permissions are not
granted by installation. No additional Expo library is needed for these paths.

The Saathi selfie input (`capture="user"`) is the camera acceptance case. With an
owner-approved test account, open the selfie control, confirm native camera
launch, then cancel and confirm the form remains available. Taking and accepting
a photo can upload it to the owned draft; do that only with approved test content.
No other app data, OTP/TOTP screens or personal gallery contents belong in test
captures. Permission denial, picker cancellation and successful location lookup
still require real-device evidence.

Build profiles pin Node 24.18.0 and pnpm 11.24.0. The root `.easignore` excludes
hosted imagery, delivery captures and generated output while retaining app icons,
shared catalogues and the dependency-security patch.

## Shared update foundation — 29 October 2026

The hosted navigation shows the shared update icon only when the installed
shell supplies the narrow update bridge. Expo checks/downloads compatible
updates without a reload. The dialog offers an explicit Restart when ready.
The current trusted document must supply a second frozen-document proof before
the shell calls Expo reload. Navigation or unmount invalidates that proof.

Restart is conservative: only a fresh public home document with no form, edit,
task click or busy dialog is eligible. Finish work and reopen Luma if blocked.
The document unfreezes after a failed restart or a bounded timeout. An update
never forces an active form to reload. This does not grant new OS permissions.

OTA stays unavailable without its explicit project, runtime/channel and
production-signing configuration. iOS/Android bundles and mocked hook tests do
not establish signed OTA, real-device updates or store acceptance. Native
modules and permission changes still require a signed binary through the
appropriate distribution channel.
