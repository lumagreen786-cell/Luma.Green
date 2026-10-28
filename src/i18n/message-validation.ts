import {
  type MessageFormatElement,
  parse,
  TYPE,
} from "@formatjs/icu-messageformat-parser";

/** Flatten without assuming that a catalog has valid values or matching keys. */
export function flattenMessages(
  messages: Record<string, unknown>,
  prefix = "",
): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(messages).flatMap(([key, value]) => {
      const name = prefix ? `${prefix}.${key}` : key;
      return value !== null &&
        typeof value === "object" &&
        !Array.isArray(value)
        ? Object.entries(
            flattenMessages(value as Record<string, unknown>, name),
          )
        : [[name, value]];
    }),
  );
}

interface MessageContract {
  requirements: string[];
  literals: string[];
}

/** Parse ICU syntax, including nested plurals, selects, quoted text and tags. */
export function messageContract(message: string): MessageContract {
  const requirements = new Set<string>();
  const literals: string[] = [];
  function visit(elements: MessageFormatElement[]): void {
    for (const element of elements) visitElement(element);
  }
  function visitElement(element: MessageFormatElement): void {
    switch (element.type) {
      case TYPE.literal: {
        literals.push(element.value);
        break;
      }
      case TYPE.pound: {
        break;
      }
      case TYPE.tag: {
        requirements.add(`tag:${element.value}`);
        visit(element.children);
        break;
      }
      case TYPE.select: {
        const choices = Object.keys(element.options).toSorted((a, b) =>
          a.localeCompare(b),
        );
        requirements.add(`select:${element.value}:${choices.join(",")}`);
        for (const option of Object.values(element.options))
          visit(option.value);
        break;
      }
      case TYPE.plural: {
        // Languages have different plural categories. Exact-number branches
        // from English and offsets must survive translation. Additional
        // exact cases can express grammar that English does not need.
        const exact = Object.keys(element.options)
          .filter((choice) => choice.startsWith("="))
          .toSorted((a, b) => a.localeCompare(b));
        requirements.add(
          `plural:${element.value}:${element.pluralType ?? "cardinal"}:${String(element.offset)}`,
        );
        for (const choice of exact)
          requirements.add(`exact:${element.value}:${choice}`);
        for (const option of Object.values(element.options))
          visit(option.value);
        break;
      }
      case TYPE.argument:
      case TYPE.number:
      case TYPE.date:
      case TYPE.time: {
        requirements.add(`argument:${element.value}:${String(element.type)}`);
        break;
      }
    }
  }
  visit(parse(message));
  return {
    requirements: [...requirements].toSorted((a, b) => a.localeCompare(b)),
    literals,
  };
}

// These names, official identifiers and standard unit symbols are deliberately
// shared. Do not exempt message keys: a later paragraph at that key must fail.
const sharedLiterals = [
  "Luma.Green",
  "India", // The country name is spelled identically in several supported languages.
  "Bengaluru",
  "Karnataka",
  "KSPCB",
  "Kabadiwala",
  "Saathi",
  "pmsuryaghar.gov.in",
  "WhatsApp",
  "Google Maps", // Google requires this exact untranslated attribution.
  "GSTIN",
  "UPI",
  "kg",
  "km",
  "min",
  "kW",
  "m²",
  "MB",
  "KB",
];

// Exact words can be valid in both languages. Keep this list narrow and
// locale-specific; it must never exempt a message key or a longer paragraph.
const identicalTranslations: Readonly<
  Partial<Record<string, readonly string[]>>
> = {
  es: ["No"],
  fr: ["Notifications"],
  it: ["No"],
  pt: ["Material", "Metal", "Total", "Kabadiwalas", "Saathis"],
  nl: [
    "Contact",
    "Plastic",
    "Recycler",
    "Recyclers",
    "Code",
    "Impact",
    "Later",
    "Camera",
    "Privacy",
    "per kg",
  ],
};

export function hasUntranslatedCopy(
  source: string,
  translated: string,
  locale?: string,
): boolean {
  if (
    source === translated &&
    locale !== undefined &&
    identicalTranslations[locale]?.includes(source)
  )
    return false;
  const sourceLiterals = messageContract(source).literals;
  const translatedLiterals = messageContract(translated).literals;
  if (source === translated) {
    return sourceLiterals.some((literal) => {
      // The SI gram symbol is shared. Exempt the complete literal only, so
      // adding a one-letter unit cannot hide copied words that contain it.
      if (literal.trim() === "g") return false;
      let remainder = literal;
      for (const shared of sharedLiterals)
        remainder = remainder.replaceAll(shared, "");
      return /[a-z]/i.test(remainder);
    });
  }
  // Catch an English paragraph left inside an otherwise translated message.
  return sourceLiterals.some((literal) => {
    const text = literal.trim();
    return (
      text.length >= 30 &&
      (text.match(/[a-z]+/gi)?.length ?? 0) >= 3 &&
      translatedLiterals.some((translation) => translation.includes(text))
    );
  });
}

/** Allow locale-specific exact-number cases while retaining all source rules. */
export function hasSameMessageContract(
  source: string,
  translated: string,
): boolean {
  const expected = messageContract(source).requirements;
  const actual = messageContract(translated).requirements.filter(
    (requirement) =>
      !requirement.startsWith("exact:") || expected.includes(requirement),
  );
  return (
    expected.length === actual.length &&
    expected.every((value, index) => value === actual[index])
  );
}
