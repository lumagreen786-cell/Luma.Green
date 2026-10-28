# CI and security pipeline

Status: updated 28 October 2026 after the foundation shipped in
[PR #10](https://github.com/lumagreen786-cell/Luma.Green/pull/10), main commit
`d90c945`. The foundation release passed its active hosted checks. On PR #11,
CodeQL passed on merge revision `6aa055d`: 103 rules ran with zero results and
no alerts on `refs/pull/11/merge`. Dependency review failed because the required
dependency-graph capability was not enabled. This remains an owner setup gate,
not a passing or completed scan.
[Hosted Security run](https://github.com/lumagreen786-cell/Luma.Green/actions/runs/40659264386).

Read-only GitHub checks confirm that `lumagreen786-cell/Luma.Green` is **public**
and its owner type is **User**. The signed-in operator can push but has neither
admin nor maintain permission. `main` reports `protected: false`; the ruleset and
effective branch-rule lists are empty. Checked PR merges remain project policy,
but server-side enforcement is not installed. The owner must apply the
[exact owner settings](github-owner-settings.md). No account purchase, visibility
change, permission grant or owner-setting mutation was performed by this audit.

The pipeline has three tiers. Each tier answers a different question. Keep the
five existing required CI checks; security scanning supplements them.

## 1. Required development and release checks

| Check                                                            | What it proves                                                              | Limit                                                                      |
| ---------------------------------------------------------------- | --------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| `pnpm check`                                                     | Lint, types, unit tests and app-package checks pass on this checkout        | Does not build the Production frontend or prove provider behavior          |
| `Format`, `Lint`, `Typecheck`, `Unit tests`, `Build` in `ci.yml` | The proposed revision passes the existing five CI jobs                      | Must inspect the current PR's checks; an older green run is insufficient   |
| Path-filtered E2E and app-package workflows                      | Browser flows or app exports pass when their workflow runs                  | An export is not device/store acceptance; a skipped job is not a test pass |
| Human review and checked PR merge                                | The owner evaluates findings and accepts the revision after required checks | Neither an AI review nor a green scanner replaces this decision            |

Keep required jobs without workflow path filters, unconditional ignored failures
or reduced assertions. Run `pnpm check`, format validation and the required build
before release as specified by AGENTS.md. Verify actual branch protection or
ruleset settings in GitHub after account setup; YAML cannot enable server-side
merge protection or bypass account entitlement. No auto-merge or bot merge grant
is part of this change. Production remains the only deployment environment.

## 2. Supplemental security checks available now

`.github/workflows/security.yml` runs for PRs targeting `main`, pushes to `main`,
manual dispatch, and Mondays at 04:23 UTC (09:53 India time). The scheduled run
uses the default branch. A PR cannot activate a schedule change before merge. New
runs cancel the previous run for the same workflow/ref. Every job has a timeout.

### Secret scan

`Secret scan` uses the MIT-licensed Gitleaks CLI directly, version 8.30.1. It does
not use the separate organization's licensed Gitleaks Action. The workflow pins
the official release archive's SHA-256 before execution. No vendor account or
secret is needed. GitHub-hosted runner use still consumes the repository's
Actions minutes or allowance; a free tool does not mean unlimited free CI.

Checkout fetches history and does not persist its token. The CLI scans committed
history reachable from `HEAD`, including the PR checkout. It uses the default
provider and generic-key rules, plus the narrow exceptions in `.gitleaks.toml`:

- Exact synthetic auth values in named isolated auth test files.
- Exact report, service enquiry and account-removal enquiry operation identifiers in their named tests; the removal-enquiry literal is also used by the exact scanner-probe workflow.
- The existing public investor-fixture batch label in its named scripts/reports.
- Full SHA-256 values keyed by a named source/image file in the existing user-guide manifests and three exact foundation-capture JSON paths.

These exceptions apply only to the generic rule. No whole test or document
directory is excluded by the project configuration. Provider-specific rules
remain active. Inline `gitleaks:allow` markers and `.gitleaksignore` files cannot
silence this workflow: it passes `--ignore-gitleaks-allow` and an empty ignore
path. Any change to these controls requires security review.

The job first proves that exact synthetic auth/operation values and named-file
digests pass. It then replaces each allowed fixture or capture path with a new
random key and requires detection. It runs the repository history scan with full
redaction afterwards. The random probe has no provider access and is removed when the step
ends. Scanner errors must not be treated as detections: the control requires the
specific leak exit code. A scan error or unexpected result fails the job.

No secret report is uploaded. Do not add raw JSON/SARIF secret artifacts or paste
findings into a bot comment. Logs use redaction and no verbose output. If a real
secret is detected, revoke or rotate it first, then remove its use and assess
history privately. Deleting the latest line does not remove older exposures.
Do not create a broad exception to obtain a green result.

The initial unconfigured scan reported generic matches in fixed test literals
and screenshot source digests. Those were reviewed to create the exceptions;
this is not evidence that all credentials or all historical files are safe.
Gitleaks is pattern-based. It can miss unknown formats, generated/ignored files,
binary/encrypted content, archive contents and refs outside the selected history.
It cannot replace credential handling or provider-side key restrictions.

### Workflow validation

`Workflow validation` downloads actionlint 1.7.12 from its official release,
checks its pinned SHA-256, and validates all workflows. It checks syntax,
expressions and supported action inputs. The Ubuntu runner's available shell
analysis tools may add diagnostics; local validation must record which tools
were present. This validation does not execute jobs or prove account eligibility.

New action uses in `security.yml` are pinned to full commit SHAs verified through
the publisher's GitHub metadata. Tool archives have a version and digest in the
workflow. Existing Dependabot Actions updates can propose action-pin changes.
Release archives need a deliberate version/digest review; do not replace the
fixed digest with a fresh unaudited network value at runtime.

### Dependency security without an extra paid service

The existing Dependabot file already has grouped security and routine updates,
limited open PRs and separate Actions updates. Keep it. A new unfiltered package
audit gate would duplicate version alerts and fail on the reviewed `node-forge`
backport: the registry still identifies the original version as vulnerable.
The local patch and regression evidence must be reviewed together. Do not add a
blanket audit ignore, downgrade or remove the patch just to change a scanner's
version result. Dependabot availability and its repository alerts/graph settings
still need account-side verification.

No separate whole-lockfile SCA command was added here. Review existing advisories
through Dependabot and the dependency graph. The dependency-diff job below is
free for this public repository. A future whole-lockfile audit gate needs
advisory-specific, expiring decisions backed by patch evidence, not an unchecked
global allowlist.

## 3. Public security scans and owner setup

Public repositories can use CodeQL and dependency review without purchasing
GitHub Pro, Team or a security add-on. This repository is public, so the current
workflow selects free CodeQL automatically. Dependency review also has no
license charge here, but requires the owner to enable the dependency graph and
then set `LUMA_DEPENDENCY_REVIEW_ENABLED=true`. This is a repository variable,
not an API key or application secret. No personal access token is requested.
[CodeQL availability](https://docs.github.com/en/code-security/concepts/code-scanning/codeql/codeql-code-scanning),
[dependency review availability](https://docs.github.com/en/code-security/concepts/supply-chain-security/dependency-review).

| Check               | Current public-repository condition                                   | Permissions and result                                                                                                |
| ------------------- | --------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| `CodeQL`            | Repository is public; runs on the Security workflow events            | Contents/actions read and security-events write in this job only; uploads JavaScript/TypeScript code-scanning results |
| `Dependency review` | PR event, public repository and `LUMA_DEPENDENCY_REVIEW_ENABLED=true` | Contents read; rejects introduced high/critical dependency vulnerabilities; no PR-comment write                       |

The hosted PR #11 run accepted CodeQL on merge revision `6aa055d` with 103
rules and zero results. The alert view for `refs/pull/11/merge` was also empty.
This proves that analysis ran on that revision; it does not prove that every
future revision has no vulnerabilities.

In that same run, [Dependency review failed](https://github.com/lumagreen786-cell/Luma.Green/actions/runs/40659264386/job/122717884501)
with the message that dependency review was not supported and that the dependency
graph must be enabled. The current operator cannot enable that repository
setting. The workflow now leaves this job gated until the owner completes setup.
A later skipped job means **not run**, not passed. Record a successful PR run
after activation; an empty dependency diff is not a whole-lockfile inventory.

CodeQL uses no-build JavaScript/TypeScript analysis and the extended security
query suite. Use this advanced workflow as its owner; do not also enable CodeQL
default setup without checking for duplicate or conflicting analyses. The owner
should confirm that the dependency graph is available and includes the pnpm
workspace. It supplies dependency review and Dependabot.

Before adding a dependency-review exception, check how the dependency graph
represents the patched `node-forge` package. Keep the exact advisory, patch owner
and regression evidence together. This workflow contains no advisory exception.

### Owner actions

1. Sign in with the repository owner or an account with admin permission. The
   current push-only operator cannot apply owner settings.
2. Apply [the branch/ruleset checklist](github-owner-settings.md). Its minimum
   mandatory set is the five always-running CI job names. Do not add a
   path-filtered workflow as a universally required check.
3. In repository **Settings → Advanced Security**, enable **Dependency graph**
   and **Dependabot alerts**. Older screens may call this section **Code security
   and analysis**. Confirm that **Insights → Dependency graph → Dependencies**
   contains the pnpm workspace dependencies. Do not activate a paid product or a
   duplicate CodeQL default setup merely to enable these free features.
4. After the graph is available, open **Settings → Secrets and variables →
   Actions → Variables**. Create the repository variable
   `LUMA_DEPENDENCY_REVIEW_ENABLED` with value `true`. Open or update a PR to
   trigger Security, because dependency review is PR-only; a manual dispatch cannot prove
   this job. Verify the latest merge revision and an actual dependency diff.
   Retain the earlier failure as setup history until successful acceptance is
   recorded. Review the already successful CodeQL analysis separately.
5. Select CodeRabbit only if wanted. Its GitHub App installation, selected-repo
   access, data terms and billing need the owner's review. No application CI key
   is required. Check that it reviews the latest non-draft PR and reads
   `.coderabbit.yaml`; a configuration file alone does not prove a live review.
6. Address review findings and rerun affected checks. Merge only after the
   applicable checks pass; do not use administrator bypass or bot merge grants.

### Optional future private-repository arrangement

If the owner later chooses to make the repository private, review eligibility
before that separate decision. A personal GitHub Pro purchase does not grant
private CodeQL/dependency-review licensing. Eligible organization ownership and
GitHub Code Security may be needed. Do not change visibility, transfer ownership
or buy a plan automatically to make a job run.

The workflow keeps an explicit private-organization path:

| Check             | Private repository variable           | Additional condition                                              |
| ----------------- | ------------------------------------- | ----------------------------------------------------------------- |
| CodeQL            | `LUMA_CODEQL_ENABLED=true`            | Organization owner and eligible Code Security/account setup       |
| Dependency review | `LUMA_DEPENDENCY_REVIEW_ENABLED=true` | PR event, Organization owner and eligible dependency-review setup |

These are repository variables, not application secrets. They declare completed
setup and cannot grant a license. The dependency-review variable is also needed
for the current public repository after its graph is enabled. Leave the private
CodeQL variable absent/false unless the owner verifies that future arrangement. Do not make a conditional job a
universal required check.

### CodeRabbit review scope

The configuration keeps the assertive profile and automatic non-draft reviews
for `main`. It adds specific guidance for authorization, real authentication,
exact paise/grams, audit and idempotency, paid quotas, private data and telemetry.
It respects the English-only admin exception and the approved foundation scope.

Repository learnings, issues and PR context are limited to this repository.
Jira, Linear, MCP and external web-search context are disabled. This reduces
unrequested external context; it does not mean no code is processed by CodeRabbit.
The owner must review that provider's actual data terms. Code-generation, direct
fix, CI-fix and merge-conflict finishing tools are disabled. These settings do
not grant or change the installed app's GitHub permissions. Do not enable
automatic approvals, auto-merge or a new bot write workflow as part of setup.

### Paid plans are optional for the current public repository

No GitHub purchase is required merely for public branch rules, CodeQL or
dependency review. The separate [paid-service list](platform-paid-services-2026-10-27.md)
records optional Team/security plans for a future private organization, and
CodeRabbit options. Check current seats, billing interval and checkout before
buying. No plan was purchased by this work.

## Verification and limits for this change

Local verification used downloaded official Gitleaks 8.30.1 and actionlint
1.7.12 archives, checked against GitHub's published asset SHA-256 values before
execution. The configured `HEAD` history scan passed. Local synthetic controls
proved the exact auth fixture and named source digest are allowed, while a new
generic key or GitHub-shaped token in the same fixture path, and a new key in the
same manifest path, fail. The scan output was redacted; no live provider was
called.

Actionlint passed all repository workflows. `.coderabbit.yaml` validated against
the provider's current JSON Schema (2020-12). Format and whitespace checks are
part of the final local verification. The shipped foundation has its own hosted
release receipt. CodeQL now has hosted acceptance on PR #11 at `6aa055d`.
Dependency review failed on the account capability gate and remains unaccepted
until owner setup and a successful PR run. Live bot review and owner branch-rule
enforcement remain separate setup evidence. This task does not claim zero vulnerabilities.

Primary technical references:
[Gitleaks CLI/configuration and license](https://github.com/gitleaks/gitleaks),
[Gitleaks pinned release](https://github.com/gitleaks/gitleaks/releases/tag/v8.30.1),
[actionlint release](https://github.com/rhysd/actionlint/releases/tag/v1.7.12),
[CodeQL action](https://github.com/github/codeql-action),
[dependency-review action](https://github.com/actions/dependency-review-action),
[CodeRabbit configuration](https://docs.coderabbit.ai/reference/configuration)
and [its schema](https://coderabbit.ai/integrations/schema.v2.json).

Dependency setup references: [repository security setup](https://docs.github.com/en/code-security/getting-started/quickstart-for-securing-your-repository) and [Dependabot alerts](https://docs.github.com/en/code-security/how-tos/secure-your-supply-chain/secure-your-dependencies/configure-dependabot-alerts).
