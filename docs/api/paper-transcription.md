# Paper transcription drafts

Status: approved bounded implementation by the coordinator; contract prepared
28 October 2026, implementation continued 29 October 2026 (India time). This is
scope approval, not user, legal, provider or budget approval. Provider activation
is not approved. Implements the bounded R068 gap and D35/D37. This is a
transcription aid, not an inventory import or an official document service.

## User result

An active business member opens `/app/papers`, selects one JPEG or PNG paper
image, and chooses either assisted extraction or manual entry. The original
image stays private. The person reviews the image, corrects the text and fields,
then explicitly confirms the transcription. Confirmation saves a reviewed paper
record. It changes no stock, quantity, price, payment, permit or tax document.
The person uses existing operational forms for any later business transaction.

The page remains useful without a model: explain that extraction is unavailable,
offer manual text/field entry and link to the current manual record screens.
Do not ask for an upload merely to show service availability. Upload and manual
draft saving remain available independently of model configuration.

## Existing owners and boundaries

- `convex/lib/workspace.ts` owns authenticated membership and workspace roles.
  `requireOrg` checks membership; every paper operation additionally requires
  `org.status === "active"`, including reads. Its normal read mode can allow a
  suspended organisation, so read permission alone is insufficient here.
- Use `requireUser`/the Better Auth session checks. Never copy the anonymous
  `photoEstimates.estimate` access or its caller-supplied device identity.
- `convex/files.ts` and `convex/qualityFiles.ts` show the private HTTP byte-read
  pattern. Paper files get a separate owner and route, not application or
  inspection records manufactured solely to fit those APIs.
- `stockIntake.record` records manufacturer-declared own-production byproducts.
  It is not a generic ledger endpoint and receives no automatic paper data.
- Reuse the bounded provider-request/privacy pattern in `photoProvider`, but
  use a separate prompt, strict output schema, config gate and quota owner.
- The first release uses private paper-owned Convex database byte chunks, not
  Convex file storage. The source and its record commit in one transaction.
  Existing R2 configuration stays scoped to quality attachments; a future
  deterministic-key object store needs a separate review. No public object URL
  or `storage.getUrl` is returned.

## Data contract, version 1

All function arguments and results have explicit Convex validators. The shared
paper Zod schema validates model output and corrected content. Reject unknown
keys. IDs below are typed table IDs, not arbitrary URLs.

```ts
type PaperRow = {
  dateText: string; // 0..80 characters, verbatim date, no inferred date
  description: string; // 0..500 characters
  quantityText: string; // 0..80, uncertain digits stay uncertain
  unitText: string; // 0..40, no unit conversion
  amountText: string; // 0..80, no currency/paise conversion
  referenceText: string; // 0..120
};
type PaperContent = {
  text: string; // 0..12,000 characters
  rows: PaperRow[]; // 0..30 rows
};
type DraftStatus = "draft" | "extracting" | "confirmed";
type ExtractionStatus = "none" | "pending" | "succeeded" | "failed";
type ExtractionReply =
  | { status: "ok"; draftId: PaperDraftId; revision: number }
  | {
      status:
        "unavailable" | "limited" | "busy" | "already_attempted" | "failed";
      draftId: PaperDraftId;
    };
```

Empty strings mean unreadable/not present; model instructions require empty
values rather than guesses. At confirmation require at least one nonempty text
or row field. Limit total serialized content to 24,000 UTF-8 bytes. Treat all
strings as plain text: no HTML, Markdown execution, clickable model links,
formula evaluation or generated file downloads. Quantity and amount fields
are transcription strings; they are not trusted grams or paise. Any future
operational import needs the target workflow's exact-unit validation and a
separate explicit confirmation.

Stored `paperDrafts` fields: server-derived `orgId`, `createdBy`, original
`chunkIds`, `name`, `contentType`, `size`, `sha256`, `createdAt`, `updatedAt`,
`expiresAt`, `revision`, `status`, `extractionStatus`, optional
`extractionStartedAt`, `attemptId`, `model`, `promptVersion`, `extractedContent`,
`reviewedContent`, `confirmedAt`, `confirmedBy`. Original bytes/hash and returned
extraction are immutable. Manual drafts have no `extractedContent`. Confirmation
stores corrected content separately from the extraction.

