# Bobo's Big Recycling Day

Short English picturebook for ages 5 to 12, read with an adult. Sixteen pages include a cover, fourteen short story scenes, and a grown-up note. Each story scene has fewer than 60 words. Funny fictional characters explain the connected platform without presenting fictional material as app evidence.

## Sources and factual boundaries

- `output/docx/luma-green-connected-platform-specification.docx`, current 36-page revision, 28 October 2026.
- `docs/api/collection-operations-foundation.md`.
- `docs/api/household-receipt-sharing.md`.
- `docs/api/inventory-quality-foundation.md`.
- `docs/api/returns-claims.md`.
- `docs/api/service-programme-records.md`.
- `docs/api/processing-costs.md`.
- `docs/api/stock-closing-alerts.md`.
- `docs/api/account-removal.md`.
- `docs/api/assigned-worker-handover.md`.

The story covers households, adult handover helpers, Saathis, shops, centres, yards, processors, recyclers, manufacturers, buyers/sellers, business reviewers, support, partners and admin. It distinguishes receipt acceptance from payment acknowledgement, material movement from refunds, and enquiries/reported evidence from guaranteed benefits or official certificates. Outside-provider execution and mobile/store acceptance are not claimed.

## Build

Use the bundled Python supplied by `load_workspace_dependencies`, with ReportLab. Run `scripts/build-platform-storybook.py --draft` for illustration/diagram layout review. Drafts omit screen pages and carry a visible draft label. They are not final delivery.

The final build reads `screenshots.json`. It must say `verified_current_release`, and all six referenced captures must exist with evidence and caption fields. Protected fixture screens must say **Example screen - made-up data**. Their evidence must identify the isolated fixture boundary. A production public screen can use a release label only after root-agent verification. Do not use generated UI or old captures to satisfy this gate.

Final PDF: `output/pdf/luma-green-platform-storybook.pdf`. Build audit: `docs/storybook/review/build-audit.json`. Every included screenshot has a SHA-256 hash, source path, caption and evidence note in the audit.

## Artwork

The original six-panel PNG is preserved byte for byte under `images/`. The builder clips scenes inside the PDF; it does not edit or redraw source pixels. `images/generation-prompt.txt` contains the exact built-in generation prompt. `images/art-manifest.json` records tool and file provenance. Fictional art is distinct from screenshots. No guessed model name is recorded.

## Review sequence

1. Source review: specification, collections, sharing, returns and services checked against the short story.
2. First visual iteration: ten illustration/diagram draft pages rendered and inspected. A diagram/text collision guard caught one too-strict threshold, which was adjusted to the actual geometry before successful rendering. Text, gutters, scene clipping, diagram labels and page numbering were checked.
3. Final evidence iteration: all six originals were approved. All sixteen final PDF pages were rendered and inspected. Screenshot detail positioning and the material-record context were revised, then rechecked. Both PDFs have six visible made-up-data captions and no draft labels. All eight Word pages were rendered and inspected; inherited title borders were removed and the final page images were verified.

The refreshed sixteen-page storybook and ten-page editable screen companion are built and visually reviewed. They include account removal and assigned-worker collected-versus-received evidence. `review/final-review.json` records exact output and page-render hashes. The previous revision is preserved in the owner's Downloads folder under `Luma_Platform_Planning/Previous_Artifacts_2026-10-28`, outside Git.

The builders use the frozen `approved-book-captures.json` selected-image receipt. Each included image must have passed visual review and match its exact PNG hash. All captured source hashes must still match. This is selected-image approval; the separate full capture-matrix review is not a document claim. These examples do not prove Production deployment, real authentication, account closure or provider execution.

## Editable screen companion

`scripts/build-platform-screen-walkthrough.py` creates the short editable
`output/docx/luma-green-screen-walkthrough.docx` from the same approved captures.
It introduces eight key screens in ten pages. The Word file embeds the original
PNG bytes and uses a document viewport for readable detail views. Captions keep
the made-up-data boundary visible. It does not replace the existing platform guide.
Both builders reject changed screenshot evidence or app source after capture.
