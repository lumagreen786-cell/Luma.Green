# Zod 3 compatible constrained-collection repair

Date: 29 October 2026. This record covers the local patch and its focused tests.
The root delivery task must still register the patch, install dependencies, run
checks against the installed consumer, and obtain independent reviews.

## Scope and limit

Keep Zod at 3.25.76 for Expo CLI. The installed consumer resolves Expo 57.0.31,
Expo CLI 57.0.32, and Zod 3.25.76. Expo CLI declares `zod: ^3.25.76`.
No dependency major, package export, schema API, or package version is changed by
this patch.

The public advisory describes resource use with unconstrained input. The linked
[upstream fix a0ebf970f2d752e5f58527cd2942ff48be4f46bd](https://github.com/colinhacks/zod/commit/a0ebf970f2d752e5f58527cd2942ff48be4f46bd)
repairs traversal of oversized collections that **already have an upper bound**.
This backport has that same limit. It does not impose a bound on an unconstrained
schema, add an issue cap, or make arbitrary untrusted input safe without input
limits at the owning application boundary. It does not change advisory database
version ranges or claim that the unmodified published package is fixed.

## Implementation

`patches/zod@3.25.76.patch` changes six shipped files:

- `src/v3/types.ts`, `v3/types.js`, `v3/types.cjs`.
- `src/v4/core/schemas.ts`, `v4/core/schemas.js`, `v4/core/schemas.cjs`.

For v3, array `.max()` and an exceeded `.length()` return `INVALID` after the
existing size issue. Set `.max()` does the same; `.size()` uses this maximum
branch. This stops copying, iteration, child parsing, asynchronous child work,
and outer refinements. The too-short branch retains its existing dirty result.
The original size issue fields, messages, and error maps remain in use.

The same package also exports old v4 classic, mini, and core APIs. Their leading
size checks now run before collection parsing, using their existing core check
runner. An exceeded bound marks the existing issue as aborting and returns the
payload. The old runner honors a size check's `when` predicate. A direct copy of
the newer upstream parse wrapper would run that check again in this older core,
so the gate is placed in the existing run closure instead. No newer core API is
copied into this package. Built-in length and size checks are synchronous.

The upstream gate evaluates a bound's `when` predicate on the raw input. If it
returns true and the bound fails, the gate returns one issue before child
parsing. If it returns false, child parsing proceeds; the normal check runner
can evaluate that predicate again on the parsed value. This is the linked
upstream behavior. It does not promise one predicate call per parse or preserve
the stock package's predicate timing. A dedicated control records the sequence
`when:1`, `child`, `child`, `when:2` for a false-then-true predicate, then proves
that the next true early check stops child work. This control runs in both parse
modes for every old v4 runtime family and module format. No predicate result is
cached between those stages or across parses.

The gate covers arrays, sets, and a core map with an explicit size check. A
custom check or overwrite before an upper bound ends the gate, as in upstream:
that check can change the value before the bound is applied. Wrong container
types still use the normal type parser. Unconstrained arrays, sets, maps, and
records keep their existing traversal contracts.

## Test evidence

`scripts/security/zod-collections.test.mjs` resolves Zod through the actual
mobile → Expo → Expo CLI dependency chain by default. `LUMA_ZOD_ARTIFACT` selects
a copied package for isolated before/after tests. Tests do not call providers,
launch apps, install packages, or change records.

Both CommonJS and ESM run root/v3, `/v3`, `/v4`, `/v4-mini`, `/v4/mini`, and
`/v4/core`. The suite has 158 tests. It uses a sparse 100,000-slot array and a
10,000-entry set with traversal counters, plus child and outer-check counters.
Every upper-bound kind has separate synchronous and asynchronous tests. Tests
also cover equal-size success, transforms, preprocessing, a preceding rewrite,
mini public APIs, nested issue paths, custom bound messages, error maps, wrong
types, too-short diagnostics, min-only traversal, unconstrained traversal,
record/map success, and constrained core-map rejection.

The tests were written and run before the patch was made. The first 126-test
suite had 24 passes and 102 failures on the stock copy, then 126 passes on the
patched copy. Additional controls brought the suite to 150 tests. Independent spec review then
confirmed the upstream predicate timing and added eight documenting controls,
bringing the final suite to 158 tests.

Final commands and observed results:

```text
LUMA_ZOD_ARTIFACT=/tmp/luma-security-zod/original node --test scripts/security/zod-collections.test.mjs
158 tests; 40 pass; 118 fail; nonzero exit
Failures include max/length/set-max/size traversal and asynchronous child/outer work.

node --test scripts/security/zod-collections.test.mjs
150 tests; 40 pass; 110 fail; nonzero exit
This 150-test run was the actual installed Expo CLI consumer before patch
registration. The eight predicate timing controls were added after this run.

LUMA_ZOD_ARTIFACT=/tmp/luma-security-zod/patched node --test scripts/security/zod-collections.test.mjs
158 tests; 158 pass; 0 fail; exit 0

node_modules/.bin/tsc --strict --noEmit --skipLibCheck --target es2022 --module nodenext /tmp/luma-security-zod/patched/src/v4/core/schemas.ts /tmp/luma-security-zod/patched/src/v3/types.ts
No diagnostics; exit 0.

patch -p1 --dry-run -d /tmp/luma-security-zod/apply-check < patches/zod@3.25.76.patch
All six files apply cleanly to a fresh copy; exit 0.
```

The first strict TypeScript run found the raw issue's readonly `continue` type.
The source now uses the narrow mutable issue-field cast used by upstream. The
second source check passed. No public type declaration was widened.

Full local logs are temporary files under `/tmp/luma-security-zod/`:
`red.log`, `installed-red.log`, `green.log`, and `types.log`. The copied package
and official commit patch download also stay outside the repository.

## Handoff boundary

This slice wrote only the patch, the focused test, and this evidence note.
It did not edit package manifests, the lockfile, workspace configuration,
installed packages, auth files, or Git state. It did not install dependencies,
stage changes, commit, push, create a worktree, call paid services, or deploy.
The root task owns patch registration and installed-consumer acceptance.
The results here do not establish native device acceptance or production
provider acceptance.
