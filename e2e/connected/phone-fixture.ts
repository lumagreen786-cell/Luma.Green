import { readFileSync } from "node:fs";
import { parseEnv } from "node:util";

import type { Browser, BrowserContext, Locator, Page } from "@playwright/test";
import { ConvexHttpClient } from "convex/browser";
import { z } from "zod";

import { isLoopbackHttpOrigin } from "../../convex/lib/localAcceptance";

const cookie = z.object({
  name: z.string(),
  value: z.string(),
  domain: z.string(),
  path: z.string(),
  expires: z.number(),
  httpOnly: z.boolean(),
  secure: z.boolean(),
  sameSite: z.enum(["Strict", "Lax", "None"]),
});
const entry = z.object({ name: z.string(), value: z.string() });
const storedOrigin = z.object({
  origin: z.string(),
  localStorage: z.array(entry),
});
const storage = z.object({
  cookies: z.array(cookie),
  origins: z.array(storedOrigin),
});
const account = z.object({ key: z.string(), storageState: storage });
const artifactSource: unknown = JSON.parse(
  readFileSync(".convex/local-acceptance/phone-sessions.json", "utf8"),
);
const artifact = z
  .object({
    site: z.string().refine(isLoopbackHttpOrigin),
    accounts: z.array(account),
  })
  .parse(artifactSource);
const frontendEnvironment = parseEnv(readFileSync(".env.local", "utf8"));
const local = z
  .object({
    NEXT_PUBLIC_CONVEX_URL: z.string().refine(isLoopbackHttpOrigin),
    NEXT_PUBLIC_CONVEX_SITE_URL: z.string().refine(isLoopbackHttpOrigin),
  })
  .parse(frontendEnvironment);
const backendEnvironment = parseEnv(
  readFileSync(".convex/local-acceptance/backend.env", "utf8"),
);
const localBackend = z
  .object({
    SITE_URL: z.string().refine(isLoopbackHttpOrigin),
    AUTH_LOCAL_TEST_MODE: z.literal("true"),
    AUTH_LOCAL_EMAIL_INBOX_URL: z.url(),
  })
  .parse(backendEnvironment);
if (
  new URL(localBackend.SITE_URL).origin !== new URL(artifact.site).origin ||
  !isLoopbackHttpOrigin(new URL(localBackend.AUTH_LOCAL_EMAIL_INBOX_URL).origin)
)
  throw new Error(
    "The browser test requires the current loopback phone runtime.",
  );

export async function actor(browser: Browser, key: string) {
  const saved = artifact.accounts.find((row) => row.key === key);
  if (!saved) throw new Error(`Missing local phone persona: ${key}`);
  const context = await browser.newContext({
    baseURL: artifact.site,
    storageState: saved.storageState,
    extraHTTPHeaders: {
      Origin: artifact.site,
      "X-Forwarded-For": `192.0.2.${String(190 + artifact.accounts.indexOf(saved))}`,
    },
  });
  context.setDefaultTimeout(20_000);
  context.setDefaultNavigationTimeout(30_000);
  return context;
}
export async function clientFor(context: BrowserContext) {
  const response = await context.request.get("/api/auth/convex/token");
  if (!response.ok())
    throw new Error("A local phone session has no Convex token.");
  const parsed = z
    .object({ token: z.string() })
    .safeParse(await response.json());
  if (!parsed.success)
    throw new Error("A local phone session needs authentication recovery.");
  const client = new ConvexHttpClient(local.NEXT_PUBLIC_CONVEX_URL, {
    logger: false,
  });
  client.setAuth(parsed.data.token);
  return client;
}
export async function choose(
  page: Page,
  scope: Locator,
  label: string,
  option: string,
) {
  await scope.getByRole("combobox", { name: label, exact: true }).click();
  await page.getByRole("option", { name: option, exact: true }).click();
}
