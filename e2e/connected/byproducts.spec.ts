import { readFileSync } from "node:fs";

import { expect, type Page, test } from "@playwright/test";
import { ConvexHttpClient } from "convex/browser";
import { z } from "zod";

import { api } from "../../convex/_generated/api";
import en from "../../messages/en.json" with { type: "json" };

const accountSchema = z.object({
  key: z.string(),
  email: z.email(),
  password: z.string(),
});

test("an unpaid accepted order can be cancelled without losing stock or inventing payment", async ({
  browser,
}) => {
  const makerContext = await browser.newContext({
    baseURL: credentials.site,
    extraHTTPHeaders: clientHeaders("manufacturer"),
  });
  const shopContext = await browser.newContext({
    baseURL: credentials.site,
    extraHTTPHeaders: clientHeaders("kabadiwala"),
  });
  const maker = await makerContext.newPage();
  const shop = await shopContext.newPage();
  const errors: string[] = [];
  const outbound: string[] = [];
  for (const page of [maker, shop]) {
    page.on("pageerror", (error) => {
      errors.push(error.name);
    });
    await page.route("**/*", async (route) => {
      const host = new URL(route.request().url()).hostname;
      if (["localhost", "127.0.0.1"].includes(host)) await route.continue();
      else {
        outbound.push(host);
        await route.abort();
      }
    });
  }
  try {
    const makerApi = await signIn(maker, "manufacturer");
    const shopApi = await signIn(shop, "kabadiwala");
    const beforeRows = await makerApi.query(api.market.sellable, {});
    const before = beforeRows.find((row) => row.material.code === materialCode);
    if (!before) throw new Error("Missing approved local stock");
    // The companion journey proves the offer/request/accept forms. This case
    // uses their real authenticated functions for setup, then cancels in the UI.
    const grade = `Local cancellation ${String(Date.now())}`;
    const listingId = await makerApi.mutation(api.market.createListing, {
      materialCode,
      grams: 1000,
      askPaisePerKg: 1250,
      specification: { grade, specification: "Synthetic cancellation case" },
    });
    const tradeId = await shopApi.mutation(api.market.requestTrade, {
      listingId,
      grams: 1000,
    });
    await makerApi.mutation(api.market.act, { tradeId, action: "accept" });
    const reservedRows = await makerApi.query(api.market.sellable, {});
    const reserved = reservedRows.find(
      (row) => row.material.code === materialCode,
    );
    expect(reserved?.stockGrams).toBe(before.stockGrams);
    expect(reserved?.availableGrams).toBe(before.availableGrams - 1000);
    await expect(
      makerApi.mutation(api.market.recordDirectCash, {
        tradeId,
        amountPaise: 1250,
        reference: "Synthetic rejected cash receipt",
      }),
    ).rejects.toThrow("CASH_RECEIPT_NOT_AVAILABLE");
    await shop.goto("/en/app/trades?tab=buying");
    const order = shop.getByRole("article").filter({ hasText: grade });
    await expect(order.getByText(en.tradeLifecycle.cashReported)).toHaveCount(
      0,
    );
    await expect(
      order.getByRole("button", {
        name: en.sandboxPayment.liveTitle,
        exact: true,
      }),
    ).toHaveCount(0);
    await order
      .getByRole("button", {
        name: en.tradeLifecycle.action.cancel,
        exact: true,
      })
      .click();
    await order
      .getByRole("textbox", { name: en.tradeLifecycle.reason, exact: true })
      .fill("Local test duplicate order");
    await order
      .getByRole("button", { name: en.tradeLifecycle.confirm, exact: true })
      .click();
    await expect(
      order.getByText(en.tradeLifecycle.state.cancelled, { exact: true }),
    ).toBeVisible();
    await shop.reload();
    await expect(
      order.getByText(en.tradeLifecycle.state.cancelled, { exact: true }),
    ).toBeVisible();
    const afterRows = await makerApi.query(api.market.sellable, {});
    const after = afterRows.find((row) => row.material.code === materialCode);
    expect(after?.stockGrams).toBe(before.stockGrams);
    expect(after?.availableGrams).toBe(before.availableGrams);
    const evidence = await shopApi.query(api.cashfreeLifecycle.status, {
      tradeId,
    });
    expect(evidence?.collection).toBe("pending");
    expect(evidence?.settlement).toBe("pending");
    expect(outbound).toEqual([]);
    expect(errors).toEqual([]);
  } finally {
    await makerContext.close();
    await shopContext.close();
  }
});

