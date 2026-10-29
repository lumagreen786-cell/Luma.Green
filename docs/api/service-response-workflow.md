# Private service request response workflow

Coordinator-approved contract, 29 October 2026. This document defines the
bounded implementation. It does not claim deployment or provider acceptance.

## Purpose and limits

The existing service enquiry is a private conversation between its requester
and one selected, approved stakeholder account owner. Acknowledgement means
receipt of the request. A response is a party's reported text. Neither action
approves a permit, loan, insurance cover, treatment route or service provider.
Closing a conversation does not prove delivery. No action charges money, moves
stock, issues a certificate, files a government form or calls an external API.

## Saved state and history

Reuse `serviceEnquiries` and its indexed requester/recipient board. Extend its
state union with `acknowledged`, `responded` and `declined`, retaining `draft`,
`enquiry` and `closed`. Existing records need no migration. Add an optional
bounded history array. Each immutable entry records action, party
(`requester`/`recipient`), authenticated actor profile ID, server time, optional
plain text and optional operation key. Entries never contain credentials,
provider output or a fabricated official reference. Return history only with
record access; general audit events contain action and record identity, not
conversation text. Each successful change increments the record version and
writes an audit event in the same transaction.

| Current state                    | Party                | Permitted action      | Result                      |
| -------------------------------- | -------------------- | --------------------- | --------------------------- |
| draft                            | requester            | edit / submit / close | draft / enquiry / closed    |
| enquiry                          | recipient            | acknowledge           | acknowledged                |
| enquiry, acknowledged, responded | either current party | respond               | responded                   |
| enquiry, acknowledged, responded | recipient            | decline               | declined                    |
| enquiry, acknowledged, responded | either current party | close                 | closed                      |
| any state with a recipient       | requester            | revoke recipient      | same state, sharing removed |
| declined, closed                 | either party         | read only             | unchanged                   |

Draft editing stays with `updateEnquiry`. After submission its title, details,
commercial fields and material snapshot are frozen; subsequent discussion is
append-only history. The existing requester close path remains supported, with
expected version and unchanged submitted text. A draft is never shared.
Revocation remains available after closure. It removes recipient identifiers
from the live record and ends all recipient reads, writes and support-source
access on the next server call. Saved history remains with the requester; a
previously downloaded copy cannot be remotely erased. No reassignment or
reopening is added.

`actOnEnquiry({id, version, operationKey, action, message?}) -> null` accepts
`acknowledge`, `respond`, `decline`, `close`. Require integer expected version,
8–80 character operation keys, response text 1–2,000 characters, and optional
reason text at most 2,000 characters for decline/close. Acknowledge has no text.
Reject control characters except line breaks. A duplicate operation with the
same actor/action/text is a no-op after fresh access checks; a reused key with
a different payload fails. A stale new operation fails `RECORD_CHANGED`.
Limit total discussion text to 8,000 characters so the existing bounded board
response remains safe. Limit ordinary history additions to 98 entries, leaving room for terminal close
and recipient revocation (maximum 100). Maximum 12 conversation additions per
actor per minute; terminal close/revocation remain possible. No automatic retry
or notification delivery promise is introduced.

## Access and revocation

Use the existing authenticated open-profile, stakeholder-account and workspace
helpers. Client visibility is not permission. The requester must own the record.
For a workspace request, writes require the currently selected active workspace
and `operate` permission; viewer, removed membership, a different selected
workspace and suspension reject writes. Existing requester history reads may
survive suspension, as the current owner contract allows, but not membership
removal. Recipient access requires the stored selected account ID and owner
profile ID still to match an approved account and an open profile. Rejected,
transferred or revoked recipient accounts lose access immediately. Workspace
requests and shared programme aggregates stop sharing if the source workspace
is suspended or the requester no longer belongs to it. The canonical recipient
check receives the actual source record explicitly, including its workspace ID;
a recipient snapshot without that source is not sufficient authority. Parent-company membership grants no record access.

Stakeholder ownership is the recipient authority; this account is not an
operational workspace membership or permit. A recipient's unrelated selected
workspace does not acquire or replace stakeholder ownership. No platform admin
write override is added. Existing authenticated admin inspection is read-only.
Unknown IDs and denied IDs both use `RECORD_ACCESS_DENIED`.

Board and single-record results expose `canRespond` plus the permitted action
list from the same server policy, history and state. These are UI hints only;
the mutation checks policy again. Reads remain bounded to the existing 50-row
indexed pages. No general audit-log or profile directory is exposed.

## Interface and recovery

Keep the existing service page and Astryx actions. Add a compact request-history
section and labelled response text area to both sent and received requests.
Show available acknowledgement, response, decline and close actions from server
policy. Show a brief conversation-only notice. Pending buttons prevent duplicate
clicks. Preserve typed text on failure and show a translated error. Clear it only
after a confirmed save. Workspace changes remount the existing scoped content;
record version changes cannot silently overwrite a user's draft. Empty received
requests and terminal/revoked states have clear translated text. All new copy is
supplied as namespace patches for all 33 registered locales; coordinator owns
message catalogue integration. No new navigation or public login path is added.

## Unfiled evidence preparation

Inspection found existing `commercialEvidence.mine` and `forTrade` paginated,
scoped reference reads and immutable correction links, but no download action.
Add small CSV and JSON preparation exports to the existing evidence page, using only
its currently loaded authorized rows. The visible label and export metadata
must say **unfiled, reported and unverified; not a government filing**. Include
schema version, generation time, selected workspace ID, loaded row count,
complete/partial loaded-page flag, references, dates and correction links. Do
not claim a complete registry, verify a source, follow private attachments or
merge other workspaces. Preserve exact integers. No official layout, seal,
signature, permit number or certificate is generated. The primary action is “Download evidence list” (Excel-readable CSV), with JSON
as a secondary option. CSV quotes every cell, doubles embedded quotes, preserves
line breaks and prefixes formula-leading text (`=`, `+`, `-`, `@`, tab or CR,
including after whitespace). Numeric source values must be safe integers and are
serialized without decimal arithmetic. A UTF-8 BOM supports spreadsheet scripts.
This is a local download
from existing authorized data, not a new share token or external filing API.
Revoke its Blob URL after download. A disabled/loading state prevents exporting
stale rows during workspace changes. Export neither changes records nor creates
an approval/audit claim. No bulk fetch or additional storage is needed. The existing `commercialEvidence.mine`
query accepts an optional `expectedOrgId`; the server derives the actual selected
workspace first and rejects a mismatch. The evidence page always supplies this
ID so a workspace change also changes query cache identity, including empty
results. The supplied ID never grants access.

## Verification and integration

First demonstrate failing server regressions for recipient transitions, stale
versions, history and audit consistency, duplicate-operation replay, terminal
states, draft privacy, cross-party IDs, revoked/rejected/transferred accounts,
source workspace suspension/removal, viewer writes and changed workspace.
Add component tests for response/save recovery, allowed actions and terminal
states. Test the export's partial-data label, exact values and no mutation.
Use focused runs with at most two workers, then scoped lint. Coordinate resource
use before browser checks. Retain labelled light/dark 390/768/1440 captures in
affected Latin, Kannada and RTL scripts, actual fonts and keyboard checks.
Local fixtures do not establish live authentication or provider acceptance.

Owned runtime files: `convex/services.ts`, `convex/lib/serviceRecordsSchema.ts`,
`src/components/services/services-page.tsx`, existing evidence UI, small export
helper and adjacent tests. No root schema, generated API, app shell, navigation,
message catalogue, native, package or provider changes. Namespace patches are
written to `/tmp/luma-web-completion/services-locales.json` for integration.
