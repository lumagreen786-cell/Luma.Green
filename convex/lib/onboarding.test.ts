import { describe, expect, it } from "vitest";

import {
  applicationIssues,
  businessSchema,
  documentsSchema,
  fileProblem,
  fileTypesFor,
  indiaToday,
  isGstin,
  kabadiwalaSchema,
  missingFiles,
  saathiSchema,
  sectionsFor,
  sniffContentType,
} from "./onboarding";

const MB = 1024 * 1024;

const pdf = (size: number) => ({ contentType: "application/pdf", size });

/** Bytes from text and raw numbers, for the file-type checks. */
const bytes = (...parts: (string | number[])[]) =>
  new Uint8Array(
    parts.flatMap((part) =>
      typeof part === "string" ? [...new TextEncoder().encode(part)] : part,
    ),
  );

/** The first message per field, the way a form shows it. */
function errors(result: {
  success: boolean;
  error?: { issues: { path: PropertyKey[]; message: string }[] };
}): Record<string, string> {
  const found: Record<string, string> = {};
  const issues = result.error?.issues ?? [];
  for (const issue of issues) {
    const key = issue.path.join(".");
    found[key] ??= issue.message;
  }
  return found;
}

const shop = {
  ownerName: "Ramesh K",
  shopName: "Ramesh Kabadi Store",
  gstRegistered: false,
  address: "12, 4th Cross, Yeshwanthpur, Bengaluru",
  offersPickup: true,
  vehicle: "auto" as const,
  phones: [{ number: "98450 12345", label: "Helper" }],
  opens: "08:00",
  closes: "20:00",
  weeklyOff: ["sun" as const],
};

const business = {
  businessName: "Peenya Paper Yard",
  gstRegistered: true,
  gstin: "29ABCDE1234F1Z5",
  materials: ["paper" as const, "plastic" as const],
  address: "Plot 7, Peenya Industrial Area, Bengaluru",
  locationTags: ["Peenya"],
  collectsFromSuppliers: true,
  phones: [],
  opens: "09:00",
  closes: "18:00",
  weeklyOff: [],
};

const documents = {
  pcbNotRequired: false,
  board: "kspcb" as const,
  consentNumber: "KSPCB/CFO/2025/123",
  validUntil: "2027-03-31",
  declaration: true as const,
};

const saathi = {
  name: "Lakshmi",
  area: "Malleshwaram",
  radiusKm: 5 as const,
  workTypes: ["home_pickups" as const],
  vehicle: "cycle" as const,
  times: ["morning" as const],
  days: ["mon" as const, "tue" as const],
};

describe("isGstin", () => {
  it("accepts the GSTIN shape, in any case", () => {
    expect(isGstin("29ABCDE1234F1Z5")).toBe(true);
    expect(isGstin("29abcde1234f1z5")).toBe(true);
  });

  it("rejects typos", () => {
    expect(isGstin("29ABCDE1234F1Y5")).toBe(false); // 14th must be Z
    expect(isGstin("29ABCDE1234F1Z")).toBe(false);
    expect(isGstin(undefined)).toBe(false);
  });
});

describe("kabadiwala form", () => {
  it("accepts a complete shop", () => {
    expect(kabadiwalaSchema.safeParse(shop).success).toBe(true);
  });

  it("needs a GSTIN only when they say they have one", () => {
    expect(
      errors(kabadiwalaSchema.safeParse({ ...shop, gstRegistered: true })),
    ).toMatchObject({ gstin: "gstin" });
    expect(
      kabadiwalaSchema.safeParse({
        ...shop,
        gstRegistered: true,
        gstin: "29ABCDE1234F1Z5",
      }).success,
    ).toBe(true);
  });

  it("asks for the vehicle only when they do home pickups", () => {
    expect(
      errors(kabadiwalaSchema.safeParse({ ...shop, vehicle: undefined })),
    ).toMatchObject({ vehicle: "chooseOne" });
    expect(
      kabadiwalaSchema.safeParse({
        ...shop,
        offersPickup: false,
        vehicle: undefined,
      }).success,
    ).toBe(true);
  });

  it("checks names, hours and extra numbers", () => {
    expect(
      errors(
        kabadiwalaSchema.safeParse({
          ...shop,
          ownerName: " ",
          opens: "20:00",
          closes: "08:00",
          phones: [
            { number: "98450 12345", label: "Helper" },
            { number: "+91 98450-12345", label: "Partner" },
          ],
        }),
      ),
    ).toMatchObject({
      ownerName: "required",
      closes: "closesBeforeOpens",
      phones: "duplicatePhone",
    });
    expect(
      errors(
        kabadiwalaSchema.safeParse({
          ...shop,
          phones: [
            { number: "98450 00001", label: "A" },
            { number: "98450 00002", label: "B" },
            { number: "98450 00003", label: "C" },
          ],
        }),
      ),
    ).toMatchObject({ phones: "maxPhones" });
  });

  it("insists on a Yes or No, never a silent default", () => {
    expect(
      errors(
        kabadiwalaSchema.safeParse({
          ...shop,
          gstRegistered: undefined,
          offersPickup: undefined,
        }),
      ),
    ).toMatchObject({ gstRegistered: "chooseOne", offersPickup: "chooseOne" });
  });
});

