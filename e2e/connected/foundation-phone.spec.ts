import { readFileSync } from "node:fs";

import {
  type Browser,
  expect,
  type Locator,
  type Page,
  test,
} from "@playwright/test";
import { z } from "zod";

import { isLoopbackHttpOrigin } from "../../convex/lib/localAcceptance";
import en from "../../messages/en.json" with { type: "json" };

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
const storageEntry = z.object({ name: z.string(), value: z.string() });
const origin = z.object({
  origin: z.string(),
  localStorage: z.array(storageEntry),
});
const storage = z.object({
  cookies: z.array(cookie),
  origins: z.array(origin),
});
const account = z.object({ key: z.string(), storageState: storage });
const artifact = z
  .object({
    site: z.string().refine(isLoopbackHttpOrigin),
    accounts: z.array(account),
  })
  .parse(
    JSON.parse(
      readFileSync(".convex/local-acceptance/phone-sessions.json", "utf8"),
    ),
  );
async function actor(browser: Browser, key: string) {
  const saved = artifact.accounts.find((entry) => entry.key === key);
  if (!saved)
    throw new Error("A required private local phone session is missing.");
  const context = await browser.newContext({
    baseURL: artifact.site,
    storageState: saved.storageState,
    extraHTTPHeaders: {
      "X-Forwarded-For": `192.0.2.${String(160 + artifact.accounts.indexOf(saved))}`,
    },
  });
  context.setDefaultTimeout(20_000);
  context.setDefaultNavigationTimeout(30_000);
  return context;
}
async function dialog(page: Page, name: string) {
  await page.getByRole("button", { name, exact: true }).click();
  return page.getByRole("dialog", { name, exact: true });
}
async function choose(
  page: Page,
  scope: Locator,
  label: string,
  option: string,
) {
  await scope.getByRole("combobox", { name: label, exact: true }).click();
  await page.getByRole("option", { name: option, exact: true }).click();
}

test("real phone session records exact lot costs while another business cannot read them", async ({
  browser,
}) => {
  const shop = await actor(browser, "kabadiwala"),
    yard = await actor(browser, "preprocessor");
  try {
    const owner = await shop.newPage(),
      other = await yard.newPage();
    await owner.goto("/app/lots");
    await expect(
      owner.getByRole("heading", { level: 1, name: en.lots.title }),
    ).toBeVisible();
    const material = `LOCAL-COST-${String(Date.now())}`;
    const form = await dialog(owner, en.lots.declare);
    await form.getByLabel(en.lots.material, { exact: true }).fill(material);
    await form
      .getByLabel(en.lots.state, { exact: true })
      .fill("Measured intake");
    await form.getByLabel(en.lots.mass, { exact: true }).fill("9");
    await form
      .getByLabel(en.recordedCosts.acquisition, { exact: true })
      .fill("10");
    await form
      .getByLabel(en.recordedCosts.reference, { exact: true })
      .fill("Synthetic private browser acquisition record");
    await form.getByRole("button", { name: en.lots.save, exact: true }).click();
    await expect(owner).toHaveURL(/\/app\/lots\/[^/]+$/);
    const privatePath = new URL(owner.url()).pathname;
    await expect(owner.getByText("₹0.10", { exact: true })).toBeVisible();
    const process = await dialog(owner, en.lots.transform);
    await process.getByLabel(en.lots.inputMass, { exact: true }).fill("4");
    await process.getByLabel(en.lots.contamination, { exact: true }).fill("1");
    await process
      .getByLabel(en.recordedCosts.processing, { exact: true })
      .fill("3");
    await process
      .getByLabel(en.recordedCosts.reference, { exact: true })
      .fill("Synthetic private browser process record");
    const first = process.getByRole("group", { name: "Output 1", exact: true });
    await first
      .getByLabel(en.lots.material, { exact: true })
      .fill(`${material}-A`);
    await first
      .getByLabel(en.lots.state, { exact: true })
      .fill("Measured output A");
    await first.getByLabel(en.lots.mass, { exact: true }).fill("2");
    await process
      .getByRole("button", { name: en.lots.addOutput, exact: true })
      .click();
    const second = process.getByRole("group", {
      name: "Output 2",
      exact: true,
    });
    await second
      .getByLabel(en.lots.material, { exact: true })
      .fill(`${material}-B`);
    await second
      .getByLabel(en.lots.state, { exact: true })
      .fill("Measured output B");
    await second.getByLabel(en.lots.mass, { exact: true }).fill("1");
    await process
      .getByRole("button", { name: en.lots.save, exact: true })
      .click();
    await expect(process).toHaveCount(0);
    await expect(owner.getByText("₹0.06", { exact: true })).toBeVisible();
    await expect(owner.getByText("₹0.07", { exact: true })).toBeVisible();
    await other.goto(privatePath);
    await expect(
      other.getByRole("alert").filter({ hasText: en.lots.accessChanged }),
    ).toHaveText(en.lots.accessChanged);
    await expect(
      other.getByText("Synthetic private browser acquisition record", {
        exact: true,
      }),
    ).toHaveCount(0);
    await owner
      .getByRole("link", {
        name: `${material}-A · Measured output A`,
        exact: true,
      })
      .click();
    await expect(owner.getByText("₹0.05", { exact: true })).toBeVisible();
  } finally {
    await shop.close();
    await yard.close();
  }
});

