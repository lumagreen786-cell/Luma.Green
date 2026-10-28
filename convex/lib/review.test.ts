import { describe, expect, it } from "vitest";

import {
  areaFrom,
  changedFields,
  checkNote,
  consentFrom,
  hoursSince,
  MAX_PRICE_PAISE,
  NOTE_MAX_CHARS,
  orgDraftFrom,
  priceProblem,
  saathiDraftFrom,
  slaFor,
  slugify,
} from "./review";

const HOUR = 60 * 60 * 1000;

describe("the review clock", () => {
  it("counts whole hours, never below zero", () => {
    const now = Date.UTC(2026, 8, 29, 12);
    expect(hoursSince(now - 90 * 60 * 1000, now)).toBe(1);
    expect(hoursSince(now + HOUR, now)).toBe(0);
  });

  it("is on time under 18 hours, due soon from 18 and overdue from 24", () => {
    expect(slaFor(0)).toBe("ok");
    expect(slaFor(17)).toBe("ok");
    expect(slaFor(18)).toBe("due_soon");
    expect(slaFor(23)).toBe("due_soon");
    expect(slaFor(24)).toBe("overdue");
    expect(slaFor(100)).toBe("overdue");
  });
});

describe("the admin's note", () => {
  it("is required, and trimmed, to ask for changes or reject", () => {
    expect(checkNote("changes", undefined)).toEqual({
      ok: false,
      error: "NOTE_REQUIRED",
    });
    expect(checkNote("reject", "  no  ")).toEqual({
      ok: false,
      error: "NOTE_REQUIRED",
    });
    expect(checkNote("reject", "  Consent has expired. ")).toEqual({
      ok: true,
      note: "Consent has expired.",
    });
  });

  it("is optional to approve", () => {
    expect(checkNote("approve", undefined)).toEqual({
      ok: true,
      note: undefined,
    });
    expect(checkNote("approve", " ".repeat(3))).toEqual({
      ok: true,
      note: undefined,
    });
  });

  it("has an upper limit", () => {
    expect(checkNote("changes", "x".repeat(NOTE_MAX_CHARS + 1))).toEqual({
      ok: false,
      error: "NOTE_TOO_LONG",
    });
  });
});

describe("a business's area", () => {
  it("uses the supplied city only to find its local area", () => {
    expect(
      areaFrom("Plot 2, Andheri, Mumbai", undefined, "Mumbai, Maharashtra"),
    ).toBe("Andheri");
  });
  it("prefers the first location tag", () => {
    expect(
      areaFrom("Plot 7, Peenya, Bengaluru", [" ", "Peenya 2nd Stage"]),
    ).toBe("Peenya 2nd Stage");
  });

  it("takes the part of the address just before the city", () => {
    expect(areaFrom("3rd Block, Rajajinagar, Bengaluru")).toBe("Rajajinagar");
    expect(areaFrom("12 MG Road, Ashok Nagar, Bangalore 560001")).toBe(
      "Ashok Nagar",
    );
    expect(areaFrom("5th Cross, Malleshwaram 560003, Bengaluru")).toBe(
      "Malleshwaram",
    );
  });

  it("falls back to the last part, then to the city", () => {
    expect(areaFrom("Near the bus stand, Yeshwanthpur")).toBe("Yeshwanthpur");
    expect(areaFrom("Bengaluru")).toBe("Bengaluru");
    expect(areaFrom(undefined)).toBe("Bengaluru");
  });
});

