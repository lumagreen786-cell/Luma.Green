import { v } from "convex/values";

import type { ApplicationKind } from "./onboarding";

/** Participant types describe what people do. They never grant permissions. */
export const PARTICIPANT_GROUPS = {
  generators: [
    "household",
    "small_business",
    "industrial_seller",
    "institution",
  ],
  collection: [
    "kabadiwala",
    "saathi",
    "dry_waste_centre",
    "large_yard",
    "collection_contractor",
    "rural_collector",
    "trader",
  ],
  processing: [
    "preprocessor",
    "recycler",
    "e_waste_operator",
    "wet_waste_processor",
    "intermediary_manufacturer",
    "end_goods_manufacturer",
  ],
  markets: ["epr_brand", "pro", "epr_trading", "carbon_trading"],
  services: [
    "transporter",
    "equipment_supplier",
    "boiler_water_supplier",
    "weighing_vendor",
    "solar_provider",
    "environmental_engineer",
    "hr_provider",
    "accounting_provider",
    "employee_tracking",
  ],
  partners: [
    "waste_picker_union",
    "city_official",
    "csr_lender_auditor",
    "luma_team",
    "ward_official",
    "community_champion",
    "payment_partner",
    "rewards_partner",
    "welfare_partner",
    "society_partner",
    "voice_partner",
  ],
} as const;

export type ParticipantType =
  (typeof PARTICIPANT_GROUPS)[keyof typeof PARTICIPANT_GROUPS][number];

export const PARTICIPANT_TYPES = Object.values(PARTICIPANT_GROUPS).flat();

export const vParticipantType = v.union(
  ...PARTICIPANT_TYPES.map((type) => v.literal(type)),
);

const participantTypeSet = new Set<string>(PARTICIPANT_TYPES);

export function isParticipantType(value: string): value is ParticipantType {
  return participantTypeSet.has(value);
}

export type ParticipantActivationPolicy =
  | { readonly kind: "household" }
  | { readonly kind: "generator" }
  | {
      readonly kind: "verified_application";
      readonly applicationKind: ApplicationKind;
    }
  | { readonly kind: "capability_review" }
  | { readonly kind: "provider_pending" }
  | { readonly kind: "invitation_required" };

/** Next steps only: review approval never grants workspace or regulated access. */
export const PARTICIPANT_ACTIVATION_POLICIES = {
  household: { kind: "household" },
  small_business: { kind: "generator" },
  industrial_seller: { kind: "generator" },
  institution: { kind: "generator" },
  kabadiwala: { kind: "verified_application", applicationKind: "kabadiwala" },
  saathi: { kind: "verified_application", applicationKind: "saathi" },
  dry_waste_centre: { kind: "capability_review" },
  large_yard: { kind: "verified_application", applicationKind: "yard" },
  collection_contractor: { kind: "capability_review" },
  rural_collector: { kind: "capability_review" },
  trader: { kind: "capability_review" },
  preprocessor: { kind: "verified_application", applicationKind: "yard" },
  recycler: { kind: "verified_application", applicationKind: "recycler" },
  e_waste_operator: { kind: "capability_review" },
  wet_waste_processor: { kind: "capability_review" },
  intermediary_manufacturer: {
    kind: "verified_application",
    applicationKind: "manufacturer",
  },
  end_goods_manufacturer: {
    kind: "verified_application",
    applicationKind: "manufacturer",
  },
  epr_brand: { kind: "capability_review" },
  pro: { kind: "capability_review" },
  epr_trading: { kind: "provider_pending" },
  carbon_trading: { kind: "provider_pending" },
  transporter: { kind: "capability_review" },
  equipment_supplier: { kind: "capability_review" },
  boiler_water_supplier: { kind: "capability_review" },
  weighing_vendor: { kind: "capability_review" },
  solar_provider: { kind: "capability_review" },
  environmental_engineer: { kind: "capability_review" },
  hr_provider: { kind: "capability_review" },
  accounting_provider: { kind: "capability_review" },
  employee_tracking: { kind: "capability_review" },
  waste_picker_union: { kind: "invitation_required" },
  city_official: { kind: "invitation_required" },
  csr_lender_auditor: { kind: "invitation_required" },
  luma_team: { kind: "invitation_required" },
  ward_official: { kind: "invitation_required" },
  community_champion: { kind: "invitation_required" },
  payment_partner: { kind: "invitation_required" },
  rewards_partner: { kind: "invitation_required" },
  welfare_partner: { kind: "invitation_required" },
  society_partner: { kind: "invitation_required" },
  voice_partner: { kind: "invitation_required" },
} as const satisfies Readonly<
  Record<ParticipantType, ParticipantActivationPolicy>
>;

export function getParticipantActivationPolicy(
  type: ParticipantType,
): ParticipantActivationPolicy {
  return PARTICIPANT_ACTIVATION_POLICIES[type];
}
