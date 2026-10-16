import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { defaultLocale, localeMeta, locales } from "./locales";
import {
  flattenMessages,
  hasSameMessageContract,
  hasUntranslatedCopy,
  messageContract,
} from "./message-validation";

const messagesDir = path.join(process.cwd(), "messages");

const byName = (a: string, b: string) => a.localeCompare(b);

function load(locale: string): Record<string, unknown> {
  return JSON.parse(
    readFileSync(path.join(messagesDir, `${locale}.json`), "utf8"),
  ) as Record<string, unknown>;
}

const english = flattenMessages(load(defaultLocale));
const baseline = Object.keys(english).toSorted(byName);

describe("locale registry", () => {
  it("has metadata for every locale", () => {
    for (const locale of locales) {
      expect(localeMeta[locale]).toBeDefined();
      expect(localeMeta[locale].label).not.toHaveLength(0);
    }
  });

  it("ships a message file for every registered locale", () => {
    const onDisk = readdirSync(messagesDir)
      .filter((file) => file.endsWith(".json"))
      .map((file) => file.replace(/\.json$/, ""))
      .toSorted(byName);

    expect(onDisk).toEqual([...locales].toSorted(byName));
  });
});

describe.each(locales)("messages/%s.json", (locale) => {
  const messages = load(locale);

  it("matches the English key set exactly", () => {
    // Catches both missing translations and keys left behind after a rename.
    expect(Object.keys(flattenMessages(messages)).toSorted(byName)).toEqual(
      baseline,
    );
  });

  it("has valid translated values with the same ICU contract as English", () => {
    const flattened = flattenMessages(messages);
    for (const key of baseline) {
      const value = flattened[key];
      const source = english[key];
      const label = `${locale}.${key}`;
      expect(typeof value, label).toBe("string");
      expect(typeof source, label).toBe("string");
      if (typeof value !== "string" || typeof source !== "string") continue;
      expect(value.trim(), label).not.toBe("");
      // Spanish “Todo…” is normal copy; only reject explicit task markers.
      expect(value, label).not.toMatch(/^TODO(?:\s*[:—-]|\s*$)/u);
      expect(() => messageContract(value), label).not.toThrow();
      expect(hasSameMessageContract(source, value), label).toBe(true);
      if (locale !== defaultLocale) {
        expect(hasUntranslatedCopy(source, value, locale), label).toBe(false);
      }
    }
  });

  it("uses one recycling action label across public entry points", () => {
    const flattened = flattenMessages(messages);
    for (const key of [
      "nav.sellScrap",
      "home.hero.sell",
      "home.closing.sell",
      "home.roles.household.cta",
    ]) {
      expect(flattened[key], `${locale}.${key}`).toBe(
        flattened["sell.simple.title"],
      );
    }
  });

  it("keeps the brand name untranslated", () => {
    expect((messages.brand as Record<string, string>).name).toBe("Luma.Green");
  });
});
