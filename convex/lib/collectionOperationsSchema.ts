import { defineTable } from "convex/server";
import { v } from "convex/values";

import { vSaathiTime } from "./drafts";

export const vSupportSource = v.union(
  v.object({ kind: v.literal("serviceEnquiry"), id: v.id("serviceEnquiries") }),
  v.object({ kind: v.literal("programme"), id: v.id("programmeRecords") }),
  v.object({ kind: v.literal("materialLot"), id: v.id("materialLots") }),
  v.object({ kind: v.literal("inspection"), id: v.id("lotInspections") }),
  v.object({ kind: v.literal("materialDemand"), id: v.id("materialDemands") }),
  v.object({ kind: v.literal("booking"), id: v.id("bookings") }),
  v.object({ kind: v.literal("trade"), id: v.id("trades") }),
  v.object({ kind: v.literal("job"), id: v.id("jobs") }),
  v.object({ kind: v.literal("application"), id: v.id("applications") }),
);
export const vSupportTeam = v.union(
  v.literal("operations"),
  v.literal("accounts"),
  v.literal("reviewer"),
);
export const collectionOperationsTables = {
  supportUpdates: defineTable({
    requestId: v.id("supportRequests"),
    actorProfileId: v.optional(v.id("profiles")),
    message: v.string(),
    urgent: v.boolean(),
    team: vSupportTeam,
    createdAt: v.number(),
  })
    .index("by_request_created", ["requestId", "createdAt"])
    .index("by_request_message_urgent_team", [
      "requestId",
      "message",
      "urgent",
      "team",
    ]),
  collectionAvailability: defineTable({
    orgId: v.id("orgs"),
    capacityPerWindow: v.number(),
    holidayDates: v.array(v.string()),
    enabledWindows: v.array(vSaathiTime),
    updatedAt: v.number(),
  }).index("by_org", ["orgId"]),
  recurringCollections: defineTable({
    bookingId: v.id("bookings"),
    householdProfileId: v.id("profiles"),
    everyDays: v.number(),
    nextDate: v.string(),
    active: v.boolean(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_active_nextDate", ["active", "nextDate"])
    .index("by_household", ["householdProfileId"]),
};
