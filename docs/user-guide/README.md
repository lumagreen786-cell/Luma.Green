# Maintained platform user guide

The maintained guide is an editable Word document. A Google Docs copy must be
imported from the same reviewed Word document. Use the source baseline and
screenshot labels in the guide to understand its evidence limits.

- Repository content source: [guide.md](guide.md).
- Maintained Word document: [luma-green-user-guide.docx](../../output/docx/luma-green-user-guide.docx).
- Browser evidence: [screenshots](screenshots/) and the capture manifests.
  Captures retain their original browser PNG pixels.
- Freshness record: `build.json`. Tests compare the complete input set, all
  source and image hashes, the DOCX hash, and the visual review record.
- Earlier PDFs, including `output/pdf/luma-green-user-guide.pdf`, are archived
  snapshots. They are no longer rebuilt or used as freshness evidence. Any PDF
  already supplied outside this path remains unchanged.

Word text, headings and tables are editable. Browser screenshots remain images.
If you edit a Word or Google Docs copy, put those content changes into `guide.md`
before the next build. This prevents later builds from losing your changes.

## Required update flow

1. Assess guide impact whenever a user-facing route, role, permission, workflow,
   control, setup requirement or native update behavior changes. Update the
   affected chapter and its edition and source baseline in `guide.md`. Record
   this assessment in the delivery handoff.
2. Build the current app and run a local preview. Capture changed public pages:

   ```sh
   GUIDE_BASE_URL=http://localhost:3004 pnpm exec jiti scripts/capture-guide.mts
   GUIDE_BASE_URL=http://localhost:3004 pnpm exec jiti scripts/capture-showcases.mts
   ```

   Home materials, pickup, shop, payment, records and questions are captured as
   separate browser sections so they remain readable in Word. Section screenshots
   are direct browser output, not cropped or composed after capture.

   The commands accept a local origin only and reject external requests. They
   visit real pages. Separate light and dark phone captures show the first-run
   language picker with no saved language choice. The phone-preview capture
   enters the synthetic number
   `9000000000` and submits the local preview form to show the OTP screen. No
   backend call, SMS delivery, account creation or sign-in occurs. Other forms
   are not submitted. Use a disconnected or approved test environment with no
   real personal data. Inspect every PNG.

3. For protected screens, use an approved staging account when available. Do
   not bypass authentication. The isolated `scripts/guide-preview` harness can
   show current components with synthetic records. Follow its README. Keep its
   visible fixture banner and metadata. It does not prove live access, server
   permissions or provider behavior.

   The separate failure matrix uses the same isolated preview and rejects local
   requests. It captures 78 English/Arabic phone, tablet and desktop views:

   ```sh
   GUIDE_FIXTURE_ORIGIN=http://127.0.0.1:3203 node scripts/guide-preview/capture-failures.mjs
   ```

   This matrix covers retained files and drafts, sign-out retry, invalid totals,
   support limits and admin authentication errors. Setup images show empty
   password and token fields. They do not prove account creation or live failure
   recovery. Inspect each original PNG and retain `failure-captures.json`.

   Approved sample prices have a separate read-only capture command:

   ```sh
   GUIDE_PRICE_LOCAL=true GUIDE_BASE_URL=http://localhost:3100 pnpm --config.verify-deps-before-run=false exec jiti scripts/capture-price-guide.mts
   ```

   Use the approved isolated local app and its matching configured loopback port
   (3115 for the 12 October layout review), with local Convex data on ports 3210/3211. This capture workflow does not access cloud deployments.
   The explicit local mode requires loopback HTTP origins and matching site
   settings in `.env.local` and the private
   `.convex/local-acceptance/backend.env`. Add `--check-config` to validate
   those settings without starting a browser. This capture command does not
   create sample data.

   A fresh anonymous browser opens the public board and one history dialog.
   The script checks all 26 approved catalogue rows by exact code and English
   name. In isolated local mode only, it also permits the two explicitly named
   synthetic acceptance materials, `LOCAL-PAPER-BYPRODUCT` (Local test paper
   offcuts) and `LOCAL-PAPER-UNCLASSIFIED` (Local test unclassified paper).
   It rejects missing, duplicate or unrelated rows and records the actual row
   count. It checks keyboard navigation
   and matching chart/table sample counts within the rolling 30-day window.
   It blocks HTTP writes and Convex mutations/actions before forwarding traffic.
   `price-captures.json` records the exact origins, local environment, source
   hashes and available sample count. Label these images as current local demo
   data, not hosted production UI or verified market quotes. Keep disconnected
   loading/unavailable screenshots as separate evidence. The original fixed
   cloud target remains available only when local mode is unset; it is not part
   of the current local capture workflow.

