import { readFileSync } from "node:fs";
import { writeFile } from "node:fs/promises";
import path from "node:path";

import { expect, test } from "@playwright/test";
import { ConvexHttpClient } from "convex/browser";
import { z } from "zod";

import { api } from "../../convex/_generated/api";
import {
  isLoopbackHttpOrigin,
  LOCAL_ACCEPTANCE_PERSONAS,
} from "../../convex/lib/localAcceptance";
import en from "../../messages/en.json" with { type: "json" };

// This runner reads only the separate, restricted local configuration. It never
// loads or writes the repository's cloud-selected .env.local.
const privateDir = path.resolve(
  process.env.LOCAL_ROLE_ACCEPTANCE_DIR ?? ".convex/local-role-acceptance",
);
process.loadEnvFile(path.join(privateDir, "runner.env"));
const site = process.env.SITE_URL;
const backend = z
  .string()
  .refine(isLoopbackHttpOrigin)
  .parse(process.env.NEXT_PUBLIC_CONVEX_URL);
if (
  !site ||
  !backend ||
  !isLoopbackHttpOrigin(site) ||
  !isLoopbackHttpOrigin(backend)
)
  throw new Error("Local loopback configuration required.");
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
  storageState: storageSchema,
});
const rosterSchema = z.object({
  site: z.string().refine(isLoopbackHttpOrigin),
  accounts: z.array(accountSchema),
});
const rosterPath = path.join(privateDir, "phone-sessions.json");
const rosterSource: unknown = JSON.parse(readFileSync(rosterPath, "utf8"));
const saved = rosterSchema.parse(rosterSource);
if (saved.site !== site || saved.accounts.length !== 28)
  throw new Error("Complete local phone roster required.");
const reportPath = process.env.LOCAL_ROLE_ACCEPTANCE_REPORT;
if (!reportPath)
  throw new Error("A public non-sensitive report path is required.");

