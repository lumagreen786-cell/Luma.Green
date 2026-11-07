# India-wide industry intake and two carbon pilots

Research checked 8 November 2026. These are public screening leads. Luma has
no confirmed partnership, quote, permit, operating dataset or credit entitlement
for these sites. McQueen has no verified project meaning. Obtain the exact name
or source before assigning it a role.

## Parallel pilot shortlist

| Facility                                                                                                                                           | Public evidence and next gate                                                                                                                                                                                                           |
| -------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [Srichakra Polyplast, Sangareddy, Telangana](https://srichakra.in/wp-content/uploads/2025/11/Srichakra-Sustainability-Report-27-10-25_spread.pdf)  | Reports bottle-to-bottle recycling at two sites. Start with one line. Check incremental activity, matched dry weights and downstream receipts, intrinsic viscosity tests and competing claims.                                          |
| [Ganesha Ecopet, Warangal, Telangana](https://ganeshaecosphere.com/admin/UploadedFiles/ContentImages/AnnualReport_Draft/AnnualReport2024-2025.pdf) | Reports PET operations at Warangal. Separate the selected line from fibre and other output. Check start date, baseline, meter records and rights.                                                                                       |
| [UFlex, Noida, Uttar Pradesh](https://www.uflexltd.com/sustainability.php)                                                                         | Reports PET and mixed-plastic recycling. Isolate PET and distinguish the existing operation from a proposed new activity. Check downstream use, quality and EPR allocation.                                                             |
| [BPCL Brahmapuram, Kochi, Kerala](https://www.pib.gov.in/PressReleasePage.aspx?PRID=2233617&lang=2&reg=48)                                         | The February 2026 inauguration announcement gives 150 tonnes/day segregated organic feed and 5.6 tonnes/day CBG design output. Check current consent, actual feed and gas logs, prior waste treatment and producer rights.              |
| [Indo Enviro, Naini, Prayagraj, Uttar Pradesh](https://everenviro.com/assets/document/Prayagraj%20ESIA%20English.pdf)                              | The project assessment describes 343 tonnes/day design feed and 21.5 tonnes/day design CBG. Track municipal organics, straw, dung and poultry litter separately. Reconcile each with actual weighbridge, baseline and off-take records. |
| [Kolhe cooperative sugar mill, Kopargaon, Maharashtra](https://www.pib.gov.in/PressReleasePage.aspx?PRID=2175126&lang=1&reg=3)                     | The October 2025 inauguration announcement describes expected 12 tonnes/day CBG. Check actual feed mix, by-product treatment, consent to operate and measured gas output.                                                               |

Start screening with Srichakra and BPCL Kochi. Ask both for one month of sample
data and the proposed activity's baseline period, start date, site permits, other
environmental claims and signed claim-rights terms. For PET, ask for inputs,
outputs, rejects, transport, electricity and fuel, quality and downstream use.
For CBG, ask for weighed feed by type, prior destination, gas flow and methane,
leaks, energy, digestate, invoices and buyer receipts. A sample month tests the
software. The approved method determines the evidence period for a claim.
Use the [carbon plan](2026-11-08-carbon-evidence-and-trading.md) for eligibility
and registry gates.

## Integration and market design

1. Register each site with legal operator, state, district, service city and
   permissions by waste stream. Inventory its ERP, accounting and plant software,
   machine make and model, meter units, calibration, export formats, operator
   contacts and permitted access. Find leads through [Udyam](https://udyamregistration.gov.in/SearchRegistration.aspx),
   [GOBARdhan](https://gobardhan.gov.in/locate-plants) and the relevant pollution
   board registers. A listing only supports discovery.
2. Start with a manually prepared intake file and an import preview. Use the same
   data model for later system connectors. Luma's [Industry API](../architecture/industry-api.md)
   already exposes scoped reads. Define separate facility-scoped intake access
   before accepting writes. Compare real export samples before building a
   connector. [TallyPrime](https://help.tallysolutions.com/getting-started-with-tally-integrations/)
   supports several interfaces, and [Business Central](https://learn.microsoft.com/en-us/dynamics365/business-central/dev-itpro/webservices/api-endpoint-structure)
   has a versioned API. These are connector candidates, not observed pilot software.
3. Connect machine data only when needed. Start with weighbridge, lab and utility
   exports. For a compatible facility, use a site-approved gateway to read
   [OPC UA](https://reference.opcfoundation.org/specs/OPC-10000-1/4) or
   [Modbus](https://www.modbus.org/modbus-specifications) values. Keep controllers
   on the plant network. Use outbound encrypted connections, separate site
   credentials, buffered retries and no machine commands. Retain raw readings,
   source IDs, timestamps, units and calibration reference. Review duplicates and
   conversions before the data updates inventory or evidence.
4. Match ordinary materials to buyers by grade, accepted contamination, delivered
   cost, transport, minimum load, intake capacity and payment terms. Route PET to
   suitable processors or manufacturers, metals to grade-compatible recyclers or
   foundries, paper to mills, and suitable organic feed to an eligible plant.
   Match CBG to contracted gas offtake. Keep controlled streams on a separate
   route and check destination authorization for the specific material and activity.
   [CPCB co-processing guidance](https://cpcb.nic.in/uploads/plasticwaste/co-processing_guidelines_final_23.05.17.pdf)
   provides background. Obtain current site consent and a buyer quote before routing.
5. Keep three separate records for corporate emissions, project reductions and
   issued or retired credits. Luma reports its own Scope 1, 2 and applicable
   Scope 3 inventory. Customer avoided emissions are reported separately.
   Selling a credit and retiring it for Luma are separate uses.
   [GHG Protocol Scope 3 Standard](https://ghgprotocol.org/sites/default/files/standards/Corporate-Value-Chain-Accounting-Reporing-Standard-EReader_041613_0.pdf)
6. Test onboarding fees and a site subscription first. Measure buyer quote,
   freight, handling, rejects, payment time and contribution per load before
   pricing a transaction service. Price monitoring and verifier preparation
   separately. Model credit income as zero in the base case. Use an upside case
   only after methodology fit, ownership, audit cost, issuance and buyer terms
   are supported. Revenue share needs a written agreement.

## Implementation sequence

1. Validate a versioned site intake file locally for both routes. Collect site,
   process line, software sources, equipment and waste stream descriptions.
2. Add a workspace import preview with validation and approval before writing
   facility records. Reuse existing industrial profiles and material catalogue.
   Create explicit source links to weigh slips and batches with exact quantity caps.
3. Add one connector for the first confirmed export format. Replay the same file,
   verify no double count, reconcile totals against source records and verify
   that another workspace cannot see the site.
4. Add permit-aware buyer matching and the route-specific evidence packs. Store
   private document contents in R2 and keep access and audit metadata in Convex.
5. Reconcile signed verification and registry records. Enable external execution
   only when channel access, authority, terms and settlement are confirmed.

## Local intake validation

Use a private JSON file and run:

```sh
node scripts/validate-industry-pilot.mjs intake.json
```

Use one file per site and process line. This synthetic example shows the shape.

```json
{
  "schemaVersion": 1,
  "route": "dry_recycling",
  "facility": {
    "operator": "Example operator",
    "site": "Example facility",
    "state": "Karnataka",
    "district": "Bengaluru Urban",
    "serviceCity": "Bengaluru"
  },
  "processLine": "Example PET line",
  "systems": [
    {
      "name": "Example stock book",
      "access": "file_export",
      "exportFormat": "CSV"
    }
  ],
  "equipment": [{ "name": "Example weighbridge", "unit": "kg" }],
  "wasteStreams": [{ "name": "Sorted PET bottles", "direction": "input" }]
}
```

Use `compressed_biogas` for the second pilot. Empty systems or equipment
lists mean discovery is incomplete. Use the intake file only for descriptions
and references. Store credentials and actual evidence files separately.

## Local screening and acceptance

Run `node scripts/screen-industry-pilot.mjs pilot.json` to preview all three
stages with one input. The [synthetic test fixture](../../scripts/screen-industry-pilot.test.mjs)
shows the full input. The preview checks a single batch against reported input,
output and loss weights, and screens reported buyer quotes by stream,
permission reference and quantity. Net quote proceeds deduct quoted freight
and handling only. They are not profit or a buyer commitment.

The preview aggregates supplied whole kg CO₂e by scope. Missing scopes stay
unknown. Scope 2 location-based and market-based figures stay separate, as do
the project estimate and base credit revenue. The preview does not calculate
emissions from activity data or establish GHG Protocol conformance. Production
accounting needs a reporting boundary, a base year, applicable Scope 3
categories, approved factors and versions, data completeness and a review of
exclusions and calculation methods. See the [Corporate Standard](https://ghgprotocol.org/corporate-standard)
and [Scope 3 Standard](https://ghgprotocol.org/corporate-value-chain-scope-3-standard).

For production acceptance, repeat the workflow with a real facility export,
check batch weights against the original records, confirm current buyer
permissions and a firm quote, and reconcile the emissions inventory with
source bills and meter readings. Test workspace separation and denied file
reads. Require independent verification and registry evidence before showing
an issued credit or accepting a trade.

## Gemini concepts to adapt

Use photo-assisted material suggestions at intake and let the operator correct
the category. Use the measured weight from pickup or the weighbridge. Rank
buyer options by delivered proceeds and practical intake limits. Route a
collection by material, service area and collection setup. Link photos, file
hashes and weighing records to the batch and limit access. Keep household
impact estimates separate from verified carbon. Use Luma's existing UI rules.
