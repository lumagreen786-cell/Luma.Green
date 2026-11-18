## Active Afterlife design — owner approval, 18 November 2026

The owner approved the Afterlife preview for the full web platform and authorized
implementation of the public/business domain split. This supersedes Florin,
Orbit and earlier composition rules. Preserve workflow, authentication, privacy,
exact units, accessibility and native trust boundaries.

- Reference: `output/design/astryx-homepages/`. Retain both appearances, original
  lime/forest palette and existing images. The darker-green replacement and
  cyberpunk pass were rejected. Do not restore them.
- Photo-backed heroes use dark overlays and white text in both appearances.
- Use the actual Luma logo. Align mark/name; footer tagline sits below the name.
- Avoid ornamental summary cards and long explanations. Use clear titles,
  open sections, aligned actions and useful record panels. Pills are for single
  rows only; wrapping controls and form containers have bounded corners.
- Use Geist and Noto fallbacks in production; copied preview Suisse files have
  no confirmed public-deployment licence. Keep installed Lucide icons and use
  the WhatsApp brand glyph for WhatsApp actions.
- GSAP reveal and rotating audience text are restrained, with reduced-motion
  support and cleanup. Do not hijack scroll or block task controls with motion.
- Hero audience rotates Apartments, Coffee shops, Offices. Do not label it
  Homes and waste generators. Public booking CTA is Book now, a direct wa.me
  link with prefilled message and the configured recipient. No modal or phone
  form. Until the owner supplies a number, show an honest unavailable action.
- The phone shows 15 WhatsApp-style sample conversations in a loop, no visible
  playback controls or date/example labels. Pause offscreen and when hidden;
  show static content for reduced motion. It is visual content, never evidence
  of a live booking, provider confirmation or private customer record.
- One Next.js codebase and existing Convex backend serve luma.green (public)
  and business.luma.green (business ecosystem and workflows). Deploy routing
  after DNS/TLS and automated compatibility checks; real-account and device
  acceptance is owner-deferred. Keep old operational
  routes reachable until native and existing-link migration is complete.
- Owner clarification: restyle every route now, not only shared tokens. One
  Afterlife style covers public, business, household, account, operational and
  admin screens, including hosted native screens. Keep one admin console and
  one backend; the subdomain split does not duplicate either. The owner will
  perform real-account acceptance later; record it as deferred, never passed.
- Track routes and states, run pnpm check/build and relevant browser checks.
  No invented live records, generated screenshots, auth shortcuts or native
  release claims. Keep canonical instructions consistent with this approval.

# Historical Florin reference — 11 November 2026

The Afterlife contract above supersedes this historical reference. The owner selected the full Florin application,
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
