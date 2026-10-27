# Activate private report jobs

This code is optional and off by default. Local tests do not prove a deployed
worker, provider billing permission or Production execution.

1. Review the Trigger.dev project plan and data access before any purchase.
2. Set `TRIGGER_PROJECT_REF` for the Trigger CLI. Set `TRIGGER_CONVEX_URL` to the
   matching HTTPS Convex cloud deployment URL in the Trigger runtime. Do not set
   a Convex admin or deploy key in Trigger.
3. Deploy the task entry in `trigger/private-stock-report.ts` through the
   separately approved Trigger release process. The task has three attempts,
   a 60-second duration limit and concurrency two. It has no recurring schedule.
4. Set `TRIGGER_SECRET_KEY` in that Convex deployment only. After the task and
   backend are deployed and verified, set `TRIGGER_JOBS_ENABLED=true` in Convex.
   Vercel needs none of these settings. Development and Production are separate.
5. Use an approved private workspace fixture to request a stock report, reload
   its status, retrieve its result, remove membership and confirm access denial.
   Check timeout, replay and capacity failure. Confirm run access and retention
   with the provider before using real data.
6. Set `TRIGGER_JOBS_ENABLED=false` to block new work. Existing job capabilities
   remain limited to their job and original expiry; disable the Trigger task too
   if execution must stop. Expiry still removes Convex snapshots and results.

Treat Trigger run inputs as secrets: they contain short-lived job capabilities.
Restrict operator/run access and retention. Do not add console logs, request-body
capture, traces of private HTTP responses or public run links. Stock rows are
fetched inside the worker, not put in Trigger inputs or task outputs. No private
report is written to a public bucket. Reports are held in permission-checked
Convex rows; existing private R2 attachment ownership is unchanged.

Convex owns a request snapshot, an immediate dispatch and one expiry cleanup.
Trigger owns retries for report preparation. No Vercel job route, polling cron,
second dispatcher or paid-provider retry is installed. Dispatch uncertainty
waits for a worker or expiry; create a new operation key only for an intentional
new request. Jobs are limited to ten per owner/workspace per rolling 24 hours and
one active per workspace. A report is an inventory snapshot, not a certificate.

Current local implementation uses `@trigger.dev/sdk` 4.8.1. Its official REST,
task and config references are linked in the API contract. No remote deployment,
paid service activation or live report execution was performed for these tests.
