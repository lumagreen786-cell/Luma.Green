import type { Doc } from "../_generated/dataModel";
import { canonicalCity, canonicalCityName, localityParts } from "./geography";
import {
  type ApplicationStatus,
  SLA_DUE_SOON_HOURS,
  SLA_OVERDUE_HOURS,
} from "./lifecycle";

/**
 * The admin's rules for verification and prices — docs/product/onboarding.md
 * and docs/product/pricing.md. Pure functions, shared by `convex/review.ts`,
 * `convex/adminPrices.ts` and the admin console, so the screen and the server
 * never disagree.
 */

/** Historical area-parser default; new provisioning always requires explicit city. */
export const PILOT_CITY = "Bengaluru";

const HOUR_MS = 60 * 60 * 1000;

// --- Service level ------------------------------------------------------------

export const SLAS = ["ok", "due_soon", "overdue"] as const;
export type Sla = (typeof SLAS)[number];

/** Whole hours from `since` to `now`, never negative. */
export function hoursSince(since: number, now: number): number {
  return Math.max(0, Math.floor((now - since) / HOUR_MS));
}

/** On time under 18 hours, due soon from 18, overdue from 24. */
export function slaFor(hours: number): Sla {
  if (hours >= SLA_OVERDUE_HOURS) return "overdue";
  return hours >= SLA_DUE_SOON_HOURS ? "due_soon" : "ok";
}

// --- Decisions ----------------------------------------------------------------

export const DECISIONS = ["approve", "changes", "reject"] as const;
export type Decision = (typeof DECISIONS)[number];

/** Where each decision moves an application. */
export const DECISION_STATUS = {
  approve: "approved",
  changes: "changes_requested",
  reject: "rejected",
} as const satisfies Record<Decision, ApplicationStatus>;

export const NOTE_MIN_CHARS = 5;
export const NOTE_MAX_CHARS = 1000;

export type NoteCheck =
  | { ok: true; note: string | undefined }
  | { ok: false; error: "NOTE_REQUIRED" | "NOTE_TOO_LONG" };

/**
 * Asking for changes and rejecting always need a note: the applicant reads it
 * on their status screen. An approval's note is optional.
 */
export function checkNote(
  decision: Decision,
  note: string | undefined,
): NoteCheck {
  const text = note?.trim() ?? "";
  if (text.length > NOTE_MAX_CHARS)
    return { ok: false, error: "NOTE_TOO_LONG" };
  if (decision === "approve") return { ok: true, note: nonEmpty(text) };
  return text.length < NOTE_MIN_CHARS
    ? { ok: false, error: "NOTE_REQUIRED" }
    : { ok: true, note: text };
}

// --- From an application to a business or a Saathi -----------------------------

type ApplicationSections = Pick<
  Doc<"applications">,
  "kind" | "kabadiwala" | "business" | "documents" | "saathi"
>;

/** Everything an approved business's `orgs` row takes from its application. */
export type OrgDraft = Pick<
  Doc<"orgs">,
  | "kind"
  | "siteType"
  | "materialOrigins"
  | "name"
  | "city"
  | "area"
  | "address"
  | "location"
  | "phones"
  | "hours"
  | "weeklyOff"
  | "gstin"
  | "families"
  | "offersPickup"
  | "vehicle"
  | "consent"
>;

export type SaathiDraft = Pick<
  Doc<"saathiProfiles">,
  | "name"
  | "city"
  | "area"
  | "radiusKm"
  | "workTypes"
  | "vehicle"
  | "times"
  | "days"
>;

/** Kabadiwalas don't list materials; these are what every shop buys. */
export const KABADIWALA_FAMILIES = ["paper", "plastic", "metal"] as const;

const MAX_AREA_CHARS = 80;
const CITY_NAME = /\b(?:bengaluru|bangalore)\b/i;
const PINCODE = /\b\d{6}\b/g;

function nonEmpty(value: string | undefined): string | undefined {
  const trimmed = value?.trim() ?? "";
  return trimmed.length > 0 ? trimmed : undefined;
}

/**
 * Where a business is, in a word: its first location tag, or the part of the
 * address just before "Bengaluru" (`3rd Block, Rajajinagar, Bengaluru` →
 * `Rajajinagar`), or the last part of an address that doesn't name the city.
 */
