# India regulatory references

Status: approved bounded implementation scope, 28 October 2026.

## Contract and design

The admin facility review screen can display a local reference catalogue. It
helps the reviewer find official waste and carbon documents. It does not
determine legal eligibility or verify a facility.

Each record has a stable ID, stream, title, publisher, exact official HTTPS
source URL, document date, review date, source status, applicability, required
evidence and limits. An effective date is present only where established.
Statuses are `notified`, `guidance`, `draft` and `portal`. A missing effective
date is shown as not established, not inferred from a page update date.

The catalogue includes the current SWM 2026 and PWM 2026 references, the Common
EPR migration, separate battery/e-waste/tyre/oil/ELV/hazardous routes and BEE
methodology/issuance references. The October 2026 carbon transaction procedure
is a draft under consultation; it is not a final integration contract.

The final CERC trading regulations and the separate 23 October 2026 proceedings
record are also included. The proceedings are labelled as procedural guidance,
not market approval. The exact Gazette commencement of the final regulation is
unverified, so no effective date is inferred. The current Common EPR destination
has its own link, supported by CPCB's migration notice; operation and API status
were not independently verified because homepage retrieval timed out.

The UI keeps the reference catalogue in a collapsed disclosure above the review
form, so source reading does not push the review task down the page. The catalogue
uses open sections, a stream filter and native disclosures for supporting text.
It uses existing shared controls, semantic colours and English
admin copy. Official links open in a separate tab with `noopener noreferrer`.
The URL predicate requires HTTPS, an exact approved government host, no user
information and no alternate port. It does not allow arbitrary subdomains.

Filtering and expanding a reference change local display state only. The
reference component has no backend imports, mutation functions, approval
callbacks, stored selection or effect. It remains outside the existing review
form. No schema, API, movement, stock, payment, certificate or facility-review
gate changes. Existing review evidence cannot be replaced by this catalogue.

## Acceptance and limits

Focused tests check source status, dated provenance, stream filtering, safe
external links and the absence of action/submission behavior when selecting a
source. This is a bounded reference list reviewed on 28 October 2026, not a
complete consolidated all-state legal engine. Indexes and portals can lag.
Real permits, site/process/capacity facts, contacts, signed records, regulator
decisions, current registry evidence and legal review remain external inputs.
No public API entitlement, registry connection or Luma authorization is implied.
Browser visual review remains a separate integration check for the coordinator.
