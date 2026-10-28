/**
 * The rules for a household selling scrap — docs/product/household.md.
 *
 * One set of rules for both sides: the /sell screens use them to guide the
 * household, and convex/households.ts runs them again before anything is
 * written. Pure functions only, so they're safe in the browser.
 */

import { type BookingStatus, kgToGrams, paiseFor } from "./chain";
import { shiftDate } from "./dates";

/** The pilot city: every shop a household sees is here. */
export const PILOT_CITY = "Bengaluru";

/** At most this many different materials in one booking. */
export const BASKET_MAX_ITEMS = 20;
/** The most one material can weigh in one booking, in kg. */
export const ITEM_MAX_KG = 500;
/** A booking can be for today or up to this many days ahead. */
export const SLOT_DAYS_AHEAD = 6;
/** How many bookings a household can have waiting at once. */
export const MAX_OPEN_BOOKINGS = 5;

export const NAME_LENGTH = { min: 2, max: 60 } as const;
export const ADDRESS_LENGTH = { min: 10, max: 300 } as const;

export const SLOT_WINDOWS = ["morning", "afternoon", "evening"] as const;
export type SlotWindow = (typeof SLOT_WINDOWS)[number];

/** Each window's hours, India time: from the first to the second. */
export const SLOT_WINDOW_HOURS: Record<SlotWindow, readonly [number, number]> =
  {
    morning: [9, 11],
    afternoon: [12, 14],
    evening: [16, 18],
  };

export interface BasketItem {
  materialCode: string;
  kg: number;
}

export interface Point {
  lat: number;
  lng: number;
}

// --- Basket ------------------------------------------------------------------

export function isValidKg(kg: number): boolean {
  return (
    Number.isFinite(kg) && kg > 0 && kg <= ITEM_MAX_KG && kgToGrams(kg) >= 1
  );
}

export type BasketError =
  "EMPTY_BASKET" | "TOO_MANY_ITEMS" | "DUPLICATE_ITEM" | "INVALID_KG";

/** What's wrong with a basket, or null when it can be priced and booked. */
export function basketError(
  items: readonly BasketItem[],
  { allowEmpty = false }: { allowEmpty?: boolean } = {},
): BasketError | null {
  if (items.length === 0) return allowEmpty ? null : "EMPTY_BASKET";
  if (items.length > BASKET_MAX_ITEMS) return "TOO_MANY_ITEMS";
  const codes = new Set(items.map((item) => item.materialCode));
  if (codes.size !== items.length) return "DUPLICATE_ITEM";
  return items.every((item) => isValidKg(item.kg)) ? null : "INVALID_KG";
}

/**
 * What a basket is worth, in paise, at a price per kg for each material. A
 * material without a price counts as nothing rather than a guess.
 */
export function basketPaise(
  items: readonly BasketItem[],
  priceOf: (materialCode: string) => number | undefined,
): number {
  return items.reduce(
    (sum, item) =>
      sum + paiseFor(kgToGrams(item.kg), priceOf(item.materialCode) ?? 0),
    0,
  );
}

// --- When ----------------------------------------------------------------------

const DATE = /^\d{4}-\d{2}-\d{2}$/;

function isRealDate(date: string): boolean {
  return (
    DATE.test(date) &&
    !Number.isNaN(Date.parse(`${date}T00:00:00Z`)) &&
    new Date(`${date}T00:00:00Z`).toISOString().startsWith(date)
  );
}

/** Every day a booking can be made for, today first. */
export function bookableDates(today: string): string[] {
  return Array.from({ length: SLOT_DAYS_AHEAD + 1 }, (_, day) =>
    shiftDate(today, day),
  );
}

export function isBookableDate(date: string, today: string): boolean {
  return (
    isRealDate(date) &&
    date >= today &&
    date <= shiftDate(today, SLOT_DAYS_AHEAD)
  );
}

const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

/** Minutes since midnight, India time. */
function indiaMinutes(now: number): number {
  const date = new Date(now + IST_OFFSET_MS);
  return date.getUTCHours() * 60 + date.getUTCMinutes();
}

/**
 * Whether a window can still be booked: any window on a later day, and a
 * window today only while there's at least an hour of it left.
 */
export function isWindowOpen(
  date: string,
  window: SlotWindow,
  today: string,
  now: number,
): boolean {
  if (date !== today) return date > today;
  const [, endHour] = SLOT_WINDOW_HOURS[window];
  return indiaMinutes(now) < (endHour - 1) * 60;
}

// --- Words people type ------------------------------------------------------------

/** Trims and collapses runs of spaces and line breaks. */
export function cleanText(text: string): string {
  return text.trim().replaceAll(/\s+/g, " ");
}

function withoutTrailingCommas(text: string): string {
  let end = text.length;
  while (end > 0 && text[end - 1] === ",") end -= 1;
  return text.slice(0, end).trimEnd();
}

/** An address on one line: each line typed becomes a comma-separated part. */
export function cleanAddress(address: string): string {
  return address
    .split(/[\n\r]+/)
    .map((line) => withoutTrailingCommas(cleanText(line)))
    .filter((line) => line.length > 0)
    .join(", ");
}

export function isValidName(name: string): boolean {
  const clean = cleanText(name);
  return clean.length >= NAME_LENGTH.min && clean.length <= NAME_LENGTH.max;
}

export function isValidAddress(address: string): boolean {
  const clean = cleanAddress(address);
  return (
    clean.length >= ADDRESS_LENGTH.min && clean.length <= ADDRESS_LENGTH.max
  );
}

// --- Where ----------------------------------------------------------------------------

export function isValidPoint(point: Point): boolean {
  return (
    Number.isFinite(point.lat) &&
    Number.isFinite(point.lng) &&
    Math.abs(point.lat) <= 90 &&
    Math.abs(point.lng) <= 180
  );
}

const EARTH_RADIUS_KM = 6371;

/** Straight-line distance between two points (haversine), to 0.1 km. */
export function distanceKm(from: Point, to: Point): number {
  const radians = (degrees: number) => (degrees * Math.PI) / 180;
  const dLat = radians(to.lat - from.lat);
  const dLng = radians(to.lng - from.lng);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(radians(from.lat)) *
      Math.cos(radians(to.lat)) *
      Math.sin(dLng / 2) ** 2;
  const km = 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(a)));
  return Math.round(km * 10) / 10;
}

// --- After booking ------------------------------------------------------------------

/** Cancelling is free until the kabadiwala is on the way. */
export function canHouseholdCancel(status: BookingStatus): boolean {
  return status === "requested" || status === "accepted";
}

export const OPEN_BOOKING_STATUSES: readonly BookingStatus[] = [
  "requested",
  "accepted",
  "on_the_way",
];

/** Still waiting to happen: counts towards MAX_OPEN_BOOKINGS. */
export function isOpenBooking(status: BookingStatus): boolean {
  return OPEN_BOOKING_STATUSES.includes(status);
}
