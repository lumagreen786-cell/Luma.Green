import { ConvexError, v } from "convex/values";

import type { Doc, Id } from "./_generated/dataModel";
import { mutation, query, type QueryCtx } from "./_generated/server";
import {
  assertOrdinaryRoute,
  requiresControlledRoute,
  vHandlingClass,
  vProcessKind,
  vStreamClass,
} from "./lib/industrialClassification";
import {
  balancedOutputGrams,
  optionalReference,
  positiveGrams,
  requiredLabel,
} from "./lib/lotEvidence";
import { indiaToday } from "./lib/onboarding";
import {
  allocateRecordedCost,
  canRecordAcquisitionCost,
  consumeRecordedCost,
  recordedCost,
  recordedCostReference,
  totalRecordedCost,
} from "./lib/processingCosts";
import { vRecordedCost } from "./lib/processingCostSchema";
import { hasQualityRelease, requireQualityRelease } from "./lib/qualityRelease";
import { vOrgKind } from "./lib/validators";
import { requireOrg } from "./lib/workspace";

async function orgName(ctx: QueryCtx, id: Id<"orgs">) {
  const org = await ctx.db.get("orgs", id);
  return org?.name ?? "";
}
function isMatchingDispatch(
  event: Doc<"lotCustodyEvents"> | null,
  lot: Doc<"materialLots">,
  receiver: Id<"orgs">,
): event is Doc<"lotCustodyEvents"> {
  return (
    lot.status === "in_transit" &&
    event?.kind === "dispatched" &&
    event.lotId === lot._id &&
    event.fromOrgId === lot.orgId &&
    event.toOrgId === receiver &&
    event.grams === lot.availableGrams
  );
}

const outputValidator = v.object({
  materialCode: v.string(),
  state: v.string(),
  grams: v.number(),
  streamClass: v.optional(vStreamClass),
  handlingClass: v.optional(vHandlingClass),
});

/** A physical declaration only: it does not add stock or verify provenance. */
export const declareLot = mutation({
  args: {
    materialCode: v.string(),
    state: v.string(),
    grams: v.number(),
    sourceReference: v.optional(v.string()),
    acquisitionCostPaise: v.optional(vRecordedCost),
    costReference: v.optional(v.string()),
    streamClass: v.optional(vStreamClass),
    handlingClass: v.optional(vHandlingClass),
  },
  returns: v.id("materialLots"),
  handler: async (ctx, args) => {
    const { org, profile } = await requireOrg(ctx);
    const now = Date.now();
    const costPaise = recordedCost(args.acquisitionCostPaise);
    const costReference = recordedCostReference(costPaise, args.costReference);
    const id = await ctx.db.insert("materialLots", {
      orgId: org._id,
      declaredByOrgId: org._id,
      materialCode: requiredLabel(args.materialCode),
      state: requiredLabel(args.state),
      streamClass: args.streamClass ?? "unspecified",
      handlingClass: args.handlingClass ?? "unassessed",
      sourceKind: "self_declared",
      sourceReference: optionalReference(args.sourceReference),
      initialGrams: positiveGrams(args.grams),
      availableGrams: args.grams,
      costBasisGrams: args.grams,
      isAcquisitionCostRecordable: true,
      initialCostPaise: costPaise,
      costPaise,
      costReference,
      status: "available",
      createdByProfileId: profile._id,
      createdAt: now,
      updatedAt: now,
    });
    await ctx.db.insert("auditLog", {
      orgId: org._id,
      actorProfileId: profile._id,
      action: "material_lot.declared",
      entityTable: "materialLots",
      entityId: id,
      metadata: {
        sourceKind: "self_declared",
        grams: args.grams,
        costPaise,
        costReference,
        streamClass: args.streamClass ?? "unspecified",
        handlingClass: args.handlingClass ?? "unassessed",
      },
      createdAt: now,
    });
    return id;
  },
});

