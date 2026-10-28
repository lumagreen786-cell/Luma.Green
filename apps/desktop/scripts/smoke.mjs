import assert from "node:assert/strict";
import { mkdtemp, realpath, rm } from "node:fs/promises";
import http from "node:http";
import os from "node:os";
import { fileURLToPath } from "node:url";

import { _electron as electron, expect } from "@playwright/test";

const directory = fileURLToPath(new URL("../", import.meta.url));
const userData = await mkdtemp(`${os.tmpdir()}/luma-desktop-smoke-`);
const requests = { hasSlowRequest: false };
const server = http.createServer((request, response) => {
  if (request.url === "/slow") {
    requests.hasSlowRequest = true;
    // Leave this response pending until the next app navigation cancels it.
    return;
  }
  response.setHeader("content-type", "text/html");
  response.end(
    "<!doctype html><html><body><h1>Desktop fixture</h1><a href=\"/ar\">Arabic</a><a href=\"javascript:window.open('file:///etc/passwd')\">Blocked popup</a><button onclick=\"window.open(window.URL.createObjectURL(new Blob([atob('JVBERi0xLjQKMSAwIG9iago8PCAvVHlwZSAvQ2F0YWxvZyAvUGFnZXMgMiAwIFIgPj4KZW5kb2JqCjIgMCBvYmoKPDwgL1R5cGUgL1BhZ2VzIC9Db3VudCAxIC9LaWRzIFszIDAgUl0gPj4KZW5kb2JqCjMgMCBvYmoKPDwgL1R5cGUgL1BhZ2UgL1BhcmVudCAyIDAgUiAvTWVkaWFCb3ggWzAgMCAyMDAgMjAwXSAvQ29udGVudHMgNCAwIFIgPj4KZW5kb2JqCjQgMCBvYmoKPDwgL0xlbmd0aCAwID4+CnN0cmVhbQoKZW5kc3RyZWFtCmVuZG9iagp4cmVmCjAgNQowMDAwMDAwMDAwIDY1NTM1IGYgCjAwMDAwMDAwMDkgMDAwMDAgbiAKMDAwMDAwMDA1OCAwMDAwMCBuIAowMDAwMDAwMTE1IDAwMDAwIG4gCjAwMDAwMDAyMDIgMDAwMDAgbiAKdHJhaWxlcgo8PCAvU2l6ZSA1IC9Sb290IDEgMCBSID4+CnN0YXJ0eHJlZgoyNTEKJSVFT0YK')], {type: 'application/pdf'})), '_blank', 'noopener,noreferrer')\">Document</button></body></html>",
  );
});
await new Promise((resolve, reject) => {
  server.once("error", reject);
  server.listen(0, "127.0.0.1", () => resolve(true));
});
const address = server.address();
assert.ok(address && typeof address !== "string");
const origin = `http://127.0.0.1:${address.port}`;
const application = await electron.launch({
  timeout: 15_000,
  args: [directory, `--user-data-dir=${userData}`],
  env: { ...process.env, DESKTOP_DEV_ORIGIN: origin },
});
const deadline = setTimeout(() => {
  console.error("Desktop smoke exceeded its 60-second deadline.");
  application.process().kill("SIGKILL");
  server.closeAllConnections();
  server.close();
  process.exitCode = 1;
}, 60_000);
application.process().stderr?.on("data", (chunk) => {
  process.stderr.write(chunk);
});
try {
  assert.equal(
    await application.evaluate(({ app }) => app.getPath("userData")),
    await realpath(userData),
  );
  let page = await application.firstWindow();
  page.on("pageerror", (error) => {
    console.error(error);
  });
  await page.getByRole("heading", { name: "Desktop fixture" }).waitFor();
  // eslint-disable-next-line sonarjs/assertions-in-test-cases -- This executable verifies the real Electron update command boundary.
  await expect
    .poll(() =>
      page.evaluate(() => Reflect.get(window, "lumaAppUpdates")?.getState()),
    )
    .toBe("unavailable");
  await page.evaluate(() => {
    Reflect.get(window, "lumaAppUpdates").request("check");
  });
  // eslint-disable-next-line sonarjs/assertions-in-test-cases -- This executable verifies the real Electron update command boundary.
  await expect(page).toHaveURL(origin + "/");
  await page.evaluate(() => {
    Reflect.get(window, "lumaAppUpdates").request("restart");
  });
  // eslint-disable-next-line sonarjs/assertions-in-test-cases -- This executable verifies the real Electron update command boundary.
  await expect
    .poll(() =>
      page.evaluate(() => Reflect.get(window, "lumaAppUpdates")?.getState()),
    )
    .toBe("blocked");
  await page.evaluate(() => {
    Reflect.get(window, "lumaAppUpdates").request("status");
  });
  // eslint-disable-next-line sonarjs/assertions-in-test-cases -- The real host must process the bounded command without navigation.
  await expect
    .poll(() =>
      page.evaluate(() => Reflect.get(window, "lumaAppUpdates")?.getState()),
    )
    .toBe("unavailable");
  assert.equal(application.windows().length, 1);
  assert.equal(
    await page.evaluate(() => typeof Reflect.get(window, "require")),
    "undefined",
  );
  assert.equal(
    await page.evaluate(() => typeof Reflect.get(window, "process")),
    "undefined",
  );
  await page.evaluate(() => {
    window.open("/slow");
  });
  // eslint-disable-next-line sonarjs/assertions-in-test-cases -- Verify a real pending request before superseding it.
  await expect.poll(() => requests.hasSlowRequest).toBe(true);
  // Renderer evaluation waits for a pending navigation. Use the real Home
  // menu action to supersede that request from the main process instead.
  await Promise.all([
    page.waitForEvent("load"),
    application.evaluate(({ Menu }) => {
      const home = Menu.getApplicationMenu()
        ?.items.flatMap((item) => item.submenu?.items ?? [])
        .find((item) => item.accelerator === "CmdOrCtrl+Home");
      if (!home) throw new Error("Home menu action is missing");
      home.click();
    }),
  ]);
  // eslint-disable-next-line sonarjs/assertions-in-test-cases -- The prior cancelled request must not replace this page with offline HTML.
  await expect(page).toHaveURL(`${origin}/`);
  await page.getByRole("heading", { name: "Desktop fixture" }).waitFor();
  await page.getByRole("link", { name: "Blocked popup" }).click();
  assert.equal(application.windows().length, 1);
  const popupPromise = application.waitForEvent("window");
  await page.getByRole("button", { name: "Document" }).click();
  const popup = await popupPromise;
  await popup.waitForURL(/^blob:/u);
  // eslint-disable-next-line sonarjs/assertions-in-test-cases -- This executable is the Electron end-to-end smoke test.
  await expect
    .poll(() =>
      popup
        .frames()
        .some((frame) =>
          frame
            .url()
            .startsWith("chrome-extension://mhjfbmdgcfjbbpaeojofohoefgiehjai/"),
        ),
    )
    .toBe(true);
  assert.equal(
    await popup.evaluate(() => typeof Reflect.get(window, "require")),
    "undefined",
  );
  await page.close();
  assert.equal(popup.isClosed(), false);
  const reopenedPromise = application.waitForEvent("window", { timeout: 5000 });
  await application.evaluate(({ app }) => app.emit("activate"));
  page = await reopenedPromise;
  await page.getByRole("heading", { name: "Desktop fixture" }).waitFor();
  if (!popup.isClosed()) await popup.close();
  await page.getByRole("link", { name: "Arabic" }).click();
  await page.waitForURL(`${origin}/ar`);
  await new Promise((resolve, reject) => {
    server.close((error) => {
      if (error) reject(error);
      else resolve(true);
    });
  });
  try {
    await page.reload();
  } catch (error) {
    assert.ok(error instanceof Error);
  }
  await page.getByRole("link").waitFor();
  assert.equal(await page.locator("html").getAttribute("dir"), "rtl");
  assert.match(page.url(), /^data:/u);
  await new Promise((resolve) => {
    server.listen(address.port, "127.0.0.1", () => resolve(true));
  });
  await page.getByRole("link").click();
  await page.getByRole("heading", { name: "Desktop fixture" }).waitFor();
  assert.equal(page.url(), `${origin}/ar`);
  console.warn(
    "Desktop smoke passed: sandbox, cancelled navigation, blocked popup, blob preview, main-window restoration, Arabic offline screen and retry.",
  );
} finally {
  await application.close();
  server.close();
  await rm(userData, { recursive: true, force: true });
  clearTimeout(deadline);
}
