/// <reference types="vite/client" />
// @vitest-environment edge-runtime
import { ConvexError } from "convex/values";
import { convexTest, type TestConvexForDataModel } from "convex-test";
import { afterEach, describe, expect, it, vi } from "vitest";

import { api, internal } from "./_generated/api";
import type { DataModel, Id } from "./_generated/dataModel";
import {
  convexModules,
  registerAuth,
  seedDemo,
  signInAs,
} from "./lib/auth.testing";
import {
  hashToken,
  INTEGRATION_DAY_MS,
  type IntegrationInventory,
  type IntegrationMaterial,
  type IntegrationOrganization,
  type IntegrationResource,
  type IntegrationScope,
  integrationScopes,
  type IntegrationTrade,
  isIntegrationToken,
  isInvalidIntegrationCursor,
} from "./lib/integrations";
import schema from "./schema";

const modules = convexModules(import.meta.glob("./**/*.*s"));
const shopPhone = "+919000000101";
const factoryPhone = "+919000000104";

type Test = TestConvexForDataModel<DataModel>;
interface Page<T> {
  data: T[];
  pagination: { nextCursor: string | null; isDone: boolean };
}

async function world() {
  vi.stubEnv("AUTH_DEV_MODE", "true");
  const t = convexTest(schema, modules);
  registerAuth(t);
  await seedDemo(t);
  const owner = await signInAs(t, shopPhone);
  return { t, owner };
}

async function issue(
  owner: Test,
  scopes: IntegrationScope[] = [...integrationScopes],
) {
  const key = await owner.action(api.integrations.createKey, {
    label: "Factory ERP",
    scopes,
    expiresInDays: 30,
  });
  return { ...key, keyHash: await hashToken(key.token) };
}

function read(
  t: Test,
  keyHash: string,
  resource: IntegrationResource = "organization",
  options: {
    limit?: number;
    cursor?: string | null;
    side?: "buyer" | "seller";
  } = {},
) {
  return t.mutation(internal.integrations.read, {
    keyHash,
    resource,
    limit: options.limit ?? 50,
    cursor: options.cursor ?? null,
    side: options.side ?? "buyer",
  });
}

async function keyRecord(t: Test, keyId: Id<"integrationKeys">) {
  const key = await t.run((ctx) => ctx.db.get("integrationKeys", keyId));
  if (!key) throw new Error("Missing fixture key");
  return key;
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.useRealTimers();
});

