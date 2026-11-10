# Approved design system implementation plan

**Goal:** Apply the approved light-only Ship X-inspired system to all Luma web,
admin and Expo iOS/Android interfaces.

**Architecture:** Shared semantic tokens and shadcn controls own appearance.
Shared public/workspace/admin composition carries the layout across routes.
Expo keeps hosted workflows and aligns its native surfaces. Preserve business
logic and records.

**Spec:** `docs/design/luma-design-system/README.md`.
**Execution:** Owner requested immediate multi-agent implementation. Independent
agents own public/auth/household, app/admin shell, and mobile; the parent owns
tokens, appearance, fonts, controls, feature gaps, coverage and integration.

## Constraints

- Base colours: #EBFF00, #A8E665, #317F38, #144419, #FFFFFF.
- Light-only before first paint and on Expo iOS/Android.
- Keep auth, access, consent, private files, provider limits, exact units and i18n.
- No synthetic live data, paid calls, native publication or unreviewed deployment.
- Do not change the unrelated untracked PDF files.

## Work and checks

- [x] Record approved design and link it from AGENTS.md/current UI contract.
- [x] Replace shared palette, type and appearance bootstrap/provider; test stored
      dark preferences, denied storage and notification direction.
- [x] Move ordinary ActionButton usage to shadcn; keep control semantics and
      minimum targets; align charts to approved line/hatch style.
- [x] Restructure workspace/admin navigation and shared page panels; test role
      visibility, mobile navigation, route selection and account access.
- [x] Restructure public/auth/onboarding/household surfaces; retain required
      text, form values, consent and unavailable states.
- [x] Align all Expo shell surfaces, status bar, launch settings and WebView
      appearance; run apps checks and report physical device limits separately.
- [x] Inventory every route and UI feature; adapt feature-level gaps that shared
      components do not cover. Include errors, loading, empty and permission states.
- [x] Run pnpm check, build, relevant browser journeys and visual matrix. Review
      diff and record actual acceptance evidence and remaining gaps in handoff.

## Review focus

1. A stored/system dark preference must not change light-only rendering.
2. Long/RTL labels must retain access to all navigation and actions.
3. A form error or view change must not drop entered information.
4. Empty/denied/unavailable records must not become mock successful data.
5. Native recovery and update changes must preserve safe restart and permission
   boundaries, including Android back and iOS safe-area behaviour.
