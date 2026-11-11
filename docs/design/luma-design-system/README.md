# Luma design system — approved 11 November 2026

This is the current visual contract for all Luma interfaces. Read this file
before a UI change. It supersedes older Astryx/Matcha palette, dark-mode,
no-panel, sidebar and native-pause rules for this approved redesign.

## Approved direction

The owner approved the five Ship X-inspired Luma samples: Dashboard,
Collections, Collection Detail, Materials and Household Recycling. Apply this
system to every web route, admin route and Expo iOS/Android shell surface.
Keep the real Luma features and data. Samples are layout references, not a source
of operational values or permissions. The owner resumed mobile UI development;
this does not authorize paid services, store submission or signed publication.

## Composition correction — 11 November 2026

The owner rejected the first rollout because page structures still resembled the
previous design. Future work must change the task hierarchy and composition,
not only palette, corners or shared controls. Use compact title/action bands,
useful record grids, focused work areas and subordinate context. Avoid tall
empty columns and oversized gaps; align short panels to their content.

The owner also requested artwork behind focused screens such as login. Use a
shared decorative recycling-art background with a soft static blur and black
overlay; keep form text and controls crisp on an opaque white panel. Decorative
art is not evidence of a real collection. Keep consent and provider limits
visible. This replaces the older plain-background/no-art rule for these screens.
Do not add background blur to data tables or blur the actual form.

The owner explicitly requires black image overlays, not white or pale overlays.
Use the semantic image-scrim token at 40% opacity over focused-screen art, with
2px static blur on the image only. Black is a narrow exception to the five-colour
palette for this decorative scrim; it does not add a general UI colour or dark
mode. Keep the form card opaque white and its text crisp. Do not apply the scrim
to actual customer photos, documents or data imagery.

## Preserve existing artwork — latest owner correction, 11 November 2026

Keep the original photos and illustrations in their existing sections. This
correction supersedes the earlier request to replace all artwork or prohibit
reuse. Preserve the improved layouts, mobile wrapping and readable controls;
restoring an image does not restore the old page composition.

Add newly generated pictorial artwork only where a new visual is needed. Keep
the four new focused backgrounds for login, onboarding, administration and
workspace invitations because those surfaces were previously blank. Keep their
black image scrims and crisp, opaque white form panels. Do not generate or swap
images merely to make every placement different.

Use pictures to explain a task with less reading, while retaining translated
labels, consent and boundaries. Art is never evidence of a real collection,
customer, permit, payment or measured result. Preserve the brand logo and
mandatory provider marks. Retain new assets and their generation/placement
record; do not delete existing artwork as part of this correction. Keep the four
active new backgrounds under public/images/ship-x. Preserve the 44 unused
generated replacement scenes in docs/design/inspiration/generated-unused with
their provenance; they are reference material, not active site images.

## Colours and appearance

Only five base colours are approved:

| Token  | Value     | Use                                    |
| ------ | --------- | -------------------------------------- |
| Forest | `#144419` | Text, navigation, strong outlines      |
| Green  | `#317F38` | Primary actions, chart lines           |
| Lime   | `#A8E665` | Selected navigation, secondary actions |
| Yellow | `#EBFF00` | Attention accents, with a text label   |
| White  | `#FFFFFF` | Panels, fields, text on forest/green   |

Use white/forest mixes for the page canvas (7% forest), borders (13% forest)
and secondary text (75% forest). Do not invent another base colour. Photo and
unchanged brand-logo pixels are source artwork, not UI tokens. Mandatory provider
attribution retains its required mark/colour. Errors use a strong forest label,
an error icon, a border and accessible text; do not rely on green/yellow alone
to convey error or success. Green and white are the primary button pair. Never
use white text on lime/yellow.

Light mode is the only appearance. Remove the appearance picker. Ignore old dark
preferences, force light before first paint and keep native/web appearance in
agreement. Do not invert photos or add a system-dark alternative.

## Layout

- Desktop workspace/admin: horizontal forest navigation, lime selected action,
  clear workspace/role context, and a compact title/action row.
- Mobile: reflow navigation into reachable controls and preserve role routes,
  search, language, logout and account access. Never clip translated actions.
- Page canvas: pale green. Functional white panels have 12–16 px corners,
  modest 16–24 px padding and 12–16 px gaps. Avoid deep nesting and filler tiles.
- Dashboard: recorded-data summaries, a clear activity graph, a useful record
  list, and secondary task context. No invented trends or counts.
- Collections: filters/search next to a real list; selected detail has the next
  permitted action. Preserve entered values when changing view or recovering.
- Detail: concise facts, a labelled progress sequence and material records.
- Inventory: exact quantities, clear material groups and actual movements.
- Forms: short stages when useful, visible labels, retained values, meaningful
  validation, required consent/verification, and a clear primary next action.
- Public pages preserve their existing recycling artwork; add new art only where needed.
  Generated art is never evidence of a user's request, facility or certification.

## Components and type

Use existing shadcn/Radix primitives. New ordinary actions use the shared Button;
the ActionButton adapter must preserve existing call sites while using that
primitive. Do not blindly replace compound controls or weaken keyboard support.
The approved reference uses Plus Jakarta Sans for Latin UI; use Noto fallbacks
for all registered scripts and keep font declarations in `src/lib/fonts.ts`.
Use 26–30 px page titles, 14–16 px section labels and legible 12–14 px operational
copy. All interactive targets are at least 44 px. Pills identify actions and
states; panels use the shared radius. Lucide is the control icon family.

## Graphs

Use a thin green line, light diagonal-hatch area, quiet grid and a precise
selected-value label. Use rounded horizontal bars for material breakdowns.
Source every value from the actual query or clearly isolated test fixture.
Keep accessible labels/data equivalents and exact units. Pattern IDs must be
unique per chart instance. Do not add live maps or tracking without real data.

## Safety and coverage

Preserve backend access, roles, real authentication, admin TOTP, phone checks,
provider limits, audit records and exact grams/paise. Household users must not
estimate material weights. Keep private file access and unavailable services
honest. All product strings use the existing locale catalogues; admin is the
documented English-only exception. Support RTL and long script labels.

Expo uses the hosted web workflows and native recovery/loading controls. Keep
safe areas, Android Back, camera/file/location permission boundaries and safe
update restart checks. Do not duplicate the website into native screens.
Electron remains a compatibility consumer; preserve its controls and security.

Before declaring completion: run `pnpm check`, production build and relevant
browser checks; inspect actual pages across desktop/tablet/phone and affected
scripts. Record route coverage and any device-only gaps in the delivery record.
Passing a test or changing tokens is not proof of 100% visual acceptance.

## References

- [Source reference board](../inspiration/ship-x.md)
- [Implementation plan](../../plans/2026-11-11-design-system-rollout.md)
- Approved sample source: `reference.html` in this folder (sample data only).
