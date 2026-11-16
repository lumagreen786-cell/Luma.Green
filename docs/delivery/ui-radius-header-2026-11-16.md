# Wrapping corners and header controls — 16 November 2026

The owner asked for the same radius repair across the platform and for smaller,
quieter header utility controls. This change does not perform the separate Orbit
redesign. It preserves the current semantic palette, type, images and workflows.

The audit searched all 98 `rounded-full` occurrences in `src/components`.
Circles remain on avatars, icons, counters, timeline markers and progress bars.
Single-row inputs, buttons, phone input and scrolling workspace navigation keep
their pill form. Containers with wrapping text use bounded radius tokens.

Updated areas:

- Shared `ui/tabs` and its workflow, requests, role-explorer and admin callers.
- Auth, join and household recycling progress labels.
- Household navigation, privacy-request option rows, account links/security
  status, notification labels, market filters and shared status labels.
- Help/role links, resource actions, public navigation/privacy links, hero label
  and the worker's wrapping weekly earnings link.
- Appearance and page-grid header controls: transparent ghost buttons, 44px
  targets, bounded corners, accessible names, existing hover/focus treatment and
  working keyboard menus. Both appearance entry points use the shared control,
  so public, workspace and admin receive the same repair.

`AGENTS.md` now starts with the owner's exact Active Orbit decision and a new
radius/header rule. The older Florin paragraph is marked superseded. The
current design reference files were not rewritten by this bounded repair.

Guidance: the requested repository `ui-ux-pro-max` directory is absent in this
checkout. The installed skill at
`/Users/syedabdulmuqeeth/.codex/skills/ui-ux-pro-max/SKILL.md` was read instead.
OLED style, compact-label UX and Tailwind overflow searches were run, followed
by the accessibility/interaction/performance and delivery checklists. Their
palette and font suggestions did not replace Luma tokens. The owner's explicit
rule for readable wrapping labels takes precedence over a generic no-wrap
recommendation.

Verification: 20 tests passed across shared tabs, appearance control, workflow
tabs, join journey, public navigation, admin shell and privacy request tests.
The new page-grid test and repeated appearance/tab tests added another six
passing checks. Keyboard open/Escape/focus return and long RTL tab labels are
covered. Class assertions only check the regression contract; they do not prove
rendered visual quality. Current browser captures at phone/tablet/desktop widths
in both themes and long-script/RTL pages remain part of the parent release
verification. Native device acceptance is separate.

No new analytics event or Sentry payload is needed for corner and utility-button
styling. Existing navigation and error behavior remain. No provider call, secret,
schema, record or permission is changed by this UI repair. The separate rate
permission repair is recorded in the stakeholder audit.
