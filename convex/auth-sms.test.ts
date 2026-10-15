// @vitest-environment edge-runtime
import { convexTest } from "convex-test";
import { afterEach, expect, it, vi } from "vitest";

import { components } from "./_generated/api";
import { convexModules, registerAuth, signIn } from "./lib/auth.testing";
import schema from "./schema";

const modules = convexModules(import.meta.glob("./**/*.*s"));
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

it.each(["msg91", "osdigital"])(
  "%s rejects a resend before storing another code, even with a different client IP",
  async (provider) => {
    vi.useFakeTimers();
    vi.stubEnv("SITE_URL", "https://luma.test");
    vi.stubEnv("CONVEX_SITE_URL", "https://test.convex.site");
    vi.stubEnv("BETTER_AUTH_SECRET", "0123456789abcdef0123456789abcdef");
    vi.stubEnv("TURNSTILE_ENABLED", "true");
    vi.stubEnv("TURNSTILE_SECRET_KEY", "test-private-key");
    vi.stubEnv("TURNSTILE_HOSTNAMES", "luma.test");
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation(() =>
        Promise.resolve(
          Response.json({
            success: true,
            hostname: "luma.test",
            action: "otp_send",
          }),
        ),
      ),
    );
    vi.stubEnv("MSG91_AUTH_KEY", "test-key");
    vi.stubEnv("MSG91_OTP_TEMPLATE_ID", "test-template");
    if (provider === "osdigital") {
      vi.stubEnv("OSDIGITAL_API_KEY", "test-key");
      vi.stubEnv("OSDIGITAL_SENDER_ID", "ENVRIN");
      vi.stubEnv("OSDIGITAL_ENTITY_ID", "1234567890123456789");
      vi.stubEnv("OSDIGITAL_TEMPLATE_ID", "9876543210123456789");
      vi.stubEnv("OSDIGITAL_OTP_MESSAGE", "Your OTP is {#var#}.");
    }
    const t = convexTest(schema, modules);
    registerAuth(t);
    const send = (ip: string) =>
      t.fetch("/api/auth/phone-number/send-otp", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Origin: "https://luma.test",
          "X-Forwarded-For": ip,
          "x-captcha-response": `fresh-proof-${ip}`,
        },
        body: JSON.stringify({ phoneNumber: "+919876543210" }),
      });
    const first = await send("192.0.2.1");
    expect(first.status).toBe(200);
    const second = await send("192.0.2.2");
    expect(second.status).toBe(429);
    expect(second.headers.get("Retry-After")).toBe("300");
    const codes = await t.run((ctx) =>
      ctx.runQuery(components.betterAuth.adapter.findMany, {
        model: "verification",
        where: [{ field: "identifier", value: "+919876543210" }],
        paginationOpts: { cursor: null, numItems: 10 },
      }),
    );
    expect(codes.page).toHaveLength(1);
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        Response.json(
          provider === "osdigital"
            ? {
                status: "OK",
                data: [
                  { id: "32-1", mobile: "919876543210", status: "SUBMITTED" },
                ],
              }
            : { type: "success" },
        ),
      ),
    );
    await t.finishAllScheduledFunctions(vi.runAllTimers);
  },
);

it.each([
  { email: "admin@luma.test", status: 200 },
  { email: "member@luma.test", status: 200 },
])(
  "phone-code sign-in enforces the configured factor for $email",
  async ({ email, status }) => {
    vi.stubEnv("SITE_URL", "https://luma.test");
    vi.stubEnv("CONVEX_SITE_URL", "https://test.convex.site");
    vi.stubEnv("BETTER_AUTH_SECRET", "0123456789abcdef0123456789abcdef");
    vi.stubEnv("ADMIN_EMAIL", "admin@luma.test");
    const t = convexTest(schema, modules);
    registerAuth(t);
    await signIn(t, {
      email,
      phoneNumber: "+919876543210",
      twoFactorEnabled: email === "admin@luma.test",
    });
    const sessions = () =>
      t.run((ctx) =>
        ctx.runQuery(components.betterAuth.adapter.findMany, {
          model: "session",
          paginationOpts: { cursor: null, numItems: 10 },
        }),
      );
    const before = await sessions();
    const now = Date.now();
    await t.run((ctx) =>
      ctx.runMutation(components.betterAuth.adapter.create, {
        input: {
          model: "verification",
          data: {
            identifier: "+919876543210",
            value: "345678:0",
            expiresAt: now + 60_000,
            createdAt: now,
            updatedAt: now,
          },
        },
      }),
    );
    const result = await t.fetch("/api/auth/phone-number/verify", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Origin: "https://luma.test",
      },
      body: JSON.stringify({ phoneNumber: "+919876543210", code: "345678" }),
    });
    expect(result.status).toBe(status);
    const after = await sessions();
    if (email === "admin@luma.test") {
      expect(await result.json()).toMatchObject({ twoFactorRedirect: true });
      expect(after.page).toEqual(before.page);
    } else {
      expect(await result.json()).toHaveProperty("token");
      expect(result.headers.get("set-cookie")).toBeTruthy();
      expect(before.page).toHaveLength(1);
      expect(after.page).toHaveLength(2);
    }
  },
);
