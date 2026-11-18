# Afterlife workspace composition — 18 November 2026

One design system, one shared backend and one admin console serve both domains.
The owner clarified that every page must be reviewed now; shared token adoption
alone is not full route completion. Real-account acceptance is deferred by the
owner and must not be claimed from isolated fixtures.

## Composition changes

- All workspace pages: aligned title/action rail, restrained large type,
  consistent section spacing, hairline boundaries and theme-aware controls.
- Workflow pages: left-aligned wrapping task tabs replace the decorative
  Florin notch. Visited forms remain mounted and drafts remain intact.
- Selected records: list and detail have a clear two-column hierarchy, with
  a single bounded detail surface. Mobile back/focus/scroll behavior stays intact.
- Shop home: open title/date rail, separate workload and action columns,
  unboxed operations controls and clear quick links.
- Business home: open metrics, action-first heading, waiting trades and offers
  on the main rail; employer controls on the secondary rail.
- Saathi home: open job sections and a separate earnings/open-jobs rail.
- Requests and trades: task filters sit above records; existing status counts,
  saved tab/scroll, permissions and decision dialogs remain unchanged.
- Request detail: large record title/status, open contact facts, private photos
  and a separate action surface; no scrim on actual customer images.
- Market: material filters above a consistent listing grid. Listing quantities
  and prices use an open facts row, with a clear action at the end.
- Sell: listings and creation remain separate task views; the form has one
  bounded working surface, with no decorative side content.
- Stock: open exact-value metric strip, stock groups on the main rail and
  intake/dispatch on the supporting rail.
- Prices: material groups use open two-column label/editor rows.
- Impact: metrics wrap to one column on narrow phones; charts and flows have
  separate readable columns. Evidence disclaimers remain visible.
- Compliance: checklist, permission documents and receipts are separate open
  sections rather than nested panels.
- Services: enquiries/programmes and received/shared records have consistent
  open sections; mutation permissions, drafts and conversations remain intact.
- Invoices: preserve the existing printable document composition; the shared
  theme and heading apply without changing exact financial content.

## Validation

Source review and the final production build passed. The workspace matrix
produced 112 captures: 14 routes in both themes, English at 390/768/1440px and
Arabic RTL at 390px. All report zero horizontal overflow and page errors.
Representative desktop, tablet, phone and RTL captures were visually inspected.
Evidence: `output/design/afterlife-workspace-captures/checks.json` and adjacent
PNGs (local artifacts, not source). These use real components with labelled
synthetic records and disabled writes; they cannot prove production sign-in or
provider delivery. Full unit and browser suites are recorded in the rollout log. Expo and Electron keep the same hosted web screens; no new
binary, OTA, cookie sharing or native trust origin is introduced.

## Native chrome alignment

Mobile canvas, muted and border colours now match the shared web Afterlife
tokens in both appearances. The source splash background matches the light
canvas; installed binaries need their separately approved future release to
receive splash changes. Electron's existing offline page now uses the same
light/dark canvas, typography hierarchy and lime retry action, retaining its
strict CSP, localized text and no-script boundary. No binary or OTA published.
