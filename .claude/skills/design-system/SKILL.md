---
name: design-system
description: Apply Luma's approved light-only Ship X design system, semantic five-colour palette, Plus Jakarta Sans/Noto typography, horizontal navigation, functional panels and accessible multilingual controls.
---

Latest owner direction: read `.agents/skills/luma-florin-ui/SKILL.md` and
`docs/design/luma-design-system/README.md`. Florin both-mode styling supersedes
the older Ship X guidance below. Do not update PDFs.

# Luma design system

Read [the current canonical contract](../../../docs/design/luma-design-system/README.md)
first. It is the owner of the approved palette, typography, layout, control,
mobile, localization and visual evidence rules. The 11 November 2026 approval
supersedes the older Astryx/Matcha palette, dual-theme, no-panel and sidebar
instructions. Do not restore those older rules from historical delivery notes.
The [Ship X reference record](../../../docs/design/inspiration/ship-x.md) explains
the source; its isolated sample records are not product data.

## Start with the user's task

Identify the role, route, next permitted action and current data state. Use the
existing workflows and sources. Keep required consent, authentication factors,
phone checks, scoped access, exact integer grams/paise and provider limits.
Never add invented operational counts, prices, payments, permits or carbon
credits to make a screen look complete. Missing services stay unavailable.

## Colour and appearance

The five approved base colours are forest `#144419`, green `#317F38`, lime
`#A8E665`, yellow `#EBFF00` and white `#FFFFFF`. Use the canonical semantic tokens
in components. White/forest blends provide the pale canvas, quiet borders and
secondary text. Do not add raw colour values or another named Tailwind palette.
Existing photos and unchanged logo artwork are source assets, not UI tokens;
required provider attribution retains its mandated mark.

Light mode is the only appearance. Do not add a theme picker, dark palette or
system-dark alternative. Preserve the shared first-paint and native appearance
policy. Do not invert photographs. Use forest text on lime/yellow; white text
belongs on green/forest. Error states need readable labels and an icon/border,
not colour alone. Use `attention` tokens for attention states.

## Layout and composition

Use horizontal forest workspace/admin navigation with a lime selected state.
On phones, keep every role route and account/language/logout action reachable.
Do not reintroduce a permanent sidebar as the default workspace design.

Place a compact page title and primary action above useful content. Functional
white panels group one task, record collection or context area; use the shared
12–16 px panel corners, 16–24 px padding and 12–16 px gaps. Avoid deeply nested
decorative cards and filler tiles. Use pills for selected controls and statuses.
Inspect the current radius token values instead of assuming a utility's size.

Lists keep search/filters close to real records. Detail pages show concise facts,
progress and the next permitted action. Mobile rows must preserve labels and
exact quantities. Keep values when the user changes a stage or work view.

Public pages can use the existing recycling images. A library photo never proves
an actual collection, facility or certificate. Auth and application pages keep
one focused task. Household users provide photos, location and scheduling; they
do not estimate weights. Private photos keep their existing access checks.

## Components and typography

Use installed shadcn/Radix primitives. Add a missing shipped primitive with
`pnpm dlx shadcn@latest add <name>`. Ordinary actions use the shared Button;
the ActionButton adapter preserves existing callers. Keep compound-control APIs
and keyboard behavior when a blind replacement would break them.

Plus Jakarta Sans is the Latin interface face. Noto and the registered script
faces provide full language coverage. Font loading belongs in `src/lib/fonts.ts`,
not per-page calls. Keep script-aware font fallback and normal tracking for
non-Latin text. Use semantic font utilities and the canonical size hierarchy.
The supported locale registry stays the single source for language lists.

Every product string uses the existing next-intl catalogue. The documented
admin area is English-only. Use locale-aware navigation helpers outside admin.
Use logical spacing and directions; verify Arabic and Urdu. Do not shrink or
clip translated actions to make them fit. Controls need at least 44 px targets,
visible labels, accessible names and visible keyboard focus. Progress must have
text and current-step semantics; selected controls keep their accessible state.

## Charts and recorded values

Use the shared Recharts primitive. Graphs use thin green lines, quiet grids,
light diagonal hatch fill and precise selected-value labels. Material breakdowns
use rounded horizontal bars with direct labels and exact units. Every graph
needs an accessible text/data equivalent. Pattern IDs must be unique. No chart
may invent a trend, live price or measured operational value.

## Verification and delivery

Run focused behavior tests and the repository's required checks. Then inspect
current browser captures: phone/tablet/desktop, applicable roles and data states,
translated scripts and RTL, after fonts load. Check bounds, contrast, focus,
labels and controls. A DOM test is not visual proof. Use the current route
coverage record to distinguish source implementation, inherited shared styling
and visual acceptance. Never claim all routes verified from a passing build.

Review hosted Expo and Electron effects of web changes. Native implementation
and distribution authority follow the current owner instruction; do not infer
store publication or signed release permission from design approval.

The user guide is maintained on request under AGENTS.md. Record guide impact,
but do not block code work on a Word rebuild or old screenshot refresh. Preserve
existing artifacts and label fixture captures. No secrets, private contact data,
OTP, authenticator keys or live identity documents in screenshots or logs.