describe("the consent on a business", () => {
  it("names KSPCB, or the other state's board", () => {
    expect(
      consentFrom({
        pcbNotRequired: false,
        board: "kspcb",
        consentNumber: " KSPCB/CFO/2025/4410 ",
        validUntil: "2028-03-31",
      }),
    ).toEqual({
      board: "KSPCB",
      number: "KSPCB/CFO/2025/4410",
      validUntil: "2028-03-31",
    });
    expect(
      consentFrom({
        pcbNotRequired: false,
        board: "other",
        boardState: "Tamil Nadu",
        consentNumber: "TNPCB/77",
        validUntil: "2027-01-31",
      }),
    ).toMatchObject({ board: "Tamil Nadu" });
  });

  it("is absent when the unit needs none, or the papers are incomplete", () => {
    expect(
      consentFrom({ pcbNotRequired: true, notRequiredReason: "Baling only" }),
    ).toBeUndefined();
    expect(
      consentFrom({ pcbNotRequired: false, board: "kspcb" }),
    ).toBeUndefined();
    expect(consentFrom(undefined)).toBeUndefined();
  });
});

describe("from an application to a business", () => {
  it("opens a kabadiwala's shop with the three families every shop buys", () => {
    expect(
      orgDraftFrom({
        kind: "kabadiwala",
        kabadiwala: {
          city: "Bengaluru",
          ownerName: "Kavitha S",
          shopName: " Kavitha Raddi Shop ",
          gstRegistered: true,
          gstin: "29abcde1234f1z5",
          address: "3rd Block, Rajajinagar, Bengaluru",
          offersPickup: false,
          vehicle: "cycle",
          phones: [{ number: "+919845000099", label: " Husband " }],
          opens: "09:00",
          closes: "19:30",
          weeklyOff: ["tue"],
        },
      }),
    ).toEqual({
      kind: "kabadiwala",
      name: "Kavitha Raddi Shop",
      city: "Bengaluru",
      area: "Rajajinagar",
      address: "3rd Block, Rajajinagar, Bengaluru",
      location: undefined,
      phones: [{ number: "+919845000099", label: "Husband" }],
      hours: { opens: "09:00", closes: "19:30" },
      weeklyOff: ["tue"],
      gstin: "29ABCDE1234F1Z5",
      families: ["paper", "plastic", "metal"],
      offersPickup: false,
      vehicle: undefined, // no pickups, so no pickup vehicle
      consent: undefined,
    });
  });

  it("carries a yard's materials, pickups and consent across", () => {
    expect(
      orgDraftFrom({
        kind: "yard",
        business: {
          city: "Bengaluru",
          businessName: "Irfan Metal & Plastic Yard",
          gstRegistered: false,
          gstin: "29AAIFI3344R1Z1", // typed, then "not registered" chosen
          materials: ["metal", "plastic"],
          address: "Survey 42, Hegde Nagar, Bengaluru",
          locationTags: ["Thanisandra"],
          collectsFromSuppliers: true,
          weeklyOff: [],
        },
        documents: {
          pcbNotRequired: false,
          board: "kspcb",
          consentNumber: "KSPCB/CFO/2025/4410",
          validUntil: "2028-03-31",
          declaration: true,
        },
      }),
    ).toMatchObject({
      kind: "yard",
      name: "Irfan Metal & Plastic Yard",
      area: "Thanisandra",
      gstin: undefined,
      families: ["metal", "plastic"],
      offersPickup: true,
      phones: [],
      hours: undefined,
      consent: { board: "KSPCB", number: "KSPCB/CFO/2025/4410" },
    });
  });

  it("keeps a manufacturer's declared byproduct origin through approval", () => {
    expect(
      orgDraftFrom({
        kind: "manufacturer",
        business: {
          city: "Bengaluru",
          businessName: "Textile Works",
          address: "Factory Road, Bengaluru",
          siteType: "manufacturing_facility",
          materialOrigins: ["industrial_byproduct"],
        },
      }),
    ).toMatchObject({
      kind: "manufacturer",
      siteType: "manufacturing_facility",
      materialOrigins: ["industrial_byproduct"],
    });
  });

  it("refuses an application without a name or address, or a Saathi's", () => {
    expect(
      orgDraftFrom({ kind: "recycler", business: { businessName: "  " } }),
    ).toBeNull();
    expect(orgDraftFrom({ kind: "kabadiwala" })).toBeNull();
    expect(
      orgDraftFrom({ kind: "saathi", saathi: { name: "Lakshmi" } }),
    ).toBeNull();
  });
});

