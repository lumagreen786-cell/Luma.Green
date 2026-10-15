# Organizations, workspaces and collaboration

**Status:** backend implementation approved, 15 October 2026. UI integration and
redesign are deferred by the owner. The design below describes the broader
roadmap; implemented endpoints and limits are recorded in
[the backend contract](../architecture/organizations.md). Do not treat roadmap
items as delivered functionality.

## Goal and terms

A company needs several workspaces for its shops, yards or facilities. Staff need
access to assigned workspaces and shared work records. Luma.Green needs its own
internal collaboration space without automatic access to every customer record.

Example: one recycling company has a Bengaluru collection shop, a sorting yard
and a processing plant. A collector works in the shop; a manager can switch
between all three. Stock and transactions stay attached to the correct facility.

For this proposal, **organization** means the parent company or team, and
**workspace** means a bounded operating unit. A workspace is not a separate login.
A legal entity may have several facilities; GST registration, verification and
settlement ownership must be mapped explicitly and must not be inferred from
shared parent membership.

## What exists today

- `convex/schema.ts`: `orgs` combines business type, site details and approval;
  `memberships` grants access to an org. `profiles.activeOrgId` stores selection.
- `convex/workspace.ts`: workspace list/select, team roles and invitations.
- `convex/lib/workspace.ts`: current membership and active business checks.
- `convex/lib/workspaceRoles.ts`: owner/admin/member/viewer, with legacy staff
  treated as member; limits currently include 10 workspaces and 100 members.
- Invitations are verified-email-bound. A phone-only account must not gain an
  email-password login just to join a team. The invitation acceptance journey
  needs an explicit phone-first design before rollout to these users.

The gap is a parent structure and collaboration within that structure, not the
absence of teams. Existing switching and role logic should be extended.

## Options and recommendation

| Option                                                  | Consequence                                                               |
| ------------------------------------------------------- | ------------------------------------------------------------------------- |
| Keep separate businesses and only improve switching     | Small change, but no company grouping or organization-wide administration |
| Add a parent above existing `orgs`                      | Recommended: preserves facility IDs and operational history               |
| Replace `orgs` with a new organization/workspace schema | Broad migration across inventory, trades, payments and audit history      |

Propose a parent table named `organizations`; retain existing `orgs` as the
operating workspace records, linked by `organizationId`. Document the naming
mapping instead of renaming every existing reference in the first release.
A parent is necessary because the existing record also owns physical operations.
Do not duplicate stock, trade or payment tables at the parent level.

## Who can use it

| User group                                             | Proposed experience                                                                                       |
| ------------------------------------------------------ | --------------------------------------------------------------------------------------------------------- |
| Kabadiwala, preprocessor, recycler, manufacturer teams | One default workspace; add approved sites under the parent as needed                                      |
| Saathis                                                | See assigned jobs and permitted task discussions; no general stock or finance access                      |
| Households/applicants                                  | Keep personal booking and application journeys; optional membership must not share their personal records |
| Luma.Green team                                        | Internal workspace for support/operations tasks; platform administration remains separately authorized    |

Business function (kabadiwala, recycler, etc.) and team permission (member,
viewer, etc.) remain different dimensions. A team invitation cannot approve a
business, promote someone to platform admin, or bypass required TOTP.

## Proposed access model

Add parent membership for organization governance. Keep existing workspace
memberships as the authority for operational records. Parent owner/admin can
manage the permitted workspace roster; parent membership alone does not grant
access to every private document or customer transaction. An explicit, audited
grant is needed for operational access or an aggregate reporting permission.

| Role                   | Proposed authority                                                            |
| ---------------------- | ----------------------------------------------------------------------------- |
| Organization owner     | Parent settings, ownership transfer, workspace creation and parent membership |
| Organization admin     | Approved parent/team management; cannot replace/remove owners                 |
| Workspace owner/admin  | Existing scoped team management rules                                         |
| Workspace member       | Operational work within the workspace and business role                       |
| Workspace viewer       | Permitted read-only views; no writes or assignment changes                    |
| Platform support/admin | Separate explicit capability; access recorded with actor and reason           |

Prevent removal of the final owner. Require recent full authentication for
ownership transfer and sensitive grants. Check membership on every server call,
file request and background action. Selected workspace IDs are preferences,
never authorization. Revocation must affect ongoing queries, downloads,
notifications, jobs, exports and integration keys.

Do not automatically add Luma staff to customer teams. Customer support access
must use an approved support case and limited scope, with expiry and audit;
emergency administrator powers remain distinct and reviewable.

## Collaboration scope

First release:

