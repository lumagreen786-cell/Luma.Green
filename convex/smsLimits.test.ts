// @vitest-environment edge-runtime
import { convexTest } from "convex-test";
import { afterEach, describe, expect, it, vi } from "vitest";

import { internal } from "./_generated/api";
import { convexModules } from "./lib/auth.testing";
import {
  SMS_COOLDOWN_MS,
  SMS_DAY_MS,
  smsAllowance,
  smsPhoneHash,
} from "./lib/smsLimits";
import schema from "./schema";

const modules = convexModules(import.meta.glob("./**/*.*s"));
const phoneHash = "a".repeat(64);
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("SMS quotas", () => {
  it("requires five full minutes between sends", () => {
    const now = 1_000_000;
    expect(smsAllowance([], now).allowed).toBe(true);
    expect(smsAllowance([now], now + SMS_COOLDOWN_MS - 1)).toMatchObject({
      allowed: false,
      retryAfterSeconds: 1,
    });
    expect(smsAllowance([now], now + SMS_COOLDOWN_MS).allowed).toBe(true);
  });

  it("holds all five sends until a full day after the fifth, not the first", () => {
    const start = 2 * SMS_DAY_MS;
    const sent = Array.from(
      { length: 5 },
      (_, i) => start + i * SMS_COOLDOWN_MS,
    );
    const fifth = start + 4 * SMS_COOLDOWN_MS;
    expect(smsAllowance(sent, fifth)).toMatchObject({
      allowed: false,
      retryAfterSeconds: 86_400,
    });
    expect(smsAllowance(sent, start + SMS_DAY_MS).allowed).toBe(false);
    expect(smsAllowance(sent, fifth + SMS_DAY_MS - 1).allowed).toBe(false);
    expect(smsAllowance(sent, fifth + SMS_DAY_MS)).toMatchObject({
      allowed: true,
      recent: [],
    });
  });

  it("keeps the lock through database reservations and old cleanup timers", async () => {
    vi.useFakeTimers();
    const t = convexTest(schema, modules);
    for (let i = 0; i < 5; i++) {
      expect(
        await t.mutation(internal.smsLimits.reserve, { phoneHash }),
      ).toMatchObject({ allowed: true });
      if (i < 4) await vi.advanceTimersByTimeAsync(SMS_COOLDOWN_MS);
    }
    expect(
      await t.mutation(internal.smsLimits.reserve, { phoneHash }),
    ).toMatchObject({ allowed: false, retryAfterSeconds: 86_400 });
    await vi.advanceTimersByTimeAsync(SMS_DAY_MS - 1);
    await t.finishInProgressScheduledFunctions();
    expect(
      await t.mutation(internal.smsLimits.reserve, { phoneHash }),
    ).toMatchObject({ allowed: false, retryAfterSeconds: 1 });
    await vi.advanceTimersByTimeAsync(1);
    expect(
      await t.mutation(internal.smsLimits.reserve, { phoneHash }),
    ).toMatchObject({ allowed: true });
    await t.finishAllScheduledFunctions(vi.runAllTimers);
  });

  it("uses a secret-keyed identifier, stable for one number and different after key rotation", async () => {
    const hash = await smsPhoneHash("+919876543210", "secret-a");
    expect(hash).toMatch(/^[a-f\d]{64}$/);
    expect(await smsPhoneHash("+919876543210", "secret-a")).toBe(hash);
    expect(await smsPhoneHash("+919876543210", "secret-b")).not.toBe(hash);
    expect(await smsPhoneHash("+919876543211", "secret-a")).not.toBe(hash);
  });

  it("reserves atomically across concurrent requests and isolates different numbers", async () => {
    vi.useFakeTimers();
    const t = convexTest(schema, modules);
    const results = await Promise.all(
      Array.from({ length: 5 }, () =>
        t.mutation(internal.smsLimits.reserve, { phoneHash }),
      ),
    );
    expect(results.filter((result) => result.allowed)).toHaveLength(1);
    expect(
      await t.mutation(internal.smsLimits.reserve, {
        phoneHash: "b".repeat(64),
      }),
    ).toMatchObject({ allowed: true });
    await vi.advanceTimersByTimeAsync(SMS_COOLDOWN_MS);
    expect(
      await t.mutation(internal.smsLimits.reserve, { phoneHash }),
    ).toMatchObject({ allowed: true });
    const rows = await t.run((ctx) => ctx.db.query("smsRateLimits").collect());
    expect(rows).toHaveLength(2);
    expect(JSON.stringify(rows)).not.toContain("9876543210");
    await t.finishAllScheduledFunctions(vi.runAllTimers);
    expect(
      await t.run((ctx) => ctx.db.query("smsRateLimits").collect()),
    ).toHaveLength(0);
  });

  it("does not let an old cleanup timer erase a newer request", async () => {
    vi.useFakeTimers();
    const t = convexTest(schema, modules);
    await t.mutation(internal.smsLimits.reserve, { phoneHash });
    await vi.advanceTimersByTimeAsync(SMS_DAY_MS - 1000);
    await t.mutation(internal.smsLimits.reserve, { phoneHash });
    await vi.advanceTimersByTimeAsync(1000);
    await t.finishInProgressScheduledFunctions();
    expect(
      await t.mutation(internal.smsLimits.reserve, { phoneHash }),
    ).toMatchObject({ allowed: false });
    await t.finishAllScheduledFunctions(vi.runAllTimers);
  });
});

