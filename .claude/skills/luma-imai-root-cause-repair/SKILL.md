---
name: luma-imai-root-cause-repair
description: Trace and repair a failed Luma workflow across its input, owning contract, saved state and downstream result.
---

# Luma IMAI Root Cause Repair

For a defect, record the failing revision, environment, input conditions and earliest error. Distinguish a primary failure from retries, wrapper errors and stale UI. Trace the producer, contract owner and next consumer before editing; inspect sibling callers of that contract.

Fix the narrowest shared owner. Check saved pending or failed state, callbacks and notifications only where the defect affects them. Preserve successful work. Recovery must not duplicate payments, inventory movement, audit events or provider sends. Do not reset quotas, weaken authorization or invent values to make the flow pass.

For a simple defect, a short evidence note is enough. For a multi-stage failure, record affected path, broken contract, repair and verification in the existing delivery documentation. Diagnosis-only requests remain read-only; this skill does not authorize paid retries or external messages.

Add a regression test at the failed boundary and exercise the next downstream consumer. Include stale or duplicate callbacks when relevant. If a new failure appears, determine whether it is the same cause before retrying. Report separately what was repaired, locally tested, deployed and recovered. Use `luma-imai-journey-review` for final user-flow evidence and the existing ship-pr playbook for release.

Source: `.agents/skills/end-to-end-root-cause-fix/SKILL.md` in imai-dev. Adapted to Luma's exact units, audit, prototype and provider boundaries.

IMAI dev-studio source revision d66c35ae5f5087cc927cb94c3341df6a461ce546, inspected 15 October 2026. Adapted guidance; native apps remain on hold.