test("real personal phone session keeps a draft private and revokes a submitted service recipient", async ({
  browser,
}) => {
  const requester = await actor(browser, "applicant"),
    recipient = await actor(browser, "csr-sponsor");
  try {
    const owner = await requester.newPage(),
      reader = await recipient.newPage();
    await owner.goto("/account/services");
    await expect(
      owner.getByRole("heading", { level: 1, name: en.serviceRecords.title }),
    ).toBeVisible();
    const title = `Synthetic browser enquiry ${String(Date.now())}`;
    const section = owner
      .getByRole("heading", { name: en.serviceRecords.enquiries, exact: true })
      .locator("..");
    const form = section.locator("form");
    await choose(
      owner,
      form,
      en.auditReports.recipient,
      "Local test CSR sponsor",
    );
    await form
      .getByLabel(en.serviceRecords.recordName, { exact: true })
      .fill(title);
    await form
      .getByLabel(en.help.contact.message, { exact: true })
      .fill(
        "Synthetic local service details. No real personal or provider data.",
      );
    await form
      .getByRole("button", { name: en.common.save, exact: true })
      .click();
    await expect(
      owner.getByRole("heading", { name: title, exact: true }),
    ).toBeVisible();
    await reader.goto("/account/services");
    await expect(
      reader.getByRole("heading", { level: 1, name: en.serviceRecords.title }),
    ).toBeVisible();
    await expect(
      reader.getByRole("heading", { name: title, exact: true }),
    ).toHaveCount(0);
    const row = owner.getByRole("article").filter({
      has: owner.getByRole("heading", { name: title, exact: true }),
    });
    await row
      .getByRole("button", { name: en.serviceRecords.edit, exact: true })
      .click();
    await form
      .getByRole("button", { name: en.help.contact.submit, exact: true })
      .click();
    await reader.reload();
    await expect(
      reader.getByRole("heading", { name: title, exact: true }),
    ).toBeVisible();
    await expect(
      reader.getByText(en.serviceRecords.unavailable, { exact: true }),
    ).toBeVisible();
    await row
      .getByRole("button", { name: en.serviceRecords.revoke, exact: true })
      .click();
    await reader.reload();
    await expect(
      reader.getByRole("heading", { name: title, exact: true }),
    ).toHaveCount(0);
  } finally {
    await requester.close();
    await recipient.close();
  }
});

test("real manufacturer phone session records an empty stock closing and shows no fabricated return source", async ({
  browser,
}) => {
  const context = await actor(browser, "manufacturer");
  try {
    const page = await context.newPage();

    await test.step("Open the manufacturer stock page", async () => {
      await page.goto("/app/stock", { timeout: 30_000 });
    });

    const closing = page
      .locator("details")
      .filter({
        has: page.locator("summary", { hasText: en.stockClosing.title }),
      })
      .first();
    await closing.locator("summary").first().click();
    await expect(
      closing.getByText(en.stockClosing.notice, { exact: true }),
    ).toBeVisible();
    const save = closing.getByRole("button", {
      name: en.stockClosing.record,
      exact: true,
    });
    // eslint-disable-next-line playwright/no-conditional-in-test -- A same-day rerun reads the existing immutable closing instead of creating another.
    if ((await save.count()) > 0) {
      await closing
        .getByLabel(en.stockClosing.note, { exact: true })
        .fill(
          "Synthetic local browser closing; no inventory or prices seeded.",
        );
      await save.click();
    }
    await expect(
      closing.getByText(en.stockClosing.last, { exact: false }),
    ).toBeVisible();
    await page.goto("/app/returns");
    await expect(
      page.getByRole("heading", { level: 1, name: en.returnClaims.title }),
    ).toBeVisible();
    await expect(
      page.getByText(en.returnClaims.notice, { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", {
        name: en.returnClaims.reconcile,
        exact: true,
      }),
    ).toHaveCount(0);
  } finally {
    if (context.pages().length > 0) await context.close();
  }
});

