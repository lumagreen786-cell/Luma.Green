# Expo foundation — 27 October 2026

## Scope and source assessment

The owner resumed shared hosted web screens in Expo, with iOS first and Android
second. Electron is outside this task. This branch loads the actual Production
website at `https://luma.green`; it does not contain replacement operational
screens, a native ledger, test sign-in, or a login bypass.

The unfinished mobile source was read from the original checkout on
`feat/android-demo`, source checkpoint `8415827`, including its uncommitted and
untracked files. That checkout was not changed. Its useful WebView-only shell,
light/dark semantic themes, exact-document location bridge and regression tests
were integrated into this foundation checkout. Existing root Expo dependencies
already match the resumed source, so no root package or lockfile change was
needed. The original hard-coded Expo owner/project and Android-specific build
image were not copied. Account ownership and release setup need separate proof.

## Implemented behavior

- iOS and Android select the same Production origin in every EAS profile.
  Fresh-clone config requires no account. Push and OTA updates remain disabled
  until their explicit settings pass validation.
- Hosted web screens own navigation. Safe areas, iOS back gestures and Android
  hardware Back remain native. A network failure offers Retry with the existing
  cookie store; renderer failure can restore the last trusted page.
- Navigation stays on the exact configured origin. External links require a
  choice. Admin routes require a browser handoff and separate browser sign-in.
  Unsafe schemes, private blob transfers, file access and mixed content stay
  blocked. Normal sign-out still uses the hosted authentication owner; no new
  native token or account store is introduced.
- Only the current trusted top document can request one foreground location
  reading. The page must call its location action. The bridge accepts approximate
  permission, limits a wait to 30 seconds, rejects concurrent readings, and drops
  late replies after navigation, backgrounding or unmount. It never requests
  background permission or starts a location watcher. Android WebView browser
  geolocation is disabled. Early scripts replace browser location methods on
  both the instance and prototype in every iOS frame. Untrusted/admin/child
  frames and continuous watchers receive an unavailable error. There is no
  alternate browser reading path. Regression tests cover these denied paths.
- Camera and photo inputs retain the system WebView picker. Android uses the
  delegated camera intent, with broad storage, microphone, background location
  and direct camera permissions blocked. Private uploads still require the web
  record permissions. Push retains its narrow permission-bound document bridge.

## Verification

On 27 October in this foundation checkout:

- Mobile TypeScript check passed.
- 59 native policy, config, navigation, camera, translation, signature, push and
  theme tests passed.
- 10 shell/location component tests passed with explicitly mocked native APIs.
- Changed mobile source and test ESLint checks passed.
- `expo install --check` reported dependencies up to date.
- iOS exported first: 680 modules, 1.7 MB Hermes bundle, output `apps/mobile/dist/ios`.
- Android exported second: 680 modules, 1.7 MB Hermes bundle, output
  `apps/mobile/dist/android`.

These are local checks and JavaScript bundles. The ignored export outputs are
not installers and are not deployment or device evidence. Test position values
are fixtures. No OTP, paid lookup, payment, provider push, cloud build, store
submission, account change or signing-key operation was performed.

## Remaining acceptance

Start with an approved iOS build and test account. Record the build, device and
OS. Check phone sign-in and required factors, session expiry, app reopen,
sign-out and account switching; camera/picker allow and deny; approximate and
denied location; offline recovery; private document handoff; RTL, large text and
screen reader behavior. Then run the same checks on Android, including hardware
Back. Verify APNs/FCM and signed updates only after account and credential setup.
Store review and minimum-functionality acceptance are not established by exports.

Guide and screenshot-document updates remain owned by the parent delivery task.
No native device screenshot was created or represented as current app evidence.
