# Web platform UI — 15 October 2026

## Scope

The owner resumed web UI work and requested IMAI skills instead of Impeccable.
Native mobile and desktop apps remain on hold. The owner expanded the initial
entry-form scope to the whole web interface and authorized commit, push and
deployment. This pass covers public composition, login/signup, household recycling,
shared operational and account layouts, workspace controls and admin. Existing
open record lists remain; no decorative card wrappers are added.

## Skill ownership

Eleven small Luma adaptations live in `.claude/skills/luma-imai-*`, with Codex
links under `.agents/skills`. Each records the inspected IMAI source revision.
The adaptations cover design, forms, app building, interface details, i18n,
journey verification, motion performance, web rendering, Convex performance,
workspace access and root-cause repair. They use Luma's shadcn, next-intl
and Convex contracts; they do not install the IMAI SDK, app runtime or publishers.
The repo-local Impeccable bundle is removed. Machine-wide skills are unchanged.

## Design

- Sign-in uses a single phone-prefix/input group and a clear forward action.
  An editorial photo sits beside the form on desktop and becomes a compact
  image strip on smaller screens. Language choice and OTP/TOTP remain unchanged.
- Signup uses a compact public heading and two columns of role choices on wide
  screens. Application forms share a desktop image rail. Shop owner/name fields
  sit together when space permits; errors and draft saving remain in place.
- Household recycling separates the introduction/photo from the working form
  on desktop. On phones, a small image accompanies the heading. Material rows
  have larger targets, explicit add/check feedback and a distinct basket area.
- Public pages use solid surfaces and simpler closing actions. The homepage
  removes repeated secondary explanations; useful material, process, role and
  FAQ sections remain. Illustrative testimonials keep their label.
- Shared operational headers, sections and metrics use open reading rails.
  Workspace and account settings separate labels from controls on wide screens.
  Admin navigation uses flat rows and compact task headings.
- Contact and solar phone inputs use the same grouped field as sign-in. Price
  detail figures use divided rows instead of nested boxes.
- Existing translated text, brand tokens, fonts, assets and corner tokens remain
  the source of truth. All changes are web-only.

## Verification boundary

Focused behavior tests cover sign-in, onboarding and recycling. The new browser
matrix checks phone/tablet/desktop in light/dark for English, Kannada and Arabic,
including invalid phone entry, retained values, loaded images and overflow.
Existing language/keyboard and responsive-form tests remain relevant regressions.

The connected development preview uses labelled prototype material records.
A material selection is not a completed booking. Disconnected production-build
captures prove layout and preview behavior, not live SMS, authentication, payment
or provider acceptance. The isolated application preview uses synthetic records.

The older team-review Word pack and guide captures are retained as historical
artifacts. Their freshness checks remain intact in `pnpm guide:check`; no Word
rebuild or guide refresh was requested. New browser-test captures are separate.

## Release verification

- `pnpm check` passed: 280 test files / 2,396 tests, 73 native policy tests,
  web/Convex/native types and lint (38 warnings, no errors). Native files are unchanged.
- Clean production build passed with optional Convex and Turnstile settings empty.
  An incremental build had stale Tailwind utilities; deleting generated `.next`
  and rebuilding produced the verified stylesheet `50ac1a9ba7b31cc2.css`.
- The full 771-case browser run passed 765 cases, retried three Spanish cases
  under host pressure, and found three outdated artwork expectations. Those
  assertions now verify the approved compact images. The final focused run
  passed all 52 showcase/Spanish cases with one worker and no retries.
- The isolated synthetic fixture matrix passed all 48 cases against the fresh
  stylesheet. Seventeen current captures were visually inspected. Selected
  [review screenshots and provenance](web-ui-2026-10-15/README.md) are retained.
- Full formatting and whitespace checks passed. No files under `apps/`, `convex/`
  or `messages/` changed in this UI release.

Hosted checks, preview review and production deployment are separate release gates.
