# First carbon pilot intake

Use one Indian PET recycling facility, one legal project proponent and one
closed monitoring period. Screen Verra VMR0007 with the applicable version of
AMS-III.AJ. An eligible activity needs to demonstrate displacement of virgin
production. A purchase of flakes or a scrap pickup alone does not establish
this. Confirm the method version, project dates, scope and eligibility with
the independent verifier before booking an issuance or sale. Ordinary PET
recycling is not listed in the current BEE offset methodology list. Use an
Indian offset route only for a separate activity that fits an approved method.

- [Verra VMR0007 and its linked AMS-III.AJ methodology](https://verra.org/methodologies/vmr0007-revision-to-ams-iii-aj-recovery-and-recycling-of-materials-from-solid-wastes-v1-0/)
- [Verra project development and issuance steps](https://verra.org/programs/verified-carbon-standard/develop-a-vcs-project/)
- [BEE approved offset methodologies](https://beeindia.gov.in/view_content.php?lang=1&lid=571)

## Facility documents to send

Start with the site name, city, legal operator and one closed month of records
to test imports. A closed month is a sample for the software pilot. The
method and verifier determine the required baseline and monitoring periods.

| Packet                | Include                                                                                                                                                                                                                                                                                                                                                 |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Site and operator     | Legal name, company incorporation or registration, GST registration, site address, title or lease and operator agreement if different. Include the applicable SPCB/PCC consents, operating and waste-handling authorizations, CPCB plastic waste processor registration if applicable, and any conditions, validity dates or renewals.                  |
| Project and baseline  | Process flow and boundary, equipment list and rated capacity, dated investment decision, purchase orders, installation and commissioning records, prior site operations and throughput, evidence of the prior treatment destination, project start date, alternatives, project economics and any regulatory or EPR obligations.                         |
| Feedstock and custody | Supplier agreements and material origin, weighbridge slips, collection and transport records, receiving records, sorting and rejected quantities, polymer and contamination grades, lot IDs, split and merge records, and scale calibration certificates.                                                                                               |
| Production and sales  | Batch and production logs with input and output weights, PET grades, output tests, rejects and disposal records, inventory and dispatch records, customer invoices, delivery acknowledgements, and end-use or substitution evidence from the buyer.                                                                                                     |
| Energy and monitoring | Dated electricity bills, meter readings and calibration records, fuel logs and invoices, transport mode and distance, and any outsourced processing records inside the project boundary. Include source files with units, reporting period, site, equipment or meter ID and document reference.                                                         |
| Carbon claim rights   | Signed agreement identifying the proponent and rights holder, covered sites and periods, rights to register, issue, sell and retire, revenue split, evidence access and correction rights. Include declarations and any relevant agreements or records for overlapping carbon projects, plastic credits, EPR claims and other environmental attributes. |
| Independent review    | Named eligible validation and verification body, accreditation scope, engagement and permission to share evidence, project description, monitoring plan, and any existing signed validation report, verification report, findings or responses.                                                                                                         |

## Account access

1. **Facility data:** Invite a named read-only user to the source system, or
   provide dated CSV exports and referenced originals through a private share.
   For automation, provide vendor name, product and version, field definitions,
   sample export, API documentation and a sandbox with read-only access.
2. **Verra:** Provide the KYC-approved legal entity name, registry account ID,
   and Project Hub project ID if one exists. Invite a named user with the
   minimum rights for document preparation and review. Keep approval and credit
   movements with the account owner until the approved process is agreed. For
   automation, provide Verra-approved sandbox access, the actual endpoint
   contract and a sample response for each permitted action. [Registry overview](https://verra.org/registry/overview/)
3. **Trading and settlement:** Name the authorized venue or approved bilateral
   counterparty, buyer registry account and settlement owner. Provide the signed
   authority or agreement, permitted actions, limits, and sample order, transfer,
   settlement and retirement receipts. Confirm supported currency, settlement
   and reversal rules before the first trade. Obtain a scoped sandbox invitation
   if the provider supports one.
4. **Luma infrastructure:** Provide scoped access to the Convex pilot
   deployment, the Vercel project when its deployment block is resolved, and
   private Cloudflare R2 development and production buckets when document uploads
   are enabled. Put provider secrets into the matching backend environment.
   Use account invitations or a secret manager for access. Keep passwords,
   tokens, KYC documents and original facility files out of chat and Git.

For a separately approved India offset pilot, use the BEE non-obligated entity
registration, the designated registry, the applicable accredited verification
agencies, and the authorized power exchange route. Confirm the actual offset
segment and access before implementation. [BEE offset procedure](https://beeindia.gov.in/sites/default/files/Detailed%20Procedure%20for%20Offset%20Mechanism_CCTS.pdf) · [CERC trading rules](https://cercind.gov.in/regulations/GZ-205.pdf)

## Local trade rehearsal

Run `node scripts/carbon/reconcile-pilot.mjs path/to/private-records.json`.
Use a single full-lot sale with INR settlement, one contiguous serial range
and retirement by the buyer. The input has `expected`, `issuance`, `transfer`,
`settlement` and `retirement` objects. See the synthetic example in
`scripts/carbon/reconcile-pilot.test.mjs` for the exact field names.
Use string serial numbers and integer paise. Normalize registry identifiers and
serial segments only according to the provider's documented format.

A matching report means the supplied records agree. Authenticate source records
with the provider before a live transaction. A mismatch puts the reconciliation
on hold. This check does not allocate overlapping serials across files or
operate a credit ledger. Use the real provider's settlement terms for
partial trades, another currency or a different settlement model.

Run `node scripts/carbon/monitoring-preflight.mjs path/to/private-period.json`
before the trade rehearsal. The example in
`scripts/carbon/monitoring-preflight.test.mjs` shows the input shape. The tool
checks period boundaries, exact batch mass, and reused allocation IDs within
the supplied records. Use a distinct allocation ID for each traceable share of
a split source. Include all previously reserved allocations in the input.
A match depends on the completeness of those records. The tool reports the
arithmetic difference between supplied baseline, project and leakage values
in grams CO₂e, including a negative result. Method eligibility, factor
selection, lineage across organizations and approved reductions require a
separate review.
