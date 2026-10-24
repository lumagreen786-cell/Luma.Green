# Onboarding and verification

The owner changed registration on 25 October 2026. New applications complete
through server checks and activate without manual onboarding approval. Existing
records, files, audit history and other administrator permissions remain intact.
The historical review rules below apply only to older records and recovery.

## Current flow

1. Choose a language and verify the phone number with the real SMS code.
2. Choose a role and complete its existing consent.
3. Preprocessors, recyclers and manufacturers enter GSTIN. Registered kabadiwalas
   also enter GSTIN. Surepass Corporate GSTIN returns the registered business
   name and address. Show those details and ask the applicant to confirm them.
4. Complete the remaining role fields and required uploads. Saathis retain the
   ID and selfie uploads. Households and Saathis have no PAN or GST entry.
5. The server checks completeness and current confirmed GST proof where required,
   saves the submitted version, creates the business/member or Saathi profile and
   activates the registration in one transaction. No manual approval is needed.

All applicant PAN inputs are retired. GST lookup has no automatic paid retries
and allows at most 20 paid attempts per verified account per India calendar day.
Names come from the provider; failed or unavailable lookup cannot invent a name
or bypass the proof requirement. See [the service contract](../api/surepass-validation.md).
GST registration alone is not verification of an operating permit or ownership.

A user can leave at any point and continue later: the form saves itself as a
draft a moment after every change. After signing in, everyone lands on
`/join/status`, which picks up where they are.

