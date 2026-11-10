import { v } from "convex/values";

import type { SiteType } from "./siteClassification";

/** Stakeholders are not trading organisations and have no operational grants. */
export const STAKEHOLDER_KINDS = [
  "material_generator",
  "city_official",
  "csr_sponsor",
  "lender",
  "independent_auditor",
  "waste_picker_union",
  "apparel_brand",
  "packaging_brand",
] as const;

export type StakeholderKind =
  (typeof STAKEHOLDER_KINDS)[number] | "participant_applicant";

export const vStakeholderKind = v.union(
  v.literal("participant_applicant"),
  v.literal("material_generator"),
  v.literal("city_official"),
  v.literal("csr_sponsor"),
  v.literal("lender"),
  v.literal("independent_auditor"),
  v.literal("waste_picker_union"),
  v.literal("apparel_brand"),
  v.literal("packaging_brand"),
);

export const GENERATOR_SITE_TYPES = [
  "apartment_community",
  "office",
  "hotel",
  "resort",
  "other",
] as const satisfies readonly SiteType[];

export function isGeneratorSiteType(value: SiteType | undefined): boolean {
  return (
    value !== undefined &&
    (GENERATOR_SITE_TYPES as readonly SiteType[]).includes(value)
  );
}

export const vStakeholderStatus = v.union(
  v.literal("pending"),
  v.literal("approved"),
  v.literal("rejected"),
);

/** Names are self-declared until an admin verifies the request. */
export function organizationNameOrNull(value: string): string | null {
  const name = value.trim();
  return name.length < 2 || name.length > 120 || /\p{Cc}/u.test(name)
    ? null
    : name;
}
