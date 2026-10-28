import { v } from "convex/values";

export const vRecordedCost = v.union(v.number(), v.null());
export const lotCostFields = {
  isAcquisitionCostRecordable: v.optional(v.boolean()),
  costBasisGrams: v.optional(v.number()),
  initialCostPaise: v.optional(vRecordedCost),
  costPaise: v.optional(vRecordedCost),
  costReference: v.optional(v.string()),
};
export const transformationCostFields = {
  processingCostPaise: v.optional(vRecordedCost),
  consumedInputCostPaise: v.optional(vRecordedCost),
  totalOutputCostPaise: v.optional(vRecordedCost),
  costReference: v.optional(v.string()),
  operationReference: v.optional(v.string()),
  requestFingerprint: v.optional(v.string()),
};
export const transformationInputCostFields = {
  consumedCostPaise: v.optional(vRecordedCost),
};

export const intakeCostFields = {
  recordedCostPaise: v.optional(vRecordedCost),
  costReference: v.optional(v.string()),
};