/** First recorded acquisition only; consumed costs can never be restated. */
export const recordAcquisitionCost = mutation({
  args: {
    lotId: v.id("materialLots"),
    acquisitionCostPaise: v.number(),
    costReference: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { org, profile } = await requireOrg(ctx);
    const lot = await ctx.db.get("materialLots", args.lotId);
    if (lot?.orgId !== org._id) throw new ConvexError("LOT_NOT_FOUND");
    const cost = recordedCost(args.acquisitionCostPaise);
    const costReference = recordedCostReference(cost, args.costReference);
    if (lot.initialCostPaise !== undefined && lot.initialCostPaise !== null) {
      if (lot.initialCostPaise === cost && lot.costReference === costReference)
        return null;
      throw new ConvexError("COST_ALREADY_RECORDED");
    }
    if (!canRecordAcquisitionCost(lot))
      throw new ConvexError("COST_BASIS_ALREADY_CONSUMED");
    const now = Date.now();
    await ctx.db.patch("materialLots", lot._id, {
      initialCostPaise: cost,
      costPaise: cost,
      costReference,
      costBasisGrams: lot.availableGrams,
      updatedAt: now,
    });
    await ctx.db.insert("auditLog", {
      orgId: org._id,
      actorProfileId: profile._id,
      action: "material_lot.acquisition_cost_recorded",
      entityTable: "materialLots",
      entityId: lot._id,
      metadata: {
        costPaise: cost,
        costReference,
        costBasisGrams: lot.availableGrams,
      },
      createdAt: now,
    });
    return null;
  },
});

/** Dispatch the whole remaining lot. Custody does not transfer legal title. */
export const dispatch = mutation({
  args: { lotId: v.id("materialLots"), receiverOrgId: v.id("orgs") },
  returns: v.id("lotCustodyEvents"),
  handler: async (ctx, args) => {
    const { org, profile } = await requireOrg(ctx);
    const lot = await ctx.db.get("materialLots", args.lotId);
    if (lot?.orgId !== org._id) throw new ConvexError("LOT_NOT_FOUND");
    if (lot.status !== "available" || lot.availableGrams <= 0) {
      throw new ConvexError("LOT_NOT_AVAILABLE");
    }
    assertOrdinaryRoute(lot);
    await requireQualityRelease(ctx, lot);
    if (org._id === args.receiverOrgId) throw new ConvexError("SAME_CUSTODIAN");
    const receiver = await ctx.db.get("orgs", args.receiverOrgId);
    if (receiver?.status !== "active") {
      throw new ConvexError("RECEIVER_NOT_ACTIVE");
    }
    const now = Date.now();
    const dispatchId = await ctx.db.insert("lotCustodyEvents", {
      lotId: lot._id,
      kind: "dispatched",
      fromOrgId: org._id,
      toOrgId: receiver._id,
      grams: lot.availableGrams,
      actorProfileId: profile._id,
      createdAt: now,
    });
    await ctx.db.patch("materialLots", lot._id, {
      status: "in_transit",
      pendingReceiverOrgId: receiver._id,
      pendingDispatchId: dispatchId,
      updatedAt: now,
    });
    await ctx.db.insert("auditLog", {
      orgId: org._id,
      actorProfileId: profile._id,
      action: "material_lot.dispatched",
      entityTable: "materialLots",
      entityId: lot._id,
      metadata: {
        dispatchId,
        receiverOrgId: receiver._id,
        grams: lot.availableGrams,
        dispatchedRecordedCostPaise: lot.costPaise ?? null,
      },
      createdAt: now,
    });
    return dispatchId;
  },
});

/** A different measured weight remains in dispute; it is never silently fixed. */
export const receive = mutation({
  args: { lotId: v.id("materialLots"), receivedGrams: v.number() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { org, profile } = await requireOrg(ctx);
    const lot = await ctx.db.get("materialLots", args.lotId);
    if (lot?.pendingReceiverOrgId !== org._id || lot.status !== "in_transit") {
      throw new ConvexError("LOT_NOT_PENDING_FOR_ORG");
    }
    if (positiveGrams(args.receivedGrams) !== lot.availableGrams) {
      throw new ConvexError("WEIGHT_DISPUTE");
    }
    if (!lot.pendingDispatchId) throw new ConvexError("DISPATCH_NOT_FOUND");
    const now = Date.now();
    const receiptId = await ctx.db.insert("lotCustodyEvents", {
      lotId: lot._id,
      kind: "received",
      fromOrgId: lot.orgId,
      toOrgId: org._id,
      grams: args.receivedGrams,
      dispatchId: lot.pendingDispatchId,
      actorProfileId: profile._id,
      createdAt: now,
    });
    await ctx.db.patch("materialLots", lot._id, {
      orgId: org._id,
      status: "available",
      pendingReceiverOrgId: undefined,
      pendingDispatchId: undefined,
      costBasisGrams: args.receivedGrams,
      isAcquisitionCostRecordable: true,
      initialCostPaise: null,
      costPaise: null,
      costReference: undefined,
      updatedAt: now,
    });
    await ctx.db.insert("auditLog", {
      orgId: org._id,
      actorProfileId: profile._id,
      action: "material_lot.received",
      entityTable: "materialLots",
      entityId: lot._id,
      metadata: {
        receiptId,
        dispatchId: lot.pendingDispatchId,
        grams: args.receivedGrams,
      },
      createdAt: now,
    });
    return null;
  },
});

