import { expect, test } from "@playwright/test";

import en from "../messages/en.json" with { type: "json" };
import pt from "../messages/pt.json" with { type: "json" };

test("Portuguese and English tabs keep their own language despite a legacy shared cookie", async ({
  context,
  page: portuguese,
  baseURL,
}) => {
  test.setTimeout(60_000);
  expect(baseURL).toBeDefined();
  const cookieURL = baseURL ?? "http://localhost:3000";
  await context.addCookies([
    { name: "NEXT_LOCALE", value: "pt", url: cookieURL },
  ]);
  const english = await context.newPage();
  const errors: string[] = [];
  for (const page of [portuguese, english]) {
    page.on("pageerror", (error) => {
      errors.push(error.message);
    });
  }

  await portuguese.goto("/pt/help");
  await expect(portuguese.locator("html")).toHaveAttribute("lang", "pt");
  await expect(portuguese.getByRole("heading", { level: 1 })).toHaveText(
    pt.help.title,
  );
  await english.goto("/help");
  await expect(english).toHaveURL("/help");
  await expect(english.locator("html")).toHaveAttribute("lang", "en");
  await expect(english.getByRole("heading", { level: 1 })).toHaveText(
    en.help.title,
  );

  await english
    .getByRole("button", { name: `${en.common.language}: English` })
    .click();
  await english
    .getByRole("menuitemradio", { name: "Português", exact: true })
    .click();
  await expect(english).toHaveURL("/pt/help");
  await english
    .getByRole("button", { name: `${pt.common.language}: Português` })
    .click();
  await english
    .getByRole("menuitemradio", { name: "English", exact: true })
    .click();
  await expect(english).toHaveURL("/help");
  await expect(portuguese).toHaveURL("/pt/help");

  // Model a different tab retaining an older English cookie, then reload both.
  await context.addCookies([
    { name: "NEXT_LOCALE", value: "en", url: cookieURL },
  ]);
  await portuguese.reload();
  await expect(portuguese).toHaveURL("/pt/help");
  await expect(portuguese.locator("html")).toHaveAttribute("lang", "pt");
  await english.reload();
  await expect(english).toHaveURL("/help");
  await expect(english.locator("html")).toHaveAttribute("lang", "en");
  expect(errors).toEqual([]);
});