describe("yard, recycler and manufacturer", () => {
  it("accepts complete details", () => {
    expect(businessSchema.safeParse(business).success).toBe(true);
  });

  it("records source site and material origin without requiring old drafts to have them", () => {
    expect(
      businessSchema.safeParse({
        ...business,
        siteType: "apartment_community",
        materialOrigins: ["post_consumer"],
      }).success,
    ).toBe(true);
    expect(
      businessSchema.safeParse({ ...business, siteType: "unknown" }).success,
    ).toBe(false);
    expect(
      businessSchema.safeParse({
        ...business,
        materialOrigins: ["industrial_byproduct", "unknown"],
      }).success,
    ).toBe(false);
  });

  it("needs at least one material and at most five area tags", () => {
    expect(
      errors(
        businessSchema.safeParse({
          ...business,
          materials: [],
          locationTags: ["a1", "b2", "c3", "d4", "e5", "f6"],
        }),
      ),
    ).toMatchObject({ materials: "pickAtLeastOne", locationTags: "maxTags" });
  });
});

describe("pollution-control documents", () => {
  const schema = documentsSchema("2026-09-29");

  it("accepts a valid consent", () => {
    expect(schema.safeParse(documents).success).toBe(true);
  });

  it("wants every consent detail, in date, from the right board", () => {
    expect(
      errors(
        schema.safeParse({
          pcbNotRequired: false,
          board: "other",
          validUntil: "2026-09-29",
          declaration: true,
        }),
      ),
    ).toMatchObject({
      boardState: "required",
      consentNumber: "required",
      validUntil: "expired",
    });
  });

  it("lets a unit that needs no consent explain why instead", () => {
    expect(
      schema.safeParse({
        pcbNotRequired: true,
        notRequiredReason: "We only bale paper by hand — white category.",
        declaration: true,
      }).success,
    ).toBe(true);
    expect(
      errors(
        schema.safeParse({
          pcbNotRequired: true,
          notRequiredReason: "white",
          declaration: true,
        }),
      ),
    ).toMatchObject({ notRequiredReason: "explainMore" });
  });

  it("needs the declaration ticked", () => {
    expect(
      errors(schema.safeParse({ ...documents, declaration: false })),
    ).toMatchObject({ declaration: "declaration" });
  });
});

describe("saathi form", () => {
  it("accepts a complete person", () => {
    expect(saathiSchema.safeParse(saathi).success).toBe(true);
  });

  it("needs a radius from the list and at least one of each choice", () => {
    expect(
      errors(
        saathiSchema.safeParse({
          ...saathi,
          radiusKm: 7,
          workTypes: [],
          times: [],
          days: [],
        }),
      ),
    ).toMatchObject({
      radiusKm: "chooseOne",
      workTypes: "pickAtLeastOne",
      times: "pickAtLeastOne",
      days: "pickAtLeastOne",
    });
  });
});

describe("uploads", () => {
  it("checks type and size per slot", () => {
    expect(fileProblem("pcb_certificate", pdf(2 * MB))).toBeNull();
    expect(fileProblem("pcb_certificate", pdf(11 * MB))).toBe("fileTooBig");
    expect(
      fileProblem("pcb_certificate", { contentType: "image/png", size: 1 }),
    ).toBe("fileType");
    // Videos may be 20 MB; photos only 10.
    expect(
      fileProblem("machine_media", { contentType: "video/mp4", size: 19 * MB }),
    ).toBeNull();
    expect(
      fileProblem("machine_media", {
        contentType: "image/jpeg",
        size: 11 * MB,
      }),
    ).toBe("fileTooBig");
    expect(fileProblem("selfie", { contentType: undefined, size: 1 })).toBe(
      "fileType",
    );
  });

  it("knows what each role must upload", () => {
    expect(missingFiles("kabadiwala", {}, false)).toEqual([]);
    expect(missingFiles("yard", { machine_media: 1 }, false)).toEqual([
      "pcb_certificate",
      "machine_media",
    ]);
    expect(missingFiles("recycler", { machine_media: 2 }, true)).toEqual([]);
    expect(missingFiles("saathi", { selfie: 1 }, false)).toEqual(["id_proof"]);
    expect(fileTypesFor("kabadiwala")).toEqual([]);
    expect(fileTypesFor("manufacturer")).toEqual([
      "pcb_certificate",
      "machine_media",
    ]);
  });
});

