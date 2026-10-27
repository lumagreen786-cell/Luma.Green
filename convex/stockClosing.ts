import { ConvexError, v } from "convex/values";

import { mutation, query } from "./_generated/server";
import { recordInventoryMovement } from "./lib/inventoryLedger";
import { indiaToday } from "./lib/onboarding";
import { vClosingLine } from "./lib/stockClosingSchema";
import { closingSnapshot } from "./lib/stockClosingSnapshot";
import { vMaterialRef } from "./lib/views";
import { materialIndex, requireOrg } from "./lib/workspace";
import { hasWorkspacePermission, workspaceRole } from "./lib/workspaceRoles";
import { promisedGrams } from "./market";

const closingView = v.object({
  id: v.id("stockDailyClosings"),
  day: v.string(),
  note: v.string(),
  lines: v.array(vClosingLine),
  totalGrams: v.number(),
  totalCostPaise: v.union(v.number(), v.null()),
  createdAt: v.number(),
});
export const board = query({
  args: {},
  returns: v.object({
    orgId: v.id("orgs"),
    canOperate: v.boolean(),
    canAdjust: v.boolean(),
    adjustments: v.array(
      v.object({
        id: v.id("stockAdjustments"),
        materialCode: v.string(),
        deltaGrams: v.number(),
        costPaise: v.union(v.number(), v.null()),
        reason: v.string(),
        evidenceReference: v.string(),
        createdAt: v.number(),
      }),
    ),
    materials: v.array(vMaterialRef),
    latest: v.union(closingView, v.null()),
    settings: v.array(
      v.object({
        materialCode: v.string(),
        thresholdGrams: v.number(),
        enabled: v.boolean(),
        below: v.boolean(),
      }),
    ),
    alerts: v.array(
      v.object({
        id: v.id("stockLowAlerts"),
        materialCode: v.string(),
        thresholdGrams: v.number(),
        grams: v.number(),
        createdAt: v.number(),
      }),
    ),
  }),
  handler: async (ctx) => {
    const { org, membership } = await requireOrg(ctx, undefined, "read");
    const catalogue = await materialIndex(ctx);
    const [latest, rules, alerts] = await Promise.all([
      ctx.db
        .query("stockDailyClosings")
        .withIndex("by_org_day", (q) => q.eq("orgId", org._id))
        .order("desc")
        .first(),
      ctx.db
        .query("stockThresholds")
        .withIndex("by_org", (q) => q.eq("orgId", org._id))
        .take(501),
      ctx.db
        .query("stockLowAlerts")
        .withIndex("by_org_created", (q) => q.eq("orgId", org._id))
        .order("desc")
        .take(20),
    ]);
    const adjustments = await ctx.db
      .query("stockAdjustments")
      .withIndex("by_org_created", (q) => q.eq("orgId", org._id))
      .order("desc")
      .take(20);
    if (rules.length > 500) throw new ConvexError("STOCK_CLOSING_LIMIT");
    return {
      orgId: org._id,
      canOperate:
        org.status === "active" &&
        hasWorkspacePermission(workspaceRole(membership.role), "operate"),
      canAdjust:
        org.status === "active" &&
        hasWorkspacePermission(workspaceRole(membership.role), "manage"),
      adjustments: adjustments.map((row) => ({
        id: row._id,
        materialCode: row.materialCode,
        deltaGrams: row.deltaGrams,
        costPaise: row.costPaise,
        reason: row.reason,
        evidenceReference: row.evidenceReference,
        createdAt: row.createdAt,
      })),
      materials: [...catalogue.values()]
        .filter((row) => row.active && org.families.includes(row.family))
        .map((row) => ({
          code: row.code,
          names: row.names,
          family: row.family,
        })),
      latest: latest
        ? {
            id: latest._id,
            day: latest.day,
            note: latest.note,
            lines: latest.lines,
            totalGrams: latest.totalGrams,
            totalCostPaise: latest.totalCostPaise,
            createdAt: latest.createdAt,
          }
        : null,
      settings: rules.map((row) => ({
        materialCode: row.materialCode,
        thresholdGrams: row.thresholdGrams,
        enabled: row.enabled,
        below: row.below,
      })),
      alerts: alerts.map((row) => ({
        id: row._id,
        materialCode: row.materialCode,
        thresholdGrams: row.thresholdGrams,
        grams: row.grams,
        createdAt: row.createdAt,
      })),
    };
  },
});

