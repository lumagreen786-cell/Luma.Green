import { randomUUID } from "node:crypto";

import {
  type Browser,
  type BrowserContext,
  expect,
  type Page,
  test,
} from "@playwright/test";
import { ConvexHttpClient } from "convex/browser";
import { z } from "zod";

import { api } from "../../convex/_generated/api";
import { LOCAL_ACCEPTANCE_PERSONAS } from "../../convex/lib/localAcceptance";
import ar from "../../messages/ar.json" with { type: "json" };
import en from "../../messages/en.json" with { type: "json" };
import { webCompletionTarget as target } from "../../playwright.web-completion.config";
import { readPrivateAcceptanceFile } from "../../scripts/local-acceptance/private-file";
import { localeMeta } from "../../src/i18n/locales";

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
const savedAccount = z.object({ key: z.string(), storageState: storage });
const rosterSchema = z.object({
  site: z.string(),
  accounts: z.array(savedAccount),
});
const rosterText = readPrivateAcceptanceFile(target.rosterPath);
const roster = rosterSchema.parse(JSON.parse(rosterText));
const required = [
  "household",
  "kabadiwala",
  "preprocessor",
  "manufacturer",
  "csr-sponsor",
  "applicant",
  "saathi",
];
if (
  new URL(roster.site).origin !== target.site ||
  required.some((key) => roster.accounts.every((row) => row.key !== key)) ||
  new Set(roster.accounts.map((row) => row.key)).size !== roster.accounts.length
)
  throw new Error(
    "The complete normal-phone local acceptance roster is required.",
  );

const allowedOrigins = new Set([target.site, target.convex, target.convexSite]);
function isAllowedNetwork(value: string) {
  const url = new URL(value);
  if (url.protocol === "ws:") url.protocol = "http:";
  return url.protocol === "http:" && allowedOrigins.has(url.origin);
}
const localFetch: typeof fetch = (input, init) => {
  const address =
    typeof input === "string" || input instanceof URL
      ? String(input)
      : input.url;
  if (!isAllowedNetwork(address))
    throw new Error(
      "An authenticated acceptance API request left the loopback allowlist.",
    );
  return fetch(input, { ...init, redirect: "error" });
};
async function clientFor(context: BrowserContext, key: string) {
  const response = await context.request.get("/api/auth/convex/token", {
    maxRedirects: 0,
  });
  if (!response.ok())
    throw new Error(
      "A normal local phone session requires authentication recovery.",
    );
  const token = z
    .object({ token: z.string().min(1) })
    .parse(await response.json());
  const client = new ConvexHttpClient(target.convex, {
    logger: false,
    fetch: localFetch,
  });
  client.setAuth(token.token);
  const person = await client.query(api.identity.me, {});
  const expected = LOCAL_ACCEPTANCE_PERSONAS.find((row) => row.key === key);
  if (
    !expected ||
    person?.phone !== expected.phone ||
    !person.hasProfile ||
    person.hasPassword
  )
    throw new Error(
      "The normal phone session does not match its reserved local persona.",
    );
  return client;
}
async function actor(browser: Browser, key: string) {
  const saved = roster.accounts.find((row) => row.key === key);
  if (!saved)
    throw new Error("A required private local phone session is missing.");
  const hostname = new URL(target.site).hostname;
  if (
    saved.storageState.origins.some(
      (row) => new URL(row.origin).origin !== target.site,
    ) ||
    saved.storageState.cookies.some(
      (row) => row.domain.replace(/^\./, "") !== hostname,
    )
  )
    throw new Error(
      "Local session storage must belong only to the selected loopback app.",
    );
  const context = await browser.newContext({
    baseURL: target.site,
    storageState: saved.storageState,
    serviceWorkers: "block",
    extraHTTPHeaders: {
      Origin: target.site,
      "X-Forwarded-For": `192.0.2.${String(200 + roster.accounts.indexOf(saved))}`,
    },
  });
  const network = { blocked: 0 };
  await context.route("**/*", async (route) => {
    if (isAllowedNetwork(route.request().url())) await route.continue();
    else {
      network.blocked += 1;
      await route.abort();
    }
  });
  await context.routeWebSocket("**/*", async (socket) => {
    if (isAllowedNetwork(socket.url())) socket.connectToServer();
    else {
      network.blocked += 1;
      await socket.close({ code: 1008, reason: "Loopback acceptance only" });
    }
  });
  context.setDefaultTimeout(20_000);
  context.setDefaultNavigationTimeout(45_000);
  try {
    return { context, client: await clientFor(context, key), network };
  } catch (error) {
    await context.close();
    throw error;
  }
}
async function ownerScope(client: ConvexHttpClient) {
  const scope = await client.query(api.workspace.mine, {});
  if (
    scope?.kind !== "org" ||
    scope.role !== "owner" ||
    scope.org.kind !== "kabadiwala"
  )
    throw new Error(
      "The reserved shop owner must have its real selected workspace.",
    );
  return scope.org;
}
async function shopProjection(client: ConvexHttpClient) {
  const stock = await client.query(api.stock.mine, {});
  const payouts = await client.query(api.shop.payouts, {});
  const trades = await client.query(api.market.trades, {});
  const ids = [
    ...new Set([...trades.buying, ...trades.selling].map((row) => row.id)),
  ].toSorted((left, right) => left.localeCompare(right));
  const payments = [];
  for (const tradeId of ids)
    payments.push({
      tradeId,
      orders: await client.query(api.cashfreePayments.status, { tradeId }),
    });
  return { stock, payouts, trades, payments };
}
async function syntheticPng(page: Page, stamp: string) {
  const base64 = await page.evaluate((value) => {
    const canvas = document.createElement("canvas");
    canvas.width = 640;
    canvas.height = 160;
    const drawing = canvas.getContext("2d");
    if (!drawing) throw new Error("Synthetic PNG canvas unavailable.");
    drawing.fillStyle = "white";
    drawing.fillRect(0, 0, 640, 160);
    drawing.fillStyle = "black";
    drawing.font = "18px sans-serif";
    drawing.fillText("SYNTHETIC ONLY / NOT A REAL RECORD", 16, 35);
    drawing.fillText("Manual source, no confirmed quantity or money.", 16, 70);
    drawing.fillText(value, 16, 110);
    return canvas.toDataURL("image/png").split(",", 2)[1];
  }, stamp);
  if (!base64) throw new Error("Synthetic PNG encoding unavailable.");
  return Uint8Array.from(Buffer.from(base64, "base64")).buffer;
}

