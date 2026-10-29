# Native update protocol

Status: source contract checked during the EGM repair review, 29 October 2026.
This does not establish signed update delivery or device acceptance.

## Owners and authority

`apps/shared/update-bridge.mjs` generates the hosted-document API. Expo's
`use-native-updates.ts` and Electron's `main.mjs` receive bounded commands.
`updates.mjs` owns desktop download/restart state and the asynchronous document
safety check. Expo's `use-updates.ts` owns its SDK update calls. Optional feeds
remain disabled without their release settings. No provider or backend secret
belongs in this protocol.

Injection requires the trusted exact origin, a nonempty native nonce and the top
document. Admin documents are excluded. The API is absent in ordinary browsers
and old shells. Existing APIs are not replaced on reinjection. The nonce is a
native session/document marker, not a user identity or record-access grant.

## Hosted API and events

`window.lumaAppUpdates` is a frozen, non-writable, non-configurable property:

| Method                 | Result/effect                                                  |
| ---------------------- | -------------------------------------------------------------- |
| `getState()`           | Current status string, initially unavailable                   |
| `canRestart()`         | Boolean: idle document and no pending freeze                   |
| `prepareRestart()`     | Boolean: freeze the idle document and start a ten-second lease |
| `getRestartDeadline()` | Integer epoch milliseconds during a freeze; otherwise zero     |
| `isRestartPending()`   | Boolean: frozen, lease unexpired and document still idle       |
| `request(action)`      | Only status, check or restart; all other actions do nothing    |

Native states are unavailable, idle, checking, ready, current and failed.
The bridge may show blocked for an unsafe Restart. Restart requests accept ready
or blocked only, and still require a new successful prepare. The native updater
independently requires a downloaded update; changing a page status grants none.

The document dispatches `luma-app-update` after state/safety changes; it carries
no private record. Reinjection dispatches `luma-shell-update-state` with
`detail: {token, state}`. The listener ignores a mismatched token, updates status,
unfreezes input and emits the change event. Page code cannot turn this status
notification into general native authority.

## Idle-document predicate

The document must be complete, visible, without a query or fragment, and at `/`
or its current primary-language home path, with an optional trailing slash.
Regional HTML language tags use their lowercase primary subtag. Native handlers
also check the trusted origin and public-home route.

The document must contain no form, non-hidden input, textarea, select, editable
content, `aria-busy=true`, task dialog, alert dialog or open native HTML dialog.
The marked update dialog is excluded. Editable attributes other than false are
blocked conservatively. Input, change, submit and clicks outside the marked
update controls/dialog latch the document as edited, including across SPA
navigation. Reopening a fresh document is required to clear that latch.

Prepare sets the root's inert property and a deadline of `Date.now()+10000`.
Pending-proof checks repeat the idle predicate while allowing this own freeze.
A late edit, task control or hidden document invalidates proof. The timer
unfreezes input, sets failed and emits a change event. A native failure/status
reply also unfreezes. This protects update-triggered restart, not ordinary app
exit or OS termination; it does not recover unsaved workflow data.

## Expo transport and proof

The top WebView sends JSON through `ReactNativeWebView.postMessage`:
`{type:"luma.update", nonce, action}`. Exactly these three keys are required;
action is status/check/restart and the raw message is at most 256 characters.
The nonce must match `Constants.sessionId`; frame URL must equal the current top
URL at the trusted origin. Admin routes, foreign frames and malformed messages
are ignored. The shell drops new commands while app state is not active.

Status reinjects the current bridge. Check invokes the bounded SDK check/download
owner. Restart requires ready state and public home. Native code saves a proof
marker, URL and navigation generation, then asks the frozen current document to
reply with exactly four keys:
`{type:"luma.update.apply", nonce, proof, expiresAt}`.

The raw reply is at most 512 characters. It must match the pending marker,
nonce, exact current URL and generation. `expiresAt` must be a safe integer,
strictly after now and no more than ten seconds ahead. The injected reply reads
the frozen lease deadline and sends only when `isRestartPending()` passes.
Navigation, load/unmount and app backgrounding invalidate pending native work.
An inactive OS permission prompt alone is not treated as background navigation.
An accepted proof calls the SDK restart with explicit safe intent. Arrival,
check or a failed proof never reloads the document automatically.

## Electron transport and proof

The page opens the exact URL `lumagreen-update://ACTION?token=NONCE` in a new
window. Only the three named actions and exact nonce match are accepted; extra
query fields and other spellings are rejected. The native window-open handler
cancels the command, validates the trusted main window and performs the action.
No preload, arbitrary IPC, file path or destination URL is exposed.

Before and after awaiting the current document's JavaScript proof, the restart
owner requires one window, no downloads, an idle public-home URL and no loading.
The document object, URL and nonce must remain identical. The returned deadline
must be a safe integer still in the future. A document window appearing during
the await blocks restart. A rejected check publishes blocked; an exception sets
failed. Explicit safe approval alone calls `quitAndInstall`. Normal quit does
not install, and downloaded arrival opens no unsolicited modal.

Desktop native permission confirmations use a separate navigation generation.
Full navigation, reload and main-frame in-page navigation invalidate pending
location/notification approvals. Existing granted permissions remain process-local;
subframes and document windows cannot request those grants.

## Mobile WebView transport envelope

The main-document-only `messageBridgeScript` wraps the existing WebView sender.
Every feature payload is a string of at most 512 characters inside exactly four
keys: `type: "luma.native.message"`, `nonce: Constants.sessionId`, `url` equal to
the current document href, and `data`. The outer JSON is at most 2048 characters.
The shell validates all four keys and current trusted document before forwarding
the unchanged payload to location, push or update parsers. Bare messages fail.

Installed Android WebView 13.16.1 reports source origin in its modern message
listener and the top document URL in its Java fallback, even for a nested frame.
Android accepts either exact trusted origin metadata or the full current URL,
but always requires the injected envelope nonce and exact current href. iOS
requires the full current URL. Main-frame-only injection keeps the nonce out of
foreign frames; the bare fallback interface does not grant command access. Same
origin scripts share the page's browser security principal. No native permission,
module or binary change is required. Physical Android/iOS acceptance is pending.
