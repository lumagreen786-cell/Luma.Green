import assert from "node:assert/strict";

import { expect, test } from "@playwright/test";

import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { indiaToday } from "../../convex/lib/onboarding";
import en from "../../messages/en.json" with { type: "json" };
import { actor, clientFor } from "./phone-fixture";

/** Existing authenticated loopback personas only; never sends an OTP or bypasses auth. */
test("keeps a consented electricity estimate after reload, private to its owner, until removal", async ({
  browser,
}) => {
  const owner = await actor(browser, "household");
  const other = await actor(browser, "applicant");
  const client = await clientFor(owner);
  let savedId: Id<"householdFootprints"> | undefined;
  try {
    const otherClient = await clientFor(other);
    const initial = await client.query(api.householdFootprints.mine, {});
    const before = new Set(initial.map((row) => row.id));
    const page = await owner.newPage();
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/sell/footprint");
    const copy = en.householdTools.footprintLog;
    await page
      .getByLabel(en.householdTools.electricityReading, { exact: true })
      .fill("14.237");
    const form = page
      .locator("form")
      .filter({ has: page.getByLabel(copy.start, { exact: true }) });
    const save = form.getByRole("button", {
      name: en.common.save,
      exact: true,
    });
    await expect(save).toBeDisabled();
    const today = indiaToday();
    await form.getByLabel(copy.start, { exact: true }).fill(today);
    await form.getByLabel(copy.end, { exact: true }).fill(today);
    await expect(save).toBeDisabled();
    await form
      .getByRole("checkbox", { name: copy.consent, exact: true })
      .check();
    await save.click();
    await expect
      .poll(async () => {
        const rows = await client.query(api.householdFootprints.mine, {});
        const row = rows.find((entry) => !before.has(entry.id));
        savedId = row?.id;
        return row?.milliGramsCO2;
      })
      .toBe(9_609_975);
    const id = savedId;
    assert.ok(id, "The saved estimate is unavailable.");
    const otherRows = await otherClient.query(api.householdFootprints.mine, {});
    expect(otherRows.some((row) => row.id === id)).toBe(false);
    await expect(
      otherClient.mutation(api.householdFootprints.remove, { id }),
    ).rejects.toThrow("FOOTPRINT_UNAVAILABLE");
    await page.reload();
    const entry = page.getByRole("listitem").filter({ hasText: "14.237" });
    await expect(entry).toHaveCount(1);
    await expect(
      entry.getByRole("link", {
        name: "CEA v22.0 FY2025-26 Table S",
        exact: true,
      }),
    ).toHaveAttribute(
      "href",
      "https://cea.nic.in/api/cdm-report-version/view-pdf/en/82",
    );
    await entry.getByRole("button", { name: copy.remove, exact: true }).click();
    await expect
      .poll(async () => {
        const rows = await client.query(api.householdFootprints.mine, {});
        return rows.some((row) => row.id === id);
      })
      .toBe(false);
    await page.reload();
    await expect(
      page.getByRole("listitem").filter({ hasText: "14.237" }),
    ).toHaveCount(0);
    savedId = undefined;
  } finally {
    // eslint-disable-next-line playwright/no-conditional-in-test -- Clean up only a record created before a failure.
    if (savedId)
      await client.mutation(api.householdFootprints.remove, { id: savedId });
    await Promise.all([owner.close(), other.close()]);
  }
});
