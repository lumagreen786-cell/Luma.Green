import { describe, expect, it } from "vitest";

import {
  flattenMessages,
  hasSameMessageContract,
  hasUntranslatedCopy,
  messageContract,
} from "./message-validation";

describe("message validation", () => {
  it("retains invalid leaf values so validation can report them", () => {
    expect(
      flattenMessages({ common: { title: "Hello", empty: null, list: [] } }),
    ).toEqual({
      "common.title": "Hello",
      "common.empty": null,
      "common.list": [],
    });
  });

  it("detects changed variables and rich-text tags in nested ICU branches", () => {
    const source =
      "{count, plural, one {<strong>{name}</strong>} other {<strong>{name}</strong>}}";
    const wrong =
      "{count, plural, one {<em>{person}</em>} other {<em>{person}</em>}}";
    expect(messageContract(source).requirements).not.toEqual(
      messageContract(wrong).requirements,
    );
  });

  it("allows locale plural categories while preserving explicit numeric cases", () => {
    const source = "{count, plural, =0 {None} one {# item} other {# items}}";
    const translated =
      "{count, plural, =0 {لا شيء} zero {صفر} one {واحد} two {اثنان} few {# عناصر} many {# عنصرًا} other {# عنصر}}";
    expect(messageContract(translated).requirements).toEqual(
      messageContract(source).requirements,
    );
    expect(
      messageContract(source.replace("=0 {None}", "")).requirements,
    ).not.toEqual(messageContract(source).requirements);
  });

  it("allows a locale-specific zero case but does not drop source cases", () => {
    const withoutZero = "{count, plural, one {# job} other {# jobs}}";
    const withZero = "{count, plural, =0 {# કામ} one {# કામ} other {# કામ}}";
    expect(hasSameMessageContract(withoutZero, withZero)).toBe(true);
    expect(hasSameMessageContract(withZero, withoutZero)).toBe(false);
  });

  it("detects missing select choices, changed format types and plural offsets", () => {
    expect(
      messageContract("{role, select, buyer {Buy} other {Home}}").requirements,
    ).not.toEqual(messageContract("{role, select, other {Home}}").requirements);
    expect(messageContract("{price, number}").requirements).not.toEqual(
      messageContract("{price}").requirements,
    );
    expect(
      messageContract("{count, plural, offset:1 other {#}}").requirements,
    ).not.toEqual(messageContract("{count, plural, other {#}}").requirements);
  });

  it("rejects invalid ICU and honors ICU apostrophe escaping", () => {
    expect(() => messageContract("{count, plural, one {One}}")).toThrow();
    expect(() => messageContract("<strong>Unclosed")).toThrow();
    expect(messageContract("'{name}' {actual}").requirements).toEqual([
      "argument:actual:1",
    ]);
  });

  it("allows shared names, acronyms, units and placeholder-only formats", () => {
    for (const value of [
      "Luma.Green",
      "India",
      "Bengaluru",
      "Bengaluru · {date}",
      "Karnataka",
      "Karnataka (KSPCB)",
      "Kabadiwala",
      "Saathi",
      "© Luma.Green",
      "GSTIN {gstin}",
      "UPI",
      "WhatsApp",
      "{price}/kg",
      "{value} g",
      "{km} km",
      "{minutes} min",
      "{kw} kW",
      "{a} · {b}",
    ]) {
      expect(hasUntranslatedCopy(value, value), value).toBe(false);
    }
  });

  it("rejects copied labels and paragraphs without exempting their keys", () => {
    expect(
      hasUntranslatedCopy("Prices across India", "Prices across India"),
    ).toBe(true);
    expect(hasUntranslatedCopy("Close", "Close")).toBe(true);
    expect(hasUntranslatedCopy("Egg", "Egg")).toBe(true);
    expect(
      hasUntranslatedCopy(
        "Luma.Green welcomes all households.",
        "Luma.Green welcomes all households.",
      ),
    ).toBe(true);
    expect(
      hasUntranslatedCopy(
        "Please confirm the delivery before you continue.",
        "कृपया: Please confirm the delivery before you continue.",
      ),
    ).toBe(true);
    expect(hasUntranslatedCopy("Close", "बंद करें")).toBe(false);
  });

  it("allows reviewed exact shared words only in their languages", () => {
    expect(hasUntranslatedCopy("No", "No", "es")).toBe(false);
    expect(hasUntranslatedCopy("No", "No", "it")).toBe(false);
    expect(hasUntranslatedCopy("Notifications", "Notifications", "fr")).toBe(
      false,
    );
    expect(hasUntranslatedCopy("Notifications", "Notifications", "hi")).toBe(
      true,
    );
    expect(
      hasUntranslatedCopy("Enable notifications", "Enable notifications", "fr"),
    ).toBe(true);
    expect(hasUntranslatedCopy("Material", "Material", "pt")).toBe(false);
    expect(hasUntranslatedCopy("Material", "Material", "hi")).toBe(true);
    expect(hasUntranslatedCopy("Metal prices", "Metal prices", "pt")).toBe(
      true,
    );
    expect(hasUntranslatedCopy("No", "No", "hi")).toBe(true);
    expect(hasUntranslatedCopy("No", "No")).toBe(true);
    expect(
      hasUntranslatedCopy("No results found", "No results found", "es"),
    ).toBe(true);
    expect(
      hasUntranslatedCopy(
        "Bengaluru prices today",
        "Bengaluru prices today",
        "es",
      ),
    ).toBe(true);
  });
});

it("keeps required Google Maps attribution exact without allowing copied paragraphs", () => {
  expect(hasUntranslatedCopy("Google Maps", "Google Maps", "ar")).toBe(false);
  expect(
    hasUntranslatedCopy(
      "Google Maps provides this address",
      "Google Maps provides this address",
      "ar",
    ),
  ).toBe(true);
});
