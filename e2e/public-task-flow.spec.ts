import { expect, test } from "@playwright/test";

import english from "../messages/en.json";

test("a phone visitor sees booking availability before supporting content", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/en");
  const hero = page.getByRole("main").locator("section").first();
  const action = hero.getByRole("button", {
    name: english.afterlife.bookNow,
    exact: true,
  });
  await expect(action).toBeInViewport();
  await expect(action).toBeDisabled();
  await expect(
    hero.getByText(english.afterlife.bookingUnavailable, { exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("dialog")).toHaveCount(0);
});

test("standards keep their boundary copy visible and reveal supporting rules on demand", async ({
  page,
}) => {
  await page.goto("/en/standards");
  const weighing = page.locator("details#weighing");
  await expect(weighing).not.toHaveAttribute("open", "");
  await expect(
    page.getByText(english.standards.weighing.body, { exact: true }),
  ).toBeVisible();
  await weighing.locator("summary").click();
  await expect(weighing).toHaveAttribute("open", "");
  await expect(
    weighing.getByText(english.standards.weighing.stamped.body, {
      exact: true,
    }),
  ).toBeVisible();
  await page.goto("/en/standards#custody");
  await expect(page.locator("details#custody")).toHaveAttribute("open", "");
});

test("guide readers can expand each instruction without losing the ordered steps", async ({
  page,
}) => {
  await page.goto("/en/help/household/first-pickup");
  const steps = page.locator('section[aria-labelledby="guide-steps"] details');
  await expect(steps.first()).toHaveAttribute("open", "");
  const last = steps.last();
  await expect(last).not.toHaveAttribute("open", "");
  await last.locator("summary").click();
  await expect(last).toHaveAttribute("open", "");
  await expect(last.locator("p")).toBeVisible();
});
