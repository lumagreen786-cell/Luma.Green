---
name: luma-imai-web-rendering
description: Review Next.js server/client boundaries, hydration and data loading when changing Luma web routes or page performance.
---

# Luma IMAI Web Rendering

Read the installed Next.js guide for the API being changed before implementation. Start with `docs/delivery/rendering-cache-audit.md` for the current route decisions. Do not copy version-specific API examples from IMAI without checking them.

Trace each client boundary and its imports. Keep static page composition on the server; isolate browser state and event handlers in small client components. Check that props crossing the boundary are supported by the installed React version. Do not turn an entire route into a client component to resolve one hook error.

Check hydration with the actual locale, theme and font. Avoid render-time browser reads or unstable initial values. For independent server reads, remove accidental waterfalls without caching sessions, permissions or private records. Keep Convex subscriptions for live data and the existing TanStack Query owner for other async work.

Use existing image/font components and declared image dimensions. Verify the affected route in a production build, including direct navigation and reload. A faster local render does not establish a production performance improvement.

Source: `.agents/skills/next-best-practices/SKILL.md` and `rsc-boundaries.md` in imai-dev. Luma's installed Next.js documentation, locale navigation and rendering audit take precedence; no IMAI runtime or routing conventions are imported.

IMAI dev-studio source revision d66c35ae5f5087cc927cb94c3341df6a461ce546, inspected 15 October 2026. Adapted guidance; native apps remain on hold.
