// @vitest-environment edge-runtime
import type { DBAdapter } from "better-auth/adapters";
import { symmetricEncrypt } from "better-auth/crypto";
import { convexTest, type TestConvex } from "convex-test";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";

import { createAuth } from "./auth";
import { convexModules, registerAuth } from "./lib/auth.testing";
import { phoneEmail } from "./lib/phone";
import schema from "./schema";

const TEST_SECRET = "test-only-auth-secret-".repeat(4);
const modules = convexModules(import.meta.glob("./**/*.*s"));
type Test = TestConvex<typeof schema>;
const factorShape = z.object({
  id: z.string(),
  secret: z.string(),
  backupCodes: z.string(),
  userId: z.string(),
  failedVerificationCount: z.number().nullable().optional(),
  lockedUntil: z.number().nullable().optional(),
});
beforeEach(() => {
  vi.stubEnv("SITE_URL", "https://luma.test");
  vi.stubEnv("CONVEX_SITE_URL", "https://test.convex.site");
  vi.stubEnv("BETTER_AUTH_SECRET", TEST_SECRET);
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
  vi.useRealTimers();
});
function fixture() {
  const t = convexTest(schema, modules);
  registerAuth(t);
  return t;
}
async function factor(
  t: Test,
  values: {
    failedVerificationCount?: number | null;
    lockedUntil?: number | null;
  } = {},
) {
  return t.run(async (ctx) => {
    const { adapter } = await createAuth(ctx).$context;
    return factorShape.parse(
      await adapter.create({
        model: "twoFactor",
        data: {
          secret: "local-encrypted-secret",
          backupCodes: "local-encrypted-backups",
          userId: "local-user",
          ...values,
        },
      }),
    );
  });
}
async function increment(t: Test, id: string) {
  return t.run(async (ctx) => {
    const { adapter } = await createAuth(ctx).$context;
    return adapter.incrementOne({
      model: "twoFactor",
      where: [{ field: "id", value: id }],
      increment: { failedVerificationCount: 1 },
    });
  });
}
async function read(t: Test, id: string) {
  return t.run(async (ctx) => {
    const { adapter } = await createAuth(ctx).$context;
    return factorShape.parse(
      await adapter.findOne({
        model: "twoFactor",
        where: [{ field: "id", value: id }],
      }),
    );
  });
}

async function reset(t: Test, id: string, cutoff: Date) {
  return t.run(async (ctx) => {
    const { adapter } = await createAuth(ctx).$context;
    return adapter.incrementOne({
      model: "twoFactor",
      where: [
        { field: "id", value: id },
        { field: "lockedUntil", operator: "lte", value: cutoff },
      ],
      increment: {},
      set: { failedVerificationCount: 0, lockedUntil: null },
    });
  });
}