test("normal phone owner saves a keyless site-plan preference through UI and reload; another business is denied", async ({
  browser,
}) => {
  const owner = await actor(browser, "kabadiwala");
  const other = await actor(browser, "preprocessor");
  try {
    const org = await ownerScope(owner.client);
    const before = await owner.client.query(api.businessSubscriptions.status, {
      orgId: org.id,
    });
    const plan =
      before.request?.requestState === "selected" &&
      before.request.selectedPlan === "yard"
        ? "trader"
        : "yard";
    const page = await owner.context.newPage();
    await page.goto("/en/app/billing");
    await expect(
      page.getByRole("heading", {
        level: 1,
        name: en.businessSubscriptions.title,
      }),
    ).toBeVisible();
    await expect(
      page.getByText(en.businessSubscriptions.off, { exact: true }),
    ).toBeVisible();
    await page
      .getByRole("combobox", {
        name: en.businessSubscriptions.plan,
        exact: true,
      })
      .click();
    await page
      .getByRole("option", {
        name: en.businessSubscriptions.plans[plan],
        exact: true,
      })
      .click();
    await page
      .getByRole("button", { name: en.businessSubscriptions.save, exact: true })
      .click();
    await expect
      .poll(() =>
        owner.client.query(api.businessSubscriptions.status, { orgId: org.id }),
      )
      .toMatchObject({
        billingAvailable: false,
        entitlement: null,
        request: {
          selectedPlan: plan,
          requestState: "selected",
          version: (before.request?.version ?? 0) + 1,
        },
      });
    await page.reload();
    await expect(
      page.getByRole("combobox", {
        name: en.businessSubscriptions.plan,
        exact: true,
      }),
    ).toHaveText(en.businessSubscriptions.plans[plan]);
    await expect(
      page.getByRole("button", {
        name: en.businessSubscriptions.save,
        exact: true,
      }),
    ).toBeDisabled();
    await expect(
      other.client.query(api.businessSubscriptions.status, { orgId: org.id }),
    ).rejects.toThrow("WORKSPACE_CHANGED");
    expect(owner.network.blocked + other.network.blocked).toBe(0);
  } finally {
    await owner.context.close();
    await other.context.close();
  }
});

