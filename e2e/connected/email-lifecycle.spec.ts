import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { parseEnv } from "node:util";

import { expect, type Locator, type Page, test } from "@playwright/test";
import { z } from "zod";

import en from "../../messages/en.json";

const inboxEnvironment = parseEnv(
  readFileSync(".convex/local-acceptance/backend.env", "utf8"),
);
const inbox = z
  .object({
    AUTH_LOCAL_TEST_MODE: z.literal("true"),
    SITE_URL: z.url(),
    AUTH_LOCAL_EMAIL_INBOX_URL: z.url(),
    AUTH_LOCAL_EMAIL_INBOX_TOKEN: z.string().min(32),
  })
  .parse(inboxEnvironment);
function localUrl(value: string) {
  const url = new URL(value);
  if (
    url.protocol !== "http:" ||
    !["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)
  )
    throw new Error("Email acceptance requires local services.");
  return url;
}
const site = localUrl(inbox.SITE_URL);
function requireMatchingSite(baseURL: string | undefined) {
  if (baseURL !== site.origin)
    throw new Error("The browser and local auth site must match.");
}
const inboxUrl = localUrl(inbox.AUTH_LOCAL_EMAIL_INBOX_URL);
const messageSchema = z.object({ kind: z.string(), text: z.string() });
const mailSchema = z.object({ messages: z.array(messageSchema) });

async function fillPrivate(field: Locator, value: string) {
  try {
    await field.fill(value);
  } catch {
    throw new Error("The private email form field could not be filled.");
  }
}

async function openEmail(page: Page, shouldChooseLanguage = false) {
  await page.goto("/en/login?next=/account/security");
  if (shouldChooseLanguage) {
    await page.getByRole("radio", { name: "English", exact: true }).check();
    await page
      .getByRole("button", { name: en.auth.continue, exact: true })
      .click();
  }
  await page
    .getByRole("tab", { name: en.emailAuth.email, exact: true })
    .click();
}

async function submitCredentials(page: Page, email: string, password: string) {
  await fillPrivate(
    page.getByRole("textbox", { name: en.emailAuth.email, exact: true }),
    email,
  );
  await fillPrivate(
    page.getByLabel(en.emailAuth.password, { exact: true }),
    password,
  );
  await page
    .getByRole("button", { name: en.emailAuth.signin, exact: true })
    .click();
}

async function noSession(page: Page) {
  const response = await page.request.get("/api/auth/get-session");
  expect(response.ok()).toBe(true);
  const session: unknown = await response.json();
  expect(session === null, "No authenticated session exists").toBe(true);
  const token = await page.request.get("/api/auth/convex/token");
  expect(token.status()).toBe(401);
}

async function mailLink(
  page: Page,
  email: string,
  kind: "verification" | "password-reset",
) {
  let result: string | undefined;
  const url = new URL("/messages", inboxUrl.origin);
  url.searchParams.set("to", email);
  await expect
    .poll(
      async () => {
        const response = await page.request.get(url.href, {
          headers: {
            Authorization: `Bearer ${inbox.AUTH_LOCAL_EMAIL_INBOX_TOKEN}`,
          },
        });
        if (!response.ok())
          throw new Error("The protected local inbox could not be read.");
        const parsed = mailSchema.safeParse(await response.json());
        if (!parsed.success)
          throw new Error(
            "The protected local inbox returned an invalid response.",
          );
        result = parsed.data.messages
          .findLast((message) => message.kind === kind)
          ?.text.match(/https?:\/\/[^\s<>]+/)?.[0];
        return result !== undefined;
      },
      { message: "The local inbox receives the requested account link" },
    )
    .toBe(true);
  if (!result) throw new Error("The local account link is missing.");
  const link = new URL(result);
  const expectedPath =
    kind === "verification"
      ? "/en/login/email/verify"
      : "/en/login/email/reset";
  if (
    link.origin !== site.origin ||
    link.pathname !== expectedPath ||
    !link.searchParams.get("token")
  )
    throw new Error("The account link does not belong to this local flow.");
  return link.href;
}

async function openPrivateLink(page: Page, link: string) {
  try {
    await page.goto(link);
  } catch {
    // A navigation failure can include the full URL. Never print its token.
    throw new Error("The local account link could not be opened.");
  }
  await expect.poll(() => new URL(page.url()).search === "").toBe(true);
  await expect(page.locator('meta[name="referrer"]')).toHaveAttribute(
    "content",
    "no-referrer",
  );
}

async function setNewPassword(page: Page, password: string) {
  await fillPrivate(
    page.getByLabel(en.emailAuth.password, { exact: true }),
    password,
  );
  await fillPrivate(
    page.getByLabel(en.emailAuth.confirm, { exact: true }),
    password,
  );
  await page
    .getByRole("button", { name: en.emailAuth.reset, exact: true })
    .click();
}

async function assertSignedIn(page: Page) {
  await expect(page).toHaveURL(/\/account\/security$/, { timeout: 25_000 });
  await expect(
    page.getByRole("heading", { name: en.accountSecurity.title, exact: true }),
  ).toBeVisible();
  await expect(
    page.getByLabel(en.emailAuth.password, { exact: true }),
  ).toBeVisible();
  const token = await page.request.get("/api/auth/convex/token");
  expect(token.status()).toBe(200);
}

test.use({
  actionTimeout: 15_000,
  trace: "off",
  screenshot: "off",
  video: "off",
});

test("email signup, verified ownership and password recovery use the real browser flow", async ({
  page,
  context,
  browser,
  baseURL,
}) => {
  requireMatchingSite(baseURL);
  // Distinct local browser clients keep ordinary per-IP authentication quotas.
  await context.setExtraHTTPHeaders({ "X-Forwarded-For": "192.0.2.233" });
  const email = `email-lifecycle-${randomUUID()}@example.test`;
  const initialPassword = `Initial-${randomUUID()}`;
  const newPassword = `Recovered-${randomUUID()}`;
  const errors: string[] = [];
  page.on("pageerror", (error) => {
    errors.push(error.name);
  });
  await openEmail(page, true);
  await page
    .getByRole("button", { name: en.emailAuth.signup, exact: true })
    .click();
  await page
    .getByLabel(en.emailAuth.name, { exact: true })
    .fill("Local email lifecycle");
  await fillPrivate(
    page.getByRole("textbox", { name: en.emailAuth.email, exact: true }),
    email,
  );
  await fillPrivate(
    page.getByLabel(en.emailAuth.password, { exact: true }),
    initialPassword,
  );
  await page.getByRole("checkbox", { name: en.join.consent.age }).check();
  await page
    .getByRole("button", { name: en.emailAuth.signup, exact: true })
    .click();
  await expect(page.getByRole("status")).toHaveText(en.emailAuth.sent);
  await noSession(page);

  await page
    .getByRole("button", { name: en.emailAuth.signin, exact: true })
    .click();
  await submitCredentials(page, email, initialPassword);
  await expect(page.getByRole("main").getByRole("alert")).toHaveText(
    en.emailAuth.unverified,
  );
  await noSession(page);
  const verification = await mailLink(page, email, "verification");
  await openPrivateLink(page, verification);
  await page
    .getByRole("button", { name: en.emailAuth.verify, exact: true })
    .click();
  await expect(page.getByRole("status")).toHaveText(en.emailAuth.done);
  await noSession(page);
  await openEmail(page);
  await submitCredentials(page, email, initialPassword);
  await assertSignedIn(page);

  const recoveryContext = await browser.newContext({
    baseURL,
    extraHTTPHeaders: { "X-Forwarded-For": "192.0.2.234" },
  });
  try {
    const recovery = await recoveryContext.newPage();
    recovery.on("pageerror", (error) => {
      errors.push(error.name);
    });
    await openEmail(recovery, true);
    await recovery
      .getByRole("button", { name: en.emailAuth.forgot, exact: true })
      .click();
    await fillPrivate(
      recovery.getByRole("textbox", { name: en.emailAuth.email, exact: true }),
      email,
    );
    await recovery
      .getByRole("button", { name: en.emailAuth.forgot, exact: true })
      .click();
    await expect(recovery.getByRole("status")).toHaveText(en.emailAuth.sent);
    const reset = await mailLink(recovery, email, "password-reset");
    await openPrivateLink(recovery, reset);
    await setNewPassword(recovery, newPassword);
    await expect(recovery.getByRole("status")).toHaveText(en.emailAuth.done);
    await noSession(recovery);
    // Reset revokes the session that remained open in the first browser.
    await noSession(page);

    await openPrivateLink(recovery, reset);
    await setNewPassword(recovery, initialPassword);
    await expect(recovery.getByRole("main").getByRole("alert")).toHaveText(
      en.emailAuth.invalidLink,
    );
    await noSession(recovery);
    await openEmail(recovery);
    await submitCredentials(recovery, email, initialPassword);
    await expect(recovery.getByRole("main").getByRole("alert")).toHaveText(
      en.emailAuth.credentials,
    );
    await noSession(recovery);
    await submitCredentials(recovery, email, newPassword);
    await assertSignedIn(recovery);
    await recovery.getByRole("button", { name: en.nav.openMenu }).click();
    await recovery
      .getByRole("dialog")
      .getByRole("button", { name: en.app.signOut, exact: true })
      .click();
    await expect(recovery).toHaveURL(/\/login(?:\?|$)/);
    await noSession(recovery);
  } finally {
    await recoveryContext.close();
  }
  expect(errors).toEqual([]);
});

test("verified email member binds a phone in Account Security without changing identity", async ({
  page,
  context,
  baseURL,
}) => {
  requireMatchingSite(baseURL);
  await context.setExtraHTTPHeaders({ "X-Forwarded-For": "192.0.2.239" });
  const email = `phone-binding-${randomUUID()}@example.test`;
  const password = `Binding-${randomUUID()}`;
  const phone = `+919${Date.now().toString().slice(-9)}`;
  const signup = await page.request.post("/api/auth/sign-up/email", {
    headers: { Origin: site.origin, "x-luma-locale": "en" },
    data: { name: "Disposable phone binding", email, password },
  });
  expect(signup.status()).toBe(200);
  await openPrivateLink(page, await mailLink(page, email, "verification"));
  await page
    .getByRole("button", { name: en.emailAuth.verify, exact: true })
    .click();
  await expect(page.getByRole("status")).toHaveText(en.emailAuth.done);
  await openEmail(page, true);
  await submitCredentials(page, email, password);
  await assertSignedIn(page);
  const shape = z.object({
    user: z.object({
      id: z.string(),
      phoneNumberVerified: z.boolean().nullish(),
    }),
    session: z.object({ id: z.string() }),
  });
  const beforeResponse = await page.request.get("/api/auth/get-session");
  const before = shape.parse(await beforeResponse.json());
  const section = page.getByRole("region", { name: en.accountPhone.title });
  await fillPrivate(section.getByLabel(en.auth.mobileLabel), phone);
  await section
    .getByRole("button", { name: en.auth.sendCode, exact: true })
    .click();
  await expect(section.getByLabel(en.auth.codeLabel)).toBeVisible();
  const url = new URL("/messages", inboxUrl.origin);
  url.searchParams.set("to", phone);
  let code: string | undefined;
  await expect
    .poll(async () => {
      const response = await page.request.get(url.href, {
        headers: {
          Authorization: `Bearer ${inbox.AUTH_LOCAL_EMAIL_INBOX_TOKEN}`,
        },
      });
      if (!response.ok()) throw new Error("Protected local inbox unavailable");
      code = mailSchema
        .parse(await response.json())
        .messages.findLast((item) => item.kind === "phone-code")?.text;
      return Boolean(code && /^\d{6}$/.test(code));
    })
    .toBe(true);
  if (!code) throw new Error("No generated local phone code delivered");
  await fillPrivate(section.getByLabel(en.auth.codeLabel), code);
  await section
    .getByRole("button", { name: en.auth.verify, exact: true })
    .click();
  await expect(section.getByRole("status")).toHaveText(
    en.accountPhone.verified,
  );
  const afterResponse = await page.request.get("/api/auth/get-session");
  const after = shape.parse(await afterResponse.json());
  expect(
    after.user.id === before.user.id && after.session.id === before.session.id,
  ).toBe(true);
  expect(after.user.phoneNumberVerified).toBe(true);
  await page.reload();
  await expect(
    page
      .getByRole("region", { name: en.accountPhone.title })
      .getByRole("status"),
  ).toHaveText(en.accountPhone.verified);
  await page.request.post("/api/auth/sign-out", {
    headers: { Origin: site.origin },
    data: {},
  });
  const attempt = await page.request.post("/api/auth/phone-number/verify", {
    headers: { Origin: site.origin },
    data: { phoneNumber: phone, code },
  });
  expect(attempt.status()).toBe(403);
  await noSession(page);
});
