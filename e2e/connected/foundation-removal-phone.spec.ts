import { randomInt } from "node:crypto";
import { readFileSync } from "node:fs";
import { parseEnv } from "node:util";

import { expect, test } from "@playwright/test";
import { ConvexHttpClient } from "convex/browser";
import { z } from "zod";

import { api } from "../../convex/_generated/api";
import { isLoopbackHttpOrigin } from "../../convex/lib/localAcceptance";
import en from "../../messages/en.json" with { type: "json" };

const backend = z
  .object({
    SITE_URL: z.string().refine(isLoopbackHttpOrigin),
    AUTH_LOCAL_TEST_MODE: z.literal("true"),
    AUTH_LOCAL_EMAIL_INBOX_URL: z.url(),
    AUTH_LOCAL_EMAIL_INBOX_TOKEN: z.string().min(32),
  })
  .parse(
    parseEnv(readFileSync(".convex/local-acceptance/backend.env", "utf8")),
  );
const frontend = z
  .object({
    NEXT_PUBLIC_CONVEX_URL: z.string().refine(isLoopbackHttpOrigin),
    NEXT_PUBLIC_CONVEX_SITE_URL: z.string().refine(isLoopbackHttpOrigin),
  })
  .parse(parseEnv(readFileSync(".env.local", "utf8")));
const inbox = new URL(backend.AUTH_LOCAL_EMAIL_INBOX_URL);
if (!isLoopbackHttpOrigin(inbox.origin))
  throw new Error("Removal acceptance requires a local inbox.");

test("local phone account removal closes the real session and rejects its old private token", async ({
  browser,
}) => {
  const context = await browser.newContext({
    baseURL: backend.SITE_URL,
    extraHTTPHeaders: {
      Origin: backend.SITE_URL,
      "X-Forwarded-For": "192.0.2.250",
    },
  });
  try {
    // Disposable local-only identity; never a fixed OTP or a seeded real person.
    const phoneNumber = `+9190000${String(randomInt(10_000, 100_000))}`;
    const sent = await context.request.post("/api/auth/phone-number/send-otp", {
      data: { phoneNumber },
    });
    expect(sent.status()).toBe(200);
    inbox.pathname = "/messages";
    inbox.searchParams.set("to", phoneNumber);
    const delivery = await fetch(inbox, {
      headers: {
        Authorization: `Bearer ${backend.AUTH_LOCAL_EMAIL_INBOX_TOKEN}`,
      },
    });
    if (!delivery.ok)
      throw new Error("The secured local inbox is unavailable.");
    const deliveredBody: unknown = await delivery.json();
    const deliveredMessage = z.object({ text: z.string(), kind: z.string() });
    const messages = z
      .object({
        messages: z.array(deliveredMessage),
      })
      .parse(deliveredBody);
    const code = messages.messages
      .findLast((row) => row.kind === "phone-code")
      ?.text.match(/\b\d{6}\b/u)?.[0];
    if (!code) throw new Error("No local verification code was delivered.");
    const verified = await context.request.post(
      "/api/auth/phone-number/verify",
      { data: { phoneNumber, code } },
    );
    expect(verified.status()).toBe(200);
    const tokenResponse = await context.request.get("/api/auth/convex/token");
    if (!tokenResponse.ok())
      throw new Error("The local phone session has no token.");
    const token = z
      .object({ token: z.string() })
      .parse(await tokenResponse.json()).token;
    const client = new ConvexHttpClient(frontend.NEXT_PUBLIC_CONVEX_URL);
    client.setAuth(token);
    await client.mutation(api.identity.ensureProfile, { locale: "en" });
    const page = await context.newPage();
    await page.goto("/account/removal");
    await expect(
      page.getByRole("heading", { level: 1, name: en.accountRemoval.title }),
    ).toBeVisible();
    await page
      .getByRole("checkbox", { name: en.accountRemoval.confirm })
      .check();
    await page
      .getByRole("button", { name: en.accountRemoval.action, exact: true })
      .click();
    await expect(page).toHaveURL((url) => url.pathname === "/login");
    await expect(client.query(api.stock.mine, {})).rejects.toThrow(
      /ACCOUNT_CLOSED|NOT_SIGNED_IN/u,
    );
    await page.goto("/account/services");
    await expect(page).toHaveURL((url) => url.pathname === "/login");
  } finally {
    await context.close();
  }
});