test("normal phone owner confirms a manual paper summary through UI and reload without changing source, stock or money", async ({
  browser,
}) => {
  const owner = await actor(browser, "kabadiwala");
  const other = await actor(browser, "preprocessor");
  try {
    const org = await ownerScope(owner.client);
    const before = await shopProjection(owner.client);
    const page = await owner.context.newPage();
    await page.goto("/en/app/papers");
    await expect(
      page.getByRole("heading", { level: 1, name: en.papers.title }),
    ).toBeVisible();
    const stamp = randomUUID(),
      name = `SYNTHETIC-${stamp}.png`;
    const uploaded = await owner.client.action(api.paperDrafts.upload, {
      expectedOrgId: org.id,
      name,
      contentType: "image/png",
      bytes: await syntheticPng(page, stamp),
    });
    const sourceText = `SYNTHETIC ONLY ${stamp}. Private manual source; no verified quantity, money or permission.`;
    await owner.client.mutation(api.paperDrafts.confirm, {
      draftId: uploaded.draftId,
      expectedRevision: uploaded.revision,
      content: { text: sourceText, rows: [] },
      confirmed: true,
    });
    const sourceBefore = await owner.client.query(api.paperDrafts.get, {
      draftId: uploaded.draftId,
    });
    const availability = await owner.client.query(
      api.paperAssist.availability,
      {},
    );
    expect(availability.assisted).toBe(false);
    await page.getByRole("button", { name, exact: true }).click();
    const assistance = page.getByRole("region", {
      name: en.paperAssist.title,
      exact: true,
    });
    await expect(
      assistance.getByText(en.paperAssist.unavailable, { exact: true }),
    ).toBeVisible();
    await expect(
      assistance.getByRole("button", {
        name: en.paperAssist.generate,
        exact: true,
      }),
    ).toHaveCount(0);
    await assistance
      .getByRole("button", { name: en.paperAssist.create, exact: true })
      .click();
    const summary = `SYNTHETIC human summary ${stamp}. Manual text only; no stock or payment instruction.`;
    await assistance
      .getByRole("textbox", { name: en.paperAssist.reviewedText, exact: true })
      .fill(summary);
    await assistance
      .getByRole("button", { name: en.common.save, exact: true })
      .click();
    await expect
      .poll(() =>
        owner.client.query(api.paperAssist.list, { draftId: uploaded.draftId }),
      )
      .toMatchObject([
        {
          reviewedText: summary,
          mode: "summary",
          targetLocale: "en",
          status: "draft",
          attemptStatus: "none",
        },
      ]);
    await assistance
      .getByRole("checkbox", { name: en.paperAssist.review, exact: true })
      .check();
    await assistance
      .getByRole("button", { name: en.paperAssist.confirm, exact: true })
      .click();
    await expect
      .poll(() =>
        owner.client.query(api.paperAssist.list, { draftId: uploaded.draftId }),
      )
      .toMatchObject([
        {
          reviewedText: summary,
          sourceText,
          status: "confirmed",
          attemptStatus: "none",
        },
      ]);
    await page.reload();
    await page.getByRole("button", { name, exact: true }).click();
    await assistance
      .getByRole("button", {
        name: `${en.paperAssist.summary} · ${localeMeta.en.label} · ${en.paperAssist.confirmed}`,
        exact: true,
      })
      .click();
    await expect(
      assistance.getByRole("textbox", {
        name: en.paperAssist.reviewedText,
        exact: true,
      }),
    ).toHaveValue(summary);
    await expect(
      assistance.getByRole("textbox", {
        name: en.paperAssist.reviewedText,
        exact: true,
      }),
    ).toBeDisabled();
    expect(
      await owner.client.query(api.paperDrafts.get, {
        draftId: uploaded.draftId,
      }),
    ).toEqual(sourceBefore);
    expect(await shopProjection(owner.client)).toEqual(before);
    await expect(
      other.client.query(api.paperAssist.list, { draftId: uploaded.draftId }),
    ).rejects.toThrow("PAPER_ASSIST_NOT_FOUND");
    expect(owner.network.blocked + other.network.blocked).toBe(0);
  } finally {
    await owner.context.close();
    await other.context.close();
  }
});

