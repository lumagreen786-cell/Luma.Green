import { readFileSync } from "node:fs";

import { expect, type Page, test } from "@playwright/test";
import { ConvexHttpClient } from "convex/browser";
import { z } from "zod";

import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import ar from "../../messages/ar.json" with { type: "json" };
import en from "../../messages/en.json" with { type: "json" };
const accountSchema = z.object({
  key: z.string(),
  email: z.email(),
  password: z.string(),
});
const credentialSchema = z.object({
  site: z.url(),
  accounts: z.array(accountSchema),
});
const credentials = credentialSchema.parse(
  JSON.parse(
    readFileSync(".convex/local-acceptance/credentials.json", "utf8"),
  ) as unknown,
);
const origin = new URL(credentials.site);
if (
  origin.protocol !== "http:" ||
  !["localhost", "127.0.0.1", "[::1]"].includes(origin.hostname)
)
  throw new Error("Local test only");
async function signIn(page: Page, key: string) {
  const account = credentials.accounts.find((a) => a.key === key);
  if (!account) throw new Error("Missing disposable account");
  const testIp = `192.0.2.${String(credentials.accounts.indexOf(account) + 1)}`;
  // Keep quota isolation on auth transport only. Adding this synthetic header
  // to a cross-origin file fetch changes its CORS preflight, unlike real users.
  await page.route("**/api/auth/**", async (route) => {
    await route.continue({
      headers: { ...route.request().headers(), "X-Forwarded-For": testIp },
    });
  });
  const response = await page.request.post("/api/auth/sign-in/email", {
    headers: { Origin: origin.origin, "X-Forwarded-For": testIp },
    data: { email: account.email, password: account.password },
  });
  expect(response.ok()).toBe(true);
  const tokenResponse = await page.request.get("/api/auth/convex/token", {
    headers: { "X-Forwarded-For": testIp },
  });
  expect(tokenResponse.ok()).toBe(true);
  const { token } = z
    .object({ token: z.string() })
    .parse(await tokenResponse.json());
  return {
    token,
    client: new ConvexHttpClient("http://127.0.0.1:3210", {
      auth: token,
      logger: false,
    }),
  };
}

const testPdf = "%PDF-1.4\n1 0 obj << /Type /Catalog >> endobj\n%%EOF";

async function recordInspection(
  client: ConvexHttpClient,
  label: string,
  buyerOrgId?: Id<"orgs">,
) {
  const lotId = await client.mutation(api.traceability.declareLot, {
    materialCode: "PLASTIC-PET",
    state: "Local test bale",
    grams: 1000,
    streamClass: "main_product",
    handlingClass: "non_hazardous",
  });
  return client.mutation(api.quality.recordInspection, {
    lotId,
    buyerOrgId,
    specificationReference: label,
    specificationVersion: "v1",
    sampleMethod: "Synthetic measured sample",
    results: [{ parameter: "Moisture", unit: "percent", value: "1" }],
    decision: "accepted",
  });
}