describe("sniffContentType", () => {
  it("recognises what we accept by its first bytes", () => {
    expect(sniffContentType(bytes("%PDF-1.7"))).toBe("application/pdf");
    expect(sniffContentType(bytes([0xff, 0xd8, 0xff, 0xe1]))).toBe(
      "image/jpeg",
    );
    expect(
      sniffContentType(bytes([0x89], "PNG", [0x0d, 0x0a, 0x1a, 0x0a])),
    ).toBe("image/png");
    expect(sniffContentType(bytes("RIFF", [0, 0, 0, 0], "WEBP"))).toBe(
      "image/webp",
    );
    expect(sniffContentType(bytes([0, 0, 0, 0x18], "ftypmp42"))).toBe(
      "video/mp4",
    );
    expect(sniffContentType(bytes([0, 0, 0, 0x14], "ftypqt  "))).toBe(
      "video/quicktime",
    );
  });

  it("names what we don't, so it's refused", () => {
    expect(sniffContentType(bytes([0, 0, 0, 0x18], "ftypheic"))).toBe(
      "image/heic",
    );
    expect(sniffContentType(bytes("<html>"))).toBeUndefined();
    expect(sniffContentType(new Uint8Array())).toBeUndefined();
  });
});

describe("applicationIssues", () => {
  it("lists every gap in an empty kabadiwala application", () => {
    const issues = applicationIssues("kabadiwala", {}, {}, "2026-09-29");
    expect(issues.map((issue) => issue.field)).toEqual(
      expect.arrayContaining(["ownerName", "shopName", "address", "opens"]),
    );
  });

  it("is empty when a business has everything", () => {
    expect(
      applicationIssues(
        "manufacturer",
        { business, documents },
        { pcb_certificate: 1, machine_media: 2 },
        "2026-09-29",
      ),
    ).toEqual([]);
  });

  it("reports missing uploads as their own section", () => {
    expect(applicationIssues("saathi", { saathi }, {}, "2026-09-29")).toEqual([
      { section: "files", field: "id_proof", message: "fileMissing" },
      { section: "files", field: "selfie", message: "fileMissing" },
    ]);
  });

  it("only checks the sections the role uses", () => {
    expect(sectionsFor("kabadiwala")).toEqual(["kabadiwala"]);
    expect(sectionsFor("yard")).toEqual(["business", "documents"]);
    expect(
      applicationIssues(
        "saathi",
        { saathi, kabadiwala: {} },
        {
          id_proof: 1,
          selfie: 1,
        },
        "2026-09-29",
      ),
    ).toEqual([]);
  });
});

describe("indiaToday", () => {
  it("rolls over at midnight in India, not UTC", () => {
    expect(indiaToday(Date.UTC(2026, 8, 29, 18, 29))).toBe("2026-09-29");
    expect(indiaToday(Date.UTC(2026, 8, 29, 18, 31))).toBe("2026-09-30");
  });
});

it("requires GST for business applicants even when an old draft opts out", () => {
  expect(
    businessSchema.safeParse({
      ...business,
      gstRegistered: false,
      gstin: undefined,
    }).success,
  ).toBe(false);
});
it("keeps Saathi PAN optional but rejects malformed supplied PAN", () => {
  const person = {
    name: "Test Helper",
    area: "Bengaluru",
    radiusKm: 2,
    workTypes: ["home_pickups"],
    vehicle: "none",
    times: ["morning"],
    days: ["mon"],
  };
  expect(saathiSchema.safeParse(person).success).toBe(true);
  expect(saathiSchema.safeParse({ ...person, pan: "invalid" }).success).toBe(
    false,
  );
  expect(saathiSchema.safeParse({ ...person, pan: "ABCDE1234F" }).success).toBe(
    true,
  );
});
