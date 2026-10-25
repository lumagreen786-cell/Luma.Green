import { readFileSync } from "node:fs";

import { expect, type Locator, type Page, test } from "@playwright/test";
import { z } from "zod";

import ar from "../../messages/ar.json" with { type: "json" };
import en from "../../messages/en.json" with { type: "json" };
const credentialSource: unknown = JSON.parse(
  readFileSync(".convex/local-acceptance/credentials.json", "utf8"),
);
const accountSchema = z.object({
  key: z.string(),
  email: z.email(),
  password: z.string(),
});
const credentials = z
  .object({
    site: z.url(),
    accounts: z.array(accountSchema),
  })
  .parse(credentialSource);
const site = new URL(credentials.site);
if (
  site.protocol !== "http:" ||
  !["localhost", "127.0.0.1", "[::1]"].includes(site.hostname)
)
  throw new Error("Local acceptance only");
const t = en.sourcing;
async function login(page: Page, key: string) {
  const account = credentials.accounts.find((a) => a.key === key);
  if (!account) throw new Error("Missing local account");
  const headers = {
    "X-Forwarded-For": `192.0.2.${String(credentials.accounts.indexOf(account) + 1)}`,
  };
  await page.context().setExtraHTTPHeaders(headers);
  const response = await page.request.post(
    `${site.origin}/api/auth/sign-in/email`,
    {
      headers: { ...headers, Origin: site.origin },
      data: { email: account.email, password: account.password },
    },
  );
  expect(response.ok()).toBe(true);
  await page.goto("/en/app/sourcing");
  await expect(
    page.getByRole("heading", { level: 1, name: t.title }),
  ).toBeVisible();
}
async function choose(
  page: Page,
  scope: Locator,
  label: string,
  value: string,
) {
  await scope.getByRole("combobox", { name: label, exact: true }).click();
  await page.getByRole("option", { name: value, exact: true }).click();
}
async function form(page: Page, title: string) {
  await page.getByRole("button", { name: title, exact: true }).click();
  const dialog = page.getByRole("dialog", { name: title, exact: true });
  await expect(dialog).toBeVisible();
  return dialog;
}
async function save(dialog: Locator) {
  await dialog.getByRole("button", { name: t.save, exact: true }).click();
  await expect(dialog).toHaveCount(0);
}
function dateAfter(days: number) {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}
async function reference(
  page: Page,
  scope: Locator,
  title: string,
  value: string,
) {
  await scope.getByRole("button", { name: title, exact: true }).click();
  const dialog = page.getByRole("dialog", { name: title, exact: true });
  await dialog.getByLabel(t.responseReference).fill(value);
  await save(dialog);
}

async function focusByKeyboard(
  page: Page,
  dialog: Locator,
  saveButton: Locator,
) {
  const count = await dialog.locator('button,input,[role="combobox"]').count();
  for (let i = 0; i < count + 5; i++) {
    if (await saveButton.evaluate((el) => el === document.activeElement)) break;
    await page.keyboard.press("Tab");
  }
}

