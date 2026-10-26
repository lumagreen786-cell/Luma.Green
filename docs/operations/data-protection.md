# Data protection

> **Status:** draft, 29 Sep 2026. **Not legal advice.** Facts gathered on that
> date from UIDAI, MeitY, CERT-In and the DPDP Rules; have a lawyer review this
> page and the privacy notices before the pilot handles real data.

## Which rules apply, and when

| Rule                                                   | In force                                               | What it asks of us                                                                                                                         |
| ------------------------------------------------------ | ------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------ |
| IT Act s.43A and the 2011 SPDI Rules                   | Now                                                    | Reasonable security for personal data                                                                                                      |
| CERT-In Directions (April 2022)                        | Now                                                    | Report a cyber incident **within 6 hours** of noticing it; keep system logs for **180 days** (may be stored abroad if we can produce them) |
| Digital Personal Data Protection Act 2023 + Rules 2025 | Rules notified Nov 2025; main duties from ~13 May 2027 | Notice, consent, purpose limits, security, breach reporting, erasure, children's data                                                      |
| Aadhaar Act 2016 and its regulations                   | Now                                                    | We don't collect or store Aadhaar numbers at all                                                                                           |

We build to the DPDP standard now, so nothing has to change in 2027.

## What we hold, why, and for how long

| Data                                                                     | Whose                               | Why                                                   | Who can see it                                                                         | Kept                                                                                                                                  |
| ------------------------------------------------------------------------ | ----------------------------------- | ----------------------------------------------------- | -------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| Phone number                                                             | Everyone                            | Sign-in codes, pickups, updates                       | The person, the admin; a kabadiwala after accepting a booking                          | While active, then 12 months                                                                                                          |
| Pickup address and map pin                                               | Households                          | So the kabadiwala can find them                       | The assigned kabadiwala, the admin                                                     | 12 months after the booking                                                                                                           |
| Photos of scrap                                                          | Households                          | Optional estimate                                     | Transient processing by Convex, OpenRouter and the selected provider; no admin gallery | Not stored in application storage or tables; provider routing requires zero data retention                                            |
| Hashed SMS/photo request counters                                        | Sign-in and photo users             | Limit paid requests                                   | Internal server functions                                                              | Rolling 24 hours; scheduled expiry                                                                                                    |
| SMS event and attempt metadata                                           | Booking/application users           | Deduplication and operational diagnosis               | Internal functions and admin data access                                               | Retained; no automatic outbox purge yet. Phone and message bodies are not copied into the outbox                                      |
| Business address and location                                            | Businesses                          | So nearby users can find them                         | Public once approved                                                                   | While active                                                                                                                          |
| GSTIN, pollution-board consent and certificate                           | Businesses                          | Verification                                          | The business, the admin                                                                | While active                                                                                                                          |
| PAN and linked GSTIN list (GSTIN, state and status)                      | Registered business applicants only | Find and select the applicant's business registration | Owned authenticated application access; internal verification functions                | Proof valid for 24 hours; stored with application until authorized application/account erasure; no automatic expiry purge implemented |
| Machine photos and videos                                                | Businesses                          | Verification                                          | The business, the admin                                                                | While active                                                                                                                          |
| Photo ID (never a full Aadhaar) and selfie                               | Saathis                             | Verification and household safety                     | The Saathi, the admin                                                                  | While active; 90 days after a rejection                                                                                               |
| Receipts — weights, amounts, method                                      | Both parties                        | A record of each trade                                | Both parties, the admin                                                                | 72 months (tax-record period)                                                                                                         |
| Admin profile — name, email, phone, date of birth, last 4 Aadhaar digits | The admin                           | The operator's identity record                        | The admin                                                                              | While in the role                                                                                                                     |
| Audit log and events                                                     | —                                   | Security, disputes, pilot numbers                     | The admin                                                                              | At least 1 year (processing logs); the audit log is permanent                                                                         |

Nothing is collected "just in case". A new field needs a line in this table.

## Aadhaar

