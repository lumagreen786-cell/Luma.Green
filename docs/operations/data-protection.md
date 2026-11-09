# Data protection

Reviewed on 9 November 2026. This runbook covers Luma's web service and the
hosted screens in the native shells. Use it to test the controls and record
open work. Confirm the applicable duties for Luma's legal entity and actual
processing before you sign off on readiness.

## Which rules apply, and when

| When                                                                                | What starts                                                                                                                                              |
| ----------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| November 2025                                                                       | Board and administrative provisions of the Act. Rules 1, 2 and 17 to 21.                                                                                 |
| One year after Gazette publication, 13 November 2026 using the printed Gazette date | Act sections 6(9) and 27(1)(d), and Rule 4, for Consent Manager registration and oversight.                                                              |
| Eighteen months after Gazette publication, 13 May 2027                              | Main duties for Luma, including notice, consent, security, breach reporting, retention, children's data and privacy rights. Rules 3, 5 to 16, 22 and 23. |

Sources for these phases are the [DPDP Act 2023][act], [commencement
notification G.S.R. 843(E)][commencement], and [final DPDP Rules
G.S.R. 846(E)][rules] with the [December 2025 corrigenda][correction]. MeitY's
[May 2026 workshop report][date] identifies 13 May 2027 as the date of full
enforcement. The [October 2026 order][order] clarifies section 9(1) on guardian
consent and section 10 on data audits.

Follow the [IT Act][it] and [2011 SPDI Rules][spdi] where applicable while the
section 43A omission awaits commencement under section 44(2) of the DPDP Act.
The [CERT-In directions][cert] have separate incident and log requirements.

## Notice and consent

- List each use of personal data, including data about a person that first
  arrives on paper and is then digitised. For each use, record the fields,
  source, service purpose, lawful basis, who can access the data, processors,
  transfers and retention. Use the [current data inventory][inventory] as a
  starting point. Confirm each entry against actual production settings.
- If the basis is consent, provide a standalone notice before or with the
  request. List the data items and the specific purpose and service they enable.
  Give a direct link to withdraw consent, exercise rights and find out how to
  complain to the Board. Require a clear affirmative choice for the stated
  purpose and keep evidence of the notice version and the choice. Assess each
  use under sections 4 and 7. For section 7(a), the person must voluntarily
  provide the data for that stated purpose without indicating refusal.
- Make withdrawal as easy as giving consent. Stop the applicable use within
  a reasonable time and require processors to stop too, subject to the legal
  exceptions. Review retention separately. Keep optional analytics separate
  from sign-in, booking and terms acceptance.
- Provide the notice and consent request in English and all 22 [Eighth Schedule
  languages][languages]. Luma's locale registry covers 13 of these. Arrange
  reviewed notice and consent versions in Bodo, Dogri, Kashmiri, Konkani,
  Maithili, Manipuri, Sanskrit, Santali and Sindhi, and verify the versions in
  languages Luma already offers. These materials can have their own language
  selector.
- For consent given before commencement, give the notice under section 5(2)
  as soon as reasonably practicable. Prepare a list of affected users and
  consent purposes, and record which notices Luma sends through a suitable
  registered channel.

The public privacy page, sign-in and household collection notices, and public
analytics preferences cover specific parts of this work. Review business and
Saathi applications, identity checks, file uploads, payments, support, device
push, paper capture and optional external processing separately.

## Privacy requests and grievances

Users can start from `/privacy#requests`. The signed-in flow at
`/account/privacy` records a request and shows its status. Use the protected
`/admin/support` queue to review these cases. The owner approved
`support@luma.green` for a person who cannot sign in, a guardian or a nominee.
Confirm the legal entity, assign a monitored privacy contact and backup
operator, and verify that the inbox works. Publish the business contact on the
site and in each reply about a privacy right (Rule 9).

1. Record the receipt time, category, handler and due date. Verify the person
   using an existing account or registered contact, and verify any representative's
   authority before disclosure. Ask only for the minimum proof needed. Keep
   identity documents, credentials and request details out of general email,
   tickets, logs and audit payloads.