test("real business phone session shares only reported programme aggregates and revokes the recipient", async ({
  browser,
}) => {
  const creator = await actor(browser, "kabadiwala"),
    recipient = await actor(browser, "csr-sponsor");
  try {
    const owner = await creator.newPage(),
      reader = await recipient.newPage();
    await owner.goto("/app/services");
    await expect(
      owner.getByRole("heading", { level: 1, name: en.serviceRecords.title }),
    ).toBeVisible();
    const unique = String(Date.now()),
      title = `Synthetic programme ${unique}`,
      area = `Synthetic area ${unique}`;
    const section = owner
      .getByRole("heading", { name: en.serviceRecords.programmes, exact: true })
      .locator("..");
    const form = section.locator("form").first();
    await form
      .getByLabel(en.serviceRecords.recordName, { exact: true })
      .fill(title);
    await form.getByLabel(en.serviceRecords.area, { exact: true }).fill(area);
    await form
      .getByLabel(en.prices.columns.material, { exact: true })
      .fill("Dry recyclables");
    const today = new Date().toISOString().slice(0, 10);
    const expiry = new Date(Date.now() + 172_800_000)
      .toISOString()
      .slice(0, 10);
    await form
      .getByLabel(en.serviceRecords.startsOn, { exact: true })
      .fill(today);
    await form
      .getByLabel(en.serviceRecords.endsOn, { exact: true })
      .fill(expiry);
    for (const [key, value] of [
      ["coverageCount", "2"],
      ["trips", "1"],
      ["centreHandovers", "1"],
      ["quantityGrams", "1001"],
      ["groupIncomePaise", "1"],
    ] as const)
      await form
        .getByLabel(en.serviceRecords[key], { exact: true })
        .fill(value);
    const evidence = `Synthetic private source evidence ${unique}`;
    await form
      .getByLabel(en.lots.evidenceReference, { exact: true })
      .fill(evidence);
    await form
      .getByRole("button", { name: en.common.save, exact: true })
      .click();
    const row = owner.getByRole("article").filter({
      has: owner.getByRole("heading", { name: title, exact: true }),
    });
    await expect(row).toBeVisible();
    const share = row.locator("form");
    await choose(
      owner,
      share,
      en.auditReports.recipient,
      "Local test CSR sponsor",
    );
    await share
      .getByLabel(en.auditReports.purpose, { exact: true })
      .fill("Synthetic aggregate-only browser check");
    await share
      .getByLabel(en.serviceRecords.endsOn, { exact: true })
      .fill(expiry);
    await share
      .getByRole("button", { name: en.serviceRecords.share, exact: true })
      .click();
    await reader.goto("/account/services");
    const sharedHeading = `${area} · Dry recyclables`;
    const report = reader.getByRole("article").filter({
      has: reader.getByRole("heading", { name: sharedHeading, exact: true }),
    });
    await expect(report).toBeVisible();
    await expect(report.getByText("1,001", { exact: true })).toBeVisible();
    await expect(reader.getByText(evidence, { exact: true })).toHaveCount(0);
    const ownerReport = owner.getByRole("article").filter({
      has: owner.getByRole("heading", { name: sharedHeading, exact: true }),
    });
    await ownerReport
      .getByRole("button", { name: en.serviceRecords.revoke, exact: true })
      .click();
    await reader.reload();
    await expect(
      reader.getByRole("heading", { name: sharedHeading, exact: true }),
    ).toHaveCount(0);
  } finally {
    await creator.close();
    await recipient.close();
  }
});

// The separate disconnected suite proves the no-backend unavailable state.
// This configured app must reject anonymous access before rendering review data.
test("configured account-removal review queue requires admin sign-in", async ({
  browser,
}) => {
  const context = await browser.newContext({ baseURL: artifact.site });
  try {
    const page = await context.newPage();
    await page.goto("/admin/account-removals");
    await expect(page).toHaveURL((url) => url.pathname === "/admin/login");
    await expect(
      page.getByRole("heading", { name: "Account access and evidence review" }),
    ).toHaveCount(0);
  } finally {
    await context.close();
  }
});
