import { type AbstractIntlMessages, createTranslator } from "next-intl";
import { describe, expect, it } from "vitest";

import messages from "../../../messages/en.json";
import { ALL_FAQ_KEYS, ALL_GUIDE_KEYS } from "./content";
import {
  buildHelpIndex,
  type HelpEntry,
  normalizeForSearch,
  searchHelp,
} from "./search";

const catalog: AbstractIntlMessages = { help: messages.help };
const t = createTranslator({
  locale: "en",
  messages: catalog,
  namespace: "help",
});
const entries = buildHelpIndex((key) => t(key));
const ids = (results: readonly HelpEntry[]) => results.map((entry) => entry.id);

function entry(overrides: Partial<HelpEntry>): HelpEntry {
  return {
    id: "faq:test",
    kind: "faq",
    topic: "prices",
    roles: ["household"],
    title: "",
    snippet: "",
    body: "",
    href: "/help/household",
    ...overrides,
  };
}

describe("buildHelpIndex", () => {
  it("lists every guide and every question exactly once", () => {
    expect(entries).toHaveLength(ALL_GUIDE_KEYS.length + ALL_FAQ_KEYS.length);
    expect(new Set(ids(entries)).size).toBe(entries.length);
  });

  it("links a guide to its first role and a question to its anchor", () => {
    const signIn = entries.find((item) => item.id === "guide:signIn");
    expect(signIn).toMatchObject({
      href: "/help/kabadiwala/sign-in",
      title: "Sign in with an SMS code",
    });
    expect(signIn?.body).toContain("Tap Resend");

    const noCode = entries.find((item) => item.id === "faq:noCode");
    expect(noCode).toMatchObject({
      href: "/help/household#faq-no-code",
      title: "I didn't get the SMS code",
    });
  });
});

describe("searchHelp", () => {
  it("finds nothing until someone types or picks a topic", () => {
    expect(searchHelp(entries, { query: "" })).toEqual([]);
    expect(searchHelp(entries, { query: " ".repeat(3) })).toEqual([]);
  });

  it("finds the sign-in guide and the missing-code question for 'SMS code'", () => {
    const results = ids(searchHelp(entries, { query: "SMS code" }));
    expect(results).toContain("guide:signIn");
    expect(results).toContain("faq:noCode");
  });

  it("ranks title matches above matches deep in the steps", () => {
    const ranked = [
      entry({ id: "guide:steps", body: "Review the payment gateway result." }),
      entry({ id: "guide:title", title: "Payment gateway" }),
      entry({ id: "faq:summary", snippet: "The payment gateway is required." }),
    ];
    expect(ids(searchHelp(ranked, { query: "payment gateway" }))).toEqual([
      "guide:title",
      "faq:summary",
      "guide:steps",
    ]);
  });

  it("needs every word to match, in any order", () => {
    const both = ids(searchHelp(entries, { query: "independent offer" }));
    const reversed = ids(searchHelp(entries, { query: "offer independent" }));
    expect(both).toEqual(reversed);
    expect(both).toContain("guide:setPrices");
    expect(searchHelp(entries, { query: "independent zebra" })).toEqual([]);
  });

  it("ignores case and punctuation", () => {
    const plain = ids(searchHelp(entries, { query: "eway bill" }));
    const typed = ids(searchHelp(entries, { query: "E-WAY   bill!" }));
    expect(typed).toEqual(ids(searchHelp(entries, { query: "e way bill" })));
    expect(typed).toContain("faq:ewayBill");
    // "eway" is one word, not "e-way": it only matches inside words.
    expect(plain).not.toContain("faq:ewayBill");
  });

  it("lists a whole topic when no words are typed", () => {
    const safety = searchHelp(entries, { query: "", topic: "safety" });
    expect(safety.length).toBeGreaterThan(0);
    expect(safety.every((item) => item.topic === "safety")).toBe(true);
    expect(ids(safety)).toEqual(
      expect.arrayContaining([
        "guide:safetyAtWork",
        "guide:batteriesAtHome",
        "faq:safetyGear",
      ]),
    );
  });

  it("combines a topic with words", () => {
    const results = searchHelp(entries, { query: "battery", topic: "safety" });
    expect(results.length).toBeGreaterThan(0);
    expect(results.every((item) => item.topic === "safety")).toBe(true);
  });

  it("matches words in Indian scripts, vowel signs and all", () => {
    const hindi = [
      entry({ id: "faq:a", title: "कबाड़ीवाला कब आएगा?" }),
      entry({ id: "faq:b", title: "पैसे कैसे मिलेंगे?" }),
    ];
    expect(ids(searchHelp(hindi, { query: "कबाड़ीवाला" }))).toEqual(["faq:a"]);
    expect(ids(searchHelp(hindi, { query: "मिलेंगे" }))).toEqual(["faq:b"]);
  });
});

describe("normalizeForSearch", () => {
  it("lower-cases and turns punctuation into single spaces", () => {
    expect(normalizeForSearch("  Weigh-and-PAY, now!  ")).toBe(
      "weigh and pay now",
    );
  });

  it("keeps combining marks so Kannada words stay whole", () => {
    expect(normalizeForSearch("ರದ್ದಿ ಕಾಗದ")).toBe("ರದ್ದಿ ಕಾಗದ");
  });
});