Every applicant confirms they are **18 or older** and reads the privacy notice
for their role before the first form ([data protection](../operations/data-protection.md#notice-and-consent)).

## What each role gives us

Taken from the founder's documents diagram. "Proposed" marks an addition that
the diagram does not have and still needs a yes.

### Household

Nothing at registration — there is none. At **booking** we take the phone
number (confirmed by SMS code) and the pickup location. See
[household.md](./household.md).

### Kabadiwala

| Field          | Type                                 | Required                  | Rules                                                                                                                                                                                  |
| -------------- | ------------------------------------ | ------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Owner's name   | Text                                 | Yes                       | 2–80 characters                                                                                                                                                                        |
| Shop name      | Text                                 | Yes                       | 2–80 characters                                                                                                                                                                        |
| GST number     | Text                                 | **No**                    | If given: 15 characters, GSTIN format (a typo check only); the admin confirms it on the GST portal. "Not GST-registered" is recorded explicitly — it matters for metal-scrap tax later |
| Shop address   | Text + map pin                       | Yes                       | "Use my location" fills the pin; the address stays editable                                                                                                                            |
| Home pickups   | Yes / No                             | Yes                       | "No" shows: _a Saathi near you can do home pickups for your shop_                                                                                                                      |
| Vehicle        | Handcart · Cycle · Auto · Mini-truck | If home pickups is Yes    | One choice                                                                                                                                                                             |
| Phone numbers  | List                                 | The login number is fixed | Up to two more, each with a label (helper, partner); not verified                                                                                                                      |
| Opening hours  | Opens / closes                       | Yes                       | Opens before closes. Per-day hours come later                                                                                                                                          |
| Weekly holiday | Days of the week                     | No                        | Any number of days                                                                                                                                                                     |

One screen, one "Send for verification" button.

### Preprocessor (yard), recycler and manufacturer

These three share one form in two steps; the title and a few hints change with
the role.

**Step 1 — business details**

| Field                          | Type                                      | Required           | Rules                                                                 |
| ------------------------------ | ----------------------------------------- | ------------------ | --------------------------------------------------------------------- |
| Business name                  | Text                                      | Yes                | 2–120 characters                                                      |
| GST number                     | Text                                      | **No**             | Optional per the diagram. **Open:** make it required for B2B trade?   |
| Materials handled _(proposed)_ | Paper · Plastic · Metal · Glass · E-waste | Yes                | At least one. Without it we cannot match sellers to buyers            |
| Address                        | Text + map pin                            | Yes                | As for kabadiwalas                                                    |
| Location tags                  | Tags                                      | No                 | Area names that help others find them (e.g. _Peenya Industrial Area_) |
| Collects from suppliers        | Yes / No                                  | Yes                | "Pickup services" in the diagram                                      |
| Phone numbers                  | List                                      | Login number fixed | Up to two more, labelled                                              |
| Working hours                  | Opens / closes                            | Yes                |                                                                       |
| Weekly holiday                 | Days                                      | No                 |                                                                       |

The application and approved organisation now accept optional `siteType` and
`materialOrigins` declarations. The site values include a preprocessor yard,
recycling or manufacturing facility, apartment community, office, hotel,
resort and other site. Origins distinguish industrial byproducts from
post-consumer material. These fields preserve source facts through admin
approval; they are not yet collected by this form and do not grant trading
rights or certify the material. Existing applications and organisations remain
valid without them.

**Step 2 — documents and photos**

| Field                                             | Type                                               | Required          | Rules                                                                                                                                                         |
| ------------------------------------------------- | -------------------------------------------------- | ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Issuing board                                     | KSPCB (Karnataka) · Another state's SPCB (+ state) | Yes               | The diagram lists "KSPCB" and "SPCB – pdf"; read here as _KSPCB in Karnataka, the state board elsewhere_                                                      |
| Consent / registration number                     | Text                                               | Yes               | As printed on the certificate                                                                                                                                 |
| Valid until                                       | Date                                               | Yes               | We remind them 30 days before it expires                                                                                                                      |
| Not required for our unit                         | Checkbox + explanation                             | No                | White-category units (e.g. paper baling only) need no consent; the admin checks the claim                                                                     |
| Plastic Waste Processor registration _(proposed)_ | Number + PDF                                       | Plastic recyclers | From CPCB's EPR portal; needs a valid consent and GST                                                                                                         |
| Certificate                                       | PDF, ≤ 10 MB                                       | Yes               | The one PDF upload                                                                                                                                            |
| Machine photos and videos                         | JPEG/PNG/WebP ≤ 10 MB, MP4 or MOV ≤ 20 MB          | Yes               | At least two items; show the main machines and the yard. 20 MB is the most a private file can be served at ([auth.md](../architecture/auth.md#private-files)) |
| Declaration                                       | Checkbox                                           | Yes               | "These documents are genuine and belong to this business."                                                                                                    |

### Saathi

A personal onboarding — the person, not a business.

| Field              | Type                                                                                           | Required | Rules                                                                                                                    |
| ------------------ | ---------------------------------------------------------------------------------------------- | -------- | ------------------------------------------------------------------------------------------------------------------------ |
| Name               | Text                                                                                           | Yes      | As on their ID                                                                                                           |
| Where they live    | Area + map pin                                                                                 | Yes      |                                                                                                                          |
| Travel radius      | 2 · 5 · 10 km                                                                                  | Yes      |                                                                                                                          |
| Work they want     | Home pickups · Help at a kabadiwala shop · Sorting at a yard · Shifts at a recycler or factory | Yes      | At least one                                                                                                             |
| Vehicle            | None · Cycle · Bike or scooter · Auto                                                          | Yes      |                                                                                                                          |
| When they can work | Morning · Afternoon · Evening, plus days                                                       | Yes      |                                                                                                                          |
| Photo ID           | Image or PDF, ≤ 10 MB                                                                          | Yes      | Voter ID, driving licence, PAN, a DigiLocker document or a **masked** Aadhaar. Never a full Aadhaar number — see Privacy |
| Selfie             | Camera photo                                                                                   | Yes      | Matched against the ID by the admin                                                                                      |

Payment details are **not** collected: Saathi pay is out of scope for now.

## Application states

| State               | Who moves it                | Next                                        | What the applicant sees                            |
| ------------------- | --------------------------- | ------------------------------------------- | -------------------------------------------------- |
| `draft`             | Applicant, while filling in | `submitted`                                 | Their form, saved                                  |
| `submitted`         | Applicant                   | `approved`, `changes_requested`, `rejected` | "Under review — usually 12–24 hours"               |
| `changes_requested` | Admin, with a note          | `submitted` (on resubmit)                   | The admin's note and a "Fix and resubmit" button   |
| `approved`          | Admin                       | `suspended`                                 | "You're verified" and the way into their dashboard |
| `rejected`          | Admin, with a reason        | — (a new application after talking to us)   | The reason and how to contact us                   |
| `suspended`         | Admin                       | `approved`                                  | "Your account is paused" and how to contact us     |

Rules:

- Every transition writes an `auditLog` row: who, when, from, to, and the note.
- A resubmission keeps the earlier version; the admin sees what changed.
- Nothing in the business dashboards opens before `approved`. A user in any
  other state is sent to the status screen.
- The SLA clock starts at `submitted`. At 18 hours an application shows **Due
  soon**, at 24 hours **Overdue**.

## What the admin checks

| Role                                 | Checklist (every item ticked before _Approve_ unlocks)                                                                                                                                                                                                                                                                                                                                          |
| ------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Kabadiwala                           | Shop location looks right on the map · Called the owner on the login number · GSTIN active and matches the shop name (only if given)                                                                                                                                                                                                                                                            |
| Preprocessor, recycler, manufacturer | GSTIN active on the GST portal and matches the business (only if given) · Consent found on KSPCB's public [XGN consent register](https://xgn.karnataka.gov.in/CSHARP/ALLConsentOrder.aspx) (or the other state's board), names this business and address, not expired, covers the declared activity — or the "not required" claim holds · Machine photos show a working unit · Called the owner |
| Saathi                               | ID is readable and the name matches · Any Aadhaar is masked (an unmasked one is deleted and a masked copy requested) · Selfie matches the ID photo · Called on the listed number                                                                                                                                                                                                                |

_Ask for changes_ and _Reject_ always need a written note; it is shown to the
applicant and kept in the audit log.

## Messages we send

Over SMS (MSG91, DLT-registered templates) in the user's language; WhatsApp
later. The templates to register are listed in
[operations/services.md](../operations/services.md#sms-templates-to-register).

| When              | To        | Says                                 |
| ----------------- | --------- | ------------------------------------ |
| Code requested    | Applicant | The 6-digit code                     |
| Submitted         | Applicant | We've got it; usually 12–24 hours    |
| Approved          | Applicant | You're verified; open the app        |
| Changes requested | Applicant | What to fix; link to the form        |
| Rejected          | Applicant | We couldn't verify; how to reach us  |
| New submission    | Admin     | (in-app queue for the pilot; no SMS) |

## Privacy

- **Why we collect each field** is shown next to the field where it isn't
  obvious (for example, _"we call this number to check your shop"_).
- **Aadhaar.** We never ask for, store or display a full Aadhaar number. A
  Saathi may upload a **masked** Aadhaar (last four digits visible) as their
  photo ID; the admin's own profile keeps only the last four digits.
- **Documents and photos** are private files. Only the applicant and the admin
  can open them; every request is checked
  ([auth.md](../architecture/auth.md#private-files)).
- **Retention.** Rejected applications and their files are deleted after 90
  days; approved ones are kept while the account is active. Details and the
  legal basis: [operations/data-protection.md](../operations/data-protection.md).

## Open

1. Should GST be required for yards, recyclers and manufacturers once escrow
   invoicing starts?
2. "Location tags" — area names (as built), landmarks, or several sites per
   business?
3. Do home-pickup Saathis need police verification before their first job?
4. "What all he wants" for each hand-off — see [roles.md](./roles.md).
