## apps/mobile/README.md

- The update section described cold-start-only application and no update control.
  Source already supplies a hosted update icon and explicit guarded Restart.
  Corrected the instructions. Reference: `src/components/app/native-update-control.tsx`
  and `apps/mobile/src/use-native-updates.ts`.
- The configuration section claimed that no account or app ID had been registered,
  while the later Android-demo section and `apps/mobile/app.config.js` record an
  existing linked Expo project. Removed that blanket claim. Store ownership and
  approval remain separate checks.
- Embedded rollback recovery could be skipped in `apps/mobile/src/use-updates.ts`.
  The installed Expo API returns `isAvailable: false` for a rollback directive
  and `isNew: false` for a fetched rollback. Both branches treated it as current.
  Repaired both decisions and added three hook regressions. A rollback still
  needs the existing explicit safe Restart.

## apps/desktop/README.md

- A pending location confirmation could grant the window after its requesting
  document left. The handler checked only the current origin. Reproduced in real
  unpackaged Electron: accepting the stale prompt caused the next document to
  skip its own confirmation. The handler now checks the requesting URL, document
  generation and main-window identity. The smoke test covers navigation and same-URL
  reload. No OS coordinates are required by this test.
- The location policy accepted same-origin subframes and document windows, while
  AGENTS.md requires native requests to reject subframes. Both permission handlers
  now require the main frame in the main app window. Unit tests cover rejected
  frames, windows and missing context. Existing valid grants remain process-local.
- Notification confirmation checked the URL but did not identify the document.
  A reload to the same URL could retain a stale approval. The expanded Electron
  regression failed at the eighth expected prompt: the replacement document
  skipped that prompt. The handler now also validates the navigation generation.
  A further regression caught away-and-back SPA navigation at the sixth expected
  location prompt. Full navigation and in-page navigation now invalidate the
  same permission generation, without changing the update bridge's nonce.
  The smoke test covers both location and notifications across navigation,
  reload and away-and-back SPA navigation.

## docs/architecture/native-apps.md

- The required editable-content and task-dialog restart block was incomplete in
  `apps/shared/update-bridge.mjs`. Empty, plaintext-only and uppercase editable
  attributes, alert dialogs and open native HTML dialogs could pass the selector.
  All five cases failed browser regressions before repair and passed afterward.
  The shared selector now blocks them for Expo and Electron. The existing safe
  home restart remains covered. This is a conservative document check; signed
  update delivery and device acceptance are still separate gates.
