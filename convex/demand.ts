import { ConvexError, v } from "convex/values";

import type { Doc } from "./_generated/dataModel";
import { mutation, query, type QueryCtx } from "./_generated/server";
import { buyerKindFor } from "./lib/chain";
import { canDemand, createDemand } from "./lib/demand";
import { ECOSYSTEM_PAGE, scheduleBounds } from "./lib/ecosystem";
import { isOrdinaryMaterial } from "./lib/materialEligibility";
import { canSupply } from "./lib/sourcing";
import { vOrgKind } from "./lib/validators";
import { vMaterialRef } from "./lib/views";
import { requireOrg } from "./lib/workspace";

const vDemand = v.object({
  id: v.id("materialDemands"),
  material: vMaterialRef,
  quantityGrams: v.number(),
  city: v.string(),
  area: v.string(),
  specification: v.string(),
  neededBy: v.string(),
  status: v.union(v.literal("open"), v.literal("closed")),
  buyer: v.object({ name: v.string(), kind: vOrgKind }),
});

async function materialsFor(ctx: QueryCtx) {
  return ctx.db.query("materials").withIndex("by_sortOrder").take(200);
}

function isMaterialEligible(org: Doc<"orgs">, material: Doc<"materials">) {
  return isOrdinaryMaterial(material) && org.families.includes(material.family);
}

function view(
  row: Doc<"materialDemands">,
  buyer: Doc<"orgs">,
  material: Doc<"materials">,
) {
  return {
    id: row._id,
    material: {
      code: material.code,
      names: material.names,
      family: material.family,
    },
    quantityGrams: row.quantityGrams,
    city: row.city,
    area: row.area,
    specification: row.specification,
    neededBy: row.neededBy,
    status: row.status,
    buyer: { name: buyer.name, kind: buyer.kind },
  };
}

export const board = query({
  args: {},
  returns: v.object({
    today: v.string(),
    maxDate: v.string(),
    canPost: v.boolean(),
    materials: v.array(vMaterialRef),
    mine: v.array(vDemand),
    available: v.array(vDemand),
    truncated: v.boolean(),
  }),
  handler: async (ctx) => {
    const { org } = await requireOrg(ctx, undefined, "read");
    const { today, maxDate } = scheduleBounds();
    const materials = await materialsFor(ctx);
    const indexed = new Map(
      materials.map((material) => [material.code, material]),
    );
    const own = await ctx.db
      .query("materialDemands")
      .withIndex("by_org", (q) => q.eq("orgId", org._id))
      .order("desc")
      .take(ECOSYSTEM_PAGE + 1);
    const buyerKind = buyerKindFor(org.kind);
    const familyPages = await Promise.all(
      [...new Set(org.families)].map((family) => {
        if (org.kind === "manufacturer")
          return ctx.db
            .query("materialDemands")
            .withIndex("by_city_status_family_neededBy", (q) =>
              q
                .eq("city", org.city)
                .eq("status", "open")
                .eq("family", family)
                .gte("neededBy", today),
            )
            .take(ECOSYSTEM_PAGE + 1);
        return buyerKind
          ? ctx.db
              .query("materialDemands")
              .withIndex("by_city_status_buyerKind_family_neededBy", (q) =>
                q
                  .eq("city", org.city)
                  .eq("status", "open")
                  .eq("buyerKind", buyerKind)
                  .eq("family", family)
                  .gte("neededBy", today),
              )
              .take(ECOSYSTEM_PAGE + 1)
          : Promise.resolve([]);
      }),
    );
    const rows = familyPages
      .flat()
      .toSorted(
        (a, b) =>
          a.neededBy.localeCompare(b.neededBy) ||
          a._creationTime - b._creationTime,
      );
    const mine = own.slice(0, ECOSYSTEM_PAGE).flatMap((row) => {
      const material = indexed.get(row.materialCode);
      return material ? [view(row, org, material)] : [];
    });
    const available = [];
    for (const row of rows) {
      if (row.orgId === org._id) continue;
      const buyer = await ctx.db.get("orgs", row.orgId);
      const material = indexed.get(row.materialCode);
      if (
        !material ||
        buyer?.status !== "active" ||
        buyer.city !== org.city ||
        !canSupply(org, buyer, material) ||
        !isMaterialEligible(org, material) ||
        !isMaterialEligible(buyer, material)
      )
        continue;
      available.push(view(row, buyer, material));
      if (available.length > ECOSYSTEM_PAGE) break;
    }
    return {
      today,
      maxDate,
      canPost:
        org.status === "active" &&
        materials.some((material) => canDemand(org, material)),
      materials: materials
        .filter((material) => canDemand(org, material))
        .map(({ code, names, family }) => ({ code, names, family })),
      mine,
      available:
        org.status === "active" ? available.slice(0, ECOSYSTEM_PAGE) : [],
      truncated:
        own.length > ECOSYSTEM_PAGE ||
        available.length > ECOSYSTEM_PAGE ||
        familyPages.some((page) => page.length > ECOSYSTEM_PAGE),
    };
  },
});

export const post = mutation({
  args: {
    materialCode: v.string(),
    quantityGrams: v.number(),
    area: v.string(),
    specification: v.string(),
    neededBy: v.string(),
  },
  returns: v.id("materialDemands"),
  handler: async (ctx, args) => {
    const { org, profile } = await requireOrg(ctx);
    return createDemand(ctx, org, profile, args);
  },
});

export const close = mutation({
  args: { demandId: v.id("materialDemands") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { org, profile } = await requireOrg(ctx);
    const row = await ctx.db.get("materialDemands", args.demandId);
    if (row?.orgId !== org._id) throw new ConvexError("DEMAND_NOT_FOUND");
    if (row.status === "closed") return null;
    const now = Date.now();
    await ctx.db.patch("materialDemands", row._id, {
      status: "closed",
      updatedAt: now,
    });
    await ctx.db.insert("auditLog", {
      orgId: org._id,
      actorProfileId: profile._id,
      action: "demand.closed",
      entityTable: "materialDemands",
      entityId: row._id,
      createdAt: now,
    });
    return null;
  },
});
