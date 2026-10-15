# Organizations and record collaboration

Backend contract, 15 October 2026. The owner has deferred new UI. These APIs do
not add controls to existing pages and have not been deployed to production.

## Simple model

An **organization** is the company. A **workspace** is one of its shops, yards or
plants. A person signs in once and can select a workspace they belong to. Each
workspace keeps its stock, documents, trades and money separate.

For example, a company can group a Bengaluru shop and a sorting yard. A shop
worker can use the shop. A manager with membership in both sites can select
either. Being a company administrator alone does not reveal either site's
private records. Moving material between sites still requires normal recorded
business operations; changing the parent does not move stock or money.

## Data ownership

`organizations` holds company metadata. `organizationMemberships` holds parent
roles. Existing `orgs` remains the approved operational site table and existing
`memberships` remains the operational permission authority. Optional
`orgs.organizationId` groups sites without copying business data.

Parent creation requires ownership of an active approved site. Attaching another
site requires ownership of both the parent and site. Only platform administrators
with the required authenticator can create an internal Luma organization.
An internal organization has no operational facilities or automatic customer
access. Internal members can collaborate without becoming platform admins.

New facilities still need the existing approval process. This release does not
add a self-service facility approval shortcut, cross-site transfers or legal
entity/payment-recipient inheritance. Parent and site roles are independent:
removing a parent membership does not remove separately granted site membership.
For complete offboarding, revoke each applicable site membership as well.

## APIs

| Module            | Operations                                                                          |
| ----------------- | ----------------------------------------------------------------------------------- |
| `organizations`   | create, list, rename, attachWorkspace, workspaces, siteRequests, team, changeMember |
| `teamInvitations` | create, preview, accept, list, revoke                                               |
| `workspace`       | Existing select, team, changeRole, removeMember and email invitation APIs           |
| `collaboration`   | tasks, createTask, updateTask, comment, editComment, comments, activity             |

Parent roles use owner/admin/member/viewer. Owners can manage all parent roles.
Admins manage member/viewer roles only. The last owner cannot be removed or
demoted. Grant ownership to an existing parent member before demoting the old
owner. Role changes include the expected prior role. Rename requires the expected
parent version. Sensitive parent operations and phone invitation creation require
a session created within the last ten minutes; refresh does not reset this time.

Limits: ten parent memberships per person, one hundred members per parent,
one hundred sites per parent. Existing workspace membership limits still apply.
No parent aggregate reporting permission or parent suspension state is introduced.
Workspace suspension continues to block operational and collaboration access.

## Phone invitations

`teamInvitations.create` takes `scope` (`organization` or `workspace` with its ID),
an Indian mobile number and admin/member/viewer role. It uses the shared phone
normalizer and stores E.164, as the existing pilot login does. It returns a random token
**once** for the inviter to share. Do not put the token in logs or analytics.
The database stores only its SHA-256 hash. The token expires after seven days.
Preview and acceptance require the intended verified Better Auth phone identity.
Do not accept a profile's self-entered phone field as proof of ownership.

Creation is limited to twenty invitations per hour and one hundred per seven
days in each scope. A pending duplicate is rejected. Acceptance checks the
inviter's current role, scope status and capacity again in the transaction.
Existing memberships keep their role, so acceptance cannot upgrade a viewer.
A removed/demoted inviter, revoked token or suspended site makes it unusable.
The normal OTP and required authentication factors remain unchanged.

This is a manual token-sharing API, not an SMS provider integration or a working
browser invitation page. No new SMS template or email/password requirement is
introduced. Existing email invitations remain separate and unchanged.

## Collaboration

Tasks attach to an existing pickup, trade, inspection or job within an authorized
site. Internal Luma tasks attach to its internal organization. The two sides of
a trade have separate private team discussions. An inspection's buyer permission
does not grant access to the inspecting team's discussion.

Tasks have a bounded title, optional assignee and due date, open/in-progress/done
state and version. Operators create and update tasks. Assigned Saathis can read
and comment on their current jobs without receiving site membership. Cancelling
a job, removing its worker, suspending the worker or revoking site membership
removes access on the next request. Task assignment alone grants no permission.
Viewers can read but cannot write or be assigned operational responsibility.
A changed active workspace rejects stale writes.

Comments are plain text, at most 2,000 characters, with at most ten distinct
mentions and twelve new comments per author per minute. Mentions require current
record access. Authors can edit/delete their comments; owners/admins can delete
for moderation but cannot rewrite another person's words. Expected versions
prevent lost edits. Old text stays in a non-public revision table. Deleted text
is absent from the public comments response. Render all text as text nodes.

Each state change writes an audit event. Task activity exposes only action,
actor ID and timestamp, not general audit metadata or customer data. Comment
changes have their own audit records and private revisions. Tasks are limited
to one hundred per record; comment reads use bounded cursor pagination.

## New-site requests

A company owner or admin starts an application with `applications.start` and
`organizationId`. A recent session is required. `applications.own` reads an
explicit application ID; `mine` continues to read personal onboarding only.
Draft, submit, discard and file APIs accept an optional application ID.
The same field, permit, attachment and platform review rules apply. Only platform
approval creates the site and grants its applicant the site-owner membership.
Company membership alone cannot read the applicant's identity documents.
Approval fails if the applicant lost company management permission or site limits
were reached. Company managers can read bounded request status summaries through
`organizations.siteRequests`. Each company is limited to 100 request records.

## Notifications and reminders

Assignment, task updates and comments notify the affected assignee, author and
mentioned members through the existing inbox. Self-notifications are omitted.
A scheduled due reminder checks the current task version, state, assignee and
record access. Duplicate delivery is ignored. A changed or completed task makes
older timers ineffective. Revoked access hides existing task notices and cancels
pending push delivery. Lock-screen content stays generic; task text is not sent.
Web push uses the existing opt-in service when configured. No collaboration SMS
or Expo push is added. Inbox use does not need a new provider account.

## Boundaries for the next page work

The backend supports the company/site and collaboration primitives above.
Company switching controls, phone invitation pages and assignment/comment controls
remain UI work. Existing support-case and trade messaging remain their canonical
owners; this release does not create a second support chat or support-task system.
No parent aggregate reporting, cross-site inventory transfer, shared legal/payment
identity or organization-wide suspension is added.

No provider account or extra service is needed for these APIs. They use Convex
and the existing authentication service. Turnstile and R2 setup remain in the
README. No migration or deletion of prototype data was needed.
