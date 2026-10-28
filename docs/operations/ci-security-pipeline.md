# CI and security pipeline

Status: configuration prepared on 28 October 2026. No plan was purchased, bot
installed, repository permission changed, security product enabled or workflow
run dispatched by this task. A local check is not evidence that a hosted job,
paid product or bot review has run. The owner completes account setup later.

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
uses the default branch. A PR cannot activate its schedule before merge. New
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

No new blocking SCA command was added here. Review new advisories through
Dependabot and the dependency graph; use the paid dependency-diff check below
only after setup. A future whole-lockfile audit gate needs advisory-specific,
expiring decisions backed by patch evidence, not an unchecked global allowlist.

## 3. Paid account activation

The following jobs are deliberately skipped by default. The current repository
is private and under the personal owner `lumagreen786-cell`. A GitHub Pro purchase
alone does not unlock private CodeQL scanning or dependency review. GitHub's
current [private CodeQL guidance](https://docs.github.com/en/code-security/reference/code-scanning/troubleshoot-analysis-errors/private-repository-enablement)
requires Team or Enterprise with Code Security enabled. Its
[dependency-review documentation](https://docs.github.com/en/code-security/concepts/supply-chain-security/dependency-review)
lists eligible organization-owned private repositories. Confirm an eligible
organization/account arrangement with GitHub before buying for this purpose.
Do not transfer the repository or change visibility as an automatic workaround.

| Check             | Repository variable                   | Additional condition                                                  | Permissions / output                                                                               |
| ----------------- | ------------------------------------- | --------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| CodeQL            | `LUMA_CODEQL_ENABLED=true`            | Repository owner type is Organization; eligible Code Security enabled | Contents/actions read and security-events write in this job only; results in GitHub code scanning  |
| Dependency review | `LUMA_DEPENDENCY_REVIEW_ENABLED=true` | PR event, Organization owner and eligible dependency-review feature   | Contents read; no PR-comment write; job summary, high/critical newly introduced vulnerability gate |

Use repository **variables**, not application secrets, for these gates. A flag
only declares that setup is complete; it cannot grant a license. Keep it absent
or `false` until the operator checks actual eligibility and settings. If the
account is not eligible, the jobs stay skipped. A skip is not a security pass.
Do not make these job names required while they are conditional.

CodeQL uses JavaScript/TypeScript, no application build/install, and the extended
security query suite. Its action uploads results. A green analysis means the
analysis ran successfully; it does not mean every alert was fixed. Review open
alerts and configure an appropriate code-scanning merge rule separately only
after the account supports it. Do not enable default setup and this advanced
workflow at the same time without checking for duplicate analyses.

Dependency review checks changes between the PR base/head dependency graphs; it
is not a replacement for an initial full inventory. It fails for introduced high
or critical advisories. It does not request comment write access. Confirm that
the graph includes the pnpm workspace and lockfile. Before activation, test how
GitHub represents the patched `node-forge` package; any proposed advisory
exception needs the exact advisory, owned patch and regression record. This
workflow contains no advisory exception.

### Account checklist

1. Confirm the repository's account, visibility, branch policy and required job
   names. Select any paid plan deliberately. Do not treat a promotional plan
   quote as an approved purchase.
2. Enable the eligible dependency graph, Dependabot alerts and Code Security
   features in repository settings. Review billing, active-committer counts,
   Actions budget and notification owners. No API permission grant is made by
   this task.
3. Leave paid-job variables off. Merge the prepared workflow through the existing
   required checks. Inspect the free security jobs on that exact revision.
4. Enable one paid variable only after verifying eligibility. Run a controlled
   PR/manual check as appropriate. CodeQL needs an actual completed analysis and
   reviewed alerts; dependency review needs a PR with a known dependency diff.
   Record safe links and the exact analyzed commit.
5. Select CodeRabbit's plan later. Review its requested GitHub App permissions,
   selected repository scope, source-data processing and retention terms before
   the owner installs or authorizes it. No CI application secret is required.
6. Confirm CodeRabbit reads `.coderabbit.yaml`, completes a review on a non-draft
   PR to `main` and sees the latest revision. A local schema check proves only
   configuration shape. If automatic review paused or account quota ended,
   resolve that state before treating the review as current.
7. Review each finding. Fix it, or record a concrete supported reason for not
   changing the code. Re-run affected tests. The human owner makes the final
   merge decision after the five required checks pass.

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

### Price reference, checked 28 October 2026

Public USD prices below exclude applicable taxes and account-specific terms.
Recheck billing interval, promotion and required seats before any purchase.

| Product                         | Published starting price                                            | What to verify                                                                           |
| ------------------------------- | ------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| GitHub Team                     | $4/user/month; current page includes a first-12-month qualification | Organization ownership, actual renewal quote, private branch rules and Actions allowance |
| GitHub Code Security add-on     | $30/active committer/month                                          | Eligible base plan, active-committer billing and selected private repositories           |
| GitHub Secret Protection add-on | $19/active committer/month                                          | Separate product; not required for the MIT CLI check prepared here                       |
| CodeRabbit Essentials           | $30/developer/month, or $24/month billed annually                   | Current name replaces Pro; review scope, quota, source-data terms and seats              |
| CodeRabbit Team                 | $60/developer/month, or $48/month billed annually                   | Extra automation is optional and remains disabled in this configuration                  |

Sources: [GitHub plans](https://github.com/pricing),
[GitHub security add-ons](https://github.com/security/plans),
[CodeRabbit prices and plan-name FAQ](https://www.coderabbit.ai/pricing).
The owner can start with existing checks, the CLI scanner and Dependabot while
paid account choices remain pending. No paid purchase is required by these files.

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
part of the final local verification. Hosted checks, license activation, live
bot review, branch-rule enforcement and protected merges remain separate
acceptance evidence. This task does not claim zero vulnerabilities.

Primary technical references:
[Gitleaks CLI/configuration and license](https://github.com/gitleaks/gitleaks),
[Gitleaks pinned release](https://github.com/gitleaks/gitleaks/releases/tag/v8.30.1),
[actionlint release](https://github.com/rhysd/actionlint/releases/tag/v1.7.12),
[CodeQL action](https://github.com/github/codeql-action),
[dependency-review action](https://github.com/actions/dependency-review-action),
[CodeRabbit configuration](https://docs.coderabbit.ai/reference/configuration)
and [its schema](https://coderabbit.ai/integrations/schema.v2.json).
