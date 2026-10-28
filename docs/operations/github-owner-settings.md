# GitHub owner setup

Status: owner action checklist, checked 28 October 2026. No repository setting
was changed while preparing this document.

Read-only GitHub checks confirm a public repository owned by the personal
account `lumagreen786-cell`. The current operator has push permission, but no
admin or maintain permission. `main` reports `protected: false`; repository
rulesets and the effective rules for `main` are empty. The project requires
checked PR merges, but GitHub does not yet enforce that policy.

Public branch protection and branch rulesets are available on GitHub Free. A
paid plan or a new API key will not give this operator admin permission. Use the
owner account or an account that already has repository admin permission.
[Availability and permissions](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-rulesets/about-rulesets).

## Apply the main branch rules

Open this repository's **Settings**, then **Rules → Rulesets**. Create a branch
ruleset. The names below describe the required outcome; GitHub may adjust its
screen labels.

| Setting                                                 | Owner choice                                                                  |
| ------------------------------------------------------- | ----------------------------------------------------------------------------- |
| Ruleset name                                            | `Main checked PRs`                                                            |
| Enforcement                                             | **Active**, not Disabled                                                      |
| Target                                                  | Include branch `main` only                                                    |
| Bypass list                                             | Empty; do not add an agent, bot, administrator role or GitHub App bypass      |
| Require a pull request before merging                   | On                                                                            |
| Required approvals                                      | **0** for the solo team; the author cannot approve their own PR               |
| Require code-owner review / approval of the latest push | Off while no independent reviewer is assigned                                 |
| Require conversation resolution                         | On; address and resolve review threads before merge                           |
| Require status checks                                   | On; add the five exact names below                                            |
| Require branch to be up to date                         | On, so checks apply with the current base branch                              |
| Require linear history                                  | On                                                                            |
| Block force pushes                                      | On                                                                            |
| Restrict deletions                                      | On                                                                            |
| Restrict updates / Restrict creations                   | Leave off; do not lock out normal checked-PR merges with an empty bypass list |
| Require deployments before merge                        | Leave off; Production deploys from `main` after the checked merge             |

Add exactly these always-running required checks, each from **GitHub Actions**:

- `Lint`
- `Format`
- `Typecheck`
- `Unit tests`
- `Build`

Use the job names, including spaces and case. Select their existing GitHub
Actions source, rather than accepting the same name from any source. They must
have run recently to appear in GitHub's selector. These five jobs in `ci.yml`
have no workflow path filter and also run for documentation-only PRs.

Do not select **Restrict updates** as a substitute for the PR rule. It limits
who can update the branch and can also prevent intended merges. The PR and
required-check rules supply the checked path. Keep the ruleset's bypass list
empty. [Rule behavior](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-rulesets/available-rules-for-rulesets).

If using a classic branch-protection rule instead, target `main`, apply the same
PR/check/linear-history/conversation rules, keep force pushes and deletion
disallowed, and select **Do not allow bypassing the above settings**. Do not add
a second overlapping rule without checking the combined result.
[Classic rule setup](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches/managing-a-branch-protection-rule).

## Keep merge and deployment settings consistent

Under **Settings → General → Pull Requests**, keep squash merging available.
Use squash merges for the checked PR release path; keep merge-commit merging
disabled for linear history. Enable automatic deletion of merged source branches if it
is not already enabled. These settings are owner changes, not changes made by
this checklist.

Do not add Vercel Preview or a pre-merge Production deployment as a required
condition. The owner requires Production-only deployment from `main`. A schema
release still goes to Convex before the frontend that needs it.

## Checks that must not be universally required yet

`Playwright (chromium)` is in a path-filtered PR workflow. The app-package
workflow and native packaging jobs also have their own conditions. Requiring a
workflow that does not run for every PR can leave a documentation-only PR waiting
forever. Engineers must still inspect and pass E2E whenever its workflow applies.
[Skipped-workflow behavior](https://docs.github.com/en/pull-requests/how-tos/merge-and-close-pull-requests/troubleshooting-required-status-checks).

The new public CodeQL and dependency-review conditions in `security.yml` do not
need a paid plan or activation key. Confirm their first hosted results before
considering any additional rule. Do not add a conditional job or a paid bot
review as a blanket requirement merely because its configuration exists. The
minimum server-enforced set in this checklist is the five CI jobs above.

## Owner verification

After saving, reopen the ruleset and confirm **Active**, target `main`, the empty
bypass list and all five check names. Check the effective rules for `main`.
Confirm the merge box on a normal PR requires the PR and these checks. A source
file that says main is protected is not evidence that GitHub enforces it.

Record the ruleset name and verification date in the release handoff. Do not
force-push or delete `main` to test protection. Do not share an owner password,
a personal access token or a private key in the checklist. When another reviewer
joins, change required approvals to one through a separate owner decision.

Official references: [creating rulesets](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-rulesets/creating-rulesets-for-a-repository),
[protected-branch availability](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches).