interface InputAllocation {
  lotId: Id<"materialLots">;
  grams: number;
}
async function readTransformationInputs(
  ctx: QueryCtx,
  orgId: Id<"orgs">,
  allocations: InputAllocation[],
) {
  if (
    allocations.length > 20 ||
    new Set(allocations.map((row) => row.lotId)).size !== allocations.length
  )
    throw new ConvexError("INVALID_INPUTS");
  const inputs = [];
  let totalGrams = 0;
  for (const allocation of allocations) {
    const grams = positiveGrams(allocation.grams);
    const lot = await ctx.db.get("materialLots", allocation.lotId);
    if (lot?.orgId !== orgId) throw new ConvexError("LOT_NOT_FOUND");
    if (lot.status !== "available" || grams > lot.availableGrams)
      throw new ConvexError("NOT_ENOUGH_LOT_GRAMS");
    assertOrdinaryRoute(lot);
    await requireQualityRelease(ctx, lot);
    totalGrams += grams;
    if (!Number.isSafeInteger(totalGrams))
      throw new ConvexError("INVALID_WEIGHT");
    inputs.push({ lot, grams });
  }
  return { inputs, totalGrams };
}

async function transformationsForLot(
  ctx: QueryCtx,
  lot: Doc<"materialLots">,
  orgId: Id<"orgs">,
) {
  const lotId = lot._id;
  const parent = lot.parentTransformationId
    ? await ctx.db.get("lotTransformations", lot.parentTransformationId)
    : null;
  const ownedParent = parent?.orgId === orgId ? [parent] : [];
  const legacy = await ctx.db
    .query("lotTransformations")
    .withIndex("by_input_lot_created", (q) => q.eq("inputLotId", lotId))
    .take(101);
  const edges = await ctx.db
    .query("lotTransformationInputs")
    .withIndex("by_lot_created", (q) => q.eq("lotId", lotId))
    .take(101);
  const linked = await Promise.all(
    edges.map((edge) =>
      ctx.db.get("lotTransformations", edge.transformationId),
    ),
  );
  const unique = new Map(
    [
      ...ownedParent,
      ...legacy,
      ...linked.filter((event) => event !== null),
    ].map((event) => [event._id, event]),
  );
  return [...unique.values()]
    .filter((event) => event.orgId === orgId)
    .toSorted(
      (left, right) =>
        left.createdAt - right.createdAt ||
        left._creationTime - right._creationTime,
    );
}

async function transformationInputView(
  ctx: QueryCtx,
  event: Doc<"lotTransformations">,
  orgId: Id<"orgs">,
) {
  const edges = await ctx.db
    .query("lotTransformationInputs")
    .withIndex("by_transformation", (q) => q.eq("transformationId", event._id))
    .take(20);
  if (edges.length === 0) {
    const lot = await ctx.db.get("materialLots", event.inputLotId);
    return lot
      ? [
          {
            id: lot._id,
            materialCode: lot.materialCode,
            state: lot.state,
            grams: event.inputGrams,
            canOpen: lot.orgId === orgId,
          },
        ]
      : [];
  }
  return Promise.all(
    edges.map(async (edge) => {
      const lot = await ctx.db.get("materialLots", edge.lotId);
      return {
        id: edge.lotId,
        materialCode: edge.materialCode,
        state: edge.state,
        grams: edge.grams,
        canOpen: lot?.orgId === orgId,
      };
    }),
  );
}

async function previousProcessOperation(
  ctx: QueryCtx,
  orgId: Id<"orgs">,
  operationReference: string | undefined,
  requestFingerprint: string,
) {
  if (!operationReference) return null;
  const prior = await ctx.db
    .query("lotTransformations")
    .withIndex("by_org_operation", (q) =>
      q.eq("orgId", orgId).eq("operationReference", operationReference),
    )
    .unique();
  if (!prior) return null;
  if (prior.requestFingerprint !== requestFingerprint)
    throw new ConvexError("PROCESS_OPERATION_CONFLICT");
  return prior._id;
}

