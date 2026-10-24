# PAN and GST validation contract

Approved owner requirements: optional PAN for Saathi and business/shop applicants;
GST mandatory for yard/preprocessor, recycler and manufacturer, conditional on
registration only for kabadiwala; no PAN/GST for households; verified phone
before checks; check before submission; 20 paid attempts per verified account per
India calendar day, combined across PAN and GST and all its applications. This
25 October owner correction supersedes the earlier platform-wide cap. Total
platform usage may exceed 20 calls and incur corresponding provider charges.
No retries. Convex secrets/actions only. Development paid calls disabled.

`identityChecks.verify` Convex action: authenticated applicant session. Args:
`applicationId` (required owned application ID), `consent: true`. It reads saved draft
values, never arbitrary identity numbers from action arguments. Returns null on
success. Typed Convex errors: VALIDATION_REQUIRED (invalid or unverified input),
CHECK_UNAVAILABLE (disabled, timeout, provider failure), CHECK_LIMIT (the account
has used 20 attempts today),
CHECK_PENDING (duplicate pending request), and existing access errors. Every
provider attempt is reserved atomically before fetch, including failed attempts.
`identityPersonCheckDays` is indexed by authenticated `profileId` and India day.
The server derives that profile from the access check, never from caller input.
Changing applications or PAN/GST kinds does not reset the account allowance.
`identityCheckDays` tracks aggregate platform usage only and does not cap
applicants. Authentication and phone verification requirements are unchanged.
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
Saathi has optional PAN only and no GST requirement. Households have no PAN/GST
field and need no paid checks. Business roles have no GST-registration opt-out.
These owner-approved role rules on 25 October supersede earlier conditional-GST
business rules and the earlier exclusion of Saathi from optional PAN validation.

## Owner-authorized operator smoke check — 25 October 2026

This optional extension tests the live provider connection using only the fixed
PAN example `EKRPR1234F` from the provider documentation. It creates no applicant,
application, identity proof, approval or authentication session. The owner
explicitly authorized this small paid check after mocked quota tests.

The operator invokes an **internal Convex action**, unavailable to application
clients, with `kind: "pan" | "gst"`. Arbitrary identity arguments are forbidden.
The action requires normal enabled Surepass configuration and temporary
`SUREPASS_EXAMPLE_TEST_ENABLED=true`. Authenticated deployment-operator CLI access
is required to invoke internal functions; the flag alone is not authorization.
The flag stays off in normal operation and must be removed or disabled directly
after the authorized smoke checks.

Before each outbound call, one mutation reserves an attempt in a separate
20-attempt operator example allowance per India day and records a unique
example-kind/day marker. Operator examples do not consume an applicant allowance.
They increment the aggregate platform count for usage tracking.
Quota and duplicate checks are atomic. At most one PAN example attempt and one
GST example attempt may occur per India day. Timeouts, provider rejection and
malformed responses consume the attempt; there are no automatic retries or
unmetered free-test allowance. Both reserve and completion write audit events that
contain only example kind and non-identifying outcome.

Use the same fixed HTTPS endpoints, Convex-held token, 15-second timeout and
PAN masked_aadhaar_variant=empty request option as applicant checks. Never print,
log, return or persist the raw response or returned personal information.
Return only `{httpStatus: number | null, available: boolean, verified: boolean}`.
A transport failure returns null status and false availability/verification.
A PAN success may set verified only after the normal response validator accepts
its envelope and exact example PAN. A GST example lookup without a known entered
GSTIN returns verified=false: successful lookup transport does not establish
GST registration validation or applicant ownership. HTTP success and provider
business success remain distinct observations. These calls do not establish
real-applicant acceptance or bypass any application-submission checks.
