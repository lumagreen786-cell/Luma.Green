## Round 4

Native: clean after complete reads including the installed Android sender.
Papers: clean after complete reads, including all save acknowledgement orders.
Auth: not clean after complete reads. Two Major findings accepted as PROPOSE FIX:
`requestPhoneCode` starts SMS after a delayed bot check even if its caller left;
the nested photo-upload loop can start later uploads after screen removal.
The outer component guards do not cover these nested waits. Repair their owners.

All reviewers used fresh contexts and no history or memory. The root recorded
completion from actual final reviewer reports; no runtime execution by reviewers.
