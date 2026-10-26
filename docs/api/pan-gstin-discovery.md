# PAN GSTIN discovery contract — 26 October 2026

Additive Convex interface, existing verified-phone session and application ownership required throughout. Only editable owned kabadiwala/business drafts with gstRegistered true are eligible. Saathi, household and admin have no discovery interface in their flows. All endpoints reject another account and unsupported application kinds.

`identityDiscovery.lookup({applicationId,consent:true})` -> `{pan, registrations:[{gstin,state,stateCode,status}]}`. Reads normalized PAN from saved draft (10 ASCII characters, five letters/four digits/letter). Explicit consent only; no onchange paid calls. POST corporate/gstin-by-pan with {id_number:pan}, Convex-held token, 15s timeout, no redirects or retries. Accept success:true/status_code:200/exact pan_number and <=100 valid entries. Each entry must have matching embedded PAN, bounded state/status/code strings; reject conflicting duplicates, deduplicate exact duplicates. 422 or valid empty list -> validation error/empty state without positive proof. No business names/addresses inferred from this response.

`identityDiscovery.current({applicationId})` -> null or same result. Returns only owned current unexpired verified gstin_by_pan proof, never starts a request.

`identityDiscovery.select({applicationId,gstin})` -> null. Requires saved PAN equal current unexpired discovery proof and active exact registration in list. Atomically save selected GSTIN in canonical draft; clear/invalidate any old GST detail confirmation so stale UI cannot authorize. Client mirrors GSTIN then runs existing explicit detail lookup/confirmation. Business name/address remain owned by identityChecks.lookupGst and confirmGst; discovery cannot satisfy applications.submit.

Typed errors: existing auth/access errors, PHONE_REQUIRED, NO_APPLICATION, VALIDATION_REQUIRED, CHECK_UNAVAILABLE, CHECK_LIMIT, CHECK_PENDING. Quota: existing shared 20 attempts/profile/India day across PAN/GST/all applications, before provider transport. Failed/timeout attempts spent. Current successful identical proof cache reused for 24h; pending blocked 24h and failed cooldown 1 minute. Refuse/ignore stale completions; no data from changed input may be exposed. Audit safe event/kind/status metadata only. Optional proof fields and existing indexes; no destructive migration.

Implementation must test actual Convex results, authorization, consent, quota, cache, selection and stale response behavior. No raw provider payload, extra DOB, full Aadhaar or operational credentials enter public responses or audits.

## Active GST detail transport — same-day provider update

The Production browser catalogue now shows Corporate GSTIN Advanced Active;
standard Corporate GSTIN remains unsubscribed. One authorized published-sample
call returned an active exact registration, legal/business names and a principal
address. Use fixed `POST https://kyc-api.surepass.app/api/v1/corporate/gstin-advanced`
for `identityChecks.lookupGst`, with `{id_number:GSTIN}` and no optional enrichment
flags. No fallback or second paid request. Quota, timeout, exact GSTIN/status
checks and explicit confirmation remain unchanged.

Advanced may return `data.address:null`; use bounded nonempty
`data.contact_details.principal.address` then. If present, `pan_number` must match
the GSTIN embedded PAN. Reject missing/malformed metadata and mismatched IDs.
Persist only existing required business metadata, not contact numbers, promoters
or the unrelated Advanced payload. Canonical proof label `provider:gstin` remains
compatible with existing records; it denotes a detail proof, not a fallback.

## Optional PAN recovery

PAN discovery is an added path, not a new authentication factor. Clearing the
optional PAN restores the direct GSTIN path. Saving a PAN change still removes
old GST confirmation; direct GST detail lookup and explicit confirmation remain
mandatory. A historical unchanged PAN alone does not impose a discovery step.
The server-owned marker prevents client claims of selection while PAN remains
supplied, and is not a permanent lock after PAN removal.

An internal completion settles and audits its matching reservation as failed if
PAN, registration choice or application editability changed during transport.
It does not retain or return stale registrations. Subsequent requests obey the
ordinary failure cooldown rather than an accidental 24-hour pending lock.
