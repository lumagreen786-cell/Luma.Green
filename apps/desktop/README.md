# Luma.Green desktop

This package builds the macOS and Windows clients. It loads the existing Next.js
app from one exact origin. All roles, forms, business rules and sign-in remain in
that app and the existing Convex backend. There is no second server or local
ledger. The default origin is `https://luma.green`; the operator must confirm
that this is the deployed app before a release.

## Development

Run commands from the repository root with the pinned pnpm version:

```sh
pnpm install
pnpm --filter @luma/desktop check
pnpm --filter @luma/desktop smoke
pnpm dev
```

In another terminal, use the explicit local override:

```sh
DESKTOP_DEV_ORIGIN=http://localhost:3000 pnpm --filter @luma/desktop dev
```

Without the override, `dev` loads the configured HTTPS app. HTTP is allowed only
for an explicit localhost/loopback override in an unpackaged process. Packaged
clients ignore `DESKTOP_DEV_ORIGIN`. Never put account keys in renderer code.
`prepare:app` copies the shared message catalogues and deterministic brand icons
into ignored `generated/` files. Run it again after changing either input.

`pnpm --filter @luma/desktop run pack` creates an **unsigned development directory**
for the host platform in `apps/desktop/release`. It does not prove release signing
or notarization. It has no automatic update checks, even if a feed was supplied.
Do not distribute this directory as a production release.

## Local demo packages

The demo build has its own `Luma.Green Demo` name, app ID and cookie partition.
It loads only the loopback origin embedded at build time (default
`http://localhost:3004`). It never checks or installs updates. Production builds
still require HTTPS and the signed release settings described below.

Start the root web app on the same computer before opening the demo:

```sh
# After a successful root production build:
pnpm exec next start --port 3004
```

Then build the desktop app in another terminal:

```sh
pnpm --filter @luma/desktop demo:pack:mac
pnpm --filter @luma/desktop demo:pack:win
```

The macOS command makes a host-architecture unsigned app under
`apps/desktop/release/demo/mac-arm64/Luma.Green Demo.app` on Apple Silicon
(`mac/` on Intel). Open it with Finder. The Windows command makes an x64 folder
at `apps/desktop/release/demo/win-unpacked`; copy the **whole folder** to Windows
and open `Luma.Green Demo.exe`. It needs the web server running on that Windows
computer at the same port. Copying only the EXE will not work. These packages
are for local demonstration, not public distribution. Unsigned OS prompts and
Windows execution must be assessed on the target machine.

Use `DESKTOP_DEMO_ORIGIN=http://127.0.0.1:3004` at build time if the web server
uses that host. LAN, remote HTTP, HTTPS, credentials and route paths are rejected
by the demo profile. `DESKTOP_DEV_ORIGIN` cannot redirect a packaged demo. Do not
run prepare/build commands concurrently: they share the generated resources.

`pnpm --filter @luma/desktop demo:smoke` launches the packaged host app with a
fresh profile. It checks public participant pages, Arabic direction, blocked
local-file popups and the absence of Node APIs in the renderer. It writes local
screenshots and a result record to `release/demo/evidence/`. This requires the
web server above. The existing `smoke` command separately tests an isolated
fixture, private blob PDF rendering, offline retry and sandbox behavior.

Public pages, price browsing, calculators, role introductions and sign-in
screens can be shown without account keys. Authenticated operations still need
the real configured backend and permitted test accounts. This profile does not
add an authentication bypass, fake operational records or offline transactions.

## Security and user flows

- The renderer has no Node integration, preload, IPC bridge or webview access.
  Context isolation, the Chromium sandbox and web security remain on.
- Main-window navigation is restricted to the exact configured HTTP(S) origin.
  An HTTPS, `mailto:` or `tel:` external link can open the system browser/handler.
  Credentials, control characters, custom executable schemes and local files are
  rejected. Redirects outside the app origin are blocked.
- Private files still use the web app's authenticated Convex fetch. Same-origin
  blobs open in a separate sandboxed document window. Its built-in PDF plugin
  can load only the known Chromium PDF extension as a child frame of a trusted
  blob. Re-check that internal viewer contract after Electron upgrades. They never go to the OS
  browser. App/blob downloads retain the native save dialog. External downloads
  are denied; the shell does not bypass Convex file authorization.
- Browser cookies persist in `persist:luma-green`. Normal web sign-out removes
  the session through the existing auth flow. The shell never copies tokens.
  The system browser has a separate cookie store and may need a separate sign-in.
- All permissions are denied by default. Geolocation from the trusted
  requesting frame and top-level page can request a native confirmation. Both
  permission check and request handlers enforce the same origin rule. A grant
  lasts for the current window/process. OS location permission may still deny it.
  Notifications use a separate native confirmation and grant, limited to the
  trusted main window and its top-level document; document windows and frames
  cannot request them.
  File inputs use the native file picker. Camera/microphone capture is denied;
  select an existing photo instead.
- Offline recovery has local translated text, RTL direction and a keyboard link
  back to the trusted app. It has no script or remote dependencies. The menu has
  home, back, reload, open in browser and update actions. Standard editing and
  window menus use Electron's OS roles. Native copy comes from root `messages/`.

## Account notifications

