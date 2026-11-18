# National industry reference

Status: implementation contract, 18 November 2026.

## Scope and source

Use MoSPI's final NIC 2025 as the national economic-activity reference. Keep
the supplied 419 workbook sector records and their IDs separate. A NIC code
does not establish a waste classification, permit, processing recipe, price,
credit entitlement or facility permission. It does not map a workbook sector
to an official activity without separately reviewed evidence.

The official [release](https://www.pib.gov.in/PressReleasePage.aspx?PRID=2191142)
is dated 18 November 2025. Source files, retrieved 18 November 2026:

- [Final workbook](https://www.mospi.gov.in/uploads/publications_reports/publications_reports1763618655097_29a4a622-fa4c-47e9-abba-b549e27a1bbb_NIC_2025.xlsx):
  SHA-256 `ad3b8f24a40de5650c9fa8d06a36940c6e3c5d159d4f82d6c5cb3740d4e324c0`.
- [Final publication](https://www.mospi.gov.in/uploads/publications_reports/publications_reports1763457214315_c3e5d4f3-8e25-4775-85e3-ad42d571652f_NIC_2025_Final.pdf):
  SHA-256 `66bc2babc1e915b670b21a66d556c2933b97f72d9590a50cc535c5e9239fe709`.

The workbook's `All` sheet has 3,150 rows. Columns A, B and C contain group,
class and subclass codes; D contains their descriptions. Section and division
headings are text in A and B. Preserve leading zeroes and exact code lengths.
Only whitespace is normalized in English source titles. Explanatory notes
remain in the linked publication; they are not additional industry records.

## Source discrepancies

Retain all verified activities and record differences between the sources:

| Level    | Official release | Workbook headings | Reconciled hierarchy |
| -------- | ---------------: | ----------------: | -------------------: |
| Section  |               22 |                22 |                   22 |
| Division |               87 |                86 |                   87 |
| Group    |              257 |               257 |                  258 |
| Class    |              463 |               463 |                  463 |
| Subclass |            1,887 |             1,887 |                1,887 |

The workbook omits division 38's heading. The PDF broad structure names it
on printed page 20, physical page 40. The detailed heading is on printed page
122, physical page 145. The workbook also omits group 108 before class 1080
at row 434. The PDF broad structure names group 108 on printed page 16,
physical page 36. Import these two parent headings from that PDF. The PDF's
broad structure has 258 distinct groups. Keep the release's reported 257 as a
source discrepancy; do not remove group 108 to force a matching count.
The metadata also lists six heading-wording differences between the two
official files. Preserve the workbook's title and record the PDF alternative;
do not silently correct spelling or treat a different title as a new code.

## Pure helper contract

`convex/lib/nationalIndustries.ts` exports:

- `NATIONAL_INDUSTRY_LEVELS` and `NationalIndustryLevel`: `section`, `division`,
  `group`, `class`, `subclass`.
- `NATIONAL_INDUSTRY_SOURCE`: version, source URLs and hashes, source language,
  reported/workbook/reconciled counts and source discrepancies.
- `getNationalIndustry(code)`: the exact record or `null` for an unknown code.
- `searchNationalIndustryReference({ search, level?, parentCode?, offset? })`:
  a page with `sourceVersion`, `sourceQuality`, `sourceLanguage`, `total`,
  `nextOffset` and `items`. Default level is `subclass`; the fixed page size is 25. Search is case-insensitive and matches all space-separated terms across
  the record's code, English title and ancestor codes/titles. Empty search
  lists the selected level. An exact known parent includes descendants and
  excludes the parent itself. A parent does not change the selected level.

Input search length is at most 200 characters. Offset is an integer from 0
through 10,000. A malformed level, unknown parent or invalid input throws the
existing `INVALID_REFERENCE_SEARCH` error. A valid offset beyond the result
set returns an empty page. No result is silently truncated into a different
industry or reference level.

Each record has `code`, `title`, `level`, `parentCode`, `sectionCode`,
`divisionCode`, `groupCode`, `classCode` and `source`. Missing ancestors use
`null`. `source` has `kind` (`workbook` or `pdf`), `sheet`, `row` and
`printedPage`; inapplicable source locators use `null`. Source rows refer to
the original workbook, including its heading rows.

This helper has no database access, mutation, provider call or account
permission. The API owner must retain normal workspace authorization. Source
titles remain English reference text; interface controls use localized copy.
The authenticated query adds `sourceWorkbookUrl` and `sourcePublicationUrl`
from the pinned source metadata. The client reads a bounded page; it does not
import the full national catalogue into its JavaScript bundle.
No new PostHog event or Sentry hook is required for this static lookup. Private
facility selections and search text must not enter analytics or error exports.

## Authenticated API and facility selection

`industryReference.nationalSearch` accepts the helper's `search`, optional
`level`, optional `parentCode` and optional `offset`. It requires current
workspace read access and returns the helper's validated page, including
version, reference quality and language. It does not disclose facilities or
make a registration decision.

`industrialProfiles.save` accepts optional `industryActivityCode`.
Omission preserves an existing selection when editing. `null` explicitly
clears it. A string must resolve to an exact six-digit NIC 2025 subclass.
The server derives the stored `industryActivity` snapshot from the committed
reference: `code`, `title`, `sourceVersion: "NIC-2025"`,
`sourceQuality: "official_reference"`, `workbookSha256` and `pdfSha256`.
The caller supplies neither the description nor the provenance hashes.
Normal workspace permissions, audit logging and facility revision checks
continue to apply. Activity selection remains self-declared and does not
activate a capability or replace the separate workbook sector selection.

## Reproducible import and checks

Run `scripts/import-national-industries.py WORKBOOK PDF [--output PATH]` with
the existing bundled document Python runtime. It uses `openpyxl` (already
used by the workbook importer) and `pypdf` from that runtime. These are
offline import tools, not new application dependencies. Source hashes must
match before parsing. The script checks all levels, unique codes, parent
prefixes and all 1,887 subclass rows, then writes deterministic JSON. The
committed JSON needs no spreadsheet or PDF library at build or runtime.

Tests cover source counts/discrepancies, all ancestors, leading zeroes,
source locators, all 22 sections, search, descendant filters, pagination,
malformed inputs and the absence of operational permission fields. Import
reproduction must match the committed data after standard JSON formatting.
The PDF's printed/physical page locators were checked against its extracted
page structure. This is source verification, not a facility or regulator test.

## Reuse and concordance limits

Keep MoSPI attribution and both official source links visible. The
[MoSPI copyright policy](https://www.mospi.gov.in/CopyrightPolicy) permits
accurate attributed reproduction and describes Category A reuse under GSDD 2026. No separate NIC-specific SPDX or dataset licence was found in these
files. Do not label the catalogue public domain or remove third-party
restrictions. The policy is recorded as a source, not an invented licence.

The PDF's printed pages 232–238 contain a four-digit NIC 2025/NIC 2008
concordance. Partial and aggregated relationships are explicit there. This
slice does not import that crosswalk or infer six-digit subclass matches.
Original NIC 2008 codes remain versioned separately wherever used.
