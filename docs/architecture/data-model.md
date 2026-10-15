# Data model (planned v2)

> **Status:** historical v2 plan from 29 September 2026, with a current refinement appendix dated 7 October below. The earlier table and access-rule descriptions are historical wherever they conflict with that appendix or `convex/schema.ts`. The schema and guarded functions own current field names and permissions. Each change follows [migrations](../migrations/README.md).

## What changes from v1

| v1 (scaffold)                                                   | v2                                                                                  | Why                                                                                  |
| --------------------------------------------------------------- | ----------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| `orgs.role`: collector, aggregator, recycler, factory, verifier | `orgs.kind`: kabadiwala, preprocessor, recycler, manufacturer                       | The founder's roles. Verifiers return with carbon credits                            |
| `orgs.sector` — orgs only see their own sector                  | Visibility by **location and material**                                             | A kabadiwala handles paper, plastic and metal and sells to whichever yard is nearest |
| `orgs.kycStatus`                                                | An `applications` table with a full state machine and history                       | Manual verification with notes, resubmissions and an audit trail                     |
| No households                                                   | `households`, `bookings`, `bookingOffers`, `pickupReceipts`, `pointsLedger`         | The household flow                                                                   |
| No gig workers                                                  | `saathiProfiles`                                                                    | Saathis are people, not businesses                                                   |
| No platform staff                                               | `adminProfiles` (one row in the pilot)                                              | One admin now; team members later                                                    |
| `materials.co2eFactorPerKg` only                                | Material catalogue with families, grades and codes; prices in separate dated tables | Prices change daily; the catalogue doesn't                                           |
| `inventoryMovements.reason` has no sorting                      | Adds `sort_out` / `sort_in` with a shared `sortingRunId`                            | Sorting turns 50 kg of mixed paper into newspaper, cardboard and reject              |

No production data exists yet (29 Sep 2026), so v2 replaces v1 directly. From
the first real row onwards, every change is widen → migrate → narrow.

## Tables

Grouped by module. Money is integer paise, mass integer grams, times are
milliseconds since epoch. Every table also has `createdAt` / `updatedAt`.

### Identity

Better Auth keeps its own tables (users, sessions, accounts, verification codes,
two-factor secrets) inside its Convex component. Our tables reference its user
id.

| Table           | Key fields                                                                    | Indexes                     |
| --------------- | ----------------------------------------------------------------------------- | --------------------------- |
| `profiles`      | `authUserId`, `phone` (E.164), `name`, `locale`, `kind` (`member` \| `admin`) | `by_authUserId`, `by_phone` |
| `adminProfiles` | `profileId`, `email`, `dateOfBirth`, `aadhaarLast4` (4 digits only)           | `by_profileId`              |

### Participants and onboarding

Built 29 Sep 2026 (onboarding): `applications`, `applicationSnapshots`,
`applicationFiles`. The business and Saathi records are created when the
admin approves — until then everything lives on the application.

