---
name: ship-pr
description: The branch-to-merge workflow — commit format, what a PR must contain, review by CodeRabbit, required checks, and the deployment path through Vercel and Convex. Use when opening a PR, responding to review, or deploying.
---

# Shipping a change

## Before you write code

Know which skill covers the work (`testing`, `i18n`, `design-system`, `seo`,
`convex-data`) and read it. The rules there are what review will check.

## Branch and commit

```bash
git switch -c feat/reserve-stock-on-accept
```

Branches: `feat/`, `fix/`, `chore/`, `docs/`, `refactor/` + a short slug.

Commits follow Conventional Commits — commitlint enforces this in a git hook:

```
feat(trade): reserve seller stock when a trade is accepted

Reserving at acceptance rather than settlement stops the same grams being
promised to two buyers while a trade is in transit.
```

Scopes: `app ui i18n convex auth inventory trade carbon seo ci deps docs test mobile infra`.

Small, focused commits. A commit that touches the schema, the UI and the CI
config is three commits.

## Before you push

```bash
pnpm check    # lint + typecheck + unit
pnpm build    # catches what only the production build catches
```

The `pre-commit` hook runs lint-staged on changed files; `pre-push` runs
typecheck. Both are fast filters — they do not replace the two commands above.

## The PR

Fill in the template honestly. A reviewer should be able to verify the change
without asking you anything.

Required:

- **Tests** for the change. No tests → say why in the description.
- **Screenshots** for any visible change: at phone width (390 px), desktop too
  for business and admin screens, plus `/ar` if layout moved.
- **No secrets** in the diff. Check twice if you touched `.env.example`.
- **Migration note** if the schema changed.

Keep PRs under ~400 lines of real change where you can. Big PRs get shallow
reviews.

## Review

**CodeRabbit** reviews every PR automatically (`.coderabbit.yaml`). Treat its
comments as a colleague's: fix what's right, reply with reasoning where it's
wrong, don't silently ignore.

No approval is required while the team is one person — the author merges once
checks are green (GitHub doesn't allow approving your own PR). That makes the
review step _yours_ to take seriously: read the diff on GitHub before merging,
and address every CodeRabbit comment — resolve it with a commit or a reply,
never by closing the thread. Required approvals go to 1 when a second developer
joins.

## Checks

These must be green (see `.claude/skills/ci-checks`):

Lint · Format · Typecheck · Unit tests · Build — plus E2E when `src/`, `e2e/`,
`messages/` or `public/` changed.

Never merge on red. Never use admin override. If a check is broken rather than
the code, fix the check in its own PR first.

## Merge

Squash-merge into `main`. The squash title becomes the changelog entry, so it
must follow Conventional Commits too.

## Deploy

- **Vercel** deploys only `main` to Production (`https://luma.green`). The owner
  prohibited Preview deployments on 25 October 2026. Test locally before merging;
  do not create or require a hosted preview. Select Production explicitly for
  manual releases (`vercel --prod` with the CLI).
- **Convex** deploys separately (`pnpm convex:deploy`, wired into the Vercel
  build command once the project is linked). A schema change deploys _before_
  the frontend that depends on it, never after.
- Preview deployments are `noindex` (see `src/app/robots.ts`). Verify that holds
  if you touch robots or the env handling.

## After merge

- Watch Sentry for new issues for a few minutes on anything user-facing.
- Check the PostHog funnel if the change touched a tracked flow.
- If you shipped a bug: revert first, fix second. A revert is not a failure; a
  broken `main` blocks everyone.