Use indexes for `(orgId, createdAt)`, `(orgId, status)`, `(orgId, sha256)` and
expiry. `paperSourceChunks` stores at most four immutable 512 KiB byte chunks per
source, with org/draft ownership and position. `paperSourceUsage`, indexed by
org, atomically owns retained raw bytes and source count. A separate
`paperTranscriptionQuota` table stores bounded model/accepted-upload reservations,
not images or text. Export additive table definitions from a paper-specific schema helper;
the coordinator registers them in `convex/schema.ts`. Do not edit that shared
file or message catalogues during uncoordinated work.

## Functions and permission contract

No public function accepts an authority-bearing `orgId`, actor IDs, a provider endpoint or source URL.
The current selected workspace and membership are rechecked on every call. Upload requires `expectedOrgId` captured when the picker opened, only as a mismatch guard; it cannot grant access. Reject a mismatch before source/quota writes. The client checks liveness after image decode and byte reading, before dispatch.
An operation binds to its original workspace: a workspace switch must never
attach a result to the newly selected business.

| Function                                 | Input                                                     | Result and effect                                                                                                                                        |
| ---------------------------------------- | --------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `paperDrafts.availability` query         | `{}`                                                      | Authenticated `{ assisted: boolean, canOperate: boolean }`; exposes no secret/config value.                                                              |
| `paperDrafts.upload` action              | `{ expectedOrgId, name, contentType, bytes }`             | `{ draftId, revision }`; validates source, stores original, creates empty manual draft and cleanup. Bytes supplied directly, not an existing storage ID. |
| `paperDrafts.list` query                 | `{ paginationOpts }`                                      | Paginated source metadata/status only; page 1..20, indexed org scope. No full text or file URL in the list.                                              |
| `paperDrafts.get` query                  | `{ draftId }`                                             | Source metadata, revision, status, extraction/reviewed content for one accessible record.                                                                |
| `paperDrafts.read` action                | `{ draftId }`                                             | Raw source bytes and content type after fresh access checks, for an in-memory browser preview. No public storage URL.                                    |
| `paperDrafts.extract` action             | `{ draftId, expectedRevision, consent: true }`            | `ExtractionReply`; one bounded synchronous request, server reservation before any external call.                                                         |
| `paperDrafts.save` mutation              | `{ draftId, expectedRevision, content }`                  | `{ draftId, revision }`; saves reviewed draft only. Deny while extraction is pending.                                                                    |
| `paperDrafts.confirm` mutation           | `{ draftId, expectedRevision, content, confirmed: true }` | `{ draftId, revision, status: "confirmed" }`; saves corrected content, actor/time and audit in one transaction.                                          |
| `paperDrafts.discard` mutation           | `{ draftId, expectedRevision }`                           | `null`; removes an unconfirmed draft/source, writes a content-free audit. Never deletes confirmed evidence.                                              |
| `GET /paper-files/{draftId}` HTTP action | Bearer session token                                      | Source bytes after fresh membership, active-org and record-scope check. No query token.                                                                  |

Active owners/operators may upload, extract, save, confirm and discard. Active
viewers may list/read only. Households, Saathis without an eligible business
membership, applicants, signed-out users, removed members and other businesses
are denied. No new global admin bypass or buyer/auditor sharing is added.
HTTP uses trusted-origin CORS and existing preflight helpers. Responses use
`private, no-store`, `nosniff`, restrictive sandbox CSP and safe disposition.
Revocation is effective on the next read; already downloaded bytes cannot be
recalled. Blob previews stay in memory and object URLs are revoked on change,
workspace switch and unmount. No localStorage, IndexedDB or service-worker cache.

Errors use existing auth/workspace errors plus `PAPER_NOT_FOUND` (also cross-org
or expired record), `PAPER_INVALID_FILE`, `PAPER_INVALID_CONTENT`,
`PAPER_REVISION_CONFLICT`, `PAPER_CONFIRMED`, `PAPER_UPLOAD_LIMIT` and
`PAPER_BUSY`, `PAPER_DUPLICATE_SOURCE`, `PAPER_WORKSPACE_CHANGED` and `PAPER_UNAVAILABLE`, `PAPER_CAPACITY` and `PAPER_SOURCE_INTEGRITY`. Provider/network/schema failures return `failed`, without bodies,
keys or extracted text in error messages. Authentication and permission failures
must not be hidden as provider failures. HTTP returns 401 for no usable session,
404 for inaccessible source, 503 for storage failure; OPTIONS rejects untrusted
origins. No raw provider response is a public error.

