# Luma.Green docs

Everything we've decided about what to build, how it's built and how it's run.
Code rules live in [AGENTS.md](../AGENTS.md) and the
[skills](../.claude/skills); this folder holds the plan and the reasons.

**Foundation release, 28 October 2026:** start with the
[plain-English specification](product/platform-refinement-interview.md),
[source coverage audit](delivery/source-coverage-2026-10-27.md), and
[current release checkpoint](delivery/platform-foundation-2026-10-27.md).
The editable specification is in `output/docx/`; the specification, storybook
and screen walkthrough PDFs are in `output/pdf/`. Capture scope and release
status are stated in the checkpoint. Expo is paused.
Useful [paid services](operations/platform-paid-services-2026-10-27.md) and
[API/UX enhancements for later review](product/api-ux-enhancement-review-2026-10-27.md)
are separate from purchased services and implemented features.

**New here?** Read in this order: [vision](./product/vision.md) →
[roles](./product/roles.md) → [architecture overview](./architecture/overview.md)
→ [roadmap](./delivery/roadmap.md).

**Resuming implementation?** Start with the [agent handoff](./delivery/handoff.md).
It lists the continuation branch, completed commits, tests and ordered next tasks.
The current redesign is recorded in [shared UI redesign](./delivery/ui-redesign.md).
Demo setup: [desktop](./delivery/desktop-demo.md), [mobile](./delivery/mobile-demo.md).
The [platform refinement interview](./product/platform-refinement-interview.md)
is the current requirements record and has an editable Word copy. The
[enhancement proposal](./product/enhancement-proposal.md) is older research.
Use the [Saturday 10 October launch test plan](testing/launch-2026-10-10.md) for
the approved local account, role, invite and provider checks. Implementation is
approved; test results and the final launch decision remain separate evidence.