- Organization/workspace switcher with clear active company and site names.
- Team roster, invitations, role changes and member removal using existing flows.
- Assignments on existing pickup, inspection, trade and support records.
- Comments and mentions attached to an authorized record, with edit/delete audit
  history and bounded length. Mentioning a person does not grant record access.
- Due dates and status updates through the existing account inbox/push owner.
  Lock-screen and email notifications remain generic; access is checked on open.
- Activity view derived from `auditLog`, with private fields filtered per role.

Next release: authorized organization-wide summaries, shared operating documents
and task lists after actual use identifies a need. Defer standalone chat,
video calls, custom role builders, cross-company shared workspaces and live
co-editing. This avoids introducing another messaging or collaboration service.

Concurrent changes must use transaction checks and expected record versions.
Switching workspaces must cancel or reject stale form submissions and clear
cached private data. An assignment creates responsibility, not permission to
approve a trade, release funds or mint credits.

## Data and rollout proposal

The platform is an internal prototype with no real user data, as confirmed by
its owner. During this phase, a reviewed reset/reseed can replace a backfill;
no migration framework is required. The preservation steps below apply only if
we retain demo history or the owner has declared rollout. Do not build migration
machinery solely for disposable demo data.

1. Resolve the parent-company/verified-site policy and invite identity method.
   Decide whether workspaces can have different business kinds under one parent.
2. Add parent records and parent memberships. Keep one canonical workspace
   membership path; do not mirror the same operational role in two tables.
3. Dry-run a migration that creates one parent for each existing independent org.
   Never merge records based on similar names, phone numbers or GSTIN alone.
   Use reviewed mapping for companies that already have multiple sites.
4. Preserve all existing org IDs, stock, paise, grams, audit history and frozen
   carbon factors. Add parent links and selection fields with an explicit
   migration version and verification counts. Reject ambiguous rows.
5. Add parent governance and workspace creation with pending/active/suspended
   states. New sites cannot bypass onboarding, permits or payment eligibility.
6. Extend the switcher and team UI, then add record assignments/comments. Reuse
   existing translated controls and inbox events. Test 33 locales, RTL, keyboard,
   light/dark and phone/tablet/desktop layouts plus native hosted flows.
7. Pilot one company with two workspaces and one Luma internal workspace. Start
   with non-financial collaboration. Enable wider use only after isolation tests.

Parent roll-ups aggregate permitted records; they never move stock or money.
Cross-site material movement needs a later explicit transfer flow with exact
units and auditable source/destination events. Do not simulate it by changing an
org ID. Payment settlement continues to follow the verified legal recipient.

## Acceptance and recovery

- A member of site A cannot read site B by changing IDs, search filters, export
  parameters, attachment keys or invitation payloads.
- A user with access to both sites sees only the active site's operational data.
- Organization governance does not silently expose identity files or finance.
- Expired/revoked invites fail; acceptance binds the intended verified identity.
  Phone-only login and admin authenticator requirements remain intact.
- Suspended organizations/workspaces cannot operate; define the permitted
  read/export and support path before release.
- Removing a member prevents new writes and notification access. Mentions,
  assignments and file reads check current permissions.
- Existing business and household flows still work after backfill. Repeat the
  migration safely, reconcile counts, and test restore before production.
- Audit entries identify actor, parent, workspace, action and affected record,
  without copying secrets or private document contents.

Roll back UI exposure and new parent creation first. Preserve parent links and
history if new records reference them; do not destructively undo migration after
new activity. Restore from a tested snapshot only under a separate approved plan.

## R2 relationship and decisions to review

The [R2 plan](../architecture/r2-storage-plan.md) owns bytes and provider rollout.
This plan owns organizational access. New attachment keys can contain opaque
workspace IDs, but key prefixes do not enforce permissions. Personal identity
files keep personal scope. Do not wait for a bulk file migration to pilot teams.

Before implementation, confirm:

1. Are workspace creation and parent grouping self-service, or Luma-approved?
   Proposed default: parent admins request; Luma approves regulated sites.
2. Should parent owners have all operational access by default? Proposed default:
   explicit workspace grants, with an auditable grant flow.
3. Which invitation identity is required for phone-only staff? Proposed default:
   phone-bound invitation accepted after normal OTP and required factors, with
   rate limits and no user-enumeration response; design delivery separately.
4. Is v1 collaboration limited to business teams, assigned Saathis and Luma staff?
   Proposed default: yes; personal household records remain separate.

These are product decisions, not hidden implementation assumptions. After review,
record the accepted parent model and access contract in an ADR and synchronize
`docs/architecture/data-model.md`, auth docs and the implementation plan.