const credentials = z
  .object({
    site: z.url(),
    accounts: z.array(accountSchema),
  })
  .parse(
    JSON.parse(
      readFileSync(".convex/local-acceptance/credentials.json", "utf8"),
    ) as unknown,
  );
const materialCode = "LOCAL-PAPER-BYPRODUCT";
const materialName = "Local test paper offcuts";
test.use({ actionTimeout: 15_000 });

function clientHeaders(key: string) {
  const index = credentials.accounts.findIndex((person) => person.key === key);
  if (index === -1) throw new Error("Missing disposable account");
  return { "X-Forwarded-For": `192.0.2.${String(index + 1)}` };
}

async function signIn(page: Page, key: string) {
  const account = credentials.accounts.find((person) => person.key === key);
  if (!account) throw new Error("Missing disposable account");
  const response = await page.request.post(
    `${credentials.site}/api/auth/sign-in/email`,
    {
      headers: {
        Origin: credentials.site,
        ...clientHeaders(key),
      },
      data: { email: account.email, password: account.password },
    },
  );
  expect(
    response.ok(),
    `Local ${key} sign-in HTTP ${String(response.status())}`,
  ).toBe(true);
  await page.goto("/en/app");
  await expect(
    page.getByRole("main").getByRole("heading", { level: 1 }),
  ).toBeVisible();
  const tokenResponse = await page.request.get("/api/auth/convex/token");
  expect(tokenResponse.ok()).toBe(true);
  const { token } = z
    .object({ token: z.string() })
    .parse(await tokenResponse.json());
  return new ConvexHttpClient("http://127.0.0.1:3210", {
    auth: token,
    logger: false,
  });
}