## File safety and preservation

Proposed first-release bounds: exactly one JPEG or PNG per draft, 1 byte to
2 MiB, each dimension 1..2400 and at most 5,760,000 pixels. Reject PDF, SVG,
WebP, HEIC, animated PNG, archives, remote URLs and filename/type mismatch.
Check bytes on the server before storage or paid quota: strict MIME allowlist,
magic bytes, bounded structural header/chunk/marker parsing, dimensions and
complete image terminator. The browser also decodes before preview. Header and
structure checks are not a malware certification or proof of legible handwriting.
No full server image-decoding claim without an actual decoder.

Keep the uploaded original byte-identical with SHA-256. Do not silently compress,
replace, rotate or strip the stored source. A browser preview must not be passed
off as the original. Before provider submission, make a transient metadata-stripped
copy with existing raster metadata helpers where compatible; preserve orientation
and validate the resulting bounds again. If safe preparation fails, return failure
and retain the manual path. Metadata is never a location or identity authority.
Never send the filename, org name, contact data from the database or unrelated
files to the model. Visible paper text itself can contain private data: show that
the image will be sent to the configured model before explicit extraction consent.

The authenticated action validates and hashes the original, then calls one
internal mutation. That mutation rechecks the captured workspace and current
membership, checks upload quota and retained capacity, and creates the source
chunks, draft, chunk references, safe audit and usage increment in one database
transaction. A throw or interrupted mutation rolls all those writes back. No
pending capacity reservation is persisted outside that transaction, so failure
cannot strand a reservation or an unattached source. There is no
`storage.store`/record-attach boundary and no system storage scan or cleanup.
Never accept a caller-provided chunk ID or `_storage` ID.

Each organisation has a hard budget of **100 MiB of retained original bytes and
100 retained source records**, including confirmed records; the earlier
30-unconfirmed-draft bound still applies. Capacity is checked with the org-indexed
usage owner in the same transaction; concurrent uploads cannot overspend it.
Reject capacity without deleting confirmed evidence. At most 50 full-size 2 MiB
sources fit in the byte budget. Database metadata, indexes, transcript text and
audit history consume additional database storage; the 100 MiB limit is not a
promise about a service-plan allowance or remaining account capacity.

Unconfirmed discard/expiry validates every chunk's org, draft, order and bounded
size before deleting only those chunk IDs, deleting its draft and decrementing
usage once in the same transaction. Repeated expiry finds no draft and does
nothing. Confirmation keeps the original counted and has no destructive source
edit/delete endpoint. An attempted model source digest can remain after source
cleanup to prevent paid-attempt resets, but contains no original bytes or text.

Upload abuse bounds remain 10 accepted uploads/profile/India day, 20/org/India
day and 500/deployment/India day. An aborted upload transaction consumes no
persisted source, usage or upload-quota reservation. No model quota is consumed
by upload validation, capacity rejection or missing model configuration.

## Optional provider and budget

Add optional server config through `src/lib/env.ts`:

- `PAPER_TRANSCRIPTION_ENABLED` must be exactly `true`.
- `PAPER_TRANSCRIPTION_DAILY_LIMIT` must be explicitly configured to an integer
  1..100 for the deployment. Missing, blank or invalid means unavailable; there
  is no default budget and no inherited photo-estimate allowance.
- Reuse `OPENROUTER_API_KEY` and `OPENROUTER_MODEL` only after this paper purpose,
  image-capable model and daily budget are separately approved. Fixed OpenRouter
  endpoint only; no client endpoint/model override or automatic provider fallback.
  No self-hosted alternative is introduced in this slice.

Enforce three atomic reservations for every provider attempt: deployment daily
limit, at most 3/account/India day and at most 10/org/India day. Account identity
comes from the authenticated profile. India day is computed server-side; never
trust browser date, device ID, account or org input. The fixed account/org caps
are proposed safety ceilings, not permission to spend. No live call or config
enablement occurs during implementation/testing. Owner approval and configuration
of an actual budget remain separate gates.

