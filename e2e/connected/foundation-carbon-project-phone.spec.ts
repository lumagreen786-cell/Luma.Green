import { readFile } from "node:fs/promises";

import { expect, test } from "@playwright/test";

import { api } from "../../convex/_generated/api";
import en from "../../messages/en.json" with { type: "json" };
import { actor, choose, clientFor } from "./phone-fixture";

test("local manufacturer prepares a carbon project while another workspace cannot read it", async ({
  browser,
}) => {
  const manufacturer = await actor(browser, "manufacturer");
  const preprocessor = await actor(browser, "preprocessor");
  try {
    const owner = await clientFor(manufacturer);
    const scope = await owner.query(api.workspace.mine, {});
    if (scope?.kind !== "org") throw new Error("Missing local manufacturer");

    const facilityName = "Synthetic PET processing facility";
    const facilities = await owner.query(api.industrialProfiles.mine, {});
    const hasFacility = facilities.some((entry) => entry.name === facilityName);
    // eslint-disable-next-line playwright/no-conditional-in-test -- Reuse the synthetic facility when this loopback test is repeated.
    if (!hasFacility) {
      await owner.mutation(api.industrialProfiles.save, {
        name: facilityName,
        siteReference: "Local fixture only",
        capabilities: ["washing"],
      });
    }

    const page = await manufacturer.newPage();
    await page.goto("/app/carbon-projects");
    await expect(
      page.getByRole("heading", { level: 1, name: en.carbonProjects.title }),
    ).toBeVisible();

    const projectName = `Synthetic PET preparation ${String(Date.now())}`;
    const projectForm = page.locator("form").filter({
      has: page.getByLabel(en.carbonProjects.name, { exact: true }),
    });
    await projectForm
      .getByLabel(en.carbonProjects.name, { exact: true })
      .fill(projectName);
    await choose(page, projectForm, en.lots.facility, facilityName);
    await choose(page, projectForm, en.carbonProjects.method, "Verra VMR0007");
    await projectForm
      .getByRole("button", { name: en.operations.save, exact: true })
      .click();

    const project = page.getByRole("listitem").filter({
      has: page.getByRole("heading", { name: projectName, exact: true }),
    });
    await expect(project).toBeVisible();
    const review = project.getByRole("button", {
      name: en.carbonProjects.review,
      exact: true,
    });
    await expect(review).toHaveCount(0);

    for (const kind of [
      "baseline",
      "monitoring",
      "claim_rights",
      "verification_report",
    ] as const) {
      const reference = `Synthetic local ${kind}`;
      await choose(
        page,
        project,
        en.evidence.kind,
        en.carbonProjects.kinds[kind],
      );
      await project
        .getByLabel(en.evidence.reference, { exact: true })
        .fill(reference);
      await project
        .getByRole("button", { name: en.evidence.record, exact: true })
        .click();
      await expect(project.getByText(reference, { exact: true })).toBeVisible();
    }

    await review.click();
    const status = project.getByText(
      `${en.carbonProjects.reviewed} · ${en.evidence.unverified}`,
      { exact: true },
    );
    await expect(status).toBeVisible();
    await page.reload();
    await expect(status).toBeVisible();
    await expect(
      project.getByText("Synthetic local claim_rights", { exact: true }),
    ).toBeVisible();

    const downloadPromise = page.waitForEvent("download");
    await project
      .getByRole("button", { name: en.evidence.export.download })
      .click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(
      /^luma-internal-carbon-review-\d+\.json$/u,
    );
    const snapshot: unknown = JSON.parse(
      await readFile(await download.path(), "utf8"),
    );
    expect(snapshot).toMatchObject({
      purpose: "internal_carbon_review",
      evidenceStatus: "reported_unverified",
      references: expect.arrayContaining([
        expect.objectContaining({
          kind: "claim_rights",
          reference: "Synthetic local claim_rights",
        }),
      ]),
    });

    const otherPage = await preprocessor.newPage();
    await otherPage.goto("/app/carbon-projects");
    await expect(
      otherPage.getByRole("heading", {
        level: 1,
        name: en.carbonProjects.title,
      }),
    ).toBeVisible();
    await expect(
      otherPage.getByText(en.lots.empty, { exact: true }),
    ).toBeVisible();
    await expect(otherPage.getByText(projectName, { exact: true })).toHaveCount(
      0,
    );

    const other = await clientFor(preprocessor);
    await expect(
      other.query(api.carbonProjects.mine, { expectedOrgId: scope.org.id }),
    ).rejects.toThrow(/EVIDENCE_SCOPE_CHANGED/);
  } finally {
    await manufacturer.close();
    await preprocessor.close();
  }
});