/** Convert measured grams to child lots, with exact integer mass balance. */
export const transform = mutation({
  args: {
    inputLotId: v.id("materialLots"),
    additionalInputs: v.optional(
      v.array(v.object({ lotId: v.id("materialLots"), grams: v.number() })),
    ),
    facilityId: v.optional(v.id("industrialFacilities")),
    processKind: v.optional(vProcessKind),
    inputGrams: v.number(),
    contaminationGrams: v.number(),
    processLossGrams: v.number(),
    processingCostPaise: v.optional(vRecordedCost),
    costReference: v.optional(v.string()),
    operationReference: v.optional(v.string()),
    outputs: v.array(outputValidator),
  },
  returns: v.id("lotTransformations"),
  handler: async (ctx, args) => {
    const { org, profile } = await requireOrg(ctx);
    const processingCostPaise = recordedCost(args.processingCostPaise);
    const costReference = recordedCostReference(
      processingCostPaise,
      args.costReference,
    );
    const operationReference =
      args.operationReference === undefined
        ? undefined
        : requiredLabel(args.operationReference);
    const requestFingerprint = JSON.stringify({
      inputLotId: args.inputLotId,
      inputGrams: args.inputGrams,
      additionalInputs: (args.additionalInputs ?? []).map(
        ({ lotId, grams }) => ({ lotId, grams }),
      ),
      contaminationGrams: args.contaminationGrams,
      processLossGrams: args.processLossGrams,
      facilityId: args.facilityId ?? null,
      processKind: args.processKind ?? null,
      processingCostPaise,
      costReference: costReference ?? null,
      outputs: args.outputs.map((output) => ({
        materialCode: output.materialCode.trim(),
        state: output.state.trim(),
        grams: output.grams,
        streamClass: output.streamClass ?? "unspecified",
        handlingClass: output.handlingClass ?? "unassessed",
      })),
    });
    const prior = await previousProcessOperation(
      ctx,
      org._id,
      operationReference,
      requestFingerprint,
    );
    if (prior) return prior;
    const { inputs, totalGrams } = await readTransformationInputs(
      ctx,
      org._id,
      [
        { lotId: args.inputLotId, grams: args.inputGrams },
        ...(args.additionalInputs ?? []),
      ],
    );
    if (Boolean(args.facilityId) !== Boolean(args.processKind))
      throw new ConvexError("FACILITY_PROCESS_REQUIRED");
    const facility = args.facilityId
      ? await ctx.db.get("industrialFacilities", args.facilityId)
      : null;
    if (args.facilityId && facility?.orgId !== org._id)
      throw new ConvexError("FACILITY_NOT_FOUND");
    if (args.processKind && !facility?.capabilities.includes(args.processKind))
      throw new ConvexError("PROCESS_NOT_DECLARED");
    balancedOutputGrams(
      totalGrams,
      args.contaminationGrams,
      args.processLossGrams,
      args.outputs,
    );
    const outputs = args.outputs.map((output) => ({
      materialCode: requiredLabel(output.materialCode),
      state: requiredLabel(output.state),
      grams: output.grams,
      streamClass: output.streamClass ?? "unspecified",
      handlingClass: output.handlingClass ?? "unassessed",
    }));
    const inputCosts = inputs.map(({ lot, grams }) =>
      consumeRecordedCost(lot.availableGrams, lot.costPaise, grams),
    );
    const consumedInputCostPaise = totalRecordedCost(
      inputCosts.map(({ consumed }) => consumed),
    );
    const totalOutputCostPaise = totalRecordedCost([
      consumedInputCostPaise,
      processingCostPaise,
    ]);
    const outputCosts = allocateRecordedCost(
      totalOutputCostPaise,
      outputs.map(({ grams }) => grams),
    );
    const now = Date.now();
    const transformationId = await ctx.db.insert("lotTransformations", {
      orgId: org._id,
      inputLotId: args.inputLotId,
      facilityId: facility?._id,
      facilityName: facility?.name,
      processKind: args.processKind,
      inputGrams: totalGrams,
      contaminationGrams: args.contaminationGrams,
      processLossGrams: args.processLossGrams,
      actorProfileId: profile._id,
      processingCostPaise,
      consumedInputCostPaise,
      totalOutputCostPaise,
      costReference,
      operationReference,
      requestFingerprint,
      createdAt: now,
    });
    const outputLotIds = [];
    for (const [index, output] of outputs.entries()) {
      outputLotIds.push(
        await ctx.db.insert("materialLots", {
          orgId: org._id,
          declaredByOrgId: org._id,
          materialCode: output.materialCode,
          state: output.state,
          streamClass: output.streamClass,
          handlingClass: output.handlingClass,
          sourceKind: "transformed",
          parentTransformationId: transformationId,
          initialGrams: output.grams,
          availableGrams: output.grams,
          costBasisGrams: output.grams,
          isAcquisitionCostRecordable: false,
          initialCostPaise: outputCosts[index] ?? null,
          costPaise: outputCosts[index] ?? null,
          costReference,
          status: "available",
          createdByProfileId: profile._id,
          createdAt: now,
          updatedAt: now,
        }),
      );
    }
    for (const [index, { lot, grams }] of inputs.entries()) {
      const cost = inputCosts[index];
      await ctx.db.insert("lotTransformationInputs", {
        transformationId,
        lotId: lot._id,
        materialCode: lot.materialCode,
        state: lot.state,
        grams,
        consumedCostPaise: cost.consumed,
        createdAt: now,
      });
      const availableGrams = lot.availableGrams - grams;
      await ctx.db.patch("materialLots", lot._id, {
        availableGrams,
        costPaise: cost.remaining,
        status: availableGrams === 0 ? "exhausted" : "available",
        updatedAt: now,
      });
    }
    await ctx.db.insert("auditLog", {
      orgId: org._id,
      actorProfileId: profile._id,
      action: "material_lot.transformed",
      entityTable: "lotTransformations",
      entityId: transformationId,
      metadata: {
        inputLotId: args.inputLotId,
        inputGrams: totalGrams,
        inputs: inputs.map(({ lot, grams }) => ({ lotId: lot._id, grams })),
        contaminationGrams: args.contaminationGrams,
        processLossGrams: args.processLossGrams,
        outputLotIds,
        processingCostPaise,
        consumedInputCostPaise,
        totalOutputCostPaise,
        costReference,
        operationReference,
        outputCosts,
        lossCostPolicy: "absorbed_by_measured_outputs",
        facilityId: facility?._id,
        processKind: args.processKind,
      },
      createdAt: now,
    });
    return transformationId;
  },
});

