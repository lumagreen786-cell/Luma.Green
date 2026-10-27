# Reference seeds and offline fixture coverage

The [machine-readable manifest](foundation-seed-coverage.json) accounts for all
84 capability groups in the [source audit](../delivery/source-coverage-2026-10-27.md).
Each group links to current local test suites or an explicit scope, provider,
device or operational gate. This is complete source accounting. It is not a claim
that all capabilities have passed Production acceptance.

## Reference definitions

The deployment operator can call the internal mutation
`catalogue:initializeReferenceDefinitions` with a short `operatorReference` that
identifies the release. Convex deployment credentials control this internal call.
The public `catalogue.initializeDefinitions` entry point still requires the
configured admin and completed TOTP. Both paths use one transactional helper.

An empty database gets 51 material labels and 32 source-labelled draft
processing definitions. This includes the 26 existing material labels, 19 new
PET-chain or side-stream labels and six new specialist labels. Eleven specialist
definitions reuse five existing codes and add six codes across eight categories. New PET materials stay inactive until explicit
review. All specialist references start inactive. Their routes remain unavailable
even if activity or classification flags change. The legacy combined
`EWASTE-BATTERY` code is blocked without inferring chemistry or classification.
See the [specialist reference contract](../api/specialist-material-references.md). Existing labels, activity flags, reviewed definitions and retired
versions are preserved. Every new record has an audit entry in the same mutation.
Operator audit entries identify their deployment source and release reference;
they do not invent an admin account.

These seeds write no rates, emission factors, stock, customer identities,
transactions, certificates, approved permits or provider approvals. They do not
seed the 28 fictional participant accounts. Service reference labels use the
separate existing internal owner `services.seedReferenceKinds`.

## Linked offline evidence

`convex/foundationSeedAcceptance.test.ts` runs inside an isolated `convex-test`
database. It uses the existing development demo gate and, for the participant
roster, the stricter local-mode and loopback-origin gate.

The linked material journey checks:

1. A household accepts a measured 1,001 gram receipt and acknowledges reported
   direct cash payment. The matching booking-keyed inventory movement exists.
2. The shop declares a physical lot with the booking reference, records a
   quality inspection, creates a listing, and accepts the buyer's complete order.
   The order retains the lot and specification. The booking-to-lot reference is
   a declaration; it does not verify physical provenance.
3. Dispatch fails before payment evidence. The test then injects a labelled
   synthetic result at the Cashfree adapter boundary. The normal dispatch and
   receipt mutations record physical inventory movements.
4. A reported scheme allocation is withdrawn when the full return is agreed.
   Exact return dispatch and receipt succeed. Financial reconciliation remains
   blocked because no refund or settlement evidence was invented.

All network calls fail inside this test. It proves no real Cashfree operation,
bank transfer, OTP delivery, provider approval or official certificate.

A second case creates all 28 registered local participant records, repeats the
seed without duplicate writes, and checks that no stock, order or trade was
created. It also confirms that a Production website origin blocks this fixture
seed. Domain records do not prove every participant's browser journey.

A third case creates each of the 21 PET reference states as unassessed physical
evidence. Each measured same-state transformation has exact mass balance and
retains its parent. An ordinary sale attempt fails. Inventory does not change.
These are generic record-contract tests, not validated factory conversion recipes.
The existing PET side-stream test separately checks one input, distinct PET and
PP outputs, loss, and prevention of repeated consumption.

The manifest also links the existing service recipient-access test and programme
snapshot/revoke test. These prove private drafts, chosen-recipient access,
aggregate-only sharing, fixed snapshots and revocation. Service execution stays
unavailable without a real provider.

## Verification and limits

`convex/foundationSeedCoverage.test.ts` checks that the manifest contains every
R001–R084 ID exactly once, all 28 registered participant keys, all 21 PET codes,
all eleven specialist labels across eight categories, and valid test-file/title links. It prevents missing rows and stale pointers.
It does not turn a suite link into proof of each sentence in a source document.

Current browser captures, actual field recipes, legal classifications,
specialist treatment, provider acceptance, native device tests, restore drills
and measured Production performance remain separate evidence. Rejected, later
or superseded source proposals remain explicit scope exclusions in the manifest.
