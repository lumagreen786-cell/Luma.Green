# Afterlife operational pages — 18 November 2026

This record covers the operational routes assigned to the platform theme pass. It does not establish live provider delivery or authenticated acceptance.

## Page review and changes

| Route                        | Layout decision                                                                                      | Preserved controls and records                                                               |
| ---------------------------- | ---------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| `/app/billing`               | Open plan comparison with aligned prices; one plan-selection surface; separate draft and event lists | Integer paise, entitlement state, cancellation, reauthentication and billing-disabled notice |
| `/app/carbon-projects`       | Narrow creation rail; projects in an open ruled ledger; larger project titles                        | Screening, assignment, batches, snapshot revisions and unverified-evidence limits            |
| `/app/evidence`              | Record ledger beside a quiet export rail                                                             | Replacement references, export completeness and external-authority limits                    |
| `/app/facility`              | Facility identity and registration details share a clear two-column row                              | Site identity, capabilities, registrations and management access                             |
| `/app/facility` industry tab | Open search/results; no nested result panel                                                          | Source quality, reference details, limits and selection                                      |
| `/app/integrations`          | Open connection reference rail beside the key form and key history                                   | Credential reveal, rotation/revoke, grants and access checks                                 |
| `/app/logistics`             | Plans use aligned rows; revisions use a left-rule timeline                                           | Capacity, location data, exact mass, stop ordering and archive reason                        |
| `/app/lots`                  | Incoming, held and sent material use ruled rows                                                      | Pending quantities, custody states and source links                                          |
| `/app/lots/[id]`             | Open quantity strip; separate custody rail and transformation/disposition detail                     | Exact grams, quality checks, costs, evidence and provenance                                  |
| `/app/production`            | Recipes and batches use a single open list per tab                                                   | Ingredients, material balances, references and expandable input details                      |
| `/app/returns`               | Claims and supplier returns use two open ledgers                                                     | Trade references, decisions, quantity limits and permissions                                 |
| `/app/papers`                | Upload/history rail beside the source and editable paper content                                     | Original image, transcription, extraction consent, review and save rules                     |
| `/app/quality-documents`     | File rows and buyer review align without nested decorative panels                                    | File permissions, withdrawal, decisions and audit history                                    |
| `/account/reports`           | Open report lists and detail sections, one create form                                               | Snapshot limits, attachment permissions and decision history                                 |
| `/app/sourcing`              | Demand columns and recurring/supplier/agreement tabs use open ledgers                                | Due dates, material requirements, publication and closing actions                            |
| `/app/material-standards`    | Open filter rail, definition rows and destination ledger                                             | Source references, revision, review validity and permission boundaries                       |

The forms, supporting field components and dialogs were reviewed with their callers. Existing bounded form surfaces and open field groups were kept when they already fit the selected style. No business mutation, authorization check, quantity conversion or message catalogue was changed in this pass.

## Validation

- Scoped operational unit suites: 123 tests passed in 17 files on the final source (two workers).
- Scoped lint: no errors.
- The final production build completed. Its full browser run executed 950 cases: 931 passed, while 19 failed on obsolete presentation assertions. The motion case passed its focused rerun; all 37 showcase tests passed after updating the approved image sizing (including 14 failed cases). The four join-layout cases are being rechecked separately. No application source changed for these test corrections.
- Final current-build fixtures: 180 route checks passed (15 operational/report routes × English/Arabic × light/dark × 390/768/1440), plus 21 secondary-tab checks. No horizontal overflow or browser page errors. Captures and JSON receipts are in `output/design/afterlife-operations-captures/`. Desktop contact sheets for both appearances and Arabic phone contact sheets were inspected; API access, lot detail and Arabic carbon forms were also inspected at full size.

Synthetic fixture images are layout evidence only. Existing fixtures include empty record states for several routes. Live authenticated workflows, provider delivery and native-device acceptance remain separate checks.

## Monitoring and documentation

These are layout changes using the same actions and error boundaries. No new PostHog event or Sentry hook is needed. No data, form values, locations or record contents are added to telemetry. User-guide artifacts remain unchanged; the owner did not request a guide rebuild.
