import { ConvexError } from "convex/values";

import type { Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import { stockGramsAfter } from "./inventory";
import { reservedReturnGrams } from "./returnClaims";
import { observeStockThreshold } from "./stockThresholds";

/** Allocate recorded cost without unsafe multiplication or losing final paise. */
export function remainingCost(
  currentGrams: number,
  currentCost: number | null,
  deltaGrams: number,
  addedCost: number | null,
): number | null {
  const grams = stockGramsAfter(currentGrams, deltaGrams);
  for (const cost of [currentCost, addedCost]) {
    if (cost !== null && (!Number.isSafeInteger(cost) || cost < 0))
      throw new ConvexError("INVALID_PRICE");
  }
  if (grams === 0) return 0;
  if (deltaGrams < 0) {
    return currentCost === null
      ? null
      : currentCost -
          Number(
            (BigInt(currentCost) * BigInt(-deltaGrams)) / BigInt(currentGrams),
          );
  }
  if (addedCost === null || (currentCost === null && currentGrams > 0))
    return null;
  const total = (currentCost ?? 0) + addedCost;
  if (!Number.isSafeInteger(total)) throw new ConvexError("INVALID_PRICE");
  return total;
}

export async function recordInventoryMovement(
  ctx: MutationCtx,
  args: {
    orgId: Id<"orgs">;
    actorProfileId: Id<"profiles">;
    materialCode: string;
    deltaGrams: number;
    addedCostPaise: number | null;
    sourceKey: string;
    createdAt: number;
  },
) {
  const prior = await ctx.db
    .query("inventoryMovements")
    .withIndex("by_org_source", (q) =>
      q.eq("orgId", args.orgId).eq("sourceKey", args.sourceKey),
    )
    .unique();
  if (prior) {
    if (
      prior.materialCode !== args.materialCode ||
      prior.deltaGrams !== args.deltaGrams ||
      (args.deltaGrams > 0 && prior.costDeltaPaise !== args.addedCostPaise)
    )
      throw new ConvexError("INVENTORY_SOURCE_CONFLICT");
    return prior._id;
  }
  if (args.deltaGrams === 0) throw new ConvexError("INVALID_WEIGHT");
  const row = await ctx.db
    .query("inventory")
    .withIndex("by_org_material", (q) =>
      q.eq("orgId", args.orgId).eq("materialCode", args.materialCode),
    )
    .unique();
  const previousGrams = row?.grams ?? 0;
  const grams = stockGramsAfter(previousGrams, args.deltaGrams);
  if (
    args.deltaGrams < 0 &&
    grams <
      (await reservedReturnGrams(
        ctx,
        args.orgId,
        args.materialCode,
        args.sourceKey,
      ))
  )
    throw new ConvexError("RETURN_STOCK_RESERVED");
  const previousCost = previousGrams === 0 ? 0 : (row?.costPaise ?? null);
  const costPaise = remainingCost(
    previousGrams,
    previousCost,
    args.deltaGrams,
    args.addedCostPaise,
  );
  let costDeltaPaise = args.addedCostPaise;
  if (args.deltaGrams < 0)
    costDeltaPaise =
      previousCost === null || costPaise === null
        ? null
        : costPaise - previousCost;
  if (row)
    await ctx.db.patch("inventory", row._id, {
      grams,
      costPaise,
      updatedAt: args.createdAt,
    });
  else
    await ctx.db.insert("inventory", {
      orgId: args.orgId,
      materialCode: args.materialCode,
      grams,
      costPaise,
      updatedAt: args.createdAt,
    });
  const id = await ctx.db.insert("inventoryMovements", {
    orgId: args.orgId,
    actorProfileId: args.actorProfileId,
    materialCode: args.materialCode,
    deltaGrams: args.deltaGrams,
    costDeltaPaise,
    sourceKey: args.sourceKey,
    createdAt: args.createdAt,
  });
  await ctx.db.insert("auditLog", {
    orgId: args.orgId,
    actorProfileId: args.actorProfileId,
    action: "inventory.movement_recorded",
    entityTable: "inventoryMovements",
    entityId: id,
    metadata: {
      materialCode: args.materialCode,
      deltaGrams: args.deltaGrams,
      costDeltaPaise,
      grams,
      costPaise,
      sourceKey: args.sourceKey,
    },
    createdAt: args.createdAt,
  });
  await observeStockThreshold(ctx, {
    orgId: args.orgId,
    materialCode: args.materialCode,
    previousGrams,
    grams,
    movementId: id,
    at: args.createdAt,
  });
  return id;
}
