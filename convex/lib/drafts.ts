import { v } from "convex/values";

import { vMaterialOrigin, vSiteType } from "./siteClassification";

/**
 * Convex validators for onboarding. Drafts are saved as people type, so every
 * form field is optional here; `applications.submit` checks completeness with
 * the schemas in ./onboarding.ts. The literal lists mirror the constants there
 * (a unit test keeps them in step).
 */

export const vApplicationKind = v.union(
  v.literal("kabadiwala"),
  v.literal("yard"),
  v.literal("recycler"),
  v.literal("manufacturer"),
  v.literal("saathi"),
);

export const vApplicationStatus = v.union(
  v.literal("draft"),
  v.literal("submitted"),
  v.literal("changes_requested"),
  v.literal("approved"),
  v.literal("rejected"),
  v.literal("suspended"),
);

export const vFileType = v.union(
  v.literal("pcb_certificate"),
  v.literal("machine_media"),
  v.literal("id_proof"),
  v.literal("selfie"),
);

export const vWeekday = v.union(
  v.literal("mon"),
  v.literal("tue"),
  v.literal("wed"),
  v.literal("thu"),
  v.literal("fri"),
  v.literal("sat"),
  v.literal("sun"),
);

export const vShopVehicle = v.union(
  v.literal("handcart"),
  v.literal("cycle"),
  v.literal("auto"),
  v.literal("mini_truck"),
);

export const vMaterialFamily = v.union(
  v.literal("paper"),
  v.literal("plastic"),
  v.literal("metal"),
  v.literal("glass"),
  v.literal("ewaste"),
);

export const vSaathiWork = v.union(
  v.literal("home_pickups"),
  v.literal("shop_help"),
  v.literal("yard_sorting"),
  v.literal("factory_shifts"),
);

export const vSaathiVehicle = v.union(
  v.literal("none"),
  v.literal("cycle"),
  v.literal("two_wheeler"),
  v.literal("auto"),
);

export const vSaathiTime = v.union(
  v.literal("morning"),
  v.literal("afternoon"),
  v.literal("evening"),
);

export const vRadius = v.union(v.literal(2), v.literal(5), v.literal(10));

export const vPcbBoard = v.union(v.literal("kspcb"), v.literal("other"));

const vLocation = v.object({ lat: v.number(), lng: v.number() });
const vExtraPhone = v.object({ number: v.string(), label: v.string() });

export const kabadiwalaDraft = v.object({
  ownerName: v.optional(v.string()),
  shopName: v.optional(v.string()),
  pan: v.optional(v.string()),
  gstRegistered: v.optional(v.boolean()),
  gstin: v.optional(v.string()),
  address: v.optional(v.string()),
  location: v.optional(vLocation),
  offersPickup: v.optional(v.boolean()),
  vehicle: v.optional(vShopVehicle),
  phones: v.optional(v.array(vExtraPhone)),
  opens: v.optional(v.string()),
  closes: v.optional(v.string()),
  weeklyOff: v.optional(v.array(vWeekday)),
});

export const businessDraft = v.object({
  businessName: v.optional(v.string()),
  /** Primary site and sources are declarations for admin review, not permits. */
  siteType: v.optional(vSiteType),
  materialOrigins: v.optional(v.array(vMaterialOrigin)),
  pan: v.optional(v.string()),
  gstRegistered: v.optional(v.boolean()),
  gstin: v.optional(v.string()),
  materials: v.optional(v.array(vMaterialFamily)),
  address: v.optional(v.string()),
  location: v.optional(vLocation),
  locationTags: v.optional(v.array(v.string())),
  collectsFromSuppliers: v.optional(v.boolean()),
  phones: v.optional(v.array(vExtraPhone)),
  opens: v.optional(v.string()),
  closes: v.optional(v.string()),
  weeklyOff: v.optional(v.array(vWeekday)),
});

export const documentsDraft = v.object({
  pcbNotRequired: v.optional(v.boolean()),
  notRequiredReason: v.optional(v.string()),
  board: v.optional(vPcbBoard),
  boardState: v.optional(v.string()),
  consentNumber: v.optional(v.string()),
  validUntil: v.optional(v.string()),
  declaration: v.optional(v.boolean()),
});

export const saathiDraft = v.object({
  name: v.optional(v.string()),
  area: v.optional(v.string()),
  location: v.optional(vLocation),
  radiusKm: v.optional(vRadius),
  workTypes: v.optional(v.array(vSaathiWork)),
  vehicle: v.optional(vSaathiVehicle),
  times: v.optional(v.array(vSaathiTime)),
  days: v.optional(v.array(vWeekday)),
});

/** The form sections an application can hold; which ones depends on `kind`. */
export const draftSections = {
  kabadiwala: v.optional(kabadiwalaDraft),
  business: v.optional(businessDraft),
  documents: v.optional(documentsDraft),
  saathi: v.optional(saathiDraft),
};
