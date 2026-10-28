# Account removal

Approved basis: D34 and the owner's 28 October completion request. This is a
self-service access-withdrawal and evidence-review workflow, not a promise to
erase every historical record. It changes no material quantity, payment,
refund, claim, handover acknowledgement or official evidence.

## Confirmation and eligibility

The server derives the account from its validated Better Auth session. The user
must explicitly confirm removal after a full sign-in within five minutes. Reuse
the existing session-bound `luma-security` assurance: primary phone verification
and, where enabled, the required authenticator or recovery factor. Session age
alone and caller-supplied flags are insufficient. The configured platform admin
cannot use this route; replacement/admin recovery is a separate setup gate.

Before closure, check canonical site ownership, last parent-organization ownership and unresolved
assigned operational work or owned open household collections. Do not leave an active business without its owner, invent payment
settlement, accept a physical handover, or move stock. A held result says the
account is **not closed** and gives bounded resolution reasons, such as transfer
business ownership or resolve an assigned handover. It changes no permissions.
A subsequent explicit confirmation rechecks current eligibility. Personal
stakeholder registrations, including pending and rejected requests, do not
create a removal hold. Preserve their review status as historical evidence and
exclude closed owners from new recipient choices, grants and approval. An
existing open parent co-owner permits withdrawal of the departing membership;
a canonical site owner must first use the existing ownership transfer path.

## Immediate closure boundary

For an eligible account, one mutation records closure on its existing profile,
clears its optional phone and selected workspace, records a keyed phone digest
for old pending invitations, creates the removal request, writes audit evidence
and schedules bounded cleanup. The closure is irrevocable through ordinary
profile setup. Shared `requireUser` rejects a closed profile even with a formerly
valid session. Direct optional-auth readers must use the same closure check.

Other principals' access to a removed person's personal grants must also stop
at once: collection grants, phone/email team invitations, audit reports,
programme reports and service recipients check the current creator/recipient
closure state. Existing organization membership checks must not fall back to a
closed owner. Cleanup then marks memberships, grants, installations and issued
integration keys revoked in bounded batches. Until a session batch is deleted,
closed-profile denial and the auth-session creation guard remain authoritative.
Closed auth HTTP sessions cannot obtain a session view, Convex JWT or factor
management; sign-out remains available. No late device cleanup may delete a
registration reassigned to another account.

## Same phone after removal

Never reconnect a new authentication user to a closed profile. Retain the old
profile ID and its closure marker as the historical boundary. Once the old auth
identity is removed by the internal cleanup owner, later sign-up creates a new
identity/profile. A phone digest tombstone prevents that new identity accepting
pending invitations issued before the removal cutoff. Old bookings, receipts,
helper bindings, stakeholder ownership and reports remain bound to exact old
IDs; a matching phone alone must grant no historical access. Existing keyed
abuse/quota records remain unchanged. A same-phone new profile cannot start paid
Surepass checks until the next India calendar day after removal. This prevents
the profile-keyed allowance being reset. It creates no fictional attempt or
charge, and grants no access to old provider proofs or applications. Do not log the phone, digest or auth token.

## Bounded cleanup and evidence review

Process at most 100 records per continuation and keep a phase/cursor. Cleanup
revokes current account sessions/devices, direct and parent memberships,
pending invitations and personal report/enquiry grants; issued API keys are
revoked. Preserve completed business/financial/material records, job and handover
lineage, application evidence and audit history. Do not scrub another business
member's records. Delete the old auth user's credentials/factors/sessions only
through internal component adapter calls after access withdrawal; do not enable
a public Better Auth deletion endpoint.

State progresses from `access_closed` through `cleanup_running` to
`restricted_review`. Failure keeps access closed and records a safe failure
code for an authorized retry. A TOTP-authenticated admin can read the bounded
queue and record the retained-evidence review outcome, purpose and reference.
A reviewed result is `review_recorded`, not a statutory all-data-erased claim.
There is no fabricated legal retention period or automatic historical purge.
The removed account cannot reopen itself or inspect retained records.

## Intended public surface

- `accountRemoval.status`: current-account eligibility and recent-auth state;
  no caller-selected target or unrelated records.
- `accountRemoval.close`: explicit confirmation and operation key; returns
  `held` with reasons, or `access_closed`. Identical retries cannot duplicate
  closure or revive access. A changed retry reference fails.
- `accountRemoval.reviewQueue` and `recordReview`: platform-admin TOTP only,
  bounded results and required review reference. No permission to erase ledger
  evidence, pay, refund or certify legal compliance.
- Internal paginated cleanup and safe retry own the revocation work.

The account screen explains loss of login/access, preserved necessary evidence,
held cases and the separate retention review before confirmation. All 33
languages use the shared catalogue. It signs out locally after successful access
withdrawal; local sign-out is not the security boundary.

## Local verification

The account-removal suite covers recent full-auth proof, missing factors, stale
sessions, held ownership and visits, suspended members/viewers, parent co-owners,
profile scrub, retry identity, same-phone historical booking and invitation
denial, the paid-check day hold, immediate API/report/push capability denial,
more than 100 component sessions and device records, personal service grants,
and historical stakeholder states. A real Better Auth handler regression uses
its issued assurance and checks immediate HTTP token/session/factor denial and
continued sign-out. Local fixtures make no provider, legal erasure or Production
acceptance claim.
