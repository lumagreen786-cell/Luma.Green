## Round 3

Not clean. All three fresh reviewers completed their assigned reads.

- papers-3-1 Major: PROPOSE FIX. Reopening the same editor before completion
  copies dirty memory; clearing board memory later does not reconcile its buffer.
- auth-3-1 through auth-3-4 Major: PROPOSE FIX. Household SMS, shared factors,
  admin sign-in/enrolment and already-started booking continuations still have
  unguarded late callbacks. Include directly mapped account-phone local effects.
- auth-3-doc Major: PROPOSE FIX (document). Explain the existing assured legacy
  email binding exception. Two Nits: remove another stale preview claim; align
  account binding resend with the existing five-minute server minimum.
- native-3-1 and native-3-2 Major: PROPOSE FIX. Installed Android WebView sends
  origin-only URL in modern transport and top URL for every fallback sender.
  Exact-URL parsing rejects valid modern requests; bare push messages from a
  fallback iframe can reach permission handling. Add a bounded nonce/document
  envelope; do not weaken the feature parsers to accept origins blindly.

All reviewers used fresh contexts and no history or memory. The root recorded
completion from actual final reviewer reports; no runtime execution by reviewers.