/** A compensating movement: existing receipts, trades and money stay unchanged. */
export const adjust = mutation({
  args: {
    operationKey: v.string(),
    materialCode: v.string(),
    deltaGrams: v.number(),
    costPaise: v.union(v.number(), v.null()),
    reason: v.string(),
    evidenceReference: v.string(),
  },
  returns: v.id("stockAdjustments"),
  handler: async (ctx, args) => {
    const { org, profile } = await requireOrg(ctx, undefined, "manage");
    const reason = args.reason.trim(),
      evidenceReference = args.evidenceReference.trim();
    if (
      !evidenceReference ||
      !/^[\w-]{8,80}$/.test(args.operationKey) ||
      reason.length < 5 ||
      reason.length > 500 ||
      evidenceReference.length > 200 ||
      /\p{Cc}/u.test(reason + evidenceReference)
    )
      throw new ConvexError("INVALID_STOCK_ADJUSTMENT");
    if (!Number.isSafeInteger(args.deltaGrams) || args.deltaGrams === 0)
      throw new ConvexError("INVALID_WEIGHT");
    if (
      args.costPaise !== null &&
      (!Number.isSafeInteger(args.costPaise) ||
        args.costPaise < 0 ||
        args.deltaGrams < 0)
    )
      throw new ConvexError("INVALID_PRICE");
    const previous = await ctx.db
      .query("stockAdjustments")
      .withIndex("by_org_operation", (q) =>
        q.eq("orgId", org._id).eq("operationKey", args.operationKey),
      )
      .unique();
    if (previous) {
      if (
        previous.materialCode !== args.materialCode ||
        previous.deltaGrams !== args.deltaGrams ||
        previous.costPaise !== args.costPaise ||
        previous.reason !== reason ||
        previous.evidenceReference !== evidenceReference
      )
        throw new ConvexError("ADJUSTMENT_REFERENCE_CONFLICT");
      return previous._id;
    }
    const material = await ctx.db
      .query("materials")
      .withIndex("by_code", (q) => q.eq("code", args.materialCode))
      .unique();
    if (!material?.active || !org.families.includes(material.family))
      throw new ConvexError("MATERIAL_NOT_ELIGIBLE");
    if (args.deltaGrams < 0) {
      const inventory = await ctx.db
        .query("inventory")
        .withIndex("by_org_material", (q) =>
          q.eq("orgId", org._id).eq("materialCode", args.materialCode),
        )
        .unique();
      const promises = await promisedGrams(ctx, org._id);
      const remaining = (inventory?.grams ?? 0) + args.deltaGrams;
      if (
        !Number.isSafeInteger(remaining) ||
        remaining < (promises.get(args.materialCode) ?? 0)
      )
        throw new ConvexError("STOCK_RESERVED");
    }
    const createdAt = Date.now();
    const id = await ctx.db.insert("stockAdjustments", {
      ...args,
      reason,
      evidenceReference,
      orgId: org._id,
      actorProfileId: profile._id,
      createdAt,
    });
    await recordInventoryMovement(ctx, {
      orgId: org._id,
      actorProfileId: profile._id,
      materialCode: args.materialCode,
      deltaGrams: args.deltaGrams,
      addedCostPaise: args.costPaise,
      sourceKey: `adjustment:${id}`,
      createdAt,
    });
    await ctx.db.insert("auditLog", {
      orgId: org._id,
      actorProfileId: profile._id,
      action: "stock.adjusted",
      entityTable: "stockAdjustments",
      entityId: id,
      metadata: {
        materialCode: args.materialCode,
        deltaGrams: args.deltaGrams,
        costPaise: args.costPaise,
        reason,
        evidenceReference,
      },
      createdAt,
    });
    return id;
  },
});
export const record = mutation({
  args: { operationKey: v.string(), day: v.string(), note: v.string() },
  returns: v.id("stockDailyClosings"),
  handler: async (ctx, args) => {
    const { org, profile } = await requireOrg(ctx);
    const note = args.note.trim();
    if (
      !/^[\w-]{8,80}$/.test(args.operationKey) ||
      note.length > 500 ||
      /\p{Cc}/u.test(note.replaceAll(/\r?\n/g, ""))
    )
      throw new ConvexError("INVALID_CLOSING");
    const previous = await ctx.db
      .query("stockDailyClosings")
      .withIndex("by_org_operation", (q) =>
        q.eq("orgId", org._id).eq("operationKey", args.operationKey),
      )
      .unique();
    if (previous) {
      if (previous.note !== note || previous.day !== args.day)
        throw new ConvexError("CLOSING_REFERENCE_CONFLICT");
      return previous._id;
    }
    if (args.day !== indiaToday())
      throw new ConvexError("CLOSING_DATE_CHANGED");
    const current = await ctx.db
      .query("stockDailyClosings")
      .withIndex("by_org_day", (q) =>
        q.eq("orgId", org._id).eq("day", args.day),
      )
      .unique();
    if (current) throw new ConvexError("CLOSING_ALREADY_RECORDED");
    const [inventory, movements] = await Promise.all([
      ctx.db
        .query("inventory")
        .withIndex("by_org", (q) => q.eq("orgId", org._id))
        .take(501),
      ctx.db
        .query("inventoryMovements")
        .withIndex("by_org_material", (q) => q.eq("orgId", org._id))
        .take(10_001),
    ]);
    if (inventory.length > 500 || movements.length > 10_000)
      throw new ConvexError("STOCK_CLOSING_LIMIT");
    const snapshot = closingSnapshot(inventory, movements);
    const createdAt = Date.now();
    const id = await ctx.db.insert("stockDailyClosings", {
      orgId: org._id,
      actorProfileId: profile._id,
      operationKey: args.operationKey,
      day: args.day,
      note,
      ...snapshot,
      createdAt,
    });
    await ctx.db.insert("auditLog", {
      orgId: org._id,
      actorProfileId: profile._id,
      action: "stock.daily_closed",
      entityTable: "stockDailyClosings",
      entityId: id,
      metadata: {
        day: args.day,
        totalGrams: snapshot.totalGrams,
        totalCostPaise: snapshot.totalCostPaise,
        materials: snapshot.lines.length,
      },
      createdAt,
    });
    return id;
  },
});
export const configure = mutation({
  args: {
    materialCode: v.string(),
    enabled: v.boolean(),
    thresholdGrams: v.number(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { org, profile } = await requireOrg(ctx);
    if (!Number.isSafeInteger(args.thresholdGrams) || args.thresholdGrams < 0)
      throw new ConvexError("INVALID_WEIGHT");
    const material = await ctx.db
      .query("materials")
      .withIndex("by_code", (q) => q.eq("code", args.materialCode))
      .unique();
    if (!material?.active || !org.families.includes(material.family))
      throw new ConvexError("MATERIAL_NOT_ELIGIBLE");
    const rules = await ctx.db
      .query("stockThresholds")
      .withIndex("by_org", (q) => q.eq("orgId", org._id))
      .take(501);
    const previous = rules.find(
      (row) => row.materialCode === args.materialCode,
    );
    if (!previous && rules.length >= 500)
      throw new ConvexError("STOCK_CLOSING_LIMIT");
    if (
      previous?.enabled === args.enabled &&
      previous.thresholdGrams === args.thresholdGrams &&
      previous.recipientProfileId === profile._id
    )
      return null;
    const inventory = await ctx.db
      .query("inventory")
      .withIndex("by_org_material", (q) =>
        q.eq("orgId", org._id).eq("materialCode", args.materialCode),
      )
      .unique();
    const updatedAt = Date.now();
    const values = {
      orgId: org._id,
      materialCode: args.materialCode,
      enabled: args.enabled,
      thresholdGrams: args.thresholdGrams,
      below: (inventory?.grams ?? 0) < args.thresholdGrams,
      recipientProfileId: profile._id,
      updatedAt,
    };
    const id = previous
      ? previous._id
      : await ctx.db.insert("stockThresholds", values);
    if (previous) await ctx.db.replace("stockThresholds", previous._id, values);
    await ctx.db.insert("auditLog", {
      orgId: org._id,
      actorProfileId: profile._id,
      action: "stock.threshold_configured",
      entityTable: "stockThresholds",
      entityId: id,
      metadata: {
        materialCode: args.materialCode,
        enabled: args.enabled,
        thresholdGrams: args.thresholdGrams,
      },
      createdAt: updatedAt,
    });
    return null;
  },
});
