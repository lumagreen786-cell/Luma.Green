# India jurisdiction reference contract

This contract covers a read-only pollution-control authority reference for each
state and Union Territory in `convex/lib/geography.ts`. It supports reference
selection and review. It does not grant an account capability, establish a
facility permit, select an eligible receiver or allow regulated dispatch.

The implementation is limited to `convex/data/indiaJurisdictions.ts` and its
unit tests. It introduces no database table, schema change, query, mutation,
network request or persistence. The coordinator owns UI integration.

## Canonical names and lookup

Reuse `INDIA_STATES_AND_UTS` as the only ordered jurisdiction-name list. Its
36 names match the [official Integrated Government Online Directory](https://igod.gov.in/sg/states)
as exposed by the official-source search result retrieved on 18 November 2026,
with existing application capitalization. Direct retrieval of that page timed
out; the National Portal's dynamic directory did not render its rows in the
direct text response. Do not describe either endpoint as live-tested here.
The [Ministry of Home Affairs Union Territories page](https://www.mha.gov.in/union-territories-divisions)
also identifies the eight current Union Territories.

Export `INDIA_JURISDICTIONS`, an ordered read-only array with exactly one entry
per canonical name. Export `getIndiaJurisdiction(name: string)`, which returns
the matching entry or `null` for an unknown or noncanonical input. It performs
no case conversion, address inference or retired-name aliasing. The existing
city parser remains the owner of city/state input normalization.

Export `INDIA_JURISDICTION_COVERAGE`, derived from the entries, with `total`,
`directoryListed` and `needsReview` counts. An unresolved entry stays in the
array and in the review count. It must not disappear from selector coverage.

## Entry fields

| Field               | Meaning                                                                                                                                                                                              |
| ------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `jurisdiction`      | Exact name from the existing geography owner.                                                                                                                                                        |
| `authorityName`     | Authority name reported by the attributed official source, or `null` if no source establishes it. This is not a legal determination.                                                                 |
| `authorityUrl`      | Authority site or official authority-information URL supported by that source, or `null` if unestablished. Preserve listed HTTP URLs; do not invent an HTTPS endpoint or claim transport acceptance. |
| `sourceUrl`         | Official source that supports the authority name and/or listed URL.                                                                                                                                  |
| `sourceLocator`     | Table row, directory entry or page reference needed to find the source statement.                                                                                                                    |
| `sourceAsOf`        | Source's stated as-of or update date, or `null` where absent. This is not a permit effective date.                                                                                                   |
| `retrievedOn`       | Date the source was retrieved for this record.                                                                                                                                                       |
| `reviewStatus`      | `directory_listed` or `needs_review`, as defined below.                                                                                                                                              |
| `reviewNote`        | A source disagreement, territorial exception or missing fact requiring attention; otherwise `null`.                                                                                                  |
| `supportingSources` | Additional official source URLs and locators for an exception; empty when unnecessary.                                                                                                               |

`directory_listed` means an official source supports the reference name and
URL. It does not mean the linked website passed a live availability check, the
authority confirmed a submission API or a qualified reviewer accepted an
industry, process or facility. `needs_review` means an unresolved official
source conflict or missing authority fact is retained visibly. Operational
permissions continue to use existing private review and access owners.

## Sources and territorial exceptions

The primary authority website source is the [CPCB SPCBs and PCCs directory](https://cpcb.gov.in/spcbs-pccs/),
which states an update date of 27 April 2026. It has 35 website rows. The
linked [CPCB authority directory PDF](https://cpcb.gov.in/uploads/SPCB_Directory.pdf),
described by the directory page as current on 1 April 2026, also lists the
Ladakh Pollution Control Committee at entry 14, printed page 4.

Keep one entry for **Dadra and Nagar Haveli and Daman and Diu**, matching the
current merged jurisdiction. CPCB's committee name puts the former territory
names in a different order; retain that reported name and explain the match.
The [merged Union Territory's committee page](https://ddd.gov.in/pollution-control-committee/)
provides a second official source. Do not create separate former-territory rows.

Keep **Ladakh** separate from **Jammu and Kashmir**. The Ladakh entry uses the
CPCB PDF and the [Ladakh administration's committee page](https://ladakh.gov.in/document-category/ladakh-pollution-control-committee/).
Its absence from CPCB's HTML website table is not evidence that it has no
committee or shares another jurisdiction's authority.

The **Jammu and Kashmir** entry remains `needs_review`: the CPCB website table
and PDF use the older State Pollution Control Board name, while an
[official J&K government order](https://singlewindow.jk.gov.in/uploads/files/act_0528476001658560319.pdf)
uses J&K Pollution Control Committee. Preserve the directory name and website
with both sources. Do not silently turn the conflicting reference into a
current legal finding. CPCB's regional-directorate group headings describe its
own regional coverage; they do not establish a shared state/UT permitting board.

This snapshot has 36 entries: 35 `directory_listed` and one `needs_review`.
The count describes reference review only. It is not regulatory completeness
or nationwide operational acceptance.

## Verification and monitoring

Tests must cover all 36 canonical names exactly once, canonical ordering,
provenance/date fields, public HTTP(S) URLs, visible unresolved counts,
unknown input, the merged territory and the separate Ladakh/J&K records.
No unit test contacts an authority website or claims legal completeness.

This reference-only change needs no new PostHog event or Sentry hook. It
contains no private workflow data and performs no provider call. Existing
public analytics exclusions and scrubbed error reporting remain in force.
