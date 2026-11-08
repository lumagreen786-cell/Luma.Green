import type { FunctionReturnType } from "convex/server";

import type { api } from "../../convex/_generated/api";

type Batch = Omit<
  FunctionReturnType<typeof api.traceability.carbonBatchPreparation>,
  "schemaVersion" | "purpose" | "verificationStatus" | "primaryInputLotId"
>;

/** An internal preparation file. Keep operator labels out of the download. */
export function carbonBatchDraft(
  batch: Pick<
    Batch,
    | "recordedAt"
    | "inputDetail"
    | "inputGrams"
    | "contaminationGrams"
    | "processLossGrams"
    | "processKind"
    | "facilityId"
  > & {
    orgId: string;
    transformationId: string;
    primaryInputLotId: string;
    inputs: readonly { lotId: string; grams: number }[];
    outputs: readonly { lotId: string; grams: number }[];
  },
  expectedOrgId: string,
) {
  if (batch.orgId !== expectedOrgId) throw new Error("EVIDENCE_SCOPE_CHANGED");
  return {
    schemaVersion: 1,
    purpose: "internal_carbon_evidence_draft",
    verificationStatus: "recorded_unverified",
    workspaceId: batch.orgId,
    transformationId: batch.transformationId,
    recordedAt: batch.recordedAt,
    facilityId: batch.facilityId,
    processKind: batch.processKind,
    inputDetail: batch.inputDetail,
    primaryInputLotId: batch.primaryInputLotId,
    inputGrams: batch.inputGrams,
    contaminationGrams: batch.contaminationGrams,
    processLossGrams: batch.processLossGrams,
    inputs: batch.inputs.map(({ lotId, grams }) => ({ lotId, grams })),
    outputs: batch.outputs.map(({ lotId, grams }) => ({ lotId, grams })),
  };
}
