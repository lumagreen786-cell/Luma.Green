import { readFileSync, statSync } from "node:fs";
import { setTimeout as delay } from "node:timers/promises";
import { parseEnv } from "node:util";

import { expect, type Page, test } from "@playwright/test";
import { z } from "zod";

import {
  isLoopbackHttpOrigin,
  LOCAL_ACCEPTANCE_PHONE_NUMBERS,
} from "../../convex/lib/localAcceptance";
import { phoneEmail } from "../../convex/lib/phone";
import en from "../../messages/en.json" with { type: "json" };

// Match the current phone runner: local private configuration and actual OTP
// delivery only. No session artifact is signed out or rewritten by these cases.
function readPrivateFile(path: string) {
  const metadata = statSync(path);
  if (!metadata.isFile() || (metadata.mode & 0o077) !== 0)
    throw new Error(
      "Local phone acceptance inputs require private file permissions.",
    );
  return readFileSync(path, "utf8");
}
const accountSchema = z.object({ key: z.string(), phone: z.string() });
const roster = z
  .object({
    site: z.string().refine(isLoopbackHttpOrigin),
    accounts: z.array(accountSchema),
  })
  .parse(
    JSON.parse(readPrivateFile(".convex/local-acceptance/phone-sessions.json")),
  );
const site = new URL(roster.site);
z.object({
  NEXT_PUBLIC_CONVEX_URL: z.string().refine(isLoopbackHttpOrigin),
  NEXT_PUBLIC_CONVEX_SITE_URL: z.string().refine(isLoopbackHttpOrigin),
}).parse(parseEnv(readFileSync(".env.local", "utf8")));
const localBackend = z
  .object({
    SITE_URL: z.string().refine(isLoopbackHttpOrigin),
    AUTH_LOCAL_TEST_MODE: z.literal("true"),
    AUTH_LOCAL_EMAIL_INBOX_URL: z.url(),
    AUTH_LOCAL_EMAIL_INBOX_TOKEN: z.string().min(32),
  })
  .parse(parseEnv(readPrivateFile(".convex/local-acceptance/backend.env")));
const inbox = new URL(localBackend.AUTH_LOCAL_EMAIL_INBOX_URL);
if (
  new URL(localBackend.SITE_URL).origin !== site.origin ||
  !isLoopbackHttpOrigin(inbox.origin) ||
  inbox.pathname !== "/deliver"
)
  throw new Error(
    "Auth availability requires the current loopback phone runtime and private inbox.",
  );

const messageSchema = z.object({
  id: z.string(),
  kind: z.string(),
  text: z.string(),
});
const messagesSchema = z.object({ messages: z.array(messageSchema) });