describe("real Convex Better Auth atomic factor counter", () => {
  it("does not lose any of twenty concurrent account failures", async () => {
    const t = fixture();
    const saved = await factor(t, { failedVerificationCount: 0 });
    const results = await t.run(async (ctx) => {
      const { adapter } = await createAuth(ctx).$context;
      return Promise.all(
        Array.from({ length: 20 }, () =>
          adapter.incrementOne({
            model: "twoFactor",
            where: [{ field: "id", value: saved.id }],
            increment: { failedVerificationCount: 1 },
          }),
        ),
      );
    });
    const counts = results.map(
      (result) => factorShape.parse(result).failedVerificationCount,
    );
    expect(
      counts.toSorted((left, right) => Number(left) - Number(right)),
    ).toEqual(Array.from({ length: 20 }, (_, index) => index + 1));
    const stored = await read(t, saved.id);
    expect(stored.failedVerificationCount).toBe(20);
  });
  it.each([undefined, null])(
    "initializes a legacy %s counter without changing factor material",
    async (failedVerificationCount) => {
      const t = fixture();
      const saved = await factor(t, { failedVerificationCount });
      const updated = await increment(t, saved.id);
      expect(updated).toMatchObject({
        id: saved.id,
        secret: saved.secret,
        backupCodes: saved.backupCodes,
        userId: saved.userId,
        failedVerificationCount: 1,
      });
      expect(updated).not.toHaveProperty("_id");
      expect(updated).not.toHaveProperty("_creationTime");
    },
  );

  it("returns null for a deleted factor without creating another row", async () => {
    const t = fixture();
    const saved = await factor(t);
    await t.run(async (ctx) => {
      const { adapter } = await createAuth(ctx).$context;
      await adapter.delete({
        model: "twoFactor",
        where: [{ field: "id", value: saved.id }],
      });
    });
    expect(await increment(t, saved.id)).toBeNull();
  });

  it.each([-1, 0.5, Number.MAX_SAFE_INTEGER, Number.MAX_SAFE_INTEGER + 1])(
    "rejects invalid or overflowing count %s without a write",
    async (failedVerificationCount) => {
      const t = fixture();
      const saved = await factor(t, { failedVerificationCount });
      await expect(increment(t, saved.id)).rejects.toThrow();
      const unchanged = await read(t, saved.id);
      expect(unchanged.failedVerificationCount).toBe(failedVerificationCount);
    },
  );

  it.each([undefined, null, Date.now() + 60_000])(
    "does not reset a missing or live lock %s",
    async (lockedUntil) => {
      const t = fixture();
      const saved = await factor(t, {
        failedVerificationCount: 8,
        lockedUntil,
      });
      const result = await reset(t, saved.id, new Date());
      expect(result).toBeNull();
      expect(await read(t, saved.id)).toEqual(saved);
    },
  );

  it("resets an expired lock once, returns adapter dates, and keeps later failures", async () => {
    const t = fixture();
    const saved = await factor(t, {
      failedVerificationCount: 12,
      lockedUntil: Date.now() - 1000,
    });
    const cutoff = new Date();
    const resetRow = await reset(t, saved.id, cutoff);
    expect(resetRow).toMatchObject({
      id: saved.id,
      failedVerificationCount: 0,
      lockedUntil: null,
    });
    expect(await reset(t, saved.id, cutoff)).toBeNull();
    expect(
      factorShape.parse(await increment(t, saved.id)).failedVerificationCount,
    ).toBe(1);
    const stored = await read(t, saved.id);
    expect(stored.lockedUntil).toBeNull();
  });

  it("does not use a future cutoff to clear an active lock", async () => {
    const t = fixture();
    const saved = await factor(t, {
      failedVerificationCount: 12,
      lockedUntil: Date.now() + 30_000,
    });
    await expect(
      reset(t, saved.id, new Date(Date.now() + 60_000)),
    ).rejects.toThrow();
    expect(await read(t, saved.id)).toEqual(saved);
  });

  it("rejects unsupported factor writes rather than falling back to a stale update", async () => {
    const t = fixture();
    const saved = await factor(t, { failedVerificationCount: 3 });
    await t.run(async (ctx) => {
      const { adapter } = await createAuth(ctx).$context;
      const base = {
        model: "twoFactor",
        where: [{ field: "id", value: saved.id }],
        increment: { failedVerificationCount: 1 },
      };
      const attempts: Parameters<DBAdapter["incrementOne"]>[0][] = [
        { ...base, increment: { failedVerificationCount: -1 } },
        { ...base, increment: { failedVerificationCount: 2 } },
        { ...base, increment: { userId: 1 } },
        { ...base, set: { secret: "replacement" } },
        { ...base, where: [{ field: "id", value: saved.id, operator: "ne" }] },
        { ...base, where: [{ field: "id", value: saved.id, connector: "OR" }] },
        {
          ...base,
          where: [{ field: "id", value: saved.id, mode: "insensitive" }],
        },
        {
          ...base,
          increment: {},
          set: { failedVerificationCount: 0, lockedUntil: null },
        },
      ];
      for (const attempt of attempts)
        await expect(adapter.incrementOne(attempt)).rejects.toThrow(
          "Unsupported atomic auth update.",
        );
    });
    expect(await read(t, saved.id)).toEqual(saved);
  });
  it("grants exactly five of twenty concurrent guarded rate-limit increments", async () => {
    const t = fixture();
    const now = Date.now();
    const key = "local-atomic-limit";
    const counts = await t.run(async (ctx) => {
      const { adapter } = await createAuth(ctx).$context;
      await adapter.create({
        model: "rateLimit",
        data: { key, count: 0, lastRequest: now },
      });
      const database = adapter;
      const results = await Promise.all(
        Array.from({ length: 20 }, () =>
          database.incrementOne({
            model: "rateLimit",
            where: [
              { field: "key", value: key },
              { field: "lastRequest", operator: "gt", value: now - 60_000 },
              { field: "count", operator: "lt", value: 5 },
            ],
            increment: { count: 1 },
            set: { lastRequest: now },
          }),
        ),
      );
      const allowed = results.filter((result) => result !== null);
      return allowed.map(
        (result) => z.object({ count: z.number() }).parse(result).count,
      );
    });
    expect(counts.toSorted((left, right) => left - right)).toEqual([
      1, 2, 3, 4, 5,
    ]);
  });

  it("claims a backup-code replacement once and preserves counters, dates and audit", async () => {
    const t = fixture();
    const lockedUntil = Date.now() + 10_000;
    const saved = await factor(t, { failedVerificationCount: 7, lockedUntil });
    const results = await t.run(async (ctx) => {
      const { adapter } = await createAuth(ctx).$context;
      return Promise.all(
        Array.from({ length: 20 }, (_, index) =>
          adapter.incrementOne({
            model: "twoFactor",
            where: [
              { field: "id", value: saved.id },
              { field: "backupCodes", value: saved.backupCodes },
            ],
            increment: {},
            set: { backupCodes: `local-remainder-${String(index)}` },
          }),
        ),
      );
    });
    const winners = results.filter((result) => result !== null);
    expect(winners).toHaveLength(1);
    const winner = factorShape.parse(winners[0]);
    expect(winner.failedVerificationCount).toBe(7);
    expect(winner.lockedUntil).toBe(lockedUntil);
    expect(await read(t, saved.id)).toEqual(winner);
    const events = await t.run((ctx) => ctx.db.query("auditLog").take(20));
    expect(
      events.filter((event) => event.action === "auth.recovery_codes.changed"),
    ).toHaveLength(1);
  });

  it("lets only one concurrent expired-window reset win", async () => {
    const t = fixture();
    const now = Date.now();
    await t.run(async (ctx) => {
      const { adapter } = await createAuth(ctx).$context;
      await adapter.create({
        model: "rateLimit",
        data: { key: "local-reset", count: 5, lastRequest: now - 60_000 },
      });
      const results = await Promise.all(
        Array.from({ length: 20 }, () =>
          adapter.incrementOne({
            model: "rateLimit",
            where: [
              { field: "key", value: "local-reset" },
              { field: "lastRequest", operator: "lte", value: now - 60_000 },
            ],
            increment: {},
            set: { count: 1, lastRequest: now },
          }),
        ),
      );
      expect(results.filter((result) => result !== null)).toHaveLength(1);
      const stored = await adapter.findOne({
        model: "rateLimit",
        where: [{ field: "key", value: "local-reset" }],
      });
      expect(stored).toMatchObject({ count: 1, lastRequest: now });
      const rejected = await adapter.incrementOne({
        model: "rateLimit",
        where: [
          { field: "key", value: "local-reset" },
          { field: "lastRequest", operator: "gt", value: now },
          { field: "count", operator: "lt", value: 5 },
        ],
        increment: { count: 1 },
        set: { lastRequest: now },
      });
      expect(rejected).toBeNull();
    });
  });

  it("does not revive an expired window or create a missing rate bucket during consumption", async () => {
    const t = fixture();
    const now = Date.now();
    await t.run(async (ctx) => {
      const { adapter } = await createAuth(ctx).$context;
      await adapter.create({
        model: "rateLimit",
        data: { key: "local-expired", count: 0, lastRequest: now - 120_000 },
      });
      for (const key of ["local-expired", "local-missing"]) {
        expect(
          await adapter.incrementOne({
            model: "rateLimit",
            where: [
              { field: "key", value: key },
              { field: "lastRequest", operator: "gt", value: now - 60_000 },
              { field: "count", operator: "lt", value: 5 },
            ],
            increment: { count: 1 },
            set: { lastRequest: now },
          }),
        ).toBeNull();
      }
    });
  });

  it("rejects unsupported rate updates and malformed stored counters", async () => {
    const t = fixture();
    const now = Date.now();
    await t.run(async (ctx) => {
      const { adapter } = await createAuth(ctx).$context;
      await adapter.create({
        model: "rateLimit",
        data: { key: "local-invalid", count: -1, lastRequest: now },
      });
      await expect(
        adapter.incrementOne({
          model: "rateLimit",
          where: [{ field: "key", value: "local-invalid" }],
          increment: { count: 1 },
        }),
      ).rejects.toThrow("Unsupported atomic auth update.");
      await expect(
        adapter.incrementOne({
          model: "rateLimit",
          where: [
            { field: "key", value: "local-invalid" },
            { field: "lastRequest", operator: "gt", value: now - 60_000 },
            { field: "count", operator: "lt", value: 5 },
          ],
          increment: { count: 1 },
          set: { lastRequest: now },
        }),
      ).rejects.toThrow("Invalid stored auth count.");
    });
  });

  it("retains the existing fallback and date mapping for other models", async () => {
    const t = fixture();
    const expiresAt = Date.now() + 60_000;
    await t.run(async (ctx) => {
      const { adapter } = await createAuth(ctx).$context;
      const created = z.object({ id: z.string() }).parse(
        await adapter.create({
          model: "verification",
          data: {
            identifier: "local-control",
            value: "not-an-auth-token",
            expiresAt: new Date(expiresAt),
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        }),
      );
      const result = await adapter.incrementOne({
        model: "verification",
        where: [{ field: "id", value: created.id }],
        increment: { expiresAt: 1 },
      });
      expect(result).toMatchObject({
        id: created.id,
        expiresAt: expiresAt + 1,
      });
    });
  });

  it("locks the account after concurrent wrong recovery factors through real HTTP handlers", async () => {
    const t = fixture();
    const phone = "+919000000099";
    const code = "381429";
    const backupCodes = await symmetricEncrypt({
      key: TEST_SECRET,
      data: JSON.stringify(["local-valid-recovery"]),
    });
    const saved = await t.run(async (ctx) => {
      const { adapter } = await createAuth(ctx).$context;
      const user = z.object({ id: z.string() }).parse(
        await adapter.create({
          model: "user",
          data: {
            name: "Local factor budget",
            email: phoneEmail(phone),
            phoneNumber: phone,
            phoneNumberVerified: true,
            emailVerified: false,
            twoFactorEnabled: true,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        }),
      );
      return factorShape.parse(
        await adapter.create({
          model: "twoFactor",
          data: {
            userId: user.id,
            secret: "unused-local-totp",
            backupCodes,
            verified: true,
            failedVerificationCount: 0,
          },
        }),
      );
    });
    async function challenge(index: number) {
      await t.run(async (ctx) => {
        const { adapter } = await createAuth(ctx).$context;
        await adapter.create({
          model: "verification",
          data: {
            identifier: phone,
            value: `${code}:0`,
            expiresAt: new Date(Date.now() + 300_000),
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        });
      });
      const response = await t.fetch("/api/auth/phone-number/verify", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Origin: "https://luma.test",
          "X-Forwarded-For": `192.0.2.${String(20 + index)}`,
        },
        body: JSON.stringify({ phoneNumber: phone, code }),
      });
      expect(response.status).toBe(200);
      expect(await response.json()).toMatchObject({ twoFactorRedirect: true });
      return response.headers
        .getSetCookie()
        .map((header) => header.split(";", 1)[0])
        .join("; ");
    }
    const cookies: string[] = [];
    for (let index = 0; index < 10; index++)
      cookies.push(await challenge(index));
    const failures = await Promise.all(
      cookies.map((cookie, index) =>
        t.fetch("/api/auth/two-factor/verify-backup-code", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Origin: "https://luma.test",
            Cookie: cookie,
            "X-Forwarded-For": `192.0.2.${String(70 + index)}`,
          },
          body: JSON.stringify({ code: "local-wrong-recovery" }),
        }),
      ),
    );
    expect(failures.map((response) => response.status)).toEqual(
      Array.from({ length: 10 }, () => 401),
    );
    const locked = await read(t, saved.id);
    expect(locked.failedVerificationCount).toBe(10);
    expect(locked.lockedUntil).toBeGreaterThan(Date.now());
    const cookie = await challenge(11);
    const blocked = await t.fetch("/api/auth/two-factor/verify-backup-code", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Origin: "https://luma.test",
        Cookie: cookie,
        "X-Forwarded-For": "192.0.2.100",
      },
      body: JSON.stringify({ code: "local-wrong-recovery" }),
    });
    expect(blocked.status).toBe(429);
    const session = await t.fetch("/api/auth/get-session", {
      headers: {
        Origin: "https://luma.test",
        Cookie: cookie,
        "X-Forwarded-For": "192.0.2.101",
      },
    });
    expect(await session.json()).toBeNull();
    const stored = await read(t, saved.id);
    expect(stored.failedVerificationCount).toBe(10);
  });
});
