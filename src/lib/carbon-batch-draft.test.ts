import { describe, expect, it } from "vitest";

import { carbonBatchDraft } from "./carbon-batch-draft";

const record = {
  orgId: "workspace-1",
  transformationId: "transformation-1",
  recordedAt: 100,
  facilityId: undefined,
  processKind: undefined,
  primaryInputLotId: "legacy-input",
  inputDetail: "legacy_primary_only" as const,
  inputGrams: 1001,
  contaminationGrams: 0,
  processLossGrams: 1,
  inputs: [],
  outputs: [
    { grams: 1000, lotId: "lot-1", materialCode: "PRIVATE", state: "PRIVATE" },
  ],
};

describe("carbon batch draft", () => {
  it("preserves recorded weights and legacy gaps without exporting operator text", () => {
    const draft = carbonBatchDraft(record, "workspace-1");
    expect(draft).toMatchObject({
      purpose: "internal_carbon_evidence_draft",
      verificationStatus: "recorded_unverified",
      inputDetail: "legacy_primary_only",
      primaryInputLotId: "legacy-input",
      inputGrams: 1001,
      outputs: [{ lotId: "lot-1", grams: 1000 }],
    });
    expect(JSON.stringify(draft)).not.toContain("PRIVATE");
  });

  it("rejects a stale or different workspace", () => {
    expect(() => carbonBatchDraft(record, "workspace-2")).toThrow(
      "EVIDENCE_SCOPE_CHANGED",
    );
  });
});
