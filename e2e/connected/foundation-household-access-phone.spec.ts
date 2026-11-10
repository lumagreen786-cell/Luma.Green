import { randomUUID } from "node:crypto";

import { expect, test } from "@playwright/test";

import { api } from "../../convex/_generated/api";
import { shiftDate } from "../../convex/lib/dates";
import { indiaToday } from "../../convex/lib/onboarding";
import ar from "../../messages/ar.json" with { type: "json" };
import en from "../../messages/en.json" with { type: "json" };
import { actor, clientFor } from "./phone-fixture";

test("family can follow shared progress after reload and loses access after revocation", async ({
  browser,
}) => {
  const owner = await actor(browser, "household");
  const member = await actor(browser, "applicant");
  const shop = await actor(browser, "kabadiwala");
  try {
    const ownerClient = await clientFor(owner);
    const memberClient = await clientFor(member);
    const shopClient = await clientFor(shop);
    const person = await memberClient.query(api.identity.me, {});
    const memberPhone = person?.phone;
    const scope = await shopClient.query(api.workspace.mine, {});
    if (!memberPhone || scope?.kind !== "org")
      throw new Error("Local household personas are unavailable.");
    const orgId = scope.org.id;
    const date = shiftDate(indiaToday(), 1);
    const capacity = await shopClient.query(
      api.collectionScheduling.availability,
      { orgId, date },
    );
    const slot = capacity.find((row) => row.remaining > 0);
    if (!slot) throw new Error("No collection capacity in the local fixture.");
    const token = await ownerClient.mutation(api.households.book, {
      orgId,
      items: [],
      mode: "pickup",
      adultConfirmed: true,
      operationKey: randomUUID(),
      slotDate: date,
      slotWindow: slot.window,
      name: "Synthetic family test",
      address: "Synthetic family collection, Bengaluru",
    });
    const home = await owner.newPage();
    const relative = await member.newPage();
    await home.goto(`/t/${token}`);
    await home
      .getByRole("button", { name: en.householdFamily.share, exact: true })
      .click();
    await expect(
      home.getByRole("button", {
        name: en.householdFamily.makePrivate,
        exact: true,
      }),
    ).toBeVisible();

    await relative.goto(`/t/${token}`);
    await expect(
      relative
        .getByRole("heading", { name: en.track.notFound.title, exact: true })
        .last(),
    ).toBeVisible();
    await home.goto("/sell/settings");
    const invites = home.getByRole("region", {
      name: en.householdFamily.title,
      exact: true,
    });
    await invites
      .getByRole("textbox", { name: en.householdFamily.phone, exact: true })
      .fill(memberPhone);
    await invites
      .getByRole("checkbox", { name: en.join.consent.age })
      .first()
      .check();
    await invites
      .getByRole("button", { name: en.householdFamily.invite, exact: true })
      .click();
    const issued = invites.locator("#created-family-code");
    await expect(issued).toBeVisible();
    const code = await issued.inputValue();

    await relative.goto("/sell/settings");
    const family = relative.getByRole("region", {
      name: en.householdFamily.title,
      exact: true,
    });
    const codeField = family.getByRole("textbox", {
      name: en.householdFamily.code,
      exact: true,
    });
    const join = family.getByRole("button", {
      name: en.householdFamily.join,
      exact: true,
    });
    await codeField.fill("0".repeat(64));
    await family
      .getByRole("checkbox", { name: en.join.consent.age })
      .last()
      .check();
    await join.click();
    await expect(family.getByRole("alert")).toHaveText(
      en.householdFamily.invalid,
    );
    await codeField.fill(code);
    await join.click();
    await expect(
      family.getByRole("button", {
        name: en.householdFamily.leave,
        exact: true,
      }),
    ).toBeVisible();
    await relative.goto("/sell/activity");
    const shared = relative.getByRole("region", {
      name: en.householdFamily.collections,
    });
    await shared.getByRole("link").click();
    await expect(relative).toHaveURL(new RegExp(`/t/${token}$`));
    await relative.reload();
    await expect(
      relative.getByRole("heading", {
        name: en.track.status.requested,
        exact: true,
      }),
    ).toBeVisible();
    await expect(
      relative.getByRole("heading", {
        name: en.track.review.title,
        exact: true,
      }),
    ).toHaveCount(0);

    await invites
      .getByRole("button", { name: en.track.review.revoke, exact: true })
      .click();
    await expect(
      relative
        .getByRole("heading", { name: en.track.notFound.title, exact: true })
        .last(),
    ).toBeVisible();
    await ownerClient.mutation(api.households.cancel, { token });
  } finally {
    await Promise.all([owner.close(), member.close(), shop.close()]);
  }
});

test("a missing apartment route gives an Arabic household a manual path", async ({
  browser,
}) => {
  const home = await actor(browser, "household");
  try {
    const page = await home.newPage();
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/ar/sell");
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
    await page.getByRole("checkbox", { name: ar.join.consent.age }).check();
    await page
      .getByRole("textbox", { name: ar.join.form.city, exact: true })
      .fill("Bengaluru");
    await page
      .getByRole("checkbox", {
        name: ar.apartmentCollection.pickup,
        exact: true,
      })
      .check();
    await page
      .getByRole("textbox", { name: ar.apartmentCollection.code, exact: true })
      .fill("UNREVIEWED-LOCAL");
    await page
      .getByRole("textbox", { name: ar.sell.when.nameLabel })
      .fill("ساكن محلي");
    await page
      .getByRole("textbox", { name: ar.sell.when.addressLabel })
      .fill("عنوان تجريبي في بنغالور");
    await page
      .getByRole("button", { name: ar.sell.simple.next, exact: true })
      .click();
    await expect(
      page.getByText(ar.apartmentCollection.noRoute, { exact: true }),
    ).toBeVisible();
    await expect(
      page
        .getByRole("main")
        .getByRole("link", { name: ar.nav.contact, exact: true }),
    ).toHaveAttribute("href", "/ar/contact");
    await expect(
      page.getByRole("button", { name: ar.sell.simple.confirm, exact: true }),
    ).toHaveCount(0);
  } finally {
    await home.close();
  }
});
