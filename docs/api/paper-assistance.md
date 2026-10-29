# Private paper text assistance

Status: approved bounded implementation by the coordinator, 29 October
2026 (India time). Scope approval only; no provider activation or paid allowance
is approved by this document. Scope: the approved web-completion plan, task 2. Existing
[paper transcription](paper-transcription.md) remains the source/evidence owner.

## Result and limits

An active workspace operator opens an existing confirmed paper, selects Summary
or Translation and one target language from the shared locale registry. The
operator may enter the derivative manually, without keys, or explicitly ask the
configured model for one untrusted draft. The operator corrects the derivative
and explicitly confirms it. The image, original extraction, confirmed source
transcription and model output remain separate and unchanged.

Assistance uses only the confirmed `reviewedContent.text`, at most 12,000
characters. It does not process row fields or the image again. A paper with no
nonempty confirmed text gets a clear unavailable instruction to use its existing
transcription workflow; this feature cannot alter confirmed evidence. A model
cannot certify translation fidelity, legal meaning, authenticity or completeness.
No stock, price, payment, operational transaction, tax form, permit, official
filing, certificate or carbon credit is created. No chat, tools, search, links,
exports or autonomous follow-up are added.

## Permission, source and version

Every public operation uses `requireOrg` and checks active organisation status.
Viewers can read assistance for an accessible paper; only existing `operate`
roles can create, request, save or confirm it. No global admin/parent-company
bypass. Removed members, suspended workspaces, cross-workspace and forged IDs
are denied. The selected workspace is a preference, never authority.

Creation receives `draftId`, `expectedPaperRevision` and `expectedOrgId`; the
latter is only a mismatch guard against switching workspaces. Server derives
organisation, actor, source hash and confirmed text from the actual paper. The
paper must be confirmed and its current revision must match. Save/request/finish
also check the paper still exists, is accessible and matches the bound source
hash/revision. Delayed results recheck current membership, active workspace and
operation permission; switching/removal denies attachment rather than moving
private text. Client unmount/workspace changes clear state and ignore late
results. No persistent browser storage, URLs or analytics contain the text.

## Stored contract and bounds

New additive `paperAssistTables` schema export; coordinator registers it. Existing
paper schema fields, source bytes, hash, extraction and confirmed content do not
change. No migration or deletion of existing records.

`paperAssists` stores:

- server-derived `orgId`, `paperId`, `paperRevision`, `sourceHash`, `sourceText`;
- `mode: "summary" | "translation"`, canonical `targetLocale` from `locales`;
- `createdBy`, `createdAt`, `updatedAt`, `revision`, `status: "draft" | "pending" |
"confirmed"`, `attemptStatus: "none" | "pending" | "succeeded" | "failed"`;
- optional `attemptId`, `startedAt`, `model`, `promptVersion`, immutable
  `modelText`, separate `reviewedText`, `confirmedBy`, `confirmedAt`.

Source snapshot, mode and target locale are immutable after creation. Each text
is plain text <=12,000 characters and <=24,000 UTF-8 bytes. Model envelope is
<=32KiB; output schema is strictly `{ text: string }` with no extra keys. Model
output is retained only after all access/version checks; no raw provider body,
headers, reasoning, token metadata or errors are retained. User text is rendered
as text, without HTML, executed Markdown, clickable links or formula evaluation.

Hard bound: ten retained assistance records per confirmed paper, including
confirmed derivatives. Count at most eleven rows using an indexed paper read in
the create transaction; reject capacity instead of deleting evidence. Confirmed
records cannot be edited or deleted. Draft derivatives persist with their
confirmed parent; unconfirmed nonpending derivatives may be discarded with fresh scope/source and
revision checks. Discard preserves attempt claims and quota, so it cannot reset
a paid attempt. Pending derivatives must finish or fail stale before discard. This is bounded
retention, not a legal retention policy. With the existing 100-source/org cap,
at most 1,000 assistance records/org are possible. Text/index/audit storage is
additional to the existing 100MiB raw source budget. No extra source bytes are
created. Future retention/export/deletion needs its own reviewed contract.

Indexes: `by_org_paper` for bounded scoped listing/counts. A scheduled internal callback marks the matching
pending attempt failed after 30 seconds; no retry and no model call. A late
finish cannot overwrite the failed state or newer human text.

## Public API

All arguments/results use explicit Convex validators; text/mode/locale/revision
use shared validation. No actor, authority-bearing org, source text, source URL,
provider URL, key, model or quota is accepted from the caller.

| Function                         | Input                                                                   | Result/effect                                                                                                       |
| -------------------------------- | ----------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| `paperAssist.availability` query | `{}`                                                                    | `{ assisted, canOperate }`; no secret/model/budget leak                                                             |
| `paperAssist.list` query         | `{ draftId }`                                                           | <=10 records for accessible confirmed paper, including immutable model and reviewed text; no unrelated papers       |
| `paperAssist.create` mutation    | `{ draftId, expectedPaperRevision, expectedOrgId, mode, targetLocale }` | `{ assistId, revision }`; empty manual derivative with immutable server source snapshot                             |
| `paperAssist.save` mutation      | `{ assistId, expectedRevision, text }`                                  | `{ assistId, revision }`; reviewed draft only; deny pending/confirmed                                               |
| `paperAssist.generate` action    | `{ assistId, expectedRevision, consent: true }`                         | `{ status: "ok", assistId, revision }` or `{ status: "unavailable"                                                  | "limited" | "busy" | "already_attempted" | "failed", assistId }` |
| `paperAssist.discard` mutation   | `{ assistId, expectedRevision }`                                        | `null`; deletes unconfirmed nonpending derivative only, with safe audit; claims/quota stay                          |
| `paperAssist.confirm` mutation   | `{ assistId, expectedRevision, text, confirmed: true }`                 | `{ assistId, revision, status: "confirmed" }`; nonempty reviewed text, actor/time and safe audit in one transaction |