describe("machine credential lifecycle", () => {
  it("returns random tokens once, persists only hashes and omits secrets from listing and audit", async () => {
    const { t, owner } = await world();
    const first = await issue(owner);
    const second = await issue(owner);
    expect(isIntegrationToken(first.token)).toBe(true);
    expect(second.token).not.toBe(first.token);
    expect(first.keyHash).toMatch(/^[\da-f]{64}$/);
    expect(first.keyHash).not.toBe(first.token.slice(8));
    const saved = await keyRecord(t, first.keyId);
    expect(saved.keyHash).toBe(first.keyHash);
    expect(saved.prefix).toBe(first.token.slice(0, 16));
    expect(JSON.stringify(saved)).not.toContain(first.token);
    expect(first.expiresAt - saved.createdAt).toBe(30 * INTEGRATION_DAY_MS);
    const listing = await owner.query(api.integrations.listKeys, {});
    expect(listing.canManage).toBe(true);
    expect(listing.keys).toHaveLength(2);
    const audits = await t.run((ctx) =>
      ctx.db
        .query("auditLog")
        .withIndex("by_entity", (q) =>
          q.eq("entityTable", "integrationKeys").eq("entityId", first.keyId),
        )
        .collect(),
    );
    expect(audits).toHaveLength(1);
    expect(audits[0].action).toBe("integration.key_created");
    const exposed = JSON.stringify({ listing, audits });
    expect(exposed).not.toContain(first.token);
    expect(exposed).not.toContain(first.keyHash);
  });

  it("requires a live session in both issuance and the transaction that saves the key", async () => {
    const { t, owner } = await world();
    const key = await issue(owner);
    const record = await keyRecord(t, key.keyId);
    const profile = await t.run((ctx) =>
      ctx.db.get("profiles", record.issuerProfileId),
    );
    if (!profile) throw new Error("Missing fixture profile");
    const expiredIdentity = t.withIdentity({
      subject: profile.authUserId,
      sessionId: "missing-session",
    });
    const settings = {
      label: "Forged identity",
      scopes: ["organization:read"] as IntegrationScope[],
      expiresInDays: 1,
    };
    for (const caller of [t, expiredIdentity]) {
      await expect(
        caller.action(api.integrations.createKey, settings),
      ).rejects.toThrow(/NOT_SIGNED_IN/);
      await expect(
        caller.mutation(internal.integrations.persistKey, {
          ...settings,
          keyHash: "a".repeat(64),
          prefix: "lg_live_aaaaaaaa",
        }),
      ).rejects.toThrow(/NOT_SIGNED_IN/);
      await expect(caller.query(api.integrations.listKeys, {})).rejects.toThrow(
        /NOT_SIGNED_IN/,
      );
    }
  });

  it("blocks staff, households and suspended businesses from managing credentials", async () => {
    const { t, owner } = await world();
    const key = await issue(owner);
    const record = await keyRecord(t, key.keyId);
    const staffMembership = await t.run(async (ctx) => {
      const membership = await ctx.db
        .query("memberships")
        .withIndex("by_org_profile", (q) =>
          q.eq("orgId", record.orgId).eq("profileId", record.issuerProfileId),
        )
        .unique();
      if (!membership) throw new Error("Missing fixture membership");
      await ctx.db.patch("memberships", membership._id, { role: "staff" });
      return membership._id;
    });
    expect(await owner.query(api.integrations.listKeys, {})).toEqual({
      canManage: false,
      keys: [],
    });
    await expect(issue(owner)).rejects.toThrow(/API_OWNER_REQUIRED/);
    await expect(
      owner.mutation(api.integrations.revokeKey, { keyId: key.keyId }),
    ).rejects.toThrow(/API_OWNER_REQUIRED/);
    const household = await signInAs(t, "+919000000107");
    await expect(issue(household)).rejects.toThrow(/NO_BUSINESS/);
    await t.run(async (ctx) => {
      await ctx.db.patch("memberships", staffMembership, { role: "owner" });
      await ctx.db.patch("orgs", record.orgId, { status: "suspended" });
    });
    await expect(issue(owner)).rejects.toThrow(/NO_BUSINESS/);
    const suspendedKeys = await owner.query(api.integrations.listKeys, {});
    expect(suspendedKeys.canManage).toBe(false);
    expect(suspendedKeys.keys.map((row) => row.id)).toContain(key.keyId);
    await expect(
      owner.mutation(api.integrations.revokeKey, { keyId: key.keyId }),
    ).rejects.toThrow(/NO_BUSINESS/);
  });

  it.each([
    { label: "", scopes: ["organization:read"], expiresInDays: 30 },
    { label: "x".repeat(81), scopes: ["organization:read"], expiresInDays: 30 },
    { label: "Line\nBreak", scopes: ["organization:read"], expiresInDays: 30 },
    { label: "ERP", scopes: [], expiresInDays: 30 },
    {
      label: "ERP",
      scopes: ["organization:read", "organization:read"],
      expiresInDays: 30,
    },
    { label: "ERP", scopes: ["organization:read"], expiresInDays: 0 },
    { label: "ERP", scopes: ["organization:read"], expiresInDays: 91 },
    { label: "ERP", scopes: ["organization:read"], expiresInDays: 1.5 },
  ])("rejects invalid key settings: %j", async (settings) => {
    const { owner } = await world();
    await expect(
      owner.action(api.integrations.createKey, {
        ...settings,
        scopes: settings.scopes as IntegrationScope[],
      }),
    ).rejects.toThrow(/API_INVALID_KEY_SETTINGS/);
  });

  it("keeps the five-active-key cap under concurrent issuance and frees revoked or expired slots", async () => {
    const { t, owner } = await world();
    const results = await Promise.allSettled(
      Array.from({ length: 7 }, () => issue(owner)),
    );
    const created = results.flatMap((result) =>
      result.status === "fulfilled" ? [result.value] : [],
    );
    expect(created).toHaveLength(5);
    expect(
      results.filter((result) => result.status === "rejected"),
    ).toHaveLength(2);
    await owner.mutation(api.integrations.revokeKey, {
      keyId: created[0].keyId,
    });
    await expect(issue(owner)).resolves.toMatchObject({
      keyId: expect.any(String),
    });
    await t.run((ctx) =>
      ctx.db.patch("integrationKeys", created[1].keyId, {
        expiresAt: Date.now(),
      }),
    );
    await expect(issue(owner)).resolves.toMatchObject({
      keyId: expect.any(String),
    });
    await expect(issue(owner)).rejects.toThrow(/API_KEY_LIMIT/);
  });

  it("retains active keys in the bounded listing after many recent revoked keys", async () => {
    const { t, owner } = await world();
    const key = await issue(owner);
    const saved = await keyRecord(t, key.keyId);
    const fields = {
      orgId: saved.orgId,
      issuerProfileId: saved.issuerProfileId,
      label: saved.label,
      prefix: saved.prefix,
      scopes: saved.scopes,
      expiresAt: saved.expiresAt,
      windowStartedAt: 0,
      requestsInWindow: 0,
    };
    await t.run(async (ctx) => {
      for (let i = 1; i <= 60; i++) {
        await ctx.db.insert("integrationKeys", {
          ...fields,
          keyHash: i.toString(16).padStart(64, "0"),
          createdAt: saved.createdAt + i,
          revokedAt: saved.createdAt + i,
        });
      }
    });
    const result = await owner.query(api.integrations.listKeys, {});
    expect(result.keys).toHaveLength(51);
    expect(result.keys.some((row) => row.id === key.keyId)).toBe(true);
  });

  it("revokes immediately and idempotently while rejecting another business's key ID", async () => {
    const { t, owner } = await world();
    const key = await issue(owner);
    const other = await signInAs(t, factoryPhone);
    await expect(
      other.mutation(api.integrations.revokeKey, { keyId: key.keyId }),
    ).rejects.toThrow(/API_KEY_NOT_FOUND/);
    expect(await read(t, key.keyHash)).toMatchObject({ status: 200 });
    await owner.mutation(api.integrations.revokeKey, { keyId: key.keyId });
    await owner.mutation(api.integrations.revokeKey, { keyId: key.keyId });
    expect(await read(t, key.keyHash)).toMatchObject({
      status: 401,
      body: JSON.stringify({ error: { code: "INVALID_API_KEY" } }),
    });
    const audits = await t.run((ctx) =>
      ctx.db
        .query("auditLog")
        .withIndex("by_entity", (q) =>
          q.eq("entityTable", "integrationKeys").eq("entityId", key.keyId),
        )
        .collect(),
    );
    expect(
      audits.filter((audit) => audit.action === "integration.key_revoked"),
    ).toHaveLength(1);
  });
});

