/// <reference types="vite/client" />
// @vitest-environment edge-runtime
import { convexTest } from "convex-test";
import { afterEach, expect, it, vi } from "vitest";

import { api } from "./_generated/api";
import {
  convexModules,
  registerAuth,
  seedDemo,
  signIn,
  signInAs,
} from "./lib/auth.testing";
import schema from "./schema";
const modules = convexModules(import.meta.glob("./**/*.*s"));
afterEach(() => vi.unstubAllEnvs());
async function world() {
  vi.stubEnv("ADMIN_EMAIL", "admin@luma.test");
  vi.stubEnv("AUTH_DEV_MODE", "true");
  const t = convexTest(schema, modules);
  registerAuth(t);
  await seedDemo(t);
  const admin = await signIn(t, {
    email: "admin@luma.test",
    twoFactorEnabled: true,
  });
  const owner = await signInAs(t, "+919000000102");
  return { t, admin, owner };
}
const draft = {
  materialCode: "PLASTIC-NEW-GRADE",
  name: "Reviewed test polymer",
  family: "plastic" as const,
  stage: "recycled" as const,
  processingState: "Washed flakes",
  grade: "Clear",
  version: "Clear-v1",
  specification: "Moisture limit defined by buyer test specification",
  sourceReference: "Written standard TEST-42",
};
it("keeps drafts private and activation separate from hazard and impact approval", async () => {
  const { t, admin, owner } = await world();
  const id = await admin.mutation(api.operationalCatalogue.draft, draft);
  const result0 = await owner.query(api.operationalCatalogue.active, {
    search: "Washed",
  });
  expect(result0.rows).toHaveLength(0);
  await admin.mutation(api.operationalCatalogue.review, {
    id,
    decision: "active",
    reference: "Reviewed TEST-42",
  });
  const result1 = await owner.query(api.operationalCatalogue.active, {
    search: "clear",
  });
  expect(result1.rows).toHaveLength(1);
  const material = await t.run((ctx) =>
    ctx.db
      .query("materials")
      .withIndex("by_code", (q) => q.eq("code", draft.materialCode))
      .unique(),
  );
  expect(material).toMatchObject({ active: true, family: "plastic" });
  expect(material).not.toHaveProperty("hazardStatus");
  expect(material).not.toHaveProperty("co2eFactor");
  await admin.mutation(api.operationalCatalogue.review, {
    id,
    decision: "retired",
    reference: "Replaced by a newer definition",
  });
  const result2 = await owner.query(api.operationalCatalogue.active, {
    search: "clear",
  });
  expect(result2.rows).toHaveLength(0);
});
it("denies ordinary users, duplicate versions and conflicting existing material families", async () => {
  const { admin, owner } = await world();
  await expect(
    owner.mutation(api.operationalCatalogue.draft, draft),
  ).rejects.toThrow(/NOT_ADMIN/);
  await admin.mutation(api.operationalCatalogue.draft, draft);
  await expect(
    admin.mutation(api.operationalCatalogue.draft, draft),
  ).rejects.toThrow(/DEFINITION_VERSION_EXISTS/);
  const id = await admin.mutation(api.operationalCatalogue.draft, {
    ...draft,
    materialCode: "PLASTIC-PET",
    family: "paper",
  });
  await expect(
    admin.mutation(api.operationalCatalogue.review, {
      id,
      decision: "active",
      reference: "Conflicting review",
    }),
  ).rejects.toThrow(/MATERIAL_DEFINITION_CONFLICT/);
});

it("initialization preserves reviewed and retired records and review audits material activation", async () => {
  const { t, admin, owner } = await world();
  // seedDemo already owns some canonical materials; counts report what was added.
  const initialMaterials = await t.run((ctx) =>
    ctx.db.query("materials").collect(),
  );
  const result = await admin.mutation(api.catalogue.initializeDefinitions, {});
  expect(result.inserted + result.materialsSkipped).toBe(45);
  expect(result.materialsSkipped).toBe(initialMaterials.length);
  expect(result.definitionsInserted).toBe(21);
  const definitions = await admin.query(api.operationalCatalogue.adminList, {});
  const hotFlake = definitions.find(
    ({ materialCode }) => materialCode === "RECYCLED-PET-HOT-FLAKE",
  );
  const bale = definitions.find(
    ({ materialCode }) => materialCode === "PLASTIC-PET-BALE",
  );
  if (!hotFlake || !bale) throw new Error("Missing reference definitions");
  const beforeReview = await owner.query(api.operationalCatalogue.active, {
    search: "",
  });
  expect(beforeReview.rows).toEqual([]);
  await admin.mutation(api.operationalCatalogue.review, {
    id: hotFlake.id,
    decision: "active",
    reference: "Facility and buyer specification reviewed separately",
  });
  await admin.mutation(api.operationalCatalogue.review, {
    id: bale.id,
    decision: "retired",
    reference: "Reference rejected by reviewer",
  });
  const before = await t.run(async (ctx) => ({
    definitions: await ctx.db.query("operationalDefinitions").collect(),
    materials: await ctx.db.query("materials").collect(),
    audit: await ctx.db.query("auditLog").collect(),
  }));
  expect(
    before.materials.find(({ code }) => code === hotFlake.materialCode),
  ).toMatchObject({ active: true });
  expect(
    before.materials.find(({ code }) => code === bale.materialCode),
  ).toMatchObject({ active: false });
  expect(
    before.audit.filter(
      ({ action }) => action === "material.definitionActivated",
    ),
  ).toHaveLength(1);
  const materialAudit = before.audit.find(
    ({ action }) => action === "material.definitionActivated",
  );
  expect(materialAudit?.metadata).toMatchObject({
    previousActive: false,
    hazardApprovalGranted: false,
  });
  expect(await admin.mutation(api.catalogue.initializeDefinitions, {})).toEqual(
    {
      inserted: 0,
      definitionsInserted: 0,
      materialsSkipped: 45,
      definitionsSkipped: 21,
    },
  );
  expect(
    await t.run(async (ctx) => ({
      definitions: await ctx.db.query("operationalDefinitions").collect(),
      materials: await ctx.db.query("materials").collect(),
      audit: await ctx.db.query("auditLog").collect(),
    })),
  ).toEqual(before);
  const afterReview = await owner.query(api.operationalCatalogue.active, {
    search: "",
  });
  expect(afterReview.rows.map(({ materialCode }) => materialCode)).toEqual([
    hotFlake.materialCode,
  ]);
});
