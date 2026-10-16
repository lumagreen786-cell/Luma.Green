import { v } from "convex/values";

import { vSaathiTime } from "./drafts";
import { vPaymentVerification } from "./gatewayPayments";
import { vMaterialOfferSpecification } from "./materialOfferSpecification";
import { vBookingStatus, vFamily, vOrgKind, vTradeStatus } from "./validators";

/** Result shapes shared by the query functions. */

export const vNames = v.record(v.string(), v.string());

export const vMaterialRef = v.object({
  code: v.string(),
  names: vNames,
  family: vFamily,
});

export const vOrgSummary = v.object({
  id: v.id("orgs"),
  kind: vOrgKind,
  name: v.string(),
  slug: v.string(),
  area: v.string(),
  city: v.string(),
  offersPickup: v.boolean(),
  gstin: v.optional(v.string()),
});

export const vReceipt = v.object({
  lines: v.array(
    v.object({
      material: vMaterialRef,
      grams: v.number(),
      paisePerKg: v.number(),
      paise: v.number(),
    }),
  ),
  totalPaise: v.number(),
  method: v.union(v.literal("cash"), v.literal("upi")),
  paidAt: v.number(),
});

export const vBookingView = v.object({
  id: v.id("bookings"),
  token: v.string(),
  name: v.optional(v.string()),
  /** Masked until the shop accepts; then the full number. */
  phone: v.string(),
  /** Only the area until the shop accepts; then the full address. */
  address: v.optional(v.string()),
  mode: v.union(v.literal("pickup"), v.literal("dropoff")),
  items: v.array(v.object({ material: vMaterialRef, estKg: v.number() })),
  estimatePaise: v.optional(v.number()),
  slotDate: v.string(),
  slotWindow: vSaathiTime,
  status: vBookingStatus,
  receipt: v.optional(vReceipt),
  createdAt: v.number(),
});

export const vTradeAction = v.union(
  v.literal("accept"),
  v.literal("decline"),
  v.literal("pay"),
  v.literal("dispatch"),
  v.literal("confirm"),
);

export const vTradeView = v.object({
  specification: v.optional(vMaterialOfferSpecification),
  id: v.id("trades"),
  material: vMaterialRef,
  grams: v.number(),
  paisePerKg: v.number(),
  totalPaise: v.number(),
  status: vTradeStatus,
  timeline: v.array(v.object({ status: vTradeStatus, at: v.number() })),
  counterparty: v.object({
    name: v.string(),
    area: v.string(),
    kind: vOrgKind,
  }),
  invoiceNo: v.optional(v.string()),
  /** Old internal receipt number; it is not a verified GST invoice. */
  legacyReceiptNo: v.optional(v.string()),
  paymentVerification: vPaymentVerification,
  needsEwayBill: v.boolean(),
  inEscrow: v.boolean(),
  actions: v.array(vTradeAction),
  createdAt: v.number(),
});

export const vListingView = v.object({
  specification: v.optional(vMaterialOfferSpecification),
  id: v.id("listings"),
  origin: v.optional(v.literal("manufacturer_byproduct")),
  seller: v.object({ name: v.string(), area: v.string(), kind: vOrgKind }),
  material: vMaterialRef,
  grams: v.number(),
  askPaisePerKg: v.number(),
  note: v.optional(v.string()),
  status: v.union(v.literal("open"), v.literal("sold"), v.literal("withdrawn")),
  isMine: v.boolean(),
  createdAt: v.number(),
});
