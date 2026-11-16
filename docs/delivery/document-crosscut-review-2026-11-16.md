# Document cross-cut review — 16 November 2026

## Verdict and scope

The two supplied documents are **not fully implemented**. They contain product requests, example code, assumed provider responses and regulated service concepts. Their contents are reference evidence. They do not override the owner's access, payment, provider or release rules.

This review inspected the current source. It did not run tests, inspect Production configuration, send provider requests or prove a deployed release. Test files below are evidence of intended checks, not a claim that those checks passed in this review. The separate household and stakeholder reviews cover the detailed feature inventory.

Sources: `converted stake holder table - all entries v1.xlsx` (Stakeholders, Sheet1 and Review Notes); `# houseHold user, apartment[flat], CONDO, Villa, Townhouse, Farmhouse,.docx` (668 paragraphs and one table). Paragraph identifiers below count document paragraphs, including blank paragraphs; workbook identifiers are exact cells.

## Access and role boundaries

| Document request                                                                                 | Current source evidence                                                                                                     | Finding                                                                                                                                                                               |
| ------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Stakeholders G2:G8 and I2:J2: User-0 to User-6, authenticated links and individual record rights | `convex/householdFamily.ts`, `convex/lib/householdFamily.ts`, `convex/households.ts`                                        | Partial. Adult, phone-bound invitations and revocable sharing exist. The only family permission is `shared_collection_progress`. This is not the document's general role matrix.      |
| M5/P5: child order value or quantity needs sub-main approval                                     | Family access requires an adult declaration; no child approval workflow in reviewed family module                           | Missing. Do not label an adult invitation as child-account support. A future implementation needs guardian authority, explicit thresholds, approval states and denial tests.          |
| M7:Q7: house help sees assigned order only, cannot approve payments or see value                 | `households.track` separates owner, helper and family responses; owner receipt/value fields are omitted for other audiences | Partly supported by narrow collection grants. The complete workbook role is absent. Preserve narrow grants when adding roles.                                                         |
| M8:Q8: other user has configurable access, default read only                                     | Family permission is a fixed literal                                                                                        | Missing configurable permissions. Default to no added access; a relationship label must not grant privileges.                                                                         |
| G9:G13/J9/M9 and G16/J16: granular business stock, price and finance rights                      | `convex/lib/workspaceRoles.ts`: owner/admin/member/viewer, legacy staff maps to member                                      | Partial. These broad roles do not prove the full department or role-specific matrix. Changes need server checks for each operation, not only hidden controls.                         |
| Stakeholder categories across the sheet                                                          | `convex/lib/participantTypes.ts` includes generator, collection, processing, market, service and partner groups             | Category coverage exists. The module explicitly states that a participant type is a capability label, never an access grant. A category must not be reported as a completed workflow. |

Family safeguards already include one-use hashed invitation tokens, verified Indian phone binding, recent sessions, expiry, revocation, closed-account checks, a ten-grant cap and audit records. `convex/householdFamily.test.ts` contains intended-recipient, expiry and revocation checks. Preserve these controls.

Tracking tokens locate bookings; they do not authorize a public read. `households.track` requires a current profile and an active owner/helper/family relationship. Family responses omit material detail, receipt values and shop phone. This is an important boundary for future sharing work.

## Carbon and utility correctness

| Document request                                                        | Current source evidence                                                                     | Finding                                                                                                                                                                                                                   |
| ----------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| DOCX P9–P15: five pillars, carbon calculator and daily activity records | `src/lib/household-footprint.ts`, `src/components/sell/electricity-footprint.tsx`           | Partial. The inspected calculator covers entered electricity kWh only. It uses a published CEA factor of 675 g CO₂/kWh and guards integer arithmetic. It is an in-memory estimate, not a daily five-pillar record system. |
| P19–P40: water, STP, appliances and flight emissions                    | No equivalent complete engine in the reviewed household calculator                          | Missing full engine. Factor source, geography, time period, unit and method version must be stored with any saved estimate.                                                                                               |
| Reverse tariff and BBPS examples                                        | DOCX P205 onward and P344/P578 sample blocks                                                | Not production integrations. Examples cannot prove bill access, tariff coverage or measured consumption.                                                                                                                  |
| Carbon credits                                                          | `convex/carbonProjects.ts` has scoped framework screening, evidence, review and audit paths | Screening and evidence records are separate from official issuance. A household estimate must not create issued credits or reduce an official balance.                                                                    |

