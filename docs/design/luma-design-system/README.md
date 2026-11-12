# Luma design system — Florin, 11 November 2026

This is the active UI contract. The owner selected the full Florin application,
including light and dark modes, replacing the Ship X palette and light-only rule.
Use the project skill [luma-florin-ui](../../../.agents/skills/luma-florin-ui/SKILL.md)
for every UI change. Do not create or update PDFs for this rollout.

## Source and evidence

Reference: https://ui.cortexcn.dev/previews/florin/estimates/
Saved reference captures and computed tokens: [Florin board](../inspiration/florin/README.md).
These are third-party sample screens, not Luma data or acceptance evidence.
Inspect the corresponding reference before editing a Luma page. Match composition,
not just colours. All billing pages, customers, products, reports, activity,
settings and the invoice editor inform their equivalent Luma workflows.

## Appearance

| Role                      | Light   | Dark    |
| ------------------------- | ------- | ------- |
| Page canvas               | #e7e9ee | #080b14 |
| Foreground                | #14161c | #f5f6f8 |
| Panel                     | #ffffff | #23262f |
| Muted text                | #5d616c | #a3a6b1 |
| Primary                   | #9bf80f | #9bf80f |
| Primary text              | #10130a | #10130a |
| Record sheet / navigation | #fffffd | #fffffd |
| Selected record / detail  | #20232c | #20232c |

Use semantic tokens. Preserve the reference's deliberately white record sheets
and white navigation capsule in dark mode; dark selected rows and detail panels
have light text. Other panels follow the active theme. Errors use labelled red
feedback; charts use the saved reference colour roles. Photos are not inverted.
Support a stored Light/Dark/System preference, first-paint bootstrap and native
system appearance. Keep unreadable lime text off light surfaces.

## Geometry and typography

Urbanist is the Latin UI/display font, with Noto script fallbacks. Titles use
regular weight, tight Latin tracking, approximately 52px desktop / 36px phone;
section titles 18–22px; body 14–16px. Script fallbacks keep normal tracking.
Panels have 28px corners and 24–32px desktop padding (16–24px phone).
Buttons, inputs, search, navigation and status controls are pills; menus use
16px corners. Targets remain at least 44px. Keep local labels visible.

## Composition

- Top bar: visible Luma wordmark, page switcher, white pill section navigation
  with lime selected segment, then compact circular utility actions. Reflow at
  tablet widths; keep language, account, appearance and mobile access reachable.
- Operational page: title/action row, useful summary panels, filter strip,
  record sheet and adjacent selected-record detail. Stack these on phones.
- Workspace navigation keeps daily tasks in one desktop pill row. More opens
  the existing keyboard-accessible panel for secondary routes and account
  settings. Search can find secondary tasks without hiding the current page.
  Keep appearance selection available in workspaces and both admin shells.
- Tabs sit in a canvas-colour dock inset into the upper edge of the record
  panel. Each real count is a separate round badge. The active tab is lime
  with a dark count badge. Never invent counters or replace labels with icons.
- Finance/invoice screens retain exact amounts, statuses, actions and records.
  Use an editor/preview split only when a real supported workflow needs it.
- Charts use lime lines or striped rounded progress bars, quiet grids,
  readable selected values and accessible data equivalents. No invented metrics.
- Public pages translate this visual system into clear recycling tasks, preserve
  original photos/illustrations, and retain concise meaningful copy.
- Forms follow settings/editor grouping, visible labels, short useful sections,
  retained values and readable consent. Keep black scrims on retained decorative
  background images; never dim actual customer records or documents.

## Boundaries and acceptance

Preserve all existing workflows, authentication/TOTP, authorization, private files,
provider limits, exact grams/paise, audit records and unavailable states. Do not
add pretend billing, payment, invoice or credit operations just to match a demo.
Use existing shadcn/Radix APIs and locale catalogues; admin retains its English
exception. Keep RTL, wrapping chips, visible mobile wordmark and native safe areas.
Expo uses shared hosted screens, not duplicated native pages. No native binary,
OTA or store publication is authorized by this design task.

Track every route, empty/loading/error/detail state and acceptance gap. Run
pnpm check, production build and relevant browser tests. Inspect actual Luma
screens at phone/tablet/desktop widths in both modes and affected scripts/RTL.
Save screenshots, with isolated sample fixtures clearly labelled. Historical
Ship X evidence does not prove Florin acceptance. Release only through a checked
PR and Vercel Production; no Preview deployments. No PDF updates.

## Dashboard and wording correction — 11 November, 18:07 onward

The owner rejected inherited home blocks and requested a dashboard home, new top
and bottom navigation, fresh useful wording and stronger contrast across the
platform. Use a compact task header, action/price/business panels, short process
steps, bounded role detail images and a compact resource grid. Keep native/public
navigation distinct. Public phone navigation is a four-route safe-area dock and
hides during text entry. Do not invent personal activity or dashboard metrics.
Reset retained Astryx text tokens inside white/ink panels; check actual computed
heading colour, not only the class name. Dark detail headings must be light.
Copy may change where it helps the next action, but consent, units, provider
limits and records must remain accurate. New guidance must describe real tasks.
