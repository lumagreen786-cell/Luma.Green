---
name: luma-florin-ui
description: Build or revise Luma.Green interfaces with the approved Florin layouts, light/dark themes, Urbanist type, pill navigation and inset counted tabs. Use for Luma page, component and shared-shell UI changes.
---

# Luma Florin UI

Read `docs/design/luma-design-system/README.md` for the active contract, then
inspect the matching saved screen under `docs/design/inspiration/florin`.
Use the light/dark token JSON as measured reference; do not copy demo records.
This direction supersedes Ship X, the five-colour palette and light-only mode.

Choose the closest reference by task:

- records/finance: invoices, estimates, payments, recurring, checkouts;
- edit/create: new invoice and settings;
- people/detail: customers and customer;
- overview/trends: reports, payouts and activity;
- materials/catalogue: products.

Preserve Luma's real task and authorization, then rebuild its hierarchy to match
the reference. For record/list screens use a regular-weight heading and right-side action, summary region,
pill filters, white record sheet with inset tab dock, dark selected row and
adjacent detail. Forms use settings/editor groups with visible labels and a useful preview only when the workflow supports it. Stack at narrow widths. Do not turn every page into a dashboard.
Use `.record-sheet` and `.record-detail` for the deliberate white/ink surfaces; these helpers set child text, fields and border tokens in both modes. Do not replace them with `bg-card` or leak light-theme text into ink details.
Use Urbanist/Noto, 28px panels, full pill controls and circular count badges.
Use existing shared semantic tokens, components and theme preference.
Counts derive from actual records; omit unavailable counts. Chart bars,
hatching and values encode recorded data, not decorative financial claims.

Retain original image placements. Add art only when a task needs explanation.
Use black image scrims, never white overlays; do not blur form text or data.
Keep Luma visible beside its logo on phones and wrap translated chips. Retain
keyboard behavior, 44px targets, RTL and script fallbacks. Respect focused input,
retained form state, real authentication, private files and exact units.

Verify both modes on actual pages at phone, tablet and desktop widths. Inspect
active/inactive tabs, counters, selected rows, validation, dialogs and empty states.
Run project-required checks and record route coverage and device limits in the
handoff. Save current screenshots separately from reference samples. Do not
create or update PDFs. This skill does not authorize provider transactions,
native publication or bypassing checked PR release rules.
