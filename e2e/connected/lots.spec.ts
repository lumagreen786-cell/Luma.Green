import { readFileSync } from "node:fs";

import { expect, type Page, test } from "@playwright/test";
import { z } from "zod";

import en from "../../messages/en.json" with { type: "json" };

const accountSchema = z.object({
  key: z.string(),
  name: z.string(),
  email: z.email(),
  password: z.string(),
});
const credentialsSchema = z.object({
  site: z.url(),
  accounts: z.array(accountSchema),
});
const credentialsSource: unknown = JSON.parse(
  readFileSync(".convex/local-acceptance/credentials.json", "utf8"),
);
const credentials = credentialsSchema.parse(credentialsSource);
const site = new URL(credentials.site);
if (
  site.protocol !== "http:" ||
  !["localhost", "127.0.0.1", "[::1]"].includes(site.hostname)
)
  throw new Error("Lot acceptance requires a local test origin.");
const t = en.lots;
const costs = en.recordedCosts;
test.setTimeout(90_000);
async function signIn(page: Page, key: string) {
  const account = credentials.accounts.find((row) => row.key === key);
  if (!account) throw new Error(`Missing local acceptance account: ${key}`);
  await page.context().setExtraHTTPHeaders({
    "X-Forwarded-For": `192.0.2.${String(credentials.accounts.indexOf(account) + 1)}`,
  });
  const response = await page.request.post(
    `${site.origin}/api/auth/sign-in/email`,
    {
      headers: {
        Origin: site.origin,
        "X-Forwarded-For": `192.0.2.${String(credentials.accounts.indexOf(account) + 1)}`,
      },
      data: { email: account.email, password: account.password },
    },
  );
  expect(
    response.ok(),
    `Local sign-in for ${key}: HTTP ${String(response.status())}`,
  ).toBe(true);
  await page.goto("/en/app/lots");
  await expect(
    page.getByRole("heading", { level: 1, name: t.title }),
  ).toBeVisible();
}
async function openForm(page: Page, name: string) {
  await page.getByRole("button", { name, exact: true }).click();
  return page.getByRole("dialog", { name, exact: true });
}

