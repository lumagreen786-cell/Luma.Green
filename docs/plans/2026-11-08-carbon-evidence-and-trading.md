# Carbon evidence and trading

## First release

Build a private evidence workspace around recorded recycling batches. Use
existing material lots, custody, processing and quality records. Screen more
than one route, then select one eligible route for each set of reductions.
Keep carbon credits, plastic credits, EPR certificates and impact estimates
in separate records.

The first backend change gives an authorized workspace a read-only view of
one transformation for evidence preparation. It returns recorded input and
output lot IDs, material, state and integer grams, contamination, process loss,
and the stored facility ID and process type when present. It uses the original
output weights. Later custody and stock changes do not rewrite the batch.

The caller must supply the selected workspace ID and the transformation ID.
The server checks current read access and transformation ownership. Existing
workspace policy allows members with read access to view their own history
when a workspace is suspended. The query returns
the same record-not-found error for a foreign and a missing transformation.
Legacy batches without input edges return the recorded primary input ID and
total mass, with the missing per-lot detail marked explicitly. Inconsistent or
oversized batches fail closed. The response excludes actor IDs, contact fields,
costs, document contents and object keys. Material and state labels can contain
operator text. Review and redact labels before an external export. The query
cannot establish project
eligibility, verify evidence or create a credit. There is no schema change.

## Candidate routes

Checked against primary sources on 8 November 2026. These are screening
options. A facility must supply evidence before Luma marks a route eligible.