/** The caller sees only its currently held lots. */
export const mine = query({
  args: {},
  returns: v.object({
    rows: v.array(
      v.object({
        id: v.id("materialLots"),
        materialCode: v.string(),
        state: v.string(),
        streamClass: vStreamClass,
        handlingClass: vHandlingClass,
        sourceKind: v.union(
          v.literal("self_declared"),
          v.literal("transformed"),
        ),
        initialGrams: v.number(),
        initialCostPaise: vRecordedCost,
        costPaise: vRecordedCost,
        availableGrams: v.number(),
        status: v.union(
          v.literal("available"),
          v.literal("in_transit"),
          v.literal("exhausted"),
        ),
        createdAt: v.number(),
      }),
    ),
    hasMore: v.boolean(),
  }),
  handler: async (ctx) => {
    const { org } = await requireOrg(ctx, undefined, "read");
    const lots = await ctx.db
      .query("materialLots")
      .withIndex("by_org_created", (q) => q.eq("orgId", org._id))
      .order("desc")
      .take(101);
    return {
      rows: lots.slice(0, 100).map((lot) => ({
        id: lot._id,
        materialCode: lot.materialCode,
        state: lot.state,
        streamClass: lot.streamClass ?? "unspecified",
        handlingClass: lot.handlingClass ?? "unassessed",
        sourceKind: lot.sourceKind,
        initialGrams: lot.initialGrams,
        initialCostPaise: lot.initialCostPaise ?? null,
        costPaise: lot.costPaise ?? null,
        availableGrams: lot.availableGrams,
        status: lot.status,
        createdAt: lot.createdAt,
      })),
      hasMore: lots.length > 100,
    };
  },
});

