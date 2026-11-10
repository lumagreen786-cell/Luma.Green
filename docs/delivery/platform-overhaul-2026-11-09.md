# Platform overhaul delivery record

The overhaul started from `838fe19` and includes main commit `5893932` with
its collection privacy controls. The approved scope includes the web and Expo. Production releases use checked PRs to main. This record
tracks the work by source and separates code from provider and release checks.

## Recovery integration — 10 November 2026

The release copy starts from checked main `66c0c7f` on
`feat/overhaul-recovery`. It includes the merged privacy, carbon screening and
Expo updates. The original detached worktree at `5893932` remains intact.
A recovery snapshot preserves the original staged patch, unstaged patch,
combined patch and 191 changed files with SHA-256 hashes under
`/private/tmp/luma-recovery-20261110-01a1c579`.

The release includes the recovered onboarding and household features, verified
family invitations and revocation, reviewed apartment routes, private new R2
uploads, direct cash custody, draft billing and whole-lot reservations.
Reservations also block reuse after a completed gateway sale while the lot
still belongs to its seller. Ordinary cash custody transfers the lot and checks
current site scope. The gateway custody workflow needs further acceptance.

The unfinished stock-backed PET slice is preserved outside this release copy.
Review found that its form did not select the new mode and that its supported
routes ended at a bale which could neither advance nor trade. Complete its UI,
downstream routes and stock tests before integration. The full PET-to-garment
journey, evidence reporting, retained-file migration, full visual redesign and
live monitoring setup remain open.

Fresh checks passed 3,240 application tests in 393 suites, 28 security tests,
67 mobile policy tests, 20 mobile component tests and 34 desktop tests. The full
check had zero lint errors and 130 warnings. The local Webpack production build
passed 3,582 pages. The default local builder hit a worker-port restriction.
GitHub must pass its normal default build before merge. The final production-build browser run passed 61 checks, including 24
translated navigation cases and 13 font checks. The final full check passed
after the navigation repair. Expo dependency validation and both iOS and
Android Hermes JavaScript exports passed. Device acceptance remains open.

Current component screenshots were inspected using isolated synthetic data.
Role selection and family controls covered English, Kannada, Arabic and Urdu
at 390, 768 and 1440 pixels in both themes. The admin apartment form covered
those widths in both themes. The Urdu phone tab label required a single-line
layout repair. These captures establish component layout only. Authenticated
cloud journeys, physical iOS/Android reminders, live R2 byte/access checks and
provider execution remain separate acceptance gates. Guide refresh is deferred.

The production Convex dry run selected `astute-peccary-795`, validated the
schema and proposed no index removals. No reset or file deletion is required.
Keep the existing provider flags and settings. New private uploads fail closed
when R2 is unavailable. Existing file migration still needs inventory, transfer,
rollback, byte checks and allowed/denied reads before removal.

PostHog and Sentry review is now recorded in AGENTS.md. These private workflows
retain the existing analytics exclusions and error scrubbers. This release adds
no private workflow capture or replay scope. Receiver acceptance, consent and
masking checks, dashboard charts and Vercel analytics remain open.

The DPDP recovery chat reviewed the trade boundary and handed release ownership
to this chat. Backend deployment must precede the matching checked web merge.
The release receipt must identify the PR, merged commit and Production result.

## Source coverage

| Source                                     | Implemented in the overhaul checkout                                                                                                                                                                                                                  | Remaining                                                                                                                                                                                          |
| ------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Onboarding notes and stakeholder workbook  | Six searchable groups, 41 participant types, verified-phone entry, existing operational application routes, one initial private request, and follow-up requests after approval. Review of a new type does not grant a workspace or record permission. | Link approved participant applications to facility capability grants, household and team role templates, and end-to-end acceptance for all roles.                                                  |
| Household notes                            | Household navigation, booking without photos or estimated weight, private R2 for new photos, activity, posted rates by collector, electricity estimate, opt-in Google AQI and solar checks, calendar reminder, and opt-in Expo home exit reminder.    | Apartment routing, family membership beyond existing collection invitations, broader footprint categories and verified utility tariffs, live provider acceptance, and partner features.            |
| System design workbook                     | Links all 419 sector mappings to existing sector IDs. Adds 53 PET and other material-chain references. Retains the workbook and row in the reference view.                                                                                            | Operational capability and material-route coverage, approved commercial rates, rule validation, and complete downstream lineage.                                                                   |
| Coding flow chart and build order          | Reuses Luma's existing pickup, stock, QC and evidence records. Adds direct cash receipts, custody for reviewed ordinary whole lots, and draft billing without starting a provider payment.                                                            | Multi-lot fulfillment, the full PET chain through garment purchase orders, invoice matching, evidence and institutional reporting, and live acceptance. The chart's 90% line is a planning marker. |
| Paracetamol by-products document           | Adds 11 attributed entries in the private industry reference.                                                                                                                                                                                         | Facility-specific classification and permit evidence. Regulated dispatch requires separate acceptance.                                                                                             |
| Six printed PET pages shared on 9 November | Adds 4 process and recovery routes, 56 material and recovery examples, and 8 tag definitions. Each item points to a printed page. Virgin and recycled routes have separate entries. Handwriting is excluded at the owner's request.                   | Review actual streams against facility evidence before assigning any tag to a lot. Keep virgin inputs separate from recycled-content evidence.                                                     |

