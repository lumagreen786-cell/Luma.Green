import { expect, test } from "@playwright/test";

import ar from "../messages/ar.json" with { type: "json" };
import en from "../messages/en.json" with { type: "json" };

// This disconnected build proves guards and public documentation. It does not
// prove a signed-in owner flow or a configured API deployment.
for (const { locale, messages } of [
  { locale: "en", messages: en },
  { locale: "ar", messages: ar },
]) {
  test(`${locale} API access requires a business session`, async ({ page }) => {
    await page.goto(`/${locale}/app/integrations`);
    await expect(page).toHaveURL(/\/login\?next=%2Fapp$/);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      messages.auth.metaTitle,
    );
    await expect(
      page.getByRole("textbox", { name: messages.integrations.tokenLabel }),
    ).toHaveCount(0);
  });
}

test("API specification is public without a credential", async ({
  request,
}) => {
  const response = await request.get("/api/v1/openapi.json");
  expect(response.status()).toBe(200);
  expect(response.headers()["content-type"]).toContain("application/json");
  const specification: unknown = await response.json();
  expect(specification).toMatchObject({
    openapi: expect.stringMatching(/^3\./),
    paths: expect.objectContaining({
      "/inventory": expect.any(Object),
      "/news": expect.any(Object),
    }),
  });
});

test("private API reads require a credential and cannot be cached", async ({
  request,
}) => {
  const response = await request.get("/api/v1/inventory");
  expect(response.status()).toBe(401);
  expect(response.headers()["cache-control"]).toContain("no-store");
});

test("API reports an unavailable backend for a syntactic key", async ({
  request,
}) => {
  const response = await request.get("/api/v1/inventory", {
    headers: { Authorization: `Bearer lg_live_${"a".repeat(64)}` },
  });
  expect(response.status()).toBe(503);
  expect(response.headers()["cache-control"]).toContain("no-store");
});

test("read-only API rejects write requests", async ({ request }) => {
  const response = await request.post("/api/v1/inventory");
  expect(response.status()).toBe(405);
  expect(response.headers().allow).toBe("GET");
});
