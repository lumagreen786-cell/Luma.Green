import { defineTable } from "convex/server";
import { v } from "convex/values";

export const vHandoverReceiptLine = v.object({
  materialCode: v.string(),
  grams: v.number(),
});
export const workerHandoverTables = {
  workerHandovers: defineTable({
    orgId: v.id("orgs"),
    jobId: v.id("jobs"),
    bookingId: v.id("bookings"),
    saathiProfileId: v.id("saathiProfiles"),
    workerProfileId: v.id("profiles"),
    operationKey: v.string(),
    boundByProfileId: v.id("profiles"),
    createdAt: v.number(),
    collectedGrams: v.optional(v.number()),
    workerOperationKey: v.optional(v.string()),
    evidenceReference: v.optional(v.string()),
    collectedByProfileId: v.optional(v.id("profiles")),
    collectedAt: v.optional(v.number()),
    receivedGrams: v.optional(v.number()),
    varianceGrams: v.optional(v.number()),
    varianceReason: v.optional(v.string()),
    receivedLines: v.optional(v.array(vHandoverReceiptLine)),
    receiptFingerprint: v.optional(v.string()),
    employerOperationKey: v.optional(v.string()),
    acknowledgedByProfileId: v.optional(v.id("profiles")),
    acknowledgedAt: v.optional(v.number()),
    revokedAt: v.optional(v.number()),
    revokedByProfileId: v.optional(v.id("profiles")),
    revocationReason: v.optional(v.string()),
  })
    .index("by_org_created", ["orgId", "createdAt"])
    .index("by_worker_created", ["saathiProfileId", "createdAt"])
    .index("by_worker_pending", [
      "saathiProfileId",
      "acknowledgedAt",
      "revokedAt",
    ])
    .index("by_org_operation", ["orgId", "operationKey"])
    .index("by_job", ["jobId"])
    .index("by_booking", ["bookingId"]),
};
