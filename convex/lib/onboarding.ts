import { z } from "zod";

import { canonicalCity } from "./geography";
import { normalizeIndianMobile } from "./phone";
import { MATERIAL_ORIGINS, SITE_TYPES } from "./siteClassification";

/**
 * What each role gives us at onboarding — docs/product/onboarding.md.
 *
 * One set of rules for both sides: the forms validate with these schemas, and
 * `applications.submit` runs them again on the saved draft. Every message is a
 * key under `join.errors` in messages/*.json, never English text.
 */

export const BUSINESS_KINDS = ["yard", "recycler", "manufacturer"] as const;
export type BusinessKind = (typeof BUSINESS_KINDS)[number];

export const APPLICATION_KINDS = [
  "kabadiwala",
  ...BUSINESS_KINDS,
  "saathi",
] as const;
export type ApplicationKind = (typeof APPLICATION_KINDS)[number];

export function isBusinessKind(kind: string): kind is BusinessKind {
  return (BUSINESS_KINDS as readonly string[]).includes(kind);
}

export const WEEKDAYS = [
  "mon",
  "tue",
  "wed",
  "thu",
  "fri",
  "sat",
  "sun",
] as const;
export const SHOP_VEHICLES = [
  "handcart",
  "cycle",
  "auto",
  "mini_truck",
] as const;
export const MATERIAL_FAMILIES = [
  "paper",
  "plastic",
  "metal",
  "glass",
  "ewaste",
] as const;
export const SAATHI_WORK = [
  "home_pickups",
  "shop_help",
  "yard_sorting",
  "factory_shifts",
] as const;
export const SAATHI_VEHICLES = [
  "none",
  "cycle",
  "two_wheeler",
  "auto",
] as const;
export const SAATHI_TIMES = ["morning", "afternoon", "evening"] as const;
export const RADII_KM = [2, 5, 10] as const;
export const PCB_BOARDS = ["kspcb", "other"] as const;

/** Extra numbers besides the one they signed in with. */
export const MAX_EXTRA_PHONES = 2;
export const MAX_LOCATION_TAGS = 5;

/**
 * GSTIN shape: state code, PAN, entity number, `Z`, check character. A format
 * check only — Surepass checks the registration before submission.
 */
const GSTIN = /^\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;

export function isGstin(value: string | undefined): boolean {
  return value !== undefined && GSTIN.test(value.trim().toUpperCase());
}

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function isCalendarDate(value: string): boolean {
  if (!ISO_DATE.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return (
    Number.isFinite(parsed.getTime()) &&
    parsed.toISOString().slice(0, 10) === value
  );
}

const text = (min: number, max: number) =>
  z
    .string({ error: "required" })
    .trim()
    .min(1, "required")
    .min(min, "tooShort")
    .max(max, "tooLong");

export const citySchema = z
  .string({ error: "required" })
  .refine((value) => canonicalCity(value) !== null, "city")
  .transform((value) => canonicalCity(value) ?? value);

const time = z.string({ error: "required" }).regex(TIME, "time");

const yesNo = z.boolean({ error: "chooseOne" });

export const locationSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
});

export const extraPhoneSchema = z.object({
  number: z
    .string()
    .refine((value) => normalizeIndianMobile(value) !== null, "phone"),
  label: text(1, 30),
});

const phones = z
  .array(extraPhoneSchema)
  .max(MAX_EXTRA_PHONES, "maxPhones")
  .refine(
    (list) =>
      new Set(list.map((phone) => normalizeIndianMobile(phone.number))).size ===
      list.length,
    "duplicatePhone",
  );

const weekdays = z.array(z.enum(WEEKDAYS));

/** Shared by every form with a GST question: yes needs a valid GSTIN. */
function checkGst(
  form: { gstRegistered: boolean; gstin?: string },
  ctx: z.RefinementCtx,
) {
  if (form.gstRegistered && !isGstin(form.gstin)) {
    ctx.addIssue({ code: "custom", path: ["gstin"], message: "gstin" });
  }
}

function checkHours(
  form: { opens: string; closes: string },
  ctx: z.RefinementCtx,
) {
  if (form.opens >= form.closes) {
    ctx.addIssue({
      code: "custom",
      path: ["closes"],
      message: "closesBeforeOpens",
    });
  }
}

export const kabadiwalaSchema = z
  .object({
    ownerName: text(2, 80),
    shopName: text(2, 80),
    gstRegistered: yesNo,
    gstin: z.string().optional(),
    pan: z.string().max(10).optional(),
    address: text(5, 200),
    city: citySchema,
    location: locationSchema.optional(),
    offersPickup: yesNo,
    vehicle: z.enum(SHOP_VEHICLES).optional(),
    phones,
    opens: time,
    closes: time,
    weeklyOff: weekdays,
  })
  .superRefine((form, ctx) => {
    checkGst(form, ctx);
    checkHours(form, ctx);
    if (form.offersPickup && !form.vehicle) {
      ctx.addIssue({ code: "custom", path: ["vehicle"], message: "chooseOne" });
    }
  });

