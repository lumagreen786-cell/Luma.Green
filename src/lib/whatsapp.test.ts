import { describe, expect, it } from "vitest";

import { whatsappBookingUrl } from "./whatsapp";
describe("WhatsApp booking link", () => {
  it("opens the configured recipient with encoded customer copy", () => {
    expect(
      whatsappBookingUrl("919876543210", "Hi Luma, pickup please? & thanks"),
    ).toBe(
      "https://wa.me/919876543210?text=Hi%20Luma%2C%20pickup%20please%3F%20%26%20thanks",
    );
  });
  it("does not invent a destination when missing or invalid", () => {
    for (const number of [
      undefined,
      "",
      "+919876543210",
      "javascript:alert(1)",
      "123",
    ])
      expect(whatsappBookingUrl(number, "Hello")).toBeNull();
  });
});
