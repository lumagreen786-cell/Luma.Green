import { expect, type Page, test } from "@playwright/test";

import en from "../messages/en.json";

// This stub implements the documented queue contract only. It does not prove
// privacy properties of the externally hosted Vercel runtime.
const script = `(() => {
  let beforeSend = event => event;
  function dispatch(command, options) {
    if (command === 'beforeSend') { beforeSend = options; return; }
    if (command !== 'pageview') return;
    const event = beforeSend({ type: 'pageview', url: new URL(options.path, location.origin).href });
    if (event) fetch('/_vercel/insights/view', { method: 'POST', body: JSON.stringify(event) });
  }
  const queue = window.vaq || [];
  window.va = dispatch;
  queue.forEach(args => dispatch(...args));
})();`;

async function localFirstParty(page: Page) {
  const views: string[] = [];
  const scripts: string[] = [];
  const errors: string[] = [];
  page.on("pageerror", (error) => {
    errors.push(error.message);
  });
  await page.route("**/*", async (route) => {
    const url = new URL(route.request().url());
    if (!["luma.green", "business.luma.green"].includes(url.hostname)) {
      await route.fulfill({
        status: 200,
        contentType: "application/javascript",
        body: "/* vendor blocked */",
      });
      return;
    }
    if (url.pathname === "/_vercel/insights/script.js") {
      scripts.push(url.href);
      await route.fulfill({
        status: 200,
        contentType: "application/javascript",
        body: script,
      });
      return;
    }
    if (url.pathname.startsWith("/_vercel/insights/")) {
      views.push(route.request().postData() ?? "");
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: "{}",
      });
      return;
    }
    const local = new URL(url.pathname + url.search, "http://localhost:3106");
    // Serve the same local route at each real origin to test the analytics
    // host boundary. Business-page rewrite acceptance is a separate route test.
    const response = await route.fetch({ url: local.href, maxRedirects: 0 });
    const headers = response.headers();
    const redirectLocation = Object.entries(headers).find(
      ([name]) => name === "location",
    )?.[1];
    if (redirectLocation?.startsWith("http://localhost:3106")) {
      headers.location = redirectLocation.replace(
        "http://localhost:3106",
        () => url.origin,
      );
    }
    await route.fulfill({ response, headers });
  });
  return { views, scripts, errors };
}

for (const host of ["luma.green", "business.luma.green"]) {
  test(`${host}: automatic views need no tap and opt-out persists`, async ({
    page,
  }) => {
    const observed = await localFirstParty(page);
    await page.goto(`https://${host}/`);
    await expect(
      page.getByRole("button", { name: en.analytics.accept }),
    ).toHaveCount(0);
    await expect.poll(() => observed.views.length).toBe(1);
    expect(observed.views.map((value) => JSON.parse(value) as unknown)).toEqual(
      [
        {
          type: "pageview",
          url: `https://${host}${host === "business.luma.green" ? "/business" : "/"}`,
        },
      ],
    );
    await page.getByRole("button", { name: en.analytics.settings }).click();
    await page.getByRole("button", { name: en.analytics.decline }).click();
    await expect(
      page.getByRole("button", { name: en.analytics.settings }),
    ).toBeVisible();
    await page.reload();
    await expect(
      page.getByRole("button", { name: en.analytics.settings }),
    ).toBeVisible();
    expect(observed.views).toHaveLength(1);
    expect(observed.scripts).toHaveLength(1);
    expect(observed.errors).toEqual([]);
  });
}

for (const scenario of [
  { path: "/login", referrer: undefined },
  { path: "/?phone=secret", referrer: undefined },
  { path: "/#secret", referrer: undefined },
  { path: "/", referrer: "https://external.invalid/private?secret=1" },
  { path: "/", referrer: "https://luma.green/login?secret=1" },
]) {
  test(`Vercel stays unloaded for ${scenario.path} from ${scenario.referrer ?? "direct"}`, async ({
    page,
  }) => {
    const observed = await localFirstParty(page);
    await page.addInitScript(() => {
      localStorage.setItem("luma.analytics.v1", "granted");
    });
    await page.goto(`https://luma.green${scenario.path}`, {
      referer: scenario.referrer,
    });
    await expect(page.getByRole("main")).toBeVisible();
    // Await hydration and the same asynchronous runtime used by consent changes.
    // Negative assertions must wait for lazy telemetry imports to settle.
    // eslint-disable-next-line playwright/no-networkidle
    await page.waitForLoadState("networkidle");
    expect(observed.scripts).toEqual([]);
    expect(observed.views).toEqual([]);
    expect(observed.errors).toEqual([]);
  });
}

test("attribution added after loading and private SPA navigation block delivery", async ({
  page,
}) => {
  const observed = await localFirstParty(page);
  await page.goto("https://luma.green/");
  await expect.poll(() => observed.views.length).toBe(1);
  await page.evaluate(() => {
    localStorage.setItem("__va_attribution", '{"userId":"private-id"}');
    window.va?.("pageview", { path: "/" });
  });
  expect(observed.views).toHaveLength(1);
  await page.evaluate(() => {
    localStorage.removeItem("__va_attribution");
    history.pushState({}, "", "/login");
    window.va?.("pageview", { path: "/login" });
  });
  expect(observed.views).toHaveLength(1);
  expect(observed.errors).toEqual([]);
});

test("stored attribution prevents loading the Vercel script", async ({
  page,
}) => {
  const observed = await localFirstParty(page);
  await page.addInitScript(() => {
    localStorage.setItem("__va_attribution", "{}");
  });
  await page.goto("https://luma.green/");
  await expect(
    page.getByRole("button", { name: en.analytics.settings }),
  ).toBeVisible();
  // Wait for lazy imports before asserting that the vendor remains unloaded.
  // eslint-disable-next-line playwright/no-networkidle
  await page.waitForLoadState("networkidle");
  expect(observed.scripts).toEqual([]);
  expect(observed.views).toEqual([]);
});
