# Phone-based local acceptance

Use `provision-phone.mts` for current phone-only authentication. It uses real
Better Auth phone send/verify handlers and the private loopback delivery inbox.
It never enables email/password sign-in, installs a fixed code, disables SMS
limits or calls a live provider. The fixed persona phone mapping lives in
`convex/lib/localAcceptance.ts`. The server verifies that exact mapping and its
internal phone-email identity before creating a local domain fixture.

Run with the existing local backend, inbox and web server. Keep the web server
bind hostname equal to the hostname in `SITE_URL`. For
`SITE_URL=http://localhost:3230`, start the local web server with:

```sh
pnpm exec next dev --webpack --hostname localhost --port 3230
```

Binding it to `127.0.0.1` while using a `localhost` site caused a same-path redirect
loop in this setup. Use matching local hostnames; do not change Production routing
or weaken authentication to work around the launch mismatch.

Then run:

```sh
pnpm exec jiti scripts/local-acceptance/provision-phone.mts
pnpm exec playwright test --config playwright.foundation.config.ts
```

Private browser storage is saved with mode 0600 under the ignored
`.convex/local-acceptance/` directory (mode 0700). The runner keeps actual codes
only in memory. Browser traces, video and screenshots are disabled for these
session-bearing checks. Do not print or copy the private session artifact.

The remaining instructions describe the deprecated email-based runner. It is
retained as historical setup guidance. Current auth correctly rejects that
runner; do not re-enable email/password access to make it pass.

---

# Disposable local acceptance accounts

## Saved local configuration

The foundation test used a separate anonymous local database. Its frontend
selection is saved in ignored `.convex/local-acceptance/frontend.env`; backend
settings and session artifacts stay in the same restricted directory. The normal
root `.env.local` has been restored to cloud development. Before rerunning local
acceptance, preserve the current root environment, select the saved local
frontend settings, and verify all three URLs are loopback addresses. Do not run
fixture setup against the cloud selection. Restore normal settings afterwards.
Start Next with `--hostname localhost` when `SITE_URL` uses `localhost`; an
explicit `127.0.0.1` bind can cause Next's internal locale rewrite to be treated
as an external redirect. This is a launch setting, not an authentication bypass.

This runner prepares synthetic accounts for the approved local browser test.
It does not prepare production data or prove email, SMS, payment or compliance
provider execution. The older `demo` seed is not part of this workflow.

Use the isolated anonymous Convex deployment with the Next.js app on a loopback
HTTP origin. Put local public endpoint settings in `.env.local`. Put local auth
server settings in ignored `.convex/local-acceptance/backend.env` with mode 0600,
inside a mode-0700 directory. Configure the same values on the local backend:
`SITE_URL`, `BETTER_AUTH_SECRET`, `AUTH_LOCAL_TEST_MODE=true`, the loopback
`AUTH_LOCAL_EMAIL_INBOX_URL`, and a random inbox token of at least 32 characters.
The real Convex `CONVEX_SITE_URL` must also be loopback. No flag alone enables a
hosted test bypass. Keep all real provider credentials absent.

Start the secured inbox from `scripts/local-auth/README.md`, then the local
backend and Next.js app. Run from the repository root:

```sh
pnpm --config.verify-deps-before-run=false exec jiti scripts/local-acceptance/provision.mts
```

The runner accepts no deployment arguments. It checks all frontend/backend and
inbox origins before requests. For each reserved `.test` email identity it uses
the real signup, email verification, password sign-in, Convex token and profile
handlers. The inbox keeps delivery local. Each persona models a separate client
IP from the documentation-only range `192.0.2.0/24`; the authentication limits
remain enabled. Browser rate-limit cases must test repeat requests from the same
client. This runner is not evidence for production proxy/IP trust.

Unique passwords are saved before signup in
`.convex/local-acceptance/credentials.json`, mode 0600. A retry reuses them. Do not
print the file, commit it, capture it in screenshots or paste it into the shared
Google guide. Build a separate restricted annex for the named test team. These
accounts work only against this local database; team members need the same local
machine or their own isolated setup. Do not expose the local verification inbox
through a public tunnel.

The internal domain fixture function checks the strict local gate, the exact
roster email, verified identity and existing member profile. It creates only
synthetic organisation, owner membership, stakeholder or Saathi records. It
records every inserted row ID in an audit manifest. Running it again preserves
the records and later test actions. Invitation candidates start without a role;
assign their access through the actual invitation workflow. Stakeholder approval
does not grant business or private-report access.

No inventory, trade, payment or certificate is created by this fixture. Generate
household stock through the real pickup/receipt flow. Use separate verified
phone identities for that flow; email ownership is not phone ownership. Admin
setup, phone identity creation, sample prices and workflow actions are separate
acceptance steps. They must have their own recorded results.

Keep the database until review is finished. Cleanup is a separate controlled
step: revoke test sessions and remove only recorded test identities and their
owned records. Do not run a whole-table reset where unrelated local data exists.

## Local manufacturer byproduct example

After the verified manufacturer account exists, the separate internal
`localAcceptance:seedByproducts` fixture creates two explicit local materials:
`LOCAL-PAPER-BYPRODUCT` (Local test paper offcuts) and
`LOCAL-PAPER-UNCLASSIFIED` (Local test unclassified paper). It records 1,000 kg
of synthetic manufacturer inventory for each. The first has clearly labelled
synthetic non-hazardous evidence; the second has no classification and cannot
be listed. This is test setup, not a real hazard approval or a transformation
from material-lot evidence.

The function refuses hosted settings, unrelated records with the same codes,
and a manufacturer that was not created by the verified local account seed.
Its atomic audit marker makes repeats preserve later stock and orders. Run
the connected `byproducts.spec.ts` test only after this explicit setup. It
first records a 3,000 g own-production stock intake through the real manufacturer
form and checks the exact inventory increase. It then checks an exact 1 kg offer
at ₹12.50 with a declared grade/specification, an approved shop request, seller acceptance,
unclassified-material rejection and viewer denial. Accepted orders reserve
stock; they do not prove payment or move stock. A separate 2 kg open example
remains for the guide. Payment-provider acceptance remains a separate gate.

Current operational screenshots can be rebuilt with
`node scripts/capture-lots-guide.mjs --capture` only after the connected lot
and byproduct tests pass. It uses real local sessions, rejects external
requests, and starts a complete new matrix. The 450 original PNGs and source
hashes go to `docs/user-guide/lots-captures.json`. Review each original and
record its hash in `lots-visual-review.json`; the script never claims visual
review on its own.

The facility/industry matrix requires the connected `industry.spec.ts` journey.
It adds current facility, source picker, reference detail, reported registration
history/correction, controlled lot and disposition form captures in all 18
locale/theme/width combinations. All source references remain unverified.