export type KabadiwalaForm = z.infer<typeof kabadiwalaSchema>;

export const businessSchema = z
  .object({
    businessName: text(2, 120),
    siteType: z.enum(SITE_TYPES).optional(),
    materialOrigins: z.array(z.enum(MATERIAL_ORIGINS)).max(2).optional(),
    gstRegistered: yesNo,
    gstin: z.string().optional(),
    pan: z.string().max(10).optional(),
    materials: z.array(z.enum(MATERIAL_FAMILIES)).min(1, "pickAtLeastOne"),
    address: text(5, 200),
    city: citySchema,
    location: locationSchema.optional(),
    locationTags: z.array(text(2, 40)).max(MAX_LOCATION_TAGS, "maxTags"),
    collectsFromSuppliers: yesNo,
    phones,
    opens: time,
    closes: time,
    weeklyOff: weekdays,
  })
  .superRefine((form, ctx) => {
    checkGst(form, ctx);
    if (!form.gstRegistered)
      ctx.addIssue({ code: "custom", path: ["gstin"], message: "gstin" });
    checkHours(form, ctx);
  });

export type BusinessForm = z.infer<typeof businessSchema>;

/**
 * The pollution-control papers. A unit that needs no consent (white category,
 * such as paper baling only) says so and explains. This remains a declaration,
 * not an automated permit verification.
 */
export function documentsSchema(today: string) {
  return z
    .object({
      pcbNotRequired: z.boolean(),
      notRequiredReason: z.string().optional(),
      board: z.enum(PCB_BOARDS).optional(),
      boardState: z.string().optional(),
      consentNumber: z.string().optional(),
      validUntil: z.string().optional(),
      declaration: z.literal(true, { error: "declaration" }),
    })
    .superRefine((form, ctx) => {
      const issue = (path: string, message: string) => {
        ctx.addIssue({ code: "custom", path: [path], message });
      };
      if (form.pcbNotRequired) {
        const reason = form.notRequiredReason?.trim() ?? "";
        if (reason.length < 10) issue("notRequiredReason", "explainMore");
        return;
      }
      if (!form.board) issue("board", "chooseOne");
      if (form.board === "other" && (form.boardState?.trim().length ?? 0) < 2) {
        issue("boardState", "required");
      }
      if ((form.consentNumber?.trim().length ?? 0) < 3) {
        issue("consentNumber", "required");
      }
      if (!form.validUntil || !isCalendarDate(form.validUntil)) {
        issue("validUntil", "date");
      } else if (form.validUntil <= today) {
        issue("validUntil", "expired");
      }
    });
}

export type DocumentsForm = z.infer<ReturnType<typeof documentsSchema>>;

export const saathiSchema = z.object({
  name: text(2, 80),
  area: text(2, 120),
  city: citySchema,
  location: locationSchema.optional(),
  radiusKm: z.union([z.literal(2), z.literal(5), z.literal(10)], {
    error: "chooseOne",
  }),
  workTypes: z.array(z.enum(SAATHI_WORK)).min(1, "pickAtLeastOne"),
  vehicle: z.enum(SAATHI_VEHICLES, { error: "chooseOne" }),
  times: z.array(z.enum(SAATHI_TIMES)).min(1, "pickAtLeastOne"),
  days: weekdays.min(1, "pickAtLeastOne"),
});

export type SaathiForm = z.infer<typeof saathiSchema>;

// --- Files ------------------------------------------------------------------

export const FILE_TYPES = [
  "pcb_certificate",
  "machine_media",
  "id_proof",
  "selfie",
] as const;
export type FileType = (typeof FILE_TYPES)[number];

const MB = 1024 * 1024;
const IMAGES = ["image/jpeg", "image/png", "image/webp"];
/** Android phones record MP4; iPhones record MOV. Both play in the console. */
const VIDEOS = ["video/mp4", "video/quicktime"];

/** What each upload may be. 20 MB is the most a private file can be served at. */
export const FILE_RULES: Record<
  FileType,
  { accept: readonly { type: string; maxBytes: number }[]; max: number }
> = {
  pcb_certificate: {
    accept: [{ type: "application/pdf", maxBytes: 10 * MB }],
    max: 1,
  },
  machine_media: {
    accept: [
      ...IMAGES.map((type) => ({ type, maxBytes: 10 * MB })),
      ...VIDEOS.map((type) => ({ type, maxBytes: 20 * MB })),
    ],
    max: 10,
  },
  id_proof: {
    accept: [
      ...IMAGES.map((type) => ({ type, maxBytes: 10 * MB })),
      { type: "application/pdf", maxBytes: 10 * MB },
    ],
    max: 1,
  },
  selfie: {
    accept: IMAGES.map((type) => ({ type, maxBytes: 10 * MB })),
    max: 1,
  },
};

/** The `accept` attribute for a file input of this type. */
export function acceptFor(type: FileType): string {
  return FILE_RULES[type].accept.map((accepted) => accepted.type).join(",");
}

