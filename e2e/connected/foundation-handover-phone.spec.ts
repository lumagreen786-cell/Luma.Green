import { readFileSync } from "node:fs";
import { parseEnv } from "node:util";

import {
  type Browser,
  type BrowserContext,
  expect,
  type Locator,
  type Page,
  test,
} from "@playwright/test";
import { ConvexHttpClient } from "convex/browser";
import { z } from "zod";

import { api } from "../../convex/_generated/api";
import { isLoopbackHttpOrigin } from "../../convex/lib/localAcceptance";
import { indiaToday } from "../../convex/lib/onboarding";
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
    "The handover browser case requires the current loopback phone runtime.",
  );

async function actor(browser: Browser, key: string) {
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
async function clientFor(context: BrowserContext) {
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
async function choose(
  page: Page,
  scope: Locator,
  label: string,
  option: string,
) {
  await scope.getByRole("combobox", { name: label, exact: true }).click();
  await page.getByRole("option", { name: option, exact: true }).click();
}
async function panel(page: Page) {
  const block = page
    .locator("details")
    .filter({
      has: page.locator("summary", { hasText: en.workerHandover.title }),
    })
    .first();
  await block.locator("summary").first().click();
  await expect(
    block.getByText(en.workerHandover.hint, { exact: true }),
  ).toBeVisible();
  return block;
}

test("local phone worker and employer preserve exact handover variance after reload without another stock or pay effect", async ({
  browser,
}) => {
  test.setTimeout(180_000);
  const employer = await actor(browser, "kabadiwala"),
    worker = await actor(browser, "saathi"),
    household = await actor(browser, "household");
  try {
    const shopClient = await clientFor(employer),
      workerClient = await clientFor(worker),
      homeClient = await clientFor(household);
    const scope = await shopClient.query(api.workspace.mine, {});
    if (scope?.kind !== "org" || scope.org.kind !== "kabadiwala")
      throw new Error("The local employer is not the expected shop.");
    const today = indiaToday();
    const previousJobs = await workerClient.query(api.saathi.board, {});
    for (const previousJob of previousJobs.mine) {
      if (
        !previousJob.title.startsWith("Synthetic local handover ") ||
        previousJob.date > today
      )
        continue;
      await workerClient.mutation(api.saathi.finish, { jobId: previousJob.id });
    }
    const choices = await shopClient.query(
      api.collectionScheduling.availability,
      { orgId: scope.org.id, date: today },
    );
    const slot = choices.find((row) => row.remaining > 0);
    if (!slot)
      throw new Error(
        "No current-day local collection slot remains; the case cannot move the clock or bypass capacity.",
      );
    const title = `Synthetic local handover ${String(Date.now())}`;
    const jobId = await shopClient.mutation(api.workforce.post, {
      kind: "home_pickups",
      title,
      area: "Local test area",
      date: today,
      window: slot.window,
      payPaise: 50_000,
    });
    await workerClient.mutation(api.saathi.take, { jobId });
    const beforeRequests = await shopClient.query(api.shop.requests, {});
    const previous = new Set(
      [
        ...beforeRequests.new,
        ...beforeRequests.active,
        ...beforeRequests.done,
      ].map((row) => row.id),
    );
    const photo = Uint8Array.from(
      Buffer.from(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=",
        "base64",
      ),
    );
    const photoId = await homeClient.action(api.householdPhotos.upload, {
      name: "Synthetic local test image.png",
      bytes: photo.buffer,
    });
    const token = await homeClient.mutation(api.households.book, {
      photoIds: [photoId],
      orgId: scope.org.id,
      mode: "pickup",
      items: [],
      slotDate: today,
      slotWindow: slot.window,
      address: "Synthetic local pickup address, Bengaluru",
      name: "Synthetic handover household",
    });
    const requests = await shopClient.query(api.shop.requests, {});
    const booking = [...requests.new, ...requests.active].find(
      (row) => !previous.has(row.id),
    );
    if (!booking)
      throw new Error(
        "The authenticated local collection was not offered to its shop.",
      );
    expect(["requested", "accepted"]).toContain(booking.status);
    // eslint-disable-next-line playwright/no-conditional-in-test -- Reuse either actual configured offer behavior; an already accepted offer cannot be accepted twice.
    if (booking.status === "requested")
      await shopClient.mutation(api.shop.respond, {
        bookingId: booking.id,
        accept: true,
      });
    const owner = await employer.newPage(),
      collector = await worker.newPage();
    await owner.goto("/app");
    const employerPanel = await panel(owner);
    const sources = await shopClient.query(
        api.workerHandovers.employerBoard,
        {},
      ),
      source = sources.bookings.find((row) => row.id === booking.id);
    if (!source)
      throw new Error(
        "The accepted local collection is not eligible for a handover.",
      );
    const bind = employerPanel.getByRole("form", {
      name: en.workerHandover.link,
      exact: true,
    });
    await choose(owner, bind, en.workerHandover.job, title);
    await choose(owner, bind, en.workerHandover.collection, source.label);
    await bind
      .getByRole("button", { name: en.workerHandover.link, exact: true })
      .click();
    await expect(
      employerPanel.getByRole("article", { name: title, exact: true }),
    ).toBeVisible();
    await collector.goto("/app");
    let workerPanel = await panel(collector);
    let workerRow = workerPanel.getByRole("article", {
      name: title,
      exact: true,
    });
    const collected = workerRow.getByRole("form", {
      name: en.workerHandover.record,
      exact: true,
    });
    const beforeCollected = await shopClient.query(api.stock.mine, {});
    await collected
      .getByLabel(en.workerHandover.collected, { exact: true })
      .fill("1001");
    await collected
      .getByLabel(en.workerHandover.evidence, { exact: true })
      .fill("Synthetic measured collection record");
    await collected
      .getByRole("button", { name: en.workerHandover.record, exact: true })
      .click();
    await expect(collected).toHaveCount(0);
    await collector.reload();
    workerPanel = await panel(collector);
    workerRow = workerPanel.getByRole("article", { name: title, exact: true });
    await expect(workerRow.getByText("1,001", { exact: true })).toBeVisible();
    const afterCollected = await shopClient.query(api.stock.mine, {});
    expect(afterCollected).toEqual(beforeCollected);
    await shopClient.mutation(api.shop.setRate, {
      materialCode: "PAPER-NEWS",
      paisePerKg: 1,
    });
    await shopClient.mutation(api.shop.complete, {
      bookingId: booking.id,
      lines: [{ materialCode: "PAPER-NEWS", grams: 1000 }],
      method: "cash",
    });
    const afterReceipt = await shopClient.query(api.stock.mine, {}),
      jobsBefore = await shopClient.query(api.workforce.board, {}),
      receiptBefore = await homeClient.query(api.households.track, { token });
    expect(afterReceipt.totalGrams).toBe(beforeCollected.totalGrams + 1000);
    const jobBefore = jobsBefore.jobs.find((row) => row.id === jobId);
    if (!jobBefore) throw new Error("The local assigned job disappeared.");
    expect(jobBefore.employerPaidAt).toBeUndefined();
    expect(jobBefore.workerAcknowledgedAt).toBeUndefined();
    await owner.reload();
    const receivedPanel = await panel(owner),
      received = receivedPanel.getByRole("article", {
        name: title,
        exact: true,
      });
    await expect(received.getByText("1,001", { exact: true })).toBeVisible();
    await expect(received.getByText("1,000", { exact: true })).toBeVisible();
    await expect(received.getByText("-1", { exact: true })).toBeVisible();
    const ack = received.getByRole("form", {
      name: en.workerHandover.acknowledge,
      exact: true,
    });
    await expect(
      ack.getByRole("button", {
        name: en.workerHandover.acknowledge,
        exact: true,
      }),
    ).toBeDisabled();
    await ack
      .getByLabel(en.workerHandover.reason, { exact: true })
      .fill("Synthetic one-gram scale difference");
    await ack
      .getByRole("button", { name: en.workerHandover.acknowledge, exact: true })
      .click();
    await expect(
      received.getByText(en.workerHandover.acknowledged, { exact: false }),
    ).toBeVisible();
    await owner.reload();
    const persistedPanel = await panel(owner),
      persisted = persistedPanel.getByRole("article", {
        name: title,
        exact: true,
      });
    await expect(
      persisted.getByText(en.workerHandover.acknowledged, { exact: false }),
    ).toBeVisible();
    await expect(
      persisted.getByRole("form", {
        name: en.workerHandover.acknowledge,
        exact: true,
      }),
    ).toHaveCount(0);
    await collector.reload();
    const confirmedPanel = await panel(collector),
      confirmed = confirmedPanel.getByRole("article", {
        name: title,
        exact: true,
      });
    await expect(
      confirmed.getByText(en.workerHandover.acknowledged, { exact: false }),
    ).toBeVisible();
    const afterHandover = await shopClient.query(api.stock.mine, {}),
      jobsAfter = await shopClient.query(api.workforce.board, {}),
      receiptAfter = await homeClient.query(api.households.track, { token });
    expect(afterHandover).toEqual(afterReceipt);
    expect(jobsAfter.jobs.find((row) => row.id === jobId)).toEqual(jobBefore);
    expect(receiptAfter?.receipt).toEqual(receiptBefore?.receipt);
    const final = await shopClient.query(api.workerHandovers.employerBoard, {}),
      handover = final.rows.find(
        (row) => row.jobId === jobId && row.bookingId === booking.id,
      );
    if (!handover)
      throw new Error("The local source link disappeared after reload.");
    expect(handover.collectedGrams).toBe(1001);
    expect(handover.receivedGrams).toBe(1000);
    expect(handover.varianceGrams).toBe(-1);
    expect(handover.acknowledgedAt).not.toBeNull();
    // Finish the actual test job only after checking that handover left pay and job state unchanged.
    await workerClient.mutation(api.saathi.finish, { jobId });
  } finally {
    await employer.close();
    await worker.close();
    await household.close();
  }
});
