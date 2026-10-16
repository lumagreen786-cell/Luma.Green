---
name: luma-imai-journey-review
description: Verify a changed Luma user journey across screen, server result and reload without overstating evidence.
---

# Luma Imai Journey Review

State the initiating action, required identity, final visible outcome and persistence evidence. Test the normal path and the most relevant failure: validation, denied access, expired code or provider outage. Use the real shared components and handler boundaries.

A mocked component capture proves layout, not sign-in or provider delivery. A disabled-service preview must remain visibly labelled and cannot create a session. Record environment and revision. Run fresh browser checks after changes, then report separately what is implemented, tested, deployed and still awaiting credentials. Do not send live SMS without an authorized test phone.

Source: `.agents/skills/validate-real-user-journeys/SKILL.md` in imai-dev. Use Luma Vitest/Playwright and Convex tests, not IMAI publishing tools.

IMAI dev-studio source revision d66c35ae5f5087cc927cb94c3341df6a461ce546, inspected 15 October 2026. Adapted guidance, not a copy of the IMAI runtime.
