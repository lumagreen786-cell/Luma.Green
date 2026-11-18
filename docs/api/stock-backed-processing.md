# Stock-backed processing contract

Status: proposed phase 3 contract. No schema, endpoint or inventory changes are
implemented by this document. Review this contract before runtime edits.

## Existing owners and defects

`lib/inventoryLedger.ts` owns authoritative material grams and carrying cost.
`shop.complete` already credits each weighed booking line;
`market.moveDirectCashTrade` and `cashfreeLifecycle.act` already debit dispatch
and credit receipt. `stockIntake.record` credits a manufacturer's own byproduct.
`returns` and `stockClosing.adjust` also write this ledger. Preserve their
source keys. A receipt link must not repeat its existing credit.

`traceability.declareLot` and `traceability.transform` currently change only
physical evidence. `production.declareBatch` is a recipe/evidence declaration,
not a second inventory posting owner. Keep these facts explicit.

Current market promises protect aggregate stock, but not its claimed origin.
Two offers can name the same 100 g lot when aggregate stock is 200 g:
`requireOfferLot` checks available lot grams, not open offers for that lot.
`requireUnreservedLot` checks accepted trades but omits open listings. Evidence
processing can also consume a lot without reducing its aggregate stock. These
paths must be fixed together before enabling stock-backed processing.

An old receipt plus sufficient aggregate stock does not prove remaining source
grams: the old material could have been sold and replaced. Protecting posted
output lots alone does not resolve this source-accounting gap.

The recovered `lib/petStock.ts` draft provides reference ideas for protected
output grams and reviewed runs. Its PET sorting/baling routes, state fields and
direct import of `market.promisedGrams` are not the general implementation.
Do not restore the draft over current code.

## One accounting owner

Extend the existing ledger owner with bounded source balances and debit
allocations. Do not add another stock ledger, a PET ledger or a second credit
when linking a receipt. Source balances account for remaining grams; they are
not independent proof of title, legal classification or recycled content.

Proposed additive records:

- `inventorySourceBalances`: organisation, material, positive movement ID,
  immutable source descriptor and source version/fingerprint, credited grams,
  remaining grams, and optional linked lot ID. Unique lookup by positive
  movement ID; indexes by organisation/material and linked lot.
- `inventorySourceUses`: debit movement ID, source balance ID and exact grams.
  Index by debit movement and source balance. A debit has at most 20 source
  allocations; larger work must be split into explicit bounded operations.
- `materialLots`: optional source-balance link and inventory mode
  (`evidence_only` or `stock_backed`). Missing mode remains evidence only.
- `lotTransformations`: explicit inventory mode, input debit movement IDs,
  per-output credit movement IDs and the facility review revision used.
- Listing/trade source-allocation snapshots: selected source balance/lot IDs,
  grams and frozen source versions. Reuse existing listing/trade records and
  their status as reservation owners; do not add a competing reservation table.

Only the ledger owner changes aggregate inventory and source balances. Its
negative movements must atomically consume explicit source allocations and
record source uses. Existing unlinked sales allocate eligible unbound sources
at acceptance and freeze that allocation. This allocation is accounting, not
verified physical ancestry. No public caller chooses source keys or ledger IDs.

For each organisation/material, aggregate inventory grams must equal the sum
of remaining source grams, including an explicit unattributed balance where
necessary. All sums and differences use checked integers; proportional cost
uses existing BigInt helpers. A mismatch blocks writes for review.

Existing material balances cannot be retrospectively assigned to old receipts
from an aggregate total or assumed FIFO physical history. Prepare a reviewed
material-level opening snapshot as unattributed stock, without another stock
credit. Preserve old ledger history. Legacy source-specific linkage requires
separate reconciliation evidence and cannot be inferred automatically. A fresh
empty material balance needs no opening snapshot. Source-balance rollout and
legacy reconciliation are separate acceptance work, not a production reset.

## Eligible source linkage

`traceability.linkStockSource` is the proposed authenticated mutation. Input:

```ts
{
  expectedOrgId,
  operationReference,
  source:
    | { kind: "booking_receipt", bookingId, receiptVersion, materialCode }
    | { kind: "trade_receipt", tradeId, receiptMovementId }
    | { kind: "manufacturer_intake", intakeId },
  state,
  streamClass,
  handlingClass
}
```

Return `{ lotId, sourceBalanceId, linkedGrams }`. Read the full remaining source
balance from the server; linking cannot increase it or select invented grams.
One positive source balance links to one leaf lot. Partial processing consumes
part of that lot; splitting a source into arbitrary independent evidence lots
is not needed for this first version. Identical retries return the same link.
Changing the source, material or classification under the same operation
reference is a conflict. Other organisations' IDs return a generic denial.

