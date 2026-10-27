import type { FunctionReturnType } from "convex/server";

import type { TrackedBooking } from "@/components/track/types";

import type { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { CATALOGUE } from "../../convex/lib/catalogue";
import { NOW, trackedBooking } from "./fixtures";

const paper = CATALOGUE.find((row) => row.code === "PAPER-NEWS");
if (!paper) throw new Error("Missing fixture material.");

/** These values explain the current UI. They are not stored or provider evidence. */
export const receiptExample = {
  ...trackedBooking,
  status: "completed",
  canCancel: false,
  timeline: [...trackedBooking.timeline, { status: "completed", at: NOW }],
  receipt: {
    lines: [
      {
        material: {
          code: paper.code,
          family: paper.family,
          names: paper.names,
        },
        grams: 5000,
        paisePerKg: 1400,
        paise: 7000,
      },
    ],
    totalPaise: 7000,
    method: "cash",
    paidAt: NOW,
  },
} satisfies TrackedBooking;

const services = {
  orgId: null,
  canCreate: true,
  enquiries: [
    {
      id: "guide-service" as Id<"serviceEnquiries">,
      commercialModel: "paid_collection",
      paymentDirection: "generator_to_handler",
      principalParty: "",
      kind: "wet_service",
      title: "Example wet-waste collection enquiry",
      details:
        "A made-up request to discuss a separate wet-waste collection service.",
      state: "enquiry",
      version: 1,
      canEdit: true,
      providerStatus: "unavailable",
    },
  ],
  received: [],
  programmes: [],
  reports: [],
  recipients: [],
  lots: [],
} satisfies FunctionReturnType<typeof api.services.board>;

export const foundationFixtures: Record<string, unknown> = {
  "services:board": services,
  // No material is presented as classified or approved for intake in this example.
  "stockIntake:materials": [],
  "householdReceipts:sharing": [],
  "householdReceipts:history": [],
  "collectionScheduling:availability": [
    { window: "morning", remaining: 20 },
    { window: "afternoon", remaining: 20 },
    { window: "evening", remaining: 20 },
  ],
  "collectionScheduling:settings": {
    capacityPerWindow: 20,
    holidayDates: [],
    enabledWindows: ["morning", "afternoon", "evening"],
    canManage: true,
  },
  "collectionScheduling:myRequests": [],
  "collectionScheduling:schedules": [],
  "collectionScheduling:operatorRequests": [],
  "workforce:board": { jobs: [], workers: [] },
  "returns:options": [],
  "returns:mine": { rows: [], hasMore: false },
  "schemeClaims:mine": { rows: [], hasMore: false },
  "adminCollections:board": {
    bookings: [{ id: "guide-booking", label: "2026-10-14 · afternoon · 0000" }],
    shops: [
      { id: "guide-shop", label: "Example neighbourhood shop · Sample area" },
    ],
  },
  "operationalCatalogue:adminList": [],
  "complianceReview:queue": { facilities: [], truncated: false },
  "complianceReview:destinations": [],
  "stockClosing:board": {
    orgId: "guide-org",
    canOperate: true,
    canAdjust: true,
    materials: [{ code: paper.code, family: paper.family, names: paper.names }],
    latest: null,
    settings: [],
    alerts: [],
    adjustments: [],
  },
};
