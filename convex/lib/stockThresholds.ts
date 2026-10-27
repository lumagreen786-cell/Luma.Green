import type { Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import { queueInbox } from "./push";
import { membershipFor } from "./workspace";

/** Only the canonical movement owner calls this after a new stock write. */
export async function observeStockThreshold(
  ctx: MutationCtx,
  input: {
    orgId: Id<"orgs">;
    materialCode: string;
    previousGrams: number;
    grams: number;
    movementId: Id<"inventoryMovements">;
    at: number;
  },
) {
  const rule = await ctx.db
    .query("stockThresholds")
    .withIndex("by_org_material", (q) =>
      q.eq("orgId", input.orgId).eq("materialCode", input.materialCode),
    )
    .unique();
  if (!rule?.enabled) return;
  const isBelow = input.grams < rule.thresholdGrams;
  if (isBelow === rule.below) return;
  await ctx.db.patch("stockThresholds", rule._id, {
    below: isBelow,
    updatedAt: input.at,
  });
  const movement = await ctx.db.get("inventoryMovements", input.movementId);
  await ctx.db.insert("auditLog", {
    orgId: input.orgId,
    actorProfileId: movement?.actorProfileId,
    action: isBelow ? "stock.threshold_crossed" : "stock.threshold_rearmed",
    entityTable: "stockThresholds",
    entityId: rule._id,
    metadata: {
      materialCode: input.materialCode,
      previousGrams: input.previousGrams,
      grams: input.grams,
      thresholdGrams: rule.thresholdGrams,
      movementId: input.movementId,
    },
    createdAt: input.at,
  });
  if (!isBelow) return;
  const org = await ctx.db.get("orgs", input.orgId);
  const membership = await membershipFor(
    ctx,
    rule.recipientProfileId,
    input.orgId,
  );
  if (!membership || org?.status !== "active") return;
  const prior = await ctx.db
    .query("stockLowAlerts")
    .withIndex("by_org_movement", (q) =>
      q.eq("orgId", input.orgId).eq("movementId", input.movementId),
    )
    .unique();
  if (prior) return;
  const id = await ctx.db.insert("stockLowAlerts", {
    orgId: input.orgId,
    materialCode: input.materialCode,
    recipientProfileId: rule.recipientProfileId,
    thresholdGrams: rule.thresholdGrams,
    grams: input.grams,
    movementId: input.movementId,
    createdAt: input.at,
  });
  await ctx.db.insert("auditLog", {
    orgId: input.orgId,
    actorProfileId: movement?.actorProfileId,
    action: "stock.low_alert_created",
    entityTable: "stockLowAlerts",
    entityId: id,
    metadata: { movementId: input.movementId },
    createdAt: input.at,
  });
  await queueInbox(ctx, {
    profileId: rule.recipientProfileId,
    event: "stock_low",
    stockAlertId: id,
    dedupKey: `stock_low:${id}:${rule.recipientProfileId}`,
  });
}
