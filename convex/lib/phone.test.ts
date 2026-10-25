import { describe, expect, it } from "vitest";

import {
  formatIndianMobile,
  isIndianMobile,
  maskPhone,
  normalizeIndianMobile,
  phoneEmail,
  verifiedIndianMobile,
} from "./phone";

describe("normalizeIndianMobile", () => {
  it.each([
    ["9876543210", "+919876543210"],
    ["98765 43210", "+919876543210"],
    ["+91 98765-43210", "+919876543210"],
    ["919876543210", "+919876543210"],
    ["09876543210", "+919876543210"],
    ["(+91) 6000 000 000", "+916000000000"],
  ])("accepts %s", (input, expected) => {
    expect(normalizeIndianMobile(input)).toBe(expected);
  });

  it.each([
    ["", "empty"],
    ["5876543210", "starts with 5 — not a mobile"],
    ["987654321", "nine digits"],
    ["98765432101", "eleven digits without a leading 0"],
    ["+1 415 555 0100", "a US number"],
    ["abcdefghij", "letters"],
  ])("rejects %s (%s)", (input) => {
    expect(normalizeIndianMobile(input)).toBeNull();
  });
});

describe("isIndianMobile", () => {
  it("only accepts E.164 Indian mobiles", () => {
    expect(isIndianMobile("+919876543210")).toBe(true);
    expect(isIndianMobile("9876543210")).toBe(false);
    expect(isIndianMobile("+915876543210")).toBe(false);
  });
});

describe("verifiedIndianMobile", () => {
  it.each([false, undefined, null])(
    "rejects a phone with verification %s",
    (verified) => {
      expect(verifiedIndianMobile("+919876543210", verified)).toBeNull();
    },
  );
  it("normalizes only a verified valid phone", () => {
    expect(verifiedIndianMobile("98765 43210", true)).toBe("+919876543210");
    expect(verifiedIndianMobile("invalid", true)).toBeNull();
    expect(verifiedIndianMobile(undefined, true)).toBeNull();
  });
});

describe("display helpers", () => {
  it("builds the placeholder email for phone-only accounts", () => {
    expect(phoneEmail("+919876543210")).toBe("919876543210@phone.luma.green");
  });

  it("formats for people and masks for logs", () => {
    expect(formatIndianMobile("+919876543210")).toBe("+91 98765 43210");
    expect(maskPhone("+919876543210")).toBe("+91•••••••210");
  });
});
