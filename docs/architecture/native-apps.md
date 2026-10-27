# Native apps

## Owner update — 28 October 2026

Expo development and packaging are paused. Preserve the existing app work until
the owner resumes it. The queued Android build was cancelled. The current release
focus is the web platform and its documents. The earlier resumption below is
historical and does not authorize further native work.

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

> Status: source implementation, 1 October 2026. Signed releases, native device
> acceptance and store approval are not yet verified. Decision: [ADR 0014](../decisions/0014-shared-web-ui-in-native-shells.md).

The repository has three application packages. The root Next.js package owns all
operational screens and calls the existing Convex backend. `apps/mobile` uses
Expo / React Native for iOS and Android. `apps/desktop` uses Electron for macOS
and Windows. Root `android/`, `ios/`, `macos/` and `windows/` folders contain the
platform entry guides; there are no duplicate applications in those folders.

The native packages load one exact trusted HTTPS origin. The proposed default is
`https://app.luma.green`, which must be deployed before release. It can point at a
separate Vercel project using this repository if app changes need a different
release schedule from `luma.green`. Authentication must trust the selected origin
through `SITE_URL` or `EXTRA_TRUSTED_ORIGINS` on the matching Convex deployment.
No native package gets a backend admin key or copies a login token to the browser.

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
| Desktop executable                        | Signed installer/ZIP plus generated feed metadata                         | Automatic download, installation on quit, or confirmed Restart            |

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
