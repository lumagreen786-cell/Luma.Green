import { expect, test } from "@playwright/test";

for (const locale of ["en", "ar"]) {
  test(`${locale} public artwork loads without the image optimizer`, async ({
    page,
  }) => {
    // Keep the conversation's photo mounted while checking image delivery.
    await page.emulateMedia({ reducedMotion: "reduce" });
    const optimizerRequests: string[] = [];
    await page.route("**/_next/image?**", async (route) => {
      optimizerRequests.push(route.request().url());
      await route.fulfill({
        status: 402,
        body: "OPTIMIZED_IMAGE_REQUEST_PAYMENT_REQUIRED",
      });
    });

    for (const path of ["", "/participants"]) {
      await page.goto(`/${locale}${path}`);
      const images = page.getByRole("main").locator("img");
      expect(await images.count()).toBeGreaterThan(0);
      const imageElements = await images.all();
      for (const image of imageElements) {
        await image.scrollIntoViewIfNeeded();
        await expect
          .poll(() =>
            image.evaluate(
              (element: HTMLImageElement) =>
                element.complete && element.naturalWidth > 0,
            ),
          )
          .toBe(true);
      }
    }
    expect(optimizerRequests).toEqual([]);
  });
}
