# AGENTS.md — Luma.Green

**Cleaner Tomorrow in Motion.**

This file is the single source of truth for how code gets written in this repo.
Every agent (Claude Code, CodeRabbit, Copilot, a human on their first day) reads
this first. `CLAUDE.md` just points here.

**Continuing the current work?** Read [the agent handoff](docs/delivery/handoff.md)
first for branch/commit checkpoints, verification, setup gates and next tasks.

Detailed, task-specific playbooks live in `.claude/skills/*/SKILL.md`. This file
tells you what the project is and the rules that always apply; a skill tells you
how to do one job well.

---

## Current web redesign — 16 October 2026

On 16 October, after local review, the owner authorized finishing the changes,
testing, committing and pushing this branch. This supersedes the earlier
no-commit/no-push instruction. A production merge still follows the PR checks.
The latest request is a flow rebuild, not a colour refresh: reduce visible
reading, put the next action first, and show supporting details on demand.
Keep entered values when users move between form stages or work views.
Do not hide required consent, permission limits or payment/evidence warnings.

The owner rejected the previous visual pass and authorized a substantial web-only
redesign using Astryx. Use the installed Astryx 0.7.1 library and Matcha theme,
with Luma's original light/dark colours, script-aware Geist/Noto fonts and existing translations. Matcha supplies component geometry only; its palette must not replace Luma's colours. The owner
allows new composition and control shapes; older radius and side-image rules do
not constrain this redesign. Remove decorative side panels from login, signup
and collection forms. Role choices need large useful photos and concise text.
Keep open sections, no nested decorative cards, no gradients and no filler copy.
Native apps remain on hold. Preserve authentication factors, member/admin
separation, exact units and authorization. See
[the Astryx setup](docs/design/astryx-agent-guide.md) and current UI contract.
The owner then rejected the animated homepage preview. The first block is now
for households: a generated recycling illustration and the Recycle action.
Image-led business sections follow. Remove demo testimonials, avoid repeated
underline/divider decoration, and make every section follow the active theme.
Household requests use photos, address/location, pickup or drop-off, a time, name
and verified phone. Do not require households to estimate materials or weights;
the shop records those later. Photos are private and require record access.
Use Astryx for new standalone actions; retain existing compound-control APIs
where a blind replacement would break accessibility or form behavior.

## 1. What we are building

### Current delivery priority: web only

On 15 October 2026, the owner resumed and expanded UI work across the whole web
platform: public pages, login, signup, household recycling, workspaces and admin.
Use the adapted IMAI skills below. Use open sections and dividers, no nested
cards or decorative gradients, and short useful copy. Impeccable was removed from
this repository at the owner's request; do not use it for this work.
Mobile browser usability is in scope. Expo/mobile and Electron/desktop work
remain on hold: do not change, package, release or deploy `apps/mobile` or
`apps/desktop` until the owner explicitly resumes them.
Preserve existing native changes; this hold does not authorize discarding them.
On 15 October 2026, the owner approved only the Expo 57.0.29 → 57.0.30 patch
and its required dependency updates to pass compatibility checks. Test that
patch, but do not use this exception to add native features or release binaries.
Shared web/backend changes may later appear in hosted native screens, but do not
claim native acceptance without a separate test after the hold is lifted.

### Current lifecycle: preparing production rollout

On 16 October 2026, the owner said the platform is moving to production.
Use real customer-facing actions; do not put simulated OTP or demo navigation
in the sign-in path. Missing services must show an honest unavailable state.
The owner authorized commit and push after testing this revision. Production
merge and provider acceptance remain separate gates.

The 15 October prototype state had no real users. Do not assume that remains
true during rollout preparation. Preserve current records and files, and review
migration needs before destructive changes. The earlier blanket prototype
cleanup permission is no longer a safe default. Keep credentials private,
authentication and authorization intact, exact units and audit records enforced.
This does not authorize buying services or releasing native apps.

Luma.Green connects the whole recycling chain on one platform: **households**
who sell scrap, **kabadiwalas** (local scrap shops) who collect it,
**preprocessors** (yards) who sort it further, **recyclers** who turn it into raw
material and **manufacturers** who buy that material — plus **Saathis**, people
who take pickup and sorting jobs. One **admin** verifies everyone. The pilot runs
in Bengaluru in October 2026.

