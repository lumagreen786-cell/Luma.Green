import { kgToGrams } from "../../../convex/lib/chain";
import {
  BASKET_MAX_ITEMS,
  type BasketItem,
  isValidAddress,
  isValidKg,
  isValidName,
  ITEM_MAX_KG,
  SLOT_WINDOWS,
  type SlotWindow,
} from "../../../convex/lib/households";

/**
 * Everything a household has chosen on /sell so far. It lives in this tab's
 * session storage until they book, so a reload or a language switch never
 * loses their basket. Pure functions only — the hook is in use-draft.ts.
 */

export const SELL_STEPS = ["basket", "shop", "when", "confirm"] as const;
export type SellStep = (typeof SELL_STEPS)[number];

export type Mode = "pickup" | "dropoff";

export interface SellDraft {
  items: BasketItem[];
  mode: Mode;
  shopId?: string;
  slotDate?: string;
  slotWindow?: SlotWindow;
  address: string;
  city?: string;
  name: string;
}

/** A draft with every answer the booking needs. */
export type CompleteDraft = SellDraft & {
  shopId: string;
  slotDate: string;
  slotWindow: SlotWindow;
};

export const EMPTY_DRAFT: SellDraft = {
  items: [],
  mode: "pickup",
  address: "",
  name: "",
};

// --- Kilos ---------------------------------------------------------------------

/** The smallest amount the − and + buttons go to. */
export const MIN_STEP_KG = 0.5;

/** One-tap amounts under each material. */
export const KG_PRESETS = [1, 2, 5, 10, 25] as const;

/** Grams added or taken away by one tap, by how much there already is. */
function stepGrams(grams: number): number {
  if (grams < 2000) return 500;
  if (grams < 20_000) return 1000;
  return grams < 100_000 ? 5000 : 10_000;
}

/** One tap of +: up to the next step, never past the limit. */
export function stepUp(kg: number): number {
  const grams = kgToGrams(kg);
  const step = stepGrams(grams);
  const next = (Math.floor(grams / step) + 1) * step;
  return Math.min(next, ITEM_MAX_KG * 1000) / 1000;
}

/** One tap of −: down to the step below, or null to take the item out. */
export function stepDown(kg: number): number | null {
  const grams = kgToGrams(kg);
  if (grams <= MIN_STEP_KG * 1000) return null;
  const step = stepGrams(grams - 1);
  const previous = (Math.ceil(grams / step) - 1) * step;
  return Math.max(previous, MIN_STEP_KG * 1000) / 1000;
}

/**
 * What someone typed as kilos: digits with a `.` or `,` decimal, rounded to
 * 0.1 kg and kept within the limits. Null when it isn't a number at all.
 */
export function parseKg(text: string): number | null {
  const clean = asciiDigits(text.trim()).replace(",", ".").replace("٫", ".");
  const hasDigit = /\d/.test(clean);
  if (!hasDigit || !/^\d{0,4}(\.\d*)?$/.test(clean)) return null;
  const kg = Math.round(Number(clean) * 10) / 10;
  return Number.isFinite(kg) ? Math.min(Math.max(kg, 0.1), ITEM_MAX_KG) : null;
}

// --- Basket ----------------------------------------------------------------------

export function hasItem(draft: SellDraft, materialCode: string): boolean {
  return draft.items.some((item) => item.materialCode === materialCode);
}

export function addItem(
  draft: SellDraft,
  materialCode: string,
  kg: number,
): SellDraft {
  const isFull = draft.items.length >= BASKET_MAX_ITEMS;
  return isFull || hasItem(draft, materialCode)
    ? draft
    : { ...draft, items: [...draft.items, { materialCode, kg }] };
}

export function removeItem(draft: SellDraft, materialCode: string): SellDraft {
  return {
    ...draft,
    items: draft.items.filter((item) => item.materialCode !== materialCode),
  };
}

export function setKg(
  draft: SellDraft,
  materialCode: string,
  kg: number,
): SellDraft {
  return {
    ...draft,
    items: draft.items.map((item) =>
      item.materialCode === materialCode ? { ...item, kg } : item,
    ),
  };
}