// eslint-disable-next-line sonarjs/cognitive-complexity -- Bounded roster audit records explicit role-specific checks for every participant.
test("28 phone personas preserve access", async ({ browser }) => {
  const actors = new Map<
    string,
    {
      context: Awaited<ReturnType<typeof browser.newContext>>;
      client: ConvexHttpClient;
    }
  >();
  const results: {
    persona: string;
    status: string;
    checks: string[];
    failure?: string;
  }[] = [];
  const external = { blockedRequests: 0 };
  async function actor(key: string) {
    const cached = actors.get(key);
    if (cached) return cached;
    const entry = saved.accounts.find(
      (row: { key: string }) => row.key === key,
    );
    if (!entry) throw new Error("Missing local session.");
    const context = await browser.newContext({
      baseURL: site,
      storageState: entry.storageState,
      extraHTTPHeaders: {
        "X-Forwarded-For": `192.0.2.${String(180 + saved.accounts.indexOf(entry))}`,
      },
    });
    await context.route("**/*", async (route) => {
      const url = new URL(route.request().url());
      if (["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)) {
        await route.continue();
      } else {
        external.blockedRequests += 1;
        await route.abort();
      }
    });
    context.setDefaultTimeout(20_000);
    context.setDefaultNavigationTimeout(90_000);
    const response = await context.request.get("/api/auth/convex/token");
    if (!response.ok())
      throw new Error("Local authenticated token unavailable.");
    const { token } = z
      .object({ token: z.string() })
      .parse(await response.json());
    const client = new ConvexHttpClient(backend, { logger: false });
    client.setAuth(token);
    const value = { context, client };
    actors.set(key, value);
    return value;
  }
  const programmeFields = {
    area: "Synthetic Bengaluru test area",
    stream: "Paper test stream",
    startsOn: "2026-10-01",
    endsOn: "2026-10-31",
    evidenceReference: "Synthetic private test statement, not verified",
    coverageCount: 1,
    trips: 1,
    centreHandovers: 0,
    quantityGrams: 1001,
    groupIncomePaise: 0,
  };
  const selectedKey = process.env.LOCAL_ROLE_ACCEPTANCE_ONLY;
  const selectedKeys = selectedKey?.split(",");
  const personas = selectedKeys
    ? LOCAL_ACCEPTANCE_PERSONAS.filter(({ key }) => selectedKeys.includes(key))
    : LOCAL_ACCEPTANCE_PERSONAS;
  if (personas.length === 0)
    throw new Error("Unknown local persona selection.");
  try {
    const owner = await actor("kabadiwala");
    const ownerWorkspace = await owner.client.query(api.workspace.mine, {});
    if (ownerWorkspace?.kind !== "org")
      throw new Error("Local owner workspace required.");
    const scope = { kind: "workspace" as const, id: ownerWorkspace.org.id };
    const granted = new Map<string, "admin" | "member" | "viewer">([
      ["team-admin", "admin"],
      ["team-member", "member"],
      ["team-viewer", "viewer"],
      ["invite-recipient", "member"],
    ]);
    for (const [key, role] of granted) {
      const recipient = await actor(key);
      const persona = LOCAL_ACCEPTANCE_PERSONAS.find((row) => row.key === key);
      if (!persona) throw new Error("Unknown fixed candidate.");
      const prior = await recipient.client.query(api.workspace.mine, {});
      if (prior?.kind !== "org") {
        const pending = await owner.client.query(api.teamInvitations.list, {
          scope,
        });
        const stale = pending.filter(
          (row) =>
            row.phone === persona.phone && !row.acceptedAt && !row.revokedAt,
        );
        for (const old of stale) {
          await owner.client.mutation(api.teamInvitations.revoke, {
            scope,
            invitationId: old.id,
          });
        }
        const invitation = await owner.client.action(
          api.teamInvitations.create,
          {
            scope,
            phone: persona.phone,
            role,
          },
        );
        const preview = await recipient.client.query(
          api.teamInvitations.preview,
          { token: invitation.token },
        );
        if (preview?.role !== role)
          throw new Error("Normal phone invitation is unavailable.");
        await recipient.client.mutation(api.teamInvitations.accept, {
          token: invitation.token,
        });
      }
      const current = await recipient.client.query(api.workspace.mine, {});
      if (
        current?.kind !== "org" ||
        current.role !== role ||
        current.org.id !== scope.id
      )
        throw new Error(
          "Normal phone invitation did not grant the expected workspace role.",
        );
    }
    const household = await actor("household"),
      unrelated = await actor("unrelated-owner");
    const privateOne = await household.client.mutation(
      api.services.createProgramme,
      {
        ...programmeFields,
        title: "Private household acceptance sentinel",
        operationKey: "role-private-household-0001",
      },
    );
    const unrelatedWorkspace = await unrelated.client.query(
      api.workspace.mine,
      {},
    );
    if (unrelatedWorkspace?.kind !== "org")
      throw new Error("Unrelated workspace required.");
    const privateTwo = await unrelated.client.mutation(
      api.services.createProgramme,
      {
        ...programmeFields,
        orgId: unrelatedWorkspace.org.id,
        title: "Private unrelated acceptance sentinel",
        operationKey: "role-private-unrelated-0001",
      },
    );
    for (const persona of personas) {
      const checks: string[] = [];
      const row = {
        persona: persona.key,
        status: "running",
        checks,
        failure: undefined as string | undefined,
      };
      results.push(row);
      const { context, client } = await actor(persona.key);
      const page = await context.newPage();
      const errors: string[] = [];
      const privateErrors: { name: string; message: string; stack?: string }[] =
        [];
      const authStatus: { path: string; status: number }[] = [];
      page.on("response", (response) => {
        const routePath = new URL(response.url()).pathname;
        if (routePath.startsWith("/api/auth/"))
          authStatus.push({ path: routePath, status: response.status() });
      });
      page.on("pageerror", (error) => {
        errors.push(error.name);
        privateErrors.push({
          name: error.name,
          message: error.message,
          stack: error.stack,
        });
      });
      try {
        const work = await client.query(api.workspace.mine, {});
        const role = granted.get(persona.key);
        if (role || persona.access.kind === "org") {
          expect(work?.kind).toBe("org");
          if (work?.kind !== "org")
            throw new Error("Expected operator workspace missing.");
          expect(work.role).toBe(role ?? "owner");
          expect(work.org.kind).toBe(
            persona.access.kind === "org"
              ? persona.access.orgKind
              : "kabadiwala",
          );
        } else if (persona.access.kind === "saathi") {
          expect(work?.kind).toBe("saathi");
        } else {
          expect(work?.kind).toBe("none");
        }
        checks.push(
          "expected canonical role and workspace kind match before browser work",
        );
        await page.goto("/en/account/workspaces");
        await expect(page.getByRole("heading", { level: 1 })).toHaveText(
          en.workspace.title,
        );
        if (work?.kind === "org") {
          await expect(
            page.getByRole("combobox", { name: en.workspace.choose }),
          ).toBeVisible();
          await page.reload();
          await expect(
            page.getByRole("combobox", { name: en.workspace.choose }),
          ).toBeVisible();
          await page.goto("/en/app/stock");
          await expect(page.getByRole("heading", { level: 1 })).toHaveText(
            en.shop.stock.title,
          );
          await expect(
            page.getByText(en.shop.stock.totalWeight, { exact: true }),
          ).toBeVisible();
          checks.push("allowed workspace and stock view survive reload");
        } else if (work?.kind === "saathi") {
          await page.goto("/en/app/impact");
          await expect(page.getByRole("heading", { level: 1 })).toHaveText(
            en.impact.saathi.title,
          );
          await expect(
            page.getByText(en.impact.saathi.empty, { exact: true }).or(
              page.getByRole("heading", {
                name: en.impact.saathi.history,
                exact: true,
              }),
            ),
          ).toBeVisible();
          await page.reload();
          await expect(
            page.getByText(en.impact.saathi.empty, { exact: true }).or(
              page.getByRole("heading", {
                name: en.impact.saathi.history,
                exact: true,
              }),
            ),
          ).toBeVisible();
          checks.push("Saathi impact resolves and survives reload");
        } else {
          await expect(
            page.getByText(en.workspace.empty, { exact: true }),
          ).toBeVisible();
          await page.goto("/en/app");
          await expect(page).toHaveURL(/\/join\/status$/);
          checks.push(
            "personal or stakeholder access grants no operator workspace",
          );
        }
        if (role) {
          if (role === "admin") {
            await expect(
              client.query(api.teamInvitations.list, { scope }),
            ).resolves.toBeInstanceOf(Array);
            checks.push(
              "normal phone invitation grants admin team-read permission",
            );
          } else {
            await expect(
              client.query(api.teamInvitations.list, { scope }),
            ).rejects.toThrow();
            checks.push(
              `normal phone invitation grants ${role}; team management denied`,
            );
          }
        }
        await page.goto("/en/account/services");
        await expect(page.getByRole("heading", { level: 1 })).toHaveText(
          en.serviceRecords.title,
        );
        await expect(
          page.getByText(en.serviceRecords.unavailable, { exact: true }),
        ).toBeVisible();
        await expect(
          page.getByText(en.serviceRecords.reported, { exact: true }),
        ).toBeVisible();
        const title = `Local ${persona.key} programme ${String(Date.now())}`;
        const form = page
          .locator("form")
          .filter({ has: page.locator('input[name="coverageCount"]') });
        if (work?.kind === "org" && work.role === "viewer") {
          await expect(form).toHaveCount(0);
          await expect(
            client.mutation(api.services.createProgramme, {
              ...programmeFields,
              title,
              orgId: work.org.id,
              operationKey: `role-viewer-${Date.now().toString()}`,
            }),
          ).rejects.toThrow();
          checks.push(
            "viewer cannot create an organisation programme in UI or backend",
          );
        } else {
          await expect(form).toBeVisible();
          const fields = Object.entries({ title, ...programmeFields });
          for (const [name, value] of fields) {
            await form.locator(`input[name="${name}"]`).fill(String(value));
          }
          await form
            .getByRole("button", { name: en.common.save, exact: true })
            .click();
          await expect(
            page.getByRole("heading", { level: 3, name: title, exact: true }),
          ).toBeVisible();
          await page.reload();
          await expect(
            page.getByRole("heading", { level: 3, name: title, exact: true }),
          ).toBeVisible();
          const board = await client.query(api.services.board, {});
          const record = board.programmes.find((item) => item.title === title);
          expect(record?.quantityGrams).toBe(1001);
          expect(record?.state).toBe("draft");
          checks.push(
            "normal programme form saves exact 1001 grams as a draft and survives reload",
          );
        }
        const forbidden =
          persona.key === "unrelated-owner" ? privateOne : privateTwo;
        const forbiddenTitle =
          persona.key === "unrelated-owner"
            ? "Private household acceptance sentinel"
            : "Private unrelated acceptance sentinel";
        await expect(
          client.query(api.services.programme, { id: forbidden }),
        ).rejects.toThrow("RECORD_ACCESS_DENIED");
        await expect(
          page.getByRole("heading", { name: forbiddenTitle, exact: true }),
        ).toHaveCount(0);
        checks.push(
          "another private programme is denied and absent from the work view",
        );
        expect(errors).toEqual([]);
        checks.push("no uncaught browser error");
        row.status = "passed";
        process.stdout.write(`Local role acceptance passed: ${persona.key}\n`);
      } catch (error) {
        await writeFile(
          path.join(privateDir, `${persona.key}-failure.txt`),
          JSON.stringify({
            error:
              error instanceof Error ? error.message : "Unknown local failure",
            authStatus,
            privateErrors,
            body: await page.locator("body").innerText(),
          }),
          { mode: 0o600 },
        );
        row.status = "failed";
        row.failure =
          "Local browser or authorization assertion failed; no private values were exported.";
        process.stderr.write(`Local role acceptance failed: ${persona.key}\n`);
      } finally {
        await page.close();
        await writeFile(
          reportPath,
          JSON.stringify(
            {
              date: "2026-10-28",
              environment: "isolated loopback synthetic backend",
              authentication:
                "real Better Auth phone send/verify and private local delivery",
              productionAcceptance: false,
              providerExecution: false,
              externalBrowserRequestsBlocked: external.blockedRequests,
              total: personas.length,
              passed: results.filter((item) => item.status === "passed").length,
              results,
            },
            null,
            2,
          ) + "\n",
        );
      }
    }
  } finally {
    await Promise.all(actors.values().map(({ context }) => context.close()));
  }
  if (
    results.length !== personas.length ||
    results.some(({ status }) => status !== "passed")
  )
    throw new Error(
      "Some local persona assertions failed. See the non-sensitive role report.",
    );
});
