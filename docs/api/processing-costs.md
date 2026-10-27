# Recorded processing costs

Approved basis: D18, recorded acquisition and processing costs. Money is safe
integer paise. Mass is safe integer grams. Lot and transformation cost records
are held-lot evidence; they do not create inventory, verify title, change a price
or authorize handling. The explicit manufacturer stock intake below appends its
own authoritative inventory movement.

## Record and read

- `traceability.declareLot` accepts optional `acquisitionCostPaise` and
  `costReference`. A known nonnegative cost, including explicit zero, needs a
  nonblank evidence reference. Omitted or null cost means unknown.
- `traceability.recordAcquisitionCost` records the first known cost of an owned,
  available, wholly unconsumed self-declared lot or a newly received lot. It cannot
  restate a known cost, a partly consumed acquisition basis, or the original
  producer's allocated transformation cost. An identical retry returns the
  existing record without another audit. A different retry fails.
- `traceability.transform` accepts optional `processingCostPaise`, `costReference`
  and `operationReference`. The reference describes the recorded process cost;
  missing cost stays unknown. A scoped operation reference identifies retries.
  Identical retries return the original transformation; changed payloads fail.
- `traceability.mine/history` expose initial and remaining recorded lot cost.
  Transformation history and `production.mine` expose consumed input cost,
  recorded processing cost and total allocated output cost. Missing historical
  cost fields read as null. Production declarations read the owning transformation
  cost; they do not add the same processing cost again.

## Explicit manufacturer stock intake

`stockIntake.record` accepts optional `recordedCostPaise` and `costReference`.
This is the total recorded cost already allocated to this exact weighed intake.
It is not a unit rate, current offer value, or the full cost of its parent process.
Do not add the transformation cost again. The operator records the allocation
and evidence explicitly; the server never infers it from an evidence-only lot.
A known nonnegative safe integer, including zero, requires a cost reference.
Omitted or null values mean unknown. The existing stock intake authorization,
material approval and own-production attestation remain required.

The intake row, authoritative inventory movement, balance and audit commit
atomically. `addedCostPaise` receives this recorded intake amount. Existing null
or missing amounts normalize to unknown for retry comparison; changed amounts or
cost references conflict. A later partial stock removal uses the existing exact
proportional allocation. Unknown existing stock cost remains unknown when mixed
with a known intake. Inventory cost overflow rejects the whole intake.

## Exact allocation

For a partial input consumption, consumed cost is the integer floor of
`remaining cost × consumed grams / remaining grams`, calculated with BigInt.
The existing inventory cost allocation helper supplies this rule. The input
remainder retains all remaining paise; consuming the final grams takes its full
remaining recorded cost. Unknown input cost stays unknown.

A process total is known only when every consumed input cost and the processing
cost are known. All measured output lots, including measured residual outputs,
share the total by their output grams. Round each share down, then assign the
remaining paise in descending fractional-remainder order; output order breaks
exact ties. This preserves the exact recorded total deterministically.

**Loss policy:** contamination and process-loss grams do not receive a separate
asset cost. Surviving measured outputs absorb all consumed input and processing
cost. A separately measured residual output shares that cost once, like any
other output. No output can be zero grams. This is a recorded-cost allocation
policy, not a market value, tax valuation or verified environmental claim.

All arithmetic rejects negative, fractional, nonfinite or unsafe costs. Reject
aggregate cost overflow before any write. A process with one unknown component
has unknown output cost, even if other components are known. Explicit zero never
substitutes for a missing cost.

## Access and transaction rules

Existing active workspace operation permission is required for every write;
viewers have read access only. Cross-workspace identifiers fail. Only current
holders see a lot's remaining cost; incoming custody access must not expose the
sender's acquisition or processing cost. A recipient must record its own first
acquisition cost after receipt when eligible. Private parent/sibling process
costs remain with the process owner.

Input cost snapshots, input remainder changes, output cost allocation and audit
writes commit in the same Convex mutation as the measured transformation. The
operation reference index is scoped by organisation. Concurrent attempts cannot
consume the same input cost or grams twice. No provider calls are part of this
contract. Optional fields require no backfill; existing records remain unknown.

## Interface and checks

Lot declaration and processing forms have optional exact paise fields and a
cost evidence reference. Empty fields mean unknown. Labels and helper text use
the existing translations. Held-lot and production views show recorded totals
with the shared exact money formatter and an explicit unknown state.

Checks cover partial/final consumption, multiple inputs, deterministic rounding,
loss absorption, unknown and explicit-zero values, overflow rollback, write
permissions, audit and retry behavior, and concurrent consumption. Browser checks
exercise cost entry and history through the actual form contract. Synthetic
browser fixtures prove UI behavior only.

Controlled disposition consumes the proportional recorded cost with its grams,
retains the input remainder cost, and audits the consumed share. Custody receipt
starts a new unknown acquisition-cost basis for the recipient. The sender retains
its recorded cost in its own audited dispatch, not in the recipient's cost view.
