// @vitest-environment edge-runtime
import { convexTest } from "convex-test";
import { afterEach, expect, it, vi } from "vitest";

import { convexModules, registerAuth } from "./lib/auth.testing";
import schema from "./schema";
const modules = convexModules(import.meta.glob("./**/*.*s"));
afterEach(() => vi.unstubAllEnvs());
it.each([
  "sign-up/email",
  "sign-in/email",
  "send-verification-email",
  "verify-email",
  "change-email",
  "set-password",
  "change-password",
  "request-password-reset",
  "reset-password",
])("disables %s even with email delivery configured", async (path) => {
  vi.stubEnv("SITE_URL", "https://luma.test");
  vi.stubEnv("CONVEX_SITE_URL", "https://test.convex.site");
  vi.stubEnv("BETTER_AUTH_SECRET", "0123456789abcdef0123456789abcdef");
  vi.stubEnv("RESEND_API_KEY", "test-key");
  vi.stubEnv("AUTH_FROM_EMAIL", "accounts@example.test");
  const t = convexTest(schema, modules);
  registerAuth(t);
  const response = await t.fetch(`/api/auth/${path}`, {
    method: path === "verify-email" ? "GET" : "POST",
    headers: {
      Origin: "https://luma.test",
      "Content-Type": "application/json",
    },
    ...(path !== "verify-email" && {
      body: JSON.stringify({
        email: "member@example.test",
        password: "test-only-password",
        name: "Member",
        token: "old-token",
      }),
    }),
  });
  expect(response.status).toBe(path === "set-password" ? 404 : 403);
  if (path !== "set-password")
    expect(await response.json()).toMatchObject({
      code: "PHONE_LOGIN_REQUIRED",
    });
  expect(response.headers.get("set-cookie")).toBeNull();
});
