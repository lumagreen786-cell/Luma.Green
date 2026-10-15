// @vitest-environment edge-runtime
import { convexTest } from "convex-test";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

import { convexModules, registerAuth } from "./lib/auth.testing";
import schema from "./schema";

const modules = convexModules(import.meta.glob("./**/*.*s"));
const origin = "https://luma.test";
const provider = vi.fn();
beforeEach(() => {
  vi.stubEnv("SITE_URL", origin);
  vi.stubEnv("CONVEX_SITE_URL", "https://test.convex.site");
  vi.stubEnv("BETTER_AUTH_SECRET", "0123456789abcdef0123456789abcdef");
  vi.stubEnv("TURNSTILE_ENABLED", "true");
  vi.stubEnv("TURNSTILE_SECRET_KEY", "test-private-key");
  vi.stubEnv("TURNSTILE_HOSTNAMES", "luma.test");
  // Stop after the bot gate: no SMS service is configured in these tests.
  vi.stubEnv("OSDIGITAL_API_KEY", "");
  vi.stubEnv("MSG91_AUTH_KEY", "");
  vi.stubEnv("AUTH_LOCAL_TEST_MODE", "false");
  provider.mockReset();
  vi.stubGlobal("fetch", provider);
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

async function send(token?: string, path = "/phone-number/send-otp") {
  const t = convexTest(schema, modules);
  registerAuth(t);
  const response = await t.fetch(`/api/auth${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Origin: origin,
      ...(token !== undefined && { "x-captcha-response": token }),
    },
    body: JSON.stringify({ phoneNumber: "+919000000031" }),
  });
  expect(await t.run((ctx) => ctx.db.query("smsRateLimits").collect())).toEqual(
    [],
  );
  return response;
}

it("rejects direct OTP requests without a token before touching phone quota", async () => {
  const response = await send();
  expect(response.status).toBe(403);
  expect(provider).not.toHaveBeenCalled();
});

it("does not bypass protection with a trailing slash", async () => {
  const response = await send(undefined, "/phone-number/send-otp/");
  expect([403, 404]).toContain(response.status);
  expect(provider).not.toHaveBeenCalled();
});

it.each([
  { success: false, "error-codes": ["timeout-or-duplicate"] },
  { success: true, hostname: "attacker.test", action: "otp_send" },
  { success: true, hostname: "luma.test", action: "other" },
  { success: true },
])("rejects invalid verification: %j", async (body) => {
  provider.mockResolvedValue(Response.json(body));
  const response = await send("one-use-token");
  expect(response.status).toBe(403);
});

it("allows a valid token through to the existing SMS configuration gate", async () => {
  provider.mockResolvedValue(
    Response.json({ success: true, hostname: "luma.test", action: "otp_send" }),
  );
  const response = await send("one-use-token");
  expect(response.status).toBe(503);
  expect(await response.json()).toMatchObject({
    message: "SMS is not configured.",
  });
  expect(provider).toHaveBeenCalledWith(
    "https://challenges.cloudflare.com/turnstile/v0/siteverify",
    expect.objectContaining({
      method: "POST",
      redirect: "error",
      signal: expect.any(AbortSignal),
    }),
  );
});

it("fails closed on provider outages without exposing the token or secret", async () => {
  provider.mockRejectedValue(new Error("test-private-key one-use-token"));
  const response = await send("one-use-token");
  expect(response.status).toBe(503);
  expect(await response.text()).not.toMatch(/test-private-key|one-use-token/);
});

it.each(["TURNSTILE_SECRET_KEY", "TURNSTILE_HOSTNAMES"])(
  "fails closed when enabled but missing %s",
  async (key) => {
    vi.stubEnv(key, "");
    const response = await send("token");
    expect(response.status).toBe(503);
    expect(provider).not.toHaveBeenCalled();
  },
);

it("keeps unconfigured clones usable without contacting Cloudflare", async () => {
  vi.stubEnv("TURNSTILE_ENABLED", "");
  const response = await send();
  expect(response.status).toBe(503);
  expect(provider).not.toHaveBeenCalled();
});

it.each(["false", "true"])(
  "revalidates every request; no app-side token cache (%s)",
  async (secondSuccess) => {
    provider
      .mockResolvedValueOnce(
        Response.json({
          success: true,
          hostname: "luma.test",
          action: "otp_send",
        }),
      )
      .mockResolvedValueOnce(
        Response.json({
          success: secondSuccess === "true",
          hostname: "luma.test",
          action: "otp_send",
        }),
      );
    await send("same-token");
    const second = await send("same-token");
    expect(provider).toHaveBeenCalledTimes(2);
    expect(second.status).toBe(secondSuccess === "true" ? 503 : 403);
  },
);

it("rejects provider demonstration secrets instead of allowing a production bypass", async () => {
  vi.stubEnv("TURNSTILE_SECRET_KEY", "1x0000000000000000000000000000000AA");
  const response = await send("token");
  expect(response.status).toBe(503);
  expect(provider).not.toHaveBeenCalled();
});
