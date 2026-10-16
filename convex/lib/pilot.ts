import type { Doc } from "../_generated/dataModel";
import { type BookingStatus, kgToGrams } from "./chain";

/** Aggregate only the selected booking cohort. Keep stored amounts in integers. */
export function bookingMetrics(bookings: readonly Doc<"bookings">[]) {
  const outcomes: Record<BookingStatus, number> = {
    requested: 0,
    accepted: 0,
    on_the_way: 0,
    completed: 0,
    declined: 0,
    cancelled: 0,
  };
  const materials = new Map<
    string,
    { code: string; estimatedGrams: number; weighedGrams: number }
  >();
  let acceptedCount = 0;
  let acceptMs = 0;
  let reassignedCount = 0;
  let completedWithReceipt = 0;
  let paidPaise = 0;
  let estimatedPaise = 0;
  let weighedGrams = 0;
  function material(code: string) {
    let row = materials.get(code);
    if (!row) {
      row = { code, estimatedGrams: 0, weighedGrams: 0 };
      materials.set(code, row);
    }
    return row;
  }
  for (const booking of bookings) {
    outcomes[booking.status] += 1;
    const accepted = booking.timeline.find(
      (step) => step.status === "accepted",
    );
    if (accepted && accepted.at >= booking.createdAt) {
      acceptedCount += 1;
      acceptMs += accepted.at - booking.createdAt;
    }
    if ((booking.dispatch?.attempt ?? 1) > 1) reassignedCount += 1;
    if (booking.status !== "completed" || !booking.receipt) continue;
    completedWithReceipt += 1;
    paidPaise += booking.receipt.totalPaise;
    if (booking.estimatePaise !== undefined)
      estimatedPaise += booking.estimatePaise;
    for (const item of booking.items)
      material(item.materialCode).estimatedGrams += kgToGrams(item.estKg);
    for (const line of booking.receipt.lines) {
      material(line.materialCode).weighedGrams += line.grams;
      weighedGrams += line.grams;
    }
  }
  return {
    count: bookings.length,
    outcomes,
    acceptedCount,
    averageAcceptMs: acceptedCount === 0 ? null : acceptMs / acceptedCount,
    reassignedCount,
    completedWithReceipt,
    paidPaise,
    estimatedPaise,
    weighedGrams,
    materials: [...materials.values()].toSorted((a, b) =>
      a.code.localeCompare(b.code),
    ),
  };
}

/** Each application's latest submission, not every historical review round. */
export function applicationMetrics(
  applications: readonly Doc<"applications">[],
) {
  let decidedCount = 0;
  let decisionMs = 0;
  for (const application of applications) {
    if (
      application.submittedAt === undefined ||
      application.decidedAt === undefined ||
      application.decidedAt < application.submittedAt
    )
      continue;
    decidedCount += 1;
    decisionMs += application.decidedAt - application.submittedAt;
  }
  return {
    count: applications.length,
    decidedCount,
    awaitingDecisionCount: applications.filter(
      (row) => row.status === "submitted",
    ).length,
    averageDecisionMs: decidedCount === 0 ? null : decisionMs / decidedCount,
  };
}
