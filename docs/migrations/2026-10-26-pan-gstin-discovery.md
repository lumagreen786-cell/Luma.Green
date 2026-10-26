# PAN GSTIN discovery additive migration

The existing optional business/shop draft PAN field is reused. New optional
provider/list metadata on identityChecks distinguishes GSTIN-by-PAN discovery
from historical PAN and GST proofs. No record deletion, backfill, index removal,
auth migration or native change is required. An optional server-owned
`applications.panDiscoveryRequired` marks a new/changed business PAN; unchanged
legacy PAN drafts keep their direct-GST route. Discovery reservations also set
this flag. Client input cannot set or reset it. Existing GST detail confirmation
continues to own submission eligibility. Discovery cannot replace it.

Deploy additive schema/functions before a frontend that calls the new functions.
Development paid calls remain disabled. Rollback disables Surepass requests first,
then reverts frontend/functions while leaving optional fields readable. Removing
the fields later requires a separate record audit and explicit migration plan.

Verification must cover an existing record without the new fields, owned current
proof reuse, another applicant's denial, unsupported role denial and stale PAN
selection rejection. Local tests do not establish provider activation.
