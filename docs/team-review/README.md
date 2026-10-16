# Team review pack maintenance

The editable Word pack combines the product review, team test manual, proposed
six-month plan and India legal preparation checklist. It is a team review aid,
not a completed test report, provider approval or launch authorisation.

## Sources and output

The builder reads these sources in order:

1. [Product review](review.md).
2. [Team end-to-end test manual](../testing/team-end-to-end-manual.md).
3. [Six-month execution plan](../product/six-month-execution-plan.md).
4. [India legal preparation](../operations/india-entity-trademark-and-legal.md).

The output is `output/docx/luma-green-team-review.docx`. The build record is
`docs/team-review/build.json`. [The builder](../../scripts/build-team-review.py)
imports `configure` and `inline` from the existing user-guide builder. It does
not change or rebuild the user guide.

Headings, paragraphs, lists, tables and links remain editable. The document uses
Letter portrait pages, black headings and a plain Word Title style. Relative
repository links resolve through `scripts/document_links.py` to clickable
absolute GitHub `main` links. External source links are also clickable labels.
The Markdown keeps the full destination paths and URLs.

## Browser screenshots

Put original browser PNGs in `docs/team-review/screenshots/` and record the
capture evidence in `screenshots/manifest.json`. Include the route, viewport,
theme, locale, build/revision, evidence lane and file hash. Do not capture
secrets, credentials, personal contacts or live identity records. Label fixture
and disconnected-preview evidence correctly. A screenshot does not prove a
provider request, authentication or backend mutation.

Use a descriptive caption as each image's alt text. For a side-by-side pair,
use exactly two Markdown image lines inside these markers:

```markdown
<!-- pair -->

![Home in light mode at a 390 by 844 browser viewport.](screenshots/home-light.png)
![Home in dark mode at the same browser viewport.](screenshots/home-dark.png)
<!-- /pair -->
```

Pairs use approximately 3.1-inch columns. Very tall images can display smaller
to stay within the page. The builder changes display dimensions only; it does
not resize, crop, redraw or re-encode the source pixels. Captions stay with the
pair. A second consecutive pair begins a new page. The current comparison
sections, numbered 4–7, also begin on fresh pages. Section 8 begins a fresh page
after the image review. Matching `*-light.png` and `*-dark.png` captures must
have equal pixel dimensions; the reviewer must also confirm their manifest
viewport and route match.

The build checks that every screenshot is used and that the embedded image
bytes match the originals. Do not use generated interface pictures as evidence.
Decorative artwork visible inside a real browser screenshot remains valid when
the caption describes it correctly.

## Long test tables

Markdown tables with five or more columns become one editable record section
per data row. The first cell supplies its heading. Every cell then appears under
its original field label, including the exact test ID. This preserves setup,
steps, expected results and evidence without shrinking a six-column test matrix
to unreadable type. Smaller tables keep visible light-gray borders and repeated
header rows. Source fields are checked against the resulting Word text.

## Build and review gate

Use the Python and Node runtimes returned by the Codex workspace dependency
loader. Use the bundled Documents skill renderer and bundled LibreOffice; do
not install replacement packages or use the desktop LibreOffice application.
The commands below use task-specific variables for those resolved paths.

Immediately before the first authoring command, run the Documents skill's
artifact marker successfully **once** for this creation task:

```bash
"$TEAM_REVIEW_NODE" "$TEAM_REVIEW_MARKER" --operation-kind create --expected-output-count 1 --output-format docx
"$TEAM_REVIEW_PYTHON" scripts/build-team-review.py
```

`TEAM_REVIEW_MARKER` is the resolved
`container_tools/mark_artifact_operation_started.mjs` path. Preparation and
syntax checks do not create a Word artifact and do not replace this marker.

For a Google Docs-targeted copy, run the Documents skill title sanitizer before
rendering. The builder creates a border-free title; sanitizer checking should
report no change. If it reports a change, correct the builder and rebuild, so
the build record remains valid. Import only the reviewed DOCX through the
approved Google Drive import workflow. A local Word file is not a verified
Google Docs publication.

```bash
"$TEAM_REVIEW_PYTHON" "$TEAM_REVIEW_TITLE_SANITIZER" output/docx/luma-green-team-review.docx --check
"$TEAM_REVIEW_PYTHON" "$TEAM_REVIEW_RENDERER" output/docx/luma-green-team-review.docx --output_dir /tmp/luma-team-review-render
```

Inspect **every** `page-N.png` at its original size. Check title and section
hierarchy, all captions, screenshot legibility, case fields, table continuation,
page numbers, blank pages, clipping and overlap. Check every source claim and
the distinction between local, fixture, staging and provider evidence. Fix any
defect in its source or builder, rebuild, render and inspect again. PNGs are
review intermediates, not maintained deliverables.

Only after this inspection is complete, replace `N` with the actual reviewed
page count:

```bash
"$TEAM_REVIEW_PYTHON" scripts/build-team-review.py --record-review N
"$TEAM_REVIEW_PYTHON" scripts/build-team-review.py --check
```

`--record-review` records the reviewer's attestation. It does not inspect images
or infer a pass from XML. `--check` fails while review is pending. Every rebuild
resets the record to pending, even if an older document passed visual review.

The record hashes the four Markdown sources, this README, both builders, the
user-guide dependency specification, capture manifest, all referenced images,
and the offline demo manifest and coverage report. It also records the output
DOCX hash. Any changed input or output makes the record stale. Required-content
checks cover every source heading, paragraph, list entry, table cell and caption;
they complement the mandatory pixel review and cannot replace it.

Commit the current Markdown, screenshots, manifest, builder, build record and
reviewed Word output together. Record the exact test evidence separately in the
delivery handoff. This pack does not replace the mandatory platform user guide.

## UI redesign checkpoint — 15 October 2026

The entry-form redesign changes the signup page shown in the older captures.
The existing Word pack and images are retained as historical evidence, not
current UI proof. Its unchanged freshness assertions now run with the other
artifact checks in `pnpm guide:check`, when the owner requests a guide update.
Runtime and browser tests remain in the normal check suite.