async function inboxMessages(phone: string) {
  const url = new URL("/messages", inbox);
  url.searchParams.set("to", phone);
  // Only the Node runner sends this bearer token; never pass it to a browser.
  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${localBackend.AUTH_LOCAL_EMAIL_INBOX_TOKEN}`,
    },
    redirect: "error",
    signal: AbortSignal.timeout(2000),
  });
  if (!response.ok)
    throw new Error("The private local inbox refused the runner.");
  return messagesSchema.parse(await response.json()).messages;
}
async function waitForPhoneCode(phone: string, previous: Set<string>) {
  // Delivery is scheduled after the send response. Only private inbox reads
  // repeat: at most 20 bounded reads, with no resend or provider retry.
  for (let attempt = 0; attempt < 20; attempt++) {
    const messages = await inboxMessages(phone);
    const delivered = messages.findLast(
      ({ id, kind }) => !previous.has(id) && kind === "phone-code",
    );
    if (delivered && /^\d{6}$/.test(delivered.text)) return delivered.text;
    if (attempt < 19) await delay(250);
  }
  throw new Error(
    "A fresh library-generated phone code was not delivered in time.",
  );
}
async function signInPhone(
  page: Page,
  key: keyof typeof LOCAL_ACCEPTANCE_PHONE_NUMBERS,
) {
  const account = roster.accounts.find((entry) => entry.key === key);
  if (account?.phone !== LOCAL_ACCEPTANCE_PHONE_NUMBERS[key])
    throw new Error("The fixed provisioned local phone persona is required.");
  const phone = account.phone;
  const oldMessages = await inboxMessages(phone);
  const previous = new Set(oldMessages.map(({ id }) => id));
  const send = await page.request.post("/api/auth/phone-number/send-otp", {
    headers: { Origin: site.origin },
    data: { phoneNumber: phone },
  });
  if (!send.ok())
    throw new Error(
      "Local phone send failed; no automatic resend is attempted.",
    );
  const code = await waitForPhoneCode(phone, previous);
  const verify = await page.request.post("/api/auth/phone-number/verify", {
    headers: { Origin: site.origin },
    data: { phoneNumber: phone, code },
  });
  if (!verify.ok())
    throw new Error("The real local phone verification failed.");
  const userSchema = z.object({
    phoneNumber: z.literal(phone),
    phoneNumberVerified: z.literal(true),
    email: z.literal(phoneEmail(phone)),
  });
  const identity = z
    .object({ user: userSchema })
    .safeParse(await verify.json());
  if (!identity.success)
    throw new Error("The local phone identity needs further authentication.");
}
// Four cases each use a different fixed phone persona and one actual code.
// Existing resend spacing and the five-send/24-hour phone lock remain active.
// Provisioning and reruns require a provisioned local
// runtime whose normal quota permits them; this suite never resets that quota.
process.env.PLAYWRIGHT_NO_COPY_PROMPT = "1";

async function exhaustTokenQuota(page: Page) {
  for (let index = 0; index < 105; index++) {
    const response = await page.request.get("/api/auth/convex/token");
    if (response.status() === 429) {
      const retryAfter = Number(response.headers()["x-retry-after"]);
      if (
        !Number.isSafeInteger(retryAfter) ||
        retryAfter < 1 ||
        retryAfter > 10
      )
        throw new Error("Token quota returned an invalid retry interval.");
      return retryAfter;
    }
    expect(response.status()).toBe(200);
  }
  throw new Error("The existing token quota did not reject the bounded probe.");
}

test.use({
  baseURL: site.origin,
  trace: "off",
  screenshot: "off",
  video: "off",
});

test("a rate-limited token check preserves the session and offers explicit recovery", async ({
  page,
  context,
}) => {
  const responses: { path: string; status: number }[] = [];
  page.on("response", (response) => {
    const path = new URL(response.url()).pathname;
    if (path === "/api/auth/get-session" || path === "/api/auth/convex/token")
      responses.push({ path, status: response.status() });
  });
  await context.setExtraHTTPHeaders({ "X-Forwarded-For": "192.0.2.242" });
  await signInPhone(page, "preprocessor");
  await page.goto("/en/account/security");
  await expect(
    page.getByRole("heading", { name: en.accountSecurity.title, exact: true }),
  ).toBeVisible();
  const retryAfter = await exhaustTokenQuota(page);
  const sessionResponse = await page.request.get("/api/auth/get-session");
  const session: unknown = await sessionResponse.json();
  expect(sessionResponse.status()).toBe(200);
  expect(
    session !== null,
    "The existing session is still valid at the token quota",
  ).toBe(true);
  await page.goto("/en/account/security");
  await expect(
    page.getByRole("heading", { name: en.common.error, exact: true }),
  ).toBeVisible();
  expect(new URL(page.url()).pathname.endsWith("/account/security")).toBe(true);
  await expect(
    page.getByRole("heading", { name: en.accountSecurity.title, exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByText(en.accountSecurity.description, { exact: true }),
  ).toHaveCount(0);
  // Honour the real server's quiet window. No quota reset, relogin or blind retry.
  await delay((retryAfter + 1) * 1000);
  await page
    .getByRole("button", { name: en.common.retry, exact: true })
    .click();
  try {
    await expect(
      page.getByRole("heading", {
        name: en.accountSecurity.title,
        exact: true,
      }),
    ).toBeVisible();
  } catch {
    const currentSession = await page.request.get("/api/auth/get-session");
    const body: unknown = await currentSession.json();
    const tokenResponse = await page.request.get("/api/auth/convex/token");
    const tokenStatus = tokenResponse.status();
    const diagnostic = {
      path: new URL(page.url()).pathname,
      hasSession: body !== null,
      tokenStatus,
      signInAgain: await page
        .getByRole("link", {
          name: en.accountSecurity.signInAgain,
          exact: true,
        })
        .count(),
      recovery: await page
        .getByRole("button", { name: en.common.retry, exact: true })
        .count(),
      responses,
    };
    throw new Error(`Recovery failed: ${JSON.stringify(diagnostic)}`);
  }
  await expect(
    page.getByText(en.accountSecurity.description, { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: en.nav.openMenu }).click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: en.app.signOut, exact: true })
    .click();
  await expect(page).toHaveURL(/\/login(?:\?|$)/);
  await page.goto("/en/account/security");
  await expect(page).toHaveURL(/\/login\?next=/);
});

// Deliberate client-only fault: the server guard and session remain real.
// This complements the real quota test above without weakening its limits.
test("a client token transport failure preserves the signed-in route until manual recovery", async ({
  page,
  context,
}) => {
  await page.setViewportSize({ width: 1024, height: 800 });
  await context.setExtraHTTPHeaders({ "X-Forwarded-For": "192.0.2.245" });
  await signInPhone(page, "kabadiwala");
  let faults = 0;
  await page.route("**/api/auth/convex/token", async (route) => {
    faults++;
    await route.fulfill({
      status: 503,
      contentType: "application/json",
      body: JSON.stringify({ code: "SERVICE_UNAVAILABLE" }),
    });
  });
  await page.goto("/en/app/trades");
  await expect(
    page.getByRole("heading", { name: en.common.error, exact: true }),
  ).toBeVisible();
  expect(new URL(page.url()).pathname.endsWith("/app/trades")).toBe(true);
  expect(faults).toBeGreaterThan(0);
  await expect(
    page.getByRole("heading", { name: en.market.trades.title, exact: true }),
  ).toHaveCount(0);
  const sessionResponse = await page.request.get("/api/auth/get-session");
  const session: unknown = await sessionResponse.json();
  expect(sessionResponse.status()).toBe(200);
  expect(session !== null, "The cookie session remains valid").toBe(true);
  const token = await page.request.get("/api/auth/convex/token");
  expect(token.status()).toBe(200);
  await page.unroute("**/api/auth/convex/token");
  await page
    .getByRole("button", { name: en.common.retry, exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: en.market.trades.title, exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText(en.market.trades.gatewayPending, { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("banner")
    .getByRole("button", { name: en.app.more, exact: true })
    .click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: en.app.signOut, exact: true })
    .click();
  await expect(page).toHaveURL(/\/login(?:\?|$)/);
  const signedOut = await page.request.get("/api/auth/convex/token");
  expect(signedOut.status()).toBe(401);
});

for (const [index, entry] of [
  {
    path: "/account/security",
    heading: en.accountSecurity.title,
    persona: "manufacturer" as const,
  },
  {
    path: "/account/notifications",
    heading: en.notifications.title,
    persona: "household" as const,
  },
].entries()) {
  test(`client token failure has manual recovery at ${entry.path}`, async ({
    page,
    context,
  }) => {
    await context.setExtraHTTPHeaders({
      "X-Forwarded-For": `192.0.2.${String(246 + index)}`,
    });
    await signInPhone(page, entry.persona);
    await page.route("**/api/auth/convex/token", async (route) => {
      await route.fulfill({
        status: 503,
        contentType: "application/json",
        body: JSON.stringify({ code: "SERVICE_UNAVAILABLE" }),
      });
    });
    await page.goto(`/en${entry.path}`);
    await expect(
      page.getByRole("button", { name: en.common.retry, exact: true }),
    ).toBeVisible();
    expect(new URL(page.url()).pathname.replace(/^\/en(?=\/)/, "")).toBe(
      entry.path.split("?", 1)[0],
    );
    const session = await page.request.get("/api/auth/get-session");
    expect(session.status()).toBe(200);
    expect(await session.json()).not.toBeNull();
    await page.unroute("**/api/auth/convex/token");
    await page
      .getByRole("button", { name: en.common.retry, exact: true })
      .click();
    await expect(
      page.getByRole("heading", { name: entry.heading, exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: en.common.retry, exact: true }),
    ).toHaveCount(0);
    const logout = await page.request.post("/api/auth/sign-out", {
      headers: { Origin: site.origin },
      data: {},
    });
    expect(logout.status()).toBe(200);
    await page.goto("/en/account/security");
    await expect(page).toHaveURL(/\/login\?next=/);
  });
}
