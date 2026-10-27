# Stock closing and low-stock alerts

Approved source: D18 and original-source register R024. These records use the
existing append-only stock movement owner and its inventory projection.

## Daily closing

An active workspace operator can record one immutable closing for today's India
calendar date. The request has an operation key, date and optional review note.
The server derives the workspace and actor from the session. An identical retry
returns the same closing even if stock has since changed. Reusing the key with a
different date or note fails. A second key cannot replace that date's closing.
Backdated closing is unavailable; the record is the observed balance at its
recording time, not a reconstructed midnight balance.

The closing stores each material's integer grams and recorded integer paise,
plus exact totals. Unknown cost stays unknown. It checks that the bounded ledger
history and inventory projection agree. More than 500 inventory rows or 10,000
movements requires a later paginated closing design and fails honestly. No
partial snapshot is stored. Closing does not lock stock, change a trade, certify
accounts or confirm a payment. Later stock movements remain valid.

## Explicit low-stock settings

An active operator may enable one threshold per workspace and material, in
integer grams, or disable it. Nothing is enabled by default. The configuring
person is the notification recipient; the client cannot select another identity.
An enabled threshold is a business setting, not an industry recommendation.
Setting it records the present low state without a retrospective notification.

The existing stock movement transaction checks a configured threshold after each
new movement. Crossing from at-or-above to below creates one alert. Remaining
below creates none. Recovery to at-or-above re-arms it. Identical movement retries
cannot duplicate alerts. Reconfiguration does not manufacture a crossing.
Alerts are recorded in the workspace and in the configuring person's account
inbox only while that person retains current membership and the workspace is
active. No SMS, push, email or paid provider call is made for these alerts.
Inbox reads recheck current workspace membership; removing it removes access.

## Recorded stock corrections

Only an active workspace owner or admin can correct stock. Each correction needs
a unique operation reference, material, signed nonzero integer gram change,
reason and physical evidence reference. Positive corrections explicitly record
their total acquisition cost in integer paise or mark it unknown. Negative
corrections retain the ledger's existing exact proportional cost allocation;
the caller cannot choose a refund or a negative acquisition cost. References are
reported evidence, not independent verification.

The existing market reservation owner checks that a reduction leaves enough
stock for current offers, accepted undelivered trades and held returns. The
correction appends a new movement and audit entry. It never edits a household
receipt, past movement, completed trade or payment. Identical retries return the
same correction; changed payloads with the same key fail. The Stock screen lists
the latest 20 corrections and shows the form only to owners/admins.

- `stockClosing.adjust`: `{ operationKey, materialCode, deltaGrams, costPaise,
reason, evidenceReference }`. Cost is `null` for explicitly unknown positive
  stock and for reductions; known positive cost must be a nonnegative safe
  integer. `board.canAdjust` is separate from ordinary closing permission.

## Access and API

Suspended workspace members and viewers can read closings, settings and alerts.
All writes require the current active workspace and operational permission.
Every configuration, closing, alert and re-arm change is audited. Reads are
bounded; lists identify that only recent records are shown.

- `stockClosing.board`: current scope, write permission, settings, latest closing
  and latest 20 alerts. No caller-selected workspace.
- `stockClosing.record`: `{ operationKey, day, note }`; returns closing ID.
- `stockClosing.configure`: `{ materialCode, enabled, thresholdGrams }`.
  Threshold must be a nonnegative safe integer. Disabling does not delete history.
- `observeStockThreshold`: server helper called only by the canonical movement
  owner after its audited inventory write, in the same transaction.

The Stock screen shows the last closing, its totals and per-material balances,
an optional note with the record action, an opt-in threshold form and recent
alerts. The account inbox uses a generic translated low-stock label.