/** Only the holder sees full lineage. A pending receiver sees its own dispatch. */
export const history = query({
  args: { lotId: v.id("materialLots") },
  returns: v.object({
    access: v.union(v.literal("holder"), v.literal("pending_receiver")),
    lot: v.object({
      id: v.id("materialLots"),
      declaredByOrgId: v.optional(v.id("orgs")),
      materialCode: v.string(),
      state: v.string(),
      streamClass: vStreamClass,
      handlingClass: vHandlingClass,
      sourceKind: v.optional(
        v.union(v.literal("self_declared"), v.literal("transformed")),
      ),
      sourceReference: v.optional(v.string()),
      qualityReleased: v.optional(v.boolean()),
      initialGrams: v.optional(v.number()),
      initialCostPaise: v.optional(vRecordedCost),
      costPaise: v.optional(vRecordedCost),
      costReference: v.optional(v.string()),
      costBasisGrams: v.optional(v.number()),
      canRecordAcquisitionCost: v.optional(v.boolean()),
      availableGrams: v.number(),
      status: v.union(
        v.literal("available"),
        v.literal("in_transit"),
        v.literal("exhausted"),
      ),
    }),
    custody: v.array(
      v.object({
        id: v.id("lotCustodyEvents"),
        kind: v.union(v.literal("dispatched"), v.literal("received")),
        fromOrgId: v.id("orgs"),
        toOrgId: v.id("orgs"),
        fromName: v.string(),
        toName: v.string(),
        grams: v.number(),
        createdAt: v.number(),
      }),
    ),
    hasMoreCustody: v.boolean(),
    transformations: v.array(
      v.object({
        id: v.id("lotTransformations"),
        processKind: v.optional(vProcessKind),
        facilityName: v.optional(v.string()),
        inputGrams: v.number(),
        inputs: v.array(
          v.object({
            id: v.id("materialLots"),
            materialCode: v.string(),
            state: v.string(),
            grams: v.number(),
            canOpen: v.boolean(),
          }),
        ),
        contaminationGrams: v.number(),
        processLossGrams: v.number(),
        processingCostPaise: vRecordedCost,
        consumedInputCostPaise: vRecordedCost,
        totalOutputCostPaise: vRecordedCost,
        costReference: v.optional(v.string()),
        createdAt: v.number(),
        outputs: v.array(
          v.object({
            id: v.id("materialLots"),
            canOpen: v.boolean(),
            materialCode: v.string(),
            state: v.string(),
            streamClass: vStreamClass,
            handlingClass: vHandlingClass,
            grams: v.number(),
          }),
        ),
      }),
    ),
    hasMoreTransformations: v.boolean(),
    dispositions: v.array(
      v.object({
        id: v.id("lotControlledDispositions"),
        grams: v.number(),
        destinationReference: v.string(),
        authorisationReference: v.string(),
        manifestReference: v.string(),
        createdAt: v.number(),
      }),
    ),
    hasMoreDispositions: v.boolean(),
  }),
  handler: async (ctx, args) => {
    const { org } = await requireOrg(ctx, undefined, "read");
    const lot = await ctx.db.get("materialLots", args.lotId);
    if (!lot) throw new ConvexError("LOT_NOT_FOUND");
    const isHolder = lot.orgId === org._id;
    const isPending =
      !isHolder &&
      lot.status === "in_transit" &&
      lot.pendingReceiverOrgId === org._id;
    if (!isHolder && !isPending) throw new ConvexError("LOT_NOT_FOUND");
    const dispatch =
      isPending && lot.pendingDispatchId
        ? await ctx.db.get("lotCustodyEvents", lot.pendingDispatchId)
        : null;
    if (isPending && !isMatchingDispatch(dispatch, lot, org._id))
      throw new ConvexError("DISPATCH_NOT_FOUND");
    const pendingEvents = dispatch ? [dispatch] : [];
    const custody = isHolder
      ? await ctx.db
          .query("lotCustodyEvents")
          .withIndex("by_lot_created", (q) => q.eq("lotId", lot._id))
          .take(101)
      : pendingEvents;
    const transformations = isHolder
      ? await transformationsForLot(ctx, lot, org._id)
      : [];
    const dispositions = isHolder
      ? await ctx.db
          .query("lotControlledDispositions")
          .withIndex("by_lot_created", (q) => q.eq("lotId", lot._id))
          .take(101)
      : [];
    const declaration = isHolder
      ? {
          qualityReleased: await hasQualityRelease(ctx, lot),
          declaredByOrgId: lot.declaredByOrgId,
          sourceKind: lot.sourceKind,
          sourceReference: lot.sourceReference,
          initialGrams: lot.initialGrams,
          initialCostPaise: lot.initialCostPaise ?? null,
          costPaise: lot.costPaise ?? null,
          costReference: lot.costReference,
          costBasisGrams: lot.costBasisGrams ?? lot.initialGrams,
          canRecordAcquisitionCost: canRecordAcquisitionCost(lot),
        }
      : {};
    return {
      access: isHolder ? ("holder" as const) : ("pending_receiver" as const),
      lot: {
        id: lot._id,
        ...declaration,
        streamClass: lot.streamClass ?? "unspecified",
        handlingClass: lot.handlingClass ?? "unassessed",
        materialCode: lot.materialCode,
        state: lot.state,
        availableGrams: lot.availableGrams,
        status: lot.status,
      },
      custody: await Promise.all(
        custody.slice(0, 100).map(async (event) => ({
          id: event._id,
          kind: event.kind,
          fromOrgId: event.fromOrgId,
          toOrgId: event.toOrgId,
          fromName: await orgName(ctx, event.fromOrgId),
          toName: await orgName(ctx, event.toOrgId),
          grams: event.grams,
          createdAt: event.createdAt,
        })),
      ),
      hasMoreCustody: custody.length > 100,
      transformations: await Promise.all(
        transformations.slice(0, 100).map(async (event) => {
          const outputs = await ctx.db
            .query("materialLots")
            .withIndex("by_parent_transformation", (q) =>
              q.eq("parentTransformationId", event._id),
            )
            .take(10);
          return {
            id: event._id,
            processKind: event.processKind,
            facilityName: event.facilityName,
            inputGrams: event.inputGrams,
            inputs: await transformationInputView(ctx, event, org._id),
            contaminationGrams: event.contaminationGrams,
            processLossGrams: event.processLossGrams,
            processingCostPaise: event.processingCostPaise ?? null,
            consumedInputCostPaise: event.consumedInputCostPaise ?? null,
            totalOutputCostPaise: event.totalOutputCostPaise ?? null,
            costReference: event.costReference,
            createdAt: event.createdAt,
            outputs: outputs.map((output) => ({
              id: output._id,
              canOpen: output.orgId === org._id,
              materialCode: output.materialCode,
              state: output.state,
              grams: output.initialGrams,
              streamClass: output.streamClass ?? "unspecified",
              handlingClass: output.handlingClass ?? "unassessed",
            })),
          };
        }),
      ),
      hasMoreTransformations: transformations.length > 100,
      dispositions: dispositions
        .slice(0, 100)
        .map(
          ({
            _id,
            grams,
            destinationReference,
            authorisationReference,
            manifestReference,
            createdAt,
          }) => ({
            id: _id,
            grams,
            destinationReference,
            authorisationReference,
            manifestReference,
            createdAt,
          }),
        ),
      hasMoreDispositions: dispositions.length > 100,
    };
  },
});

