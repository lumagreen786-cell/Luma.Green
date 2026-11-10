import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";

export function isMatchingDispatch(
  event: Doc<"lotCustodyEvents"> | null,
  lot: Doc<"materialLots">,
  receiver: Id<"orgs">,
): event is Doc<"lotCustodyEvents"> {
  return (
    lot.status === "in_transit" &&
    event?.kind === "dispatched" &&
    lot.pendingDispatchId === event._id &&
    event.lotId === lot._id &&
    event.fromOrgId === lot.orgId &&
    event.toOrgId === receiver &&
    event.grams === lot.availableGrams
  );
}

export async function recordLotDispatch(
  ctx: MutationCtx,
  args: {
    lot: Doc<"materialLots">;
    receiverOrgId: Id<"orgs">;
    actorProfileId: Id<"profiles">;
    now: number;
    tradeId?: Id<"trades">;
  },
) {
  const { lot, receiverOrgId, actorProfileId, now, tradeId } = args;
  const dispatchId = await ctx.db.insert("lotCustodyEvents", {
    lotId: lot._id,
    kind: "dispatched",
    fromOrgId: lot.orgId,
    toOrgId: receiverOrgId,
    grams: lot.availableGrams,
    actorProfileId,
    tradeId,
    createdAt: now,
  });
  await ctx.db.patch("materialLots", lot._id, {
    status: "in_transit",
    pendingReceiverOrgId: receiverOrgId,
    pendingDispatchId: dispatchId,
    updatedAt: now,
  });
  await ctx.db.insert("auditLog", {
    orgId: lot.orgId,
    actorProfileId,
    action: "material_lot.dispatched",
    entityTable: "materialLots",
    entityId: lot._id,
    metadata: {
      dispatchId,
      receiverOrgId,
      grams: lot.availableGrams,
      dispatchedRecordedCostPaise: lot.costPaise ?? null,
      ...(tradeId && { tradeId }),
    },
    createdAt: now,
  });
  return dispatchId;
}

export async function recordLotReceipt(
  ctx: MutationCtx,
  args: {
    lot: Doc<"materialLots">;
    dispatch: Doc<"lotCustodyEvents">;
    actorProfileId: Id<"profiles">;
    now: number;
  },
) {
  const { lot, dispatch, actorProfileId, now } = args;
  const { toOrgId, grams, tradeId } = dispatch;
  const receiptId = await ctx.db.insert("lotCustodyEvents", {
    lotId: lot._id,
    kind: "received",
    fromOrgId: lot.orgId,
    toOrgId,
    grams,
    dispatchId: dispatch._id,
    tradeId,
    actorProfileId,
    createdAt: now,
  });
  await ctx.db.patch("materialLots", lot._id, {
    orgId: toOrgId,
    status: "available",
    pendingReceiverOrgId: undefined,
    pendingDispatchId: undefined,
    costBasisGrams: grams,
    isAcquisitionCostRecordable: true,
    initialCostPaise: null,
    costPaise: null,
    costReference: undefined,
    updatedAt: now,
  });
  await ctx.db.insert("auditLog", {
    orgId: toOrgId,
    actorProfileId,
    action: "material_lot.received",
    entityTable: "materialLots",
    entityId: lot._id,
    metadata: {
      receiptId,
      dispatchId: dispatch._id,
      grams,
      ...(tradeId && { tradeId }),
    },
    createdAt: now,
  });
  return receiptId;
}