## Delivery checkpoint

The first PR candidate is based on `5893932`. Its production build and 18
public or disconnected browser checks passed. The four test cases that
exceeded five seconds in a parallel run passed when run separately. The
next run lost test workers after a long pause. A fresh full run with an idle
sleep guard is in progress. The next slice adds household access and
apartment routing and is separate from that candidate.

| Next slice                             | Completion evidence                                                                                                                                                                                                                       |
| -------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Household access and apartment routing | A verified invite grants only explicitly shared booking progress. A revoked invite loses access. Apartment bookings use an eligible, reviewed route or show the manual path.                                                              |
| Stock-backed PET processing            | Accepted receipt lines or completed trade receipts back each input. One transaction posts the input and output stock movements, balanced measured grams, rejects and losses. Duplicate submissions have one effect.                       |
| PET orders and custody                 | Accepted orders reserve the selected whole lots and freeze the quote and site scope. Dispatch, receipt, review holds and cash acknowledgement preserve the same order and lot links across sites.                                         |
| Evidence and reporting                 | A private garment evidence pack shows the real fabric ancestry, downstream quality and weighment records, cash receipt, and recycled versus virgin material. Claims and institutional reporting use their own scope and duplicate checks. |
| Private storage and release            | New files and retained originals use private R2. Check access, recovery and matching production revisions. Verify home reminders in iOS and Android development builds.                                                                   |

## 10 November scope update

- The [shared design conversation](https://chatgpt.com/share/6af204f9-79ec-83e8-8975-fe9cfdc369bf)
  includes three concepts for the phone, OTP and participant selection screens.
  Apply the forest-green and sage direction, meaningful icons and new imagery.
  Keep the Luma.Green identity and localized light and dark layouts. Preserve
  the existing OTP provider, security controls and all 41 searchable choices.
  The eight-role concept is visual guidance for the larger grouped directory.
- The signed-in EU PostHog project uses Asia/Kolkata and INR. The
  [Luma Launch and Reliability dashboard](https://eu.posthog.com/project/332034/dashboard/1099338)
  exists without public sharing. It needs verified events and charts.
  Extend the shared PostHog and Sentry code, map workflow events and errors,
  and test consent, masking and withdrawal before enabling replay or heatmaps.
  Keep recorded trade value separate from collected Luma revenue.
- Add Vercel Web Analytics and Speed Insights to the rollout with privacy
  controls. Verify the existing Vercel Observability view. Review billing
  before activating separately billed project features.

## Acceptance gates

- Direct custody covers one ordinary whole lot with current reviews for both
  sites. The seller can record cash after the buyer confirms receipt. The two
  parties settle directly. Luma does not charge, pay out, or treat the seller's
  cash record as proof of an official filing.
- The Expo geofence requires a development build with
  `EXPO_PUBLIC_HOME_REMINDERS_ENABLED=true`. The default build keeps background
  location disabled. Test entry, exit, denied permissions, revocation,
  disablement, and restart on iOS and Android. The operating system stores
  the region. Luma sends no coordinates or movement history to the server.
- The web reminder downloads an iCalendar file. The user imports it into their
  calendar to enable the alert.
- Household photo tests use an in-memory R2 substitute. Verify an authorized
  read, a denied read, byte integrity, and abandonment cleanup in separate
  private dev and production buckets. New application and identity uploads also use private R2. Check their
  maximum file sizes and private reads in a configured deployment. Legacy
  files, quality defaults and retained paper chunks still need review under
  the full R2 move.
- Keep workbook classifications, indicative prices, and example tariffs as
  references. Require verified evidence for permits, payments and claims.
  Do not reuse historic prototype payment or regulatory state as live proof.
- Before any reset, identify the target, preserve admin access and provider
  settings, inventory database and object bytes, and rehearse restoration.
  Match backend and frontend release revisions. The provider setup checklist
  is in the separate **Luma.Green Provider Setup** chat.
- The Luma Pro dashboard shows `luma-0f95/luma-green`, `luma.green` and
  Production from `main`. The current Ready deployment is `c25d59e`.
  The matching Convex dry run resolved to `astute-peccary-795`, validated
  the schema and proposed no index removals. Complete the checked backend
  deployment before merging the matching web candidate.
