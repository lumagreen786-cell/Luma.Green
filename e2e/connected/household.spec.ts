import { randomInt } from "node:crypto";
import { mkdirSync, readFileSync } from "node:fs";
import { parseEnv } from "node:util";

import { expect, type Page, type Response, test } from "@playwright/test";
import { ConvexHttpClient } from "convex/browser";
import { z } from "zod";

import { api } from "../../convex/_generated/api";
import en from "../../messages/en.json" with { type: "json" };

const accountSchema = z.object({
  key: z.string(),
  name: z.string(),
  email: z.email(),
  password: z.string(),
});
const credentialsSource: unknown = JSON.parse(
  readFileSync(".convex/local-acceptance/credentials.json", "utf8"),
);
const credentials = z
  .object({ site: z.url(), accounts: z.array(accountSchema) })
  .parse(credentialsSource);
const inbox = z
  .object({
    AUTH_LOCAL_TEST_MODE: z.literal("true"),
    AUTH_LOCAL_EMAIL_INBOX_URL: z.url(),
    AUTH_LOCAL_EMAIL_INBOX_TOKEN: z.string().min(32),
  })
  .parse(
    parseEnv(readFileSync(".convex/local-acceptance/backend.env", "utf8")),
  );
const inboxUrl = new URL(inbox.AUTH_LOCAL_EMAIL_INBOX_URL);
const siteUrl = new URL(credentials.site);
for (const url of [siteUrl, inboxUrl]) {
  if (
    url.protocol !== "http:" ||
    !["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)
  ) {
    throw new Error(
      "Household acceptance requires disposable loopback services",
    );
  }
}
const backendUrl = "http://127.0.0.1:3210";
const messageSchema = z.object({ kind: z.string(), text: z.string() });
const inboxSchema = z.object({ messages: z.array(messageSchema) });
const material = "Newspaper";
const materialCode = "PAPER-NEWS";
const measuredGrams = 1250;
const expectedPaise = 1750;
const expectedMoney = "₹17.50";
const evidenceDirectory = ".convex/local-acceptance/evidence";

test.use({ actionTimeout: 15_000 });

function requireValue<T>(value: T | undefined | null, message: string): T {
  if (value === undefined || value === null) throw new Error(message);
  return value;
}

async function readPhoneCode(page: Page, phone: string) {
  let code: string | undefined;
  const url = new URL("/messages", inboxUrl.origin);
  url.searchParams.set("to", phone);
  await expect
    .poll(
      async () => {
        const response = await page.request.get(url.href, {
          headers: {
            Authorization: `Bearer ${inbox.AUTH_LOCAL_EMAIL_INBOX_TOKEN}`,
          },
        });
        if (!response.ok())
          throw new Error("Protected local inbox unavailable");
        const messages = inboxSchema.parse(await response.json()).messages;
        code = messages.findLast(
          (message) => message.kind === "phone-code",
        )?.text;
        return typeof code === "string" && /^\d{6}$/.test(code);
      },
      { message: "The local inbox receives the generated phone code" },
    )
    .toBe(true);
  if (!code) throw new Error("No local phone code delivered");
  return code;
}

async function clientFor(page: Page) {
  const response = await page.request.get(
    `${credentials.site}/api/auth/convex/token`,
  );
  const result = z
    .object({ token: z.string() })
    .safeParse(await response.json());
  if (!response.ok() || !result.success)
    throw new Error("Browser session has no Convex token");
  return new ConvexHttpClient(backendUrl, {
    auth: result.data.token,
    logger: false,
  });
}

async function signInShop(page: Page) {
  const shop = credentials.accounts.find(
    (account) => account.key === "kabadiwala",
  );
  if (!shop) throw new Error("Local kabadiwala account missing");
  const authStatuses: { path: string; status: number }[] = [];
  const recordStatus = (response: Response) => {
    const path = new URL(response.url()).pathname;
    if (
      [
        "/api/auth/sign-in/email",
        "/api/auth/get-session",
        "/api/auth/convex/token",
      ].includes(path)
    )
      authStatuses.push({ path, status: response.status() });
  };
  page.on("response", recordStatus);
  await page.setExtraHTTPHeaders({ "X-Forwarded-For": "192.0.2.204" });
  await page.goto("/login?next=/app/requests");
  await page.getByRole("radio", { name: "English", exact: true }).check();
  await page
    .getByRole("button", { name: en.auth.continue, exact: true })
    .click();
  await page
    .getByRole("tab", { name: en.emailAuth.email, exact: true })
    .click();
  await page
    .getByRole("textbox", { name: en.emailAuth.email, exact: true })
    .fill(shop.email);
  await page
    .getByLabel(en.emailAuth.password, { exact: true })
    .fill(shop.password);
  await page
    .getByRole("button", { name: en.emailAuth.signin, exact: true })
    .click();
  try {
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      en.shop.requests.title,
    );
  } catch (error) {
    // Only fixed auth paths and HTTP status codes enter the failure report.
    throw new Error(`Shop sign-in status: ${JSON.stringify(authStatuses)}`, {
      cause: error,
    });
  } finally {
    page.off("response", recordStatus);
  }
  return shop;
}