export function areaFrom(
  address: string | undefined,
  tags?: readonly string[],
  city = PILOT_CITY,
): string {
  const tag = tags?.map((value) => value.trim()).find(Boolean);
  if (tag) return tag.slice(0, MAX_AREA_CHARS);
  const parts = (address ?? "")
    .split(",")
    .map((part) => part.replaceAll(PINCODE, "").trim())
    .filter(Boolean);
  const cityAt = parts.findIndex(
    (part) =>
      canonicalCityName(part) === canonicalCityName(localityParts(city).city) ||
      (city === PILOT_CITY && CITY_NAME.test(part)),
  );
  let area: string | undefined;
  if (cityAt > 0) area = parts[cityAt - 1];
  else if (cityAt === -1) area = parts.at(-1);
  return (area ?? city).slice(0, MAX_AREA_CHARS);
}

/** The consent to show on the business: none when the unit claims exemption. */
export function consentFrom(
  documents: ApplicationSections["documents"],
): OrgDraft["consent"] {
  if (!documents || documents.pcbNotRequired === true) return undefined;
  const number = nonEmpty(documents.consentNumber);
  const validUntil = nonEmpty(documents.validUntil);
  if (!number || !validUntil) return undefined;
  const board =
    documents.board === "kspcb"
      ? "KSPCB"
      : (nonEmpty(documents.boardState) ?? "SPCB");
  return { board, number, validUntil };
}

function gstinFrom(
  isRegistered: boolean | undefined,
  gstin: string | undefined,
): string | undefined {
  return isRegistered === true ? nonEmpty(gstin)?.toUpperCase() : undefined;
}

function hoursFrom(
  opens: string | undefined,
  closes: string | undefined,
): OrgDraft["hours"] {
  return opens && closes ? { opens, closes } : undefined;
}

function phonesFrom(
  phones: readonly { number: string; label: string }[] | undefined,
): OrgDraft["phones"] {
  return (phones ?? []).map((phone) => ({
    number: phone.number.trim(),
    label: phone.label.trim(),
  }));
}

/**
 * The business an approved application becomes, or null when a part it
 * needs is missing (submit checks every field, so only damaged data lands
 * here). Saathi applications never become a business.
 */
export function orgDraftFrom(
  application: ApplicationSections,
): OrgDraft | null {
  if (application.kind === "saathi") return null;
  if (application.kind === "kabadiwala") {
    const shop = application.kabadiwala;
    const name = nonEmpty(shop?.shopName);
    const address = nonEmpty(shop?.address);
    const city = canonicalCity(shop?.city);
    if (!shop || !name || !address || !city) return null;
    const isPickupOffered = shop.offersPickup === true;
    return {
      kind: "kabadiwala",
      name,
      city,
      area: areaFrom(address, undefined, city),
      address,
      location: shop.location,
      phones: phonesFrom(shop.phones),
      hours: hoursFrom(shop.opens, shop.closes),
      weeklyOff: shop.weeklyOff ?? [],
      gstin: gstinFrom(shop.gstRegistered, shop.gstin),
      families: [...KABADIWALA_FAMILIES],
      offersPickup: isPickupOffered,
      vehicle: isPickupOffered ? shop.vehicle : undefined,
      consent: undefined,
    };
  }
  const business = application.business;
  const name = nonEmpty(business?.businessName);
  const address = nonEmpty(business?.address);
  const city = canonicalCity(business?.city);
  if (!business || !name || !address || !city) return null;
  return {
    kind: application.kind,
    ...(business.siteType && { siteType: business.siteType }),
    ...(business.materialOrigins && {
      materialOrigins: business.materialOrigins,
    }),
    name,
    city,
    area: areaFrom(address, business.locationTags, city),
    address,
    location: business.location,
    phones: phonesFrom(business.phones),
    hours: hoursFrom(business.opens, business.closes),
    weeklyOff: business.weeklyOff ?? [],
    gstin: gstinFrom(business.gstRegistered, business.gstin),
    families: business.materials ?? [],
    offersPickup: business.collectsFromSuppliers === true,
    vehicle: undefined,
    consent: consentFrom(application.documents),
  };
}

