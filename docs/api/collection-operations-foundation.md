# Collection operations contract — 27 October 2026

Approved specification: D11, D12, D14, D26, D32, D34 and D38.

Collection windows are 09–11, 12–14 and 16–18 India time. These three two-hour windows are explicit first-version defaults. Dates cover today and the next six dates. Each active shop must publish opening hours; pickup windows must fit those hours. Weekly closure and dated holidays block requests. The default capacity is 20 active requests per window. Acceptance and reassignment repeat these checks in the same database transaction. An offer expires after two hours; exhausted offers remain unassigned until rescheduled or cancelled.

`collectionScheduling.availability({orgId,date})` returns each available window and remaining capacity, without private booking details. `saveAvailability({capacityPerWindow,holidayDates,enabledWindows})` requires the active business writer. `reschedule({bookingId,date,window})` requires the household owner; before travel it changes the saved time after eligibility checks, after travel it saves an operator request. `failedVisit({bookingId,reason})` requires the responsible business and keeps a missed-visit reason.

`collectionScheduling.repeat({bookingId,everyDays})` creates or replaces one active schedule for the household owner, with an interval of 7, 14 or 30 days. Each generated visit is a separate dated request. `stopRepeating` affects only future generation. One bounded Convex cron generates requests within the seven-date horizon, skips unavailable dates, and advances its next-date cursor transactionally. Previously dated requests remain unchanged. Schedule operation keys prevent duplicate visits.

Worker job fees remain fixed integer paise disclosed on the offer. The business sets a due date and can declare payment only after completion. The assigned worker can acknowledge only that declaration. These records do not guarantee wages or prove bank settlement.

Non-urgent reminders defer to 08–20 India time, then repeat task version, assignment and completion checks. Inbox operation keys deduplicate them. Payment and security delivery remain immediate.

Unsubmitted application drafts inactive for 30 days expire in bounded batches, except drafts with an open linked support record. Pending upload cleanup remains owned by the existing 24-hour photo cleanup.

Support can link an authorized booking, trade, job or application. Private links require current ownership or organization access. The support record stores the operations, accounts or reviewer team, acknowledgement time and escalation time. Payment and safety reports escalate immediately. One-business-day acknowledgement is an internal target, not a public service promise.

A household time change on an unassigned request starts a fresh two-hour offer round. Automatic decline/reassignment keeps the original round deadline. Expired offers cannot be accepted after their expiry callback clears the active offer. The original creation time stays unchanged. An operator must approve a travel-stage reschedule request before the saved appointment changes.

Support source links also cover material lots, inspections and material demands. A later message for the same actor and open source appends private support evidence. An urgent payment or safety message escalates the existing record; deduplication cannot discard that escalation. Identical follow-up evidence is stored once. Admin reads update history through the same authenticated support boundary.

Worker job posting sets an explicit first-version due-date default seven days after the job date. The business records the actual due date in its payment declaration. These are internal records; they do not imply a provider transfer or a platform wage guarantee.

Admin reassignment requires an authenticated admin with TOTP, a reason, an active pickup shop in the same city, an eligible calendar window, spare capacity and the configured radius for a known collection point. It creates a new offer and keeps acceptance with the destination shop; admin cannot accept for it. The prior offer timer becomes stale through a monotonically increasing attempt. Explicit reassignment starts one new bounded two-hour round. Manual-address requests keep their explicit operator acceptance path.
