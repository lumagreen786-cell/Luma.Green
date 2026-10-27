# Assigned worker collection handover

Adopted scope: original-source group R016, D14 and the approved assigned-worker
handover default. Independent Saathi trading and worker-owned stock are outside
this version.

## Existing owners and missing link

`jobs.orgId` identifies the employer and `jobs.saathiProfileId` identifies the
worker who accepted the job. `shop.complete` owns the measured household receipt
and adds physical stock once. Existing lot custody events describe lots; they do
not link this worker assignment to that household receipt. The new handover is
that missing evidence link. It never substitutes for either owner.

## Binding and measured evidence

An active kabadiwala operator may bind an actually assigned home-pickup job to
one of its own accepted, on-the-way or completed pickup bookings. A booking has
at most one non-revoked handover. One job may contain up to 50 handovers. Open
unassigned jobs, another shop's bookings and drop-offs cannot be bound. The
employer can revoke an unacknowledged binding; evidence stays in its history.
The job and booking must have the same scheduled date and window. Rescheduling
either source must not let an old assignment authorize a different visit.
A new valid source binding atomically retires stale unacknowledged links after
ownership, assignment or schedule changes. The retirement is audited and cannot
revive if an old assignment is later restored. Acknowledged handovers cannot be
rebound or replaced.

The actually assigned active worker records a measured collected total in
positive integer grams and a weighing/evidence reference. This is a reported
measurement, not a household estimate. It does not contain rates or a payment
destination. Once recorded, the declaration is immutable. An identical operation
retry is harmless; changed quantities, references or keys are rejected.
The client uses the shared India-day clock to show the measurement control on
the job's day; the mutation independently rejects an early measurement. Query
permission flags do not depend on a clock that could remain cached overnight.

After the existing shop receipt is complete, the employer acknowledges the
handover. Received grams are derived from that receipt's physical measured
lines, not caller input or a household payment acknowledgement. The record keeps
the receipt's material/gram snapshot and hash, worker/employer actor IDs and
recording times. Variance is received minus collected grams. A nonzero variance
requires an explicit reason. Household accepted/rejected lines and payment
acknowledgement remain separate. No quantity is deducted or added again.

## Access and limits

Only current members of the employer workspace and the actual assigned worker
can read the link. It returns a short booking reference, job title and measured
evidence, never a household phone, address, photo or tracking token. A job link
does not grant access to another booking or buyer. Reads recheck current job
assignment and source ownership. Suspended worker/employer access is read-only;
removed membership or changed assignment removes the relevant access.

Writes require active scopes and unchanged source ownership. Cancelled bookings,
revoked links and changed assignments cannot receive new evidence. The employer
retains revoked evidence for review. Every binding, declaration, acknowledgement
and revocation is audited. No stock, payment, wage, trade, location or background
tracking state changes. Jobs may finish through their existing owner; this
evidence does not fabricate a worker's wage acknowledgement.

## API and controls

- `workerHandovers.employerBoard`: latest 100 own links, recent assigned pickup
  job choices and up to 50 choices for each eligible booking status.
- `workerHandovers.workerBoard`: latest 100 links for the signed-in worker,
  filtered by current assignment and scope access.
- `bind({jobId, bookingId, operationKey})`: one active source link.
- `recordCollected({handoverId, operationKey, collectedGrams,
evidenceReference})`: assigned worker's immutable measurement.
- `acknowledge({handoverId, operationKey, varianceReason})`: employer derives
  the canonical receipt total and records acknowledgement.
- `revoke({handoverId, reason})`: employer removes an unacknowledged binding's
  worker access while preserving its evidence.

The worker's job screen records collected grams. The employer's worker controls
bind the source, show collected/received totals and variance, and acknowledge or
revoke the handover. Lists state their bounds. Missing eligible sources display
an empty state rather than an invented collection or receipt.
