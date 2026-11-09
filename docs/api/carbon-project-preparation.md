# Carbon project preparation

This workspace flow records a facility, a candidate method and references to
documents held outside Luma. It supports an internal review of a record set.
Each reference remains reported and unverified. This flow creates no credit,
registry submission, trade, retirement, payment or verifier access.

## Workspace API

| Function                        | Input                                                                             | Result                                                                                                         |
| ------------------------------- | --------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| `carbonProjects.mine`           | Selected workspace ID                                                             | Up to 50 of its most recently updated projects, with the current reference for each kind and a limit indicator |
| `carbonProjects.create`         | Selected workspace ID, facility ID, project name and method                       | Draft project ID                                                                                               |
| `carbonProjects.recordEvidence` | Selected workspace ID, project ID, kind, document reference and expected revision | Updated draft, with the previous references retained                                                           |
| `carbonProjects.review`         | Selected workspace ID, project ID and expected revision                           | Internal review when the four required reference kinds are present                                             |
| `carbonProjects.batches`        | Selected workspace ID and project ID                                              | Up to 40 attached transformations with recorded input grams and attachment times                               |
| `carbonProjects.batchOptions`   | Selected workspace ID and project ID                                              | Eligible transformations in the latest 50 records for that facility, with input grams and transformation times |
| `carbonProjects.attachBatch`    | Selected workspace ID, project ID, transformation ID and expected revision        | Records an internal batch link and returns the project to draft                                                |
| `carbonProjects.detachBatch`    | Selected workspace ID, project ID, transformation ID and expected revision        | Removes the active batch link and returns the project to draft                                                 |

Workspace members with read access can see projects. Operators can create a
project for a facility in their selected workspace and record references.
Workspace managers can record the internal review. Each change writes an audit
event in the same transaction. A write with an old revision fails and must
reload before retrying. A changed reference returns the project to draft.
Repeated identical requests with the current revision cause no extra write.

Supported screening methods are Verra VMR0007, BEE BM WA03.003, BEE BM IN02.001
and Verra VMR0008. The required reference kinds are baseline, monitoring,
claim rights and a verification report. Registry project, issuance, transfer
and retirement references are optional. A reference is not a signed report or
provider response. Record identifiers only. Keep credentials, personal data
and document contents out of reference fields.

An operator can attach a transformation recorded for the same workspace and
facility. A transformation without a facility or with an investor demo
record cannot be attached. Each transformation can be attached to one project
and each project can hold up to 40 links. The picker reports when older
facility records are outside its read limit. The link records the input mass
for internal provenance. Stock, eligibility, credit quantities and claim
rights are outside this operation. An operator can remove a mistaken link.
The audit log keeps both events, including the removed link and its original
attachment time. The transformation becomes available for a new project link.

The schema adds empty project and batch link tables and lookup indexes on
existing records. Existing records do not need a data migration. In a
rollback, disable new project writes and retain the tables and audit history.

## Frozen internal review

The existing review mutation saves an immutable snapshot in the same transaction
as its audit event. A manager can review a legacy current revision to create its
first snapshot. The new `carbonProjects.reviewSnapshot` query takes the selected
workspace ID, project ID and review revision. It returns the matching snapshot
or null for an unknown revision. Cross-workspace access is denied. The snapshot
contains the candidate method, facility ID, document references and linked batch
IDs with exact recorded input mass. It is an internal export of reported records.
It carries no eligibility, measurement approval, or issuance status.

Old snapshots remain readable by revision after a correction. The workspace
only offers the current snapshot for download. No backfill is required. On
rollback, keep the snapshot table and audit records for prior reviews.

## Framework screening

The Carbon projects screen can show a separate screening for Verra VCS,
Gold Standard, Climate Action Reserve, Puro.earth, ACR, India CCTS and the
GHG Protocol. The PET example's method fit is guidance. The actual project's
activity and eligibility need their own evidence. The GHG Protocol checklist
covers accounting without issuance, transfer or retirement gates.

The optional industry on `carbonProjects.create` selects one of five
activity checklists and must match the selected candidate method. Existing
projects can use `carbonProjects.assignIndustry` with the project revision
to set a compatible industry once. Assignment opens a new draft revision
and leaves historical snapshots readable. New snapshots include the
industry when set. Other framework screens remain available for comparison.

- `carbonProjects.frameworkScreenings` takes the selected workspace and
  project IDs. It returns the current recorded gates and revision per
  framework. An absent gate means no evidence assessment has been recorded.
- `carbonProjects.recordFrameworkCheck` takes those IDs plus the framework,
  gate, expected revision, reported status and short evidence reference.
  The first write uses revision 0. The server verifies membership, operate
  permission, project scope and that the gate belongs to the framework.
  A conflicting revision requires a reload. The audit event stores the
  gate and status without copying the private reference. Screening shows the
  current reference for each gate. The audit log retains the status changes.
  The frozen project review has its own document references.

The supported and contradicted statuses are workspace reports. They do
not verify a document, approve eligibility or change a frozen project review.
This flow has no registry credentials, uploads or provider writes.
