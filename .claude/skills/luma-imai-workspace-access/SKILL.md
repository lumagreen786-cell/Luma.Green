---
name: luma-imai-workspace-access
description: Review organization and workspace authorization when adding scoped records, collaboration, roles or invitations in Luma.
---

# Luma IMAI Workspace Access

Read `docs/architecture/organizations.md`, then the current helpers in `convex/lib/workspace.ts`, `organizations.ts` and `workspaceRoles.ts`. Reuse these owners instead of adding a parallel role model.

Distinguish platform administration, company membership, operational workspace membership and record-specific access. Parent membership does not grant a site's stock, documents, trades or money. A selected workspace ID is a preference, not proof of access. Internal Luma team membership does not grant platform administration.

Use the existing server helpers (`requireOrg`, `requireScope`, and permission helpers) at the correct boundary. Validate the record's actual scope as well as the supplied ID. Preserve expected-role/version checks, last-owner protection and recent full authentication for sensitive changes. Client visibility is not authorization.

Test an authorized member, a viewer attempting a write, a different workspace, a removed member and a suspended workspace where applicable. For invitations, check current inviter authority and intended verified identity at acceptance. For delayed work or notifications, check access at execution; stale membership must not reveal records.

Source: `.agents/skills/workspace-rbac/SKILL.md` in imai-dev. Adapted scope separation only. IMAI's single-team rule, system teams, role keys and module paths are not Luma requirements.

IMAI dev-studio source revision d66c35ae5f5087cc927cb94c3341df6a461ce546, inspected 15 October 2026. Adapted guidance; native apps remain on hold.
