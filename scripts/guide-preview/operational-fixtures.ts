import type { FunctionReturnType } from "convex/server";

import type { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { NOW } from "./fixtures";

// Synthetic presentation records only. No permission, provider, or file evidence.
const orgId = "guide-operations-org" as Id<"orgs">;
const inspectionId = "guide-operations-inspection" as Id<"lotInspections">;
const reportId = "guide-operations-report" as Id<"auditReports">;
const file = {
  id: "guide-operations-file" as Id<"qualityAttachments">,
  inspectionId,
  name: "synthetic-quality-example.pdf",
  kind: "coa" as const,
  contentType: "application/pdf",
  size: 1024,
  sha256: "0".repeat(64),
  createdAt: NOW,
  sharedWithBuyer: false,
  withdrawnAt: undefined,
};
export const heldLotsFixture = {
  rows: [
    {
      id: "guide-operations-lot" as Id<"materialLots">,
      materialCode: "PLASTIC-PET",
      state: "sorted",
      streamClass: "unspecified",
      handlingClass: "unassessed",
      sourceKind: "self_declared",
      initialGrams: 125_000,
      availableGrams: 125_000,
      initialCostPaise: null,
      costPaise: null,
      status: "available",
      createdAt: NOW,
    },
  ],
  hasMore: false,
} satisfies FunctionReturnType<typeof api.traceability.mine>;
export const incomingLotsFixture = {
  rows: [],
  hasMore: false,
} satisfies FunctionReturnType<typeof api.traceability.incoming>;
export const sentLotsFixture = {
  rows: [],
  hasMore: false,
} satisfies FunctionReturnType<typeof api.traceability.sent>;
export const qualityFixture = {
  orgId,
  canOperate: true,
  canWithdraw: true,
  inspections: [
    {
      id: inspectionId,
      label: "Synthetic PET inspection",
      buyerName: undefined,
    },
  ],
  own: [file],
  incoming: [],
  decisions: [],
} satisfies FunctionReturnType<typeof api.qualityFiles.board>;
export const reportsFixture = {
  canCreate: true,
  orgId,
  own: [],
  received: [
    {
      id: reportId,
      purpose: "Synthetic quality review",
      createdAt: NOW,
      expiresAt: NOW + 86_400_000,
      revokedAt: undefined,
    },
  ],
  recipients: [
    {
      id: "guide-operations-recipient" as Id<"stakeholderAccounts">,
      name: "Synthetic reviewer",
    },
  ],
  inspections: [{ id: inspectionId, label: "Synthetic PET inspection" }],
  files: [{ id: file.id, inspectionId, name: file.name }],
} satisfies FunctionReturnType<typeof api.auditShares.board>;
export const reportFixture = {
  purpose: "Synthetic quality review",
  expiresAt: NOW + 86_400_000,
  snapshot: {
    materialCode: "PLASTIC-PET",
    state: "sorted",
    declaredGrams: 125_000,
    specificationReference: "SYNTHETIC-PET",
    specificationVersion: "1",
    sampleMethod: "Synthetic illustration",
    results: [{ parameter: "Moisture", unit: "%", value: "2" }],
    inspectingDecision: "conditional",
    buyerDecisions: [],
    inspectionCreatedAt: NOW,
  },
  files: [
    { id: file.id, name: file.name, sha256: file.sha256, available: false },
  ],
} satisfies FunctionReturnType<typeof api.auditShares.read>;
const plan = {
  _id: "guide-operations-route" as Id<"routePlans">,
  _creationTime: NOW,
  orgId,
  reference: "SYNTHETIC-ROUTE",
  title: "Synthetic collection route",
  status: "active" as const,
  revision: 1,
  createdAt: NOW,
  updatedAt: NOW,
};
const version = {
  _id: "guide-operations-route-version" as Id<"routePlanVersions">,
  _creationTime: NOW,
  planId: plan._id,
  orgId,
  revision: 1,
  title: plan.title,
  vehicleReference: "SYNTHETIC-VEHICLE",
  capacityGrams: 500_000,
  origin: { siteReference: "Synthetic origin", latitude: 13, longitude: 77.5 },
  stops: [
    {
      siteReference: "Synthetic collection point",
      latitude: 13.01,
      longitude: 77.51,
      materialId: "guide-operations-material" as Id<"materials">,
      grams: 125_000,
    },
  ],
  ordering: "entered" as const,
  orderIndices: [0],
  materialCodes: ["PLASTIC-PET"],
  totalGrams: 125_000,
  straightLineMeters: 1552,
  reason: "Synthetic layout example",
  actorProfileId: "guide-operations-actor" as Id<"profiles">,
  createdAt: NOW,
};
export const routesFixture = {
  page: [plan],
  isDone: true,
  continueCursor: "",
} satisfies FunctionReturnType<typeof api.routePlans.mine>;
export const routeFixture = {
  plan,
  latest: version,
} satisfies FunctionReturnType<typeof api.routePlans.detail>;
export const routeHistoryFixture = {
  page: [version],
  isDone: true,
  continueCursor: "",
} satisfies FunctionReturnType<typeof api.routePlans.history>;
const carbonInput = "guide-operations-lot" as Id<"materialLots">;
const carbonOutput = "guide-carbon-output" as Id<"materialLots">;
const carbonTransform = "guide-carbon-transform" as Id<"lotTransformations">;
const carbonHistory = {
  access: "holder",
  lot: {
    id: carbonInput,
    materialCode: "PLASTIC-PET",
    state: "Sorted",
    availableGrams: 0,
    initialGrams: 125_000,
    status: "exhausted",
    streamClass: "unspecified",
    handlingClass: "unassessed",
    qualityReleased: false,
    canRecordAcquisitionCost: false,
  },
  custody: [],
  hasMoreCustody: false,
  transformations: [
    {
      id: carbonTransform,
      createdAt: NOW,
      inputGrams: 125_000,
      contaminationGrams: 1000,
      processLossGrams: 2000,
      processingCostPaise: null,
      consumedInputCostPaise: null,
      totalOutputCostPaise: null,
      inputs: [
        {
          id: carbonInput,
          grams: 125_000,
          canOpen: false,
          materialCode: "PLASTIC-PET",
          state: "Sorted",
        },
      ],
      outputs: [
        {
          id: carbonOutput,
          grams: 122_000,
          canOpen: false,
          materialCode: "RECYCLED-PET-FLAKE",
          state: "Washed",
          streamClass: "unspecified",
          handlingClass: "unassessed",
        },
      ],
    },
  ],
  hasMoreTransformations: false,
  dispositions: [],
  hasMoreDispositions: false,
};

export const operationalFixtures: Record<string, unknown> = {
  "industrialProfiles:mine": [
    { _id: "guide-facility", name: "Example recovery facility" },
  ],
  "carbonProjects:mine": {
    rows: [
      {
        id: "guide-carbon-project",
        facilityId: "guide-facility",
        facilityName: "Example recovery facility",
        name: "PET recovery pilot",
        method: "verra_vmr0007",
        industry: "pet_plastics",
        status: "draft",
        revision: 2,
        updatedAt: NOW,
        evidenceStatus: "reported_unverified",
        evidence: [
          {
            kind: "baseline",
            reference: "Example baseline record",
            recordedAt: NOW,
          },
        ],
      },
    ],
    hasMore: false,
  },
  "carbonProjects:frameworkScreenings": [
    {
      framework: "verra",
      revision: 2,
      checks: [
        {
          gate: "municipal_waste_origin",
          status: "supported",
          reference: "Example municipal source record",
        },
        {
          gate: "collection_scope",
          status: "contradicted",
          reference: "Example collection scope finding",
        },
      ],
    },
  ],
  "carbonProjects:frameworkHistory": {
    historyComplete: true,
    changes: [
      {
        gate: "collection_scope",
        status: "contradicted",
        reference: "Example collection scope finding",
        recordedAt: NOW,
        revision: 2,
      },
      {
        gate: "municipal_waste_origin",
        status: "supported",
        reference: "Example municipal source record",
        recordedAt: NOW,
        revision: 1,
      },
    ],
  },
  "carbonProjects:batches": {
    rows: [
      {
        transformationId: carbonTransform,
        inputGrams: 125_000,
        recordedAt: NOW,
      },
    ],
    hasMore: false,
  },
  "carbonProjects:batchOptions": { rows: [], hasMore: false },
  "traceability:mine": heldLotsFixture,
  "traceability:history": carbonHistory,
  "quality:forLot": { rows: [], hasMore: false },
  "traceability:carbonBatchPreparation": {
    schemaVersion: 1,
    purpose: "carbon_evidence_preparation",
    verificationStatus: "recorded_unverified",
    orgId: "guide-org",
    transformationId: carbonTransform,
    recordedAt: NOW,
    primaryInputLotId: carbonInput,
    inputDetail: "recorded_lot_edges",
    inputGrams: 125_000,
    contaminationGrams: 1000,
    processLossGrams: 2000,
    inputs: [
      {
        lotId: carbonInput,
        materialCode: "PLASTIC-PET",
        state: "Sorted",
        grams: 125_000,
      },
    ],
    outputs: [
      {
        lotId: carbonOutput,
        materialCode: "RECYCLED-PET-FLAKE",
        state: "Washed",
        grams: 122_000,
      },
    ],
  },
  "traceability:incoming": incomingLotsFixture,
  "traceability:sent": sentLotsFixture,
  "qualityFiles:board": qualityFixture,
  "auditShares:board": reportsFixture,
  "auditShares:read": reportFixture,
  "routePlans:detail": routeFixture,
  "routePlans:options": [],
};
