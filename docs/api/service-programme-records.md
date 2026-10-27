# Service enquiries and programme records

Scope: approved specification D07, D27, D30 and D31; stakeholder workbook C27:C51.

## Service enquiries

The canonical record is `serviceEnquiries`. A verified member can create a private draft with one kind, title and description. An optional organization must be the caller's current active workspace with write permission. An optional recipient must be a named approved stakeholder. The creator explicitly chooses whether to send the record as an enquiry. Only its creator, the currently approved selected recipient and a TOTP-authenticated platform admin can read it. Organization membership alone grants no read access to another person's enquiry. Only the creator can edit, send or close it. Recipient suspension removes later access. No provider is configured by this feature: confirmed bookings, quotes, delivery, redemption, loan eligibility, insurance and welfare awards remain unavailable.

Supported reference kinds: equipment, staffing, transport, environment, accounting, solar, scales, voice, society, welfare, donation, reward, finance, insurance, attendance and other. Reference definitions do not assert an approved or configured provider. Donation and reward descriptions issue no monetary balance or redemption. No money moves. Direct donations are unavailable without the separately approved recipient, receipt and transfer path.

Creation requires a client operation key, unique per creator. An identical retry returns the saved record. Reuse with a different payload is rejected. Text and row counts are bounded. Every saved transition is audited; details are private record data and do not enter audit metadata.

## Programme records

A creator records a named programme, area, date period and material stream, coverage count, trip count, centre handover count, integer grams and integer group-income paise, plus a private evidence reference. All saved figures carry `reported_unverified`. A programme record does not establish a municipal agreement, audited income, funded reward or government benefit. Any optional organization follows the same current workspace write check. Only the creator and platform admin can read the source record.

An owner may create one immutable aggregate report snapshot for an explicitly selected approved stakeholder, with a purpose and expiry no later than 90 days. The snapshot contains the area, period, stream and aggregate numeric fields only. It excludes enquiry descriptions, participant identities, contact details and private evidence references. The grant authorizes that report, not the programme or another report. Live approval, owner identity, expiry and revocation are checked on every recipient read. Revocation takes effect on the next read. Updated source figures require a new explicit report operation; old snapshots remain fixed.

## API and controls

Suspended workspaces keep the creator's private records readable while membership
remains valid. The board keeps that workspace identity and returns `canCreate:
false`; existing enquiry/programme `canEdit` and report `canRevoke` are false.
Writes still require the current active workspace and operational permission.
Viewer access likewise hides write controls without granting coworkers access
to a creator's private records. Removed members lose scoped record access.

`services.board` returns only caller-owned enquiry/programme records, expressly received enquiries/reports, and approved recipient choices. Lists are bounded to 50 records per section. `createEnquiry`, `updateEnquiry`, `createProgramme`, `updateProgramme`, `shareProgramme` and `revokeProgrammeShare` enforce the rules above. Creation and sharing operation keys are 8–80 characters; fields and exact numeric bounds are validated on the server. `seedReferenceKinds` is internal and writes only reference definitions.

The shared Services page has create, edit, send and close controls, plus aggregate report sharing and revocation. It is available in the account shell for households and approved stakeholders, and in the operating app shell. No outside service is called and no paid quota is used.

## Commercial model classification

The material-sale model is a reference to the existing trade owner, never a second sales or payment system. Principal-owned toll work keeps the material with its declared principal and records the direction `principal_to_processor`. Paid collection records `customer_to_service`; generator-paid treatment and wet-waste enquiries record `generator_to_handler` when that model is chosen. Treatment fees are not negative material-sale prices. Generic partner enquiries have no payment execution. The server derives this direction from the model; a caller cannot set it independently.

All four commercial models remain enquiries/evidence only in this module. No transfer of inventory, title or money occurs. A declared principal is not verified ownership. A source material lot must belong to the caller's authorized active workspace; only an explicit material-reference choice shares its code and recorded grams. It never grants source-lot access. The owner can withdraw an enquiry recipient even after closing it. Withdrawal also removes the recipient's permission to link a new support complaint to that private source.

Service and programme complaints use the existing typed private support owner. The internal kind initializer is `services.seedReferenceKinds`; it seeds 17 definitions, including wet waste, and creates no approved provider. Source records remain `reported_unverified`; optional evidence references do not constitute an operating permit, verified certificate, agreement, eligibility decision or payment.

`services.expireDrafts` owns a bounded daily cleanup (100 records per page), with 30 days of inactivity as the cutoff. Open linked support issues keep a draft. A programme with any published aggregate report keeps its source evidence, including after report revocation. The internal handler schedules its own continuation and programme phase; the deployment cron calls it once with `{}`. Submitted service enquiries and closed records are not abandoned drafts.