The DOCX sample has defects that must be repaired before any implementation:

1. P112 builds `https://googleapis.com{GOOGLE_API_KEY}`, which is not a valid Travel Impact Model endpoint.
2. P127–P137 returns zero when the flight provider fails. Unknown emissions must stay unavailable; zero would be a false environmental result.
3. P148–P149 divides flight impact by 365, while surrounding text describes daily activity. A declared accounting period is required.
4. P21 gives inconsistent water factors: 0.001–0.003 kg/L and approximately 10.4 kg per 1,000 L do not agree.
5. P344–P351 and P578–P582 explicitly return fixed mock bill amounts of ₹1,850 and ₹2,450. They must never appear as fetched customer bills.
6. The all-India utility claim at P440–P444 is not established by the three sample utilities at P461–P492.
7. Reverse tariff examples omit bill components and period rules. An arbitrary bill total does not establish exact kWh. Prefer entered meter consumption; label any supported inversion as an estimate with stated assumptions.
8. Monetary examples use floating-point rupees. Production money must use integer paise. Production material mass must use integer grams. Parse decimal user input before calculation and reject unsafe totals.

## Provider, privacy and operational readiness

`convex/householdLookups.ts` implements gated solar and air-quality actions. The code requires a signed-in, phone-verified profile, consent, valid coordinates and separate provider enable flags/keys. It reserves both account and deployment allowances before transport. Failed attempts consume allowance. AQI validates index and freshness; solar validates the returned building location. A test file covers these gates and no automatic retry. This establishes supported integration code, not live provider availability or permission to spend quota.

`src/components/sell/photo-image.ts` re-encodes JPEG/PNG images to strip metadata before confirmation, limits image dimensions and size, and does not upload until confirmation. `convex/householdPhotos.ts` stores bytes in private R2, owns references on the server, audits operations and expires unused uploads. Photo inference, retained booking evidence and actual measured pickup weight remain different facts. A model guess or EXIF location must never prove a completed collection.

`convex/lib/notificationConfig.ts` disables missing or invalid event SMS configuration. It distinguishes provider acceptance, failure and unknown outcome, and does not retry ambiguous results. The inspected event channel uses MSG91; OS Digital OTP delivery does not prove event-notification delivery. Each channel needs its own configuration and acceptance.

## Existing owner decisions that control implementation

These are explicit product decisions in `docs/product/platform-refinement-interview.md` and `docs/product/household.md`, not gaps to fill by copying document text:

- D15 permits foreground location for an active task only. Stop on completion, cancellation, sign-out or revocation. Keep a manual alternative. A 30-metre trigger, photo or map point is not handover or payment proof. Background employee tracking is outside the current version.
- D19 requires eligible service area, accepted material/grade and available quantity/capacity. Missing price means request a quote. Auctions and tenders remain deferred.
- D21/D22 keep direct household payment records separate from verified business provider settlement. Do not implement fake escrow, manual paid overrides or inferred settlement.
- D29 permits evidence reports and official references from authorized issuers. It does not authorize ordinary Luma reports to issue carbon, EPR or other official certificates.
- D30 permits programme enquiries but no monetary reward balance, one-point-equals-one-rupee promise, coupon or gold redemption without funded merchant terms. Donations require an approved named recipient and receipt.
- D31 treats loans, insurance and welfare as scoped provider referrals. Listing a service does not enable regulated execution.
- The household concept decision excludes Wi-Fi scanning and background geofencing. Municipal arrival/location requires a verified feed. Estimated impact remains separate from measured impact and issued credits.

