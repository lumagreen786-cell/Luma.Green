# Participant review and activation contract

Status: policy contract for phase 2 of the India-wide completion plan. The pure
policy is implemented first. Schema, API and UI integration remain pending.

An approved participant request is not an activated workspace. A participant
type describes an activity; it never grants a membership, a permit, access to
private records or authority to move money or controlled material.

## Policy outcomes

`convex/lib/participantTypes.ts` owns one exhaustive policy for all 41 types:

- `household`: use the existing private household workflow. Do not create a
  business membership.
- `generator`: use generator collection and service workflows. This covers
  small businesses, industrial sellers and institutions. Selling material
  requires separate verified business and material scope.
- `verified_application`: continue the named existing application. Kabadiwala,
  Saathi and recycler use their corresponding application; large yards and
  preprocessors use `yard`; intermediary and end-goods manufacturers use
  `manufacturer`. Existing identity, document and business checks still apply.
- `capability_review`: review the actual facility, service or market capability
  and its target scope. This covers dry-waste centres, collection contractors,
  rural collectors, traders, e-waste operators, wet-waste processors, EPR brands,
  PROs and the nine service types. It grants nothing by itself. A trader must
  not be labelled as a yard to fit the old organisation enum.
- `provider_pending`: EPR and carbon trading need their external acceptance.
  Their application cannot enable live charging, payouts, certificate issuance
  or official trading. Own draft preparation can be offered separately.
- `invitation_required`: all eleven partner-group types require verified,
  explicit invitations before scoped operational access. A public application
  records interest only. Staff, civic, auditor and partner grants never follow
  from public request approval.

The policy is a next-step classification, not an authorization check. Unknown
external strings must pass the existing `isParticipantType` guard before lookup.

## Activation integration

Keep review status (`pending`, `approved`, `rejected`) separate from activation.
The server must derive the next action from the policy and current linked
evidence. An approved request without a current activation link must not appear
as an active operational account.

Reuse `activateApplication` as the single owner of verified business and Saathi
provisioning. Link the owned participant request to its matching application;
request approval cannot bypass `applications.submit`, identity checks or admin
authentication. Link an existing valid account instead of making a duplicate.

A later capability request must identify the target workspace or facility and
recheck the requester's current management authority. Do not change the primary
participant type, switch the selected workspace, or widen team permissions as
a side effect. Existing owner/admin/member/viewer permissions remain separate.

Service providers may read or answer only explicitly addressed requests. Audit
recipients may read only explicitly shared evidence. Institution, city, sponsor
and brand labels do not grant access to another organisation's records.

Activation and its audit event must commit in one transaction. Identical retries
reuse the same result; changed targets or evidence produce a conflict. Review,
verification, invitation and capability revocation must deny subsequent access.
Account closure, suspended sites and removed membership must also deny access.
Use current evidence at each protected endpoint, not a past approval alone.

## Acceptance and monitoring

The pure-policy tests check complete type coverage, existing application routes,
generator separation, invitation restrictions, trader classification and external
trading boundaries. Integration must additionally test concurrent activation,
duplicate memberships, mismatched applications, unverified accounts, rejected
verification, stale/revoked access and cross-workspace denial.

No new PostHog event or Sentry hook is needed for this pure classification.
Activation details, documents, invitations and private targets must stay out of
analytics. Future endpoints use the existing typed errors and scrubbed monitoring
contract. Policy coverage does not prove workspace activation or live acceptance.

## Proposed organisation and capability integration

This section is a design proposal, not implemented activation. Reuse `orgs` as
the operational site and `organizations` as the team/group owner. For a complete
team-enabled trader, service provider and generator workflow, add the genuine
`trader`, `service_provider` and `generator` site kinds. Do not create a yard or
manufacturer as a substitute. This reuses existing memberships, site selection,
industrial facilities, organisation grouping and verified team invitations.
Households and Saathis retain their existing separate account models.

Adding enum members alone is unsafe. `requireOrg` with no kind restriction
currently admits all site kinds; `RoleHome` sends every non-kabadiwala site to
the trading home. Install capability enforcement and explicit homes before
enabling activation of any new kind. New sites start with no operational grant.