4. Capture analytics controls with fake keys and external requests intercepted:

   ```sh
   NEXT_PUBLIC_TELEMETRY_ENABLED=true NEXT_PUBLIC_GA_MEASUREMENT_ID=G-LUMATEST NEXT_PUBLIC_POSTHOG_KEY=phc_luma_test NEXT_PUBLIC_SENTRY_DSN=https://public@example.invalid/1 SENTRY_AUTH_TOKEN= pnpm exec next build --webpack
   GUIDE_CAPTURE=true pnpm exec playwright test --config playwright.analytics.config.ts
   ```

   The dedicated production server uses port 3106. Rebuild with normal
   deployment settings after this test. These test keys belong only in this
   local build. The capture writes English and Arabic browser PNGs and
   `analytics-captures.json`. No live analytics account is used.

5. Build the Word document. In Codex, resolve the bundled Python runtime with
   `load_workspace_dependencies` and use it for all document work. Set
   `GUIDE_PYTHON` to that absolute executable path, then run:

   ```sh
   "$GUIDE_PYTHON" scripts/build-user-guide.py
   ```

   The dependencies are listed in `scripts/user-guide-requirements.txt`. For
   work outside Codex, install them in a project virtual environment. The
   builder needs no external account, app secrets or font download.

6. Before a Google Docs import, run the Documents skill title sanitizer. Use
   the `scripts/google_docs_title_sanitize.py` from the installed Documents
   skill. It must report no title borders. The builder sets the Title and
   heading styles to black and does not add decorative rules.

   ```sh
   "$GUIDE_PYTHON" "$DOCUMENTS_SKILL/scripts/google_docs_title_sanitize.py" output/docx/luma-green-user-guide.docx --out /tmp/luma-green-title-check.docx
   "$GUIDE_PYTHON" "$DOCUMENTS_SKILL/scripts/google_docs_title_sanitize.py" /tmp/luma-green-title-check.docx --check
   ```

   The sanitizer should make zero changes to this builder's output. Use the
   sanitized copy for a native import. If it changes document content or styles,
   fix the builder and rebuild before recording review.

7. Render the DOCX with the Documents skill `render_docx.py`. In Codex, use the
   bundled LibreOffice only. The renderer selects it from the bundled Python
   runtime; do not use a desktop LibreOffice installation.

   ```sh
   "$GUIDE_PYTHON" "$DOCUMENTS_SKILL/render_docx.py" /tmp/luma-green-title-check.docx --output_dir /tmp/luma-user-guide-review
   ```

   Inspect **every** page PNG at full size. Check headings, page numbers,
   captions, tables and screenshots. Text extraction alone cannot prove visual
   quality. Fix clipped text, blank images or unreadable tables and render again.
   Rendered PNGs and any temporary rendering PDF are review files, not published
   guide outputs.

8. Only after all pages pass inspection, record the actual page count. For
   example, replace `N` below with the number of reviewed page PNGs:

   ```sh
   "$GUIDE_PYTHON" scripts/build-user-guide.py --record-review N
   "$GUIDE_PYTHON" scripts/build-user-guide.py --check
   pnpm exec vitest run src/user-guide.test.ts
   ```

   A rebuild resets the visual review record to pending. The freshness check
   fails until review is recorded for that exact DOCX hash. Run the normal
   required repository checks. Commit Markdown, captures and manifests,
   `build.json` and DOCX together. Hash checks detect stale artifacts; they do
   not decide whether product behavior was described correctly.