test("buyer sourcing decisions, supplier acknowledgements, releases and recurring demand", async ({
  browser,
}) => {
  const contexts = await Promise.all(
    [0, 1, 2].map(() => browser.newContext({ baseURL: site.origin })),
  );
  const [buyer, supplier, viewer] = await Promise.all(
    contexts.map((c) => c.newPage()),
  );
  const stamp = String(Date.now());
  const spec = `Local sourcing specification ${stamp}`;
  const ref = `LOCAL-AGR-${stamp}`;
  const releaseRef = `LOCAL-REL-${stamp}`;
  const startsOn = dateAfter(1);
  const endsOn = dateAfter(20);
  const errors: string[] = [];
  for (const page of [buyer, supplier, viewer]) {
    page.on("pageerror", (error) => {
      errors.push(error.name);
    });
    await page.route("**/*", async (route) => {
      const host = new URL(route.request().url()).hostname;
      if (["localhost", "127.0.0.1"].includes(host)) await route.continue();
      else await route.abort();
    });
  }
  try {
    await login(buyer, "preprocessor");
    await login(supplier, "kabadiwala");
    await login(viewer, "team-viewer");
    await buyer
      .getByRole("tab", { name: t.qualifications, exact: true })
      .click();
    let dialog = await form(buyer, t.qualify);
    await choose(buyer, dialog, t.material, "Newspaper");
    await choose(buyer, dialog, t.supplier, "Local test kabadiwala owner");
    await dialog.getByLabel(t.specification).fill(spec);
    await dialog.getByLabel(t.sample).fill(`LOCAL-SAMPLE-${stamp}`);
    await choose(buyer, dialog, t.decision, t.approved);
    await dialog.getByLabel(t.validUntil).fill(dateAfter(30));
    await dialog
      .getByLabel(t.reason)
      .fill("Synthetic buyer decision; no regulatory approval");
    await buyer.keyboard.press("Escape");
    dialog = await form(buyer, t.qualify);
    await expect(
      dialog.getByRole("combobox", { name: t.decision, exact: true }),
    ).toContainText(t.approved);
    await save(dialog);
    await expect(buyer.getByText(spec, { exact: true })).toBeVisible();
    await buyer.getByRole("tab", { name: t.agreements, exact: true }).click();
    dialog = await form(buyer, t.propose);
    await choose(buyer, dialog, t.material, "Newspaper");
    await choose(buyer, dialog, t.supplier, "Local test kabadiwala owner");
    await dialog.getByLabel(t.specification).fill(spec);
    await dialog.getByLabel(t.quantity, { exact: true }).fill("10000");
    await dialog.getByLabel(t.reference, { exact: true }).fill(ref);
    await dialog.getByLabel(t.price).fill("1250");
    await dialog.getByLabel(t.startsOn).fill(startsOn);
    await dialog.getByLabel(t.endsOn).fill(endsOn);
    await save(dialog);
    const buyerRow = buyer
      .getByRole("listitem")
      .filter({ hasText: ref })
      .first();
    await expect(
      buyerRow.getByText(`${startsOn} – ${endsOn} · ${t.requested}`, {
        exact: true,
      }),
    ).toBeVisible();
    await expect(
      buyerRow.getByRole("button", { name: t.release, exact: true }),
    ).toHaveCount(0);
    await supplier
      .getByRole("tab", { name: t.agreements, exact: true })
      .click();
    await supplier.getByRole("tab", { name: t.supplying, exact: true }).click();
    const supplierRow = supplier
      .getByRole("listitem")
      .filter({ hasText: ref })
      .first();
    await reference(supplier, supplierRow, t.acknowledge, `LOCAL-ACK-${stamp}`);
    await expect(
      buyerRow.getByText(`${startsOn} – ${endsOn} · ${t.acknowledged}`, {
        exact: true,
      }),
    ).toBeVisible();
    await buyerRow
      .getByRole("button", { name: t.release, exact: true })
      .click();
    dialog = buyer.getByRole("dialog", { name: t.release, exact: true });
    await dialog.getByLabel(t.reference, { exact: true }).fill(releaseRef);
    await dialog.getByLabel(t.quantity, { exact: true }).fill("2000");
    await dialog.getByLabel(t.neededBy).fill(dateAfter(2));
    await save(dialog);
    await supplierRow
      .getByRole("button", { name: t.view, exact: true })
      .click();
    const release = supplierRow
      .getByRole("listitem")
      .filter({ hasText: releaseRef })
      .first();
    await reference(supplier, release, t.acknowledge, `LOCAL-REL-ACK-${stamp}`);
    await expect(
      release.getByText(t.acknowledged, { exact: true }),
    ).toBeVisible();
    await buyer.getByRole("tab", { name: t.plans, exact: true }).click();
    dialog = await form(buyer, t.createPlan);
    await choose(buyer, dialog, t.material, "Newspaper");
    await dialog.getByLabel(t.specification).fill(spec);
    await dialog.getByLabel(t.quantity, { exact: true }).fill("3000");
    await dialog.getByLabel(t.area).fill("Local test Peenya");
    await dialog.getByLabel(t.neededBy).fill(dateAfter(3));
    await choose(buyer, dialog, t.cadence, t.weekly);
    await buyer.keyboard.press("Escape");
    await buyer.getByRole("tab", { name: t.agreements, exact: true }).click();
    await buyer.getByRole("tab", { name: t.plans, exact: true }).click();
    dialog = await form(buyer, t.createPlan);
    await expect(
      dialog.getByRole("combobox", { name: t.cadence, exact: true }),
    ).toContainText(t.weekly);
    await save(dialog);
    const plan = buyer.getByRole("listitem").filter({ hasText: spec }).first();
    await plan.getByRole("button", { name: t.publish, exact: true }).click();
    await expect(plan).toContainText(dateAfter(10));
    await viewer.getByRole("tab", { name: t.plans, exact: true }).click();
    await expect(
      viewer.getByRole("button", { name: t.createPlan, exact: true }),
    ).toHaveCount(0);
    await expect(viewer.getByText(t.readOnly, { exact: true })).toBeVisible();
    await buyer.setViewportSize({ width: 390, height: 844 });
    await buyer.goto("/ar/app/sourcing");
    await expect(
      buyer.getByRole("heading", { level: 1, name: ar.sourcing.title }),
    ).toBeVisible();
    expect(await buyer.evaluate(() => document.documentElement.dir)).toBe(
      "rtl",
    );
    expect(
      await buyer.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    expect(errors).toEqual([]);
  } finally {
    for (const context of contexts) await context.close();
  }
});

test("lot dialog keeps its title and close control visible through keyboard scrolling", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await login(page, "preprocessor");
  await page.goto("/en/app/lots");
  await page
    .getByRole("link")
    .filter({ hasText: /Acceptance PET.*Measured bale/ })
    .first()
    .click();
  const dialog = await form(page, en.lots.transform);
  await dialog
    .getByRole("button", { name: en.lots.addInput, exact: true })
    .click();
  await dialog
    .getByRole("region", { name: en.lots.additionalInputs, exact: true })
    .scrollIntoViewIfNeeded();
  const saveButton = dialog.getByRole("button", {
    name: en.lots.save,
    exact: true,
  });
  await focusByKeyboard(page, dialog, saveButton);
  await expect(saveButton).toBeFocused();
  const title = dialog.getByRole("heading", {
    name: en.lots.transform,
    exact: true,
  });
  const box = await title.boundingBox();
  expect(box?.y).toBeGreaterThanOrEqual(16);
  await expect(
    dialog.getByRole("button", { name: en.lots.close, exact: true }),
  ).toBeVisible();
  expect(await dialog.evaluate((el) => el.scrollTop)).toBe(0);
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
});
