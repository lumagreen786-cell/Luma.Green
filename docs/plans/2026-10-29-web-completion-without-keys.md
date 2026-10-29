# Finish agreed web scope without external keys

## Goal and authority

On 29 October the owner authorized completion of remaining agreed web features,
updated plain-English PDFs and a signup/API checklist for the office session on
30 October. The owner explicitly kept auctions/tenders and ERP/budgets/reorder
rules deferred. Mobile and desktop remain paused. Commit, checked PR merge and
Production-only release authority continues from the active session.

Use Aegis planning and Luma workflow/access skills because subscriptions,
private document assistance and recipient actions change persistent contracts.
Code is necessary: account configuration alone cannot supply missing plan
management, scoped recipient responses or reviewed text-assistance owners.

## Architecture, stack and baseline

Next.js/Convex with existing auth, workspace roles, private sources, cashfree
payment ownership and optional OpenRouter. No new stack or dependency. Baseline
main 45ad8a6 (PR24), current clean checkout, task branch
codex/web-completion-no-keys. No new worktree. Preserve other checkouts and all
Production records. No purchases, paid API requests, provider activation or
native packaging. Existing task/repository clean at start.

Read AGENTS, delivery handoff, D01-D40, source coverage R001-R084, seed manifest,
subscription target policy D38/D39, workspace permissions and current UI contract.
Existing release: 2948 web/backend tests and 859 hosted browser cases; these are
baseline evidence only, not proof of this new work.

## Compatibility and contract boundaries

Add optional schema fields or new indexed tables. No destructive migration or
reclassification. Guard every saved record at server scope. Existing business
access remains usable when billing is disabled; never manufacture a paid state.
No manual paid override or free-trial charge. Subscription API execution and
merchant approval remain separate from locally complete plan management.
Document assistance is opt-in, budget-gated, bounded, manual-review-only, and
changes no source, stock, payment, permit or official document. Recipient request
responses express a private reported conversation, not a licence or guaranteed
service. Official evidence packs remain explicitly unfiled reference records.

All new copy belongs in the 33 message catalogues; coordinator owns final merge
of per-feature namespace patches. New actions reuse Astryx controls, open
sections, exact quantities, clear unavailable states and retained form input.
Shared hosted web must keep conservative native restart compatibility; do not
change apps/mobile or apps/desktop or generate native releases.

## TDD route and verification

TDD auto -> strict for persistent behavior, permissions, quota/state transitions
and producer/consumer boundaries, under repository testing rules. Write the
contract before runtime code and coordinator-review it. Demonstrate meaningful
failed regressions then passing behavior. Docs/PDF use source consistency,
all-page renders and editable-field readback rather than artificial tests.

Focused tests use two workers and run sequentially to protect this Mac. No
parallel full lint/build/browser runs. Final pnpm check, format, production
build, affected browser journeys and labelled visual matrices. Local/provider/
hosted/live evidence remain separate. Checked PR, backend before frontend,
Production only. Provider mock acceptance does not authorize live activation.

## Tasks and owners

1. Billing agent: contract and complete provider-independent subscription plan
   selection, billing status, cancel/change requests and enforceable plan limits
   at existing membership/site owners when an authoritative entitlement exists.
   Reuse Cashfree; any unconfigured checkout/mandate remains unavailable, not
   mocked success. Inspect current official subscription docs before proposing
   an adapter. No unapproved price/tax/renewal promises. Add tests and UI.
2. Document agent: bounded optional text summary/translation assistance for
   existing private paper records, explicit consent and target language,
   immutable model output and human-reviewed derivative content. Manual mode
   remains usable. Reuse existing OpenRouter privacy/timeout/no-retry patterns
   and explicit budgets; no generic autonomous agent. Add tests and UI.
3. Services agent: finish scoped requester/selected-recipient request handling
   using existing service enquiries: clear acknowledgement/decline/response and
   close states with audit/history and revocation, no regulated execution or
   automatic payment. Examine official filing/evidence preparation gaps and
   implement a bounded unfiled evidence export if the existing owner supports it.
