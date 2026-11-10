import { expect, test } from "@playwright/test";

import ar from "../messages/ar.json";
import en from "../messages/en.json";

for (const { prefix, messages } of [
  { prefix: "", messages: en },
  { prefix: "/ar", messages: ar },
]) {
  test(`phone sign-in shows its privacy notice before sending a code ${prefix || "/"}`, async ({
    page,
  }) => {
    await page.goto(`${prefix}/login`);
    const form = page.locator("form").filter({
      has: page.getByLabel(messages.auth.mobileLabel),
    });
    await expect(
      form.getByText(messages.collectionPrivacy.phone),
    ).toBeVisible();
    await expect(
      form.getByRole("checkbox", { name: messages.join.consent.age }),
    ).not.toBeChecked();
    await form.getByRole("link", { name: messages.privacy.title }).click();
    await expect(
      page.getByRole("heading", { name: messages.privacy.title, exact: true }),
    ).toBeVisible();
  });
}
