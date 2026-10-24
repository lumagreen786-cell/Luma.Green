# Surepass implementation plan — 24 October 2026

Contract reviewed against approved owner requirements:
[validation contract](../api/surepass-validation.md) and
[action JSON schema](../api/surepass-validation.schema.json).

Review: accepted. Application ID must identify the owned draft. Disabled provider
configuration must fail closed for supplied identifiers. No provider proof is
required when neither PAN nor GST applies. No scope expansion to other APIs.

1. Backend: additive optional PAN draft fields and proof/quota tables. Validate
   saved identifiers. Reserve each provider attempt atomically against the verified
   account’s 20-attempt India-calendar-day quota, combined across PAN/GST and all
   its applications. Derive the profile from authenticated access. Keep the
   platform-wide counter for aggregate usage tracking, with no applicant cap. No automatic retries. Bind successful
   proofs to current inputs, owning application and expiry. Enforce at submission.
2. Frontend: optional PAN on kabadiwala and shared business form (yard, recycler,
   manufacturer), plus optional PAN on Saathi. Business roles always require GSTIN;
   remove their GST registration opt-out. Keep kabadiwala GST conditional.
   Show the Surepass disclosure and an explicit consent/check
   action. Save current draft before checking. Keep all values on errors. Clear
   visible success when identifiers change. Households stay unchanged. Preserve all non-identity Saathi fields and uploads.
3. Verify: test quota concurrency, mixed PAN/GST attempts, failures, retries,
   duplicate checks, changed inputs, ownership and optional flows without real
   provider requests. Test check-control success/error/input-change behavior and
   translation parity. Run full checks and build; inspect affected browser views.
4. Release: deploy additive backend changes to new development/production only.
   Keep development paid requests disabled. Enable production after tests pass.
   Publish only to the new GitHub repository. Record any live acceptance limits.

Rollback: turn off SUREPASS_ENABLED first; retain draft and verification records.
Do not delete existing applications, identity documents or audit records.

## Optional live operator smoke extension — 25 October 2026

Contract extension reviewed and accepted with the following execution limits:

1. Add only an internal operator smoke action with fixed provider-documented
   example PAN. Do not introduce applicant fixtures, public test endpoints,
   arbitrary IDs, session injection or saved applicant proofs.
2. Reserve within a separate operator example allowance of 20/day and atomically
   enforce one example attempt per kind per India day, including failed attempts.
   Increment aggregate platform usage, without charging an applicant allowance.
3. Run mocked tests for flag-off, duplicate, operator budget and account separation, timeout and no-PII
   output. Enable the temporary example flag only for the authorized live calls.
4. Record only HTTP/availability/verification booleans, then disable the example
   flag. GST lookup without a known input GSTIN must report verified=false.
5. Report live provider transport evidence separately from applicant acceptance;
   never infer an identity match from a paid request or HTTP 200 alone.

## Owner correction — 25 October 2026

The 20/day cap is per verified person/account, combined across PAN and GST. It
supersedes the earlier platform-wide 20/day requirement. The platform can exceed
20 paid calls daily; corresponding provider charges can increase. The reviewed
contract now uses an atomic authenticated profile/day counter, an aggregate
usage-only counter, and a separate tightly bounded operator example allowance.
Tests must prove account A’s exhausted allowance does not block account B, while
multiple applications for account A still share its one allowance. No auth
changes are part of this correction.

## Owner-approved role correction — 25 October 2026

Saathi applicants may supply PAN; supplied PAN must be checked before submission.
Saathi has no GST requirement. Yard/preprocessor, recycler and manufacturer
applications must always provide and verify GSTIN; remove registration opt-out
from their shared form and enforce the rule on the server. Kabadiwala GST remains
conditional on declared registration, with optional PAN. Households have neither
identity field. No changes to Saathi work choices, location or uploads are in scope.
Review accepted; retain existing phone verification, proof binding, per-account
20/day cap and role/access checks. Reuse translated verification controls.

## Superseding GST business-confirmation flow — 25 October 2026

Reviewed and accepted [the revised contract](../api/surepass-validation.md) and
[JSON schemas](../api/surepass-validation.schema.json) before implementation.

1. Remove PAN from every applicant form. Saathi keeps ID/selfie and all work
   fields. Household fields stay unchanged. Business GST remains mandatory;
   shop GST remains conditional on registration.
2. Add owned-draft `lookupGst` with consent and strict active exact-GSTIN provider
   details validation; persist bounded metadata in additive `provider:"gstin"`
   proof. Keep per-account20/day reservations, dedup/cache, timeout and no retries.
3. Add `confirmGst` rechecking owned current input/proof, recording confirmedAt,
   persisting canonical bounded name/address. Legacy proofs cannot pass. Old
   verify is compatibility only and ignoresPAN; it cannot auto-confirm.
4. Frontend: GSTIN entry → explicit lookup → provider name/address preview →
   explicit business confirmation → remaining form. Mirror confirmed metadata;
   retain entered values and honest errors. Translate new controls in all locales.
5. New canonical submissions activate on the server without manual onboarding
   approval. Preserve existing records, review controls and all other admin/auth
   security. Remove applicant-facing promises of manual approval for new signup.
6. Test exact result parsing, invalid/inactive/malformed metadata, auth/quota,
   cache vs legacy proof, stale confirm and changed input, successful activation,
   role requirements and retained Saathi uploads. Inspect new browser flow across
   themes, widths and scripts. Do not represent fixtures as paid provider proof.