**Clickable prototype:**
[Luma.Green Prototype](https://claude.ai/artifact/4hiq2r5tm5kWDBqTGEPD8C) —
private until shared from its Share menu.

For deployment setup, use the [Cloudflare activation checklist](operations/cloudflare-setup.md).

## Product — what and why

- [Organization backend contract](architecture/organizations.md): implemented APIs and limits.
- [Organization and workspace roadmap](product/organization-workspaces-plan.md):
  parent companies, existing teams, scoped collaboration and decisions to review.
- [R2 storage setup](architecture/r2-storage-plan.md): implemented quality-file storage,
  upload lifecycle, migration, configuration and acceptance plan.
- [Turnstile activation](operations/turnstile.md): exact OTP protection settings
  and production rollout steps, also summarized in the root README.

| Page                                                                           | What's in it                                                   |
| ------------------------------------------------------------------------------ | -------------------------------------------------------------- |
| [vision.md](./product/vision.md)                                               | The problem, the chain, principles, what's in and out of scope |
| [roles.md](./product/roles.md)                                                 | Every role, their device and sign-in, what each wants          |
| [onboarding.md](./product/onboarding.md)                                       | Every field each role gives us, states, admin checks, messages |
| [household.md](./product/household.md)                                         | Snap → book → track and get paid                               |
| [kabadiwala.md](./product/kabadiwala.md)                                       | Requests, auto-accept, weigh and pay, stock, prices            |
| [kabadiwala-to-yard.md](./product/kabadiwala-to-yard.md)                       | The hand-off still being researched                            |
| [pricing.md](./product/pricing.md)                                             | Rate cards, the minimum table and the fallback table           |
| [glossary.md](./product/glossary.md)                                           | Every term, and its name in code                               |
| [open-questions.md](./product/open-questions.md)                               | Decided and still-open questions                               |
| [platform-refinement-interview.md](./product/platform-refinement-interview.md) | Current interview, decisions and feasibility gates             |
| [brief.md](./product/brief.md)                                                 | The founder's own words, as captured                           |

## Architecture — how it's built

| Page                                                | What's in it                                                         |
| --------------------------------------------------- | -------------------------------------------------------------------- |
| [overview.md](./architecture/overview.md)           | Containers, modules, key flows, failure modes, what comes later      |
| [urls.md](./architecture/urls.md)                   | Route map, canonical and hreflang rules, indexing                    |
| [frontend.md](./architecture/frontend.md)           | Layouts per area, look and feel, components, every screen            |
| [auth.md](./architecture/auth.md)                   | Sign-in for each role, the admin, permissions, private files         |
| [data-model.md](./architecture/data-model.md)       | Planned tables and state machines                                    |
| [ai-estimation.md](./architecture/ai-estimation.md) | Photo → estimate, model choice, cost controls                        |
| [industry-api.md](./architecture/industry-api.md)   | Factory and industry connections, REST setup, key access and roadmap |
| [native-apps.md](./architecture/native-apps.md)     | Mobile and desktop ownership, navigation and update boundaries       |
| [decisions/](./decisions/README.md)                 | Architecture decision records, one per decision                      |

## Operations — how it's run

For caching, compression, self-hosted AI and cost measurements, use
[low-cost operation](./operations/low-cost-operation.md) and its
[verification record](./delivery/cost-optimization.md).

| Page                                                        | What's in it                                                       |
| ----------------------------------------------------------- | ------------------------------------------------------------------ |
| [environments.md](./operations/environments.md)             | Local, preview, production; releases; where each variable lives    |
| [launch-checklist.md](./operations/launch-checklist.md)     | Accounts, exact environment variables and launch verification      |
| [app-releases.md](./operations/app-releases.md)             | App accounts, environment values, signing and release acceptance   |
| [sms-notifications.md](./operations/sms-notifications.md)   | Status-message templates, outbox behavior and provider checks      |
| [push-notifications.md](./operations/push-notifications.md) | Private inbox, optional browser/Expo delivery, consent and cleanup |
| [services.md](./operations/services.md)                     | Every outside service, its status, SMS templates to register       |
| [backups.md](./operations/backups.md)                       | Daily local backups, restores, drills                              |
| [data-protection.md](./operations/data-protection.md)       | What personal data we hold, why, for how long; breach steps        |
| [incidents.md](./operations/incidents.md)                   | When something breaks                                              |
| [migrations/](./migrations/README.md)                       | Changing the schema safely, and the log                            |

## Delivery

- [Demo seed plan](product/demo-seed-plan.md): full-platform sample data,
  matching local/production manifests and scoped cleanup; planned only.
- [Responsive and language follow-up](delivery/responsive-performance-locales.md):
  accepted scope and verification progress.

| Page                                                  | What's in it                                               |
| ----------------------------------------------------- | ---------------------------------------------------------- |
| [cleanup-progress.md](./delivery/cleanup-progress.md) | UI and pilot implementation evidence from 1 October        |
| [apps-and-motion.md](./delivery/apps-and-motion.md)   | Native app and interface implementation evidence           |
| [roadmap.md](./delivery/roadmap.md)                   | Week by week to the pilot, the cut line, the critical path |
| [pilot.md](./delivery/pilot.md)                       | Who, what has to work, what we measure                     |

## Analytics, monitoring and search

- [PostHog, GA4 and Sentry setup](operations/observability.md): optional keys, visitor choice, cost controls and delivery checks.
- [Search setup](operations/seo.md): Google/Bing verification, sitemap and indexing checks.

## Platform user guide

The [team review pack](team-review/review.md) explains product scope, the stack,
theme comparisons, translated examples and account gates. Its editable Word
edition is [the team pack](../output/docx/luma-green-team-review.docx).
The [10 October test plan](testing/launch-2026-10-10.md) owns the current role
roster and release gates. Use the [end-to-end test manual](testing/team-end-to-end-manual.md)
for detailed regression cases and record actual results. The
[older prototype cases](testing/README.md) are historical examples; their sample
data does not prove current accounts, prices or payments. The [six-month plan](product/six-month-execution-plan.md)
sets proposed milestones. The [India-first legal checklist](operations/india-entity-trademark-and-legal.md)
assumes the entity is not registered and no trademark filing is complete.

Use the [A-to-Z user guide](user-guide/guide.md) for role workflows and admin
access, or open the [Word guide](../output/docx/luma-green-user-guide.docx).
[Capture and rebuild instructions](user-guide/README.md) explain the screenshot
evidence labels and the mandatory update process. Source, screenshots and Word document
must be updated together when the user experience changes.

## Rebuild the planning Word documents

Use the maintained builder from the repository root, with Python and
`python-docx` available (the bundled Documents runtime includes it):

```sh
python3 scripts/build-planning-docs.py --document all
python3 scripts/test_document_links.py  # Offline portable hyperlink regression
```

`--document interview` and `--document launch` rebuild one document. `--root`
accepts a repository path; by default the script finds its own repository.
The same maintained outputs are `output/docx/luma-green-platform-refinement-interview.docx`
and `output/docx/luma-green-launch-test-plan.docx`. Sources remain
`docs/product/platform-refinement-interview.md` and
`docs/testing/launch-2026-10-10.md`. No private temporary builder is required.
Render both with the Documents skill renderer, inspect every original page,
and update `docs/delivery/small-word-review-2026-10-07.json` with exact current
source/artifact/page hashes. A successful build alone is not a visual review.
This builder does not replace the separate platform-guide or team-review builder.

## Keeping these docs true

- A pull request that changes behaviour updates the page that describes it.
- A decision that would be expensive to reverse gets an
  [ADR](./decisions/README.md).
- An answered question moves to _Decided_ in
  [open-questions.md](./product/open-questions.md) with the date.
- Each page starts with a **Status** line; if it says "planned" and the thing
  is built, update it.
