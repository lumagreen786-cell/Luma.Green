# R2 storage plan

**Status:** first quality-attachment stage implemented locally, 15 October 2026.
R2 is off until configured. Live Cloudflare and native-device acceptance remain
open. Application/identity documents still use Convex. No bucket or paid service
has been created. Organization/workspace APIs are documented in [the backend contract](organizations.md).

The owner confirmed that all current data is disposable internal prototype data.
No migration is required until rollout is declared; see `AGENTS.md`. The existing
Convex path remains for unconfigured local/demo use, not as migration machinery.

## Goal and existing owners

Use the same Cloudflare account as Turnstile for file storage across the web,
mobile and desktop apps. Convex remains the database and permission authority.
R2 stores bytes; it does not replace sign-in, memberships or the audit log.

Today `convex/applicationFiles.ts` validates application uploads and
`convex/files.ts` serves private files after authentication. `convex/qualityFiles.ts`
has separate inspection and buyer-sharing rules. These rules must remain with
their current owners. Application identity files must not become visible to a
whole team merely because their owner joins a workspace.

Options:

| Option                                            | Benefit                                | Cost or limit                            |
| ------------------------------------------------- | -------------------------------------- | ---------------------------------------- |
| Keep all files in Convex                          | Least change                           | Does not add the requested R2 capability |
| Add R2 for new uploads, preserve old Convex files | Small, reversible rollout; recommended | Two storage locations during transition  |
| Move all files at once                            | One provider immediately               | Larger migration and recovery risk       |

Each attachment records its storage location. Reads select that location; they
do not try a second provider on failure. There is no bulk-copy migration job.

## Implemented first stage

New quality attachments can use private R2 storage when enabled. Existing file
size, content checks, record ownership and buyer-sharing rules remain. Application
documents, public hosting, video, general team drives and bulk migration are out
of this stage. Withdrawal retains stored evidence and blocks reads, as before.

Keep authenticated file reads on the existing backend routes. After checking
current access, the backend reads the R2 object and serves it with private,
no-store headers. The 2 MiB file limit is below Convex's documented action-argument and HTTP
response limits. Downloads are attachments and are never redirected to signed
R2 URLs. Downloads check stored size and SHA-256 before returning bytes.

Use a narrow storage helper for put/get/delete. Business policy stays in
application and quality modules. All network work belongs in actions/HTTP actions;
transactional metadata changes belong in mutations.

### File lifecycle

The initial signed-browser-upload proposal was simplified after code inspection:
`qualityFiles.upload` already receives and validates bounded bytes. Keep that
single public action, with no frontend or native protocol change.

1. Check current workspace permission and inspection ownership.
2. Validate the name, file size, detected type and existing PDF restrictions.
   Calculate SHA-256 from the exact bytes. This is not malware certification.
3. When R2 writes are enabled, reserve an opaque UUID key in `qualityUploads`.
   Enforce at most 20 attached/pending files per inspection and 60 reservations
   per profile per hour. Audit the reservation. No personal data enters the key.
4. Write the same validated bytes server-to-server using `aws4fetch`. This uses
   Fetch/WebCrypto in the Convex runtime; no Node-only SDK or component tables
   are needed. No signed upload/download URL is returned to the browser.
5. Recheck membership, inspection, quota and reservation before attaching. Record
   the R2 account, bucket, key and checksum. Finalization is idempotent for an
   attached reservation. Mark attached and write the audit event atomically.
6. Failed/ambiguous writes retain their reservation. A 15-minute cron claims
   reservations older than one hour, deletes unreferenced objects and audits
   deletion. Failures remain in `deleting` with an attempt counter and retry in
   an hour. Each run handles at most 20 objects. Attached objects are not claimed.

An outage fails closed. Disabling new R2 writes preserves R2 reads and cleanup
when credentials remain configured. Configuration must match the account and
bucket recorded on the file. Never change the bucket setting while expecting
old R2 files to be available; reset prototype records deliberately if needed.