describe("tenant-scoped API data", () => {
  it("supports every approved business kind and returns only its own organization without contacts", async () => {
    const { t, owner: shop } = await world();
    const phones = [shopPhone, "+919000000102", "+919000000103", factoryPhone];
    const kinds = ["kabadiwala", "yard", "recycler", "manufacturer"];
    for (const [index, phone] of phones.entries()) {
      const owner = phone === shopPhone ? shop : await signInAs(t, phone);
      const key = await issue(owner, ["organization:read"]);
      const record = await keyRecord(t, key.keyId);
      const response = await read(t, key.keyHash);
      const body = JSON.parse(response.body) as {
        data: IntegrationOrganization;
      };
      expect(body.data.id).toBe(record.orgId);
      expect(body.data.kind).toBe(kinds[index]);
      expect(
        Object.keys(body.data).toSorted((a, b) => a.localeCompare(b)),
      ).toEqual(["city", "families", "id", "kind", "name"]);
    }
  });

  it("checks resource scope on the server and rejects unknown or expired keys", async () => {
    const { t, owner } = await world();
    const key = await issue(owner, ["organization:read"]);
    expect(await read(t, key.keyHash, "inventory")).toMatchObject({
      status: 403,
      body: JSON.stringify({ error: { code: "INSUFFICIENT_SCOPE" } }),
    });
    expect(await read(t, "f".repeat(64))).toMatchObject({ status: 401 });
    expect(await read(t, "malformed")).toMatchObject({ status: 401 });
    await t.run((ctx) =>
      ctx.db.patch("integrationKeys", key.keyId, { expiresAt: Date.now() }),
    );
    expect(await read(t, key.keyHash)).toMatchObject({ status: 401 });
    const unusedKey = await keyRecord(t, key.keyId);
    expect(unusedKey.lastUsedAt).toBeUndefined();
  });

  it.each(["suspend", "demote", "remove", "delete-profile"] as const)(
    "denies an existing key after issuer or business access changes: %s",
    async (change) => {
      const { t, owner } = await world();
      const key = await issue(owner);
      const record = await keyRecord(t, key.keyId);
      expect(await read(t, key.keyHash)).toMatchObject({ status: 200 });
      await t.run(async (ctx) => {
        if (change === "suspend")
          await ctx.db.patch("orgs", record.orgId, { status: "suspended" });
        else if (change === "delete-profile")
          await ctx.db.delete("profiles", record.issuerProfileId);
        else {
          const membership = await ctx.db
            .query("memberships")
            .withIndex("by_org_profile", (q) =>
              q
                .eq("orgId", record.orgId)
                .eq("profileId", record.issuerProfileId),
            )
            .unique();
          if (!membership) throw new Error("Missing fixture membership");
          if (change === "demote")
            await ctx.db.patch("memberships", membership._id, {
              role: "staff",
            });
          else await ctx.db.delete("memberships", membership._id);
        }
      });
      expect(await read(t, key.keyHash)).toMatchObject({
        status: 403,
        body: JSON.stringify({ error: { code: "ACCESS_DENIED" } }),
      });
    },
  );

  it("paginates stock without exposing another business or losing rows", async () => {
    const { t, owner } = await world();
    const key = await issue(owner, ["inventory:read"]);
    const record = await keyRecord(t, key.keyId);
    const expected = await t.run((ctx) =>
      ctx.db
        .query("inventory")
        .withIndex("by_org", (q) => q.eq("orgId", record.orgId))
        .collect(),
    );
    const rows: IntegrationInventory[] = [];
    let cursor: string | null = null;
    let pages = 0;
    do {
      const result = await read(t, key.keyHash, "inventory", {
        limit: 2,
        cursor,
      });
      expect(result.status).toBe(200);
      const body = JSON.parse(result.body) as Page<IntegrationInventory>;
      expect(body.data.length).toBeLessThanOrEqual(2);
      expect(body.pagination.isDone).toBe(body.pagination.nextCursor === null);
      rows.push(...body.data);
      cursor = body.pagination.nextCursor;
      pages++;
    } while (cursor !== null && pages < 10);
    expect(pages).toBeGreaterThan(1);
    expect(cursor).toBeNull();
    expect(rows).toEqual(
      expected.map((row) => ({
        materialCode: row.materialCode,
        grams: row.grams,
        updatedAt: row.updatedAt,
      })),
    );
    expect(rows.every((row) => Number.isSafeInteger(row.grams))).toBe(true);
  });

  it("keeps foreign and cross-resource cursors inside the selected business and table", async () => {
    const { t, owner } = await world();
    const sourceKey = await issue(owner);
    const targetOwner = await signInAs(t, factoryPhone);
    const targetKey = await issue(targetOwner);
    const targetRecord = await keyRecord(t, targetKey.keyId);
    const sourceResponse = await read(t, sourceKey.keyHash, "inventory", {
      limit: 1,
    });
    const sourceBody = JSON.parse(
      sourceResponse.body,
    ) as Page<IntegrationInventory>;
    const cursor = sourceBody.pagination.nextCursor;
    expect(cursor).not.toBeNull();
    if (cursor === null)
      throw new Error("Expected a multi-page fixture inventory");
    const targetInventory = await t.run((ctx) =>
      ctx.db
        .query("inventory")
        .withIndex("by_org", (q) => q.eq("orgId", targetRecord.orgId))
        .collect(),
    );
    const allowedInventory = targetInventory.map((row) => ({
      materialCode: row.materialCode,
      grams: row.grams,
      updatedAt: row.updatedAt,
    }));
    expect(allowedInventory.length).toBeGreaterThan(0);
    const replayed = await read(t, targetKey.keyHash, "inventory", {
      limit: 1,
      cursor,
    });
    expect([200, 400]).toContain(replayed.status);
    if (replayed.status === 400) {
      expect(JSON.parse(replayed.body)).toEqual({
        error: { code: "INVALID_CURSOR" },
      });
    } else {
      const body = JSON.parse(replayed.body) as Page<IntegrationInventory>;
      expect(body.data.length).toBeLessThanOrEqual(1);
      for (const row of body.data) {
        expect(allowedInventory).toContainEqual(row);
        expect(sourceBody.data).not.toContainEqual(row);
      }
    }
    const targetTrades = await t.run((ctx) =>
      ctx.db
        .query("trades")
        .withIndex("by_buyer", (q) => q.eq("buyerOrgId", targetRecord.orgId))
        .collect(),
    );
    expect(targetTrades.length).toBeGreaterThan(0);
    const crossResource = await read(t, targetKey.keyHash, "trades", {
      limit: 1,
      cursor,
    });
    expect([200, 400]).toContain(crossResource.status);
    if (crossResource.status === 400) {
      expect(JSON.parse(crossResource.body)).toEqual({
        error: { code: "INVALID_CURSOR" },
      });
    } else {
      const body = JSON.parse(crossResource.body) as Page<IntegrationTrade>;
      expect(body.data.length).toBeLessThanOrEqual(1);
      for (const row of body.data) {
        expect(targetTrades.map((trade) => trade._id)).toContain(row.id);
        expect(Object.keys(row).toSorted((a, b) => a.localeCompare(b))).toEqual(
          [
            "createdAt",
            "gatewayRequired",
            "grams",
            "id",
            "invoiceNo",
            "legacyReceiptNo",
            "materialCode",
            "paisePerKg",
            "paymentMode",
            "paymentVerification",
            "side",
            "status",
            "totalPaise",
            "updatedAt",
          ],
        );
        expect(row.side).toBe("buyer");
        expect(row.paymentMode).toBe("gateway_required");
        expect(row.gatewayRequired).toBe(true);
        expect(row.invoiceNo).toBeNull();
        expect(sourceBody.data).not.toContainEqual(row);
      }
    }
  });

  it("returns active catalogue entries and scoped buyer/seller trades with exact units", async () => {
    const { t, owner } = await world();
    const key = await issue(owner);
    const record = await keyRecord(t, key.keyId);
    await t.run(async (ctx) => {
      const material = await ctx.db
        .query("materials")
        .withIndex("by_sortOrder")
        .first();
      if (!material) throw new Error("Missing fixture material");
      await ctx.db.patch("materials", material._id, { active: false });
    });
    const materialsResponse = await read(t, key.keyHash, "materials", {
      limit: 100,
    });
    const materials = JSON.parse(
      materialsResponse.body,
    ) as Page<IntegrationMaterial>;
    const expectedMaterials = await t.run((ctx) =>
      ctx.db.query("materials").withIndex("by_sortOrder").collect(),
    );
    expect(materials.data).toEqual(
      expectedMaterials
        .filter((row) => row.active)
        .map((row) => ({
          code: row.code,
          names: row.names,
          family: row.family,
          stage: row.stage,
        })),
    );
    for (const side of ["buyer", "seller"] as const) {
      const response = await read(t, key.keyHash, "trades", { side });
      const body = JSON.parse(response.body) as Page<IntegrationTrade>;
      const expected = await t.run((ctx) =>
        side === "buyer"
          ? ctx.db
              .query("trades")
              .withIndex("by_buyer", (q) => q.eq("buyerOrgId", record.orgId))
              .order("desc")
              .collect()
          : ctx.db
              .query("trades")
              .withIndex("by_seller", (q) => q.eq("sellerOrgId", record.orgId))
              .order("desc")
              .collect(),
      );
      expect(body.data.map((row) => row.id)).toEqual(
        expected.map((row) => row._id),
      );
      for (const [index, row] of body.data.entries()) {
        expect(row).toMatchObject({
          side,
          grams: expected[index].grams,
          paisePerKg: expected[index].paisePerKg,
          totalPaise: expected[index].totalPaise,
          paymentMode: "gateway_required",
          gatewayRequired: true,
          invoiceNo: null,
          legacyReceiptNo: expected[index].invoiceNo ?? null,
        });
        expect(Object.keys(row).toSorted((a, b) => a.localeCompare(b))).toEqual(
          [
            "createdAt",
            "gatewayRequired",
            "grams",
            "id",
            "invoiceNo",
            "legacyReceiptNo",
            "materialCode",
            "paisePerKg",
            "paymentMode",
            "paymentVerification",
            "side",
            "status",
            "totalPaise",
            "updatedAt",
          ],
        );
      }
    }
  });

  it("rejects invalid page bounds, empty or oversized cursors and caller-selected organizations", async () => {
    const { t, owner } = await world();
    const key = await issue(owner);
    for (const limit of [0, -1, 1.5, 101])
      expect(await read(t, key.keyHash, "inventory", { limit })).toMatchObject({
        status: 400,
      });
    for (const cursor of ["", "x".repeat(4097)])
      expect(await read(t, key.keyHash, "inventory", { cursor })).toMatchObject(
        { status: 400 },
      );
    expect(
      await read(t, key.keyHash, "organization", { cursor: "invalid" }),
    ).toMatchObject({ status: 400 });
    const extended = {
      keyHash: key.keyHash,
      resource: "organization" as const,
      limit: 50,
      cursor: null,
      side: "buyer" as const,
      orgId: "chosen-org",
    };
    await expect(
      t.mutation(internal.integrations.read, extended),
    ).rejects.toThrow();
    const unusedKey = await keyRecord(t, key.keyId);
    expect(unusedKey.lastUsedAt).toBeUndefined();
  });

  it("gates news by its own scope and audits a provider request without returning contact data", async () => {
    const { t, owner } = await world();
    const key = await issue(owner, ["news:read"]);
    const result = await read(t, key.keyHash, "news", { limit: 10 });
    expect(result.status).toBe(200);
    const body = JSON.parse(result.body) as { data: { families: string[] } };
    expect(Object.keys(body.data)).toEqual(["families"]);
    expect(body.data.families.length).toBeGreaterThan(0);
    expect(await read(t, key.keyHash, "inventory")).toMatchObject({
      status: 403,
    });
    expect(await read(t, key.keyHash, "news", { limit: 21 })).toMatchObject({
      status: 400,
    });
    expect(
      await read(t, key.keyHash, "news", { limit: 10, cursor: "anything" }),
    ).toMatchObject({ status: 400 });
    const audits = await t.run((ctx) =>
      ctx.db
        .query("auditLog")
        .withIndex("by_entity", (q) =>
          q.eq("entityTable", "integrationKeys").eq("entityId", key.keyId),
        )
        .collect(),
    );
    expect(
      audits.find((row) => row.action === "integration.news_requested")
        ?.metadata,
    ).toEqual({ keyId: key.keyId, scope: "news:read" });
  });
});

