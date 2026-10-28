import { describe, expect, it } from "vitest";

import {
  addItem,
  EMPTY_DRAFT,
  firstIncompleteStep,
  isComplete,
  parseDraft,
  parseKg,
  parseStep,
  reachableStep,
  removeItem,
  sanitizeItems,
  type SellDraft,
  setKg,
  stepDown,
  stepUp,
  totalGrams,
  whenProblems,
} from "./draft";

const ready: SellDraft = {
  items: [{ materialCode: "PAPER-NEWS", kg: 5 }],
  mode: "pickup",
  shopId: "shop-1",
  slotDate: "2026-09-30",
  slotWindow: "morning",
  address: "Flat 12, 4th Cross, Mathikere",
  name: "Priya",
};

describe("the kilo buttons", () => {
  it("go up in steps that grow with the amount", () => {
    expect(stepUp(0.5)).toBe(1);
    expect(stepUp(1.5)).toBe(2);
    expect(stepUp(2)).toBe(3);
    expect(stepUp(19)).toBe(20);
    expect(stepUp(20)).toBe(25);
    expect(stepUp(100)).toBe(110);
  });

  it("snap an odd amount to the next step", () => {
    expect(stepUp(2.3)).toBe(3);
    expect(stepUp(0.1)).toBe(0.5);
  });

  it("never go past 500 kg", () => {
    expect(stepUp(495)).toBe(500);
    expect(stepUp(500)).toBe(500);
  });

  it("come down the same steps, and offer removal at the smallest amount", () => {
    expect(stepDown(3)).toBe(2);
    expect(stepDown(2)).toBe(1.5);
    expect(stepDown(25)).toBe(20);
    expect(stepDown(2.3)).toBe(2);
    expect(stepDown(0.6)).toBe(0.5);
    expect(stepDown(0.5)).toBeNull();
    expect(stepDown(0.2)).toBeNull();
  });
});

describe("typed kilos", () => {
  it("read a dot or a comma as the decimal, to 0.1 kg", () => {
    expect(parseKg("12.5")).toBe(12.5);
    expect(parseKg("12,5")).toBe(12.5);
    expect(parseKg("١٢٫٥")).toBe(12.5);
    expect(parseKg("๑๒.๕")).toBe(12.5);
    expect(parseKg("१२,५")).toBe(12.5);
    expect(parseKg(" 7 ")).toBe(7);
    expect(parseKg("3.14")).toBeCloseTo(3.1, 5);
    expect(parseKg(".5")).toBe(0.5);
  });

  it("keep within the limits", () => {
    expect(parseKg("0")).toBeCloseTo(0.1, 5);
    expect(parseKg("900")).toBe(500);
  });

  it("ignore anything that isn't a number", () => {
    for (const text of ["", ".", "abc", "1.2.3", "-4", "5kg"]) {
      expect(parseKg(text)).toBeNull();
    }
  });
});

describe("the basket", () => {
  it("adds a material once, with its kilos", () => {
    const once = addItem(EMPTY_DRAFT, "PAPER-NEWS", 5);
    expect(once.items).toEqual([{ materialCode: "PAPER-NEWS", kg: 5 }]);
    expect(addItem(once, "PAPER-NEWS", 9)).toBe(once);
  });

  it("stops at 20 materials", () => {
    let draft = EMPTY_DRAFT;
    for (let index = 0; index < 25; index += 1) {
      draft = addItem(draft, `M-${String(index)}`, 1);
    }
    expect(draft.items).toHaveLength(20);
  });

  it("changes and removes one material, leaving the rest", () => {
    const draft = addItem(addItem(EMPTY_DRAFT, "A", 1), "B", 2);
    expect(setKg(draft, "B", 7).items).toEqual([
      { materialCode: "A", kg: 1 },
      { materialCode: "B", kg: 7 },
    ]);
    expect(removeItem(draft, "A").items).toEqual([
      { materialCode: "B", kg: 2 },
    ]);
  });

  it("adds up the weight in whole grams", () => {
    expect(
      totalGrams([
        { materialCode: "A", kg: 1.5 },
        { materialCode: "B", kg: 0.001 },
      ]),
    ).toBe(1501);
  });

  it("drops what the catalogue no longer sells, repeats and bad weights", () => {
    const sellable = new Set(["PAPER-NEWS", "PLASTIC-PET"]);
    expect(
      sanitizeItems(
        [
          { materialCode: "PAPER-NEWS", kg: 5 },
          { materialCode: "GONE", kg: 1 },
          { materialCode: "PAPER-NEWS", kg: 2 },
          { materialCode: "PLASTIC-PET", kg: 0 },
        ],
        sellable,
      ),
    ).toEqual([{ materialCode: "PAPER-NEWS", kg: 5 }]);
  });
});

describe("the steps", () => {
  it("need a basket, then a shop, then a time, address and name", () => {
    expect(firstIncompleteStep(EMPTY_DRAFT)).toBe("basket");
    expect(firstIncompleteStep({ ...ready, shopId: undefined })).toBe("shop");
    expect(firstIncompleteStep({ ...ready, name: "" })).toBe("when");
    expect(firstIncompleteStep(ready)).toBe("confirm");
    expect(isComplete(ready)).toBe(true);
    expect(isComplete({ ...ready, slotWindow: undefined })).toBe(false);
  });

  it("never skip ahead of an unanswered step", () => {
    expect(reachableStep("confirm", EMPTY_DRAFT)).toBe("basket");
    expect(reachableStep("when", { ...ready, shopId: undefined })).toBe("shop");
    expect(reachableStep("shop", ready)).toBe("shop");
  });

  it("need an address only for a pickup", () => {
    expect(whenProblems({ ...ready, address: "" })).toEqual(["address"]);
    expect(whenProblems({ ...ready, mode: "dropoff", address: "" })).toEqual(
      [],
    );
    expect(
      whenProblems({
        ...ready,
        slotDate: undefined,
        slotWindow: undefined,
        name: "P",
      }),
    ).toEqual(["day", "window", "name"]);
  });

  it("read only known step names from the address", () => {
    expect(parseStep("shop")).toBe("shop");
    expect(parseStep("admin")).toBeNull();
    expect(parseStep(null)).toBeNull();
  });
});

describe("a stored draft", () => {
  it("comes back as it was saved", () => {
    expect(parseDraft(JSON.stringify(ready))).toEqual(ready);
  });

  it("falls back to empty on anything unexpected", () => {
    expect(parseDraft(null)).toEqual(EMPTY_DRAFT);
    expect(parseDraft("{not json")).toEqual(EMPTY_DRAFT);
    expect(parseDraft("[1,2]")).toEqual(EMPTY_DRAFT);
    expect(
      parseDraft(
        JSON.stringify({
          items: [{ materialCode: "PAPER-NEWS", kg: -1 }, "junk"],
          mode: "teleport",
          slotWindow: "midnight",
          name: 42,
        }),
      ),
    ).toEqual(EMPTY_DRAFT);
  });
});

it("keeps an explicitly entered city when a household draft is restored", () => {
  expect(
    parseDraft(JSON.stringify({ ...EMPTY_DRAFT, city: "Mumbai, Maharashtra" }))
      .city,
  ).toBe("Mumbai, Maharashtra");
  expect(
    parseDraft(
      JSON.stringify({ address: "Old street", name: "Old draft", items: [] }),
    ).city,
  ).toBeUndefined();
});
