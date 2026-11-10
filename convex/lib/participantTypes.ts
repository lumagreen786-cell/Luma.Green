import { v } from "convex/values";

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