/**
 * A file's real type from its first bytes. The type a browser declares can
 * be anything; the first bytes can't lie without breaking the file.
 */
export function sniffContentType(head: Uint8Array): string | undefined {
  const hasBytesAt = (offset: number, bytes: Iterable<number>) =>
    [...bytes].every((byte, index) => head[offset + index] === byte);
  const hasTextAt = (offset: number, text: string) =>
    hasBytesAt(offset, new TextEncoder().encode(text));

  if (hasTextAt(0, "%PDF")) return "application/pdf";
  if (hasBytesAt(0, [0xff, 0xd8, 0xff])) return "image/jpeg";
  if (hasBytesAt(0, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) {
    return "image/png";
  }
  if (hasTextAt(0, "RIFF") && hasTextAt(8, "WEBP")) return "image/webp";
  if (!hasTextAt(4, "ftyp")) return undefined;
  if (hasTextAt(8, "qt  ")) return "video/quicktime";
  // HEIC photos share the container; we don't take them.
  const isHeic = ["heic", "heix", "mif1"].some((brand) => hasTextAt(8, brand));
  return isHeic ? "image/heic" : "video/mp4";
}

/** `null` when the file may be attached, else a `join.errors` key. */
export function fileProblem(
  type: FileType,
  file: { contentType: string | undefined; size: number },
): "fileType" | "fileTooBig" | null {
  const rule = FILE_RULES[type].accept.find(
    (accepted) => accepted.type === file.contentType,
  );
  if (!rule) return "fileType";
  return file.size > rule.maxBytes ? "fileTooBig" : null;
}

/** The uploads an application still needs before it can be sent. */
export function missingFiles(
  kind: ApplicationKind,
  counts: Partial<Record<FileType, number>>,
  isConsentExempt: boolean,
): FileType[] {
  const missing: FileType[] = [];
  const hasAtLeast = (type: FileType, count = 1) =>
    (counts[type] ?? 0) >= count;
  if (isBusinessKind(kind)) {
    if (!isConsentExempt && !hasAtLeast("pcb_certificate")) {
      missing.push("pcb_certificate");
    }
    if (!hasAtLeast("machine_media", 2)) missing.push("machine_media");
  }
  if (kind === "saathi") {
    if (!hasAtLeast("id_proof")) missing.push("id_proof");
    if (!hasAtLeast("selfie")) missing.push("selfie");
  }
  return missing;
}

/** Today in India as YYYY-MM-DD, for "valid until" checks. */
export function indiaToday(now: number = Date.now()): string {
  const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
  return new Date(now + IST_OFFSET_MS).toISOString().slice(0, 10);
}

// --- Whole application ------------------------------------------------------

export type Section = "kabadiwala" | "business" | "documents" | "saathi";

export interface ApplicationIssue {
  section: Section | "files";
  /** A form field name, or the missing file type for `files`. */
  field: string;
  /** A `join.errors` key. */
  message: string;
}

/**
 * Everything that stops an application from being sent: invalid or missing
 * fields in the sections its kind uses, and missing uploads. Empty = ready.
 */
export function applicationIssues(
  kind: ApplicationKind,
  sections: Partial<Record<Section, object>>,
  fileCounts: Partial<Record<FileType, number>>,
  today: string,
): ApplicationIssue[] {
  const issues: ApplicationIssue[] = [];
  const check = (section: Section, schema: z.ZodType) => {
    // Lists a person never touched are empty, not missing.
    const value = {
      phones: [],
      weeklyOff: [],
      locationTags: [],
      ...sections[section],
    };
    const result = schema.safeParse(value);
    if (result.success) return;
    for (const issue of result.error.issues) {
      issues.push({
        section,
        field: issue.path.join("."),
        message: issue.message,
      });
    }
  };

  if (kind === "kabadiwala") {
    check("kabadiwala", kabadiwalaSchema);
  } else if (kind === "saathi") {
    check("saathi", saathiSchema);
  } else {
    check("business", businessSchema);
    check("documents", documentsSchema(today));
  }

  const documents = sections.documents as
    { pcbNotRequired?: boolean } | undefined;
  const missing = missingFiles(
    kind,
    fileCounts,
    documents?.pcbNotRequired === true,
  );
  for (const type of missing) {
    issues.push({ section: "files", field: type, message: "fileMissing" });
  }
  return issues;
}

/** Which uploads belong to which kind of application. */
export function fileTypesFor(kind: ApplicationKind): readonly FileType[] {
  if (isBusinessKind(kind)) return ["pcb_certificate", "machine_media"];
  return kind === "saathi" ? ["id_proof", "selfie"] : [];
}

/** The form sections an application of this kind is made of. */
export function sectionsFor(kind: ApplicationKind): readonly Section[] {
  if (kind === "kabadiwala") return ["kabadiwala"];
  return kind === "saathi" ? ["saathi"] : ["business", "documents"];
}
