// @vitest-environment edge-runtime
import { convexTest } from "convex-test";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

import { components } from "./_generated/api";
import { createAuth } from "./auth";
import { convexModules, registerAuth } from "./lib/auth.testing";
import schema from "./schema";

const modules = convexModules(import.meta.glob("./**/*.*s"));
const origin = "https://luma.test";
const deniedNetwork = vi.fn(() => {
  throw new Error(
    "An unavailable authentication feature attempted a network request.",
  );
});

beforeEach(() => {
  vi.stubEnv("SITE_URL", origin);
  vi.stubEnv("CONVEX_SITE_URL", "https://test.convex.site");
  vi.stubEnv("BETTER_AUTH_SECRET", "0123456789abcdef0123456789abcdef");
  vi.stubEnv("AUTH_LOCAL_TEST_MODE", "false");
  deniedNetwork.mockClear();
  vi.stubGlobal("fetch", deniedNetwork);
});
afterEach(() => {
  const requestCount = deniedNetwork.mock.calls.length;
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  expect(requestCount).toBe(0);
});

const unavailableRoutes = [
  { path: "/sign-in/magic-link", method: "POST" },
  { path: "/magic-link/verify?token=synthetic-unused-token", method: "GET" },
  { path: "/sign-in/social", method: "POST", provider: "google" },
  { path: "/sign-in/social", method: "POST", provider: "github" },
  { path: "/sign-in/oauth2", method: "POST" },
  { path: "/oauth2/callback/disabled?code=unused&state=unused", method: "GET" },
  {
    path: "/oauth-proxy-callback?callbackURL=https%3A%2F%2Fluma.test",
    method: "GET",
  },
  { path: "/device/code", method: "POST" },
  { path: "/device/token", method: "POST" },
  { path: "/device?user_code=unused", method: "GET" },
  { path: "/device/approve", method: "POST" },
  { path: "/device/deny", method: "POST" },
] as const;

it.each(unavailableRoutes)(
  "refuses optional $method $path without creating an identity or session",
  async (route) => {
    const t = convexTest(schema, modules);
    registerAuth(t);
    const response = await t.fetch(`/api/auth${route.path}`, {
      method: route.method,
      headers: {
        Origin: origin,
        "Content-Type": "application/json",
        "X-Forwarded-For": "192.0.2.51",
      },
      ...(route.method === "POST" && {
        body: JSON.stringify({
          email: "unowned@example.test",
          callbackURL: origin,
          provider: "provider" in route ? route.provider : "disabled",
          providerId: "disabled",
          client_id: "disabled",
          device_code: "unused",
          user_code: "unused",
          grant_type: "urn:ietf:params:oauth:grant-type:device_code",
        }),
      }),
    });
    expect(response.status).toBe(404);
    expect(response.headers.get("set-cookie")).toBeNull();
    expect(response.headers.get("location")).toBeNull();
    if (route.path === "/sign-in/social")
      expect(await response.json()).toMatchObject({
        code: "PROVIDER_NOT_FOUND",
      });
    for (const model of [
      "user",
      "account",
      "session",
      "verification",
    ] as const) {
      const records = await t.run((ctx) =>
        ctx.runQuery(components.betterAuth.adapter.findMany, {
          model,
          paginationOpts: { cursor: null, numItems: 1 },
        }),
      );
      expect(records.page).toEqual([]);
    }
  },
);

it("keeps optional providers absent and persists the real request limit in the Convex adapter", async () => {
  const t = convexTest(schema, modules);
  registerAuth(t);
  await t.run(async (ctx) => {
    const context = await createAuth(ctx).$context;
    expect(context.adapter.id).toBe("convex");
    expect(context.rateLimit).toMatchObject({
      enabled: true,
      storage: "database",
    });
    expect(context.options).not.toHaveProperty("socialProviders");
    const plugins = context.options.plugins.map(({ id }) => id);
    for (const id of [
      "magic-link",
      "generic-oauth",
      "oauth-proxy",
      "device-authorization",
    ])
      expect(plugins).not.toContain(id);
  });

  // Each fetch creates a fresh real handler context. The shared Convex record,
  // not a process-local counter, must retain the three rejected requests.
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const response = await t.fetch("/api/auth/request-password-reset", {
      method: "POST",
      headers: {
        Origin: origin,
        "Content-Type": "application/json",
        "X-Forwarded-For": "192.0.2.52",
      },
      body: JSON.stringify({ email: "unowned@example.test" }),
    });
    expect(response.status).toBe(attempt < 3 ? 403 : 429);
    expect(response.headers.get("set-cookie")).toBeNull();
  }
  const limits = await t.run((ctx) =>
    ctx.runQuery(components.betterAuth.adapter.findMany, {
      model: "rateLimit",
      paginationOpts: { cursor: null, numItems: 2 },
    }),
  );
  expect(limits.page).toHaveLength(1);
  expect(limits.page[0]).toMatchObject({ count: 3 });
});
