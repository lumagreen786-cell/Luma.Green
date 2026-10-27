import { describe, expect, it } from "vitest";

import { nextReminderTime } from "./reminderHours";
describe("India reminder hours", () => {
  it("defers night reminders until 8am India time", () => {
    expect(nextReminderTime(Date.parse("2026-10-27T15:00:00Z"))).toBe(
      Date.parse("2026-10-28T02:30:00Z"),
    );
    expect(nextReminderTime(Date.parse("2026-10-27T01:00:00Z"))).toBe(
      Date.parse("2026-10-27T02:30:00Z"),
    );
  });
  it("delivers at 8am and defers at 8pm", () => {
    const morning = Date.parse("2026-10-27T02:30:00Z");
    expect(nextReminderTime(morning)).toBe(morning);
    expect(nextReminderTime(Date.parse("2026-10-27T14:30:00Z"))).toBe(
      Date.parse("2026-10-28T02:30:00Z"),
    );
  });
});
