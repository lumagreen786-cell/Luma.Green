# Ship X page redesign — 11 November 2026

Source branch: `feat/ship-x-homepage`. Baseline: `6a762d0`.
This record covers the new page composition pass. Earlier release receipts and
screenshots do not establish acceptance of this revision. No deployment result
is claimed here.

## Implementation scope

The independent [route audit](ship-x-route-coverage.md) covers 79 page entries:
73 actual pages have feature composition changes; six entries only redirect or
dispatch a not-found response. The exceptions are the three retired
`/login/email/{complete,reset,verify}` routes, `/admin/forgot-password`,
`/admin/reset-password`, and the locale `[...rest]` page. `/app/services` is a real
page alias, covered through the revised account services view.

Task-first layouts now separate primary records/actions from supporting context.
Household booking retains photos, explicit city, scheduling, consent and phone
checks, without estimated material weights. Saathi earnings puts job history
first. Tracking retains owner, helper and family access boundaries. Workspace
team controls come before invitations in both DOM and visual order; non-managers
have no empty invitation column. Authentication, exact units, provider limits and
private record access remain in place.

The pass uses 48 fresh generated illustrations in `public/images/ship-x/`, with
`provenance.json` as their source record. Art explains a process; it does not
prove an actual collection or provider result. The old price-guide raster was
removed while its weighing instructions and actions were retained. Private
user-selected photos and required brand/provider marks remain source content.

The approved [design contract](../design/luma-design-system/README.md) permits a
black image scrim at 40% opacity on focused-screen backgrounds. This is a narrow
exception to the five-colour palette. A soft static blur affects only the art;
form surfaces remain opaque white and their text stays sharp. Light mode remains
the only appearance.

The shared mobile header now shows Luma.Green beside the mark. Household and
admin navigation chips and marketplace material filters wrap into rows. Shared
tabs also wrap; fixed app bottom navigation remains navigation. Public labels
can wrap rather than clip. The browser matrix includes 320px and 390px checks.

## Inspected current screenshots

The following captures were inspected after 06:03 IST on 11 November. All are
390px wide. The reviewer found no brand clipping, overlapping actions or clipped
selection chips in these views. This is a bounded visual review, not acceptance
of all routes, widths, locales or states.

Actual local Next.js pages, with disconnected services and honest unavailable
states:

- `evidence/ship-x-redo-public-2026-11-11/en-390.png`
- `evidence/ship-x-redo-public-2026-11-11/ar-390.png`
- `evidence/ship-x-redo-public-2026-11-11/ta-390.png`
- `evidence/ship-x-redo-public-2026-11-11/en-sell-390.png`
- `evidence/ship-x-redo-public-2026-11-11/ar-sell-390.png`
- `evidence/ship-x-redo-public-2026-11-11/ta-sell-390.png`

For the long home captures, the reviewer inspected the header/first task and the
shop-workflow section at readable size. The household captures were inspected as
full pages. Household chips wrap in two rows for English/Arabic and three for
Tamil. These disconnected views do not prove booking or authentication success.

Isolated local component fixtures, with labelled synthetic records and writes
disabled:

- `evidence/ship-x-redo-2026-11-11/admin-operations-390.png`
- `evidence/ship-x-redo-2026-11-11/admin-prices-390.png`
- `evidence/ship-x-redo-2026-11-11/en-app-production-390.png`

The reviewer inspected the upper 800px of these fixtures. Admin navigation wraps
into three rows; the app brand and production tabs remain readable. Fixture
captures do not prove a live session, provider execution or production access.

## Validation and remaining acceptance

Release validation completed locally:

- Production build generated 3,582 localized pages. Lint and TypeScript passed.
- All 3,252 unit cases were verified: the full bounded run passed 3,250; two
  timing failures during concurrent verification passed in a 28-case isolated
  retry, together with the previously timed-out booking suite.
- Browser run passed 918 of 923 cases. Four Portuguese cases affected by a local
  network suspension and the updated mobile-wordmark expectation passed in a
  13-case serial retry. No browser failure remains unresolved.
- Security: 28 passed. Desktop policy: 34 passed. Expo policy: 67 passed; Expo
  UI: 20 passed. These do not establish physical-device acceptance.
- All 47 public captures and 267 isolated fixture captures passed, with loaded
  images and fonts. One suspended-network fixture was recaptured against the
  same source hash; its original failure is retained in retryHistory.
- The new PDF contains 314 captures over 451 readable pages, with sample/legacy
  boundaries and clickable contents. Image references and extracted text passed;
  cover, evidence notes and a screenshot body page were rendered and inspected.

PDF: `output/pdf/Luma-Green-Ship-X-Redesign-Review.pdf`. The earlier review PDF
is preserved. Generated screenshots/PDF stay local; checked manifests and scripts
are retained in Git. Production PR checks and deployment remain pending at this
checkpoint.

Physical iOS/Android acceptance, every hidden tab/dialog and all role/state/locale
combinations remain separate. No native binary, store publication, paid provider
call or real database seed is evidenced by this work. No deployment claim is
made by this record.