/** Minimal business directory. Registration is not evidence of processing capability. */
export const recipientOptions = query({
  args: { kind: vOrgKind, city: v.string() },
  returns: v.object({
    rows: v.array(
      v.object({
        id: v.id("orgs"),
        name: v.string(),
        kind: vOrgKind,
        city: v.string(),
        area: v.string(),
      }),
    ),
    hasMore: v.boolean(),
  }),
  handler: async (ctx, args) => {
    const { org } = await requireOrg(ctx, undefined, "read");
    const city = requiredLabel(args.city);
    const rows = await ctx.db
      .query("orgs")
      .withIndex("by_kind_city", (q) =>
        q.eq("kind", args.kind).eq("city", city).eq("status", "active"),
      )
      .take(101);
    return {
      rows: rows
        .slice(0, 100)
        .filter((row) => row._id !== org._id)
        .map((row) => ({
          id: row._id,
          name: row.name,
          kind: row.kind,
          city: row.city,
          area: row.area,
        })),
      hasMore: rows.length > 100,
    };
  },
});

/** Pending recipients see only the physical material and the specific dispatch. */
export const incoming = query({
  args: {},
  returns: v.object({
    rows: v.array(
      v.object({
        id: v.id("materialLots"),
        materialCode: v.string(),
        state: v.string(),
        grams: v.number(),
        fromName: v.string(),
        dispatchedAt: v.number(),
      }),
    ),
    hasMore: v.boolean(),
  }),
  handler: async (ctx) => {
    const { org } = await requireOrg(ctx, undefined, "read");
    const lots = await ctx.db
      .query("materialLots")
      .withIndex("by_pending_receiver", (q) =>
        q.eq("pendingReceiverOrgId", org._id),
      )
      .take(101);
    const rows = await Promise.all(
      lots.slice(0, 100).map(async (lot) => {
        const event = lot.pendingDispatchId
          ? await ctx.db.get("lotCustodyEvents", lot.pendingDispatchId)
          : null;
        if (!isMatchingDispatch(event, lot, org._id)) return null;
        return {
          id: lot._id,
          materialCode: lot.materialCode,
          state: lot.state,
          grams: event.grams,
          fromName: await orgName(ctx, event.fromOrgId),
          dispatchedAt: event.createdAt,
        };
      }),
    );
    return {
      rows: rows.filter((row) => row !== null),
      hasMore: lots.length > 100,
    };
  },
});

