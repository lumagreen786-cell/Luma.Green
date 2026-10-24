# GST lookup and confirmation contract — 25 October 2026

This owner-approved contract supersedes earlier optional-PAN onboarding rules.
Remove every applicant PAN input, including Saathi, shop and business forms.
Households and Saathis have no PAN/GST checks. Preserve Saathi ID/selfie uploads,
phone verification, all other required form fields and existing admin security.
GSTIN is mandatory for yard/preprocessor, recycler and manufacturer; kabadiwala
GST remains conditional on registration. New valid submissions activate through
the server without a manual onboarding approval step. Existing submitted/reviewed
records and other administrative controls remain intact.

## Public Convex contract

`identityChecks.lookupGst` is an authenticated, verified-phone action. Arguments:
`{applicationId, consent:true}`. Read and normalize GSTIN from the saved editable
owned draft; never accept arbitrary identity numbers or profile IDs in arguments.
Return `{gstin,businessName,legalName,address}` only after a valid active exact
GSTIN result. Existing access errors and typed `VALIDATION_REQUIRED`,
`CHECK_UNAVAILABLE`, `CHECK_LIMIT`, `CHECK_PENDING` errors apply. No provider
response or token is returned beyond these four required fields.

`identityChecks.gst` is an owned, verified-phone query taking `{applicationId}`.
It returns null or `{gstin,businessName,legalName,address,confirmed:boolean}` for
only the current unexpired successful provider-gstin proof. It never spends a
paid attempt. The frontend uses it to restore confirmed state after reload.

`identityChecks.confirmGst` is an authenticated verified-phone mutation. Arguments:
`{applicationId,gstin}`. Return null. Recheck application ownership/editability,
current normalized saved GSTIN, unexpired successful proof with
`provider:"gstin"`, and nonempty provider business metadata. Ignore all client
business metadata. Atomically set server `confirmedAt` and persist provider name
and address in the canonical draft: businessName maximum120, shopName maximum80;
copy address only when it fits the canonical200-character limit. Full metadata
remains on the restricted proof, bounded to500 characters for each name and2000
for address. The operating address may later be edited; such edits are not a
provider-verified operating-location claim.

The frontend displays returned name/legal name/address, asks for explicit business
confirmation, then reveals the rest of the form. It mirrors the same bounded name
and address only after successful confirmation. Input edits invalidate visible
confirmation. Reload may explicitly re-request the same lookup: matching current
proof reuses cached metadata without a paid call. Submission requires current
unexpired confirmed `provider:"gstin"` proof whenever GST applies. Legacy
GSTIN-by-PAN proofs never unlock, confirm or satisfy new submission requirements.
Compatibility `verify` retains its arguments and null return but ignores PAN,
uses the GST lookup path only and cannot auto-confirm for the applicant.

## Provider and spending controls

POST `https://kyc-api.surepass.app/api/v1/corporate/gstin` with Convex-held Bearer
`SUREPASS_API_TOKEN` and JSON `{id_number:GSTIN}`. Accept only `success:true`,
`status_code:200`, exact matching `data.gstin`, and `data.gstin_status:"Active"`.
Required metadata: `business_name`, `legal_name`, `address`. Reject missing,
inactive, malformed or mismatched results. Discard unrelated returned data.
Read-only provider documentation:
https://app.surepass.app/docs/kyc/gstin-16301821e0

Reserve each paid attempt atomically before transport against the authenticated
profile's combined20-attempt India-calendar-day allowance across its applications.
The platform-wide counter tracks aggregate usage only; platform totals may exceed
20 and incur charges. Timeouts/provider failures consume an attempt. No automatic
paid retries, no client-triggered on-change requests, 15-second timeout and no
HTTP redirects. Duplicate pending checks are blocked for24 hours; explicit failed
retry has a one-minute cooldown. Matching successful proof/metadata has24-hour
expiry and cache reuse does not spend another attempt. Secrets/actions live only
in Convex. Development paid calls remain disabled. Logs/audits omit identifiers,
returned names/addresses and provider payloads; record only safe outcome/kind.

## Additive rollout and rollback

Add optional provider metadata/confirmation fields to the proof schema; retain
historical optional PAN validators and records without using them in new flows.
No record deletion/backfill or auth changes. Enforce confirmation for new GST
submissions and activate only after canonical form validation. Rollback disables
`SUREPASS_ENABLED` before reverting; disabled provider configuration cannot bypass
proof requirements. Local mocked tests establish quota/UI behavior, not live
provider acceptance or real-applicant ownership.

Earlier owner-authorized internal operator smoke calls used fixed documented
samples, temporary feature flags and separate bounded operator quotas. They did
not create applicant proofs or establish the new GSTIN-detail endpoint acceptance.