test("normal phone CSR recipient acknowledges and replies in the actual RTL service UI; requester reload and revoked access agree with server", async ({
  browser,
}) => {
  const owner = await actor(browser, "kabadiwala");
  const recipient = await actor(browser, "csr-sponsor");
  const other = await actor(browser, "preprocessor");
  try {
    const org = await ownerScope(owner.client);
    const before = await shopProjection(owner.client);
    const board = await owner.client.query(api.services.board, {});
    const expected = LOCAL_ACCEPTANCE_PERSONAS.find(
      (row) => row.key === "csr-sponsor",
    );
    const selected = board.recipients.find(
      (row) => row.name === expected?.name,
    );
    if (!selected)
      throw new Error(
        "The seeded CSR sponsor is not an available authorized service recipient.",
      );
    const title = `Synthetic connected service ${randomUUID()}`;
    const id = await owner.client.mutation(api.services.createEnquiry, {
      operationKey: randomUUID(),
      orgId: org.id,
      recipientId: selected.id,
      kind: "donation",
      commercialModel: "partner_service",
      principalParty: "",
      shareMaterialLotReference: false,
      title,
      details:
        "Synthetic private conversation only. No real service, payment or regulated approval.",
      submit: true,
    });
    await expect(
      other.client.query(api.services.enquiry, { id }),
    ).rejects.toThrow("RECORD_ACCESS_DENIED");
    const ownerPage = await owner.context.newPage(),
      receiverPage = await recipient.context.newPage();
    await ownerPage.goto("/en/app/services");
    // Stakeholders keep their existing account route; no invented business role.
    await receiverPage.goto("/ar/account/services");
    const received = receiverPage.getByRole("article").filter({
      has: receiverPage.getByRole("heading", { name: title, exact: true }),
    });
    await received
      .getByRole("button", {
        name: ar.serviceRecords.workflow.acknowledge,
        exact: true,
      })
      .click();
    await expect
      .poll(() => owner.client.query(api.services.enquiry, { id }))
      .toMatchObject({ state: "acknowledged" });
    const reply = "ردّ اصطناعي للاختبار فقط، لا يثبت تقديم خدمة أو دفعًا.";
    await received
      .getByRole("textbox", {
        name: ar.serviceRecords.workflow.message,
        exact: true,
      })
      .fill(reply);
    await received
      .getByRole("button", {
        name: ar.serviceRecords.workflow.respond,
        exact: true,
      })
      .click();
    await expect
      .poll(() => owner.client.query(api.services.enquiry, { id }))
      .toMatchObject({
        state: "responded",
        history: expect.arrayContaining([
          expect.objectContaining({
            action: "acknowledge",
            party: "recipient",
          }),
          expect.objectContaining({
            action: "respond",
            party: "recipient",
            message: reply,
          }),
        ]),
      });
    await ownerPage.reload();
    const owned = ownerPage.getByRole("article").filter({
      has: ownerPage.getByRole("heading", { name: title, exact: true }),
    });
    await expect(owned.getByText(reply, { exact: true })).toBeVisible();
    await owned
      .getByRole("button", { name: en.serviceRecords.revoke, exact: true })
      .click();
    await expect
      .poll(async () => {
        const saved = await owner.client.query(api.services.enquiry, { id });
        return saved.recipientId ?? null;
      })
      .toBeNull();
    const revoked = await owner.client.query(api.services.enquiry, { id });
    await expect(
      recipient.client.query(api.services.enquiry, { id }),
    ).rejects.toThrow("RECORD_ACCESS_DENIED");
    await expect(
      recipient.client.mutation(api.services.actOnEnquiry, {
        id,
        version: revoked.version,
        operationKey: randomUUID(),
        action: "respond",
        message: "Synthetic revoked attempt must not save.",
      }),
    ).rejects.toThrow("RECORD_ACCESS_DENIED");
    await receiverPage.reload();
    await expect(
      receiverPage.getByRole("heading", { name: title, exact: true }),
    ).toHaveCount(0);
    const after = await owner.client.query(api.services.enquiry, { id });
    expect(after.history).toEqual(revoked.history);
    expect(await shopProjection(owner.client)).toEqual(before);
    expect(
      owner.network.blocked + recipient.network.blocked + other.network.blocked,
    ).toBe(0);
  } finally {
    await owner.context.close();
    await recipient.context.close();
    await other.context.close();
  }
});
