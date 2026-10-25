# Contact review evidence — 25 October 2026

These 32 screenshots show the actual public UI from a local production build at
`http://localhost:3107`. The backend was intentionally unconfigured. No provider
call or support submission was made.

- English and Portuguese: light/dark, 390/768/1440px.
- Arabic and Kannada: 390px light, 1440px dark.
- Each of the 16 viewport cases has a contact-strip crop and a contact-form/panel
  crop. The form shows the honest unavailable state.
- All 32 final crops were visually inspected. No clipped labels, overlapping
  controls or horizontal page overflow were found. The strip captures include
  12px of the real surrounding page gutter so Arabic glyph overhang is visible.
- The final capture run recorded no browser page errors. Browser font readback
  confirmed custom Noto fonts, including Arabic and Kannada.
- `manifest.json` records each file hash, URL, viewport, theme, loaded font and
  measured bounds.

The final production-build browser run passed all four contact tests: English,
Portuguese, Arabic and Kannada. The separate Portuguese/English two-tab test also
passed after the shared navigation owner was repaired to use canonical targets.
Three existing production navigation regressions passed as well. No contact
markup changed after these captures; language routing was separately rebuilt and
verified.

An earlier development-runtime capture emitted one `Invalid or unexpected token`
page error. A later diagnostic run used six fresh English dark-mode contexts and
loaded `/help` and `/help/contact` 12 times without reproducing the error. The
development server also had a prolonged request pause. The final production-build
capture run was clean; the cause of the earlier error was not established.

These captures do not prove authenticated support submission, provider delivery,
production deployment or native app acceptance. Guide and Word updates remain
deferred under AGENTS.md.
