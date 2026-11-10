# When something breaks

## How bad is it?

| Level | Looks like                                                                | Respond        |
| ----- | ------------------------------------------------------------------------- | -------------- |
| **1** | Site down, data lost or wrong, a leak of personal data or a key           | Now, any hour  |
| **2** | A core flow broken for everyone — sign-in, booking, accept, weigh and pay | Within an hour |
| **3** | Something broken for some users, or a workaround exists                   | Same day       |

## First steps

1. **Look.** Vercel → Deployments (did a deploy just happen?) and the Convex
   dashboard → Logs for the prod deployment. Sentry and PostHog are off during
   the pilot ([ADR 0012](../decisions/0012-pilot-analytics-in-convex.md)).
2. **If a deploy caused it, revert first.** In Vercel, promote the previous
   production deployment (instant), then `git revert` the change and merge.
   Don't hotfix forward under pressure. A Convex schema change can't be undone
   by a revert if data already uses the new shape — see
   [migrations](../migrations/README.md).
3. **If data is wrong or lost,** follow [backups.md](./backups.md#production-disaster):
   stop writes, snapshot, then decide.
4. **If a key leaked** (in a commit, log, screenshot or chat), **rotate first,
   investigate second**: Convex deploy keys and environment variables, Vercel
   variables, MSG91, OpenRouter. Rewriting git history does not un-leak a key.
5. **If personal data may have leaked,** page the incident owner, record when
   Luma first became aware and preserve evidence. Follow the
   [data breach runbook](./data-protection.md#if-personal-data-leaks) for
   CERT-In reporting and the separate DPDP notices to affected people and the
   Data Protection Board when those duties apply.

## Telling people

- The partner, straight away for level 1 and 2.
- Pilot kabadiwalas and households by SMS if a flow they rely on is down for
  more than an hour.

## Afterwards

Write it up in this file's log within two days:

| Date | Level | What broke | How we noticed | Fix | What would have caught it earlier |
| ---- | ----- | ---------- | -------------- | --- | --------------------------------- |
|      |       |            |                |     |                                   |

Then add that check — a test, an alert or a line in a checklist.
