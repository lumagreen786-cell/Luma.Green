# Expo SDK 57 release compatibility review

7 October 2026. Hosted Expo compatibility required four new SDK 57 patch
versions. The local native tests, types, compatibility check and Android/iOS
export pass with the updated lockfile. A clean hosted install then rejected
18 required packages because their publication age was below 24 hours.

The release uses exact-version cooldown exceptions for that reviewed cohort.
The default cooldown, install-script allowlist, dependency overrides and
node-forge security patch are unchanged. No CI check is removed or skipped.
Remove these exceptions after **7 October 2026, 12:15 UTC**; all cohort packages
then meet the normal age rule. This does not authorize future versions.

For all 18 versions, the official npm registry SHA-512 integrity value matches
the committed lockfile. All 36 registry signatures verify against the current
official npm signing key. All declare publisher `alanhughes` and Expo source
commit `50ac74f1ab5682c8e32b24da6e5e97dd4dbbb80f`. The official repository
identifies that commit as a package publication. The cohort was published from
6 October 2026, 12:07:16 to 12:14:47 UTC.

This verifies registry integrity and declared source identity. It does not prove
reproducible builds or absence of malicious code. npm build-provenance
attestations are unavailable and the source commit is unsigned.

References: [npm registry signature verification](https://docs.npmjs.com/about-registry-signatures/),
[registry signing keys](https://registry.npmjs.org/-/npm/v1/keys),
[Expo source commit](https://github.com/expo/expo/commit/50ac74f1ab5682c8e32b24da6e5e97dd4dbbb80f).

## Reviewed exact versions

- `@expo/cli@57.0.28`
- `@expo/config-plugins@57.0.10`
- `@expo/config@57.0.10`
- `@expo/image-utils@0.11.6`
- `@expo/metro-config@57.0.13`
- `@expo/metro-file-map@57.0.4`
- `@expo/prebuild-config@57.0.17`
- `@expo/require-utils@57.0.6`
- `@expo/router-server@57.0.12`
- `babel-preset-expo@57.0.14`
- `expo-asset@57.0.19`
- `expo-constants@57.0.21`
- `expo-eas-client@57.0.5`
- `expo-modules-autolinking@57.0.14`
- `expo-modules-core@57.0.21`
- `expo-notifications@57.0.22`
- `expo-updates@57.0.25`
- `expo@57.0.27`

## Compatibility follow-up — 14 October 2026

PR #56's hosted compatibility check now requires Expo 57.0.29,
expo-constants 57.0.22, and expo-notifications 57.0.23. These patch updates
also resolve five transitive Expo packages. All eight exact new versions have
verified official npm registry signatures and lockfile SHA-512 integrity.
The compatibility check passes. Required tests and hosted checks remain release
gates. Existing global release-age policy, security overrides and install-script
restrictions are unchanged. The package manager added only exact-version age
exceptions for this cohort; no wildcard is authorized. These exceptions can be
removed after the cohort satisfies the normal publication-age policy.

The package/version, integrity and source-commit evidence is recorded in
`expo-sdk-57-release-review-2026-10-14.json`. Registry verification does not prove
reproducible builds or absence of malicious code. This update changes dependency
versions only; it does not change the native shell workflow or guide content.

## Compatibility follow-up — 15 October 2026

The owner explicitly approved the Expo 57.0.29 → 57.0.30 patch after PR #57's
hosted compatibility check required it. The patch resolves three new transitive
versions: `@expo/cli@57.0.31`, `@expo/router-server@57.0.13` and
`babel-preset-expo@57.0.16`. All four lockfile SHA-512 integrity values match
the official npm registry, and all eight registry signatures verify. Evidence
is in `expo-sdk-57-release-review-2026-10-15.json`. This is registry verification,
not a reproducible-build or code-safety claim.

The compatibility check and all 73 native policy tests plus type checks pass.
Only exact-version age exceptions were added; the global policy is unchanged.
Native UI work and binary releases remain on hold. Required hosted checks remain
merge gates.
