# Afterlife public, identity and household pages — 18 November 2026

## Composition changes

This pass changes page layouts, not only shared colours. Existing messages,
forms, session checks, private data boundaries and navigation destinations remain.
The shared Afterlife colours and Geist/Noto font stack remain the source of truth.
No DNS, provider or backend configuration was changed in this pass.

| Routes                                                               | Composition implemented                                                                                    | Main files                                                    |
| -------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------- |
| `/how-it-works`                                                      | Photo-backed white title; separated process chapters with large process pictures and details               | `page-header`, route                                          |
| `/participants`                                                      | Photo-backed title; divided participant directory with image and action columns                            | `page-header`, route                                          |
| `/standards`                                                         | Photo-backed title; quiet sticky contents rail; open, expandable standard sections                         | `page-header`, route, `standards/norms`                       |
| `/prices`                                                            | Split title and process picture; useful price board beside separated guidance/actions                      | route, `page-header`                                          |
| `/solar`                                                             | Split title and rooftop image; calculator input panel, open results and next steps                         | route, `solar/solar-planner`                                  |
| `/contact`                                                           | Split title and operations image; separate general and security contact columns                            | route                                                         |
| `/help`                                                              | Large title/process image; search panel and open role directory                                            | route, `help/help-hero`, `help/role-cards`                    |
| `/help/contact`                                                      | Wide support section plus narrow context column                                                            | route, `help/help-hero`                                       |
| `/help/[role]`                                                       | Larger role heading/image and spaced guide groups                                                          | route, `help/help-hero`                                       |
| `/help/[role]/[guide]`                                               | Open reading column, narrow sticky related guidance; existing steps retained                               | route, `help/help-hero`                                       |
| `/privacy`                                                           | Large title; sticky contents rail; readable divided policy sections                                        | `site/privacy-content`                                        |
| `/status`                                                            | Title and refresh action beside one useful live-status table                                               | `site/service-status`                                         |
| `/join`                                                              | Open title/action rail; two-column image-led business role directory                                       | route, `join/role-cards`                                      |
| `/login`, `/login/verify`, `/login/email/{verify,reset,complete}`    | Original process photography behind a wider focused panel; larger title hierarchy and aligned language row | auth layout and auth entry forms                              |
| `/join/{kabadiwala,saathi,[business]}`, `/join/[business]/documents` | Larger focused form surface; separated form title/save state; bounded grid of stages                       | join layout, `form-parts`, `form-journey`                     |
| `/join/status`, `/join/roles`, `/join/stakeholder`                   | Clear status/title rail, open requirements and review content                                              | `status-view`, `participant-directory`, `stakeholder-request` |
| `/account/*`                                                         | Persistent desktop settings rail; open main reading/work column                                            | account layout                                                |
| `/account/security`                                                  | Open heading and separated setup/verification columns; recovery controls retained                          | `account-security`                                            |
| `/account/privacy`, `/account/removal`                               | Focused request form, separate request history and retained consent/error states                           | `privacy-requests`, `account-removal`                         |
| `/account/workspaces`, `/account/workspaces/invite`                  | Workspace selector rail, bounded team/invite panels, divided invitation details                            | `workspace-page`, `invitation-page`                           |
| `/sell`                                                              | Open large booking title with original illustration; focused form panel and clearly separated stages       | route, `sell-hero`, `simple-recycling-flow`                   |
| `/sell/activity`                                                     | Large title rail; booking list and family collections                                                      | route, `my-bookings`, `household-family`                      |
| `/sell/services`                                                     | Title rail; local service lookup and a divided service link list                                           | route                                                         |
| `/sell/footprint`                                                    | Reading form beside a clear estimate; source and history retained                                          | route, `electricity-footprint`                                |
| `/sell/settings`                                                     | Family controls beside reminder/account links; open section headings                                       | route, `household-family`, `daily-reminder`                   |
| `/t/[token]`                                                         | Clear collection status rail; useful schedule/receipt panels and separate action column                    | household layout, `track-view`, `status-hero`                 |

The parent task owns `/`, `/business`, `/business/collectors`, admin and operational
screens. Account services/reports/notifications inherit the account rail and the
parent task's dedicated/shared work components. Those screens must be reviewed
with their owners; this record does not claim their private content was visually
accepted here.

## Validation

- Public/auth/account/workspace unit tests: 27 files, 155 tests passed.
- Initial public/auth/account/workspace scoped ESLint: passed.
- Household/track checks: 117 tests passed on the first run; seven concurrent timeouts in `sell-flow` were followed by an isolated rerun with all 14 tests passing. No logic edits were needed.
- Additional join status/directory/stakeholder checks: 8 tests passed.
- Household and final public/join scoped ESLint: passed.
- Final production-build join directory checks passed at 390, 768, 1024 and 1440px (4 tests, 2.6s). They assert the new image-above-title layout while retaining image quality, focus, destination and text-fit checks. Receipt: `/private/tmp/afterlife-join-final-e2e.log`.
- Four browser regressions passed against the current source: Tamil/Malayalam action fit at 320px and white editorial titles/leads in both appearances.
- Current-source browser captures cover `/how-it-works`, `/standards`, `/help`, `/privacy`, `/join`, `/login`, `/sell`, `/status`, `/solar`, each at 390px dark and 1440px light. All 18 captures have zero horizontal document overflow. Files: `output/design/afterlife-public-review/`; measurements: `layout-results.jsonl`.
- Visually inspected representative process, standards, help, privacy, join, login, collection, status and solar compositions. Found and repaired a light-mode photo-title colour override. The fixed header also has a browser regression.
- Earlier browser evidence for the previous revision is not evidence for this pass.

No new PostHog or Sentry capture is needed: these are layout changes without new
user actions, data requests or error paths. Existing consent and redaction remain.
No native shell interfaces changed. Hosted web views share these layouts; real
Expo/Electron device acceptance has not been performed.

## Limits and next checks

Inspect dark and light at phone, tablet and desktop widths, with Tamil and RTL.
Check long hero titles, the settings rail, stage labels, field errors and keyboard
focus. The owner deferred real-account acceptance. Authenticated collection/account states
remain pending approved fixture or live sessions; this is recorded as a limit, not
an extra release gate. No provider delivery, production acceptance or domain activation is
claimed by this local work. The user guide remains deferred until requested.