4. Coordinator: integrate schemas/navigation/translations, close locally provable
   R010/R026/R046/R073/R082/R083 evidence gaps without inventing operating facts,
   reconcile stale source-coverage statements/seed manifest/spec summaries.
5. Coordinator: research official signup/pricing pages and create the office
   setup checklist. Reuse OTP/Surepass/Cashfree/Vercel/Convex accounts; list exact
   settings, ownership, activation gates and what is not a signup-only task.
6. Coordinator: update research-filled team form, plain-English scope/coverage
   and blocked-input PDFs. Retain reviewed originals. Deliver final files and
   explicitly separate implemented, locally tested, live tested, blocked and
   intentionally deferred. No overall 100 percent claim from row counts.

## Acceptance and blockers

A business can use all new manual/configuration-independent paths with no keys,
with cross-org/viewer/revoked/suspended access denied where applicable. Limits
cannot silently revoke current records or bypass paid evidence. AI off is honest
and manual content is preserved. A selected recipient can respond only to the
shared request; other parties cannot discover it. No action creates official
filing, money movement, regulated approval, certificate or market credit.

Provider approval, account settings/budgets, real delivery, legal applicability,
actual operator facts, cloud restore and national-scale measurement stay named
external gates. Previous exclusions remain deferred by the owner's reply.

## Checkpoint

- Planning/read-set complete; branch based on released main45ad8a6.
- No runtime source changed yet. Per-feature contracts require coordinator review.
- Next: dispatch bounded feature owners, review contracts, implement and verify.

## Active checkpoint - contracts and local implementation

- All three contracts coordinator-reviewed before runtime implementation.
- Schema and generated API integrate businessSubscriptionTables/paperAssistTables;
  service history fields are additive. All33 namespace patches are merged.
- Billing:48 focused tests;72 labelled captures, source frozen. Services/export:
  57focusedtests;48reviewedcaptures, source frozen. AI:initial27tests then
  lost-update/audit20-testrepair run; final integrated check still required.
- Independent review repaired recipient programme authority after membership
  removal and assisted-text lost updates. System timeout audit is not falsely
  attributed to a signed-in creator. These are fixes, not new provider powers.
- Office checklist created and all6pages visually reviewed:
  Luma_Green_Office_API_Setup_Checklist.pdf. Exact account/settings source is
  docs/operations/office-setup-2026-10-30.json. No purchases or paid calls.
- Original source files still match their recorded SHA256; stale paper/billing
  and local-recovery summaries are reconciled without claiming live acceptance.
- Root owns final integrated lint/types/tests, real-loopback login journeys,
  local recovery/workload repeat if feasible, production build, PDFs, checkedPR
  and Production-only deployment. No root environment or native source changed.
- Prepared PDF sources: /tmp/luma-web-completion/build-updated-research.py
  (form plus12-pagecompanion), build-updated-coverage.py (4pages; needs
  final-proof.json), team-answers.json. Edit marker not yet run for these3PDFs.
- Existing reviewed PDFs backed up in owner planning folder
  Archive_Before_Web_Completion_2026-10-29. Office PDF create marker completed once.
- Next: assistance visual review; one integrated lint/types/focused-test pass;
  root real-auth isolated target setup and new connected web test, then full
  release checks and refreshed PDF render/field readback.

## Integrated verification checkpoint

Feature runtime source frozen; billing72, services/evidence48, assistance72
labelled captures completed with stable source hashes and stopped fixture
servers. Final manual image inspection reports remain. Root full pnpm check
running with2workers: /tmp/luma-web-completion/full-check.log. No concurrent
build, browser or individual typed lint is authorized during this run. Billing
agent prepares only connected phone test/config source. Root plans a private
loopback clone using cached Convex binary and the unchanged synthetic backup;
no Production fixture writes or root environment switch. Existing source
private backup/data and all user checkouts must remain intact.