test("quality uploads show unavailable and reject file writes without R2", async ({
  browser,
}) => {
  const context = await browser.newContext({ baseURL: origin.origin });
  try {
    const page = await context.newPage();
    const { client } = await signIn(page, "manufacturer");
    const board = await client.query(api.qualityFiles.board, {});
    // eslint-disable-next-line playwright/no-skipped-test -- The next test covers the mutually exclusive R2-configured environment.
    test.skip(board.uploadAvailable, "Requires a keyless local deployment");
    const inspectionId = await recordInspection(
      client,
      `LOCAL-QC-OFF-${String(Date.now())}`,
    );
    await page.goto(`/en/app/quality-documents?inspection=${inspectionId}`);
    await expect(
      page.getByText(en.join.errors.uploadUnavailable, { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByLabel(en.qualityDocuments.file, { exact: true }),
    ).toHaveCount(0);
    await expect(
      client.action(api.qualityFiles.upload, {
        inspectionId,
        shareWithBuyer: false,
        kind: "coa",
        name: "unavailable.pdf",
        contentType: "application/pdf",
        bytes: new TextEncoder().encode(testPdf).buffer,
      }),
    ).rejects.toThrow("STORAGE_UNAVAILABLE");
    const after = await client.query(api.qualityFiles.board, {});
    expect(after.own.some((file) => file.inspectionId === inspectionId)).toBe(
      false,
    );
  } finally {
    await context.close();
  }
});

test("quality upload, separate buyer decision, scoped audit view and revoked download", async ({
  browser,
}) => {
  test.setTimeout(90_000);
  const contexts = await Promise.all(
    Array.from({ length: 4 }, () =>
      browser.newContext({ baseURL: origin.origin }),
    ),
  );
  const [owner, buyer, auditor, outsider] = await Promise.all(
    contexts.map((c) => c.newPage()),
  );
  const errors: string[] = [];
  const downloadStatuses: { service: string; status: number }[] = [];
  auditor.on("response", (response) => {
    const path = new URL(response.url()).pathname;
    let service: string | null = null;
    if (path.startsWith("/quality-files/")) service = "quality-file";
    else if (path === "/api/auth/convex/token") service = "auth-token";
    if (service) downloadStatuses.push({ service, status: response.status() });
  });
  for (const context of contexts) context.setDefaultTimeout(15_000);
  for (const page of [owner, buyer, auditor, outsider])
    page.on("pageerror", (error) => {
      errors.push(error.name);
    });
  const stamp = String(Date.now());
  const label = `LOCAL-QC-${stamp}`;
  const purpose = `LOCAL-AUDIT-${stamp}`;
  const filename = `quality-${stamp}.pdf`;
  const decisionReason = `Synthetic buyer requires resampling ${stamp}`;
  try {
    const seller = await signIn(owner, "manufacturer");
    const sellerBoard = await seller.client.query(api.qualityFiles.board, {});
    // eslint-disable-next-line playwright/no-skipped-test -- A keyless deployment exercises the unavailable test instead of writing bytes.
    test.skip(
      !sellerBoard.uploadAvailable,
      "Requires private R2 on the local test deployment",
    );
    const purchaser = await signIn(buyer, "preprocessor");
    const recipient = await signIn(auditor, "auditor");
    const other = await signIn(outsider, "unrelated-owner");
    const buyerBoard = await purchaser.client.query(api.qualityFiles.board, {});
    const inspectionId = await recordInspection(
      seller.client,
      label,
      buyerBoard.orgId,
    );
    await owner.goto("/en/app/quality-documents");
    await expect(
      owner.getByRole("heading", {
        name: en.qualityDocuments.title,
        exact: true,
      }),
    ).toBeVisible();
    await owner
      .getByRole("combobox", {
        name: en.qualityDocuments.inspection,
        exact: true,
      })
      .click();
    await owner
      .getByRole("option", { name: `${label} · v1`, exact: true })
      .click();
    await owner
      .getByLabel(en.qualityDocuments.file, { exact: true })
      .setInputFiles({
        name: filename,
        mimeType: "application/pdf",
        buffer: Buffer.from(testPdf),
      });
    await owner.getByRole("checkbox").check();
    await owner
      .getByRole("button", { name: en.qualityDocuments.upload, exact: true })
      .click();
    await expect(owner.getByText(filename, { exact: true })).toBeVisible();
    const files = await seller.client.query(api.qualityFiles.board, {});
    const file = files.own.find((f) => f.inspectionId === inspectionId);
    if (!file) throw new Error("Upload not recorded");
    await buyer.goto("/en/app/quality-documents");
    const incoming = buyer.locator("section").filter({
      has: buyer.getByRole("heading", {
        name: en.qualityDocuments.incoming,
        exact: true,
      }),
    });
    const fileRow = incoming
      .locator("div.space-y-4")
      .filter({ hasText: filename });
    await fileRow
      .getByRole("textbox", { name: en.qualityDocuments.note, exact: true })
      .fill(decisionReason);
    await fileRow
      .getByRole("button", { name: en.qualityDocuments.record, exact: true })
      .click();
    const buyerHistory = buyer.locator("section").filter({
      has: buyer.getByRole("heading", {
        name: en.qualityDocuments.decisions,
        exact: true,
      }),
    });
    await expect(
      buyerHistory.getByText(decisionReason, {
        exact: true,
      }),
    ).toBeVisible();
    const account = await recipient.client.query(
      api.stakeholderAccounts.mine,
      {},
    );
    if (account?.status !== "approved")
      throw new Error("Approved auditor fixture required");
    const shareBoard = await seller.client.query(api.auditShares.board, {});
    const recipientOption = shareBoard.recipients.find(
      (row) => row.id === account.id,
    );
    if (!recipientOption) throw new Error("Recipient absent");
    await owner.goto("/en/account/reports");
    await owner
      .getByRole("combobox", { name: en.auditReports.inspection, exact: true })
      .click();
    await owner
      .getByRole("option", { name: `${label} · v1`, exact: true })
      .click();
    await owner
      .getByRole("combobox", { name: en.auditReports.recipient, exact: true })
      .click();
    await owner
      .getByRole("option", { name: recipientOption.name, exact: true })
      .click();
    await owner
      .getByRole("textbox", { name: en.auditReports.purpose, exact: true })
      .fill(purpose);
    await owner
      .getByLabel(en.auditReports.expiry, { exact: true })
      .fill(new Date(Date.now() + 2 * 86_400_000).toISOString().slice(0, 16));
    await owner.getByRole("checkbox", { name: filename, exact: true }).check();
    await owner
      .getByRole("button", { name: en.auditReports.create, exact: true })
      .click();
    const sentReports = owner.locator("section").filter({
      has: owner.getByRole("heading", {
        name: en.auditReports.sent,
        exact: true,
      }),
    });
    await expect(sentReports.getByText(purpose, { exact: true })).toBeVisible();
    const shares = await seller.client.query(api.auditShares.board, {});
    const report = shares.own.find((row) => row.purpose === purpose);
    if (!report) throw new Error("Report absent");
    await auditor.goto("/en/account/reports");
    await auditor
      .getByText(purpose, { exact: true })
      .locator("..")
      .locator("..")
      .getByRole("button", { name: en.auditReports.open, exact: true })
      .click();
    await expect(
      auditor.getByText(decisionReason, { exact: true }),
    ).toBeVisible();
    const download = auditor.waitForEvent("download");
    await auditor
      .getByRole("button", { name: en.qualityDocuments.download, exact: true })
      .click();
    const downloaded = await download;
    expect(downloaded.suggestedFilename()).toBe(filename);
    const path = `http://127.0.0.1:3211/quality-files/${file.id}?report=${report.id}`;
    const denied = await outsider.request.get(path, {
      headers: { Authorization: `Bearer ${other.token}` },
    });
    expect(denied.status()).toBe(404);
    await owner
      .getByText(purpose, { exact: true })
      .locator("..")
      .locator("..")
      .getByRole("button", { name: en.auditReports.revoke, exact: true })
      .click();
    await expect(
      auditor.getByText(en.auditReports.unavailable, { exact: true }),
    ).toBeVisible();
    const revoked = await auditor.request.get(path, {
      headers: { Authorization: `Bearer ${recipient.token}` },
    });
    expect(revoked.status()).toBe(404);
    await owner.goto("/ar/app/quality-documents");
    await expect(owner.locator("html")).toHaveAttribute("dir", "rtl");
    await expect(
      owner.getByRole("heading", {
        name: ar.qualityDocuments.title,
        exact: true,
      }),
    ).toBeVisible();
    expect(errors).toEqual([]);
  } finally {
    await test.info().attach("quality-download-status", {
      body: Buffer.from(JSON.stringify(downloadStatuses)),
      contentType: "application/json",
    });
    const cleanup = await Promise.allSettled(
      contexts.map(async (context) => {
        try {
          await context.request.post("/api/auth/sign-out", {
            headers: { Origin: origin.origin },
            data: {},
            timeout: 5000,
          });
        } finally {
          await context.close();
        }
      }),
    );
    if (cleanup.some((result) => result.status === "rejected"))
      test.info().annotations.push({
        type: "cleanup",
        description:
          "A browser context had already closed before sign-out cleanup.",
      });
  }
});