- Booking: require the current completed booking, current household-accepted
  receipt version, one uniquely matching material line, no rejected/disputed
  line, matching existing `booking:<bookingId>:<materialCode>` credit and a
  source balance maintained since that credit. Do not credit stock again.
  Unreviewed booking stock is held from source-backed sale/processing.
- Trade: require buyer ownership, completed measured receipt, matching existing
  `trade:<tradeId>:receipt` credit and current source balance. Direct-cash
  receipt requires the buyer's recorded delivery and no conflicting gateway
  evidence. The seller's cash acknowledgement is separate; do not require a
  gateway payment for a direct-cash source. Gateway receipt requires current
  verified receipt state without financial/refund hold. Reuse mode-specific
  checks without weakening official claim eligibility.
- Manufacturer intake: require the existing owned, weighed intake and
  `manufacturer:<intakeId>` credit. Existing reviewed ordinary byproduct rules
  still apply. A source reference alone cannot create stock.
- Processed output: its source balance is created with its output credit during
  the processing transaction; never run receipt-link credit logic again.

Source snapshots include immutable IDs, measured grams and material, current
receipt/review version and relevant custody/review references. Recheck current
ownership, source validity and holds before allocation, processing and dispatch.
Changes invalidate new operations; they never rewrite historical movements or
make already processed material reappear.

## Reservation invariant

Use one shared bounded reservation reader from ledger/market/return callers;
do not import the public `market` module into the processing owner.

Allocated source grams, open current offers, accepted or paid orders, quality
and financial holds, and approved returns must be accounted for exactly once.
An open offer's reservation transfers to its accepted trade atomically. Expiry,
withdrawal and eligible cancellation release only that reservation.

- A linked offer reserves its named source/lot grams and aggregate grams.
- An unlinked offer/order can use only unbound eligible source grams. It cannot
  use inventory already bound to another lot, even if aggregate stock is high.
- Source linkage is refused when existing unlinked offers/orders reserve those
  grams. Linking and offer creation must read/write the same indexed scope so
  concurrent operations conflict transactionally.
- Processing cannot consume any offered, accepted, returned or held source
  allocation. Per-lot protection includes open listings, not only trades.
- Dispatch consumes the frozen source allocation and aggregate debit once;
  receipt creates the buyer's new source balance once. In-transit grams are not
  available seller or buyer stock. Transfer the lot backing with the existing
  custody event; do not duplicate an already transferred lot on receipt linkage.
- Quality or financial holds on bound sources cannot be avoided by choosing an
  unlinked listing or an evidence-only transformation.

Do not subtract linked promises twice: all bound remaining source grams are
unavailable to unlinked offers; linked promises restrict availability within
their own bound sources. Bounded readers must reject incomplete reservation
accounting rather than expose the unread remainder as free stock.

## Transactional processing

Extend `traceability.transform` with `inventoryMode: "stock_backed"`; retain
the existing explicit evidence-only path for unbacked declarations. Stock-backed
inputs cannot enter the evidence-only path. Keep existing return type
`transformationId`; fetch output lot and movement links through history.

A stock-backed run requires a unique `operationReference`, selected facility,
declared process and current independent facility/material/process review.
Inputs remain the existing primary input plus additional inputs (20 maximum).
Every source must be owned, stock backed, ordinary, unreserved and quality
released. Check actual material/process capabilities; an industry name or PET
stage label is not authorization. Never mix evidence-only and backed inputs.

In one Convex transaction:

1. Authenticate, recheck selected organisation, source snapshots, facility and
   material scope, all reservations/holds and quantity bounds.
2. Require exact conservation: input grams = all measured output grams +
   contamination/reject grams + measured process-loss grams. Existing outputs
   can include separately classified recoverable/residual side streams. A
   rejected material that remains physically present must be an output lot;
   it must not be hidden as vanished process loss.
3. Create immutable transformation and input edges, decrement source/lot
   remainders, and post one ledger debit per input allocation. These are the
   only input stock reductions.
4. Create all measured child lots with their stream/handling classification,
   ledger credit and source balance. Held/controlled outputs remain physical
   stock but are unavailable to ordinary trade/processing. Contamination or
   loss with no retained physical output receives no stock credit.
5. Attach exact costs and movement links; write audit records and threshold
   observations through the existing owners. Any failure rolls back all steps.

Material catalogue entries and reviewed process scope must permit each input
and output. New state/industry coverage cannot activate a hazardous stream by
declaring it non-hazardous. Controlled treatment, disposal and regulatory
dispatch remain outside this ordinary processing contract pending acceptance.

