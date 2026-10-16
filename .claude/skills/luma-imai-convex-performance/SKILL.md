---
name: luma-imai-convex-performance
description: Diagnose measured slow or expensive Convex queries, subscriptions and mutation contention in Luma.
---

# Luma IMAI Convex Performance

Use this for a reported slow flow, read amplification, excessive subscriptions or transaction contention. Read `.claude/skills/convex-data/SKILL.md` and the available Convex expert guidance before backend edits. This skill supplies diagnosis; it does not replace the data contract.

Record the environment, affected function, input size and observed duration, bytes read or retries when available. Trace its tables, indexes, sibling readers/writers and active subscriptions. Separate observed limits from estimates. If provider metrics are unavailable, state that limit.

Check index selection and bounds before adding summary tables. Filtering after a scan does not reduce the rows scanned. Remove proven redundant reads or no-op writes while retaining permission checks and audit requirements. Check pagination for missing or repeated records. Do not make changing inventory, prices or access stale to improve a benchmark.

Choose the smallest fix supported by evidence. Do not add migration infrastructure for prototype records or introduce denormalized state without a measured need and a clear writer. Test result equivalence, denied access, relevant concurrent updates and affected sibling paths. Compare the same inputs before and after; code review alone is not a cost measurement.

Source: `.agents/skills/convex-performance-audit/SKILL.md` and `references/hot-path-rules.md` in imai-dev. Use Luma's installed tooling and prototype policy, not IMAI's migration or deployment workflow.

IMAI dev-studio source revision d66c35ae5f5087cc927cb94c3341df6a461ce546, inspected 15 October 2026. Adapted guidance; native apps remain on hold.