describe("from an application to a Saathi", () => {
  const saathi = {
    city: "Bengaluru",
    name: "Lakshmi Devi",
    area: "Yeshwanthpur",
    radiusKm: 5 as const,
    workTypes: ["home_pickups" as const],
    vehicle: "cycle" as const,
    times: ["morning" as const],
    days: ["mon" as const, "sat" as const],
  };

  it("keeps what they can do, when and where", () => {
    expect(saathiDraftFrom({ kind: "saathi", saathi })).toEqual({
      ...saathi,
      city: "Bengaluru",
    });
  });

  it("refuses an incomplete one", () => {
    expect(
      saathiDraftFrom({
        kind: "saathi",
        saathi: { ...saathi, vehicle: undefined },
      }),
    ).toBeNull();
    expect(saathiDraftFrom({ kind: "yard", saathi })).toBeNull();
  });
});

describe("slugs", () => {
  it("are lower-case words joined by dashes", () => {
    expect(slugify("Irfan Metal & Plastic Yard")).toBe(
      "irfan-metal-plastic-yard",
    );
    expect(slugify("  Café Kabadi #2 ")).toBe("cafe-kabadi-2");
  });

  it("stay short, cut at a word", () => {
    const slug = slugify(`${"Recycling ".repeat(10)}Works`);
    expect(slug.length).toBeLessThanOrEqual(60);
    expect(slug.endsWith("-")).toBe(false);
  });

  it("are empty for a name with no Latin letters", () => {
    expect(slugify("ಕವಿತಾ ರದ್ದಿ")).toBe("");
  });
});

describe("what changed between versions", () => {
  it("lists the fields that differ", () => {
    expect(
      changedFields(
        {
          kabadiwala: {
            city: "Bengaluru",
            shopName: "Kavitha Raddi",
            address: "Rajajinagar",
            location: { lat: 1, lng: 2 },
          },
        },
        {
          kabadiwala: {
            city: "Bengaluru",
            shopName: "Kavitha Raddi Shop",
            address: "Rajajinagar",
            location: { lng: 2, lat: 1 }, // same place, keys in another order
          },
        },
      ),
    ).toEqual(["kabadiwala.shopName"]);
  });

  it("treats an untouched list as an empty one", () => {
    expect(
      changedFields(
        { business: { phones: undefined, locationTags: [] } },
        { business: { phones: [], locationTags: undefined } },
      ),
    ).toEqual([]);
  });

  it("notices added and removed fields", () => {
    expect(
      changedFields(
        { documents: { board: "kspcb" } },
        { documents: { board: "kspcb", validUntil: "2028-01-01" } },
      ),
    ).toEqual(["documents.validUntil"]);
  });
});

describe("prices", () => {
  it("accepts whole paise with the floor at or under the fallback", () => {
    expect(priceProblem(1200, 1400)).toBeNull();
    expect(priceProblem(1400, 1400)).toBeNull();
  });

  it("refuses zero, negative and fractional paise", () => {
    expect(priceProblem(0, 1400)).toBe("INVALID_PRICE");
    expect(priceProblem(1200, -1)).toBe("INVALID_PRICE");
    expect(priceProblem(1200.5, 1400)).toBe("INVALID_PRICE");
    expect(priceProblem(NaN, 1400)).toBe("INVALID_PRICE");
  });

  it("refuses a floor above the fallback, and absurd prices", () => {
    expect(priceProblem(1500, 1400)).toBe("FLOOR_ABOVE_FALLBACK");
    expect(priceProblem(100, MAX_PRICE_PAISE + 1)).toBe("PRICE_TOO_HIGH");
  });
});