Keep existing ledger costing: each input's authoritative consumed carrying
cost comes from its debit movement, not a second acquisition-cost addition.
Original receipt/acquisition cost remains a separate evidence reference. Total
output carrying cost is consumed inventory cost plus recorded processing cost;
use the existing largest-remainder allocation over retained outputs, including
reject lots, so the final paise is conserved. Missing costs stay unknown, not
zero. Unknown material cost is not made known merely by adding processing cost.
`production.declareBatch` can describe this transformation but posts no credits.

Stable server-generated keys:

- Keep `booking:<bookingId>:<materialCode>`, `trade:<tradeId>:dispatch`,
  `trade:<tradeId>:receipt`, `manufacturer:<intakeId>`, `return:<returnId>:dispatch`,
  `return:<returnId>:receipt` and `adjustment:<adjustmentId>`.
- New processing debits: `process:<transformationId>:input:<inputLotId>`.
- New processing credits: `process:<transformationId>:output:<outputLotId>`.

The operation fingerprint includes inventory mode, ordered source/lot IDs and
grams, source snapshots, facility/review revision, process, every ordered output
classification/gram amount, rejects, loss, costs and references. Caller retry
fields are canonicalized; a matching committed operation returns the original
ID even after consumption. A different request under the same reference fails.
No external side effect or file write occurs inside this transaction.

## Returns, changes and corrections

All live debit callers must use source accounting: market direct cash,
gateway dispatch, processing, approved returns and stock adjustments. Update
market availability, `stockClosing`, stock/report queries and existing hold
helpers to reflect bound, held, reserved and free grams. Investor/demo fixtures
remain separately labelled and cannot establish source-backed eligibility.

A full return can reserve and dispatch only its original unconsumed source
allocation. A source partially consumed by processing cannot be returned as the
original whole order using substitute aggregate stock. Do not weaken existing
gateway refund requirements. Direct-cash physical returns need an explicit
separate contract before enabling them; cash refunds and physical return
evidence are different records. Financial refunds alone never restore grams.

Do not reverse an actual transformation by restoring input grams or deleting its
children. Reviewed correction must preserve the original event, descendant
custody, claims and measured losses. A financial/cost correction does not undo
physical processing. Exceptional physical reconciliation needs its own reviewed
compensating evidence; no automatic manufacture reversal is offered here.

Negative stock adjustments must select eligible unbound sources or explicitly
reviewed affected bound sources; they cannot silently destroy a promised lot.
Positive adjustments create unattributed sources and cannot become a verified
receipt. Source invalidation or a late hold marks affected links for review
without silently reclassifying material or changing historical cash records.

## Required acceptance evidence

- Booking completion, household review and source linkage credit stock once.
  A disputed, stale, wrong-owner, duplicate-material or consumed source fails.
- Direct-cash and gateway receipts have distinct accepted-source checks. A
  cash record alone, missing receipt credit, refund hold or returned source fails.
- Two 100 g offers cannot both name one 100 g lot even with 200 g aggregate.
  Linked/unlinked offers, process runs and adjustments cannot consume the same
  source in concurrent transactions. Open listing expiry/cancellation releases
  its exact reservation.
- Partial input, two-source blending, all retained outputs, rejects, loss and
  final-paisa costs conserve totals. Duplicate retries have one effect; changed
  fingerprints fail; unsafe sums and incomplete bounded reads fail atomically.
- Process PET; paper/cardboard sorting with rejects; metal separation with
  separate ordinary fractions; and glass colour sorting using the same engine.
  Use reviewed catalogue/process fixtures, not synthetic live approvals.
  Organic wet/dry conversion requires explicit measured water inputs/outputs;
  do not force such mass to disappear under a dry-material recipe.
- Failed quality, expired/changed facility review, controlled inputs and revoked
  workspace access block posting. Held outputs cannot be sold through an
  unlinked aggregate offer. A later accepted test cannot hide an unresolved hold.
- Original full returns fail after any processing consumption. Refunds and
  correction retries never mint replacement stock. Legacy unattributed balances
  remain usable only within their declared accounting/evidence limits.
- Run existing market, custody, processing cost, production, household receipt,
  ledger, returns, financial lifecycle, stock closing and threshold regressions.

No new analytics capture is needed for private source IDs, process records,
quantities or cash values. Continue typed errors and scrubbed Sentry handling.
Inspect changed UI states in both themes and translated/RTL layouts during
integration. No production reset, fixture seed or provider send is authorized
by this contract. Parent integration review and implementation remain pending.