test("measured lot processing, immutable correction, whole-lot hand-off and role boundaries", async ({
  browser,
}) => {
  const ownerContext = await browser.newContext({ baseURL: site.origin });
  const memberContext = await browser.newContext({ baseURL: site.origin });
  const viewerContext = await browser.newContext({ baseURL: site.origin });
  const receiverContext = await browser.newContext({ baseURL: site.origin });
  const owner = await ownerContext.newPage();
  const member = await memberContext.newPage();
  const viewer = await viewerContext.newPage();
  const receiver = await receiverContext.newPage();
  try {
    await signIn(owner, "kabadiwala");
    await signIn(member, "team-member");
    await signIn(viewer, "team-viewer");
    await signIn(receiver, "preprocessor");
    await expect(viewer.getByRole("button", { name: t.declare })).toHaveCount(
      0,
    );
    const material = `Acceptance PET ${String(Date.now())}`;
    const declaration = await openForm(owner, t.declare);
    await declaration.getByLabel(t.material, { exact: true }).fill(material);
    await declaration
      .getByLabel(t.state, { exact: true })
      .fill("Measured bale");
    await declaration.getByLabel(t.mass, { exact: true }).fill("1000.5");
    await declaration
      .getByRole("button", { name: t.save, exact: true })
      .click();
    await expect(declaration.getByRole("alert")).toHaveText(t.invalidInput);
    await declaration.getByLabel(t.mass, { exact: true }).fill("10000");
    await declaration
      .getByLabel(costs.acquisition, { exact: true })
      .fill("10001");
    await declaration
      .getByLabel(costs.reference, { exact: true })
      .fill("Synthetic recorded intake cost");
    await declaration
      .getByRole("button", { name: t.save, exact: true })
      .click();
    await expect(owner).toHaveURL(/\/app\/lots\/.+$/);
    const lotUrl = new URL(owner.url()).pathname;
    await expect(
      owner.getByRole("heading", { level: 1, name: t.detail }),
    ).toBeVisible();

    const transformation = await openForm(owner, t.transform);
    await transformation.getByLabel(t.inputMass, { exact: true }).fill("8000");
    await transformation
      .getByLabel(t.contamination, { exact: true })
      .fill("500");
    await transformation.getByLabel(t.processLoss, { exact: true }).fill("500");
    await transformation
      .getByLabel(costs.processing, { exact: true })
      .fill("401");
    await transformation
      .getByLabel(costs.reference, { exact: true })
      .fill("Synthetic recorded process cost");
    await transformation
      .getByLabel(t.material, { exact: true })
      .fill(`${material} flakes`);
    await transformation
      .getByLabel(t.state, { exact: true })
      .fill("Measured flake");
    await transformation.getByLabel(t.mass, { exact: true }).fill("6999");
    await transformation
      .getByRole("button", { name: t.save, exact: true })
      .click();
    await expect(transformation.getByRole("alert")).toHaveText(t.balanceError);
    await transformation.getByLabel(t.mass, { exact: true }).fill("7000");
    await transformation
      .getByRole("button", { name: t.save, exact: true })
      .click();
    await expect(transformation).toHaveCount(0);
    await expect(
      owner.getByText(costs.remaining, { exact: true }),
    ).toBeVisible();
    await expect(owner.getByText("₹20.01", { exact: true })).toBeVisible();
    await expect(owner.getByText(costs.total, { exact: true })).toBeVisible();
    await expect(owner.getByText("₹84.01", { exact: true })).toBeVisible();
    await expect(
      owner.getByRole("link", { name: `${material} flakes · Measured flake` }),
    ).toBeVisible();

    const inspection = await openForm(owner, t.inspection);
    await inspection
      .getByLabel(t.specification, { exact: true })
      .fill("Acceptance measured specification");
    await inspection.getByLabel(t.version, { exact: true }).fill("1");
    await inspection
      .getByLabel(t.sampleMethod, { exact: true })
      .fill("Recorded composite sample");
    await inspection.getByLabel(t.parameter, { exact: true }).fill("Moisture");
    await inspection.getByLabel(t.unit, { exact: true }).fill("%");
    await inspection.getByLabel(t.value, { exact: true }).fill("2");
    await inspection
      .getByRole("combobox", { name: t.decision, exact: true })
      .click();
    await owner
      .getByRole("option", { name: t.conditional, exact: true })
      .click();
    await inspection.getByRole("button", { name: t.save, exact: true }).click();
    await expect(inspection).toHaveCount(0);
    await member.goto(lotUrl);
    const correction = await openForm(member, t.correct);
    await expect(
      correction.getByLabel(t.specification, { exact: true }),
    ).toHaveAttribute("readonly", "");
    await correction.getByLabel(t.value, { exact: true }).fill("3");
    await correction
      .getByLabel(t.reason, { exact: true })
      .fill("Corrected test measurement");
    await correction.getByRole("button", { name: t.save, exact: true }).click();
    await expect(correction).toHaveCount(0);
    await expect(
      member.getByText(t.pendingApproval, { exact: true }),
    ).toBeVisible();
    await expect(member.getByRole("button", { name: t.approve })).toHaveCount(
      0,
    );
    await owner.getByRole("button", { name: t.approve, exact: true }).click();
    await expect(owner.getByText(t.approved, { exact: true })).toBeVisible();
    await expect(owner.getByText(t.superseded, { exact: true })).toBeVisible();
    await viewer.goto(lotUrl);
    await expect(
      viewer.getByRole("heading", { name: t.inspections, exact: true }),
    ).toBeVisible();
    await expect(viewer.getByRole("button", { name: t.transform })).toHaveCount(
      0,
    );
    await expect(viewer.getByRole("button", { name: t.correct })).toHaveCount(
      0,
    );

    const dispatch = await openForm(owner, t.dispatch);
    await dispatch
      .getByRole("button", { name: t.searchBusinesses, exact: true })
      .click();
    await dispatch
      .getByRole("combobox", { name: t.chooseBusiness, exact: true })
      .click();
    await owner
      .getByRole("option", { name: /Local test preprocessor owner/ })
      .click();
    await dispatch.getByRole("button", { name: t.save, exact: true }).click();
    await expect(dispatch).toHaveCount(0);
    await receiver
      .getByRole("region", { name: t.incoming, exact: true })
      .getByRole("link", { name: `${material} · Measured bale`, exact: true })
      .click();
    await expect(
      receiver.getByText(t.pendingNote, { exact: true }),
    ).toBeVisible();
    await expect(
      receiver.getByRole("heading", { name: t.inspections }),
    ).toHaveCount(0);
    const receipt = await openForm(receiver, t.receive);
    await receipt.getByLabel(t.receivedMass, { exact: true }).fill("1999");
    await receipt.getByRole("button", { name: t.save, exact: true }).click();
    await expect(receipt.getByRole("alert")).toHaveText(t.weightDispute);
    await receipt.getByLabel(t.receivedMass, { exact: true }).fill("2000");
    await receipt.getByRole("button", { name: t.save, exact: true }).click();
    await expect(receipt).toHaveCount(0);
    await expect(
      receiver.getByRole("heading", { name: t.inspections, exact: true }),
    ).toBeVisible();
    await expect(receiver.getByRole("button", { name: t.correct })).toHaveCount(
      0,
    );
    await expect(
      owner.getByRole("alert").filter({ hasText: t.accessChanged }),
    ).toBeVisible();
    await owner.getByRole("link", { name: t.back, exact: true }).click();
    const sent = owner
      .getByRole("region", { name: t.sent, exact: true })
      .getByRole("listitem")
      .filter({ hasText: material });
    await expect(sent).toHaveCount(2);
  } finally {
    await ownerContext.close();
    await memberContext.close();
    await viewerContext.close();
    await receiverContext.close();
  }
});
