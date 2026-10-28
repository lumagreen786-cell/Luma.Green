# Key-free acceptance work — 28 October 2026

This pass adds local proof for three connected rules. It changes no product
behavior, account setting, schema, provider flag or production record. The tests
use an isolated `convex-test` database. A network guard fails the test if any
function tries to call a provider.

The source register still distinguishes code evidence from browser, provider,
legal and operational acceptance. This report does not replace that distinction
with a percentage.

## Added checks

The owner is
[foundationRemainingAcceptance.test.ts](../../convex/foundationRemainingAcceptance.test.ts).

| Source group                 | Local proof added                                                                                                                                                                                                                                                                                                                                                                                                                                            | Limit that remains                                                                                                                                                                                                  |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| R010 — collection acceptance | A real photo-only request uses the normal upload and booking actions. Two requests fill a two-place window. A third request is refused. Changing the shop location outside its radius prevents acceptance. Two acceptance calls for the same request produce one accepted state and one acceptance event. A second request that passes its two-hour deadline stays unassigned; a late acceptance is refused and the shop cannot see its token or full phone. | This checks joint transaction behavior in the local simulator. It is not a hosted load test or proof of production conflict/retry rates. Existing holiday/window tests remain necessary.                            |
| R026 — matching              | Three offers with the same material and specification are ordered by known delivered cost. A low material price with unknown freight does not beat the known delivered quotes. Suspending the seller removes its offers and blocks a trade request. Removing the buyer's material scope also removes them and blocks the request.                                                                                                                            | Actual freight quotes, service capacity, permits and legally verified counterparties still require their own evidence. Existing distance, availability, inspection and reservation tests remain necessary.          |
| R046 — institution records   | An isolated apartment-community owner creates a recurring collection. Repeated generation creates one dated visit. The owner can share a programme's explicitly reported totals with one chosen recipient, then revoke access. The recipient cannot read the private source programme or booking. Stopping recurrence preserves the generated visit.                                                                                                         | The programme is a manual report, not an automatic aggregation or a verified institutional agreement. D26/D27 do not require a new programme-to-recurrence foreign key. This is not an institution browser journey. |

Each case asserts zero network attempts. The institution case uses fixture
approval only; it does not create or claim real institution or regulator approval.
The photo-only request does not invent a material estimate or household weight.

## Existing proof retained

- [collectionScheduling.test.ts](../../convex/collectionScheduling.test.ts)
  checks holidays at booking and acceptance, dated recurrence idempotency,
  cancellation of future generation and explicit reschedule deadlines.
- [dispatch.test.ts](../../convex/dispatch.test.ts) checks radius, known versus
  approximate locations, offer expiry, reassignment and the two-hour ceiling.
- [market.test.ts](../../convex/market.test.ts) checks current material eligibility,
  inspections, expiry, reservations, frozen freight context and competing stock
  acceptances. [marketRanking.test.ts](../../convex/lib/marketRanking.test.ts)
  checks distance, earliest recorded availability and incompatible specifications.
- [services.test.ts](../../convex/services.test.ts) checks fixed aggregate
  snapshots, recipient permissions, revocation, expiry, exact quantities and
  suspended/viewer restrictions.
- [foundationSeedAcceptance.test.ts](../../convex/foundationSeedAcceptance.test.ts)
  retains the bounded linked receipt, stock, trade, return, claim and PET examples.
- [specialistReferences.test.ts](../../convex/specialistReferences.test.ts)
  checks all eleven specialist labels across eight categories and prevents
  ordinary trade from treating them as approved routes.

## What cannot be closed by these tests

**R082 — participant browser coverage.** The additional phone-roster pass now
exercises the 28 canonical participant keys against a separate local backend.
The exact result and limits are recorded below. This is local browser evidence;
Production/provider and native-device acceptance remain separate. Platform admin
is outside this participant roster and is not claimed by this test.

**R083 — real material processes and recipients.** Reference completeness and
bounded sample transformations can be checked without external keys. They do
not establish actual factory recipes, hazard classifications, operating permits
or a permitted receiver's acceptance. Never invent those facts or activate a
specialist route to obtain a complete-looking seed set.

**Other partial groups.** R068 still needs a future optional paper-extraction
implementation and confirmation controls; a key alone will not enable it.
Manual entry is available under D37. R073 restore/load evidence is a separate
operational task. No restore or load drill was performed by this test pass.

## Verification

- New file: three tests passed.
- Related regression run: six files, 104 tests passed. It includes collection
  scheduling, dispatch, market, ranking, services and the three new cases.
- No external calls, paid quota or production writes were used.
- Scoped ESLint, formatting and Convex TypeScript checks passed. A focused
  run is not a full release check.

Do not mark all seven partial groups complete from this report. It closes a
local joint-proof gap and makes the remaining evidence limits explicit.

## Added participant browser pass