test("manufacturer byproducts reach an approved shop and stop before gateway payment", async ({
  browser,
}) => {
  const makerContext = await browser.newContext({
    baseURL: credentials.site,
    extraHTTPHeaders: clientHeaders("manufacturer"),
  });
  const shopContext = await browser.newContext({
    baseURL: credentials.site,
    extraHTTPHeaders: clientHeaders("kabadiwala"),
  });
  const viewerContext = await browser.newContext({
    baseURL: credentials.site,
    extraHTTPHeaders: clientHeaders("team-viewer"),
  });
  const maker = await makerContext.newPage();
  const shop = await shopContext.newPage();
  const viewer = await viewerContext.newPage();
  const errors: string[] = [];
  const sdkRequests: string[] = [];
  shop.on("request", (request) => {
    if (new URL(request.url()).hostname === "sdk.cashfree.com")
      sdkRequests.push("SDK requested");
  });
  for (const page of [maker, shop, viewer])
    page.on("pageerror", (error) => {
      errors.push(error.name);
    });
  try {
    process.stdout.write("Byproduct stage: sign-in\n");
    const makerApi = await signIn(maker, "manufacturer");
    const shopApi = await signIn(shop, "kabadiwala");
    const viewerApi = await signIn(viewer, "team-viewer");
    const stockBefore = await makerApi.query(api.stock.mine, {});
    const originalGrams =
      stockBefore.rows.find((row) => row.material.code === materialCode)
        ?.grams ?? 0;
    const intakeReference = `LOCAL-INTAKE-${String(Date.now())}`;
    await maker.goto("/en/app/stock");
    expect(stockBefore.rows.some((row) => row.valuePaise === null)).toBe(true);
    expect(stockBefore.totalValuePaise).toBeNull();
    await expect(
      maker.getByText(en.shop.stock.worthHint, { exact: true }),
    ).toHaveCount(0);
    await expect(
      maker.getByText(en.shop.stock.noPrice, { exact: true }).first(),
    ).toBeVisible();
    await maker
      .getByRole("button", { name: en.stockIntake.add, exact: true })
      .click();
    const intake = maker.getByRole("dialog", {
      name: en.stockIntake.add,
      exact: true,
    });
    await intake.getByLabel(en.stockIntake.reference).fill(intakeReference);
    await intake
      .getByRole("combobox", { name: en.lots.material, exact: true })
      .click();
    await maker
      .getByRole("option", { name: materialName, exact: true })
      .click();
    await intake.getByLabel(en.lots.mass, { exact: true }).fill("3000");
    await intake.getByLabel(en.stockIntake.date).fill("2026-10-01");
    await intake
      .getByLabel(en.stockIntake.source)
      .fill(`LOCAL-PRODUCTION-${intakeReference}`);
    await intake
      .getByLabel(en.stockIntake.weighing)
      .fill(`LOCAL-WEIGHING-${intakeReference}`);
    await intake
      .getByRole("checkbox", { name: en.stockIntake.confirm, exact: true })
      .check();
    await intake
      .getByRole("button", { name: en.lots.save, exact: true })
      .click();
    await expect(intake).toHaveCount(0);
    await expect(
      maker.getByRole("heading", { name: intakeReference, exact: true }),
    ).toBeVisible();
    const afterIntake = await makerApi.query(api.stock.mine, {});
    const beforeGrams = afterIntake.rows.find(
      (row) => row.material.code === materialCode,
    )?.grams;
    expect(beforeGrams).toBe(originalGrams + 3000);
    const note = `Local browser offer ${String(Date.now())}`;
    process.stdout.write("Byproduct stage: manufacturer form\n");
    await maker.goto("/en/app/sell");
    await expect(
      maker.getByRole("radio", { name: new RegExp(materialName) }),
    ).toBeVisible();
    await expect(
      maker.getByRole("radio", { name: /Local test unclassified paper/ }),
    ).toHaveCount(0);
    await expect(
      makerApi.mutation(api.market.createListing, {
        materialCode: "LOCAL-PAPER-UNCLASSIFIED",
        grams: 1000,
        askPaisePerKg: 1250,
      }),
    ).rejects.toThrow("BYPRODUCT_NOT_ELIGIBLE");
    process.stdout.write("Byproduct stage: create eligible offer\n");
    await maker.getByRole("radio", { name: new RegExp(materialName) }).click();
    await maker.getByLabel(en.market.sell.form.kg, { exact: true }).fill("1");
    await maker
      .getByLabel(en.market.sell.form.price, { exact: true })
      .fill("12.50");
    await maker
      .getByLabel(
        `${en.market.sell.form.note}${en.market.sell.form.optional}`,
        { exact: true },
      )
      .fill(note);
    await maker
      .getByRole("checkbox", {
        name: en.marketSpecification.enable,
        exact: true,
      })
      .click();
    await maker
      .getByLabel(en.marketSpecification.grade, { exact: true })
      .fill(`${note} grade`);
    await maker
      .getByLabel(en.marketSpecification.specification, { exact: true })
      .fill("Local test paper quality specification");
    await maker
      .getByRole("button", { name: en.market.sell.form.submit, exact: true })
      .click();
    await expect(
      maker.getByRole("article").filter({ hasText: note }),
    ).toBeVisible();
    const listings = await makerApi.query(api.market.myListings, {});
    const listing = listings.find((row) => row.note === note);
    if (!listing)
      throw new Error("The browser-created synthetic offer is missing");
    expect(listing.origin).toBe("manufacturer_byproduct");
    expect(listing.specification?.grade).toBe(`${note} grade`);
    process.stdout.write("Byproduct stage: viewer denial\n");

    await viewer.goto("/en/app/market");
    await expect(
      viewer.getByRole("article").filter({ hasText: note }),
    ).toBeVisible();
    await expect(viewer.getByRole("button", { name: /^Buy / })).toHaveCount(0);
    await expect(
      viewerApi.mutation(api.market.requestTrade, {
        listingId: listing.id,
        grams: 1000,
      }),
    ).rejects.toThrow();
    process.stdout.write("Byproduct stage: buyer request\n");

    await shop.goto("/ar/app/market");
    await expect(shop.locator("html")).toHaveAttribute("dir", "rtl");
    await expect(
      shop.getByRole("article").filter({ hasText: note }),
    ).toBeVisible();
    expect(
      await shop.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
    await shop.goto("/en/app/market");
    await shop
      .getByRole("article")
      .filter({ hasText: note })
      .getByRole("button")
      .click();
    const dialog = shop.getByRole("dialog");
    await dialog.getByLabel(en.market.buy.kgLabel, { exact: true }).fill("2");
    await dialog
      .getByRole("button", { name: en.market.buy.submit, exact: true })
      .click();
    await expect(
      dialog.getByText("Only 1 kg is available.", { exact: true }),
    ).toBeVisible();
    await dialog.getByLabel(en.market.buy.kgLabel, { exact: true }).fill("1");
    await dialog
      .getByRole("button", { name: en.market.buy.submit, exact: true })
      .click();
    await expect(dialog).toHaveCount(0);
    process.stdout.write("Byproduct stage: seller accepts\n");
    await maker.goto("/en/app/trades?tab=selling");
    const makerTrades = await makerApi.query(api.market.trades, {});
    const trade = makerTrades.selling.find(
      (row) =>
        row.status === "requested" &&
        row.material.code === materialCode &&
        row.specification?.grade === `${note} grade`,
    );
    if (!trade) throw new Error("The real buyer request is missing");
    const order = maker
      .getByRole("article")
      .filter({
        has: maker.getByRole("heading", {
          name: `${materialName} · 1 kg`,
          exact: true,
        }),
      })
      .filter({
        has: maker.getByRole("button", {
          name: en.market.trades.action.accept,
          exact: true,
        }),
      })
      .filter({ hasText: `${note} grade` })
      .first();
    await order
      .getByRole("button", {
        name: en.market.trades.action.accept,
        exact: true,
      })
      .click();
    await expect
      .poll(async () => {
        const trades = await shopApi.query(api.market.trades, {});
        return trades.buying.find((row) => row.id === trade.id)?.status;
      })
      .toBe("accepted");
    await shop.goto("/en/app/trades?tab=buying");
    await expect(
      shop.getByRole("tab", { name: en.market.trades.buying }),
    ).toHaveAttribute("aria-selected", "true");
    await shop
      .getByRole("button", { name: en.sandboxPayment.title, exact: true })
      .first()
      .click();
    await expect(
      shop
        .getByRole("dialog")
        .getByText(en.sandboxPayment.unavailable, { exact: true }),
    ).toBeVisible();
    await expect(
      shop.getByRole("button", { name: en.sandboxPayment.open, exact: true }),
    ).toHaveCount(0);
    expect(sdkRequests).toEqual([]);
    await shop.keyboard.press("Escape");
    const stillPaused = await shopApi.query(api.market.trades, {});
    expect(stillPaused.buying.find((row) => row.id === trade.id)?.status).toBe(
      "accepted",
    );
    const stockAfter = await makerApi.query(api.stock.mine, {});
    expect(
      stockAfter.rows.find((row) => row.material.code === materialCode)?.grams,
    ).toBe(beforeGrams);
    const shopTrades = await shopApi.query(api.market.trades, {});
    expect(
      shopTrades.buying.find((row) => row.id === trade.id)?.totalPaise,
    ).toBe(1250);
    expect(
      shopTrades.buying.find((row) => row.id === trade.id)?.specification,
    ).toEqual(listing.specification);
    // Keep one small open synthetic offer for the teammate guide. The tested
    // one-kilogram offer is fully reserved by the accepted order above.
    const guideNote = "Local test open byproduct offer for teammate review";
    const guideOffers = await makerApi.query(api.market.myListings, {});
    const guideGrade = "Local browser offer guide grade";
    const obsoleteGuideOffers = guideOffers.filter(
      (offer) =>
        offer.status === "open" &&
        offer.note === guideNote &&
        offer.specification?.grade !== guideGrade,
    );
    for (const oldOffer of obsoleteGuideOffers) {
      await makerApi.mutation(api.market.withdraw, { listingId: oldOffer.id });
    }
    if (
      guideOffers.every(
        (offer) =>
          !(
            offer.status === "open" &&
            offer.note === guideNote &&
            offer.specification?.grade === guideGrade
          ),
      )
    ) {
      await makerApi.mutation(api.market.createListing, {
        materialCode,
        grams: 2000,
        askPaisePerKg: 1250,
        note: guideNote,
        specification: {
          grade: guideGrade,
          specification: "Local test paper quality specification",
        },
      });
    }
    expect(errors).toEqual([]);
    process.stdout.write("Byproduct stage: complete\n");
  } finally {
    await Promise.all([
      makerContext.close(),
      shopContext.close(),
      viewerContext.close(),
    ]);
  }
});