- We **never** collect, store or display a full Aadhaar number. An entity doing
  offline verification "shall not collect, use or store Aadhaar number"; storing
  one lawfully needs an Aadhaar Data Vault hosted in India. Penalties run to
  ₹1 crore per breach plus ₹10 lakh a day.
- A Saathi may upload a **masked** Aadhaar (last four digits visible) as one of
  several accepted IDs. Alternatives are always offered: voter ID, driving
  licence, PAN, or a DigiLocker document.
- If someone uploads an unmasked Aadhaar, the admin asks for a masked copy and
  the file is deleted — it's an item on the verification checklist.
- The admin's own profile keeps only the last four digits, and Aadhaar is never
  part of signing in.

## Notice and consent

- **A notice per role, before we collect anything:** what we collect, why, how
  to withdraw consent and how to complain. In the user's language — English,
  Kannada and Hindi first (the DPDP Act allows English or any Eighth-Schedule
  language).
- **Consent is specific.** Photo estimation requires an explicit action. No
  training collection or opt-in is implemented. Adding one needs its own notice
  and storage/retention design.
- **18 and over.** Everyone who registers confirms they are 18+; households
  confirm it when booking. The DPDP Act needs verifiable parental consent for
  anyone younger, and we don't serve minors.

## Rights: access, correction, erasure

- Anyone can ask by SMS or email to see, correct or delete their data. The
  admin handles it within **30 days** (our target).
- Erasure removes the data from production at once, except what a law makes us
  keep (tax records, 72 months). Copies in backups expire within 12 months
  ([backups.md](./backups.md#personal-data-in-backups)).

## Safeguards

- Every Convex function checks who's asking before it reads or writes.
- Private files are served only through permission-checked HTTP actions
  ([auth.md](../architecture/auth.md#private-files)).
- The admin signs in with a password and an authenticator code.
- HTTPS everywhere; providers encrypt at rest; backups on an encrypted disk and
  encrypted again when copied off-site.
- Keys have the least permission that works and a spend limit where offered.
- Admin actions are written to the audit log.
- **Gap:** Convex and Vercel free plans keep function logs only briefly. Our own
  audit log and events tables meet the one-year processing-log rule, but
  CERT-In's 180-day system-log rule needs Convex log streams (Pro) or a regular
  log export before we grow past the pilot.

## Where the data lives

| Processor                                      | What it handles                | Where               |
| ---------------------------------------------- | ------------------------------ | ------------------- |
| Convex                                         | All records and files          | EU West (Ireland)   |
| Vercel                                         | Web pages and server rendering | Global edge network |
| MSG91                                          | Phone numbers and message text | India               |
| OpenRouter and the model provider it routes to | Household photos for estimates | Outside India       |

The DPDP Act allows transfers abroad unless the government restricts a
country; no restriction on the EU was found as of 29 Sep 2026 — confirm before
launch. The privacy notice names every processor.

## If personal data leaks

1. **Contain it:** revoke access, rotate keys ([incidents.md](./incidents.md)).
2. **CERT-In within 6 hours** of noticing a cyber incident
   (`incident@cert-in.org.in`, with the format in the CERT-In directions).
3. **The Data Protection Board** (once DPDP duties apply): tell it without
   delay, with a detailed report within **72 hours**.
4. **The people affected:** tell them without delay, in their language — what
   happened, what data, what they should do.
5. Write it up in the incidents log.

## Before the pilot

- [ ] Privacy notice per role in English, Kannada and Hindi, reviewed by a lawyer
- [ ] 18+ confirmation in onboarding and at booking
- [ ] "Unmasked Aadhaar → reject and delete" on the Saathi checklist
- [ ] Verify transient photo behavior and provider retention terms; no photo storage is implemented
- [ ] Define outbox retention and scheduled cleanup for rejected applications
- [ ] A way to handle "my data" requests
- [ ] The processor list and each provider's data processing terms checked
- [ ] Tax advice on whether Luma.Green is an e-commerce operator under GST
      ([open questions](../product/open-questions.md))