2. For access, give a summary of the person's data and processing activities.
   Identify other fiduciaries and processors that received the data and describe
   what Luma shared, subject to section 11(2). Verify identity and scope before
   sending the summary through a protected channel.
3. For correction, correct inaccurate or misleading data, complete incomplete
   data or update outdated data. Check the sources, records and recipients that
   need the change. Preserve required audit evidence.
4. For erasure or withdrawal, apply the retention steps below. Confirm which
   processing stops and which data can be erased. Record each hold, its basis
   and review date, and tell the requester the outcome. Account closure at
   `/account/removal` is a separate action with a recent sign-in check.
5. For nomination, verify the person making the request. Record the nomination
   and any update or revocation in restricted records. Before a nominee can
   exercise a right, verify their identity, the nomination and the person's
   death or incapacity. Approve the evidence and handling procedure before
   fulfilling these cases.
6. For a grievance, investigate and reply within the published period. Rule 14
   limits it to 90 days from receipt. Where the [2011 SPDI Rules][spdi] apply,
   Rule 5(9) requires a named Grievance Officer with published contact details
   and resolution within one month of receipt. Confirm and staff Luma's
   response period. Publish how people submit requests, what identifier they
   need and how they can approach the Board after using Luma's grievance
   process. Verify the Board's official channel when it is available.

A receipt or status change records case handling. Record the action taken,
secure delivery of the result and any follow-up before you close the case.

## Retention, safeguards and transfers

- Sections 8 and 12 govern erasure when the purpose ends, consent is withdrawn
  or a person requests erasure. Apply the permitted retention exceptions per
  record and require processors to erase eligible copies. Rules 6 and 8(3)
  require one-year retention for specified security and regulatory purposes.
  Rule 8(3) covers relevant personal data, traffic data and processing logs
  from processing, including processing by providers. Check other retention
  laws or notifications. The Third Schedule inactivity periods and 48-hour
  warning apply to the listed categories and thresholds.
- Approve a retention schedule by data class. Include account and session
  records, addresses and pins, private files, PAN/GST checks, work and payment
  evidence, audit records, analytics, support records, processors and backups.
  Record the event that starts retention, the law or purpose, access during
  holds, expiry and verified cleanup. Check current expiry jobs and their
  exemptions against the schedule. Test that a restore reapplies erasure and
  access restrictions before it returns to service. See [backups and restore](./backups.md).
- Keep private files behind record access checks. For new file contents use
  private R2 with separate credentials for each environment. Existing Convex
  files and paper chunks need an inventory, verified migration and recovery
  checks. Restrict staff access and verify privileged authentication, masking,
  encryption, access logging, log review, alerting, and a backup restore.
  Record actual provider settings and test results.
- Record the parties' roles and have a valid contract before a processor
  handles the data. Check security, access, subprocessors, breach reporting,
  data location, return and erasure terms. Verify which locations providers
  use for records, files, logs and backups. Check section 16 notifications,
  Rule 15 orders and stricter applicable sector rules. If Luma is notified as a
  Significant Data Fiduciary, apply section 10 and Rule 13, including a DPO in
  India, an independent data auditor, annual assessment and data audit, and
  any notified transfer restrictions.
- For ICT logs, confirm compliance with the rolling 180-day CERT-In
  requirement. Direction (iv) specifies Indian jurisdiction. [CERT-In FAQ
  Q35–36][cert-faq] addresses overseas log storage when logs can be produced
  within a reasonable time and addresses financial transaction records
  separately. Verify the applicable storage and retrieval controls.

## Children and guardians

The owner restricts public signup and household booking to people aged 18 or
older. The public forms request an adult declaration. The phone verification
service checks it before it creates a public account. The household service
checks it before it saves a booking or stores an uploaded photo. The booking
audit entry records the declaration and its time. A declaration records the
person's statement. The direct SMS request endpoint can still receive a phone
number before account creation. Verify how the service handles that entry
point, assisted and offline entry, and hosted shell flows. Keep visitor
analytics off until the child-data control for that use is approved and tested.
Use the minimum data needed for any additional age check.

