# Web UX rebuild — 16 October 2026

The owner rejected the first Astryx pass: it retained too much of the old page
structure and required too much reading. This is a flow and composition rebuild,
not a palette change. Keep the original Luma light/dark colours, Geist/Noto fonts,
phone authentication and all access/data rules. No native changes. No commit,
push or PR until the owner reviews and approves the local app.

## Working direction

- Put the next useful action first. Use short titles and remove repeated leads.
- Login: one centred number form and real Send OTP action. Keep unavailable service states honest.
- Signup: role choice, relevant grouped questions, review; retain entered values,
  consent, required validation and server checks.
- Collection: focus on the current choice, then a clear next action and back path.
- Public pages: fewer visible sections; search/navigation or useful action before
  optional explanations. Keep detailed help available on demand.
- Work screens: action toolbar and records first. Select a record to see its
  detail; separate distinct tasks with labelled views, not stacked long forms.
- Account/admin: clear priorities and grouped settings with explicit permissions.

## Work ownership and coverage

Public routes and help: homepage, prices, participants, how it works, standards,
solar, contact, help index, role guides and individual guides; shared navigation,
headers and footer.

Entry journeys: login/code/language, all role applications, consent/documents/status,
public collection and its steps.

Operations: app shell, dashboards, stock, requests/details, market/listings/trades,
logistics, sourcing, facility, quality/evidence, production/lots and insights.
Account/workspaces and admin screens use the same concise task-first structure.

## Verification status

The earlier pass passed 2,412 unit/backend tests and native compatibility checks.
Those results do not certify this larger rebuild. Its full browser run was stopped
when the owner requested this new direction; results remain diagnostic only.
Two earlier production-build attempts exhausted local disk. The fresh webpack
build now passes all 3,119 pages, with web/backend type checks passing. Latest
homepage evidence: 11 unit tests, 14 responsive browser checks and a final playback
regression. Final whole-suite and protected fixture review are recorded in the
delivery handoff.
Keep current screenshots separate from historical user-guide captures. Guide/Word
updates remain on request. Local review is the next delivery gate.

## Production wording — latest owner correction

The owner is preparing production rollout. Remove simulated OTP preview actions
from customer sign-in, use the real Send OTP flow, and vertically centre the
compact form. Resend already has a five-minute server quota and code lifetime;
show its remaining time clearly and keep server enforcement authoritative.
Do not label an unavailable SMS service as a successful send. Local review
still precedes any commit, PR or deployment.

## Animated homepage preview — latest owner request

Reference inspected in the browser: https://imai-tests.vercel.app/v5.
Its hero shows an actual interface sequence with progress, pause and replay.
Replace Luma's hero photograph with a compact booking walkthrough using real
presentational components and local sample data. Keep a discreet preview label,
manual step navigation, pause/replay, reduced-motion support and the separate
real booking action. The preview must not send OTP, create requests or imply
a real payment/collection. This permission for a marketing preview does not
restore simulated sign-in.