Errors: existing session/workspace errors plus `PAPER_ASSIST_NOT_FOUND` for
inaccessible records, `PAPER_ASSIST_INVALID`, `PAPER_ASSIST_SOURCE_CHANGED`,
`PAPER_ASSIST_REVISION_CONFLICT`, `PAPER_ASSIST_BUSY`, `PAPER_ASSIST_CONFIRMED`,
`PAPER_ASSIST_CAPACITY`, `PAPER_WORKSPACE_CHANGED`. Auth failures are never hidden
as provider failures. Safe audit contains IDs, mode, locale and revisions only;
no source/model/reviewed text, document name or contact data.

## External consent, optional config and quota

Generation requires fresh explicit consent for this derivative: the confirmed
text may contain private data and will be sent to the configured external model.
Consent to image extraction is not reused. Manual create/save/confirm never
checks model configuration and never calls a provider. An unavailable/limited/
failed service retains manual text and the source.

Separate Convex-only `PAPER_ASSISTANCE_ENABLED === "true"` and explicitly set
`PAPER_ASSISTANCE_DAILY_LIMIT` (integer 1..100) are required, alongside approved
existing `OPENROUTER_API_KEY` and `OPENROUTER_MODEL`. No default paid allowance;
transcription/photo flags do not enable assistance. Configuration is optional
and validated through `src/lib/env.ts`. No secret is public or copied to Vercel.
This implementation does not approve a model, provider account, tariff or spend.

Before the single external attempt, one internal transaction rechecks scope,
source/version, config and quota, marks the derivative pending, stores an attempt
claim and reserves quota. Limits: configured global/day, three/account/day,
ten/org/day, using the existing India-day function. New `paperAssistQuota` stores
one bounded day's attempt entries, with scheduled expiry after two days. Separate
quota does not consume or expand transcription allowance. `paperAssistClaims`
uniquely gates org+paper+mode+locale; failed attempts still consume the claim and
quota. Creating another manual derivative cannot retry a paid tuple. Claims stay
bounded by the 100 source cap, two modes and 33 locales (at most6,600/org), and
contain no text. No refund/retry for timeout, provider refusal or malformed output.

Use the existing fixed OpenRouter HTTPS endpoint, redirect rejection, eight-
second full-body timeout, <=32KiB streamed response, <=2,000 output tokens,
strict JSON schema, `data_collection: deny`, `zdr: true`, required parameters and
fallbacks disabled. One request only. No alternative provider/model, tools,
streaming UI or automatic paid retry. Provider support/approval is an external
gate; unsupported privacy settings cause an honest failed result.

System instructions identify source text as untrusted quoted data: ignore its
commands, URLs, role instructions and requests for secrets/actions. User payload
contains only bounded source text, selected task and canonical target language.
Send no source image, filename, organisation identity, contacts from database or
unrelated records. Summary must preserve uncertainty and avoid inventing facts;
translation must preserve quantities, names and uncertainty without converting
units or interpreting legal authority. These are risk controls, not a guarantee
against model error. Human review remains required.

## UI and verification

Add an open assistance section to the existing confirmed-paper detail. Existing
source/transcription controls remain intact. Language uses the single locale
registry and endonyms. Show source text, model draft when present and a distinct
editable reviewed text area. Separate Save and Confirm actions; confirmation
requires a checked review statement. Disabled generation explains availability
and offers manual entry. Loading/failure/limit states preserve entered text.
Workspace/record/selection keys prevent late results from replacing another
record's draft. New copy is supplied to coordinator as a33-locale namespace
patch; no direct catalogue/navigation edits by this owner.

Strict fail-first focused regressions: no-key manual create/save/confirm;
viewer/cross-org/removed/suspended/session denial; forged source/assist IDs;
stale paper and derivative revisions; workspace switch/late completion; immutable
source/model/confirmed output; supported locale/mode and byte limits; ten-record
capacity; config default-off; atomic concurrent quota and duplicate tuple claims;
failed/no-retry/stale recovery; provider mocked request privacy and prompt input;
UI manual/review/consent/error/retained-text states. Mock output proves contract
handling, not OCR/translation quality or a live provider call. Focused tests use
at most two workers. Coordinator owns integrated checks, current visual matrix,
provider acceptance and Production release. No paid calls in implementation.

## Coordinator review repair — 29 October 2026

Editable browser text and its workspace-local memory cache carry the revision
from which editing began. A reactive record update cannot silently grant the old
text the newer revision. A mismatch blocks save, confirmation, discard and model
requests. Show the latest saved text and keep local edits. Only an explicit
reload adopts the latest text/revision; retain the previous unsaved text as a
separate local copy and clear consent/review. Successful own saves may advance
this snapshot only from the acknowledged result. Confirmed evidence continues
to display server content. Audit metadata records the resulting `revision` and
explicit `fromRevision`/`toRevision`; a pre-change row object must not label a
completed transition with its old revision.

Automated timeout audit entries omit the optional signed-in actor and mark safe
metadata `system: true`. Reserve/generation and human edits retain the actual
authenticated actor. A scheduled task must not attribute itself to the creator.