If Luma serves children, obtain verifiable parental consent before processing
their data, using the Rule 10 identity and age checks. Section 9 also limits
processing detrimental to children, tracking, behavioural monitoring and
targeted ads. Apply a Fourth Schedule exception only to its specified purpose
and conditions. For a person with a disability who has a lawful guardian,
verify the guardian's appointment under Rule 11 before relying on consent.

## If personal data leaks

1. **Act immediately.** Page the incident owner. Record when Luma first became
   aware, in UTC and India time, and preserve access logs and evidence. Stop the
   exposure and restrict evidence to the response team. Identify the affected
   people, data, providers and likely consequences. Follow the containment
   steps in [the incident runbook](./incidents.md).
2. **CERT-In.** For an incident listed in Annexure I of the directions, report
   within six hours of noticing it or learning of it. Use the official reporting
   channel, such as `incident@cert-in.org.in`. Confirm Luma's designated CERT-In
   contact and record the report time and receipt.
3. **Affected people.** When section 8(6) and Rule 7 apply, notify each affected
   person without delay through their account or registered contact channel.
   In plain language give the nature, extent and timing of the breach, likely
   consequences for them, what Luma has done or is doing, steps they can take
   and the business contact for questions.
4. **Data Protection Board.** When section 8(6) and Rule 7 apply, send the
   initial report without delay. Give the nature, extent, timing, location and
   likely impact. Send details within 72 hours of awareness, unless the Board
   allows more time on written request. Include updated facts and causes,
   mitigation, any findings about who caused the breach, steps to prevent
   recurrence and the report on notices to affected people. Use the verified
   Board channel and record delivery and any extension.
5. Record the response and corrective actions in the restricted incident
   record. Store redacted evidence of timelines and delivery. Practise both
   notification paths with synthetic data before treating them as ready.

## Evidence to close before sign-off

| Owner to assign         | Evidence to retain                                                                                                                                                                                                                                                       |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Legal and privacy       | Confirm the legal entity, privacy contact, purpose and lawful-basis register, per-record retention and transfer review. Check applicable exemptions and any Significant Data Fiduciary notification.                                                                     |
| Support                 | Verify the inbox, access controls and staffing. Run access, correction, withdrawal, erasure, grievance and nomination cases through secure completion, including a request from a person who cannot sign in. Confirm the published grievance period and test escalation. |
| Product and language    | Review notices against actual data collection and sharing. Confirm all Eighth Schedule notice and consent versions. Test legacy notice delivery and the approved age and guardian procedures.                                                                            |
| Security and operations | Verify provider contracts, locations, access reviews, monitoring, retention and a protected restore. Run a breach drill and verify the actual reporting contacts.                                                                                                        |
| Release                 | Check the deployed public routes, signed-in flows and hosted shell behaviour. Record production configuration and test evidence separately from PR results.                                                                                                              |

[act]: https://www.meity.gov.in/static/uploads/2024/02/Digital-Personal-Data-Protection-Act-2023.pdf
[commencement]: https://www.meity.gov.in/static/uploads/2025/11/c56ceae6c383460ca69577428d36828b.pdf
[rules]: https://www.meity.gov.in/static/uploads/2025/11/53450e6e5dc0bfa85ebd78686cadad39.pdf
[correction]: https://www.meity.gov.in/static/uploads/2025/12/3c7ebbae0e5456f493f486e6845df86b.pdf
[date]: https://www.pib.gov.in/PressReleasePage.aspx?PRID=2261823
[order]: https://www.meity.gov.in/static/uploads/2026/10/daf495a7b5798a3dfa72a944b51fc176.pdf
[it]: https://www.meity.gov.in/static/uploads/2024/02/ITAct_0-1.pdf
[spdi]: https://www.meity.gov.in/sites/upload_files/dit/files/GSR313E_10511%281%29.pdf
[cert]: https://www.cert-in.org.in/PDF/CERT-In_Directions_70B_28.04.2022.pdf
[cert-faq]: https://www.cert-in.org.in/PDF/FAQs_on_CyberSecurityDirections_May2022.pdf
[languages]: https://www.legislative.gov.in/static/uploads/2025/08/cb1b190ea633a1746368ed1fac35fb30.pdf
[inventory]: ./app-privacy-permissions.md#data-inventory-for-store-forms
