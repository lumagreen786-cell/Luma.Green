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
