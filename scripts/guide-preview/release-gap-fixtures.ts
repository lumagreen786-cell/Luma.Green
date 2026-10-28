import type { FunctionReturnType } from "convex/server";

import type { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { NOW } from "./fixtures";

type EmployerBoard = FunctionReturnType<
  typeof api.workerHandovers.employerBoard
>;
const employerRow = {
  id: "guide-handover" as Id<"workerHandovers">,
  jobId: "guide-handover-job" as Id<"jobs">,
  bookingId: "guide-handover-booking" as Id<"bookings">,
  jobTitle: "Example pickup handover",
  jobDate: "2026-10-14",
  bookingReference: "2026-10-14 · afternoon · 0000",
  employerName: "Example neighbourhood shop",
  collectedGrams: 1001,
  receivedGrams: 1000,
  varianceGrams: -1,
  evidenceReference: "EXAMPLE-WEIGHING-NOTE",
  varianceReason: null,
  boundByProfileId: "guide-employer" as Id<"profiles">,
  workerProfileId: "guide-worker" as Id<"profiles">,
  collectedByProfileId: "guide-worker" as Id<"profiles">,
  acknowledgedByProfileId: null,
  collectedAt: NOW - 3_600_000,
  acknowledgedAt: null,
  revoked: false,
  canCollect: false,
  canAcknowledge: true,
  canRevoke: true,
} satisfies EmployerBoard["rows"][number];

const employer = {
  canOperate: true,
  rows: [employerRow],
  jobs: [],
  bookings: [],
} satisfies EmployerBoard;
const worker = [
  {
    ...employerRow,
    collectedGrams: null,
    receivedGrams: null,
    varianceGrams: null,
    evidenceReference: null,
    collectedByProfileId: null,
    collectedAt: null,
    canCollect: true,
    canAcknowledge: false,
    canRevoke: false,
  },
] satisfies FunctionReturnType<typeof api.workerHandovers.workerBoard>;
const removals = [
  {
    id: "guide-retained-review" as Id<"accountRemovals">,
    state: "restricted_review",
    createdAt: NOW - 3_600_000,
    lastError: undefined,
  },
] satisfies FunctionReturnType<typeof api.accountRemoval.reviewQueue>;

export const releaseGapFixtures: Record<string, unknown> = {
  "workerHandovers:employerBoard": employer,
  "workerHandovers:workerBoard": worker,
  "accountRemoval:reviewQueue": removals,
};

export function removalStatusFixture(
  search: string,
): FunctionReturnType<typeof api.accountRemoval.status> {
  const scenario = new URLSearchParams(search).get("removal");
  return {
    recentAuth: scenario !== "reauth",
    heldReasons:
      scenario === "held" ? ["business_owner", "active_collection"] : [],
    state: "open",
  };
}