## Recommended completion order

1. Finish and publish the document-to-source coverage map. Mark implemented, partial, missing, deliberately deferred and external acceptance separately. Do not give a precise global completion percentage without a counted requirement denominator.
2. Implement safe manual household inputs, dwelling-type details and navigation gaps identified by the household review. Preserve localized text, dual themes and private record access.
3. Build a source-backed estimate contract before expanding footprint inputs. Declare activity period, factor version, units, missing inputs and uncertainty. Save records with ownership and audit checks. Keep provider-dependent flight/bill retrieval unavailable until approved and configured.
4. Design granular business/family access as an explicit permission matrix. Add thresholds and approval states only with server authorization, revocation, concurrency and unrelated-account denial checks. Review child access separately.
5. Keep provider/legal/device gates visible in the release record. Verify code, checked PR merge, Convex release, Vercel Production release and live acceptance as separate milestones. A successful web build does not prove signed native release or device acceptance.

Review performed read-only except for this report. No Production readiness claim is made here.

## Implemented follow-up: private electricity estimate log

After the read-only review, the parent authorized a bounded implementation. The electricity calculator now offers explicit account storage consent, a declared reading period, latest-30 history and owner-only removal. `convex/householdFootprints.ts` recomputes the estimate from integer watt-hours and freezes the existing CEA factor, version and source per record. It does not trust a client impact value. It rejects invalid/future dates, periods over 366 days, fractional or oversized watt-hours, and conflicting idempotency keys. Repeated saves of one operation create one record. Writes are limited to 20 per account per day.

Access requires an authenticated open account with a profile. The API accepts no target profile ID and provides no family-sharing path. Account-removal phase 26 deletes these private readings; completion moves to phase 27. Only record IDs and action names enter the audit log. Periods can overlap, so the UI does not sum them and warns against adding overlapping periods.

The UI has translated labels in all 33 catalogues. Estimates stay separate from official credits and offsets. No provider call, tariff inference, BBPS integration or new emission factor was added. This closes persistence for the existing electricity estimate; it does not complete the five-pillar calculator.

Observability review: this is a private household input journey, so no new PostHog event exports reading values, periods or result amounts. Expected validation, authentication and quota failures use the standard localized error message. The existing global sanitized Sentry boundary remains the unexpected-failure hook; no new private payload capture is needed. Audit records cover save and removal without the reading. No change to analytics consent or error-export scope is required.

Focused checks passed: backend owner isolation, idempotency/conflict, frozen calculation and audit, account-removal cleanup, invalid date/quantity boundaries, localized numeric parsing, and UI consent/date gating with stable retry identity. The existing account-removal suite also passed with the new final phase. Full checked release and browser visual acceptance remain the parent's responsibility.

### Follow-up review and connected browser coverage

Independent review of the combined dwelling-type and rate-permission changes found no new confirmed authorization blocker. Rate changes require the same owner/admin management capability in the client and Convex. Dwelling type is optional, validated metadata saved on pickup bookings; its presence does not establish dwelling-specific routing or complete granular household roles. Shared control border-radius changes do not alter these server checks.

The old calculator privacy sentence was corrected in all 33 languages: a reading is saved only after the user chooses Save. The translation contract suite and footprint consent UI tests passed together (136 tests); web typechecking passed.

Added `e2e/connected/foundation-household-footprint-phone.spec.ts` using the existing authenticated, loopback-only phone-session fixture. It covers consent gating, exact stored amount, persistence after reload, unrelated-account denial and owner removal. It adds no login bypass or OTP send. This browser test was not executed because this checkout lacks `.convex/local-acceptance/phone-sessions.json` and `backend.env`. It must run with the provisioned local acceptance runtime, after being included in the foundation configuration. It is not Production acceptance evidence.