## Google Docs copy

The 12 October platform layout update is pending cloud publication. No connected document session was available. The existing document ID and sharing settings are preserved; `cloud.json` retains the last verified revision. Read `build.json` for the current reviewed local Word artifact.

Current publication state is recorded in [cloud.json](cloud.json). The existing
native [Luma.Green platform user guide](https://docs.google.com/document/d/17B40PdN8IyvydXhAH4r2nsfgy9Nt15cyzW5WZw6ecFY)
contains the verified **7 October 2026 publication** from the then-reviewed
Word source. Its document ID, folder and sharing settings are unchanged. Earlier
verified revisions remain in `cloud.json` as historical evidence.

The last published Word source has 167 pages. The native document has 147 screenshot
placements, 12 tables and 12 native date fields. Readback checked the source body,
table cells, date values, image source order, captions and dimensions. All 170
pages of the final native PDF passed review: 161 originals were inspected at full
size, and nine unchanged pages match previously inspected originals byte for byte.
All page hashes match the review ledger. Native font and pagination differences
mean this is not a pixel-identical Word copy.

The final native review retains two minor notes: page 61 has “buyer s decision”
without an apostrophe, and the narrow “Step” table header wraps on pages 165–168.
The text remains readable. One 10 October 2026 launch date chip uses regular
weight instead of the bold Word phrase; its native identity and date are
unchanged. This accepted display exception and the native image-alt limitation
are recorded in `cloud.json`. Guide publication does not prove live email, SMS,
payment-provider acceptance, admin setup or signed native releases.

The supported update uses revision-guarded Google Docs batch requests. Compare
the current native revision with the last verified record first, and preserve or
reconcile later human edits. Keep the tab, footer and table structures, apply the
reviewed changes in bounded batches, and use committed screenshot bytes or
immutable source URLs. Preserve unchanged image objects. Verify all body text,
table cells, dates, headings, styles and image placements after writing. Export
the native PDF and inspect every page before recording the new source hash,
native revision and publication status.

Native image accessibility remains incomplete. All 147 images have visible editable
captions but lack native alt-text descriptions. The current batch-update API has
no description setter. A checked `replaceImage` request kept the existing object
ID, size and uncropped bounds, but removed the one description previously restored
through the native editor. Its exact text is saved in `cloud.json` for a later
supported editor repair. Native browser editing stayed stopped to avoid interrupting
the user. Verify descriptions after any replacement; do not assume they survive
or claim that captions provide identical image-alt semantics. See the
[request schema](https://developers.google.com/workspace/docs/api/reference/rest/v1/documents/request).

The connected `google_drive_import_document` action creates a new document and
is only for the first import. `update_file` cannot replace a native Google Doc
with raw DOCX bytes. Neither is the in-place update path. Do not create a
replacement document or change the existing link or sharing settings.

For the first import only, use the sanitized and visually reviewed DOCX with
`google_drive_import_document` and `upload_mode: "native_google_docs"`. A manually
uploaded Word document opened in Google Docs creates a different copy; it does
not update this guide. Any edits made in the native document must return to
`guide.md` before the next local rebuild. No automatic cloud synchronization is
configured.

## Screenshot and privacy rules

Use test data only. Exclude passwords, authenticator setup keys and QR codes,
backup codes, real IDs and customer records. Keep screenshots unchanged.
Explanations belong in captions and guide text. Do not use AI-generated UI,
redrawn controls or silent image substitution. Generated decorative artwork
already in the app can appear in a browser screenshot of that app.

Capture manifests record routes, capture times, source revision, provenance and
image hashes. Disconnected pages and synthetic component fixtures have different
evidence strength. The Word document labels each. Replace protected-screen
fixtures with authenticated staging captures when access is available. Never
silently relabel a fixture as live.

This guide is an operational manual. It is not proof of launch readiness. See
[the handoff](../delivery/handoff.md) for deployment, account, provider and signed
native release gates.

The `impact-unknown-*` capture matrix uses the explicit `unknown-factor`
synthetic scenario: recorded grams remain visible and CO₂e is unavailable.
`account-phone-blank-*` and `account-phone-verified-*` are named fictional
email-account states; they prove layout only and reject every account write.
The separate `scripts/capture-admin-guide.mts --capture` authenticates the
approved local admin with its real password and TOTP. It captures catalogue
setup, payment setup and a blank vendor dialog, with provider calls and business
writes blocked. Its manifest requires visual review before publication.

### Workbook workflow captures

After the final connected browser tests pass and the source is frozen, run:

```bash
pnpm exec jiti scripts/capture-workbook-guide.mts --capture
```

The separate `workbook-captures.json` covers the new manual route planner,
material definitions/scope/destinations, production recipes/batches, sourcing,
quality files and recipient-specific audit reports. The maintained case list is
`scripts/workbook-guide-plan.ts`: 18 business/account states in English, Arabic
and Kannada × light/dark × 390/768/1440, plus three English-only admin states at
both themes and all widths (342 originals). It uses real approved local email
sessions and admin TOTP. It creates no business records, grants, uploads or
provider requests. Blank forms and retired/withdrawn test states remain honest.

The privacy guard checks each visible region before capture. It permits only the
explicit synthetic run-reference prefixes used by the connected tests to carry
a 13-digit test timestamp; it does not alter pixels or permit account/contact
values. The runner saves no session, tracing or video. Original images and the
complete source fingerprint must pass manual visual review. `src/workbook-guide.test.ts`
requires that review and fails while the manifest is absent, pending or stale.
The final 7 October matrix contains 342 reviewed views and no skipped views.
Its two freshness tests pass. The manifest records source and original-image
hashes; these local captures do not prove production access or provider delivery.

## Investor demo import and screenshot compatibility

The separate [investor walkthrough](../investor-demo/README.md) describes the
new fictional demonstration dataset. Credentials belong only in the restricted,
ignored annexes; they must not enter this guide or the shared Google document.

The investor import adds internal operator functions, bookkeeping tables and a
server-only configuration accessor. It does not change the screens, translations
or ordinary sign-in controls shown in this guide. The lots, refinement and
workbook manifests retain their original capture source snapshots, capture dates,
pixel hashes and visual review times. Their explicit source compatibility reviews
bind the unchanged screenshots to the additive code changes. These are existing
local captures, not new investor-environment captures or hosted execution proof.
See [the compatibility record](investor-source-compatibility.json) for the exact
source hashes and evidence limits.

The Word guide was rebuilt after the metadata update. Every ZIP member payload
matched the reviewed original, so its exact DOCX bytes and 167-page review were
retained. `build.json` records that comparison and the new input hashes. The
Google document body is unchanged; its prior publication verification remains
historical evidence rather than a claim of a new cloud update.

A later exact-session logout repair changes the sign-out transition, while the
static screens remain unchanged. Its compatibility review is separate from the
import-only review and preserves the first capture snapshot. Historical images
do not prove the repair: deferred-response auth regressions and new browser
sign-out checks supply that evidence.

The same static-state review also covers the shared sign-out helper in the admin,
failure, protected-screen and industry API capture manifests. Their original
source maps and screenshot bytes are retained. The synthetic failure screens
remain fixture evidence; the new real logout checks are recorded separately.

## 12 October layout evidence

The Impeccable layout release refreshes changed browser evidence from current source. The earlier investor compatibility record is retained as historical evidence only; it does not replace the new layout captures. The copied local test runtime uses port 3115 because another project owns port 3100. Capture guards still require matching frontend, credential and backend origins and loopback HTTP only.
