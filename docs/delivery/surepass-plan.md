# Surepass implementation plan — 24 October 2026

Contract reviewed against approved owner requirements:
[validation contract](../api/surepass-validation.md) and
[action JSON schema](../api/surepass-validation.schema.json).

Review: accepted. Application ID must identify the owned draft. Disabled provider
configuration must fail closed for supplied identifiers. No provider proof is
required when neither PAN nor GST applies. No scope expansion to other APIs.

1. Backend: additive optional PAN draft fields and proof/quota tables. Validate
   saved identifiers. Reserve each provider attempt atomically against one shared
   20-attempt India-calendar-day quota. No automatic retries. Bind successful
   proofs to current inputs, owning application and expiry. Enforce at submission.
2. Frontend: optional PAN on kabadiwala and shared business form (yard, recycler,
   manufacturer). Show the Surepass disclosure and an explicit consent/check
   action. Save current draft before checking. Keep all values on errors. Clear
   visible success when identifiers change. Household/Saathi flows stay unchanged.
3. Verify: test quota concurrency, mixed PAN/GST attempts, failures, retries,
   duplicate checks, changed inputs, ownership and optional flows without real
   provider requests. Test check-control success/error/input-change behavior and
   translation parity. Run full checks and build; inspect affected browser views.
4. Release: deploy additive backend changes to new development/production only.
   Keep development paid requests disabled. Enable production after tests pass.
   Publish only to the new GitHub repository. Record any live acceptance limits.

Rollback: turn off SUREPASS_ENABLED first; retain draft and verification records.
Do not delete existing applications, identity documents or audit records.
