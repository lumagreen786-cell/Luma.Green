# App security, privacy and permission repair — 29 October 2026

Goal: repair the audited security and privacy gaps in the shared web app, Expo
and Electron; test, push, create a PR and merge after all active checks pass.
The owner approved this scope in chat. Signed builds, OTA/feed publication,
store submissions and paid account setup remain outside this change.

Architecture: keep Next.js/next-intl hosted workflows, Convex record/auth owners,
Expo foreground-only bridges and Electron's sandboxed HTTPS window. No schema,
record deletion, login-factor removal or provider quota changes are planned.
Baseline: AGENTS.md, handoff.md, app-releases.md, native-apps.md, the current UI
contract and repo i18n/testing/CI playbooks. Task starts on main f687bbb in the
existing task-owned worktree; unrelated local production captures stay intact.

Aegis planning is useful here because dependency compatibility, native permission
generation and public privacy disclosures must agree. Source changes are needed:
configuration alone cannot publish a discoverable policy or test blocked auth
features. Architecture review is limited to these existing owners and the new
public policy page; no new service or data owner is needed.

TDD route: auto/strict for permission and auth-boundary regressions; add a failing
case before its fix. Privacy layout uses proportional component/e2e and visual
checks. Dependency updates retain meaningful signature and transport regressions.

1. Resolve dependency findings through supported patch updates and narrow
   same-major overrides. Do not force Better Auth 1.7 through a Convex integration
   that requires <1.7. Verify unused vulnerable auth features remain unavailable;
   record any residual non-applicable findings honestly rather than suppressing
   advisories. Replace the temporary forge patch only with upstream fixed code
   and retain rejection tests.
2. Remove unused native declarations at their config owner, preserve development
   tooling only in development builds, and test the generated production
   configuration. Retain foreground location, deliberate system photo/camera
   selection and optional opt-in notifications. Preserve Electron deny-by-default
   permissions and browser consent boundaries.
3. Add a public localized privacy policy and account/data-removal instructions.
   Reuse support contacts and the existing authenticated removal path. Explain
   collected data, recipients, optional services, choices and retained evidence
   without inventing legal retention periods or claiming all-data erasure.
   Link it from public and account navigation; use all registered catalogues.
4. Record data/permission declarations and remaining signed-device/store gates.
   Update stale signing-toolchain notes and the handoff. Guide work stays deferred.
5. Run fresh audit, pnpm check/apps:check, format, build, Expo compatibility and
   JS exports, Electron smoke and relevant browser checks. Inspect light/dark,
   phone/tablet/desktop and translated/RTL captures. Local checks do not prove
   signed native acceptance or provider execution.
6. Review the final diff, commit/push only scoped files, create and attach the PR,
   address review, wait for every active check, squash merge without override.
   Verify Production if main's configured deployment runs automatically.

Execution is inline. Ordinary implementation choices use the approved scope;
missing provider/legal facts remain explicit limits, not invented permissions.