Account → Notifications can enable generic desktop notices while the app is
running. The renderer watches the authenticated inbox, then uses the standard
Notification API after native permission. Tapping a notice focuses the app and
opens its localised protected inbox. It does not reveal booking details on the
lock screen. Sign-out clears the app's consent; a later sign-in requires its own
choice. The desktop client does not register a browser Web Push subscription.
It has no remote delivery while the app process is closed.

Test permission allow/deny and account switching on signed macOS and installed
Windows packages. macOS notification behavior requires signing. Windows needs
a matching Start Menu shortcut and app identity; the main process sets the
configured desktop AppUserModelID. An unsigned local pack or a JavaScript unit
test does not prove OS display. See [Electron notifications](https://www.electronjs.org/docs/latest/tutorial/notifications).

## Signed releases and automatic updates

Web content updates when the web deployment changes. Desktop executable changes
require a new version in this package, a signed binary, and the platform feed.
The app checks the feed at launch and every six hours. Stable updates download
automatically. Arrival updates the hosted download icon without opening a modal.
Installation requires an explicit **Restart** and a fresh idle-home safety check.
Normal quit does not install a downloaded update. Forms, task dialogs, downloads,
document windows and any prior edit/task click block restart. Finish work and
reopen Luma if the conservative document guard remains latched. Update failures do not stop the app. No configured
feed, unpackaged mode, or unsigned development configuration means no checks.

Use a public HTTPS **generic** feed. A private source repository is compatible
with this: publish only signed release artifacts and feed metadata to a public
download host. Never embed GitHub tokens, signing credentials or feed query
secrets in the app. Separate platform feed paths, for example `/desktop/mac/`
and `/desktop/windows/`, prevent platform metadata collisions.

Set environment variables in the release runner, outside this repository:

| Variable                      | Purpose                                                                    |
| ----------------------------- | -------------------------------------------------------------------------- |
| `DESKTOP_APP_ORIGIN`          | Explicit exact HTTPS app origin; no path, query or fragment                |
| `DESKTOP_UPDATE_URL`          | Public HTTPS platform feed directory; no credentials or query              |
| `CSC_NAME`                    | macOS Developer ID Application identity installed in the runner keychain   |
| `APPLE_ID`                    | Apple account used for notarization                                        |
| `APPLE_APP_SPECIFIC_PASSWORD` | Notarization password from the runner secret store                         |
| `APPLE_TEAM_ID`               | Apple developer team                                                       |
| `WIN_CSC_LINK`                | Windows signing certificate path or supported external certificate input   |
| `WIN_CSC_KEY_PASSWORD`        | Windows signing certificate password from the runner secret store          |
| `DESKTOP_WINDOWS_PUBLISHER`   | Exact Windows certificate publisher name for update signature verification |

Build on each native platform:

```sh
# macOS runner: x64 and arm64 DMG plus ZIP
pnpm --filter @luma/desktop dist:mac

# Windows runner: x64 and arm64 NSIS installer
pnpm --filter @luma/desktop dist:win
```

These commands fail before packaging if required configuration is missing.
`forceCodeSigning` is on for releases. macOS uses hardened runtime and mandatory
notarization. Windows enables update signature verification for the configured
publisher. These are configuration guards, not proof that a certificate or
account is valid. Build logs and OS verification provide that proof. Do not
bypass the scripts with a stale generated configuration.

Release checklist:

1. Confirm the production app origin and backend identity. Test phone sign-in,
   admin TOTP, sign-out, cookie persistence, file selection, location approval and
   denial, private PDF preview/download, RTL navigation, and offline retry on
   both operating systems with the deployed app.
2. Run root checks and the desktop checks/smoke test. Update this package version.
3. Supply signing identities and feed configuration through secure CI. Build on
   macOS and Windows. Verify the signed macOS bundle with `codesign` and `spctl`;
   verify notarization/stapling. Verify the Windows Authenticode certificate and
   publisher with PowerShell `Get-AuthenticodeSignature`.
4. Install each architecture artifact on a clean supported machine. Check native
   permissions and installer/uninstaller behavior. Preserve the signing identity
   across updates; a certificate/publisher change needs a planned migration.
5. Upload the generated installers, macOS ZIPs, blockmaps and generated
   `latest*.yml` metadata to the matching feed path. Preserve exact generated
   filenames. Upload artifacts first and metadata last. Keep old artifacts for
   recovery. Build scripts use `--publish never`; upload is a separate action.
6. Install the previous signed version. Verify the new feed check, signature
   validation, download, **Later**, no installation on normal quit, guarded restart,
   and retained login. Test an unavailable feed and a bad signature too. A unit
   mock or successful package build is not proof of the update chain.

The macOS ZIP is required by the macOS updater even when users install the DMG.
A download host, Apple account, Windows certificate, notarization and platform
CI are operator dependencies. Nothing here provisions or pays for them.

## Verification boundaries

Pure Node tests cover URL and download rules, permission origins, insecure config
rejection, release guards, localization/escaping and update consent/failure.
`typecheck` uses strict TypeScript `checkJs`. Root ESLint checks this package.
`smoke` launches real Electron against a temporary loopback fixture and a fresh
profile. It covers renderer Node isolation, blocked local-file popup, a valid
PDF blob window with its loaded internal viewer frame, Arabic offline UI and retry. It does not log into a real backend
or prove OS permission delivery, document authorization, notarization, Windows
installation or signed update delivery. Run it on a machine with a GUI (Linux CI
needs Xvfb if used for an additional smoke run).
