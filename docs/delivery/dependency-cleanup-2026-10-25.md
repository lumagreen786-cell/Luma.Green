# Dependency review and branch cleanup — 25 October 2026

The owner requested that completed work and valid dependency updates reach main,
then that stray branches be removed. The baseline is main `6e9e82c`.

## Decisions

- All five completed feature branches have merged PRs (#1–#5). Each branch tree
  exactly matches its corresponding squash commit, and every squash commit is
  an ancestor of main. Their local labels and remaining remote labels can be removed.
- `convex-auth-bbcee611a7`: accept the test-only convex-test 0.0.62 update.
  Convex and Better Auth runtime versions remain unchanged.
- `testing-e43cf8afa9`: accept the compatible test tool updates, with matched
  Vitest/coverage versions and Playwright 1.64 for web and desktop test tooling.
- `next-3ff98d82af`: supersede its Next 16.4.0 target with Next and
  eslint-config-next 16.4.3. The original target and baseline are in the affected
  range of GHSA-673q-mjm6-r5xr; the maintainer patch starts at 16.4.1.
- `expo-159a26ce16`: reject React Native 0.87.1 and safe-area 5.10.1.
  Pinned Expo 57.0.30 requires React Native 0.86.3 and safe-area ~5.7.0.
- `react-314f05219c`: reject mobile React/DOM 19.3.0. Pinned Expo 57.0.30
  and React Native's renderer require React/DOM 19.2.3. This does not change
  the independent web React 19.3.0 version.

The mobile decisions use the official installed Expo dependency map and its
actual version-check function. Current versions pass; both proposals fail.
The live Expo checker also requires the compatible patches expo 57.0.31,
expo-location 57.0.22 and expo-notifications ~57.0.24. These are accepted in place
of the incompatible original proposals. React, React Native and safe-area pins
stay unchanged. SHA-512 hashes and npm registry signatures were verified for
these packages and their new CLI/config-plugins/modules-core cohort; their
21–22 October publication dates meet the existing release cooldown. No new
exception is added.

No native feature, installer, release or deployment is included.

The five dependency branches were copied into the replacement repository without
open PRs. The reviewed changes will use one new PR rather than merging obsolete
base trees. Rejected updates are not treated as merged.

## Source proposal commits

| Group       | Original commit                            | Disposition                     |
| ----------- | ------------------------------------------ | ------------------------------- |
| convex-auth | `c1cff21bc0832345291c1bd36213eae414428c42` | Integrated as reviewed update   |
| testing     | `ff92acd4a0a1382c5fe0631924af85bced01bd48` | Integrated as reviewed update   |
| next        | `3bf9c137c30310b205ca051576599d7cefcfcf6f` | Superseded by patched 16.4.3    |
| expo        | `a1ecb7520f7f65a4400c872877a6cc0e3b39da5a` | Rejected: SDK mismatch          |
| react       | `06f7ee0375a0845c4bac9fb255f8f4dc799ba429` | Rejected: SDK/renderer mismatch |

## Verification plan

Fresh install from the lockfile; full lint, types and unit/coverage checks;
native compatibility checks and Expo dependency check; production webpack build;
production browser regression checks for routing, language tabs and Help.
No new application behavior is introduced, so existing regression tests provide
the validation. Do not add tests that assert dependency strings.

## Sources

- https://nextjs.org/blog/nextjs-security-update-october-14-2026
- https://github.com/vercel/next.js/security/advisories/GHSA-673q-mjm6-r5xr
- https://github.com/vercel/next.js/releases/tag/v16.4.3
- https://registry.npmjs.org/next/latest
- Expo 57.0.30 and 57.0.31: official bundledNativeModules.json dependency maps

## Verification results

`pnpm check` passed on the final dependency set: 2,549 web/backend tests in 297
files, 73 native compatibility tests, both TypeScript checks and lint (zero
errors, 65 existing warnings). `expo install --check` reports dependencies up to
date. Formatting and whitespace checks pass.

The default production Turbopack build passed with Next 16.4.3, including all
3,119 pages. The installed shared router still resolves `PrefetchKind.AUTO`.
Next resolves Sharp 0.35.5. The 803-case production browser run passed 770 cases and found 33 stale test
expectations for the removed fabricated contact links. The test now expects zero
contact action links; its label-fit, full-name and clipping assertions remain.
All 42 cases in the affected public-effects file pass after that correction.
The separate Help tests continue to reject fabricated phone/WhatsApp links.

The concurrent coverage run passed 2,548 tests but hit the existing five-second
limit in one stock-intake interaction test. That test is unchanged from main and
passes in the non-coverage suite. The isolated coverage file then passed all three cases in 2.32 seconds with
the same time limit and code. The quiet full coverage rerun then passed all 2,549 tests in 297 files with
the same time limit. Coverage: statements 83.65%, branches 78.18%, functions
81.84%, lines 85.46%. No application code or global timeout was changed.

The two peer constraints are unchanged from main: Unicorn 76 declares ESLint
`>=10.4` while the project uses ESLint 9, and Better Auth has an optional Vitest
2–4 peer while the project already uses Vitest 5. The optional Better Auth test
helper is not used. These updates add no new peer conflicts; this is not a
claim that the dependency tree has no warnings.

Independent reviews found no additional code or lockfile blocker. Hosted checks
and merge status must be read from the PR; these local checks do not claim a
production deployment. Guide/Word updates remain deferred. Production deployment
remains with the owner.
