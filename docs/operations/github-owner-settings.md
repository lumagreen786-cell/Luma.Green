# GitHub owner setup

Status: checked 28 October 2026. Repository security
settings were activated through the existing browser owner session. No new key
or purchase was needed. Main branch protection is **prepared but unsaved**.

The public repository belongs to personal account `lumagreen786-cell`. The
command-line operator has push permission, but no admin or maintain permission.
The browser is separately signed in as the owner. Dependency graph, Dependabot
alerts, malware alerts and security updates are now enabled. The repository
variable `LUMA_DEPENDENCY_REVIEW_ENABLED` is `true`.

The classic `main` branch-protection form was filled with the five exact checks
and the rules below. Selecting **Create** reached GitHub's **Verify email**
requirement. The rule has not been saved, and the owner must complete that
verification. The prepared form is not evidence of effective protection.

Public branch protection and branch rulesets are available on GitHub Free. A
paid plan or a new API key will not give this operator admin permission. Use the
owner account or an account that already has repository admin permission.
[Availability and permissions](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-rulesets/about-rulesets).

## Apply the main branch rules

First complete GitHub's owner email verification, then resume the prepared
classic form under **Settings → Branches → Branch protection rules**. Recheck
its `main` target and settings, then select **Create** again. If the form was
lost, recreate it using the five checks and equivalent rules below.

The table describes the same outcome for a branch ruleset under **Settings →
Rules → Rulesets**. Use one checked configuration; do not create overlapping
classic and ruleset rules without reviewing their combined effect.

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

Public CodeQL runs automatically without a paid plan. The final PR #11
Security run passed CodeQL at merge revision `6e83f884`: 103 rules, zero results.
[Hosted Security run](https://github.com/lumagreen786-cell/Luma.Green/actions/runs/40659844421).
Dependency review also passed after graph activation. Keep conditional jobs and
paid bots out of the universal required set. The minimum remains the five CI
jobs above.

## Dependency checks: activated and verified

The browser owner session completed these steps:

- Enabled Dependency graph, Dependabot alerts, malware alerts and security
  updates under **Settings → Advanced Security**.
- Confirmed graph ingestion: the SBOM contained 1,813 packages and 4,340
  relationships at this check.
- Set repository variable `LUMA_DEPENDENCY_REVIEW_ENABLED=true` under
  **Settings → Secrets and variables → Actions → Variables**.
- Reran PR #11 Security and verified
  [Dependency review passed](https://github.com/lumagreen786-cell/Luma.Green/actions/runs/40659844421/job/122726530154).

The [initial failed attempt](https://github.com/lumagreen786-cell/Luma.Green/actions/runs/40659264386/job/122717884501)
remains setup history, not the current state. No paid security plan was needed
for this public repository. Review current alerts and future PR dependency diffs;
a successful job is not a guarantee of zero vulnerabilities. A manual dispatch
skips PR-only dependency review and cannot substitute for PR acceptance.

[GitHub security setup](https://docs.github.com/en/code-security/getting-started/quickstart-for-securing-your-repository),
[Dependabot alert setup](https://docs.github.com/en/code-security/how-tos/secure-your-supply-chain/secure-your-dependencies/configure-dependabot-alerts).

## Owner verification

After owner email verification and saving, reopen the classic protection rule
and confirm target `main`, all five checks, strict status checks and the no-bypass
setting. If using a ruleset instead, confirm **Active** and an empty bypass list.
Check the effective protection for `main`.
Confirm the merge box on a normal PR requires the PR and these checks. A source
file that says main is protected is not evidence that GitHub enforces it.

Record the rule name and verification date in the release handoff. Do not
force-push or delete `main` to test protection. Do not share an owner password,
a personal access token or a private key in the checklist. When another reviewer
joins, change required approvals to one through a separate owner decision.

Official references: [creating rulesets](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-rulesets/creating-rulesets-for-a-repository),
[protected-branch availability](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches).