The new owners are
[provision-roles-phone.mts](../../scripts/local-acceptance/provision-roles-phone.mts),
[roles-phone.spec.ts](../../e2e/connected/roles-phone.spec.ts) and
[playwright.roles-phone.config.ts](../../playwright.roles-phone.config.ts).
The default hosted Playwright configuration excludes the connected-test folder.
This local suite must be selected explicitly.

Before any code request, the provisioner calls the server's own strict loopback
fixture gate with an empty roster. It also reads installed settings privately
and requires the same local site, delivery endpoint, delivery token and local
mode as the runner. Any operational provider setting is refused. A deliberate
inbox-token mismatch was rejected with the inbox count unchanged at zero.

The runner uses the real Better Auth phone send and verification handlers.
Library-generated codes go only to the private local delivery inbox. The existing
strict local fixture gate creates domain records only after verified identity
and profile checks. The separate backend has five local-auth settings and no
operational provider key. The cloud-selected root environment is never changed.
No fixed code, public authentication bypass or direct role grant is used.

The four team candidates accept normal phone invitations from the fixture shop
owner: administrator, member, viewer and another member. A team administrator can
read the invitation list. A member and viewer cannot manage invitations. The
viewer cannot create an organisation programme through either the screen or the
server. No email account or paid delivery service is needed for this path.

Before choosing a screen check, the test requires each participant's expected
canonical workspace kind. Each business must have its expected business kind and
owner role; the four accepted team candidates must have their exact granted
role, and the Saathi must have Saathi access. A missing role cannot pass as an
ordinary personal account.

Every participant opens an allowed work view and tests a private-record denial.
Operators open their actual workspace selector and stock screen. Saathis open
their job history or its honest empty state. Personal and stakeholder accounts
have no business workspace and cannot enter the operator console. Every allowed
writer uses the real programme form, saves an explicitly reported 1,001 grams as
a draft, reloads the page, then checks the saved state through the authenticated
server. The viewer instead proves the refusal. Another owner's private
programme is refused by the server and absent from the screen. All accounts see
the explicit provider-execution and unverified-report limits.

This proves the stated work-view, draft, reload and access cases for the roster.
It does not prove every feature of every role. It does not prove SMS delivery,
legal approval, official recipes, funded rewards, lender acceptance, payments,
Production load, real hardware or native applications. Browser screenshots,
traces and videos are disabled. Any failure details remain in the restricted
local artifact folder. Public evidence contains only persona keys, counts,
check descriptions and status.

To repeat this pass, start a separate loopback backend, inbox and Next.js server.
Use a restricted local directory with `runner.env` and a minimal Convex CLI
project. That environment must select the same loopback backend for the CLI and
web app. It needs local auth settings and the local admin key; no provider key.
When copying an existing local database, retain its local auth encryption key so
its existing Better Auth signing keys can be read. Do not replace a copied
database's encryption key with a new random value.

Set `LOCAL_ROLE_ACCEPTANCE_DIR` to that restricted directory. Run the provision
script with `pnpm exec jiti scripts/local-acceptance/provision-roles-phone.mts`.
Set `LOCAL_ROLE_ACCEPTANCE_REPORT` to a public, non-sensitive JSON destination,
then run `pnpm exec playwright test --config playwright.roles-phone.config.ts`.
The optional `LOCAL_ROLE_ACCEPTANCE_ONLY` setting accepts comma-separated fixed
persona keys for a bounded diagnostic rerun. The default covers all 28.

### Final browser result

The stronger **production-build** pass completed all **28 of 28** canonical
participants. The explicit Playwright suite passed in 1.2 minutes. Each role
matched its expected access before the browser checks. There were no uncaught
browser errors or blocked external browser requests. This used the real built
Next.js app on loopback and the separate synthetic Convex backend. It was not a
hosted Production or provider test.

The public evidence is in
`Downloads/Luma_Platform_Planning/Final_Release_Evidence/`:

- `role-acceptance-production-2026-10-28.json` records the production-build mode,
  all 28 results, the test source hash and the backend preflight proof.
- `role-acceptance-2026-10-28.json` contains the same final result.
- `role-acceptance-development-2026-10-28.json` preserves the earlier stricter
  development result: 27 passed and one textile-maker case failed. It is not
  replaced or described as a clean development run.

The development failure occurred while opening services, after its verified
identity and expected manufacturer/owner role passed. The browser reported
`SyntaxError: Invalid or unexpected token`; authentication responses were
HTTP 200. Development logs also show intermittent streamed-HTML hydration
mismatches. Those failures did not occur in the stronger production-build pass.
The difference suggests a development-mode streaming or bundling problem; the
exact cause was not established and no product repair is claimed. Private error
messages, any available stack and development logs remain restricted.

Normal provisioning with the backend preflight completed all 28 existing phone
sessions. A negative preflight with a deliberately wrong local delivery token
failed before code delivery; inbox message counts remained zero. TypeScript and
scoped ESLint passed, with role-conditional test-style warnings. Formatting
passed. The broader release checks remain the parent task's work.

The local web server, backend and private delivery inbox were stopped after the
final result. The root cloud environment, original private backup, existing
historical captures and native projects were not changed by this pass.
