import { describe, expect, it } from "vitest";

import { dailyCalendarReminder } from "./calendar-reminder";

describe("daily calendar reminder", () => {
  it("schedules the next occurrence and uses local time for daily repetition", () => {
    const result = dailyCalendarReminder(
      "07:30",
      "Check lights",
      "Look before leaving",
      new Date(2026, 10, 9, 8),
      "fixture",
    );
    expect(result).toContain("DTSTART:20261110T073000\r\n");
    expect(result).toContain("RRULE:FREQ=DAILY\r\n");
    expect(result).toContain("BEGIN:VALARM\r\n");
  });

  it("rejects invalid times and escapes text that looks like calendar syntax", () => {
    expect(
      dailyCalendarReminder("26:00", "Title", "", new Date(), "fixture"),
    ).toBeNull();
    expect(
      dailyCalendarReminder(
        "06:00",
        "Title\nATTENDEE:example",
        "",
        new Date(),
        "fixture",
      ),
    ).toContain("SUMMARY:Title\\nATTENDEE:example\r\n");
  });
});
