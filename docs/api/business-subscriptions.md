# Business subscriptions

Status: coordinator reviewed and approved, 29 October 2026. Implemented provider-independent request lifecycle; provider execution remains a separate implementation and approval gate.

## Scope and safety

One subscription belongs to one approved operational site (`orgs`), covering its business activity bundle. Buyer and seller roles do not create separate charges. Household and Saathi essentials remain free. The company container is not a billed site and company membership grants no billing or site-record access.

This release supplies a complete keyless plan-preference lifecycle: catalogue, select, change, cancel the saved request, and status/history. A selection is an intention, not an active subscription, payment, mandate, tax invoice or permission grant. Changing/cancelling a saved request never asserts that a provider mandate changed. The UI says collection is unavailable. No checkout, charge, free-trial conversion, provider activation or manual paid override is added.

D39 supplies target prices, not approved collectible offers. Prices are integer paise/month: Trader Plus 49900 (3 site members); Centre 249900 (5); Yard 749900 (10); Processor 1499900 (15); Recycler/Manufacturer from 2999900 (25); Enterprise from 7500000 (member capacity by agreement); institution reporting 249900–999900 (capacity and price by agreed scope). Each fixed tier covers one site. Enterprise/institution scope is not silently unlimited. No new taxes, renewal promises or marketplace commission are inferred.

## Records

`businessSubscriptions`: unique application-owned row per site, indexed `by_org`. Fields: orgId, selectedPlan, requestState (`selected`/`cancelled`), version, createdAt/updatedAt, changedBy. First selection creates version1. The site ID and expectedVersion are mandatory on writes (zero means no row). Cancelling clears the outstanding intention, retaining its last selected plan and history. Reselecting restores a selected request. Same-plan selection and repeated cancellation are idempotent at the matching version.

`businessSubscriptionEvents`: immutable bounded history indexed by site/time, actor, action, plan and request version. Reads paginate or take bounded recent rows. Every real state change also writes auditLog. No provider secrets, account/contact data or untrusted payment IDs are stored.

`businessSubscriptionEntitlements`: future verified-provider producer boundary, indexed `by_org`; immutable verified period evidence fields include provider=`cashfree`, providerSubscriptionId, providerEventId, plan, validFrom, validUntil, memberLimit and siteLimit. No public or admin mutation can create this row; this release does not ship a provider producer. Only verified, nonexpired evidence can activate a limit. Runtime evidence checks require the enforcement flag and safe integer limits/times. Invalid, missing or expired evidence cannot manufacture a paid state. No environment flag alone grants an entitlement.

The coordinator integrates the exported table definitions into schema.ts. Existing rows are not rewritten or backfilled.

## Public functions

All functions have explicit Convex args/returns validators and use current membership authority. `catalogue` is public reference data. Site status/history requires `requireOrg(..., read)` plus exact selected orgId. A suspended site may read recovery/status; it cannot write. `selectPlan` and `cancelRequest` require active selected site owner (`own`), recent full authentication, expectedVersion, and exact site ID. Viewers/admins/members, stale selection, removed membership, other sites and suspended sites cannot write.

- `catalogue({})` returns versioned target plans: id, integer monthly minimum/maximum, nullable fixed memberLimit, siteLimit1 or null for agreed scope, priceKind (`target`/`from`/`range`). Display labels come from translations.
- `status({orgId})` returns request row or null, billingAvailable=false, effective entitlement summary or null, current bounded member count, canManage flag and bounded recent request events. It never exposes provider identifiers.
- `selectPlan({orgId, plan, expectedVersion})` returns the new/current request version. A different plan records a change; it does not mutate effective entitlement.
- `cancelRequest({orgId, expectedVersion})` returns the new/current version. No existing entitlement or records are removed.

Typed errors include WORKSPACE_CHANGED, WORKSPACE_PERMISSION_DENIED, STALE_VERSION, SUBSCRIPTION_REQUEST_MISSING, SUBSCRIPTION_MEMBER_LIMIT and SUBSCRIPTION_SITE_LIMIT, in addition to existing authentication errors. UI uses translated recovery messages and retains the selected plan on errors.

## Limit ownership

Membership insertion remains owned by the existing workspace email-invitation acceptance and teamInvitations workspace-token acceptance transactions. Add one shared capacity helper there immediately before insertion; duplicate existing memberships keep their role and do not consume a second seat. Count all site memberships including owners/viewers. Creation of an invitation is not a reserved paid seat; acceptance checks capacity again. Existing hard platform caps remain.

Site creation remains owned by existing approved application projection. A site subscription covers its own site; no agreed company-wide site allowance exists in D39. Thus this release does not apply a company's arbitrary plan to new sites or block existing approval on another site's entitlement. The limit helper represents siteLimit for the future producer, but no unsupported parent site cap is invented. Existing site count and approval guards remain. Existing over-limit memberships and records are readable and usable; only net additions are blocked when authoritative current entitlement and the explicit enforcement flag exist. Billing off preserves existing access and existing additions under current platform caps.

## UI and verification

Private route `/app/billing`, selected-site scope. Open plan rows show target monthly prices, member capacity, chosen request and collection unavailable state. Owner can save/change/cancel; other members can read. No fake paid badge or checkout button. Enterprise/institution show agreed scope. Shared Astryx actions, locale money formatting, all33 namespaces, RTL and honest empty/error/loading states apply. Coordinator owns nav and catalogue merge; namespace patch is supplied in /tmp.

Tests first fail on missing lifecycle/capacity behavior, then cover permissions, stale versions, selected-site mismatch, suspended/revoked access, idempotence, audit/history, all tier prices, missing/expired/untrusted entitlement, billing off preservation, member capacity at both acceptance owners and no provider calls. UI tests include selection, change, cancellation, viewer state, error retention and RTL. Current component visual fixtures remain distinct from authenticated/provider acceptance.

## Provider gate

Cashfree is retained. Official Cashfree [subscription web checkout documentation](https://www.cashfree.com/devstudio/preview/subs/web/checkout) requires server-created subscription/session, checkout authorization and server status confirmation. Existing B2B Payment Gateway evidence is not a recurring mandate. Therefore no subscription adapter is justified before supported merchant subscription access, approved tax/collectible policy, webhook verification/idempotence and explicit activation are supplied. These are separate live integration gates, not blockers for saved plan management.

## Delivered limits

Recurring billing still needs provider-specific implementation, verified webhook/reconciliation production, merchant approval, applicable tax and price policy, and explicit activation. Pasting keys alone does not complete recurring billing. This release has no internal/public/admin mutation that issues paid entitlement or changes a Cashfree mandate. The enforcement flag defaults off; future period evidence cannot revoke or demote an existing membership.