/** The Saathi an approved application becomes, or null if a part is missing. */
export function saathiDraftFrom(
  application: ApplicationSections,
): SaathiDraft | null {
  const saathi = application.saathi;
  if (!saathi || application.kind !== "saathi") return null;
  const name = nonEmpty(saathi.name);
  const area = nonEmpty(saathi.area);
  const { radiusKm, vehicle } = saathi;
  const city = canonicalCity(saathi.city);
  if (
    !name ||
    !area ||
    !city ||
    radiusKm === undefined ||
    vehicle === undefined
  ) {
    return null;
  }
  return {
    name,
    city,
    area,
    radiusKm,
    workTypes: saathi.workTypes ?? [],
    vehicle,
    times: saathi.times ?? [],
    days: saathi.days ?? [],
  };
}

const MAX_SLUG_CHARS = 60;

/**
 * A URL-safe name: `Irfan Metal & Plastic Yard` → `irfan-metal-plastic-yard`.
 * Empty when the name has no Latin letters or digits; the caller falls back.
 */
export function slugify(name: string): string {
  const words = name
    .normalize("NFKD")
    .replaceAll(/\p{M}/gu, "")
    .toLowerCase()
    .split(/[^a-z\d]+/)
    .filter(Boolean);
  let slug = "";
  for (const word of words) {
    const next = slug ? `${slug}-${word}` : word;
    if (next.length > MAX_SLUG_CHARS) break;
    slug = next;
  }
  return slug || (words[0]?.slice(0, MAX_SLUG_CHARS) ?? "");
}

// --- What changed between two versions ----------------------------------------

export const SECTION_NAMES = [
  "kabadiwala",
  "business",
  "documents",
  "saathi",
] as const;
export type SectionName = (typeof SECTION_NAMES)[number];

const NOTHING = new Set<unknown>([undefined, null, ""]);

/** A value with object keys in a fixed order; "nothing" in one shape. */
function canonical(value: unknown): unknown {
  if (NOTHING.has(value)) return null;
  if (Array.isArray(value)) {
    return value.length === 0 ? null : value.map((item) => canonical(item));
  }
  if (typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>)
      .map(([key, item]) => [key, canonical(item)] as const)
      .filter(([, item]) => item !== null)
      .toSorted(([a], [b]) => a.localeCompare(b));
    return entries.length === 0 ? null : Object.fromEntries(entries);
  }
  return value;
}

/**
 * Every form field that differs between two versions, as `section.field`.
 * An untouched list and an empty one count as the same.
 */
export function changedFields(
  before: Partial<Record<SectionName, object | undefined>>,
  after: Partial<Record<SectionName, object | undefined>>,
): string[] {
  const changes: string[] = [];
  for (const section of SECTION_NAMES) {
    const was = (before[section] ?? {}) as Record<string, unknown>;
    const is = (after[section] ?? {}) as Record<string, unknown>;
    const fields = [
      ...new Set([...Object.keys(was), ...Object.keys(is)]),
    ].toSorted((a, b) => a.localeCompare(b));
    for (const field of fields) {
      const isSame =
        JSON.stringify(canonical(was[field])) ===
        JSON.stringify(canonical(is[field]));
      if (!isSame) changes.push(`${section}.${field}`);
    }
  }
  return changes;
}

// --- Prices -------------------------------------------------------------------

/** ₹10,000 a kilo: far above any scrap price, so a typo can't slip through. */
export const MAX_PRICE_PAISE = 1_000_000;

export type PriceProblem =
  "INVALID_PRICE" | "FLOOR_ABOVE_FALLBACK" | "PRICE_TOO_HIGH";

function isWholePositive(value: number): boolean {
  return Number.isSafeInteger(value) && value > 0;
}

/**
 * A city's minimum (floor) and fallback price for one material, in paise per
 * kilo: whole paise, above zero, and the floor no higher than the fallback.
 */
export function priceProblem(
  floorPaise: number,
  fallbackPaise: number,
): PriceProblem | null {
  if (!isWholePositive(floorPaise) || !isWholePositive(fallbackPaise)) {
    return "INVALID_PRICE";
  }
  if (floorPaise > fallbackPaise) return "FLOOR_ABOVE_FALLBACK";
  return fallbackPaise > MAX_PRICE_PAISE ? "PRICE_TOO_HIGH" : null;
}