describe("SMS provider response", () => {
  it.each([
    { status: 200, body: { type: "success", message: "id" }, ok: true },
    {
      status: 200,
      body: { type: "error", message: "secret provider details" },
      ok: false,
    },
    { status: 200, body: {}, ok: false },
    { status: 429, body: { type: "error" }, ok: false },
  ])("handles $status with $body.type", async ({ status, body, ok }) => {
    vi.stubEnv("MSG91_AUTH_KEY", "key");
    vi.stubEnv("MSG91_OTP_TEMPLATE_ID", "template");
    const fetchMock = vi
      .fn()
      .mockResolvedValue(Response.json(body, { status }));
    vi.stubGlobal("fetch", fetchMock);
    const t = convexTest(schema, modules);
    const sending = t.action(internal.sms.sendCode, {
      phone: "+919876543210",
      code: "654321",
    });
    if (ok) await expect(sending).resolves.toBeNull();
    else await expect(sending).rejects.toThrow(/MSG91/);
    expect(fetchMock).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
  });

  it("does not retry an ambiguous transport failure", async () => {
    vi.stubEnv("MSG91_AUTH_KEY", "key");
    vi.stubEnv("MSG91_OTP_TEMPLATE_ID", "template");
    const fetchMock = vi.fn().mockRejectedValue(new Error("timeout"));
    vi.stubGlobal("fetch", fetchMock);
    const t = convexTest(schema, modules);
    await expect(
      t.action(internal.sms.sendCode, {
        phone: "+919876543210",
        code: "654321",
      }),
    ).rejects.toThrow("timeout");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

function configure() {
  vi.stubEnv("OSDIGITAL_API_KEY", "secret-key");
  vi.stubEnv("OSDIGITAL_SENDER_ID", "ENVRIN");
  vi.stubEnv("OSDIGITAL_ENTITY_ID", "1234567890123456789");
  vi.stubEnv("OSDIGITAL_TEMPLATE_ID", "9876543210123456789");
  vi.stubEnv("OSDIGITAL_OTP_MESSAGE", "Your OTP is {#var#}.");
}

describe("OS Digital delivery", () => {
  it.each(["OK", "OSD02", "OSD10"])(
    "checks provider status %s",
    async (status) => {
      configure();
      const fetchMock = vi.fn().mockResolvedValue(
        Response.json({
          status,
          data: [{ id: "32-1", mobile: "919876543210", status: "SUBMITTED" }],
        }),
      );
      vi.stubGlobal("fetch", fetchMock);
      const t = convexTest(schema, modules);
      const sending = t.action(internal.sms.sendCode, {
        phone: "+919876543210",
        code: "654321",
      });
      if (status === "OK") await expect(sending).resolves.toBeNull();
      else
        await expect(sending).rejects.toThrow(
          "OS Digital did not confirm SMS acceptance.",
        );
      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(fetchMock).toHaveBeenCalledWith(
        "https://www.bulksmsindia.app/V2/http-api-post.php",
        expect.objectContaining({
          method: "POST",
          redirect: "error",
          signal: expect.any(AbortSignal),
        }),
      );
    },
  );
  it("does not retry or expose secrets after a transport failure", async () => {
    configure();
    const fetchMock = vi.fn().mockRejectedValue(new Error("secret-key 654321"));
    vi.stubGlobal("fetch", fetchMock);
    const t = convexTest(schema, modules);
    await expect(
      t.action(internal.sms.sendCode, {
        phone: "+919876543210",
        code: "654321",
      }),
    ).rejects.toThrow("OS Digital did not confirm SMS acceptance.");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
