// @vitest-environment edge-runtime
import { convexTest } from "convex-test";
import { afterEach, expect, it, vi } from "vitest";

import { api, components } from "./_generated/api";
import { convexModules, registerAuth, signIn } from "./lib/auth.testing";
import { privacyRequestKinds } from "./lib/privacyRequestSchema";
import schema from "./schema";

const modules = convexModules(import.meta.glob("./**/*.*s"));

function setup() {
  const t = convexTest(schema, modules);
  registerAuth(t);
  return t;
}

afterEach(() => {
  vi.unstubAllEnvs();
});

it("accepts all six categories and exposes case status only to its account", async () => {
  const t = setup();
  await expect(
    t.mutation(api.privacyRequests.submit, { kind: "access" }),
  ).rejects.toThrow(/NOT_SIGNED_IN/);
  await expect(t.query(api.privacyRequests.mine, {})).rejects.toThrow(
    /NOT_SIGNED_IN/,
  );

  const caller = await signIn(t, {
    email: "privacy-a@luma.test",
    phoneNumber: "+919000000001",
  });
  const other = await signIn(t, { email: "privacy-b@luma.test" });
  await caller.mutation(api.identity.ensureProfile, { locale: "en" });
  await other.mutation(api.identity.ensureProfile, { locale: "en" });

  const ids = await Promise.all(
    privacyRequestKinds.map((kind) =>
      caller.mutation(api.privacyRequests.submit, { kind }),
    ),
  );
  await expect(
    caller.mutation(api.privacyRequests.submit, { kind: "access" }),
  ).resolves.toBe(ids[0]);

  const rows = await caller.query(api.privacyRequests.mine, {});
  expect(rows).toHaveLength(6);
  expect(rows?.map((row) => row.kind)).toEqual(
    expect.arrayContaining([...privacyRequestKinds]),
  );
  expect(rows?.every((row) => row.status === "received")).toBe(true);
  expect(JSON.stringify(rows)).not.toContain("+919000000001");
  expect(JSON.stringify(rows)).not.toContain("profileId");
  expect(await other.query(api.privacyRequests.mine, {})).toEqual([]);
  await expect(other.query(api.privacyRequests.queue, {})).rejects.toThrow(
    /NOT_ADMIN/,
  );

  const audit = await t.run((ctx) =>
    ctx.db
      .query("auditLog")
      .withIndex("by_entity", (q) => q.eq("entityTable", "privacyRequests"))
      .collect(),
  );
  expect(audit).toHaveLength(6);
  expect(audit.every((row) => row.action === "privacy_request.received")).toBe(
    true,
  );
  expect(audit.every((row) => row.metadata === undefined)).toBe(true);
});

it("requires the admin factor to read or respond and preserves the case history", async () => {
  const t = setup();
  vi.stubEnv("ADMIN_EMAIL", "admin@luma.test");
  const owner = await signIn(t, {
    email: "owner@luma.test",
    phoneNumber: "+919000000002",
  });
  const admin = await signIn(t, { email: "admin@luma.test" });
  const profileId = await owner.mutation(api.identity.ensureProfile, {
    locale: "en",
  });
  const id = await owner.mutation(api.privacyRequests.submit, {
    kind: "grievance",
  });
  await expect(
    owner.mutation(api.privacyRequests.recordResponse, { id }),
  ).rejects.toThrow(/NOT_ADMIN/);
  await expect(admin.query(api.privacyRequests.queue, {})).rejects.toThrow(
    /TWO_FACTOR_REQUIRED/,
  );
  await expect(
    admin.mutation(api.privacyRequests.recordResponse, { id }),
  ).rejects.toThrow(/TWO_FACTOR_REQUIRED/);
  await t.run((ctx) =>
    ctx.runMutation(components.betterAuth.adapter.updateOne, {
      input: {
        model: "user",
        where: [{ field: "email", value: "admin@luma.test" }],
        update: { twoFactorEnabled: true },
      },
    }),
  );
  await admin.mutation(api.identity.ensureProfile, { locale: "en" });
  expect(await admin.query(api.privacyRequests.queue, {})).toMatchObject([
    { id, profileId, kind: "grievance", phone: "+919000000002" },
  ]);
  await t.run((ctx) =>
    ctx.runMutation(components.betterAuth.adapter.updateOne, {
      input: {
        model: "user",
        where: [{ field: "email", value: "owner@luma.test" }],
        update: { phoneNumberVerified: false },
      },
    }),
  );
  const unverifiedQueue = await admin.query(api.privacyRequests.queue, {});
  expect(unverifiedQueue[0]).not.toHaveProperty("phone");
  await admin.mutation(api.privacyRequests.recordResponse, { id });
  await admin.mutation(api.privacyRequests.recordResponse, { id });
  expect(await admin.query(api.privacyRequests.queue, {})).toEqual([]);
  expect(await owner.query(api.privacyRequests.mine, {})).toMatchObject([
    {
      id,
      kind: "grievance",
      status: "responded",
      respondedAt: expect.any(Number),
    },
  ]);
  expect(await owner.query(api.identity.me, {})).toMatchObject({
    hasProfile: true,
  });
  await expect(
    owner.mutation(api.privacyRequests.submit, { kind: "grievance" }),
  ).resolves.not.toBe(id);
  const audit = await t.run((ctx) =>
    ctx.db
      .query("auditLog")
      .withIndex("by_entity", (q) =>
        q.eq("entityTable", "privacyRequests").eq("entityId", id),
      )
      .collect(),
  );
  expect(audit.map((row) => row.action)).toEqual([
    "privacy_request.received",
    "privacy_request.responded",
  ]);
});