| Route                                                                                                                                                                                                                                     | Candidate activity                                                                                        | Evidence that decides the fit                                                                                                                                                                                                                                                  |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| [Verra VMR0007](https://verra.org/methodologies/vmr0007-revision-to-ams-iii-aj-recovery-and-recycling-of-materials-from-solid-wastes-v1-0/) with [AMS-III.AJ v9](https://cdm.unfccc.int/methodologies/DB/LOWIXM9S6DVO7DGXB21DPVLE8N3VB9/) | Eligible plastics, container-glass cullet, aluminium or steel made into intermediate or finished products | Dry mass by material, dispatch and downstream receipt, actual manufacturing use, meter and fuel records, baseline and sole claimant. Check material-specific quality, origin and diversion rules. Screen paper/cardboard separately only for the method's disposal-decay case. |
| [BEE BM WA03.003](https://beeindia.gov.in/WriteReadData/RTF1984/RTF-PDF-56f665ac470e0ca1_1783087085.pdf)                                                                                                                                  | An eligible compressed-biogas producer using qualifying organic waste                                     | Prior waste treatment, weighed feedstock, permits, commissioning, gas and methane measurement, leakage, electricity and fuel, digestate and offtake. Agree claim rights and sharing with the producer.                                                                         |
| [BEE BM IN02.001](https://beeindia.gov.in/WriteReadData/RTF1984/RTF-PDF-ab06743897d11b58_1776061202.pdf)                                                                                                                                  | A distinct eligible industrial energy-efficiency project at a recycler or manufacturer                    | Pre- and post-upgrade energy, equivalent production output and feedstock, meter calibration, baseline history, equipment specifications and commissioning.                                                                                                                     |
| [Verra VMR0008](https://verra.org/methodologies/vmr0008-revision-to-ams-iii-ba-recovery-and-recycling-of-materials-from-e-waste-v1-0/) with [AMS-III.BA v3](https://cdm.unfccc.int/methodologies/DB/TO0E8JPL9361FDB1IPF0TUPS0WJXV3)       | Dedicated e-waste recovery into secondary materials                                                       | Recycler registration, material purchase and sales, recovered output, energy, residue destinations and applicable EPR obligations. Check scale, additionality and regulatory surplus.                                                                                          |

Start with dry recycling and compressed biogas if partners can supply records.
The [BEE approved list](https://beeindia.gov.in/view_content.php?lang=1&lid=571)
does not list ordinary dry-scrap recycling. Screen landfill gas only with an
actual landfill operator and the applicable approved method. Keep
[Verra biochar](https://verra.org/methodologies/vm0044-biochar-utilization-in-soil-and-non-soil-applications-v1-2/)
for a separate biomass conversion project, and
[Gold Standard 448](https://globalgoals.goldstandard.org/gs4gg-paris-agreement-alignment/)
on the watch list pending an applicable Paris-aligned version.

For the Indian offset route, follow the [BEE procedure](https://beeindia.gov.in/sites/default/files/Detailed%20Procedure%20for%20Offset%20Mechanism_CCTS.pdf).
Use different accredited agencies for validation and verification within a
crediting period. Check the [CERC trading rules](https://cercind.gov.in/regulations/GZ-205.pdf)
before selecting an authorized venue. Offset venue and API access remain
unconfirmed. For Verra, apply the version and dates that govern the project,
check [registry access](https://verra.org/registry/overview/), and start with
reconciliation of official receipts. Check host-country rules and any required
authorization separately before an international transfer.

## Evidence collection and review

| Stage                       | Luma record                                                                     | Evidence needed                                                                                                               |
| --------------------------- | ------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| Screen project              | Facility, operator, process, dates and proposed method                          | Permits, right to operate and claim, crediting start, baseline, additionality, other schemes and signed allocation agreements |
| Trace material              | Pickup and custody IDs, exact input and output grams, split and merge history   | Weigh slips, scale calibration, supplier and transport records, rejected or diverted material                                 |
| Monitor project             | Versioned monitoring period and calculation inputs                              | Meter readings, utility and fuel records, output quality and sales, uncertainty and leakage                                   |
| Verify                      | Frozen evidence pack, reviewer role and corrections                             | Signed independent validation or verification, findings and responses                                                         |
| Reconcile issuance          | Registry project and issuance references, vintage, serial ranges and unit count | Official issuance and ownership evidence from the registry                                                                    |
| Record trade and retirement | Authorized order and settlement references, serial movement and beneficiary     | Venue confirmation, payment and registry transfer or retirement confirmation                                                  |

Use private development and production R2 buckets for new file contents. Store
the record ID, authorized scope, object reference, byte count and server-verified
SHA-256 in Convex. A hash checks file integrity. Source approval is a separate
step. Keep household photos optional for this evidence workflow. Keep GPS and
EXIF out of verifier packs unless the method requires them and access is
approved. The mockup's material suggestions and pickup routing can help intake.
Use operator-confirmed weights and facility measurements for claims.

Reserve attributable reductions across carbon projects, monitoring periods and
schemes before any submission. Check overlaps through lot splits and merges.
Require a documented review for overlap with EPR, plastic credits or other
environmental attributes. Keep originals and append corrections. Use scoped
verifier access and an audit trail for each change and external submission.
Exclude known demonstration batches from external evidence packs and require
independent source evidence for claims.

## Gaps in the current material records

Pickup completion creates a receipt and stock movements. A declared lot has a
free-text source reference. A sale can reference a seller's lot, while receipt
adds to aggregate buyer stock. Add an explicit authorized receipt-line or
trade-to-lot link before treating these records as end-to-end custody. Cap the
allocated mass and prevent duplicates in the same transaction. Do not infer
lineage from matching times or weights.

## Delivery order

1. Return workspace-owned processing evidence and mark incomplete history.
2. Add a workspace evidence screen with project and method screening, document
   collection, and a private verifier export. Confirm a pilot facility and its
   evidence before configuring calculations.
3. Add method-specific monitoring and overlap checks. Freeze the calculation
   version, factors and approved evidence for each submission.
4. Reconcile registry issuance by official references before building any order
   flow. Make registry events idempotent and stop processing on a serial,
   quantity or ownership mismatch.
5. Add trading and retirement only through a confirmed authorized route.
   Verify account access, venue rules, settlement, reversals, permissions and
   registry reconciliation before enabling production execution.

Complete the security audit and release checks in parallel. Verify R2 access,
Turnstile and owner-only merges with the relevant account access before rollout.

## Receipt lineage contract

A shop operator can pass an optional source booking ID to the existing lot
declaration. The server must find a completed booking in that shop, a current
household acceptance, and exactly one receipt line for the material. The new
lot must use the full line weight. Declare smaller downstream lots through
the processing workflow. Reject another intake lot for the same receipt and
material, including concurrent requests. The link and audit record are
written in the same transaction. It adds no inventory movement.

The booking ID and receipt version stay in private records. Lot history and
carbon draft exports keep household details out. The fields and index are
additive, so old records need no backfill. In a rollback, stop new linked
declarations and retain the fields and index for recorded links.

## Workspace implementation

The shop request detail offers a lot link on each eligible, household-accepted
receipt line. The lot form locks the source, material and weight. Reloading
the request shows which lines already have lots. Households confirm the receipt
in the existing flow. Saathis continue to use the pickup flow.

Business workspace members open Carbon projects from Compliance. Operators
select a recorded facility, create a project and attach eligible measured
transformations from that facility. A transformation can belong to only one
project in this workspace workflow. This check is an internal safeguard.
Formal claim allocation still requires an overlap check across periods,
schemes and lot lineage.

Operators can record references for the baseline, monitoring, claim rights
and independent verification report. Owners and managers can mark the
references internally reviewed. Changes reopen review. Viewers can read their
workspace records. Registry references show as reported and unverified.

Before external submission, confirm the facility operator and documented claim
rights, agree the method and monitoring plan, and obtain the required
independent validation and verification. To enable trading, confirm the
registry account, permitted venue or counterparty channel, settlement rules
and supported interface. Match the provider evidence to the project, owner,
serial ranges, vintage and unit count before recording an external event as
confirmed. Private verifier file exchange, formal allocation and provider
reconciliation remain separate work.

## Framework coverage and release gates — 9 November 2026

**Goal.** Support the programs the owner named from project screening through
the last action each program permits. Keep emissions accounting and the
external credit lifecycle distinct. The first PR for this extension adds
workspace screening, five industry checklists and evidence references on the
existing Carbon projects page. It does not certify a project or activate a provider.

**Architecture.** The same framework catalogue drives the web screen and
Convex write validation. The existing project and workspace own access.
Screening uses its own per-project and per-framework revision, with audited
updates. Existing candidate method IDs and immutable review exports stay
compatible. For a rollback, disable new screening writes and retain recorded
screenings and their audit history. Existing projects start with no screening
rows. Operators can assign one compatible industry to a legacy project.
Assignment opens a new draft revision. Previous review snapshots stay readable.
No production data backfill is necessary.

**Test approach.** Add catalogue, access, persistence and stale-write tests.
Exercise the operator flow and read-only and denied states. Inspect the
changed web screen in both themes and affected screen sizes and scripts.
Run the repo checks and focused carbon browser tests. Verify GitHub checks
on the exact pushed commit and record provider and deployment evidence
separately.

### Activity and authority

| Framework              | PET example                                                                                                                                          | Evidence and authority to add before activation                                                                                                                                                                                                                           |
| ---------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Verra VCS              | Candidate under active VMR0007 with AMS-III.AJ.                                                                                                      | Confirm the applicable VCS rules, monitoring case, dry mass, quality, municipal origin, collection conditions, process energy, manufacturer end use, displacement and claim rights. Obtain the project owner delegation, VVB findings, Verra project and registry access. |
| Gold Standard          | Historical PET precedent. Current fit for a new Indian project remains unconfirmed. Method 448 covers metals, alloys and minerals.                   | Confirm the current Paris-aligned method and project eligibility. Capture safeguards and consultation, validation, design and performance certification, and the official Impact Registry records.                                                                        |
| Climate Action Reserve | No approved India PET protocol identified.                                                                                                           | Identify a qualifying activity and approved jurisdiction protocol before choosing CAR. Obtain verifier and registry evidence.                                                                                                                                             |
| Puro.earth             | PET recycling emissions avoidance is outside the durable removal scope.                                                                              | Use a separate qualifying removal project, applicable method, storage and durability evidence, facility and output audits, and provider-issued CORC records.                                                                                                              |
| ACR                    | No PET method identified in the approved list.                                                                                                       | Identify an applicable approved method, complete listing and public comment where required, collect independent findings and reconcile registry records for serialized units.                                                                                             |
| India CCTS             | No ordinary mechanical PET recycling method on the published BEE list. Qualifying CBG or industrial efficiency projects can be evaluated separately. | Confirm the eligible Indian entity and method. Capture BEE project registration, separate accredited validation and verification, official issuance, Grid India records and any authorized venue confirmations.                                                           |
| GHG Protocol           | An accounting framework for inventories or project reductions.                                                                                       | Choose the reporting purpose, applicable guidance, boundary and version. Preserve source data, factors, assumptions and calculations. Review conformance separately. This route ends with an accounting report.                                                           |

Primary sources for the framework screen are kept with the catalogue.
See also [Gold Standard's historical PET example](https://marketplace.goldstandard.org/products/plastic-recycling-romania-europe),
[Gold Standard method 448](https://globalgoals.goldstandard.org/448-recovery-and-recycling-of-materials-from-solid-wastes/),
and [AMS-III.AJ. v9](https://cdm.unfccc.int/UserManagement/FileStorage/WDFQ1I93T5S7J2EXHC84LOZUBPKM0G).
For the Verra PET example, the method requires mixed collection of the
recyclables processed by the plant when the specified door-to-door or
community-container route is used. A selective pickup is excluded under
that condition. Apply the method's case-specific monitoring rules and the
Verra displacement discount to the applicable baseline calculation. The
simple subtraction example used in the team diagram does not calculate
VMR0007 credits.

### First five industry routes

| Activity                            | Candidate method               | Industry-specific evidence                                                                                                                                                      |
| ----------------------------------- | ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| PET plastics                        | Verra VMR0007 with AMS-III.AJ. | Municipal source, collection scope, dry mass and grade, facility scenario and capacity, process energy, buyer end use and virgin material displacement.                         |
| Metals recycling                    | Verra VMR0007 with AMS-III.AJ. | Municipal source, collection scope and output evidence for recovered aluminium or steel. Record dry mass, grade, measured energy, buyer use, displacement and capacity.         |
| E-waste recovery                    | Verra VMR0008 with AMS-III.BA. | Dedicated recovery facility, equipment categories and custody, measured secondary material output, energy, residue destination and buyer end use.                               |
| Compressed biogas                   | BEE BM WA03.003                | Eligible weighed feedstock and prior treatment, gas and methane measurement, leakage, process energy, digestate and offtake.                                                    |
| Industrial manufacturing efficiency | BEE BM IN02.001                | Eligible energy-efficiency or fuel-switching measure, equipment and commissioning records, calibrated meters, comparable output and feedstock, and pre- and post-change energy. |

The industry choice identifies a candidate project activity. A facility can
have multiple projects with distinct boundaries. Preserve rights and overlap
checks across those projects before assigning reductions.

### Implementation sequence and acceptance evidence

1. **Screen and record.** Check each program from the same workspace project.
   Store the operator's evidence reference and assessment privately. Show
   gaps and contradictions on reload. Keep every assessment self-reported.
   A confirmed choice of program and eligible activity is an external input.
2. **Prepare a method-specific project.** Use the actual facility, operating
   permissions, program and method version, boundary, baseline and signed
   claim rights. Link measured inputs and outputs. Reserve the attributable
   reduction across projects, periods and schemes. Test conflicting and
   concurrent claims across split and merged lots.
3. **Monitor and share.** Freeze dated periods, measured inputs, calculation
   versions and factors. Attach originals through the approved private R2
   environment. Give a named verifier scoped, expiring access. Verify file
   bytes, permission removal and revision history. Accept external findings
   separately from a Luma operator's review.
4. **Reconcile external records.** Add an adapter only after obtaining the
   provider's documented interface, access and test account. Validate project
   and account identity, vintage, unit count and serial ranges. Apply verified
   records idempotently. Test duplicates, partial transfers, stale ownership,
   mismatches, reversals and failed settlements before enabling trading.
5. **Authorize and verify trading.** Verify venue or bilateral authority,
   buyer and seller accounts, settlement owner, limits and retirement
   beneficiary. Exercise the approved sandbox. A live release requires
   independently verifiable external receipts and the checked Production
   path. Keep issuance, trading and retirement unavailable until these
   conditions pass for that route.

A verified methodology fit, signed facility/claim-rights records, an
authorized verifier and provider sandbox access are needed for the first
live route. Each additional crediting program has its own project,
provider and acceptance gates. Provider access and facility approval cannot
be inferred from code, research or passing CI.
