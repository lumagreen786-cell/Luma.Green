# Local recovery and workload check — 28 October 2026

**Result: passed in a separate local test system.** No Production or shared
local records changed. No paid OTP or other provider calls were used. This is
stronger local evidence for R073 and decision D38. Cloud recovery and real pilot
performance remain open acceptance work.

## What was checked

| Check                      | Observed result                                                                                              |
| -------------------------- | ------------------------------------------------------------------------------------------------------------ |
| Normal phone sign-in       | 50 verified sessions, through the real Better Auth HTTP handlers                                             |
| Photo collection requests  | 100 saved requests, two per household, with 100 private photo uploads                                        |
| Booking rules              | Requests used the shop's published capacity, hours and six-day booking range                                 |
| Concurrent signed-in reads | 50 requests outstanding at once; two rounds, all 100 passed                                                  |
| Private record access      | Each household read its own two requests; 50 attempts to read another household's request returned no record |
| Export                     | 0.708 seconds; full archive included private file bytes                                                      |
| Empty before restore       | All exported root and component data tables were empty; table-ID mappings were retained                      |
| Restore                    | Actual Convex replacement import into the disposable local target; 7.094 seconds for the import command      |
| Restored data              | 2,584 data rows; original IDs and every serialized document matched                                          |
| Restored files             | All 104 private files matched their original SHA-256 hashes                                                  |
| Restored access            | All 50 existing signed-in sessions could still read their own two requests                                   |
| Original backup            | Source SQLite checksum unchanged; source backup was never used as runtime storage                            |

The archive contained 121 JSONL table entries. This includes two table-ID
mapping entries with 117 mapping rows; those mapping rows are excluded from the
2,584 data-row count. Better Auth component tables were included in the clear,
restore and comparison. The test did not merely copy a ZIP or simulate a restore
in memory.

## Measured workload

Creating the 100 requests, including normal private photo uploads, took
17.761 seconds with at most five creation operations in progress at a time.
The requests were created in one run and spread across valid future pickup
windows. This checks the daily request volume in D38; it does not claim that 100
physical pickups were completed.

The authenticated read phase used 50 separate verified phone sessions and 50
separate Convex clients. Each client queried its own request list. Two rounds
made 100 queries in 0.744 seconds. Median request time was 97.822 ms, the 95th
percentile was 623.382 ms and the maximum was 643.922 ms. The harness measured
50 outstanding requests. These are local HTTP timings, not browser rendering
or internet latency.

A separate public catalogue read check also passed all 100 requests, using a
worker pool capped at 50. That pool size alone is not proof of 50 simultaneous
public readers. The authenticated phase above measured its concurrency.

## Isolation and method

1. Copy the existing private synthetic SQLite database and file store into one
   private disposable directory. Do not alter the original backup.
2. Start the cached Convex backend on loopback ports 3470 and 3471. Use a private
   working directory, a dedicated self-hosted deployment selection and a strict
   check that the CLI target is exactly `http://127.0.0.1:3470`. Block cloud
   deployment selectors. Keep the root environment file unchanged.
3. Copy current backend source into that private directory and deploy it only
   to the loopback backend. Disable code generation and type checking in this
   disposable deployment step; shared source and generated files are not edited.
4. Enable the existing loopback-only auth test mode on that clone. A secured
   local inbox receives real generated phone codes. The normal send, verify and
   session-token HTTP handlers run; no session identity is injected and no public
   login bypass is added. The action proxy permits only the exact local inbox
   POST and local JWKS GET and denies other destinations.
5. Perform the normal authenticated photo uploads, booking mutations and scoped
   reads described above. No permit, payment, official credit or live price is
   invented. All names, phones, addresses and photos belong to local test data.
6. Export through the real Convex CLI with file storage. Create an empty archive
   that preserves only table-ID mappings and import it into this disposable
   deployment. Export again to prove the data tables are empty. Move the copied
   file store aside, so restoration must also recover file bytes.
7. Import the full archive, export again and compare all table entries, IDs,
   serialized documents and file hashes. Reuse the 50 existing session tokens
   for the final access check. Stop the backend, inbox and proxy after the run.
8. Keep only the safe result receipt and this report. Remove the extra private
   runtime copy to reclaim disk space. Do not delete the original backup.

The source checkpoint was `d90c94548ac4354eaea096555f93ad2d670f0219`.
The copied backend TypeScript source digest was
`6f7d9d5d59cbaf56283fa7931e1c6a6d1365cf3c6f04fe630881f35c896bd87f`.
That digest covers sorted relative paths and bytes of backend `.ts` files,
excluding `.test.ts` files. The backend was the cached
`precompiled-2026-10-10-72ce13c` local runtime; the CLI package was Convex 1.46.0.

## Evidence and limits

The safe machine-readable receipt is in the owner's release evidence folder:
`Downloads/Luma_Platform_Planning/Final_Release_Evidence/local-operations-drill.json`.
It contains counts, timings and checksums, without phone numbers, record IDs,
private URLs, session tokens or credentials. The full test archive was 303,023
bytes; its SHA-256 was
`81e70bc1a1859b88581ad73f639dfd9399ca192c4e0c5a7c15a61ffcda80d287`.
It was private test input, not a public release artifact.

This run does **not** prove cloud backup access, a managed backup schedule,
encrypted off-site recovery, Production RPO/RTO, normal-connection screen
responses, human pickup completion, provider delivery or paid-provider
acceptance. The seven-second import time is not a promise of seven-second
service recovery. Production recovery also needs incident diagnosis, target
selection, settings, code, provider reconciliation and operational checks.

No new account or key is needed to repeat this local check. To close the
remaining recovery gate, the owner must confirm the Convex backup account and
plan features, protected off-site destination, recovery-key custody and a
separate cloud restore target. Then test the real scheduled backup and restore
with the approved access. Follow the revised [backup runbook](../operations/backups.md).
