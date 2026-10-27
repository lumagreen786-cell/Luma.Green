# Household receipt and collection sharing contract

Approved scope: D06, D14 and D22. Convex owns every permission and transition.

- `households.track({token})` returns null unless the current session owns the
  collection or has an accepted, unexpired collection invitation. A token alone
  gives no private status. Helper results omit estimates, receipts and points.
- `householdReceipts.invite({token,phone,adultConfirmed})` is owner-only, requires
  a verified owner phone and adult confirmation, and creates a 48-hour invitation.
  At most 20 invitations per collection. No SMS is sent. The owner shares the
  collection link outside the platform.
- `acceptInvitation({token,adultConfirmed})` binds the matching verified phone
  to the current account. `endInvitation({invitationId})` permits owner revoke
  or bound helper leave. Completion, cancellation, decline and expiry deny use.
- `sharing({token})` returns only the owner's invitation list or the current
  matching account's invitation. `handover({token,note})` permits an active helper
  to record at most 500 characters, once, without changing money or stock.
- `review({token,receiptVersion,decision,rejectedLineIndexes,note})` is owner-only.
  The receipt's recorded time is its immutable version. Accept is final; dispute
  holds resolution. Rejected indexes retain original lines and are excluded from
  accepted grams and paise. All decisions stay in immutable history. A changed
  receipt fails the version check. Repeated identical decisions are idempotent.
- `acknowledgePayment({token,receiptVersion})` requires an accepted current receipt
  and the shop's declaration. It records household acknowledgement separately.
  The shop's method, exact amount and declared date, shop payer and household
  recipient remain attached to the original collection. No payment transfer is
  performed by this API. Receipt review never changes historical physical stock.
- Tracking exposes current decision, accepted totals and payment acknowledgement
  to the owner. A dispute cannot be cleared by a retry or payment acknowledgement.
  Resolution must preserve history; no automatic resolution is offered here.
- State changes write audit events without phone numbers or note bodies. Notes
  and invitation phone numbers are private records, never audit payloads.

All new functions declare argument and return validators. All lists are bounded
and use collection indexes. Authentication uses the real Better Auth session.