/** Historical sender access ends at its own hand-off, never future private evidence. */
export const sent = query({
  args: {},
  returns: v.object({
    rows: v.array(
      v.object({
        id: v.id("lotCustodyEvents"),
        kind: v.union(v.literal("dispatched"), v.literal("received")),
        materialCode: v.string(),
        state: v.string(),
        grams: v.number(),
        toName: v.string(),
        createdAt: v.number(),
      }),
    ),
    hasMore: v.boolean(),
  }),
  handler: async (ctx) => {
    const { org } = await requireOrg(ctx, undefined, "read");
    const events = await ctx.db
      .query("lotCustodyEvents")
      .withIndex("by_from_created", (q) => q.eq("fromOrgId", org._id))
      .order("desc")
      .take(101);
    return {
      rows: await Promise.all(
        events.slice(0, 100).map(async (event) => {
          const lot = await ctx.db.get("materialLots", event.lotId);
          return {
            id: event._id,
            kind: event.kind,
            materialCode: lot?.materialCode ?? "",
            state: lot?.state ?? "",
            grams: event.grams,
            toName: await orgName(ctx, event.toOrgId),
            createdAt: event.createdAt,
          };
        }),
      ),
      hasMore: events.length > 100,
    };
  },
});

/** Records a declared controlled hand-off. References are evidence, never approval. */
export const recordControlledDisposition = mutation({
  args: {
    lotId: v.id("materialLots"),
    grams: v.number(),
    destinationReference: v.string(),
    reviewedDestinationId: v.optional(v.id("controlledDestinations")),
    authorisationReference: v.string(),
    manifestReference: v.string(),
  },
  returns: v.id("lotControlledDispositions"),
  handler: async (ctx, args) => {
    const { org, profile } = await requireOrg(ctx);
    const lot = await ctx.db.get("materialLots", args.lotId);
    if (lot?.orgId !== org._id) throw new ConvexError("LOT_NOT_FOUND");
    if (!requiresControlledRoute(lot))
      throw new ConvexError("CONTROLLED_LOT_REQUIRED");
    const grams = positiveGrams(args.grams);
    if (lot.status !== "available" || grams > lot.availableGrams)
      throw new ConvexError("NOT_ENOUGH_LOT_GRAMS");
    const destinationReference = optionalReference(args.destinationReference);
    const authorisationReference = optionalReference(
      args.authorisationReference,
    );
    const manifestReference = optionalReference(args.manifestReference);
    if (!destinationReference || !authorisationReference || !manifestReference)
      throw new ConvexError("INVALID_REFERENCE");
    if (args.reviewedDestinationId) {
      const destination = await ctx.db.get(
        "controlledDestinations",
        args.reviewedDestinationId,
      );
      if (
        !destination?.active ||
        destination.validUntil < indiaToday() ||
        !destination.materialCodes.includes(lot.materialCode) ||
        !destination.processes.includes("residual_handling")
      )
        throw new ConvexError("DESTINATION_SCOPE_INVALID");
      if (
        destinationReference !==
          `${destination.name} · ${destination.siteReference}` ||
        authorisationReference !== destination.authorisationReference
      )
        throw new ConvexError("DESTINATION_REFERENCE_MISMATCH");
    }
    const now = Date.now();
    const id = await ctx.db.insert("lotControlledDispositions", {
      lotId: lot._id,
      orgId: org._id,
      grams,
      destinationReference,
      reviewedDestinationId: args.reviewedDestinationId,
      authorisationReference,
      manifestReference,
      actorProfileId: profile._id,
      createdAt: now,
    });
    const availableGrams = lot.availableGrams - grams;
    const disposedCost = consumeRecordedCost(
      lot.availableGrams,
      lot.costPaise,
      grams,
    );
    await ctx.db.patch("materialLots", lot._id, {
      availableGrams,
      costPaise: disposedCost.remaining,
      status: availableGrams === 0 ? "exhausted" : "available",
      updatedAt: now,
    });
    await ctx.db.insert("auditLog", {
      orgId: org._id,
      actorProfileId: profile._id,
      action: "material_lot.controlled_disposition_recorded",
      entityTable: "materialLots",
      entityId: lot._id,
      metadata: {
        dispositionId: id,
        disposedCostPaise: disposedCost.consumed,
        remainingCostPaise: disposedCost.remaining,
        grams,
        previousGrams: lot.availableGrams,
        availableGrams,
        evidenceScope: "self_declared",
      },
      createdAt: now,
    });
    return id;
  },
});
