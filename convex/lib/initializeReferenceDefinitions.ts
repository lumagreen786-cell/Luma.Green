import { ConvexError, v } from "convex/values";

import type { Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import {
  foundationMaterials,
  PET_REFERENCE_DEFINITIONS,
  PET_REFERENCE_SOURCE,
} from "./referenceDefinitions";

export const referenceInitializationCounts = v.object({
  inserted: v.number(),
  definitionsInserted: v.number(),
  materialsSkipped: v.number(),
  definitionsSkipped: v.number(),
});

interface ReferenceActor {
  createdBy: string;
  actorProfileId?: Id<"profiles">;
  metadata:
    | { adminUserId: string }
    | { operatorReference: string; source: "deployment_operator" };
}

/** Static references only. Both entry points use this same transactional owner. */
export async function initializeReferenceDefinitions(
  ctx: MutationCtx,
  actor: ReferenceActor,
) {
  // Static, bounded input; never scan or replace the live catalogue.
  const materials = foundationMaterials();
  let inserted = 0;
  let definitionsInserted = 0;
  const now = Date.now();
  for (const [sortOrder, entry] of materials.entries()) {
    const existing = await ctx.db
      .query("materials")
      .withIndex("by_code", (q) => q.eq("code", entry.code))
      .unique();
    if (existing) {
      if (existing.family !== entry.family || existing.stage !== entry.stage)
        throw new ConvexError("MATERIAL_DEFINITION_CONFLICT");
      continue;
    }
    // Deliberately select fields: the source also contains prototype prices
    // and indicative factors, neither of which is a production input.
    const definition = {
      code: entry.code,
      family: entry.family,
      stage: entry.stage,
      names: entry.names,
      sortOrder,
      active: entry.active,
    };
    const id = await ctx.db.insert("materials", definition);
    await ctx.db.insert("auditLog", {
      actorProfileId: actor.actorProfileId,
      action: "material.definitionInitialized",
      entityTable: "materials",
      entityId: id,
      metadata: {
        ...actor.metadata,
        definition,
        factorStatus: "unknown",
        sourceReference: PET_REFERENCE_DEFINITIONS.some(
          ({ materialCode }) => materialCode === entry.code,
        )
          ? PET_REFERENCE_SOURCE
          : "convex/lib/catalogue.ts: canonical material labels only",
        hazardApprovalGranted: false,
      },
      createdAt: now,
    });
    inserted += 1;
  }
  for (const definition of PET_REFERENCE_DEFINITIONS) {
    const existing = await ctx.db
      .query("operationalDefinitions")
      .withIndex("by_material_version", (q) =>
        q
          .eq("materialCode", definition.materialCode)
          .eq("version", definition.version),
      )
      .unique();
    if (existing) {
      if (
        existing.family !== definition.family ||
        existing.stage !== definition.stage
      )
        throw new ConvexError("MATERIAL_DEFINITION_CONFLICT");
      // Preserve drafts and all later reviewed or retired content exactly.
      continue;
    }
    const id = await ctx.db.insert("operationalDefinitions", {
      ...definition,
      status: "draft",
      createdBy: actor.createdBy,
      createdAt: now,
    });
    await ctx.db.insert("auditLog", {
      actorProfileId: actor.actorProfileId,
      action: "catalogue.definitionDrafted",
      entityTable: "operationalDefinitions",
      entityId: id,
      metadata: {
        ...actor.metadata,
        ...definition,
        initialization: true,
        hazardApprovalGranted: false,
      },
      createdAt: now,
    });
    definitionsInserted += 1;
  }
  return {
    inserted,
    definitionsInserted,
    materialsSkipped: materials.length - inserted,
    definitionsSkipped: PET_REFERENCE_DEFINITIONS.length - definitionsInserted,
  };
}