| Table                  | Key fields                                                                                                                                                                                                                                                                                     | Indexes                                               |
| ---------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------- |
| `applications`         | `profileId`, `kind` (`kabadiwala` \| `yard` \| `recycler` \| `manufacturer` \| `saathi`), `status`, `version`, `locale`, `ageConfirmedAt`, `privacyAcceptedAt`, the draft sections (`kabadiwala` or `business` + `documents` or `saathi`), `submittedAt?`, `decidedAt?`, `decidedBy?`, `note?` | `by_profile`, `by_status_submittedAt`                 |
| `applicationSnapshots` | `applicationId`, `version`, the sections as sent, `fileIds[]`, `submittedAt` — one per submit, so the admin sees what changed                                                                                                                                                                  | `by_application_version`                              |
| `applicationFiles`     | `applicationId`, `profileId`, `type` (`pcb_certificate`, `machine_media`, `id_proof`, `selfie`), `storageId`, `name`, `contentType` (from the file's bytes), `size`, `firstSubmittedVersion?`, `removedAt?`                                                                                    | `by_application`, `by_storageId`                      |
| `orgs`                 | `kind`, `name`, `slug`, `status`, `ownerProfileId`, `address`, `location {lat,lng}`, `geohash`, `locationTags[]`, `pickup {offers, vehicle?}`, `hours {opens, closes}`, `weeklyOff[]`, `phones[{number,label}]`, `gstin?`, `materials[]`, `pcb? {board, state?, number}` — created on approval | `by_slug`, `by_owner`, `by_kind_status`, `by_geohash` |
| `memberships`          | `profileId`, `orgId`, `role` (`owner` \| `staff`)                                                                                                                                                                                                                                              | `by_profile`, `by_org`                                |
| `saathiProfiles`       | `profileId`, `area`, `location`, `geohash`, `radiusKm`, `workTypes[]`, `vehicle`, `availability {times[], days[]}`, `status` — created on approval                                                                                                                                             | `by_profile`, `by_geohash`                            |

`applications.status`: `draft → submitted → approved | changes_requested |
rejected`, `changes_requested → submitted`, `approved ↔ suspended`
(`convex/lib/lifecycle.ts`). Illegal transitions throw; each legal one writes
`auditLog`. The field rules live once, in `convex/lib/onboarding.ts`: the
forms validate with them and `applications.submit` runs them again.

Uploads go to Convex storage first and are attached after a check of their
real type (the first bytes, not the name or declared type); a rejected one is
deleted at once. An upload that never gets attached — the tab closed half-way
— stays orphaned until a daily clean-up job, to be built with the admin
queue.

### Catalogue and prices

| Table           | Key fields                                                        | Indexes                 |
| --------------- | ----------------------------------------------------------------- | ----------------------- |
| `materials`     | `code` (`PAPER-NEWS`), `family`, `grade?`, `messageKey`, `active` | `by_code`, `by_family`  |
| `priceFloors`   | `city`, `materialId`, `paisePerKg`, `effectiveFrom`               | `by_city_material_from` |
| `fallbackRates` | `city`, `materialId`, `paisePerKg`, `effectiveFrom`               | `by_city_material_from` |
| `rateCards`     | `orgId`, `materialId`, `paisePerKg`, `effectiveFrom`              | `by_org_material_from`  |

### Household pickups

| Table            | Key fields                                                                                                                                                        | Indexes                                                  |
| ---------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------- |
| `households`     | `phone` (E.164, verified), `locale`                                                                                                                               | `by_phone`                                               |
| `bookings`       | `token`, `householdId`, `mode` (`pickup` \| `dropoff`), `photos[]`, `estimate {items[], model, promptVersion}`, `orgId?`, `slot`, `address`, `location`, `status` | `by_token`, `by_household`, `by_org_status`, `by_status` |
| `bookingOffers`  | `bookingId`, `orgId`, `offeredAt`, `response?`, `respondedAt?`                                                                                                    | `by_booking`, `by_org_pending`                           |
| `pickupReceipts` | `bookingId`, `lines[{materialId, grams, paisePerKg, paise}]`, `totalPaise`, `method` (`cash` \| `upi`)                                                            | `by_booking`                                             |
| `pointsLedger`   | `householdId`, `delta`, `reason`, `bookingId?`                                                                                                                    | `by_household`                                           |

`bookings.status`: `requested → accepted → on_the_way → picked_up →
completed`, plus `cancelled` and `expired`. Receipts are append-only and keep
the rate used, so a later price change never rewrites a paid pickup.

### Stock and trade

`inventory`, `inventoryMovements`, `listings` and `trades` stay as in v1 (movements
append-only, inventory derived), with the new `sort_out` / `sort_in` reasons and
`orgId` scoping. Their shape is revisited when the kabadiwala → yard hand-off is
designed.

### Operations

| Table           | Purpose                                                                                               |
| --------------- | ----------------------------------------------------------------------------------------------------- |
| `auditLog`      | Every state change that matters (as v1): who, what, before, after                                     |
| `events`        | Product events for pilot numbers — booking created, accepted, weighed; application submitted, decided |
| `notifications` | Outbox for SMS (and later WhatsApp): template, recipient, variables, status, attempts                 |
| `flags`         | Feature switches the admin can flip without a deploy                                                  |

## Access rules (enforced in every Convex function)

- A member reads and writes only their own org's rows; the check is in the
  function, never the UI.
- Household bookings are readable through their token or by the assigned
  kabadiwala after acceptance.
- The admin reads everything and is the only writer of `applications.status`,
  `priceFloors` and `fallbackRates`.
- Files are served through short-lived URLs issued by a function that performs
  the same checks.

## Current refinement appendix — 7 October 2026

This appendix describes current source, not a deployed schema or completed acceptance result. `convex/schema.ts` and each guarded function remain authoritative. In particular, the historical claims that every table has `updatedAt`, inventory is always derived, memberships only have owner/staff, and files use unguarded short-lived links must not be read as current contracts.

### Manufacturer stock and evidence boundaries

`manufacturerStockIntakes` is an immutable ledger with `orgId`, `actorProfileId`, `intakeReference`, `materialCode`, exact positive integer `grams`, `producedOn` (calendar date), `sourceReference`, `weighingReference`, `ownProductionConfirmed: true` and `createdAt`. Indexes are `by_org_reference` (`orgId`, `intakeReference`) and `by_org_created` (`orgId`, `createdAt`).

`stockIntake.record` requires the active manufacturer's operational membership and an active scrap material with an explicit non-hazardous byproduct classification in that organisation's material-family scope. It validates the real calendar date, rejects future production dates using the India calendar, and checks safe integer totals. The mutation atomically inserts the intake, increments or creates the organisation/material `inventory` row, and writes `inventory.manufacturer_intake_recorded` to `auditLog`. Identical normalised details under the same organisation/reference return the original intake; conflicting details fail without changing stock. This is a declared own-production receipt, not independent ownership, weighing, quality or regulatory proof. No intake edit/delete interface is supplied.

`inventory` stores `orgId`, `materialCode`, `grams` and `updatedAt`, with `by_org` and `by_org_material` indexes. Evidence-only `materialLots` and transformations remain separate: they do not increment this inventory or issue credits. Offers and payment-dependent stock transitions still enforce their separate eligibility and gateway rules.

### Facilities and reported registration references

| Current table               | Fields and indexes                                                                                                                                                                                           | Contract                                                                                                                                                                                                        |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `industrialFacilities`      | `orgId`, `name`, `siteReference`, optional `sectorId` and `sector` snapshot, `capabilities`, creator/updater profile IDs, timestamps; `by_org_created`                                                       | Owner/admin records self-declared process capabilities. Sector provenance stays `workbook_unverified`; no new identity, trade permission or facility approval.                                                  |
| `facilityRegistrations`     | `facilityId`, `orgId`, `kind`, `reference`, `issuedAt`, `validUntil`, optional `supersedesId`, `actorProfileId`, `recordedAt`, `sourceQuality: reported_unverified`; `by_facility_recorded`, `by_supersedes` | Append-only reported consent/registration references. Corrections keep the prior record. Status is derived from reported dates in India, with expiry day included; it does not verify a permit or enable trade. |
| `lotControlledDispositions` | `lotId`, `orgId`, integer `grams`, `destinationReference`, `authorisationReference`, `manifestReference`, actor profile, `createdAt`; `by_lot_created`                                                       | A guarded disposition atomically reduces the held lot's available grams and preserves its evidence. No certificate, portal execution, saleable stock or payment is created.                                     |

Registration kinds are `consent_to_operate`, `consent_to_establish`, `epr_registration`, `waste_authorisation` and `other`. A correction link is a relationship between immutable records; the returned `supersededById` is a view derived from the index, not a stored schema field.

### Lot inputs, outputs and transformations

`materialLots` has optional `streamClass` and `handlingClass`, `initialGrams`, `availableGrams`, current holding `orgId`, original `declaredByOrgId`, material/state, source metadata and optional `parentTransformationId`. Stream classes are main product, saleable byproduct, recoverable waste, residual waste and unspecified; handling is non-hazardous, controlled or unassessed. These are declarations, not approval. Controlled/residual lots use the restricted disposition route instead of ordinary dispatch/transform. Linking a lot to an ordinary offer requires explicit non-hazardous handling and an eligible main-product/byproduct/recoverable stream; missing or unassessed classification does not qualify. Existing unlinked inventory offers retain their catalogue/family/actor checks.

`lotTransformationInputs` is now present in source, with `transformationId`, `lotId`, material/state snapshots, consumed integer `grams` and `createdAt`; indexes are `by_lot_created` and `by_transformation`. Each consumed input becomes an immutable edge. `lotTransformations` retains the primary `inputLotId` for legacy history, `inputGrams`, contamination/loss grams, org/actor/time and optional paired `facilityId`, `facilityName` and `processKind` snapshot. The guarded mutation supports up to 20 distinct, available ordinary-route inputs held by the current business. Its 32 focused tests and one local connected industry journey passed during this slice; final combined acceptance and deployment remain separate. Each source history retains its edge. A later recipient of an output or input remainder receives custody visibility, not the processing organisation's private process, parent or sibling history. The processing contract accounts for all input grams exactly once across measured outputs, contamination and process loss. A separately recorded residual output is not counted again as loss. This processing ledger does not add inventory or mint a carbon/EPR certificate.

Viewer access remains read-only. Facility, intake, lot, registration and disposition writes use current workspace permission and audit checks; a translated label, sector selection or browser-hidden control never grants server access.

### Financial lifecycle additions — 7 October 2026

The current schema imports `lifecycleTables` from
`convex/lib/cashfreeLifecycleSchema.ts`. These supplement the existing inventory
cache and audit owner; they do not migrate legacy simulated payment states into
verified money. The financial implementation has focused local evidence; final
combined and provider acceptance remain separate gates.

| Table                        | Current ownership and indexes                                                                                                                                                                      |
| ---------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `cashfreePolicies`           | Immutable version, fee payer, refund funder, platform-admin authority, settlement/acceptance references and creator/time; `by_version`. Live `cashfreeOrders.policyId` freezes the selected terms. |
| `tradeFinancials`            | One current trade state, linked order, separate collection/settlement/refund and optional hold reason; `by_trade`.                                                                                 |
| `financialMovements`         | Exact signed grams for dispatch or receipt, organisation, reference, actor and time; `by_trade_kind`. Atomic with the existing inventory cache and audit; identical retry is idempotent.           |
| `cashfreeRefunds`            | Frozen full amount, reference/reason, provider refund identity and idempotency key, actor, lease/retry/status/times; `by_order`, `by_trade_reference`.                                             |
| `cashfreeRefundTriggers`     | Order/refund identity, signed-event body hash and consumed flag; `by_hash`.                                                                                                                        |
| `cashfreeRefundEvidence`     | Append-only provider outcome, amount/identity, fingerprint and time; `by_refund_fingerprint`.                                                                                                      |
| `cashfreeSettlementEvents`   | Sanitized signed vendor-transfer observations, exact amounts/fees/adjustments, event time and body hash; `by_mode_vendor_settlement`, `by_hash`.                                                   |
| `cashfreeSettlementEvidence` | Order/vendor allocation, settlement ID, fees, derived state, fingerprint and time; `by_order`, `by_order_fingerprint`.                                                                             |

Collection does not move stock. Dispatch subtracts seller grams and receipt adds
buyer grams once. Unpaid final cancellation changes the accepted commitment,
not on-hand inventory. Refund confirmation leaves a hold and does not restore
stock or assert physical return. Exact order allocation and transfer evidence
are required for settlement; reversals remain visible and cannot be overwritten
by a later generic success. See [payments](payments.md) for the current boundary.

## Parent organizations and collaboration (backend, October 2026)

`organizations` groups existing approved `orgs` sites. Parent roles in
`organizationMemberships` govern the company; existing `memberships` alone
continue to grant operational site access. `phoneTeamInvitations` stores hashed,
verified-phone-bound invitations for either scope. Existing email invitations
retain their transport and identity checks.

`recordTasks` attaches responsibility to a permitted business record, without
changing its operational state. `recordComments` stores current plain text;
`recordCommentRevisions` preserves non-public edit history. All access is checked
against live memberships or the current assigned Saathi job. See the
[organization backend contract](organizations.md) for limits and deferred work.
