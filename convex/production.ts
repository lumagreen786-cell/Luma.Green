import { ConvexError, v } from "convex/values";

import type { Doc } from "./_generated/dataModel";
import { mutation, query, type QueryCtx } from "./_generated/server";
import {
  nonnegativeGrams,
  positiveGrams,
  requiredLabel,
} from "./lib/lotEvidence";
import { vProductionInput, vRecipeIngredient } from "./lib/operationalSchema";
import { vRecordedCost } from "./lib/processingCostSchema";
import {
  isCurrentAcceptedInspection,
  requireQualityRelease,
} from "./lib/qualityRelease";
import { requireOrg } from "./lib/workspace";

export function recipeTotal(
  ingredients: readonly {
    name: string;
    basisPoints: number;
    additive: boolean;
  }[],
) {
  if (ingredients.length === 0 || ingredients.length > 20)
    throw new ConvexError("INVALID_RECIPE");
  let total = 0;
  const names = new Set<string>();
  for (const ingredient of ingredients) {
    const name = requiredLabel(ingredient.name).toLowerCase();
    if (
      names.has(name) ||
      !Number.isSafeInteger(ingredient.basisPoints) ||
      ingredient.basisPoints <= 0 ||
      ingredient.basisPoints > 10_000
    )
      throw new ConvexError("INVALID_RECIPE");
    names.add(name);
    total += ingredient.basisPoints;
  }
  if (total !== 10_000) throw new ConvexError("RECIPE_MUST_TOTAL_100_PERCENT");
  return total;
}
function evidence(value: string) {
  const text = value.trim();
  if (text.length < 3 || text.length > 500)
    throw new ConvexError("INVALID_REFERENCE");
  return text;
}
const recipeView = v.object({
  id: v.id("productionRecipes"),
  reference: v.string(),
  version: v.string(),
  name: v.string(),
  ingredients: v.array(vRecipeIngredient),
  instructions: v.string(),
  createdAt: v.number(),
});
const batchView = v.object({
  recipeName: v.union(v.string(), v.null()),
  recipeVersion: v.union(v.string(), v.null()),
  transformationCreatedAt: v.union(v.number(), v.null()),
  processingCostPaise: vRecordedCost,
  consumedInputCostPaise: vRecordedCost,
  totalOutputCostPaise: vRecordedCost,
  inspectionReference: v.union(v.string(), v.null()),
  id: v.id("productionDeclarations"),
  reference: v.string(),
  recipeId: v.id("productionRecipes"),
  transformationId: v.id("lotTransformations"),
  inspectionId: v.id("lotInspections"),
  inputs: v.array(vProductionInput),
  inputGrams: v.number(),
  recycledInputGrams: v.number(),
  outputGrams: v.number(),
  recycledInputBasisPoints: v.number(),
  evidenceReference: v.string(),
  createdAt: v.number(),
});
async function transformationChoice(
  ctx: QueryCtx,
  row: Doc<"lotTransformations">,
) {
  const edges = await ctx.db
    .query("lotTransformationInputs")
    .withIndex("by_transformation", (q) => q.eq("transformationId", row._id))
    .take(21);
  let inputs = edges.map((e) => ({
    lotId: e.lotId,
    materialCode: e.materialCode,
    grams: e.grams,
  }));
  if (edges.length === 0) {
    const primary = await ctx.db.get("materialLots", row.inputLotId);
    inputs = primary
      ? [
          {
            lotId: primary._id,
            materialCode: primary.materialCode,
            grams: row.inputGrams,
          },
        ]
      : [];
  }
  const outputs = await ctx.db
    .query("materialLots")
    .withIndex("by_parent_transformation", (q) =>
      q.eq("parentTransformationId", row._id),
    )
    .take(11);
  const inspections = [];
  for (const output of outputs) {
    const records = await ctx.db
      .query("lotInspections")
      .withIndex("by_lot_created", (q) => q.eq("lotId", output._id))
      .order("desc")
      .take(10);
    for (const r of records)
      if (r.orgId === row.orgId && (await isCurrentAcceptedInspection(ctx, r)))
        inspections.push({
          id: r._id,
          reference: r.specificationReference,
          decision: r.decision,
        });
  }
  return {
    id: row._id,
    processingCostPaise: row.processingCostPaise ?? null,
    consumedInputCostPaise: row.consumedInputCostPaise ?? null,
    totalOutputCostPaise: row.totalOutputCostPaise ?? null,
    inputGrams: row.inputGrams,
    createdAt: row.createdAt,
    inputs,
    inspections,
  };
}
async function batchSummary(
  ctx: QueryCtx,
  batch: Doc<"productionDeclarations">,
) {
  const recipe = await ctx.db.get("productionRecipes", batch.recipeId);
  const transformation = await ctx.db.get(
    "lotTransformations",
    batch.transformationId,
  );
  const inspection = await ctx.db.get("lotInspections", batch.inspectionId);
  return {
    id: batch._id,
    reference: batch.reference,
    recipeId: batch.recipeId,
    transformationId: batch.transformationId,
    inspectionId: batch.inspectionId,
    inputs: batch.inputs,
    inputGrams: batch.inputGrams,
    recycledInputGrams: batch.recycledInputGrams,
    outputGrams: batch.outputGrams,
    recycledInputBasisPoints: batch.recycledInputBasisPoints,
    evidenceReference: batch.evidenceReference,
    createdAt: batch.createdAt,
    recipeName: recipe?.orgId === batch.orgId ? recipe.name : null,
    recipeVersion: recipe?.orgId === batch.orgId ? recipe.version : null,
    transformationCreatedAt:
      transformation?.orgId === batch.orgId ? transformation.createdAt : null,
    processingCostPaise:
      transformation?.orgId === batch.orgId
        ? (transformation.processingCostPaise ?? null)
        : null,
    consumedInputCostPaise:
      transformation?.orgId === batch.orgId
        ? (transformation.consumedInputCostPaise ?? null)
        : null,
    totalOutputCostPaise:
      transformation?.orgId === batch.orgId
        ? (transformation.totalOutputCostPaise ?? null)
        : null,
    inspectionReference:
      inspection?.orgId === batch.orgId
        ? inspection.specificationReference
        : null,
  };
}
export const mine = query({
  args: {},
  returns: v.object({
    recipes: v.array(recipeView),
    batches: v.array(batchView),
    transformations: v.array(
      v.object({
        id: v.id("lotTransformations"),
        processingCostPaise: vRecordedCost,
        consumedInputCostPaise: vRecordedCost,
        totalOutputCostPaise: vRecordedCost,
        inputGrams: v.number(),
        createdAt: v.number(),
        inputs: v.array(
          v.object({
            lotId: v.id("materialLots"),
            materialCode: v.string(),
            grams: v.number(),
          }),
        ),
        inspections: v.array(
          v.object({
            id: v.id("lotInspections"),
            reference: v.string(),
            decision: v.string(),
          }),
        ),
      }),
    ),
    truncated: v.boolean(),
  }),
  handler: async (ctx) => {
    const { org } = await requireOrg(ctx, undefined, "read");
    const recipes = await ctx.db
      .query("productionRecipes")
      .withIndex("by_org_created", (q) => q.eq("orgId", org._id))
      .order("desc")
      .take(101);
    const batches = await ctx.db
      .query("productionDeclarations")
      .withIndex("by_org_created", (q) => q.eq("orgId", org._id))
      .order("desc")
      .take(101);
    const transformations = await ctx.db
      .query("lotTransformations")
      .withIndex("by_org_created", (q) => q.eq("orgId", org._id))
      .order("desc")
      .take(51);
    const choices = await Promise.all(
      transformations.slice(0, 50).map((row) => transformationChoice(ctx, row)),
    );
    return {
      recipes: recipes
        .slice(0, 100)
        .map(
          ({
            _id,
            reference,
            version,
            name,
            ingredients,
            instructions,
            createdAt,
          }) => ({
            id: _id,
            reference,
            version,
            name,
            ingredients,
            instructions,
            createdAt,
          }),
        ),
      batches: await Promise.all(
        batches.slice(0, 100).map((batch) => batchSummary(ctx, batch)),
      ),
      transformations: choices,
      truncated:
        recipes.length > 100 ||
        batches.length > 100 ||
        transformations.length > 50,
    };
  },
});
export const recordRecipe = mutation({
  args: {
    reference: v.string(),
    version: v.string(),
    name: v.string(),
    ingredients: v.array(vRecipeIngredient),
    instructions: v.string(),
  },
  returns: v.id("productionRecipes"),
  handler: async (ctx, args) => {
    const { org, profile } = await requireOrg(ctx);
    recipeTotal(args.ingredients);
    const fields = {
      reference: requiredLabel(args.reference),
      version: requiredLabel(args.version),
      name: requiredLabel(args.name),
      ingredients: args.ingredients.map((x) => ({
        ...x,
        name: requiredLabel(x.name),
      })),
      instructions: evidence(args.instructions),
    };
    const existing = await ctx.db
      .query("productionRecipes")
      .withIndex("by_org_reference_version", (q) =>
        q
          .eq("orgId", org._id)
          .eq("reference", fields.reference)
          .eq("version", fields.version),
      )
      .unique();
    if (existing) {
      if (
        existing.name === fields.name &&
        existing.instructions === fields.instructions &&
        JSON.stringify(existing.ingredients) ===
          JSON.stringify(fields.ingredients)
      )
        return existing._id;
      throw new ConvexError("RECIPE_VERSION_EXISTS");
    }
    const id = await ctx.db.insert("productionRecipes", {
      ...fields,
      orgId: org._id,
      actorProfileId: profile._id,
      createdAt: Date.now(),
    });
    await ctx.db.insert("auditLog", {
      orgId: org._id,
      actorProfileId: profile._id,
      action: "production.recipeRecorded",
      entityTable: "productionRecipes",
      entityId: id,
      createdAt: Date.now(),
    });
    return id;
  },
});
export const declareBatch = mutation({
  args: {
    reference: v.string(),
    recipeId: v.id("productionRecipes"),
    transformationId: v.id("lotTransformations"),
    inspectionId: v.id("lotInspections"),
    inputs: v.array(vProductionInput),
    evidenceReference: v.string(),
  },
  returns: v.id("productionDeclarations"),
  handler: async (ctx, args) => {
    const { org, profile } = await requireOrg(ctx);
    const reference = requiredLabel(args.reference);
    const evidenceReference = evidence(args.evidenceReference);
    const recipe = await ctx.db.get("productionRecipes", args.recipeId);
    const transformation = await ctx.db.get(
      "lotTransformations",
      args.transformationId,
    );
    const inspection = await ctx.db.get("lotInspections", args.inspectionId);
    if (
      recipe?.orgId !== org._id ||
      transformation?.orgId !== org._id ||
      inspection?.orgId !== org._id
    )
      throw new ConvexError("PRODUCTION_RECORD_NOT_FOUND");
    const inspectedLot = await ctx.db.get("materialLots", inspection.lotId);
    if (inspectedLot?.parentTransformationId !== transformation._id)
      throw new ConvexError("INSPECTION_OUTPUT_MISMATCH");
    await requireQualityRelease(ctx, inspectedLot, inspection._id);
    const edges = await ctx.db
      .query("lotTransformationInputs")
      .withIndex("by_transformation", (q) =>
        q.eq("transformationId", transformation._id),
      )
      .take(21);
    const expected =
      edges.length > 0
        ? edges.map((e) => ({ lotId: e.lotId, grams: e.grams }))
        : [
            {
              lotId: transformation.inputLotId,
              grams: transformation.inputGrams,
            },
          ];
    if (
      args.inputs.length !== expected.length ||
      expected.length > 20 ||
      new Set(args.inputs.map((x) => x.lotId)).size !== expected.length
    )
      throw new ConvexError("PRODUCTION_INPUT_MISMATCH");
    // eslint-disable-next-line unicorn/prefer-bigint-literals -- This module is also checked by the web ES2017 target.
    let recycled = BigInt(0);
    const inputs = args.inputs.map((input) => {
      const match = expected.find((x) => x.lotId === input.lotId);
      positiveGrams(input.grams);
      nonnegativeGrams(input.recycledGrams);
      if (input.grams !== match?.grams || input.recycledGrams > input.grams)
        throw new ConvexError("PRODUCTION_INPUT_MISMATCH");
      recycled += BigInt(input.recycledGrams);
      return { ...input, evidenceReference: evidence(input.evidenceReference) };
    });
    if (recycled > BigInt(transformation.inputGrams))
      throw new ConvexError("PRODUCTION_INPUT_MISMATCH");
    const outputGrams =
      transformation.inputGrams -
      transformation.contaminationGrams -
      transformation.processLossGrams;
    positiveGrams(outputGrams);
    const fields = {
      reference,
      recipeId: recipe._id,
      transformationId: transformation._id,
      inspectionId: inspection._id,
      inputs,
      inputGrams: transformation.inputGrams,
      recycledInputGrams: Number(recycled),
      outputGrams,
      recycledInputBasisPoints: Number(
        // eslint-disable-next-line unicorn/prefer-bigint-literals -- Keep exact arithmetic compatible with the web ES2017 type target.
        (recycled * BigInt(10_000)) / BigInt(transformation.inputGrams),
      ),
      evidenceReference,
    };
    const existing = await ctx.db
      .query("productionDeclarations")
      .withIndex("by_org_reference", (q) =>
        q.eq("orgId", org._id).eq("reference", reference),
      )
      .unique();
    if (existing) {
      if (
        existing.recipeId === fields.recipeId &&
        existing.transformationId === fields.transformationId &&
        existing.inspectionId === fields.inspectionId &&
        existing.evidenceReference === fields.evidenceReference &&
        JSON.stringify(existing.inputs) === JSON.stringify(fields.inputs)
      )
        return existing._id;
      throw new ConvexError("PRODUCTION_REFERENCE_EXISTS");
    }
    const duplicate = await ctx.db
      .query("productionDeclarations")
      .withIndex("by_transformation", (q) =>
        q.eq("transformationId", transformation._id),
      )
      .first();
    if (duplicate) throw new ConvexError("PRODUCTION_ALREADY_DECLARED");
    const id = await ctx.db.insert("productionDeclarations", {
      ...fields,
      orgId: org._id,
      actorProfileId: profile._id,
      createdAt: Date.now(),
    });
    await ctx.db.insert("auditLog", {
      orgId: org._id,
      actorProfileId: profile._id,
      action: "production.batchDeclared",
      entityTable: "productionDeclarations",
      entityId: id,
      metadata: {
        transformationId: transformation._id,
        declaredRecycledInputGrams: fields.recycledInputGrams,
        certification: false,
        inventoryChanged: false,
      },
      createdAt: Date.now(),
    });
    return id;
  },
});
