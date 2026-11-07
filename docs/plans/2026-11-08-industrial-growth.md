# Industrial growth strategy

## Start with packaging procurement and evidence

Sell a paid, multi-site service to packaging producers, converters and brands.
Help buyers compare eligible recycled PET supply, receive it at the agreed
grade, and reconcile each lot with its quality record, receipt and invoice.
Sell the software subscription and onboarding service before adding a fee on
settled material transactions.

India's plastic packaging rules give producers a reason to maintain recycling
and recycled-content records. Apply dated rules and exceptions for the producer
and category. An evidence pack does not establish regulatory compliance.
[Read the CPCB guidance](https://cpcb.nic.in/uploads/plasticwaste/EC_Regime_PWM.pdf).

Recykal already offers a national marketplace and EPR workflows. Luma should
test whether purchasers will pay for grade and quality reconciliation,
supplier performance, and evidence linked to each accepted load. This is a
positioning hypothesis. [Review Recykal's offering](https://www.recykal.com/about-us).

## Expansion opportunities

| Order | Opportunity                                            | Paying customer and gate                                                                                                                                                                                                                                                                                                                   |
| ----- | ------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1     | Multi-site material procurement and evidence           | Procurement and compliance teams pay for onboarding, site access, quality exceptions and audit preparation. Reuse existing lots, trades and the Industry API. Require accepted deliveries and paid renewal before expanding.                                                                                                               |
| 2     | Recurring material supply and industrial waste routing | Manufacturers pay to secure recurring grade-specific supply. Waste generators may pay for managed pickup and routing. Start with scheduled contracts and existing quote workflows. Confirm landed contribution, reject rate, settlement time and permitted destinations before adding a transaction fee. Auctions and ERP remain deferred. |
| 3     | Proof of recycled content for exporters                | Exporters pay for source evidence and buyer-ready records. Develop a versioned evidence format for supplier declarations and batch traceability. Test with an importer and independent reviewer before claiming conformity. [EU packaging regulation](https://eur-lex.europa.eu/eli/reg/2025/40/oj)                                        |
| 4     | Carbon project monitoring and verification support     | Eligible facilities pay for data collection and evidence preparation. Run PET and compressed biogas screens in parallel. Keep carbon revenue out of the base case. Registry and transaction fees depend on method fit, rights, verification and authorized channels.                                                                       |
| 5     | Financing and insurance referrals                      | After repeat trades and verified settlements, explore referrals with authorized lenders or insurers. Do not build a loan book or hold customer funds. Verify authorization, partner demand, consent and revenue terms first.                                                                                                               |

Scale by adding supplier networks and plant integrations after paid repeat use.
Use one facility and material in each new corridor until quality and logistics
are repeatable. Charge for setup when a buyer needs a custom integration.

## Scale math

The following examples are assumptions, in US dollars, with no customer or
volume commitments. Transaction volume is the value of settled material trades.
Luma earns only its fee where it acts as the agent. Track gross contribution,
cash conversion and bad debt separately.

| Scenario     | Software assumption             | Settled material volume at a 2% fee | Illustrative annual revenue |
| ------------ | ------------------------------- | ----------------------------------- | --------------------------- |
| $1 million   | 100 sites at $6,000 per year    | $20 million                         | $1 million                  |
| $10 million  | 500 sites at $8,000 per year    | $300 million                        | $10 million                 |
| $100 million | 2,000 sites at $10,000 per year | $4 billion                          | $100 million                |

At 2%, $1 billion in material volume produces $20 million in transaction fees
before costs. To reach $1 billion in fees alone requires $50 billion of settled
volume at that rate. The fee, site price and volume need market evidence.
Rubicon reported $697.6 million of 2023 revenue and a 10.4% adjusted gross profit
margin. Its filing also distinguishes principal and agent reporting.
[Rubicon results](https://www.sec.gov/Archives/edgar/data/1862068/000182912624001419/rubicontech_ex99-1.htm)
and [annual filing](https://www.sec.gov/Archives/edgar/data/1862068/000182912624003558/rubicontechnologies_10ka2.htm).

## Implementation and pilot gates

1. Extend the offline screening tool to calculate load contribution and the
   break-even buyer quote in integer paise. Include freight, handling, material
   cost, processing, rejects and transaction fees. Preserve older pilot files.
   Use an explicit zero only when a cost is known to be zero. Keep credit income
   at zero. The result excludes overhead and taxes.
2. Add a workspace flow for quote and receipt reconciliation. Use real site
   exports and role access. Record the source document for each cost. Compare
   the quote with the accepted invoice and cash received. Check disputes and
   corrections before using realized contribution as a sales metric.
3. Test one material corridor with two candidate supply sites and one paying
   buyer. Seek 10 accepted loads with complete records, positive contribution
   after known variable costs, and an agreed paid renewal. Treat these as
   targets. Record failure reasons and adjust scope or price before scaling.
4. Add multi-site purchasing and supplier reports after the pilot. Keep
   crediting, regulated routing and settlement behind separate approvals.
   Production release needs an eligible hosting account and verified backend.

The screening tool accepts an optional `loadCosts` object containing
`materialPaise`, `processingPaise`, `rejectDisposalPaise` and
`transactionFeesPaise`. Without it, the tool returns net quotes after freight
and handling. With it, each eligible quote also reports contribution and
break-even. Run `node --test scripts/{validate,screen}-industry-pilot.test.mjs`.
