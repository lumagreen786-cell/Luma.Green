import { expect, test } from "@playwright/test";

import arabic from "../messages/ar.json";
import english from "../messages/en.json";
import { slugFor } from "../src/components/help/content";

test.use({ javaScriptEnabled: false });

const pages = [
  {
    path: "/",
    title: english.afterlife.heroTitle + english.afterlife.heroTitleEnd,
    body: english.afterlife.heroLead,
    direction: "ltr",
  },
  {
    path: "/how-it-works",
    title: english.howItWorks.title,
    body: english.howItWorks.sell.body,
    direction: "ltr",
  },
  {
    path: "/ar/how-it-works",
    title: arabic.howItWorks.title,
    body: arabic.howItWorks.sell.body,
    direction: "rtl",
  },
  {
    path: "/prices",
    title: english.prices.title,
    body: english.prices.lead,
    direction: "ltr",
  },
  {
    path: `/help/household/${slugFor("firstPickup")}`,
    title: english.help.guides.firstPickup.title,
    body: english.help.guides.firstPickup.summary,
    direction: "ltr",
  },
];

for (const content of pages) {
  test(`${content.path} delivers public content before browser JavaScript`, async ({
    page,
  }) => {
    const response = await page.goto(content.path, {
      waitUntil: "domcontentloaded",
    });
    expect(response?.status()).toBe(200);
    await expect(page.locator("html")).toHaveAttribute(
      "dir",
      content.direction,
    );
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      content.title,
    );
    await expect(
      page.getByRole("main").getByText(content.body, { exact: true }),
    ).toBeVisible();
    const html = await response?.text();
    expect(html).toContain(content.body);
  });
}
