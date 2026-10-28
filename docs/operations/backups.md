# Backups and restore

Updated 28 October 2026. The policy comes from
[ADR 0013](../decisions/0013-backups-convex-plus-daily-local.md). The September
account limits and setup examples in that decision are historical. Check the
current account before you select a plan or rely on its retention.

## Pilot recovery targets

| Target                            | Required result                              |
| --------------------------------- | -------------------------------------------- |
| Maximum lost records (RPO)        | 24 hours                                     |
| Maximum lost uploaded files (RPO) | 7 days                                       |
| Time to recover service (RTO)     | 4 hours                                      |
| Restore practice                  | Monthly, in a separate disposable deployment |

These are targets. A policy, a paid plan or a successful export does not prove
that they are met. Record backup completion, off-site protection and a timed
restore before claiming recovery acceptance.

## What to protect

- Export all Convex tables, including component tables used by Better Auth.
- Include file storage in the weekly export. A data-only export cannot restore
  missing photo or document bytes.
- Keep daily record exports for 14 days and weekly file exports for 8 weeks.
  Keep the first weekly export of each month for 12 months. These are the
  existing retention targets; confirm them against the approved privacy policy.
- Store backups on an encrypted disk. Keep an encrypted off-site copy and its
  recovery key separately. Do not use a public bucket or shared document folder.
- Keep code in GitHub. Keep secret values in the password manager. Record service
  settings separately. A data archive is not a complete environment backup.
- Review scheduled work and external provider state separately after recovery.
  Restoring records must not repeat a payment, notification or paid API call.

## Set up and check backups

The owner must confirm the Production deployment, backup account, retention,
access and storage destination. Use the provider dashboard to check the current
backup features and permissions. Do not assume that a deployment key has a
backup-only permission. Treat it as a sensitive credential.

Prefer a managed backup schedule that can run when the Mac is off. A local
export can be a second copy. A Mac schedule is not active merely because a setup
example exists. Confirm the installed job, a recent successful archive and a
missed-run alert. An off-site copy needs its own completion evidence.

For each completed export, record its time, source deployment, whether it has
file bytes, byte size and SHA-256 checksum. Test ZIP integrity. Keep archive
contents, contact data, tokens and credentials out of Git and shared reports.
Check available disk space before an export. Delete old archives only under the
confirmed retention policy, after a usable protected copy is verified.

## Safe restore practice

1. Select a disposable target that has no shared development or Production
   records. Identify its exact URL and deployment before any import.
2. Check the archive checksum and ZIP integrity. Confirm the code/schema and
   required settings are available. Keep live provider delivery disabled.
3. Save the target state if it has anything needed. A replacement import can
   remove records. Do not use an unqualified import command that relies on a
   developer's current CLI selection.
4. Restore all required root tables, component tables and private file bytes.
5. Compare table counts, original record IDs, document content and file hashes.
   Check normal authentication and record permissions. Time the steps.
6. Stop the disposable runtime and remove its extra copies when evidence is
   saved. Keep the original backup unchanged.

See the [28 October local drill](../delivery/local-operations-drill-2026-10-28.md).
It proves the recorded local scope only. A cloud restore and the Production
recovery targets remain separate acceptance work.

## Production incident

Stop the source of damage and preserve the current state first. Do not assume
that a frontend rollback stops backend jobs or puts records in read-only mode.
Confirm the actual controls available with the incident owner.

Before a Production restore, agree the exact restore point, records and files
that will be lost, destination, service interruption, provider/job handling and
rollback plan. Keep a protected copy of the current state. Test the selected
archive in a separate deployment first. Use the verified provider restore
procedure only after that incident decision; this runbook deliberately provides
no copy-and-run Production wipe command.

After recovery, check authentication, scoped reads, files, exact quantities,
audit history and provider reconciliation. Re-enable delivery in a controlled
order. Record the outcome in [the incident log](./incidents.md).

For one wrong record, prefer an authorized correcting entry with an audit trail
instead of a full restore. Follow the account deletion and retention workflow;
do not promise that all records can be deleted at once or that a restore will
not reintroduce previously deleted personal data.

## Drill log

| Date            | Scope                                                                                          | Result                                                      |
| --------------- | ---------------------------------------------------------------------------------------------- | ----------------------------------------------------------- |
| 28 October 2026 | Separate loopback copy of synthetic local data; root and Better Auth tables plus private files | See the linked drill report for measured results and limits |
