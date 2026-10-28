# India-wide web update and researched team inputs

Status: implementation and acceptance in progress, 29 October 2026. Not yet
released. Research snapshot: 28 October 2026. Baseline: main `b6bcd56`.
The foundation is already live; this record describes its separate follow-up.

## Owner outcome and implementation

The owner replaced the Bengaluru-only software limit with India-wide web
coverage, authorized public-source research, and requested a researched copy of
the team-input form. Keep Expo paused, desktop excluded, real authentication,
exact quantities, audit history and all payment/provider/compliance gates.
The shipped foundation's temporary record-deletion permission is not renewed.

- Capture city and state/UT explicitly through one shared locality control.
  The existing city field stores the canonical operational key. Preserve the
  documented Bengaluru/Karnataka pilot partition and existing records; do not
  infer state from addresses or reinterpret other old bare-city records.
- Partition household discovery and reference prices by that selected key.
  Existing radius, capacity, hours, expiry and manual-address review remain.
  No known local operator or price means unavailable, not national fallback.
- Allow ordinary eligible business offers across cities, with shared
  discovery/request eligibility and unchanged role, material, stock, evidence,
  payment and quality guards. Unknown freight remains unknown.
- Display dated official references in admin facility review, outside its
  approval form. Source selection changes no permission or operational state.
- Add private paper transcription evidence. Preserve original bytes and hash,
  optional model output and human-corrected content separately. Explicit
  confirmation changes no inventory, money, tax filing or permit. Manual mode
  works without model configuration. Paid extraction stays off without its
  separate flag, explicit allowance and per-image consent.

Contracts: [geography](../api/india-geography.md),
[references](../api/india-regulatory-references.md),
[paper drafts](../api/paper-transcription.md). Execution plan:
[research/readiness](../plans/2026-10-28-india-research-readiness.md).

## Research and team documents

Exa discovery requested 101 results across waste, carbon and supporting
geography/recovery searches. The deduplicated register has 37 unique URLs.
Requested results are not 101 independently read full documents. The register
records primary publishers, document/effective/retrieval dates, claims and
reading limits. It is not an exhaustive consolidated amendment or all-state
legal review. Failed retrievals do not establish live operation or API access.

- [Source register](../research/india-platform-2026-10-28.json).
- [All 53 labelled form answers](../research/india-team-input-answers-2026-10-29.json).
- Owner PDFs: `Luma_Green_Team_Inputs_Research_Filled.pdf` (editable), and
  `Luma_Green_India_Research_and_Decisions.pdf`, in the planning delivery folder.
  Keep the original blank form. PDF render, field readback and save/reopen
  evidence are required before delivery.

Answers distinguish public facts, existing decisions/guards, proposed defaults,
operator evidence, account inputs and unsigned approval. A filled field is not
permission, a signature, a verified facility or a successful live test.

The primary review establishes the SWM 2026 replacement, final plastics
amendment and legacy plastics portal migration. Waste streams and permits must
remain distinct. Current BEE methodology/offset procedure and CERC documents do
not authorize Luma to mint credits from material weights or operate its own CCC
exchange. The October transaction consultation is a draft. Official project,
validation, verification, issuance and registry evidence remain separate from
Luma's material and reported EPR/impact records.

## Verification and release gates

Initial integrated check: 352 suites passed; one admin price test still assumed
an implicit pilot city. Its explicit-city fixture and empty-selection regression
were repaired. This is a failed initial check, not a passing full run.

Independent paper review found a delayed-upload workspace race and a source
storage/attachment crash window. Bind the upload to its original workspace and
prevent dispatch after unmount. Store source chunks, record pointer, capacity
and upload allowance atomically in paper-owned database rows rather than
retaining an unrecoverable file-store boundary. Enforce retained-source caps;
never delete confirmed evidence merely to make room.

The fresh combined `pnpm check` passed 355 suites and 2,949 web/backend tests,
zero lint errors (122 existing warnings), both type checks, two real transport
tests and the existing 23 desktop/50 mobile policy tests. No native binary was
built. The local worker-limit setting now explicitly bounds this run to two
workers; an earlier superseded run was stopped after new regressions were
added during implementation. It is not counted as passing evidence.

Current isolated-component visual reviews passed 24 geography combinations
(English/Kannada/Arabic/Urdu, both themes, three widths), 72 paper scenarios and
the admin reference matrix. Captures are labelled synthetic fixtures and bind
source hashes. They do not prove authenticated Production access or a live
model. Both team PDFs passed all-page visual and reopened field/appearance
checks. The six-page updated account checklist also passed visual review.

Production build, hosted CI, backend deployment and Vercel Production checks
remain separate release gates; their actual state is recorded in the PR and
owner release receipt. Earlier foundation screenshots and provider mocks do
not prove these new gates passed.

## Combined-main release follow-up

Checked main updates through `f687bbb` are preserved in this release. Review
found that a city input on the public home page would keep its conservative
native restart guard blocked. The home price section links to `/prices`; explicit
city/state selection stays on that page. The guard is not relaxed. Full combined
checks and hosted rollout remain required. Backend dry-run passed with additive
paper indexes and no removed indexes. No native binary or paid provider call
is part of this release.

## Remaining external evidence

Actual facility permits, capacity, recipes, contracts, authorized recipients,
working contacts, qualified reviewers and legal applicability cannot be
invented from internet examples. Provider accounts, budgets, live delivery,
Cashfree merchant/vendor acceptance and a separate cloud restore still need
their real evidence. Official carbon execution needs an authorized external
process and access. National software availability does not guarantee local
collection or validated national-scale capacity.

GitHub owner email verification and saved main protection remain queued at the
owner's request. Continue checked PRs without bypassing checks. No Preview,
native release, paid service purchase or paid provider call is authorized.

## Final combined local checks — 29 October 2026

Combined main `f687bbb` checks passed: 356 suites and 2,948 web/backend tests,
zero lint errors (122 warnings), both type checks, two transport tests,
30 desktop policy tests, 59 mobile policy tests and 14 mobile component tests.
The Production build passed with 3,285 pages. Formatting and the committed
history secret scan passed. No native binary was built. Earlier stopped checks
and the memory-constrained browser run are not counted as passing evidence.
Hosted checks and actual Production deployment remain separate gates.
