/// <reference types="vite/client" />
// @vitest-environment edge-runtime
import { convexTest } from "convex-test";
import { afterEach, expect, it, vi } from "vitest";

import { api, internal } from "./_generated/api";
import {
  convexModules,
  registerAuth,
  seedDemo,
  signInAs,
} from "./lib/auth.testing";
import schema from "./schema";

const modules = convexModules(import.meta.glob("./**/*.*s"));
afterEach(() => {
  vi.unstubAllEnvs();
  vi.useRealTimers();
});

it("saves frozen estimates once, denies unrelated access and deletes only the owner's entry", async () => {
  vi.stubEnv("AUTH_DEV_MODE", "true");
  vi.stubEnv("BETTER_AUTH_SECRET", "local-test-secret-000000000000000");
  const t = convexTest(schema, modules);
  registerAuth(t);
  await seedDemo(t);
  const owner = await signInAs(t, "+919000000109");
  const outsider = await signInAs(t, "+919000000108");
  await outsider.mutation(api.identity.ensureProfile, { locale: "en" });
  const input = {
    operationKey: "00000000-0000-0000-0000-000000000001",
    periodStart: "2026-01-01",
    periodEnd: "2026-01-31",
    wattHours: 100_001,
    consent: true as const,
  };
  await expect(t.query(api.householdFootprints.mine, {})).rejects.toThrow(
    "NOT_SIGNED_IN",
  );
  const id = await owner.mutation(api.householdFootprints.save, input);
  expect(await owner.mutation(api.householdFootprints.save, input)).toBe(id);
  await expect(
    owner.mutation(api.householdFootprints.save, { ...input, wattHours: 1 }),
  ).rejects.toThrow("OPERATION_CONFLICT");
  const rows = await owner.query(api.householdFootprints.mine, {});
  expect(rows).toHaveLength(1);
  expect(rows[0]).toMatchObject({
    milliGramsCO2: 67_500_675,
    factorVersion: "CEA v22.0 FY2025-26 Table S",
  });
  expect(await outsider.query(api.householdFootprints.mine, {})).toEqual([]);
  await expect(
    outsider.mutation(api.householdFootprints.remove, { id }),
  ).rejects.toThrow("FOOTPRINT_UNAVAILABLE");
  await owner.mutation(api.householdFootprints.remove, { id });
  expect(await owner.query(api.householdFootprints.mine, {})).toEqual([]);
  const audit = await t.run((ctx) => ctx.db.query("auditLog").collect());
  expect(
    audit.filter((r) => r.action === "household.footprint_saved"),
  ).toHaveLength(1);
  expect(
    audit.filter((r) => r.action === "household.footprint_removed"),
  ).toHaveLength(1);
});

it("clears footprint readings in account removal phase 26", async () => {
  vi.stubEnv("AUTH_DEV_MODE", "true");
  vi.stubEnv("BETTER_AUTH_SECRET", "local-test-secret-000000000000000");
  const t = convexTest(schema, modules);
  registerAuth(t);
  await seedDemo(t);
  const owner = await signInAs(t, "+919000000109");
  await owner.mutation(api.householdFootprints.save, {
    operationKey: "00000000-0000-0000-0000-000000000002",
    periodStart: "2026-01-01",
    periodEnd: "2026-01-01",
    wattHours: 1,
    consent: true,
  });
  const requestId = await t.run(async (ctx) => {
    const row = await ctx.db.query("householdFootprints").first();
    if (!row) throw new Error("Missing log");
    const profile = await ctx.db.get(row.profileId);
    if (!profile) throw new Error("Missing profile");
    await ctx.db.patch(profile._id, { closedAt: Date.now() });
    const id = await ctx.db.insert("accountRemovals", {
      profileId: profile._id,
      authUserId: profile.authUserId,
      operationKey: "cleanup-footprint",
      phase: 26,
      state: "cleanup_running",
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
    await ctx.db.patch(profile._id, { removalRequestId: id });
    return id;
  });
  await t.mutation(internal.accountRemoval.cleanup, { requestId });
  expect(
    await t.run((ctx) => ctx.db.query("householdFootprints").collect()),
  ).toEqual([]);
});
