# Organization backend implementation — 15 October 2026

The owner approved organization/workspace implementation, then deferred all UI
redesign. Native app work is on hold. Existing Turnstile and R2 work is retained.

## Contract

- A parent organization groups approved operating sites (`orgs`). Existing site
  memberships remain the sole authority for stock, trades, files and payments.
- A business owner can create a parent and attach sites they own. Attaching a
  site requires ownership of both scopes. A parent cannot create an approved
  facility or bypass the existing application review.
- Luma's internal organization is created by a fully authenticated platform
  administrator. Its membership does not grant platform administrator powers.
- Phone invitations bind acceptance to the verified Better Auth phone identity.
  They are shared by the inviter; no unapproved SMS template is used. The token
  is returned once, stored only as a hash, expires and can be revoked.
- Organization role changes protect the final owner. Sensitive grants require
  a recent authenticated session. Existing operational memberships are never
  silently promoted by invitation acceptance.
- Record collaboration uses live workspace access, bounded content and optimistic
  versions. Parent-only membership does not expose operational discussions.
- No provider purchase or Cloudflare provisioning is included. The owner has
  now authorized commit, push and deployment after checks.

## Work and evidence

- [x] Parent schema and governance APIs, including internal team scope.
- [x] Verified-phone invitations for parent and existing workspace membership.
- [x] Record assignments, comments and activity with current access checks.
- [x] Adversarial permission and concurrent-update tests.
- [x] Type checks, lint, tests and isolated backend validation.
- [x] Document APIs, remaining UI work and provider setup gates in handoff.

UI integration and visual acceptance will happen page by page when requested.

## Follow-on technical work

- [x] New-site requests reuse application validators, private file ownership and
      platform review. Parent-only membership never shares identity documents.
- [x] Assignment/comment inbox notices and scheduled due reminders reuse the
      existing notification owner, with live access checks and duplicate protection.
- [x] Tests cover separate personal/site applications, approval and permission
      revocation, reminder scheduling, stale versions and revoked notice access.

Final release checks and deployment evidence are recorded in the handoff.
Company controls and task screens remain on hold with all UI redesign. Existing
support messaging remains unchanged; a separate support-task system is not added.