The maintained Convex R2 component was considered. This bounded server-byte
path uses Cloudflare's documented `aws4fetch` signer instead, so attachment
metadata and private routes retain one owner. See
[aws4fetch](https://developers.cloudflare.com/r2/examples/aws/aws4fetch/) and
[Convex limits](https://docs.convex.dev/production/state/limits).

## Configuration and activation

Create separate private staging and production buckets, with public `r2.dev`
access disabled. This stage uses the default global R2 S3 endpoint; jurisdiction-specific
endpoints are not implemented. Use synthetic demo documents in a matching bucket.
Before real rollout, decide the required data location and add endpoint support
if a jurisdiction-specific bucket is needed. Review retention and deletion requirements
against `docs/operations/data-protection.md`.

| Setting                | Location               | Purpose                                        |
| ---------------------- | ---------------------- | ---------------------------------------------- |
| `R2_ENABLED`           | Convex                 | Explicit opt-in for new writes; off by default |
| `R2_ACCOUNT_ID`        | Convex                 | Account endpoint                               |
| `R2_BUCKET_NAME`       | Convex                 | Environment-specific private bucket            |
| `R2_ACCESS_KEY_ID`     | Convex secret settings | Bucket-scoped service credential               |
| `R2_SECRET_ACCESS_KEY` | Convex secret settings | Private signing secret                         |

Validate these through `src/lib/env.ts`. No R2 secret belongs in a public Next.js
variable or native bundle. Missing configuration keeps existing Convex behavior;
partially configured enabled service fails closed. Disabling new R2 writes must
not disable reads of files already stored there.

No bucket CORS or public domain is needed: only the backend contacts R2. Hosted
web, mobile and desktop screens continue to use the existing authenticated
Convex action/download route.

### Activation checklist

1. Activate R2 in the existing Cloudflare account. Confirm any dashboard billing
   requirement. Create a private Standard bucket for staging. Do not enable
   public `r2.dev` access or a public custom domain.
2. Create an Object Read & Write API credential scoped to that bucket only.
   Add the five settings above to the matching Convex deployment, initially
   with `R2_ENABLED=false`. No frontend environment variable is required.
3. Deploy the backend/schema and set staging `R2_ENABLED=true`. Use synthetic
   quality PDF/image files to test upload, authenticated download, withdrawal,
   denied unrelated-user access, and failed-upload cleanup. Confirm that files
   appear in the intended bucket and that public reads fail.
4. Repeat from web and native hosted screens. Mock tests are not provider or
   real-device acceptance. Check byte limits and latency on mobile connections.
5. For a hosted demo, configure a separate private bucket/credential, deploy,
   then enable. Keep the existing Convex settings for application documents.
6. To roll back new writes, set `R2_ENABLED=false`. Keep R2 credentials and bucket
   settings so prior R2 attachments remain readable and cleanup can run.

Inspect `qualityUploads` in the Convex dashboard for old `pending`/`deleting`
rows and rising `attempts`; do not mark cleanup complete during an outage. Never
put credentials, file bytes or signed request headers in logs/screenshots.

### Verification and limits

Tests exercise the real Convex schema, auth handler and file routes with an
in-memory R2 provider. They cover both storage paths, access revocation, invalid
files, missing settings, rollback reads, corrupted bytes, upload failure,
idempotent finalization, reservation limits and retryable cleanup. Generated
bindings must be refreshed with the schema.

No migration, backup-copy job or object-list deletion endpoint is introduced.
Prototype data may be reset when needed under the owner's policy. Before real
rollout, review retention, object deletion, backup/restore and quota capacity.
A future backup must include both metadata and bytes; a Convex database export
alone does not contain R2 objects. Files withdrawn as evidence are retained,
not physically deleted by the abandoned-upload cleanup job.

## Cost and shared account

Official pricing checked 15 October 2026: R2 Standard includes monthly allowances
of 10 GB-month, 1 million Class A operations and 10 million Class B operations.
Beyond these: $0.015/GB-month, $4.50/million Class A and $0.36/million Class B.
Direct R2 egress is free; backend delivery and other services can still cost
money. Set usage alerts and application quotas; alerts are not a hard spending cap.
See [R2 pricing](https://developers.cloudflare.com/r2/pricing/).

R2 needs separate activation in the existing Cloudflare account; confirm current
billing/payment requirements in the dashboard before activation. Turnstile setup
does not create buckets. DNS/CDN and Workers can use that account too; neither is
required by this proposal. Do not add Workers solely to add another proxy.

Technical references: [signed URLs](https://developers.cloudflare.com/r2/api/s3/presigned-urls/)
and [CORS](https://developers.cloudflare.com/r2/buckets/cors/).