1. **Recover** — a household books a pickup; the kabadiwala weighs and records it.
2. **Trade** — material moves up the chain, re-sorted at every step, visible by
   location and material.
3. **Retire** (later) — recorded material mints carbon credits, which are
   verified, held, traded and finally retired.

The plan, the decisions behind it and the runbooks live in `docs/` — start at
[docs/README.md](docs/README.md) before designing a feature.

Three properties follow from that and are non-negotiable:

- **The ledger must be auditable.** A regulator may ask how any credit was
  produced. Every state change writes to `auditLog`.
- **Numbers must be exact.** Money is integer **paise**, mass is integer
  **grams**, CO₂e is **kg**. No floats for money or mass, ever.
- **Issued credits are frozen.** A credit stores the emission factor used at
  issuance (`factorUsed`). Revising a factor later never restates a credit that
  is already issued.

## 2. Stack

| Layer       | Choice                               | Notes                                                                                      |
| ----------- | ------------------------------------ | ------------------------------------------------------------------------------------------ |
| Framework   | Next.js 16 (App Router, Turbopack)   | RSC by default; `"use client"` is opt-in                                                   |
| Language    | TypeScript, `strict`                 | No `any`, no `@ts-ignore` without a reason comment                                         |
| UI          | Tailwind v4 + shadcn/ui (Radix)      | Components are vendored in `src/components/ui`                                             |
| Data        | Convex                               | Dev `proper-caterpillar-111`; prod `astute-peccary-795`, Sydney                            |
| i18n        | next-intl, 33 locales, RTL-ready     | `messages/*.json`                                                                          |
| Forms       | React Hook Form + Zod                | Zod schema is the contract, shared client↔server                                           |
| Server sync | TanStack Query                       | For non-Convex async work                                                                  |
| Auth        | Better Auth on Convex                | Verified email/password or phone codes; optional user TOTP; admin password + TOTP — see §9 |
| Analytics   | PostHog / Google Analytics 4         | Optional, visitor opt-in, public page views only (ADR 0016)                                |
| Errors      | Sentry                               | Optional error-only capture; explicit deployment flag + DSN                                |
| Testing     | Vitest + Testing Library, Playwright | See `.claude/skills/testing`                                                               |
| Packages    | pnpm 11                              | Pinned by `packageManager`; npm/yarn will drift                                            |
| Lint        | ESLint flat config, type-aware       | See §10                                                                                    |
| Mobile      | Expo 57 / React Native WebView       | `apps/mobile`; shared hosted operational UI                                                |
| Desktop     | Electron                             | `apps/desktop`; macOS and Windows signed updates                                           |

## 3. Layout

```
src/
  app/[locale]/      routes — every page lives under a locale segment
  app/globals.css    design tokens (brand scale + semantic theme)
  components/ui/     shadcn primitives — vendored, edit deliberately
  components/brand/  logo and brand assets
  components/providers/  the one provider stack
  i18n/              locale registry, routing, request config
  lib/               env, fonts, site constants, utils
  proxy.ts           locale negotiation (Next 16's middleware convention)
convex/              schema and server functions
apps/mobile/         Expo iOS/Android shell; generated native projects ignored
apps/desktop/        Electron macOS/Windows shell
messages/            one JSON file per locale, including native controls
e2e/                 Playwright specs
docs/                product, architecture, decisions (ADRs), operations,
                     migrations, delivery — start at docs/README.md
.claude/skills/      task playbooks
```

## 4. Rules that always apply

**Never hardcode user-facing copy.** Every string goes in `messages/en.json`
and is read with `useTranslations` / `getTranslations`. A PR that adds English
text to a component is wrong even if it looks fine — see
`.claude/skills/i18n`.

**Never import `next/link` or navigation helpers from `next/navigation`.** Use
`@/i18n/navigation`. ESLint enforces this; the failure it prevents is silent
(links drop the locale) and only shows up for non-English users.

**The one exception is the admin console** (`src/app/admin`,
`src/components/admin`): English only, outside the locale segment, so its copy
lives in the components and it uses Next's own `Link` and router. ESLint
allows this there and nowhere else.

