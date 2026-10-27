# Specialist material references

R050 / D28 adopts eight distinct reference categories: textiles, electronics,
batteries, tyres, used cooking oil, used lubricating oil, industrial residues and
end-of-life vehicles. These are source labels, not legal classifications or
process recipes. The source is the stakeholder workbook review and the recorded
D28 decision in `docs/product/platform-refinement-interview.md`.

The existing material catalogue and operational definition tables remain the
owners. Optional `specialistReference` metadata contains `category`,
`routeStatus: "unavailable"`, `classificationStatus: "unverified"` and
`sourceReference`. The six broad Family values stay unchanged. Existing textile
and electronics codes are reused. A separate unspecified-battery code avoids
asserting battery chemistry. The old `EWASTE-BATTERY` code remains an ambiguous,
blocked reference; it is neither reclassified nor permitted for ordinary trade.

New specialist material rows are inactive. Their operational definitions are
drafts. The shared admin/TOTP and internal operator initializers insert missing
records only, with an audit entry per insertion, indexed existence checks and a
fixed maximum. Existing activity flags, reviewed definitions and retired records
are preserved. No prices, factors, stock, identities, permits or treatment proof
are written.

Ordinary eligibility rejects all canonical specialist codes, the ewaste family,
and any row with specialist metadata, even when active or marked non-hazardous.
This check applies to offers, matching, trade acceptance/fulfilment and explicit
stock intake. Metadata removal or an active flag cannot release a canonical
specialist code. A future verified route requires a separate route owner and
explicit implementation; this contract provides no specialist execution path.
Physical declarations remain evidence only and do not create ledger stock.
