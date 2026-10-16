# Designer system and page completion plan

Status: approved implementation scope from the founder request, 2 October 2026.

## Approved recycling service redesign — 3 October 2026

The founder approved the Mobbin-informed design proposal and asked to continue.
The goal is a friendly collection service for households and clear, compact
workspaces for collection shops, yards, recyclers, manufacturers, Saathis and
admin. This changes presentation and language across the existing routes.

Use “recyclable materials”, “material prices”, “recycling network” and “local
collection shop” in user-facing copy. The public primary action is “Book a
collection”. Keep the familiar kabadiwala name where it identifies a role;
explain that role as a local collection shop. Internal `scrap` stages, API
fields and catalogue codes retain their existing meaning and identifiers.

The homepage uses an editorial split between an action-led heading and material
photography. Material choices and the collection journey follow immediately.
Secondary public pages use a shared split heading and wide image, short reading
blocks and clear links. Collection screens use connected progress markers,
open material rows and a clear next action. Auth and onboarding use the same
type and spacing hierarchy. Workspaces use compact navigation, strong page
headings, divided task lists and aligned quantities. Admin follows the same
system with its existing English-only boundary.

Preserve the current contract below: neutral light/dark themes, green actions,
the real logo, Geist/Noto, control corners, all locales, exact amounts,
accessibility, honest data and existing protected workflows. The generated
proposal is a visual concept, not app evidence. Do not implement its incidental
sample records or implied unimplemented approval states.

### Research used

