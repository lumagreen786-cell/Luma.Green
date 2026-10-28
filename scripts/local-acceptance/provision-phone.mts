import { execFileSync } from "node:child_process";
import { chmod, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { type APIRequestContext, request } from "@playwright/test";
import { ConvexHttpClient } from "convex/browser";
import { z } from "zod";

import { api } from "../../convex/_generated/api";
import {
  isLoopbackHttpOrigin,
  LOCAL_ACCEPTANCE_PERSONAS,
} from "../../convex/lib/localAcceptance";
import { phoneEmail } from "../../convex/lib/phone";

class AcceptanceError extends Error {}
const cookieSchema = z.object({
  name: z.string(),
  value: z.string(),
  domain: z.string(),
  path: z.string(),
  expires: z.number(),
  httpOnly: z.boolean(),
  secure: z.boolean(),
  sameSite: z.enum(["Strict", "Lax", "None"]),
});
const storageEntrySchema = z.object({ name: z.string(), value: z.string() });
const originSchema = z.object({
  origin: z.string(),
  localStorage: z.array(storageEntrySchema),
});
const storageSchema = z.object({
  cookies: z.array(cookieSchema),
  origins: z.array(originSchema),
});
const accountSchema = z.object({
  key: z.string(),
  phone: z.string(),
  authUserId: z.string(),
  storageState: storageSchema,
});
const artifactSchema = z.object({
  version: z.literal(1),
  site: z.string().refine(isLoopbackHttpOrigin),
  accounts: z.array(accountSchema),
});
const userValueSchema = z.object({
  id: z.string(),
  phoneNumber: z.string(),
  phoneNumberVerified: z.literal(true),
  email: z.string(),
});
const userSchema = z.object({ user: userValueSchema });
const messageSchema = z.object({
  id: z.string(),
  kind: z.string(),
  text: z.string(),
});
const messagesSchema = z.object({ messages: z.array(messageSchema) });
const configSchema = z.object({
  SITE_URL: z.string().refine(isLoopbackHttpOrigin),
  NEXT_PUBLIC_CONVEX_URL: z.string().refine(isLoopbackHttpOrigin),
  NEXT_PUBLIC_CONVEX_SITE_URL: z.string().refine(isLoopbackHttpOrigin),
  AUTH_LOCAL_TEST_MODE: z.literal("true"),
  AUTH_LOCAL_EMAIL_INBOX_URL: z.url(),
  AUTH_LOCAL_EMAIL_INBOX_TOKEN: z.string().min(32),
});
type Config = z.infer<typeof configSchema>;
type Artifact = z.infer<typeof artifactSchema>;
type PhoneAccount = z.infer<typeof accountSchema>;
type Persona = (typeof LOCAL_ACCEPTANCE_PERSONAS)[number];
const requiredKeys = [
  "household",
  "kabadiwala",
  "preprocessor",
  "manufacturer",
  "csr-sponsor",
  "applicant",
  "saathi",
];
const privateDir = path.resolve(".convex/local-acceptance");
const artifactPath = path.join(privateDir, "phone-sessions.json");

function loadConfig() {
  if (process.argv.length !== 2)
    throw new AcceptanceError(
      "This local runner accepts no deployment arguments.",
    );
  process.loadEnvFile(".env.local");
  process.loadEnvFile(".convex/local-acceptance/backend.env");
  const config = configSchema.parse(process.env);
  const inbox = new URL(config.AUTH_LOCAL_EMAIL_INBOX_URL);
  if (!isLoopbackHttpOrigin(inbox.origin) || inbox.pathname !== "/deliver")
    throw new AcceptanceError(
      "The private inbox must be a loopback /deliver endpoint.",
    );
  return config;
}
async function savedArtifact(site: string): Promise<Artifact> {
  await mkdir(privateDir, { recursive: true, mode: 0o700 });
  await chmod(privateDir, 0o700);
  try {
    const artifact = artifactSchema.parse(
      JSON.parse(await readFile(artifactPath, "utf8")),
    );
    if (artifact.site !== site)
      throw new AcceptanceError(
        "Saved phone sessions belong to a different local website.",
      );
    return artifact;
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT")
      return { version: 1, site, accounts: [] };
    throw error;
  }
}
async function persist(artifact: Artifact) {
  await writeFile(artifactPath, `${JSON.stringify(artifact, null, 2)}\n`, {
    mode: 0o600,
  });
  await chmod(artifactPath, 0o600);
}
async function inboxMessages(config: Config, phone: string) {
  const url = new URL("/messages", config.AUTH_LOCAL_EMAIL_INBOX_URL);
  url.searchParams.set("to", phone);
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${config.AUTH_LOCAL_EMAIL_INBOX_TOKEN}` },
    redirect: "error",
  });
  if (!response.ok)
    throw new AcceptanceError(
      "The private inbox refused a local runner request.",
    );
  const parsed = messagesSchema.parse(await response.json());
  return parsed.messages;
}
async function verifyPhone(
  context: APIRequestContext,
  persona: Persona,
  config: Config,
) {
  const oldMessages = await inboxMessages(config, persona.phone);
  const previous = new Set(oldMessages.map(({ id }) => id));
  const send = await context.post("/api/auth/phone-number/send-otp", {
    data: { phoneNumber: persona.phone },
  });
  if (!send.ok())
    throw new AcceptanceError(
      `Local phone send failed for ${persona.key} (HTTP ${String(send.status())}); no automatic resend was attempted.`,
    );
  const messages = await inboxMessages(config, persona.phone);
  const delivered = messages.findLast(
    ({ id, kind }) => !previous.has(id) && kind === "phone-code",
  );
  if (!delivered || !/^\d{6}$/.test(delivered.text))
    throw new AcceptanceError(
      `A fresh library-generated phone code was not delivered for ${persona.key}.`,
    );
  const verify = await context.post("/api/auth/phone-number/verify", {
    data: { phoneNumber: persona.phone, code: delivered.text },
  });
  if (!verify.ok())
    throw new AcceptanceError(
      `Local phone verification failed for ${persona.key} (HTTP ${String(verify.status())}).`,
    );
  const parsed = userSchema.safeParse(await verify.json());
  if (!parsed.success)
    throw new AcceptanceError(
      `Local phone authentication requires a further factor for ${persona.key}.`,
    );
  return parsed.data.user;
}
async function authenticatedUser(
  context: APIRequestContext,
  saved: PhoneAccount | undefined,
  persona: Persona,
  config: Config,
) {
  if (saved) {
    const session = await context.get("/api/auth/get-session");
    if (!session.ok())
      throw new AcceptanceError(
        `Local session endpoint failed for ${persona.key} (HTTP ${String(session.status())}); no new code was requested.`,
      );
    const parsed = userSchema.safeParse(await session.json());
    if (parsed.success && parsed.data.user.id === saved.authUserId)
      return parsed.data.user;
  }
  return verifyPhone(context, persona, config);
}
async function provisionPersona(
  persona: Persona,
  index: number,
  artifact: Artifact,
  config: Config,
) {
  const saved = artifact.accounts.find(({ key }) => key === persona.key);
  if (saved && saved.phone !== persona.phone)
    throw new AcceptanceError(
      "Saved phone session does not match the fixed persona.",
    );
  const context = await request.newContext({
    baseURL: config.SITE_URL,
    storageState: saved?.storageState,
    extraHTTPHeaders: {
      Origin: config.SITE_URL,
      "X-Forwarded-For": `192.0.2.${String(120 + index)}`,
    },
  });
  try {
    const user = await authenticatedUser(context, saved, persona, config);
    if (
      user.phoneNumber !== persona.phone ||
      user.email !== phoneEmail(persona.phone)
    )
      throw new AcceptanceError(
        "The authenticated identity does not match its fixed local persona.",
      );
    const response = await context.get("/api/auth/convex/token");
    if (!response.ok())
      throw new AcceptanceError(
        `The local Convex token endpoint rejected ${persona.key}.`,
      );
    const { token } = z
      .object({ token: z.string() })
      .parse(await response.json());
    const client = new ConvexHttpClient(config.NEXT_PUBLIC_CONVEX_URL);
    client.setAuth(token);
    await client.mutation(api.identity.ensureProfile, { locale: "en" });
    process.stdout.write(`Verified local phone persona: ${persona.key}\n`);
    return {
      key: persona.key,
      phone: persona.phone,
      authUserId: user.id,
      storageState: await context.storageState(),
    };
  } finally {
    await context.dispose();
  }
}
function localFixture(name: string, args: unknown) {
  try {
    return execFileSync(
      // eslint-disable-next-line sonarjs/no-os-command-from-path -- Fixed project CLI after strict loopback validation; no shell or supplied command.
      "pnpm",
      [
        "--config.verify-deps-before-run=false",
        "exec",
        "convex",
        "run",
        name,
        JSON.stringify(args),
      ],
      { stdio: "pipe", env: process.env },
    );
  } catch (error) {
    const stderr =
      error instanceof Error && "stderr" in error ? String(error.stderr) : "";
    const code =
      /(?:ACCEPTANCE_[A-Z_]+|LOCAL_ACCEPTANCE_ONLY|MATERIAL_DEFINITION_CONFLICT|Could not find function)/.exec(
        stderr,
      )?.[0] ?? "LOCAL_CLI_FAILED";
    throw new AcceptanceError(`Local fixture step ${name} stopped (${code}).`);
  }
}
async function main() {
  const config = loadConfig();
  const artifact = await savedArtifact(config.SITE_URL);
  for (const [index, key] of requiredKeys.entries()) {
    const persona = LOCAL_ACCEPTANCE_PERSONAS.find(
      (entry) => entry.key === key,
    );
    if (!persona)
      throw new AcceptanceError("A required fixed persona is missing.");
    const account = await provisionPersona(persona, index, artifact, config);
    artifact.accounts = artifact.accounts.filter(
      (entry) => entry.key !== persona.key,
    );
    artifact.accounts.push(account);
    await persist(artifact);
  }
  const accounts = artifact.accounts
    .filter(({ key }) => requiredKeys.includes(key))
    .map(({ key, authUserId }) => ({ key, authUserId }));
  // The strict local fixture gate must pass before reference-only initialization.
  localFixture("localAcceptance:seed", { accounts });
  localFixture("catalogue:initializeReferenceDefinitions", {
    operatorReference: "local-phone-browser-acceptance",
  });
  localFixture("services:seedReferenceKinds", {});
  process.stdout.write(
    `Prepared ${String(accounts.length)} local phone personas. Private browser sessions were saved with restricted permissions.\n`,
  );
}
try {
  await main();
} catch (error: unknown) {
  // Never print Playwright request objects, auth responses or private environment data.
  process.stderr.write(
    `${error instanceof AcceptanceError ? error.message : "Local phone provisioning stopped; inspect the local services without printing auth artifacts."}\n`,
  );
  process.exitCode = 1;
}
