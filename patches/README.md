# Dependency security patches

## Current patches — 29 October 2026

The source security/permission repair resumes only the approved foundation
scope. The active pnpm patches are:

- `deepmerge@4.3.1.patch`: reject `__proto__` in source and target copying,
  including the actual CJS and UMD distribution entry points. The public
  [upstream report](https://github.com/TehShrike/deepmerge/issues/273) describes
  the null-prototype and own-key bypass. Luma's local patch preserves ordinary
  nested/array merges and prevents the returned object inheriting attacker data.
  This is a local mitigation, not a published upstream release. Its low-severity
  advisory remains visible; neither the version nor the scanner is falsified.
- `http-cache-semantics@4.3.0.patch`: reject security-zeroed no-store, private,
  no-cache and implicit shared Set-Cookie entries before client max-stale can
  reuse them. The published 4.3.0 artifact still failed the behavioral regression
  despite being outside the reported affected version range. This local patch
  retains reuse of an ordinary explicitly public response. It affects desktop
  download tooling, not a new web cache or any private-record cache.

`pnpm test:security` resolves the actual Expo config and desktop builder consumer
copies. Both new regressions failed before the patches and pass after them.
Run frozen-lockfile installation and those tests in CI. Retire each patch only
when its owner releases a compatible fix and the same regressions pass without it.

The previous node-forge 1.4.0 patch below is retired. The selected 1.4.2 artifact
now passes the retained nested-signature rejection tests through Expo CLI, CLI
certificates and Updates certificates, plus valid signature/CSR controls. Its
old patch file is retained only as historical provenance and is not configured
in patchedDependencies. Global/dlx EAS installations still have independent
dependency trees: verify their actual verifier and signing behavior before a
signed release. Workspace results cannot clear that separate toolchain gate.

## Historical node-forge patch

## node-forge 1.4.0: nested DigestAlgorithm validation

The workspace applies `node-forge@1.4.0.patch` to every installed copy of
`node-forge` 1.4.0. This is a temporary backport of the `lib/rsa.js` change in
[upstream PR 1152](https://github.com/digitalbazaar/forge/pull/1152), pinned to
commit `ceba34402e329f0365134f23fe19898756527d65`.

The [advisory](https://github.com/advisories/GHSA-86w9-cpqp-85rv) still has no
published fixed release as checked on 2 October 2026. The upstream PR is open.
This patch is reviewed and tested locally; it is not a released upstream fix.
The package retains version 1.4.0. `pnpm audit` therefore still reports the
high-severity advisory. No advisory is suppressed and no version is falsified.

The change checks the number of ASN.1 elements in the nested DigestAlgorithm
sequence after normal structure validation. It permits the algorithm OID and
its optional NULL parameter, and rejects unconsumed elements. RSA operations,
padding, supported algorithms and valid certificate formats are unchanged.

### Provenance

- Patch SHA-256: `4fa957cddb4b4601a48b535053d0fec7ed013f9d075660a38365f285fc830fe0`.
- Patched `lib/rsa.js` SHA-256: `acc22e5d36e27832c34e02dd3933aad7977d45b047eead5016520735efedc9c5`.
- The patched file is byte-identical to the upstream commit's `lib/rsa.js`.
- The public regression vector comes from that commit's `tests/unit/rsa.js`.
  Its BSD license is retained beside the fixture at
  `apps/mobile/test/fixtures/node-forge.LICENSE.txt`. No production key is used.

### Verification

`pnpm --filter @luma/mobile check` runs the committed regression tests. They
resolve node-forge through Expo CLI, CLI certificates and Expo Updates
certificates separately. All three rejected-signature assertions failed before
the patch and pass after it, using the public verifier defaults. Controls cover
valid SHA-1, SHA-256, SHA-384 and SHA-512 signatures; SHA-256 parameters with and
without NULL; Expo certificate and CSR generation; and update signing checked
with Node's independent verifier.

The full upstream Node suite was also run against the patched 1.4.0 library:
829 passed, four existing key-generation tests skipped by their upstream
runtime conditions. The temporary test checkout expanded an upstream
`describe.only('jsbn', ...)` to `describe('jsbn', ...)` so that the entire suite
ran. No production source or assertion was changed for that run. Browser tests
of node-forge itself and signed native delivery are not claimed.

### Use and removal

Use the pinned pnpm workspace install with its lockfile and patch file. The
patch is installed in CI and used by the local Expo export/development tools.
It does not alter deployed native OS cryptography or the web/backend runtime.

A globally installed tool or `pnpm dlx eas-cli` uses a separate dependency tree
and does not inherit this patch. Treat that tool as unverified: do not use it for
release signing until its affected verifier has an upstream fix or the same
reviewed patch and regression proof. A successful local bundle export does not
prove the safety of a separately installed release CLI.

When an official fixed node-forge release is published, update the dependency
resolution, remove this patch and its `patchedDependencies` entry together, and
retain the behavioral tests. Run the audit, mobile checks and both JavaScript
exports again. Do not remove the patch solely to clear an install or audit error.