- [OLIO nearby reuse](https://mobbin.com/screens/8977c3ce-813b-4231-9233-7824a6b230e8): clear categories and local context; no new map dependency.
- [Amazon recycling choices](https://mobbin.com/screens/a90de4c0-c58f-4d93-af78-fa6ada7a6cc7): short, concrete material and service descriptions.
- [Square inventory](https://mobbin.com/screens/14883fb0-c276-42d3-8e23-957ffdd15a67): compact filters, aligned rows and clear active navigation.
- [Bower](https://getbower.com/): explain sorting through direct actions.
- [ScrapUncle](https://scrapuncle.com/): make material categories and collection steps visible. Do not copy payment promises or service claims.

### Implementation and verification plan

Architecture: edit the existing Next.js/React layouts and feature components;
reuse Tailwind semantic tokens, shadcn controls and next-intl catalogues. No new
schema, service, routing owner, authentication path or payment behavior.
Baseline refs: AGENTS.md, this current UI contract, frontend architecture,
i18n/testing playbooks, user-guide README and delivery handoff.

Task start: clean task-owned managed worktree at f82df3c on
`codex/recycling-ui`. The primary `feat/production-prototype` checkout contains
unrelated catalogue and prototype edits and stays intact. Cleanup belongs to
this chat after the reviewed change is integrated or explicitly discarded.
The native worktree tool attaches the new checkout to this chat and requires
commands to use its returned directory; it does not change the default cwd.

TDD route: off; use proportional post-change checks. Styling uses actual browser
captures. Existing behavioral tests remain, with focused regressions for changed
accessible names, collection progress, material navigation and content structure.

1. Copy owner: `messages/*.json`, generated native messages and root copy.
   Rewrite the English wording; translate changed primary labels and headlines
   in every registered locale. Keep keys and ICU arguments stable. Verify
   locale parity, ICU contracts and generated-copy freshness.
2. Public owner: `src/components/site`, public route composition and related
   tests. Implement the split hero, useful material directory and secondary
   page hierarchy. Retain live-price state, illustration notices and functional
   navigation. Verify public content and full locale navigation bounds.
3. Flow/workspace owner: existing app, sell, household, auth, onboarding,
   account, help and admin components. Apply shared hierarchy, progress and
   density. Keep data calls, access checks, state transitions and draft recovery.
   Verify focused tests, keyboard/RTL behavior and fixture captures.
4. Evidence owner: user guide source, screenshots/manifests, Word build/review,
   cloud pending state and delivery handoff. Run the full local check, build,
   responsive/locale browser checks, and inspect each changed screen and every
   rendered guide page. Record fixtures and disconnected pages accurately.

Checkpoint: the founder approved the UI and authorized the checked PR, Vercel
release and update of the existing Google Doc. The release branch
`codex/recycling-ui-release` starts from current main `c087a68`; it applies only
the approved UI delta and excludes the unrelated prototype backend commits.
The public preview is `http://localhost:3107`; protected component examples remain
labelled fixtures. The delivery handoff owns verification and release status.

## Current UI contract

### Entry-form redesign — 15 October 2026

Web UI work has resumed across public pages, login, signup/onboarding, household
recycling, operational workspaces, account settings and admin. Avoid nested cards,
decorative gradients and repeated explanations. Use open sections and short copy.
Use the adapted IMAI design/form skills. Keep the approved identity while giving
entry pages stronger image-led composition and clearer field/action structure.
On narrow screens, images must not push the primary form far below the fold.
Impeccable is removed from the repo and is not used for this pass. Native apps
remain on hold. The historical installation notes below are not current routing.

### Platform UI pass — 6 October 2026

The founder requested a platform-wide UI pass after reviewing the phone/email
switch. Preserve the identity below, but replace oversized selection trays and
inconsistent task-page spacing. Tabs use content-width labels, a thin baseline
and a green active underline. Each target stays at least 44px tall; labels can
move to another row as a group instead of clipping or shrinking. Keyboard
navigation, visible focus, disabled states and locale direction remain required.

Operational and account headings use a compact 24/30px hierarchy. Forms and
task sections use a 24px rhythm. Team records align identity and controls on
wide screens and stack on phones. Public task pages put the useful search,
form or data closer to the heading; their required imagery remains secondary.
Story pages retain their editorial composition. Collection and tracking pages
use the same compact task hierarchy without changing the booking process.

The route inventory and verification status are recorded in
`docs/delivery/ui-refinement-2026-10-06.md`. Earlier screenshots do not verify
this revision. Rebuild the maintained guide from reviewed current captures.

This section is the canonical design rule set for future agents and teammates.
It consolidates the founder's accepted requests on 2 October 2026. Apply it to
public, sign-in, onboarding, household, operator and admin screens. The dated
sections below preserve the work history and earlier test results; they are not
current completion evidence and do not override this contract. See the delivery
handoff for the current build and open gates. New user directions supersede this
contract. Make routine fixes within it without adding another approval step.

### Keep the identity and make each screen useful

- Preserve neutral light/dark surfaces, restrained green actions, Geist Latin
  display, Noto body/script coverage and the existing Lucide family. Use semantic
  tokens and shared controls. Keep existing corner tokens and approved shapes;
  a polish pass does not mean changing global radii, rounding everything or
  introducing a new theme.
- Use open sections, fine dividers, compact metric rows, useful lists and tables.
  Do not add generic cards, nested panels, bento tiles, repeated explanation
  blocks or decorative statistics. Functional input borders, dialogs, sheets,
  badges and popovers remain valid. An installed Card primitive does not override
  the no-card layout rule.
- Make hierarchy, alignment, line length, spacing and state clear on every
  screen. Add helpful domain detail from real records or approved labelled demo
  data. Do not pad empty space with vague prose. Empty states need a useful next
  action; loading/error/disabled states need honest feedback and a recovery path
  where one exists. Preserve the user's entered values on recoverable errors.
- Reuse the existing 4px spacing scale and section rhythm. Adapt spacing to the
  task, viewport and content. A dense operational list and a public story page
  need different spacing. Check screen edges, table headers, labels, helper text,
  validation messages, icon baselines and action placement.

### Navigation and controls

- Keep the public navbar on one row. Below **1280px**, the header contains only
  the brand link and menu trigger. Navigation, theme, language, sign-in and sell
  controls belong in the side menu. Do not leave a crowded settings row outside
  it on phones or tablets. At desktop widths the full row must fit every locale.
- Below the phone wordmark breakpoint (**640px**), show the mark without visible
  “Luma.Green” text, while retaining an accessible brand name. Do not distort or
  recolour the logo. The side menu must scroll at short heights, keep its settings
  reachable, respect safe areas and open from the RTL-aware inline end. Keyboard
  focus, Escape, focus return, route navigation and resize-to-desktop must work.
- Show the current language in its own name, and use the same endonyms in the
  selector. Use a chevron; do not restore the rejected translate icon. Localise
  settings labels and accessible names. Keep theme choice visible and reversible.
- Do not use large bordered selection tiles for language, role, material or
  delivery choices. Use compact rows or radio controls for short lists and a
  searchable picker for long lists. Show the current choice clearly. Keep the
  list within the available screen height, preserve keyboard selection and focus,
  and keep targets large enough to use without turning each option into a panel.
- Ordinary action-button labels stay on **one line** with no clipping or overlap.
  Let an action group wrap or stack, use the available width, or shorten the
  translated action while preserving its meaning. Do not wrap text inside a
  fixed-height button or shrink it to unreadable type. Use shared variants and
  keep the 44px minimum target, 48px large actions, focus ring and disabled state.
  Body text, field help, menu descriptions and headings may wrap naturally.
- Every control has an accessible name and a real outcome. Do not use a dead
  “opens soon” page to hide an implemented interface. Unconfigured phone sign-in
  may reach the labelled OTP preview, but it sends no SMS, verifies no code and
  creates no session. Preview mode must not bypass a protected route.

### Languages, fonts and exact entry

- `src/i18n/locales.ts` is the only locale registry, currently **33 locales**.
  Read endonyms, direction and hreflang from it. Use complete translated
  catalogues and canonical material names; preserve ICU arguments and brand
  literals. English fallback is a recovery mechanism, not translation completion.
  Track native review separately from automated catalogue checks.
- All scripts must render with their approved font. Keep font declarations in
  `src/lib/fonts.ts`, script selection on the locale root and system fallbacks
  after the actual script font. Check loaded browser fonts, not only CSS family
  strings. Do not let a metric/system fallback claim glyphs before the locale
  face. Avoid unnecessary font preloads and forceful Latin tracking/line counts
  on non-Latin text.
- Use logical CSS properties and test Arabic and Urdu. Keep numeric identifiers
  readable without reversing their characters. Test long Tamil/Malayalam labels,
  accented Latin, Cyrillic, Thai, Sinhala, Odia and CJK content when shared layout
  or font behavior changes. No clipped words, missing glyphs or horizontal page
  scrolling is acceptable as a translation workaround.
- Pass the registry's locale direction to each Radix Select root. The page's
  `dir` attribute alone does not set the primitive's direction or its portal.
  Check the selected text, chevron, option list, keyboard navigation and focus
  return in Arabic and Urdu when adding or changing a select control.
- Use `src/lib/number-input.ts` with the active locale for amount entry. Accept
  supported native digits and the locale decimal separator, validate ambiguous
  or invalid input, and store exact integer paise/grams. Format output with
  next-intl. Do not use floating-point parsing for money or mass.

### Images, detail and motion

- Main public pages keep purposeful wide banner art: How it works, Participants,
  Prices, Standards, Solar, Join, Contact and help landing/role/contact pages.
  Home keeps its hero. Reuse shared banner/header components and responsive crops.
  Place readable page copy outside the image. Help articles keep their reading
  layout; auth forms and transaction screens do not need decorative banners.
- Generated images or line art may explain a material or process. They must not
  impersonate product screenshots, real customers, certifications or partners.
  Give informative images useful alt text and decorative images empty alt text.
  Keep assets compressed and layouts stable as images load.
- Keep animation selective. Use existing 150–200ms control feedback and restrained
  emphasis on chosen public actions; do not apply shimmer, parallax or moving
  borders to every control or operational row. Motion must not shift layout,
  hide information, delay input or add a new focus target. Preserve the approved
  corners when adapting a visual effect.
- The logo mark may turn once through 360 degrees with the approved 900ms
  ease-out on fine-pointer hover or keyboard focus of its link. The wordmark
  stays still and the resting mark remains upright. Material marquees need a
  usable pause control and a static reduced-motion presentation. Reduced motion
  disables and cancels decorative motion, including a preference change during
  an active effect. Test touch, keyboard and reduced motion explicitly.

### Honest data and fast rendering

- Use recorded values for live charts, activity, balances and claims. Missing
  live prices show loading/unavailable placeholders, never sample quotes passed
  off as current prices. Owner-authorised seeded demo prices may appear with a
  clear sample-price notice; they are not verified market quotes. Approved demo testimonials remain visibly illustrative,
  use role descriptions and do not claim real customer identities or validation.
- Offline demo records remain labelled and isolated. Approval to draft demo data
  does not approve database import, production identities, an OTP bypass or
  provider execution. Follow the demo seed plan and its explicit coverage gaps;
  do not invent unsupported materials or workflow states to fill a screen.
- Prefer server-rendered page structure and static generation for stable public
  content. Keep small interactive leaves for live data, forms and device state.
  Inspect actual production HTML/cache headers before proposing cache changes;
  forcing request-time SSR can make a static public page slower.
- Never put sessions, authorisation results, private records or changing live
  prices into a shared public/process cache. Retain live Convex reads and audited
  mutation paths. A cached page shell is not proof of authenticated access or a
  successful provider call. See the [rendering audit](../delivery/rendering-cache-audit.md).

### Required visual and functional proof

For each changed screen, inspect the **actual browser image** after fonts and
images load. Use light and dark mode, phone/tablet/desktop, English, RTL and the
changed translated scripts. Inspect page top, content, controls and the bottom;
check loaded, empty, loading and error states that the change affects. Use a
production build when font generation, static HTML or caching is involved.

Shared header and control changes must exercise every registered locale at
**320, 390, 640, 768, 1024, 1280 and 1440px**, with short-height menu coverage.
Test control bounds, text bounds and overlaps; page scroll width alone misses
painted text outside a button. Keep keyboard, reduced motion and numeric-entry
regressions covered. Run the relevant tests, locale validation, lint, types and
build; report failures rather than disabling assertions.

Use public pages directly and approved test accounts for protected routes.
Label isolated component fixtures and offline demo data. Neither proves live
authentication, server permissions, provider execution or deployment. Do not
include real contact details, IDs, passwords, OTPs, authenticator keys or tokens
in captures.

Follow [the maintained guide workflow](../user-guide/README.md) for every
user-facing change: update affected source text, recapture changed screens,
rebuild the editable DOCX, render and inspect every page, and keep the build
record with the source and evidence. Preserve the existing cloud document ID and
sharing state; record a pending connection honestly. Record guide impact even
when only these instructions change and no new screenshots are needed.

### Use external design guidance with judgment

UI/UX Pro Max, GPT Taste, Vercel Web Design Guidelines, Baseline UI and Impeccable
support the work; this contract and explicit user instructions set the product
rules. Do not import a skill's card layout, font, colour, fabricated testimonial,
heavy dependency or animation if it conflicts with this system. Mobbin can inform
mobile flow and control placement. Cite the inspected reference, state access
limits, and adapt the pattern without copying app assets.

## Starting point

Base `e403503`, clean tracked main; preserve unrelated root
`luma-green-user-guide.pdf`. Work branch `feat/design-system-polish`. The previous
visual pass was rejected as too generic. This pass replaces its visual hierarchy,
not only its colours. All public, auth, onboarding, household, operator and admin
routes are in scope. Existing access rules, exact quantities and provider gates
remain unchanged. Future product enhancements remain a separate proposal.

## Design direction

Modern industrial: cool neutral white and charcoal, restrained forest green,
strong editorial type, fine separators, a consistent eight-pixel spacing rhythm
with four-pixel adjustments. White/card surfaces are clearly separated from muted
page surfaces. Dark mode is neutral charcoal, not a green wash. Primary actions
use one restrained green. Avoid lime glow, nested decorative panels, giant round
cards, decorative dashboard photos and repeated pill buttons.

Body text retains Noto for all supported scripts. Geist supplies Latin display type through
next/font with Noto script fallbacks. Buttons share 44px regular/48px large
heights, 8px corners, 16/24px horizontal padding and stable focus/disabled states.
Cards use 12px corners; inputs use 8px. Public sections use 64/96px spacing;
operational sections use 24/32px. Content headers, action groups, empty states,
filters, tables and loading/error states use shared components.

Lucide is the single free icon system already installed. Use 18/20px icons for
controls, 24px for features, one consistent stroke weight. Keep the brand mark.
Add shadcn's Recharts component through its CLI; use existing query data only,
localized labels, semantic chart colours, tooltips, reduced motion and accessible
text/table equivalents. Never invent chart history or production statistics.

Marketing pages use wide editorial compositions and purposeful photo crops.
Generated artwork must show materials/processes, not phone/laptop app mockups.
No fake customers, testimonials, certifications, partner logos or live numbers.
Reuse existing strong assets; new art must have a clear role and be compressed.

## Skill provenance and adaptations

Installed `gpt-taste-skill` from
[Leonxlnx/taste-skill](https://github.com/Leonxlnx/taste-skill/tree/ce26fc25c0e5e8cab638f883de62d9a86ee5e45b/skills/gpt-tasteskill),
MIT. Installed at `~/.codex/skills/gpt-taste-skill/SKILL.md`.
The installer makes it discoverable next turn; it is read directly this turn.
Use its composition, image, grid-density and GSAP guidance. Its mock execution
instructions do not justify fabricated test output: design exploration uses an
actual seeded script. Random exploration does not override the requested cross-page
consistency. AIDA is for marketing, not admin forms. Mobile/RTL script needs override
rigid heading line counts. Existing Noto script support, reduced motion and
keyboard access remain mandatory. Do not use arbitrary remote Picsum assets.
The actual seeded exploration selected Cinematic Center, Cabinet Grotesk, marquee,
accordion and feedback patterns. These are inspiration, not required widgets.
Geist replaces Cabinet to use the existing Next font path; unsupported testimonial
carousels and repetitive marquees were omitted.

References: [shadcn chart](https://ui.shadcn.com/docs/components/aria/chart),
[Recharts](https://recharts.github.io/). Recharts 3.8.0 was installed through the
shadcn CLI. Lucide remains the existing free icon package (ISC licence). Installed package
licences for Recharts and Lucide were checked locally.

## Owners and implementation

1. Coordinator: shared tokens, fonts, ui primitives, dependencies, art, plan,
   screenshot evidence, document/cloud maintenance and Git.
2. Public agent: site routes/components, help and public navigation/footer.
   Change page composition and information hierarchy; preserve translated copy.
3. Workspace agent: app shell and role pages, household flows, auth/onboarding,
   market/shop/saathi forms. Standardize action placement, field rhythm, tables,
   status and empty states. No ledger or auth changes.
4. Admin/charts agent: entire admin console/auth/forms/review and charts using
   real existing data. Shared chart renderer is isolated to consuming routes.

Agents own disjoint files. Only coordinator installs dependencies, changes global
styles/ui primitives, builds, captures, commits or pushes. Inspect every route
family; keep a route/component inventory with covered and unavailable states.
No blanket source replacement without inspecting each control's purpose.

## Verification and completion

TDD route: regression tests for chart/interactive behavior; browser evidence for
styling. No test may merely assert implementation class names. Run existing
functional suites, locale parity, keyboard and reduced-motion checks. Test widths
360, 390, 768, 1024 and 1440, light/dark, English/Arabic and long-script navigation.
Use real public pages and labelled isolated fixtures for protected roles. Test
both loaded and empty states. Do not claim fixtures prove live authentication.

After integration: independent visual and code review, `pnpm check`, formatting,
production build, public browser suites and configured analytics suite. Refresh
affected guide captures, rebuild and render Word, inspect every page. Update the
same native Google Doc if connected; otherwise retain the reviewed local file and
record the exact connection limitation. Commit and push a feature branch with a
reviewable PR; merge only with current checks green. Record remaining account,
signed native, live provider and staging acceptance gates separately.

## Checkpoints

- Shared system and all three page-family source passes implemented; 41 page
  wrappers covered, plus the root error fallback.
- Homepage expanded from six to twelve main sections. Added material directory,
  pickup journey, shop workday, weight/payment, material records and FAQs.
- Review fixed Tamil/Malayalam overflow, a missing translation namespace and
  Recharts 3.8 axis-label contrast in dark mode. Generated webpack CSS retained an
  old utility in its local cache; a clean `.next/cache/webpack` rebuild emitted the
  corrected selector. The fixture capture now checks computed tick colours.
- Final clean production build passed. All 107 Chromium tests passed with one
  worker (the CI setting), including widths 360/390/768/1024/1440 and all new
  translation/layout cases. A four-worker run during captures exposed menu
  hydration timing failures; all three isolated menu tests and the complete
  single-worker run passed. Do not count the failed run as green evidence.
- Isolated configured analytics suite: five tests passed, vendor requests blocked.
- `pnpm check` passed: 1,171 web, 27 mobile and 20 desktop tests, lint and types.
- Word guide: 56 pages reviewed, 51 screenshot placements and six freshness tests.
  Google Docs publication and Git integration are tracked in the handoff/cloud record.
- Evidence strength: local implementation and regression coverage passed. Live
  authenticated acceptance, hosted CI/deployment and signed device releases are
  separate gates; this pass does not claim those have completed.

## Detail pass — 2 October 2026

The founder approved refinement of the current identity across all screens. Base
`3b29ea7` is merged main; the working branch is `feat/ui-detail-pass`. Preserve
Geist/Noto, the neutral themes, the green action colour and existing workflows.
This direction supersedes the earlier permission for content cards: use open
sections, divided lists, compact metric rows and tables. Controls, dialogs and
small status badges retain their functional borders. No replacement theme,
extra dashboard figures or backend schema changes are in scope.

The mobile wordmark is hidden while the accessible brand mark remains. The
language selector shows its current endonym and a chevron, with the same names
in its menu. Public material names form a pausable marquee; reduced-motion mode
shows a static list. The founder explicitly approved **demo testimonials** in
this conversation. Label each section as illustrative content, not customer
reviews; use role names without fictional customer identities or partner logos.

The founder also approved one 900ms ease-out turn of the shared logo mark on
fine-pointer hover and keyboard focus of its link. Keep the wordmark still and
the resting mark upright. Reduced motion disables and cancels the effect.
Use the shared CSS module; no JavaScript animation or extra focus target is needed.

Phone sign-in remains navigable through the code-entry screen with no SMS
configuration. This is a labelled interface preview. It sends no code, accepts
no successful verification, creates no session and preserves private-route guards.
The configured authentication flow keeps its existing server contract.

Installed UI/UX Pro Max (`09170eec67ee`, MIT), Vercel Web Design Guidelines
(`063bee94c3f4`), Baseline UI (`ebf5f26cd275`, MIT) and Impeccable (`4adabaf2c2bd`,
Apache-2.0). GPT Taste was already installed. Official sources:
[nextlevelbuilder](https://github.com/nextlevelbuilder/ui-ux-pro-max-skill),
[Vercel](https://github.com/vercel-labs/agent-skills),
[ibelick](https://github.com/ibelick/ui-skills),
[Impeccable](https://github.com/pbakaus/impeccable).
Skills are guidance, not permission to replace the stack, fonts, colour tokens,
accessibility, or the founder's no-card instruction. Impeccable's context launcher
lacked execute permission; its written guidance and current repository context
were read instead. No hooks or optional binary were activated.

[Mobbin onboarding](https://mobbin.com/explore/mobile/flows/onboarding) and
[verification](https://mobbin.com/explore/mobile/screens/verification) public
listings informed progressive entry, back/edit controls and verification states.
Full signed-in screen flows were not accessible. No copied app assets were used.

Verification: production build, lint and types passed. All 115 browser checks
and five isolated analytics checks passed, including 320px Tamil/Malayalam
action labels, mobile endonym navigation, RTL and reduced-motion marquee states.
The 1,181 web component/logic tests, six guide freshness tests, 27
mobile tests and 20 desktop tests passed. Public and labelled protected-fixture
screenshots were refreshed. The guide now has 62 image placements over 66 pages;
every page passed visual review. The freshness record is in
`docs/user-guide/build.json`.
The stable Google Docs copy is pending an in-place update. No provider execution
or production deployment is implied by this local pass.

## Public banner follow-up — 2 October 2026

The founder requested banners on the main public pages, especially How it works.
Base `ff7bb64` contains the completed detail pass. This follow-up keeps its themes,
typography and open sections. A shared `PageBanner` places existing material and
work-scene artwork across the content width below each page's title and introduction.
Desktop uses a wide crop; phones use a taller crop. Text remains outside the image.

Scope: How it works, Participants, Prices, Standards, Solar, Join, public Contact,
and the help landing, role and contact pages. The homepage keeps its existing hero.
Help articles retain their reading layout. Do not add cards, change authentication
or change operational screens. Refresh affected browser evidence and the Word guide;
record the current Google Docs revision as pending without replacing its document ID.

Verification passed: production build, scoped lint, 143 component tests, six guide
freshness tests and 113 public browser checks. The browser suite includes 32
banner cases at phone and desktop widths, with Arabic coverage. The 66-page guide
was rendered and reviewed; unchanged pages were checked against the prior render.
