# Dependency security review 28 October 2026

## Why this work is needed

Enabling GitHub Dependency graph exposed 59 existing alert entries: five
critical, 28 high, 18 medium and eight low. Entries repeat some advisories for
different dependency versions and manifests. A version alert is not proof that
the affected feature is reachable in Luma. Passing CodeQL is not a substitute
for this inventory. No alert will be globally suppressed to produce a green run.

## Authorized patch plan

Apply compatible web and tooling fixes without changing provider settings,
authentication factors, schema or Production records. Retain the reviewed
node-forge patch. Preserve paused mobile and desktop source/manifests and do
not build or release native applications.

1. Update Sentry Next.js 10.74.0 to 10.75.2, direct Zod 4.6.5 to 4.6.6,
   and shadcn 4.21.0 to 4.22.0. Shadcn's supported update removes its old Zod
   major and permits the fixed MCP SDK; do not force a Zod major into its old
   dependency contract.
2. Update the existing PostHog DOMPurify override to 3.4.17. Refresh compatible
   transitive patches for source-map-js, fast-uri, Hono, qs, body-parser and
   ip-address. Restrict the unused optional Better Auth Solid peer to its
   supported 1.9.16 security line. Resolution removes the old optional Solid
   and Seroval packages entirely; Luma does not use that framework. Do not add
   a dummy root framework dependency or force Seroval outside its owner range.
3. Resolve the vulnerable Undici 7 and 8 copies within their version lines.
   Keep the paused desktop-only Undici 6 owner unchanged. For Trigger's pinned
   engine.io-client, test a narrowly scoped ws 8.21 update with real local
   websocket traffic before retaining that override.
4. Keep Better Auth 1.6.33 with its supported Convex component. Both component
   0.12.5 and latest 0.12.6 require Better Auth below 1.7. The component imports
   an OIDC export removed in 1.7; overriding peers would break the integration.
   Add real-handler regression checks that the affected optional sign-in paths
   remain unavailable. Do not enable those features to reproduce a live attack.
5. Run proportional regression checks, the full local check and Production
   build, then inspect the checked PR's CI and browser runs. Deploy any backend
   change before its dependent frontend; these planned changes add no backend
   function or schema behavior. Review the installed versions and remaining
   alert owners after resolution. Record what is fixed and what remains.

## Compatibility and feature limits

Better Auth's critical OAuth-state/Magic-Link advisory requires both features.
Luma enables neither. The OAuth Proxy and device-authorization plugins are also
absent, and Luma uses the Convex adapter rather than the flagged PostgreSQL
Drizzle/Kysely rate-limit store. These are specific feature exclusions, not a
claim that the installed affected package version is patched. The official
Convex Better Auth 1.7 support PR remains open; wait for an official compatible
release, then review schema generation and real phone/TOTP/revocation flows.

Sentry's flagged middleware path requires a tunnel route. Luma sets no
`tunnelRoute`, optional telemetry is off, and record access is enforced in
Convex. Still take the compatible patch. Do not enable replay, tracing or
private-route analytics as part of a security package update.

The existing node-forge patch checks nested DigestAlgorithm structure and has
specific verifier regressions. The published 1.4.2 artifact still lacks that
check; do not remove the patch just because a newer version exists. The
http-cache-semantics and Deepmerge advisories have no confirmed published fix
in the inspected advisory. Their owner paths and remaining exposure must be
recorded. Electron upgrades remain outside the paused desktop scope.

## Primary references

