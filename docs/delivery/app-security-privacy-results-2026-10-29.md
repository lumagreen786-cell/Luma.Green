# App security/privacy repair evidence — 29 October 2026

Scope: source repairs to web, Expo and Electron. Owner authorized checked PR
merge, not native distribution or paid-provider activation. The installed source
pairs Better Auth 1.6.33 with the supported Convex component 0.12.5; that pairing,
its phone/TOTP behavior and the backend Zod 4.6.6 resolution are unchanged.

## Dependency and behavior findings

The initial fresh audit reported 16 deduplicated advisories: one critical, nine
high, two moderate and four low. Compatible selections are Electron 44.10.0,
Undici 6.29.1, http-cache-semantics 4.3.0 and node-forge 1.4.2. The old forge
patch is no longer applied. Its existing signature rejection, certificate/CSR
and valid signing controls pass against the actual resolved Expo consumers.

Registry ranges alone were insufficient: the actual 4.3.0 cache still reused a
shared Set-Cookie response with max-stale. The regression failed before Luma's
local patch. The patch refuses no-store/private/no-cache entries, shared cookie
entries without explicit caching opt-in, and required shared revalidation. It
retains an ordinary public cached response. Deepmerge's null-prototype and own
`__proto__` cases also failed before a local patch in the distributed CJS/UMD
entry points. The local patch prevents source and target-copy prototype
injection while retaining ordinary nested/array merges. See patches/README.md.

Patch SHA-256 values:

- Deepmerge 4.3.1: db094b06e86c7bdc32d60c8538a3df1adfc6d6e2f41684dc1e657570fa46451e
- Cache semantics 4.3.0: 5fbd11e33802397d75563eb68e80ddfd36eb3d11aab062f190e2a5cb00c023db

The post-change audit still exits nonzero and reports eight advisories: one
critical, three high and four low. This is inventory, not a passing audit.

| Remaining inventory                                                              | Handling                                                                                                                                                                                                                                                                                                                           |
| -------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Better Auth optional Magic Link/OAuth/Proxy/device flows and PostgreSQL adapters | Absent in Luma. Existing real HTTP/adapter tests reject the routes without network calls, cookies, identities or sessions; Convex persists the real limiter. Keep the supported pairing until an official compatible integration supports the fixed auth release.                                                                  |
| Zod 3.25.76 inside Expo CLI                                                      | Development/build tooling, not the web/backend Zod owner. Expo start scripts now bind to localhost by default. No supported v3 fix was found. Do not force a v4 major into the CLI; do not expose a dev server/tunnel to untrusted users or process untrusted project configuration. Recheck the next compatible Expo CLI release. |
| Deepmerge 4.3.1                                                                  | Locally patched with a failing-before/passing-after regression. The advisory remains visible because the version is unchanged.                                                                                                                                                                                                     |

No advisory is hidden, no version is falsified and no auth integration is forced
outside its peer contract. Source changes do not upgrade separately installed
EAS tools: signed releases retain their independent verifier/toolchain gate.

## Privacy and permissions

The public `/privacy` route explains data categories, required recipients,
permission/analytics choices, access/correction/deletion requests and retained
evidence. `/privacy#requests` works without an app/session and points to the
existing account-removal flow or support email. The footer and account links
use localized navigation. All 33 catalogues contain translated policy text;
key/ICU/copied-English audit passes. Native-speaker review remains unclaimed.

The generated Expo production configuration contains internet and foreground
coarse/fine location by default, plus the three iOS picker/camera/when-in-use
purpose descriptions. Unused always-location, motion, microphone, background,
local-network and overlay declarations are removed or explicitly blocked.
Notification/vibration permissions remain disabled without push configuration.
Development tooling exceptions do not apply to preview/production. Browser
policy denies unused device/sensor/clipboard-read access; existing Electron
sandbox, trusted-origin and deny-by-default permission rules remain.

No retention period, legal publisher identity, provider approval or all-data
purge is invented. Final data-safety answers, inbox delivery, retained-evidence
operations, merged signed manifests and physical-device acceptance remain the
release gates in docs/operations/app-privacy-permissions.md.

## Full verification and integration

Fresh `pnpm check` passed: 2,870 web/backend tests in 347 files, four dependency
security regressions, 62 mobile policy tests, 14 mobile component tests and 30
desktop tests, plus root and both app type checks. Lint reports zero errors and
122 existing warnings. Formatting, diff whitespace and the 33-locale copy audit
passed. The Production build generated 3,285 pages. All 866 Production-build
Playwright tests passed, including 42 policy layouts (seven languages, three
widths, both themes). Captures were visually inspected, including RTL and
non-Latin text. Five public captures and a check inventory are under
`evidence/app-security-privacy-2026-10-29/`; they show a local Production build
with a disconnected backend, not native/device or provider acceptance.

Both Android/iOS JavaScript exports and Expo dependency compatibility passed.
The real local Electron 44.10.0 smoke passed after its first-use runtime download
was completed separately. The initial launch timed out during that download;
no assertion or timeout was weakened. The passing run covered sandboxing,
blocked popup, blob preview, main-window restoration, offline recovery and the
update command boundary. Native release binaries were not built.

Hosted checks and review remain the PR merge gate. No store submission,
OTA/feed publication or live provider call is included.

## Hosted browser failure and repair

The first hosted full browser run passed 862 tests and failed three Russian
320px layout checks. The new privacy label extended outside its footer column.
A local column-level regression failed with 148px of text in a 128px column,
although the macOS document itself remained 320px wide. The shared footer now
wraps long words inside each link. No overflow assertion or viewport was relaxed.
The privacy matrix now includes Russian and checks each footer item, in addition
to the full document. This same hosted footer serves Expo and Electron.

The corrected Production build passed all 866 browser tests. The timeout in one
unchanged form unit test occurred during concurrent browser/unit execution;
the same two-test form file passed alone in 877ms with unchanged five-second
limits. The final full pnpm check passed without the browser workload. A current
Russian phone/dark policy capture is retained with the other evidence.
