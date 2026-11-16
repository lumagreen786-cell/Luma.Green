import { v } from "convex/values";

export const DWELLING_TYPES = [
  "independent_home",
  "apartment",
  "condo",
  "villa",
  "townhouse",
  "farmhouse",
] as const;

export type DwellingType = (typeof DWELLING_TYPES)[number];
const supportedTypes = new Set<unknown>(DWELLING_TYPES);

export function isDwellingType(value: unknown): value is DwellingType {
  return supportedTypes.has(value);
}

export const vDwellingType = v.union(
  v.literal("independent_home"),
  v.literal("apartment"),
  v.literal("condo"),
  v.literal("villa"),
  v.literal("townhouse"),
  v.literal("farmhouse"),
);