- [Sentry tunnel advisory](https://github.com/getsentry/sentry-javascript/security/advisories/GHSA-mchm-gjx6-7h55)
- [DOMPurify advisory](https://github.com/cure53/DOMPurify/security/advisories/GHSA-cg2g-xh64-v4q7)
- [Zod advisory](https://github.com/advisories/GHSA-mrhx-c7xc-m3w5)
- [Seroval advisory](https://github.com/lxsmnsyc/seroval/security/advisories/GHSA-p6vx-979v-rg4c)
- [Better Auth critical advisory](https://github.com/better-auth/better-auth/security/advisories/GHSA-965c-763c-88jm)
- [Convex Better Auth 1.7 support](https://github.com/convex/better-auth/pull/444)
- [Node forge advisory](https://github.com/advisories/GHSA-86w9-cpqp-85rv)
- [Cache semantics advisory](https://github.com/advisories/GHSA-ch52-4w7c-c8xp)

## Scanner control repair

The documentation closeout PR exposed an intermittent failure in the scanner's
self-test, before its repository-history scan. The existing random 48-character
hex probe is not guaranteed to meet the generic rule's entropy threshold of
3.5. A bounded local reproduction observed an undetected synthetic probe after
177 samples, with entropy 3.3131. This does not mean a real key was leaked.
The scanner correctly applies its configured threshold; the control generator
was wrong to require every random sample to be detected.

Decision: config-only repair at the workflow's probe producer. Keep the scanner,
archive checksum, rules and narrow exceptions unchanged. Replace the random
control with a fixed public synthetic canary whose 62 distinct characters have
entropy 5.9542. It is deliberately outside the allowlist and has no provider
access. Keep all existing named path checks and require the actual detection exit
code. This removes the random generator rather than adding retries or weakening
failure handling. A skipped or failed scan is not accepted. The new authentication test uses the
same fixed public synthetic secret as existing isolated tests. Its first scan
reproduced that known false positive. Add only this exact file to the existing
exact-value exception, then prove the synthetic fixture passes and a new canary
in the same file is detected. No test directory is excluded.

## Verification record

Local implementation and checks are complete. Hosted acceptance and Production
release are pending for this patch.

- `pnpm check`: 344 suites and 2,863 web/backend tests passed, with zero lint
  errors. Existing app policy and verifier checks passed; native binaries were
  not built or released.
- `pnpm test:security`: two real Engine.IO/ws tests passed. The actual Trigger
  dependency resolves ws 8.21.0. Unicode text, binary payloads, Engine.IO and
  wire-level heartbeats, normal close and process cleanup are checked.
- Thirteen new actual authentication-handler checks passed. Disabled optional
  endpoints create no identity/session records and make no external request.
  The actual Convex adapter retains and enforces request limits.
- The Production webpack build passed with 3,252 generated pages and empty
  public provider settings. This proves optional configuration still builds;
  it does not enable or accept any provider.
- Actionlint and the exact workflow scanner control passed for all seven paths.
  An independent reviewer reran the new auth and websocket tests and found no
  remaining must-fix defect. Provider scanner rules and the owned node-forge
  patch are unchanged. The new auth test is added only to the existing exact
  synthetic-value exception, and its path is included in the canary control.

A local comparison of the resolved lockfile with the initial 59 hosted entries
finds 39 no longer matching an affected version range and 20 still matching.
GitHub's comma-separated range conjunctions were normalized and every range was
validated before comparison. This is a local inventory check, not a claim that
GitHub has already closed 39 alerts or that all remaining paths are exploitable.
A fresh `pnpm audit --json` still exits nonzero and reports 16 deduplicated
advisories (one critical, nine high, two moderate and four low). It is recorded
as unresolved inventory, not a passing audit or an ignored command.

| Remaining owner                              | Entries | Disposition                                                                                                                                                                |
| -------------------------------------------- | ------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Better Auth and included PostgreSQL adapters | 9       | Supported Convex pairing retained. Affected optional feature paths are absent and guarded. Wait for the official compatible component upgrade; do not suppress the alerts. |
| Paused desktop Undici 6 and Electron         | 7       | Not updated or released in this web task. Review before native work resumes.                                                                                               |
| Zod 3 in Expo CLI                            | 1       | Remains only in the paused mobile toolchain. All web Zod owners resolve the fixed v4 line.                                                                                 |
| node-forge                                   | 1       | Reviewed local verifier patch and native policy regressions retained. Registry version remains flagged.                                                                    |
| http-cache-semantics                         | 1       | Paused desktop build tooling; no advisory-confirmed published fix.                                                                                                         |
| Deepmerge                                    | 1       | Tooling paths; no advisory-confirmed published fix. Keep the alert visible.                                                                                                |

Actual selected versions include Sentry 10.75.2, Zod 4.6.6, shadcn 4.22.0,
DOMPurify 3.4.17, MCP SDK 1.32.2, Hono 4.13.14, qs 6.17.0,
body-parser 2.4.0, ip-address 10.7.5, fast-uri 3.1.9, source-map-js 1.2.2,
Undici 7.30.1/8.12.2 and ws 8.21.0. Optional Solid and Seroval no longer have
installed lock snapshots. Better Auth remains 1.6.33 and its Convex component
remains 0.12.5. No native manifest or source changed.

Zod and Hono are backend dependencies. Dry-run and deploy the verified Convex
bundle before merging the dependent frontend. The Production dry run passed schema validation and reported no deleted indexes.
No schema or index change is planned; do not delete records or bypass the normal
release checks.
