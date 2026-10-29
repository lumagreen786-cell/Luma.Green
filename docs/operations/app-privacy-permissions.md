# Shared app privacy and permissions

Source checkpoint: 29 October 2026. Applies to the hosted web app, Expo Android /
iOS and Electron Windows / macOS. This is source preparation, not a submitted
store declaration, legal erasure certification or signed-device acceptance.

## Public notices and requests

`https://luma.green/privacy` is the public policy route once its checked web
release is deployed. `/privacy#requests` gives account/data request instructions
without an installed app or a session, links to `/account/removal`, and provides
`support@luma.green`. The footer and account navigation expose the same policy
in every registered language. Non-English policy copy is machine-drafted and
needs native-speaker review before store submission. Support inbox operation
and response times are not proved by a mailto link.

The existing account-removal owner verifies a recent full sign-in, closes
eligible accounts, revokes access and cleans up credentials/devices. Ownership
and unresolved work can hold closure; the UI must report that honestly. Business,
payment, fraud-prevention and audit evidence remains subject to restricted
review. The policy does not invent a legal retention period or promise that
closure erases every record. Do not weaken these checks or delete records to
make a store answer look simpler. Retention purposes, applicable legal periods,
necessary-vs-unnecessary personal evidence and support erasure processing need
an owner-reviewed operational policy before final store declarations. Use the
existing restricted-review queue, not a new public deletion bypass.

## Data inventory for store forms

| Data                                              | Purpose / recipients                                                                                              | User choice and release check                                            |
| ------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| Account phone and identity/session/factor records | Better Auth on Convex; configured OS Digital ENVRIN or MSG91 sends SMS                                            | Phone verification; preserve factors and session limits; never log codes |
| Addresses and chosen location                     | Collection matching and permitted operational participants                                                        | Foreground permission or manual address; no background tracking          |
| Photos, documents, business/identity evidence     | Authorized record users; Convex storage or configured private R2; Surepass for bounded registered-business checks | User selects files; private reads; audit access and retention review     |
| Optional transient photo estimate                 | Configured OpenRouter or self-hosted vision                                                                       | Separate disclosure; no claim that stored booking photos are transient   |
| Orders and payment evidence                       | Convex and configured Cashfree flow; authorized counterparties                                                    | Physical recycling trade; live payments remain separately gated          |
| Website, account and security operation           | Vercel, Convex; Cloudflare security/private storage when configured                                               | TLS, scoped access and audit records; processing can occur outside India |
| Optional public-page analytics                    | PostHog / Google Analytics if configured and visitor consented                                                    | Consent and withdrawal; no private-flow analytics                        |
| Optional error reports                            | Sentry if separately configured                                                                                   | Sanitized error-only capture, separate from analytics consent            |
| Optional push installation tokens and delivery    | Convex, Expo and configured APNs/FCM; desktop process-local notices                                               | Explicit opt-in; generic lock-screen copy; revoke bindings on sign-out   |

Prepare Apple App Privacy and Google Data safety answers against the exact
release's enabled providers, SDK privacy manifests and retained-data behavior.
Do not tick “no data collected” because the UI is hosted in a WebView. Verify the
identity of the legal publisher, privacy contact and production provider settings
before submission. This source change does not create or verify those accounts.

## Minimum permissions

| Platform                 | Allowed                                                                                                              | Explicitly unavailable                                                                                                             |
| ------------------------ | -------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| Web                      | Same-origin foreground geolocation through browser consent; selected file inputs                                     | Camera/microphone streaming, sensors, screen capture, direct device interfaces and clipboard reads denied by Permissions-Policy    |
| Expo Android             | Internet, foreground coarse/fine location; delegated system camera/picker without direct camera access               | Broad storage, microphone, background location, activity recognition, foreground location service and production overlay access    |
| Expo iOS                 | Camera/photo-picker purpose text; when-in-use location                                                               | Always-location, motion, microphone and background modes; local-network/Bonjour descriptions only for development                  |
| Electron macOS / Windows | Trusted-origin location after explicit consent; system file selection/download; optional process-local notifications | Renderer Node APIs, general IPC/preload, arbitrary schemes, media capture, clipboard reads, screen capture and unknown permissions |

Expo notifications and vibration are blocked in the default push-disabled build.
Enable those declarations only in a separately configured push build with the
existing explicit opt-in flow. Local development may retain overlay/local-network
discovery for Expo tools; preview and production cannot. Native permission changes
require a new binary and cannot be delivered as an ordinary hosted-page update.

`permission-generation.test.cjs` compiles Expo's production mods and checks its
permission inventory. This does not inspect every transitive manifest in a signed
APK/IPA. Before launch inspect the final merged Android manifest, iOS archive,
SDK privacy manifests, purpose-string translations and OS permission behavior.
Windows/macOS signatures, macOS notarization, denied permission flows, picker /
download access and update/restart acceptance remain device release gates.