// Every record is created through the UI. The authenticated client only reads
// exact integer results and attempts one deliberately rejected completion replay.
test("phone household pickup produces an exact receipt and adds measured stock once", async ({
  browser,
}) => {
  test.setTimeout(180_000);
  const phone = `+91900000${String(randomInt(1000, 10_000))}`;
  const name = `Household${String(randomInt(100_000, 1_000_000))}`;
  const householdContext = await browser.newContext({
    baseURL: credentials.site,
    viewport: { width: 390, height: 844 },
  });
  const shopContext = await browser.newContext({ baseURL: credentials.site });
  const household = await householdContext.newPage();
  const shop = await shopContext.newPage();
  const errors: string[] = [];
  household.on("pageerror", (error) => {
    errors.push(error.name);
  });
  shop.on("pageerror", (error) => {
    errors.push(error.name);
  });
  try {
    const shopAccount = await signInShop(shop);
    const shopClient = await clientFor(shop);
    const before = await shopClient.query(api.stock.mine, {});
    const beforeGrams =
      before.rows.find((row) => row.material.code === materialCode)?.grams ?? 0;
    await household.setExtraHTTPHeaders({ "X-Forwarded-For": "192.0.2.205" });
    await household.goto("/sell");
    // An actual local image file exercises the browser's photo preparation path.
    // The illustration is synthetic test content, not household evidence.
    await household
      .getByLabel(en.sell.simple.photos, { exact: true })
      .setInputFiles("public/images/showcase/household-sorting.webp");
    await household
      .getByRole("radio", { name: en.sell.simple.pickup, exact: true })
      .check();
    await household
      .getByRole("textbox", { name: en.sell.when.addressLabel })
      .fill("Synthetic test flat 7, Local test area, Bengaluru");
    await household
      .getByRole("textbox", { name: en.sell.when.nameLabel })
      .fill(name);
    await household
      .getByRole("button", { name: en.sell.simple.next, exact: true })
      .click();
    await household
      .getByRole("radio", { name: new RegExp(shopAccount.name) })
      .check();
    const day = household.getByRole("combobox", {
      name: en.sell.when.dayLabel,
      exact: true,
    });
    await day.click();
    await household.getByRole("option", { name: /^Tomorrow/ }).click();
    await expect(day).toContainText(en.sell.when.tomorrow);
    await household
      .getByRole("combobox", { name: en.sell.when.windowLabel, exact: true })
      .click();
    await household.getByRole("option", { name: /^Morning/ }).click();
    await household
      .getByRole("textbox", { name: en.sell.phone.label, exact: true })
      .fill(phone.slice(3));
    await household
      .getByRole("button", { name: en.sell.phone.sendCode, exact: true })
      .click();
    const code = await readPhoneCode(household, phone);
    try {
      await household
        .getByRole("textbox", { name: en.sell.phone.codeLabel, exact: true })
        .fill(code);
    } catch {
      throw new Error("The household code control could not be filled");
    }
    await expect
      .poll(() => new URL(household.url()).pathname.startsWith("/t/"))
      .toBe(true);
    await expect(
      household.getByRole("textbox", {
        name: en.sell.phone.codeLabel,
        exact: true,
      }),
    ).toHaveCount(0);
    const token = requireValue(
      new URL(household.url()).pathname.split("/").at(-1),
      "Booking tracking link missing",
    );
    const householdClient = await clientFor(household);
    const profile = await householdClient.query(api.identity.me, {});
    const hasVerifiedPhone = profile?.phone === phone;
    expect(hasVerifiedPhone).toBe(true);
    const requested = await householdClient.query(api.households.track, {
      token,
    });
    expect(requested?.status).toBe("requested");
    expect(requested?.mode).toBe("pickup");
    expect(requested?.estimatePaise).toBeUndefined();
    expect(requested?.items).toEqual([]);
    expect(requested?.isMine).toBe(true);
    await shop.getByRole("link", { name, exact: true }).click();
    await expect(shop.getByText(en.shop.request.hidden)).toBeVisible();
    await shop
      .getByRole("button", { name: en.shop.requests.accept, exact: true })
      .click();
    await expect(
      shop.getByRole("button", {
        name: en.shop.requests.startTrip,
        exact: true,
      }),
    ).toBeVisible();
    await expect(household.getByRole("heading", { level: 1 })).toContainText(
      "accepted your pickup",
    );
    await shop
      .getByRole("button", { name: en.shop.requests.startTrip, exact: true })
      .click();
    await expect(household.getByRole("heading", { level: 1 })).toContainText(
      "is on the way",
    );
    const bookingId = requireValue(
      new URL(shop.url()).pathname.split("/").at(-1),
      "Shop booking route missing",
    );
    const detail = requireValue(
      await shopClient.query(api.shop.get, { bookingId }),
      "Shop could not read its own booking",
    );
    const photos = await shopClient.query(api.householdPhotos.list, {
      bookingId: detail.booking.id,
    });
    expect(photos).toHaveLength(1);
    // Photo-only requests have no guessed material rows. The shop identifies
    // the material, then records the measured weight used by the ledger.
    await shop
      .getByRole("combobox", { name: en.shop.weigh.add, exact: true })
      .click();
    await shop.getByRole("option", { name: material, exact: true }).click();
    await shop
      .getByRole("textbox", { name: `${material}, in kg`, exact: true })
      .fill("10");
    await shop
      .getByRole("textbox", { name: `${material}, in kg`, exact: true })
      .fill("1.25");
    await shop
      .getByRole("radio", { name: en.shop.methods.cash, exact: true })
      .check();
    await shop
      .getByRole("button", {
        name: `Confirm ${expectedMoney} paid`,
        exact: true,
      })
      .click();
    const receipt = shop.getByRole("region", {
      name: `Paid ${expectedMoney}`,
      exact: true,
    });
    await expect(receipt).toBeVisible();
    await expect(
      receipt.getByText("1.25 kg at ₹14/kg", { exact: true }),
    ).toBeVisible();
    await expect(receipt.getByText(en.shop.receipt.stock)).toBeVisible();
    await expect(household.getByRole("heading", { level: 1 })).toHaveText(
      en.track.review.title,
    );
    const completed = await householdClient.query(api.households.track, {
      token,
    });
    expect(completed?.receipt?.totalPaise).toBe(expectedPaise);
    expect(completed?.receipt?.method).toBe("cash");
    await expect(
      household.getByRole("button", {
        name: en.track.review.acknowledge,
        exact: true,
      }),
    ).toHaveCount(0);
    await household
      .getByRole("button", { name: en.track.review.accept, exact: true })
      .click();
    await expect(
      household.getByRole("button", {
        name: en.track.review.acknowledge,
        exact: true,
      }),
    ).toBeVisible();
    await household
      .getByRole("button", { name: en.track.review.acknowledge, exact: true })
      .click();
    await expect(
      household.getByRole("button", {
        name: en.track.review.acknowledge,
        exact: true,
      }),
    ).toHaveCount(0);
    const acknowledged = await householdClient.query(api.households.track, {
      token,
    });
    expect(acknowledged?.receiptReview?.paymentAcknowledgedAt).toBeGreaterThan(
      0,
    );
    const anonymous = new ConvexHttpClient(backendUrl, { logger: false });
    expect(await anonymous.query(api.households.track, { token })).toBeNull();
    expect(
      completed?.receipt?.lines.map((line) => ({
        grams: line.grams,
        paise: line.paise,
        rate: line.paisePerKg,
      })),
    ).toEqual([{ grams: measuredGrams, paise: expectedPaise, rate: 1400 }]);
    expect(completed?.timeline.map((step) => step.status)).toEqual([
      "requested",
      "accepted",
      "on_the_way",
      "completed",
    ]);
    const after = await shopClient.query(api.stock.mine, {});
    const afterGrams =
      after.rows.find((row) => row.material.code === materialCode)?.grams ?? 0;
    expect(afterGrams - beforeGrams).toBe(measuredGrams);
    await expect(
      shopClient.mutation(api.shop.complete, {
        bookingId: detail.booking.id,
        lines: [{ materialCode, grams: measuredGrams }],
        method: "cash",
      }),
    ).rejects.toThrow("WRONG_STATUS");
    const replayStock = await shopClient.query(api.stock.mine, {});
    expect(
      replayStock.rows.find((row) => row.material.code === materialCode)?.grams,
    ).toBe(afterGrams);
    mkdirSync(evidenceDirectory, { recursive: true });
    // Crop actual UI to safe receipt regions: no OTP, contact details, or tracking token.
    await receipt.screenshot({
      path: `${evidenceDirectory}/household-shop-receipt.png`,
    });
    await household
      .getByRole("region", { name: en.track.money.title })
      .screenshot({ path: `${evidenceDirectory}/household-money.png` });
    await shop.goto("/app/stock");
    const stock = shop.getByRole("region", { name: en.shop.stock.scrap });
    await expect(stock.getByText(material, { exact: true })).toBeVisible();
    await stock.screenshot({
      path: `${evidenceDirectory}/household-stock.png`,
    });
    expect(errors).toEqual([]);
  } finally {
    await Promise.allSettled([householdContext.close(), shopContext.close()]);
  }
});