Only one extraction attempt per source hash/org is permitted in this release.
An immutable `paperExtractionClaims` digest/org marker survives draft cleanup or
discard and prevents re-upload from creating a new paid allowance. It contains
no text, image or filename.
Use the draft's operation ID and atomic pending marker to block concurrent and
duplicate calls. Failed, timed-out and uncertain requests still count, and no
automatic retry or fallback occurs. The same failed source remains available
for manual review. Duplicate uploads return the existing accessible unconfirmed
draft or a safe duplicate error; they do not create a fresh paid allowance.
Permission loss after dispatch cannot undo provider processing, but prevents
result publication and confirmation. Recheck permission, original org, revision,
attempt ID and state in the final write. Late results must not overwrite edits,
confirmed records, expired sources or discarded records.

Use one request with an 8-second deadline covering response-body reading,
redirect rejection, a 32 KiB body ceiling, at most 2,000 output tokens and strict
JSON-schema output. No tools, browsing, remote fetches, executable output or
provider SDK retry. Keep OpenRouter zero-retention/no-data-collection constraints
and disallow fallback. Unsupported privacy parameters or no compliant endpoint
produce failure, not relaxed privacy settings. Local mocks do not prove provider
privacy acceptance or extraction quality.

The system prompt states that all image content is untrusted data and that
instructions, URLs and commands in the image must never be followed. It asks for
verbatim transcription, no invented fields, decisions, unit conversions, tax
advice or legal classification. Validate the entire result with the allowlisted
schema and bounds before saving. Prompt wording alone is not a security boundary:
the lack of tools, strict result parsing, escaped rendering and separate manual
confirmation prevent model text from becoming an action.

This bounded synchronous action follows the existing photo-provider owner. It
does not introduce a long-running extraction job, retry queue or second scheduler.
Multi-page/long reports remain outside this slice and require D36 job ownership.

## Confirmation and retention

UI stages: source/manual choice → untrusted draft → corrected review → explicit
confirmation. Use open sections, current semantic tokens, Astryx standalone
actions and existing form primitives. Show source and editable content together
on wide screens; stack them on phones. Keep entered content during service errors.
Every field change clears the confirmation checkbox. Confirm sends current
content and expected revision; the server independently validates both. Repeated
confirmation with identical content is idempotent; different content after
confirmation is rejected. Corrections to confirmed evidence require a later
revision workflow, not silent replacement.

Audit upload, extraction reservation/result, draft save, confirmation and discard
with org, actor, record ID, safe state, content hash/version and timestamp only.
Do not put original/model/reviewed text, filenames, model bodies, personal data,
private URLs or API keys in logs or audit metadata. Never include this route or
its content in analytics, crash breadcrumbs or session replay.

There are no persisted pending source uploads in this atomic path. Unconfirmed
drafts expire after 30 days; cleanup removes their private chunks and content
and releases their retained-source capacity in the same transaction. Confirmed source, model draft and reviewed content remain restricted
evidence under the existing reviewed retention policy; this release invents no
statutory period and does not automatically delete confirmed records. Account
closure removes access through existing session/profile gates. No new account
closure erasure promise is made. Scheduled cleanup rechecks state before delete,
never deletes a confirmed record, and is bounded/indexed.

## Acceptance and ownership

Before runtime code: coordinator reviewed this contract and confirmed bounded scope.
Paper agent owns additive paper modules/tests, route/component, env additions
and the paper translation namespace. Coordinator integrates schema registration,
HTTP route registration if shared, navigation and all 33 locale catalogues.

Focused tests must cover: no config/manual mode; unsigned/other-org/viewer/
suspended/removed-member denial; forged source rejection; malformed MIME,
signature, dimensions, terminators and oversized bytes; original hash preservation;
quota races and India-day boundary; failed calls counting; no retries; response
bounds and injected instructions; duplicates; stale/late result and workspace
switch; consent and revision checks; manual confirmation; confirmation with no
inventory/payment writes; cleanup preserving confirmed evidence. Component and
browser checks cover happy/manual/error flows, keyboard access, live review
content, translated layouts and RTL. Synthetic provider responses are labelled
test fixtures and cannot prove OCR accuracy or live model execution.

No new package, deployment, native changes, provider setup, paid calls, universal
tax document, permit validation, official filing or automated transaction posting
is part of this contract.
