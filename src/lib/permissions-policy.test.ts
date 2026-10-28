import { expect, it } from "vitest";

import config from "../../next.config";

it("limits browser device access while retaining same-origin foreground location", async () => {
  const routes = await config.headers?.();
  const value = routes
    ?.find((route) => route.source === "/:path*")
    ?.headers.find((header) => header.key === "Permissions-Policy")?.value;
  expect(value).toBeDefined();
  const directives = new Set(value?.split(", "));
  expect(directives).toContain("geolocation=(self)");
  for (const feature of [
    "camera",
    "microphone",
    "accelerometer",
    "gyroscope",
    "magnetometer",
    "display-capture",
    "usb",
    "serial",
    "hid",
    "clipboard-read",
  ])
    expect(directives).toContain(`${feature}=()`);
});
