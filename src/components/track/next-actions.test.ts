import { describe, expect, it } from "vitest";

import { retryBookingDraft } from "./next-actions";

const now = Date.parse("2026-10-27T08:00:00+05:30");

describe("declined request recovery", () => {
  it("keeps only an available date, window and collection mode", () => {
    expect(
      retryBookingDraft(
        { mode: "dropoff", slotDate: "2026-10-28", slotWindow: "morning" },
        now,
      ),
    ).toEqual({
      mode: "dropoff",
      slotDate: "2026-10-28",
      slotWindow: "morning",
      items: [],
      name: "",
      address: "",
    });
  });
  it("does not restore an expired time or the declined shop", () => {
    expect(
      retryBookingDraft(
        { mode: "pickup", slotDate: "2026-10-26", slotWindow: "morning" },
        now,
      ),
    ).toEqual({
      mode: "pickup",
      items: [],
      name: "",
      address: "",
    });
  });
});
