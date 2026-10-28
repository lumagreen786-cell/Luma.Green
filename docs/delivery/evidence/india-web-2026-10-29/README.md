# India web component evidence — 29 October 2026

This small selection shows actual current web components in **labelled, isolated fixtures**. It does not prove authenticated access, Production deployment, provider execution, legal approval or native release acceptance. All records and paper contents shown are synthetic. No paid calls were made.

| Capture                                                  | Scope                                                                                           |
| -------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| [Geography, RTL phone](geography-rtl-phone.png)          | Arabic, dark, 390px. Join address stage retains typed city and the long merged UT selection.    |
| [Local prices, desktop](geography-price-desktop.png)     | English, light, 1440px. Explicit locality and honest empty price state. No invented quote.      |
| [Paper review, RTL phone](paper-rtl-phone.png)           | Arabic, dark, 390px. Synthetic source and editable review.                                      |
| [Paper review, desktop](paper-desktop.png)               | English, light, 1440px. Synthetic source beside the review form.                                |
| [Admin references, desktop](admin-reference-desktop.png) | English-only admin component, light, 1440px. Carbon draft status and evidence limits.           |
| [Home price action, phone](teaser-phone.png)             | English, light, 390px. Keyboard focus on the action to `/prices`; no editable locality control. |
| [Home price action, RTL desktop](teaser-rtl-desktop.png) | Urdu, light, 1440px. Action-only teaser with RTL placement.                                     |

The fixtures import the source components and compile the current global stylesheet. They reuse cached Next CSS/font assets and locale font classes. Data hooks, selected-business context and navigation are isolated adapters where needed. Font loading, wrapping and control placement were reviewed; these are not generated interface images.

The larger local reports are in `/tmp/luma-india-research/visual-geography/report.md`, `visual-papers/report.md`, `visual-admin/report.md` and `visual-teaser/report.md`. The full review is retained separately in the owner's Final Release Evidence folder; this directory is only the small PR selection.

Geography: 24 locale/theme/width variants (en/kn/ar/ur, light/dark, 390/768/1440), with location, join, household and price states. Paper: 72 scenario runs. Admin: 18 captures. Home teaser: 24 variants. Recorded runs had no horizontal page overflow. Visual review includes the changed script and width combinations described in each report; it is not a claim of authenticated end-to-end acceptance.

The teaser loopback check used the existing native update bridge with a mock transport. Each untouched fixture document allowed restart preparation, became inert and emitted a restart request. This proves the removed editable controls no longer block that guard in this fixture. Hosted homepage and real native update delivery remain separate acceptance checks.

[Source and image hashes](source-hashes.json) identify each original capture and source snapshot. Paper/geography whole-message hashes changed when native messages merged; the captured HEAD hashes and unchanged rendered namespaces are recorded separately. No screenshot has been represented as a newly authenticated capture.