## Combined-main checkpoint

The first integrated check stopped at53lint errors; no types/tests ran. Manual
repairs and one autofix reduced this to9late test/config/style findings, now
corrected. Fresh focused run passed118tests in14files. This is not a fullcheck
or release claim. Root will preserve the task in a local checkpoint, integrate
checked main2875c58(PR25 privacy/dependency updates), then run the full combined
checks. No automatic stash, unrelated checkout change or hook bypass.

Both research PDFs passed all23pages and53editable-field readback/reopen checks.
Office checklist passed6pages. Coverage PDF waits for final verification.
The disposable acceptance harness now copies frontend source/config/public files
and starts Next from that private copy; root environment and build files are
not its runtime inputs. The unchanged original synthetic backup stays intact.

## Current local acceptance checkpoint

Task checkpoint4f2a9a4 and checked-main merge010cc57 preserve PR25. Mechanical
locale audit now passes33locales/3304messages after an exact JSON identifier and
locale-word validator repair, with RED/GREEN145tests. No message-key exemption.
Combined lint passed; types exposed3test/guide-fixture errors, repaired with both
web/backend types passing. Failed/stopped runs are not passing fullcheck proof.

Fresh isolated normal-phone UI/server/reload journeys passed for plan, paper
summary and RTL service response/revocation, including cross-org denial and
unchanged authorized stock/money projections. No paid provider call or external
proxy request. Actual local clear/restore preserved2639user/componentrecords in
132exportedtables plus104files;50pre-existing sessions retained scoped access.
Original private backup and root environment unchanged. Frontend copied source
and assets match current files; public receipt binds actual source hashes.
This is local synthetic acceptance, not cloud recovery or national capacity.

Removed only this task checkout's old generated .next and disposable frontend
.next outputs; space recovered to9.4GiB. Original backup/source retained. Fresh
fullcheck is running in /tmp/luma-web-completion/release-full-check.log with
2workers; no concurrent heavy build/browser process. Office PDF now includes
observed Vercel Hobby deployment-storage overage73.96GB/10GB; browser team access
works. No new deployment rejection yet, no paid upgrade or history deletion.
Next: fullcheck/build, checkedPR, backend-first Production rollout, exact release
verification, final coverage PDF and bounded handoff. Mobile/desktop stay paused.

## Hosted security repair checkpoint

PR27 opened at0b57d5e; all local checks/build/42browsercases passed. Hosted
CodeQL found a high-severity path check/read race in the local acceptance
configuration. Merge is blocked until the new source passes; no dismissal or
security bypass. A deterministic path replacement and symlink regression failed
on the old sequence. The reader now opens without following a symlink, checks
that same descriptor and reads/closes it. Both config and test roster reads use
the helper; frontend/backend env files also retain restricted-permission checks.
Three regression cases pass; focused lint has0errors. No deployed business or
authentication-factor code changed.

Fresh copied-source normal-phone journeys,50person/100request workload and the
complete restore passed again after the repair. The new receipt binds source
including copied scripts/helper; original backup and root environment unchanged.
Fullcheck is rerunning in /tmp/luma-web-completion/security-repair-full-check.log.
After it passes, update counts and push the repair, wait for all hosted gates,
then backend-first Production rollout and final coverage PDF. PR26 Hono patch
remains separate queued dependency maintenance; read-only triage found the
serveStatic advisory on an unused Node adapter path, not a new web regression.
Aggregate GitHub dependency alerts are not declared cleared.

Security-repair fullcheck now passed:3022tests/368files, both types,0lint errors,
125warnings and unchanged4security/30desktop/62mobilepolicy/14mobilecomponent
checks. Source frozen; push the bounded repair after normal hooks, then wait for
new-head CodeQL and all hosted checks. Do not count the original failing gate
as passing or claim a Production release before exact Vercel identity readback.