export function totalGrams(items: readonly BasketItem[]): number {
  return items.reduce((sum, item) => sum + kgToGrams(item.kg), 0);
}

/**
 * The basket without anything the catalogue no longer sells, each material
 * once, every weight within the limits — what a stored draft becomes before
 * it's priced or booked.
 */
export function sanitizeItems(
  items: readonly BasketItem[],
  sellable: ReadonlySet<string>,
): BasketItem[] {
  const seen = new Set<string>();
  const clean: BasketItem[] = [];
  for (const item of items) {
    if (
      !sellable.has(item.materialCode) ||
      seen.has(item.materialCode) ||
      !isValidKg(item.kg) ||
      clean.length >= BASKET_MAX_ITEMS
    )
      continue;
    seen.add(item.materialCode);
    clean.push(item);
  }
  return clean;
}

// --- Steps ------------------------------------------------------------------------

export type WhenField = "day" | "window" | "address" | "name";

/** What's still missing on the "When?" step, in the order it's asked. */
export function whenProblems(draft: SellDraft): WhenField[] {
  const problems: WhenField[] = [];
  if (!draft.slotDate) problems.push("day");
  if (!draft.slotWindow) problems.push("window");
  if (draft.mode === "pickup" && !isValidAddress(draft.address)) {
    problems.push("address");
  }
  if (!isValidName(draft.name)) problems.push("name");
  return problems;
}

/** The first step that still needs an answer. */
export function firstIncompleteStep(draft: SellDraft): SellStep {
  if (draft.items.length === 0) return "basket";
  if (!draft.shopId) return "shop";
  return whenProblems(draft).length > 0 ? "when" : "confirm";
}

export function isComplete(draft: SellDraft): draft is CompleteDraft {
  return (
    firstIncompleteStep(draft) === "confirm" &&
    draft.shopId !== undefined &&
    draft.slotDate !== undefined &&
    draft.slotWindow !== undefined
  );
}

/** The step to show: the one asked for, unless an earlier one isn't done. */
export function reachableStep(wanted: SellStep, draft: SellDraft): SellStep {
  const limit = SELL_STEPS.indexOf(firstIncompleteStep(draft));
  return SELL_STEPS.indexOf(wanted) <= limit ? wanted : SELL_STEPS[limit];
}

export function parseStep(value: string | null): SellStep | null {
  return SELL_STEPS.find((step) => step === value) ?? null;
}

export function previousStep(step: SellStep): SellStep {
  return SELL_STEPS[Math.max(0, SELL_STEPS.indexOf(step) - 1)];
}

// --- Storage format -----------------------------------------------------------------

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseItems(value: unknown): BasketItem[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry: unknown) => {
    if (!isRecord(entry)) return [];
    const { materialCode, kg } = entry;
    return typeof materialCode === "string" &&
      typeof kg === "number" &&
      isValidKg(kg)
      ? [{ materialCode, kg }]
      : [];
  });
}

const text = (value: unknown) => (typeof value === "string" ? value : "");
const optionalText = (value: unknown) =>
  typeof value === "string" && value.length > 0 ? value : undefined;

/**
 * A draft read back from storage. Anything unexpected — an older shape,
 * someone editing storage by hand — falls back to empty fields rather than
 * breaking the page.
 */
export function parseDraft(raw: string | null): SellDraft {
  if (!raw) return EMPTY_DRAFT;
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return EMPTY_DRAFT;
  }
  if (!isRecord(value)) return EMPTY_DRAFT;
  const slotWindow = SLOT_WINDOWS.find((window) => window === value.slotWindow);
  return {
    items: parseItems(value.items),
    mode: value.mode === "dropoff" ? "dropoff" : "pickup",
    shopId: optionalText(value.shopId),
    slotDate: optionalText(value.slotDate),
    slotWindow,
    address: text(value.address),
    ...(optionalText(value.city) && { city: optionalText(value.city) }),
    name: text(value.name),
  };
}
import { asciiDigits } from "@/lib/number-input";
