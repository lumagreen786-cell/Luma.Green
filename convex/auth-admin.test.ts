// @vitest-environment edge-runtime
import { convexTest } from "convex-test";
import { afterEach, expect, it, vi } from "vitest";

import { components } from "./_generated/api";
import { convexModules, registerAuth } from "./lib/auth.testing";
import schema from "./schema";

const modules = convexModules(import.meta.glob("./**/*.*s"));
const SETUP_TOKEN = "test-setup-token-0123456789abcdef";
const ADMIN_EMAIL = "admin@luma.test";
const PASSWORD = "Test-password-0123456789";

afterEach(() => {
  vi.unstubAllEnvs();
});

function setup() {
  vi.stubEnv("SITE_URL", "https://luma.test");
  vi.stubEnv("CONVEX_SITE_URL", "https://test.convex.site");
  vi.stubEnv("BETTER_AUTH_SECRET", "0123456789abcdef0123456789abcdef");
  vi.stubEnv("ADMIN_EMAIL", ADMIN_EMAIL);
  vi.stubEnv("ADMIN_SETUP_TOKEN", SETUP_TOKEN);
  const t = convexTest(schema, modules);
  registerAuth(t);
  return t;
}

it.each([
  "/sign-in/email",
  "/sign-up/email",
  "/request-password-reset",
  "/reset-password",
])("rejects the retired email endpoint %s without a session", async (path) => {
  const t = setup();
  const response = await t.fetch(`/api/auth${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Origin: "https://luma.test",
      "x-luma-admin-setup-token": SETUP_TOKEN,
    },
    body: JSON.stringify({
      email: ADMIN_EMAIL,
      password: PASSWORD,
      name: "Test Admin",
      token: "old-reset-token",
      newPassword: PASSWORD,
    }),
  });
  expect(response.status).toBe(403);
  expect(await response.json()).toMatchObject({ code: "PHONE_LOGIN_REQUIRED" });
  expect(response.headers.get("set-cookie")).toBeNull();
  const accounts = await t.run((ctx) =>
    ctx.runQuery(components.betterAuth.adapter.findMany, {
      model: "account",
      paginationOpts: { cursor: null, numItems: 10 },
    }),
  );
  expect(accounts.page).toEqual([]);
});