Minimum type and provisioning changes:

- Extend `vOrgKind` in `lib/validators.ts`, `OrgKind` in `lib/chain.ts` and the
  matching application validator in `lib/drafts.ts`. Extend `APPLICATION_KINDS`
  in `lib/onboarding.ts`. Do not blindly add non-processing types to the current
  factory `BUSINESS_KINDS` schema, which requires processing-specific details.
- Add a non-processing business validation branch using the existing business
  draft section: explicit name, address, service locality, declared registration
  status and relevant material/service scope. `sectionsFor`, draft saving,
  application issue checks, `orgDraftFrom` and admin review must use that branch.
  Do not invent a GST exemption or require a factory pollution consent from an
  office-only service provider. Registered businesses retain the applicable
  existing identity checks; missing required provider proof remains unavailable.
- New types submit for review. Reuse `activateApplication` for creation after
  current verification; review approval cannot substitute for those checks.
  No new type receives fallback reference prices as live rate cards.
- Make primary site defaults exhaustive in `siteClassification.ts`. A trader
  or service office does not default to a processing plant. Actual handling
  and processing facilities keep their separately declared physical scope.
  `industrialProfiles.save` currently requires at least one processing
  capability. Introduce explicit non-processing facility roles for generation,
  storage and offices before using it for these sites; do not invent a sorting
  operation. Keep processing capabilities required for processing facilities.
  Current ordinary custody review requires consent-to-operate evidence; do not
  bypass that check or invent a permit for an office. Define and review the
  applicable non-processing custody evidence before enabling such dispatch.
- Extend result validators and typed views through the existing `vOrgKind`
  owner. Do not duplicate account/organisation tables or workspace selection.

Proposed `siteCapabilityGrants` records contain `orgId`, optional `facilityId`,
source participant request, participant type, explicit action, bounded material,
process or service scope, verification evidence/version, reviewer, decision
reference, validity period and revocation metadata. Actions are collection,
material trade, processing, service provision, own reporting or request
collection. Do not add a grant meaning "all industries" or "all permissions".
Use indexes for organisation/action, facility/action and request/decision.

`capabilities.request` must verify current target management authority and
preserve the immutable requested scope. `capabilities.review` and `revoke`
require the existing configured admin with TOTP and an explicit reason.
Identical request/decision retries reuse the same record; changed scope or
evidence requires a new review. Grants cannot outlive their required verified
evidence. A new grant never changes a membership role or selected workspace.
`requireCapability` combines current membership permission, active site, current
grant, exact target, evidence validity and current material/process eligibility.
Use it inside protected mutations and matching choice queries, not only menus.

Partners remain a separate invitation path. Internal staff use existing internal
organisation membership and verified team invitations. Civic, audit and partner
recipients receive only explicit record/programme scopes after verified
invitation; they do not gain material-trade site capability through public
approval. No capability grant changes `profiles.kind` to admin or bypasses the
configured admin login. Keep the existing scoped service/audit share owner.

Existing four-kind site records and their approved application history remain
intact. Inventory their current effective permissions before deployment. Add
only equivalent initial grants from valid existing application/site evidence,
with an audited provenance; do not infer specialist processing, public partner
authority or new trade routes from an industry code. Review records without
adequate evidence instead of silently marking them verified. New kinds cannot
activate until this integration and the existing-account transition are tested.
No data reset, bulk role promotion or automatic legal reclassification is part
of this design.

Client integration must branch `RoleHome` explicitly: trader has trade actions
only with current scope; service provider has addressed service requests;
generator has collection/intake and own evidence. A site with no grant shows
its pending action and recovery controls. Update the common workspace selector,
navigation, application/status components, admin review and all 33 catalogues.
Do not let `BusinessHome` automatically query market data for a non-trader.

Billing classification stays independent of site capability. Household, Saathi
and verified NGO free access remains intact. A lapsed plan must not block pickup,
custody or cash settlement. No activation enables live charging or payouts.
