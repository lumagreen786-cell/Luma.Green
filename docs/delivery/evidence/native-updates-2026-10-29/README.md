# Update foundation evidence — 29 October 2026

These are captures of the current local hosted UI with a **synthetic native
update-ready state** injected by Playwright. They show the real shared control,
translations, fonts and theme. They do not show a provider-delivered update,
signed installer, authenticated workspace or physical mobile device.

The browser matrix covers English, Kannada, Arabic and Urdu at widths 390, 768
and 1440 in light and dark mode: 24 layout cases, visually reviewed together.
The four representative captures are retained here. The browser suite also
checks no modal on arrival, blocked work-screen/edited-document restarts and an
explicit idle-home restart that freezes input without navigating the page.

Electron's local unpackaged smoke check verifies the sandbox, the bounded
update status command, blocked restart on an unavailable build, popup/file
guards, window restoration and Arabic offline recovery. It does not prove a
signed macOS/Windows binary upgrade. Expo tests use mocked update APIs; both
Android and iOS JavaScript export is a bundle check, not device acceptance.

Run the focused browser suite with:
pnpm exec playwright test e2e/native-updates.spec.ts

Production feed configuration, signed OTA, signing identity continuity,
interrupted/invalid signed artifact recovery and real-device/store checks
remain release gates. Guide and Word work remain deferred.