describe("invalid data boundaries", () => {
  it.each([
    { resource: "inventory", field: "grams", amount: 0.5 },
    { resource: "inventory", field: "grams", amount: -1 },
    { resource: "trades", field: "grams", amount: Number.MAX_SAFE_INTEGER + 1 },
    { resource: "trades", field: "paisePerKg", amount: 1.5 },
    { resource: "trades", field: "totalPaise", amount: -1 },
  ] as const)(
    "fails closed on corrupt ledger data: %j",
    async ({ resource, field, amount }) => {
      const { t, owner } = await world();
      const key = await issue(owner);
      const record = await keyRecord(t, key.keyId);
      await t.run(async (ctx) => {
        if (resource === "inventory") {
          const row = await ctx.db
            .query("inventory")
            .withIndex("by_org", (q) => q.eq("orgId", record.orgId))
            .first();
          if (!row) throw new Error("Missing fixture inventory");
          await ctx.db.patch("inventory", row._id, { grams: amount });
        } else {
          const row = await ctx.db
            .query("trades")
            .withIndex("by_seller", (q) => q.eq("sellerOrgId", record.orgId))
            .first();
          if (!row) throw new Error("Missing fixture trade");
          await ctx.db.patch("trades", row._id, { [field]: amount });
        }
      });
      await expect(
        read(t, key.keyHash, resource, { side: "seller" }),
      ).rejects.toThrow(/INVALID_LEDGER_AMOUNT/);
      const unchanged = await keyRecord(t, key.keyId);
      expect(unchanged.requestsInWindow).toBe(0);
      expect(unchanged.lastUsedAt).toBeUndefined();
    },
  );

  it("classifies only the documented Convex cursor errors", () => {
    expect(
      isInvalidIntegrationCursor(
        new Error("InvalidCursor: cannot decode pagination token"),
      ),
    ).toBe(true);
    expect(
      isInvalidIntegrationCursor(
        new ConvexError({
          isConvexSystemError: true,
          paginationError: "InvalidCursor",
        }),
      ),
    ).toBe(true);
    expect(
      isInvalidIntegrationCursor(new Error("Unexpected database failure")),
    ).toBe(false);
    expect(
      isInvalidIntegrationCursor(new SyntaxError("Unexpected token in JSON")),
    ).toBe(false);
    expect(
      isInvalidIntegrationCursor({ paginationError: "InvalidCursor" }),
    ).toBe(false);
  });
});

