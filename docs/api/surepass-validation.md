# PAN and GST validation contract

Approved owner requirements: optional PAN; GST when registered; verified phone
before checks; check before submission; shared 20 paid attempts per India calendar
day. No retries. Convex secrets/actions only. Development paid calls disabled.

`identityChecks.verify` Convex action: authenticated applicant session. Args:
`applicationId` (optional application ID), `consent: true`. It reads saved draft
values, never arbitrary identity numbers from action arguments. Returns null on
success. Typed Convex errors: VALIDATION_REQUIRED (invalid or unverified input),
CHECK_UNAVAILABLE (disabled, timeout, provider failure), CHECK_LIMIT (20 used),
CHECK_PENDING (duplicate pending request), and existing access errors. Every
provider attempt is reserved atomically before fetch, including failed attempts.
Saved verification is bound to application, check kind, normalized input, and a
24-hour expiry. Pending attempts cannot be retried for 24 hours; explicit retries
of failed checks require a one-minute cooldown. Each action checks only missing
proofs, so successful PAN proof is reused after a GST failure. A request with no
PAN or GST needs no provider call. Submission checks the current saved inputs
against current successful proof; changing input invalidates proof.

PAN: POST https://kyc-api.surepass.app/api/v1/pan/pan-comprehensive,
Bearer SUREPASS_API_TOKEN, JSON id_number and masked_aadhaar_variant=empty.
Accept only success=true, status_code=200 and matching data.pan_number.
GST: POST /api/v1/corporate/gstin-by-pan with embedded PAN from GSTIN.
Accept only success=true/status_code=200/matching data.pan_number and exact
GSTIN with all matching rows active. Reject absent/inactive/conflicting rows.
Discard raw provider payload and all personal data. Never log identity numbers.
Fetch timeout 15 seconds. No automatic paid retries.

Additive migration: new quota/proof tables and optional PAN draft fields; no
record deletion or backfill. Rollback: disable SUREPASS_ENABLED on both deployments
before reverting enforcement. Existing submitted applications remain untouched.
New draft submissions with identifiers always require current successful proof.
Disabled configuration prevents new paid calls; it never bypasses submission
validation. Existing unexpired successful proofs remain valid.

UI: one explicit check action after a short Surepass disclosure. PAN remains
optional. Forms retain values on quota/provider errors. Shared business form
covers yards, recyclers and manufacturers; kabadiwala uses the same check.
Households and Saathis have no PAN/GST field and need no paid checks.