**Never invent colours.** Use semantic tokens (`bg-primary`, `text-muted-foreground`)
or the `brand-*` scale. A raw hex in a component is a bug — see
`.claude/skills/design-system`.

**Read the [current UI contract](docs/design/designer-system.md#current-ui-contract)
before any UI change**, then use `.claude/skills/design-system`. That contract is
the detailed owner of the founder's accepted design rules. Preserve the current
neutral themes, Geist/Noto typography and corner tokens. Use open sections,
dividers and useful content, not generic cards or filler tiles. Keep mobile
navigation, single-line action labels and all registered languages usable.

Use shared Lucide icons and control sizes. Recharts is available through the
vendored shadcn chart primitive; charts need recorded data and readable text/table
equivalents. Installed design skills are guidance, not permission to change the
brand, add cards, invent live statistics or present illustrations as app evidence.
Demo testimonials have been removed at the owner's request; do not restore them. Unavailable
live prices show loading/unavailable placeholders, never synthetic live quotes.

**UI completion requires visual inspection.** Inspect current browser captures
in light and dark mode, at phone/tablet/desktop widths and in affected translated
scripts, including RTL. Check real font loading, label fit and control overlap;
DOM assertions alone do not prove the page looks right. Use the matrix in the
current UI contract and retain the guide evidence required below.

Native shell controls use React Native primitives or OS menus and the shared
message catalogues. Their config modules validate public app settings; backend
secrets remain in Convex. See [native apps](docs/architecture/native-apps.md).

**Never add a web component by hand that shadcn already ships.** Run
`pnpm dlx shadcn@latest add <name>`.

**Never commit a secret.** All config goes through `src/lib/env.ts`. Every var
is optional: a fresh clone with an empty `.env` must build, test and run.

**Never widen a type to make an error go away.** Fix the shape.

**Always add tests with the change.** Logic gets a unit test; a user-visible
flow gets an e2e test. See `.claude/skills/testing`.

**Always keep CI green.** `pnpm check` before you push. See
`.claude/skills/ci-checks`.

**The platform user guide is maintained on request.** Do not block code changes,
commits or deployment on guide screenshots, a Word rebuild or Google Docs updates.
The owner will request documentation work when ready. When a guide update is
requested, use `docs/user-guide/guide.md`, follow `docs/user-guide/README.md`, and
run `pnpm guide:check`. Preserve existing artifacts until then and record deferred
guide impact in the delivery handoff. Never describe historical captures as proof
of the current release.

Screenshots must show the actual current UI with approved test data. Keep
synthetic component fixtures and older seeded captures explicitly labelled;
never claim they prove authenticated access or provider execution. Do not
capture passwords, authenticator QR/keys, backup codes, live IDs or customer
contact details. Never replace browser screenshots with generated interface
images. The optional `pnpm guide:check` suite checks that the DOCX matches its
source and screenshot inputs. Run it when updating the guide.

## 5. Commands

```bash
pnpm dev            # dev server
pnpm check          # lint + types + web/native unit tests before every push
pnpm apps:check     # mobile + desktop policy tests and types
pnpm mobile:export # iOS/Android JavaScript bundles (not installers)
pnpm desktop:pack  # unsigned host desktop app
pnpm test           # unit tests
pnpm test:watch     # unit tests, watch mode
pnpm e2e            # Playwright (needs `pnpm build` first when CI=1)
pnpm build          # production build
pnpm format         # prettier --write
pnpm convex:dev     # Convex dev deployment + codegen
```

## 6. Conventions

**Commits** follow Conventional Commits, enforced by commitlint:
`feat(inventory): reserve stock when a trade is accepted`.
Scopes: `app ui i18n convex auth inventory trade carbon seo ci deps docs test mobile infra`.

**Branches**: `feat/short-slug`, `fix/short-slug`, `chore/short-slug`.

**`main` is protected.** Every change — including an agent's — lands through a
PR with the five required checks green. Never try to push to `main` directly; it
will be rejected. The author merges their own PR (solo team, zero approvals), and
merged branches delete themselves.

**Production deployments only — 25 October 2026.** The owner requires releases
to the Vercel Production environment for `luma.green`. Do not create, request or
promote Preview deployments. Disable automatic Git deployments for branches
other than `main`; keep `main` as the Production branch. Use local tests and
browser checks before the checked PR merge. For a manual deployment, explicitly
select Production (`vercel --prod` when using the CLI). This rule supersedes
older playbooks that require a Vercel preview. It does not bypass PR checks,
backend-before-frontend deployment, or production verification.

**Server vs client**: components are server components unless they need state,
effects or browser APIs. Push `"use client"` as far down the tree as possible —
a client boundary adds its imports to the browser bundle. Passing rendered
server children through a provider preserves their server boundary. Keep static
public HTML and measured route caching where appropriate; do not force
request-time rendering just to call it SSR. Never add a shared cache for
sessions, authorisation, private records or changing live prices. See the
[rendering audit](docs/delivery/rendering-cache-audit.md).

**Data fetching**: Convex `useQuery` for live data. TanStack Query for anything
else async. Never `fetch` in a component body.

**Errors**: throw typed errors from Convex functions; surface them with
`toast.error(t("common.error"))`. Never swallow an error silently.

## 7. Working with money, mass and carbon

```ts
// Right
const totalPaise = safePaiseFor(quantityGrams, pricePerKgPaise);
if (totalPaise === null) throw new ConvexError("INVALID_PRICE");
// Wrong
const total = kg * pricePerKg; // float — drifts, and an audit will find it
```

Use `safePaiseFor` from `convex/lib/chain.ts` for untrusted amounts. It uses exact
integer arithmetic and rejects unsafe totals; do not multiply JavaScript numbers
before calling it. Format only at the edge through the shared app formatter.
Money uses `src/lib/money-format.ts` to preserve exact paise and locale digits;
other numbers and dates use `next-intl`.

## 8. Accessibility and RTL

Every feature must work in `/ar` and `/ur`. Use logical properties
(`ms-*`/`me-*`, `ps-*`/`pe-*`, `text-start`/`text-end`) — never `ml-*`/`text-left`.
Every interactive element needs an accessible name. Test keyboard navigation
before calling a flow done. `src/i18n/locales.ts` owns the supported locale list
(currently 33); do not maintain a second list in controls or tests. For decimal
entry, use the shared `src/lib/number-input.ts` helpers with the active locale,
then keep amounts in integer grams/paise. Follow `.claude/skills/i18n` for copy,
ICU arguments and script coverage.

## 9. Integration boundaries

### PAN business discovery — 26 October 2026

The owner resumed PAN entry for registered kabadiwalas, preprocessors, recyclers
and manufacturers only. Use PAN to list linked GSTINs, then let the applicant
select an active registration. Saathis, households and admin have no PAN/GST
onboarding requirement. Unregistered kabadiwalas keep their existing path.
This supersedes the 25 October removal of PAN only for these business flows.
GSTIN-by-PAN returns registration identifiers, state and status, not verified
business names or addresses. Show only returned data. Use the existing selected
GSTIN detail lookup and explicit business confirmation for those details; a
service that is unavailable must not be bypassed to activate an application.
Retain verified-phone access, the shared 20 paid attempts/account/India day,
duplicate protection, 24-hour proof reuse and no automatic paid retries. Keep
PAN and result lists private. This bounded request does not authorize adding
PAN Comprehensive, DOB enrichment, all raw provider data or IRN checks to onboarding.

### Provider API ownership — 24 October 2026

Server-to-server operational API calls run in Convex actions, never in Vercel
routes or browser code. Store provider credentials, including Surepass PAN/GST
tokens, only in Convex environment variables. Configure the new development and
production deployments separately; a local `.env.local` does not configure
deployed functions. Never put provider secrets in `NEXT_PUBLIC_*` variables.
Vercel may keep public frontend URLs/flags and documented build-only credentials
that its build requires. Do not copy operational API secrets into Vercel.

Paid integrations need server-enforced request limits before provider calls,
duplicate-request protection, bounded timeouts, and no automatic paid retries.
For Surepass, the owner corrected the limit on 25 October: 20 paid attempts per
verified person/account per India calendar day, combined across PAN and GST and
all applications owned by that account. This supersedes the earlier platform-wide
cap. Total platform usage may exceed 20 calls and incur corresponding charges.
Derive the quota identity from authenticated profile access, never caller input.
Applicant checks run after phone verification and before application submission.
On 25 October the owner removed every optional PAN entry. Do not collect PAN in
shop, business or Saathi forms. GSTIN is required for preprocessors, recyclers and
manufacturers, and only for registered kabadiwalas. Fetch business details from
Surepass Corporate GSTIN, show the name/address and require explicit confirmation.
New valid submissions activate through the server without manual admin approval;
keep other admin security and existing records. GST registration is not proof of
an operating permit or ownership of the business. Households and Saathis have no
PAN/GST checks. Keep existing Saathi ID and selfie uploads. Keep paid development
calls disabled unless a separately approved allowance prevents doubling the
production budget.
Never activate another API from the provider catalogue merely because the token
has access to it. Keep tokens and identity numbers out of logs and audit payloads.

Optional services must remain disabled without configuration. Local mock tests
do not prove account approval, provider execution or production deployment.
See `docs/operations/launch-checklist.md` before enabling a service.

Convex **is** wired: the schema is deployed and `convex/_generated` is committed,
so `api` and `Doc`/`Id` types are safe to import today.

Better Auth **is** wired too: verified email/password and phone codes at `/login`, the admin at
`/admin/login` (set up once at `/admin/setup`). Guard every Convex function
with `requireUser` / `requireAdmin` from `convex/lib/access.ts`, and run
`pnpm auth:schema` after changing a Better Auth plugin. Read
`docs/architecture/auth.md` before touching auth. Account security and inbox
routes must work for households and applicants as well as approved operators.
Keep phone users passwordless; email/password login and recovery are disabled.
The configured admin phone also requires an authenticator. Normal email verification, password
recovery and invitations have separate delivery paths. An existing verified
email user may bind an unused phone after recent full authentication; this must
preserve the identity, session and TOTP and must not enable phone-only login for
that email account. Never bypass a factor with a preview
screen or restore a session before the full challenge succeeds. Test the real
Better Auth HTTP handler and Convex adapter for changes to this boundary.

Onboarding **is** wired: `/join` (public) → `/join/{kind}` → `/join/status`.
Every field rule lives once in `convex/lib/onboarding.ts` — the forms validate
with those schemas and `applications.submit` runs them again; change a rule
there, never in a component.

- **OS Digital ENVRIN** — primary OTP provider with five-minute codes/resend spacing,
  five sends then a 24-hour phone lock. MSG91 remains optional when OS Digital is not configured. Status
  notifications use a separate outbox and approved Flow templates.
- **OpenRouter or self-hosted vision** — optional transient photo estimates; server quotas and table
  prices. See `docs/architecture/ai-estimation.md`.
- **PostHog, Google Analytics 4 and Sentry** — implemented, optional, off by
  default. `NEXT_PUBLIC_TELEMETRY_ENABLED=true` and each provider's settings are
  required. Analytics also requires the visitor's choice and measures only the
  explicit marketing-route allowlist; never add private forms, booking tokens,
  identities or record contents to events. Sentry error reporting is separate
  from that choice and uses an allowlist that removes identifying context.
  Read [observability](docs/operations/observability.md) before changing capture.
- **Search ownership** — optional Google Search Console and Bing metadata
  tokens. Follow [search setup](docs/operations/seo.md); tags do not prove live
  verification or indexing.
- **Account inbox and optional push** — reuse the booking/application event
  owner. Browser and Expo delivery are off until configured. Obtain explicit
  device permission; keep lock-screen copy generic, validate trusted native
  documents, revoke installation bindings before sign-out and test late results.
  Electron notices work while the process runs. See
  [push notifications](docs/operations/push-notifications.md) before changes.
- **Resend** — normal email verification, recovery and team invitations, plus
  separately configured admin recovery. Keep its key on Convex; missing settings
  show an honest unavailable state. A provider acceptance response is not proof
  of inbox delivery. Reset preserves required TOTP.
- **Cashfree PG and Easy Split** — selected B2B provider. The bounded financial
  lifecycle is implemented: full live collection, guarded full-quantity dispatch
  and receipt, safe unpaid cancellation, admin full remaining refund and exact
  order settlement evidence. Live checkout is default-off and requires explicit
  activation, an immutable approved policy and provider/vendor checks. Final
  integrated and provider acceptance gates remain in `docs/architecture/payments.md`.
  Sandbox cannot authorize inventory movement. A confirmed refund stays held;
  it does not restore stock or cancel the trade automatically. Never add a manual
  paid override. A kabadiwala pays a household directly; Luma records that
  separate flow.
- **R2** — optional private storage for new quality attachments, off until
  configured. Application/identity documents and unconfigured quality uploads
  use Convex storage. Reads enforce existing record permissions. See
  [R2 setup](docs/architecture/r2-storage-plan.md).
- **Mapbox** — not required; location uses the browser. Do not use image GPS
  metadata as a location authority.
- **Expo / React Native and Electron** — native shells are in `apps/`. Signed
  builds, native device tests, store review and update delivery remain release
  gates. Follow [app releases](docs/operations/app-releases.md).

## 10. Lint

The config is strict on purpose (`eslint.config.mjs`). Type-aware rules run
against a real TS program, so lint is slower than you may be used to and catches
things a typecheck alone will not.

What it enforces, beyond the obvious:

- **No floating or misused promises.** A dropped `await` in a settlement or
  credit mutation loses money silently. This is the most valuable rule here.
- **No `any`, no `!`.** Fix the shape instead.
- **No `toLocaleString`/`toLocaleDateString`.** Use next-intl's formatter so
  output follows the user's locale.
- **No TS `enum`.** Union of string literals, or a `const` object.
- **Exhaustive switches** over status unions — adding a trade status breaks every
  switch that forgot it.
- **No `next/link`** — locale-aware navigation from `@/i18n/navigation` only.
- **Import order** is auto-fixed; never hand-sort.
- `sonarjs` and `unicorn` on top for bug patterns and dead code.

Lint and typecheck run `next typegen` first: route and root-param types are
generated into `.next/types`, and without them type-aware rules see `any` and
fail — on a fresh clone and in CI, but never on a machine with a stale `.next/`.

`pnpm lint:fix` handles most of it. Relaxations are scoped and commented —
vendored `src/components/ui/**`, the Convex validator DSL, tests, e2e, and root
config files each get a narrow override. If you need a new one, scope it to a
path and write down why.

**Never add a blanket `eslint-disable` for a file.** A single-line disable with a
reason comment is fine when the rule is genuinely wrong — as in `src/proxy.ts`,
where `String.raw` would break Next's static analysis of the matcher.

## 11. Skills

| Skill                          | Use it when                                          |
| ------------------------------ | ---------------------------------------------------- |
| `.claude/skills/testing`       | Writing or changing any code — what to test and how  |
| `.claude/skills/ci-checks`     | A check is red, or you're adding a new one           |
| `.claude/skills/i18n`          | Any user-facing string, or adding a locale           |
| `.claude/skills/design-system` | Building UI — tokens, shadcn, light/dark themes, RTL |
| `.claude/skills/seo`           | Adding a route, metadata, sitemap or structured data |
| `.claude/skills/convex-data`   | Schema changes, queries, mutations, migrations       |
| `.claude/skills/ship-pr`       | Opening a PR or preparing a deployment               |

### Adapted IMAI skills

The canonical copies live in `.claude/skills`; `.agents/skills` links make them
discoverable by Codex. These are Luma adaptations with source provenance, not
IMAI runtime packages. They support the current UI contract and never override
authentication, translation, native holds or release rules.

- `luma-imai-design`: composition, density, imagery and visual review.
- `luma-imai-forms`: field grouping, choices, validation and progress.
- `luma-imai-app-building`: complete workflows with real data and permissions.
- `luma-imai-interface-details`: typography, alignment and control feedback.
- `luma-imai-i18n-review`: static copy, translated fit and RTL.
- `luma-imai-journey-review`: end-to-end evidence and honest provider limits.
- `luma-imai-motion-performance`: stable layouts and restrained transitions.
- `luma-imai-web-rendering`: server/client boundaries, hydration and route loading.
- `luma-imai-convex-performance`: measured query, subscription and contention fixes.
- `luma-imai-workspace-access`: scoped membership, invitations and record permissions.
- `luma-imai-root-cause-repair`: defect tracing, safe recovery and regression evidence.

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
