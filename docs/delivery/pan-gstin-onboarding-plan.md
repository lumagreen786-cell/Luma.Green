# PAN GSTIN onboarding implementation plan

Goal: business applicants enter PAN, list linked GSTINs, select an active registration, then see/confirm business details through the existing GST check.

Owner scope: registered kabadiwalas, yards, recyclers and manufacturers only. Saathis, households and admin excluded. This bounded implementation is authorized by the 26 October request; full PAN enrichment, raw payload storage and IRN integration are deferred.

Contract: docs/api/pan-gstin-discovery.md. Reuse existing optional draft PAN fields. Preserve the server confirmation/submission gate; discovery alone never proves a business name/address or unlocks registration. Current provider discovery only returns GSTIN, state, state_code and active_status. Display those honestly. Use the existing selected-GSTIN detail check to show name/address when available; do not fabricate them or bypass its unavailable state.

## Tasks

- [x] Backend: add bounded parser and discovery proof fields; authenticated verified-phone lookup/query/selection functions. Draft source PAN, editable owned business only, exact match PAN and embedded GSTIN PAN, duplicate ambiguity rejection, active selection only. Reuse account 20/day quota, cache, timeout and no paid retries; guard late responses against changed drafts. Test auth, exclusions, stale input, malformed/mismatch/empty/inactive/multiple results and quota/cache. No new provider calls during tests. Same-day update: use the now-active fixed GSTIN Advanced detail endpoint and its nested principal address when the top-level address is null. Retain exact-match and confirmation gates.
- [x] Frontend: shared PAN discovery component integrated into business and registered shop forms. Save draft before lookup; visible consent, results and explicit selection. PAN changes invalidate selected GSTIN confirmation; selection writes server draft and mirrors form. Preserve input/reload/back behavior and existing detail-check gate. Use Astryx actions and shared inputs. Add translated copy in all 33 catalogues and meaningful component/e2e tests. No native changes.
- [ ] Verification/review: run focused red/green tests, pnpm check, production build if feasible, fixture browser matrix in English/Arabic/Kannada light/dark phone/tablet/desktop; inspect actual images. Review spec then code/security. Record evidence/provider limits and deferred guide impact. Commit/push only after required checks; no Preview deployments.

## Additive storage and rollback

Add optional registration-list fields to identityChecks; use existing pan kind with explicit new provider gstin_by_pan to distinguish historical rows. No deletion or backfill. Store only bounded discovery fields, not unrelated identity data. Cache proof 24h, never log PAN/GSTIN or provider payloads. Preserve existing records. Rollback disables Surepass calls before reverting functions; extra optional fields are harmless until a reviewed schema removal. Update data inventory. New full identity retention work is outside this bounded request.

## Verification ledger

- Production recheck: GSTIN Advanced now Active; standard GSTIN, IRN and the
  other PAN variants remain unsubscribed. One Advanced published-sample call
  returned active matching business details. Observed balance reduction INR4.13.
- Total observed operator spend across three authorized sample calls: INR9.44
  of INR100. No retries or applicant records.
- Initial backend review found missing selected-GSTIN persistence and empty
  positive-proof handling. Implementer corrected both and expanded tests.
- Legacy PAN compatibility uses an optional server-owned application flag.
- Auto-review rejected test dependency links inside held native paths. No native
  paths changed. Run web checks in this checkout; native compatibility may be
  checked in the unchanged primary checkout without changing those sources.

- Final review found optional-PAN abandonment and an in-flight registration-toggle
  recovery defect. Decision: clearing optional PAN restores direct GST with the
  unchanged detail/confirmation gate; eligibility loss settles the reservation
  as failed and always writes a safe completion audit. Regression tests added.
- Visual checks: 18 synthetic browser matrix cases passed (en/ar/kn, widths
  390/768/1440, light/dark). Six current result captures visually inspected across
  both business/shop forms. They establish layout and mocked interactions only.
- Web production webpack build and web/backend type checks passed. Full first
  suite had 3 outdated no-PAN assertions; after correction 2,563 tests passed.
  Later recovery fixes require the final focused/full checks before release.
- Native compatibility tests (50 mobile,23 desktop) and types passed on the
  primary checkout at that time. The primary checkout later received unrelated
  native edits; preserve them. Native lint is not validated for this branch:
  isolated dependencies are unavailable, and no native path change is authorized.

## Final local results

Final full suite: 299 files, 2,566 tests passed. Affected recovery/Advanced
regressions: 26 passed; all changed-code lint and web/backend type checks passed.
Production webpack build passed all 3,119 routes. All18 synthetic browser cases
passed. Current en/ar/kn captures visually inspected in both themes at all widths.
Repository formatting passed. No native source files changed on this branch.

Convex development deployed successfully to proper-caterpillar-111, with no
index deletion. The deploy also added two existing-main indexes missing remotely
(householdPhotos.by_storage and orgs.by_application); these are additive baseline
synchronization, not new feature indexes. Confirmed SUREPASS_ENABLED=false on
development after deployment. No paid development requests ran.

Production deployment and real-applicant acceptance are not established. Surepass
browser sample acceptance is separate from execution from Convex production.
Translations are machine drafted and still require native-speaker review.
