---
name: luma-imai-motion-performance
description: Review Luma web transitions for layout shift, unnecessary work and reduced-motion support.
---

# Luma Imai Motion Performance

Prefer CSS transitions for local feedback. Animate transform/opacity when motion is needed; avoid per-frame layout measurements, whole-page observers and permanent will-change. Do not add a motion library for a form refresh. Keep reserved image dimensions and stable control sizes.

Use motion-reduce overrides and check that cancellation leaves controls usable. Animation is optional; do not treat every conditional field as a missing animation. A focused form should not move under the user while they type.

Source: `.agents/skills/fixing-motion-performance/SKILL.md` in imai-dev, adapted to Luma's existing motion contract.

IMAI dev-studio source revision d66c35ae5f5087cc927cb94c3341df6a461ce546, inspected 15 October 2026. Adapted guidance, not a copy of the IMAI runtime.
