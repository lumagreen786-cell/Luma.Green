# Private stock report job contract

The authenticated `reportJobs.request` action takes `{operationKey}` (8–80 ASCII
letters, numbers, `_` or `-`) and returns a `reportJobs` ID. It uses the selected
active workspace and its current read permission. The caller cannot supply an
owner, workspace, source data or callback URL. A repeated key for this owner and
workspace returns the same job, including after failure or expiry. A new key is
an explicit new request. At most one pending job per workspace is allowed.

`reportJobs.get({jobId})` returns `{id,status,progress,createdAt,expiresAt,
result,errorCode}` to a current member of that job's active workspace. It never
returns the capability or source snapshot. `result` is a private CSV string only
when complete and before expiry. States: queued (0), running (50), complete
(100), failed (0), expired (0). Error codes are stable machine codes, not provider
messages. The UI translates them. Results are stock records, not proof of legal
compliance, verified mass, payment or issued carbon credits.

Convex stores a single transaction snapshot of at most 500 inventory rows, each
with a material code and exact integer grams. Oversized or invalid source data
fails before enqueue. CSV is at most 128 KiB. The immutable owner, workspace and
snapshot belong to Convex. A 30-minute capability expiry also removes the snapshot
and result. Retained metadata supports audit and operation-key deduplication.

One Convex scheduled action sends a fixed task to the fixed HTTPS Trigger.dev
API endpoint. Trigger owns task retries (three attempts, 60-second execution
limit, concurrency two); Convex does not retry dispatch. An ambiguous dispatch
failure remains queued until expiry so a possibly accepted run can finish.
Definite rejection fails the job. Missing configuration returns JOBS_UNAVAILABLE
before creation. A durable expiry function is not a second job executor.

Trigger receives only the job ID and a random job-scoped bearer capability, then
calls `reportJobs.start` and `reportJobs.complete` over the configured Convex URL.
Only the capability hash is stored in the record. Both calls check expiry,
immutable context and the original owner's current membership. A task replay can
read the same snapshot and send the identical completion without another audit
transition. Completion must match the canonical CSV from that stored snapshot;
a changed result or wrong capability is rejected. Removing the requesting member
blocks worker access. Removing a reader blocks that reader’s result access. No deployment/admin key is given to Trigger.
Worker calls are capability-authenticated exceptions to interactive user auth.

Task output is only `{completed:true}`. Do not log private rows, results,
capabilities or provider responses. Treat Trigger run inputs as secrets and
restrict operator access and retention before activation. No OTP, GST lookup,
payment or other paid domain action is called by this task.

Reviewed official references (27 October 2026):

- https://trigger.dev/docs/management/tasks/trigger
- https://trigger.dev/docs/tasks/overview
- https://trigger.dev/docs/config/config-file

The server permits at most ten new jobs per owner/workspace in a rolling 24-hour
window, and one queued or running job per workspace. Duplicate keys do not spend
that quota. Material codes must match `[A-Z0-9][A-Z0-9_-]{0,79}`; rejected free
text cannot become spreadsheet formulas. Grams must be non-negative safe integers.