describe("transactional request limits and audit", () => {
  it("accepts at most sixty concurrent reads per key and resets at the minute boundary", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-02T12:00:10Z"));
    const { t, owner } = await world();
    const key = await issue(owner);
    const replies = await Promise.all(
      Array.from({ length: 65 }, () => read(t, key.keyHash)),
    );
    expect(replies.filter((reply) => reply.status === 200)).toHaveLength(60);
    expect(replies.filter((reply) => reply.status === 429)).toHaveLength(5);
    expect(replies.find((reply) => reply.status === 429)).toMatchObject({
      remaining: 0,
      retryAfter: 50,
    });
    const saved = await keyRecord(t, key.keyId);
    expect(saved.requestsInWindow).toBe(60);
    expect(saved.lastUsedAt).toBe(Date.now());
    const audits = await t.run((ctx) =>
      ctx.db
        .query("auditLog")
        .withIndex("by_entity", (q) =>
          q.eq("entityTable", "integrationKeys").eq("entityId", key.keyId),
        )
        .collect(),
    );
    const reads = audits.filter((audit) => audit.action === "integration.read");
    expect(reads).toHaveLength(60);
    expect(reads[0].metadata).toEqual({
      keyId: key.keyId,
      scope: "organization:read",
    });
    expect(JSON.stringify(reads)).not.toContain(key.keyHash);
    vi.setSystemTime(new Date("2026-10-02T12:01:00Z"));
    expect(await read(t, key.keyHash)).toMatchObject({
      status: 200,
      remaining: 59,
    });
  });

  it("shares an atomic organization quota across keys without consuming another organization's allowance", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-02T12:00:10Z"));
    const { t, owner } = await world();
    const first = await issue(owner);
    const second = await issue(owner);
    const third = await issue(owner);
    const record = await keyRecord(t, first.keyId);
    await t.run((ctx) =>
      ctx.db.insert("integrationUsage", {
        orgId: record.orgId,
        windowStartedAt: Date.parse("2026-10-02T12:00:00Z"),
        requestsInWindow: 179,
      }),
    );
    const replies = await Promise.all(
      [first, second, third].map((key) => read(t, key.keyHash)),
    );
    expect(replies.filter((reply) => reply.status === 200)).toHaveLength(1);
    expect(replies.filter((reply) => reply.status === 429)).toHaveLength(2);
    const other = await signInAs(t, factoryPhone);
    const otherKey = await issue(other);
    expect(await read(t, otherKey.keyHash)).toMatchObject({
      status: 200,
      remaining: 59,
    });
  });
});
