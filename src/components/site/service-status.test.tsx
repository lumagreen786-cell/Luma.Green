import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, expect, it, vi } from "vitest";

import messages from "../../../messages/en.json";
import { ServiceStatus } from "./service-status";

vi.mock("@/lib/env", () => ({
  clientEnv: { NEXT_PUBLIC_CONVEX_SITE_URL: "https://test.convex.site" },
}));
afterEach(() => vi.unstubAllGlobals());
function renderStatus() {
  return render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <ServiceStatus />
    </NextIntlClientProvider>,
  );
}
it("reports provider acceptance without claiming handset delivery", async () => {
  const snapshot = {
    api: "up",
    sms: "accepted",
    observedAt: Date.now(),
    checkedAt: Date.now(),
  };
  const fetch = vi.fn().mockResolvedValue(Response.json(snapshot));
  vi.stubGlobal("fetch", fetch);
  renderStatus();
  expect(await screen.findByText("Provider accepted")).toBeVisible();
  expect(screen.getByText(/does not confirm phone delivery/)).toBeVisible();
});
it("clears healthy evidence on a failed refresh", async () => {
  const user = userEvent.setup();
  const fetch = vi
    .fn()
    .mockResolvedValueOnce(
      Response.json({
        api: "up",
        sms: "accepted",
        observedAt: Date.now(),
        checkedAt: Date.now(),
      }),
    )
    .mockRejectedValue(new Error("Offline"));
  vi.stubGlobal("fetch", fetch);
  renderStatus();
  expect(await screen.findByText("Provider accepted")).toBeVisible();
  await user.click(screen.getByRole("button", { name: "Check again" }));
  await waitFor(() =>
    expect(screen.getByText("Cannot reach service")).toBeVisible(),
  );
  expect(screen.queryByText("Provider accepted")).not.toBeInTheDocument();
  expect(screen.getByText("Not verified")).toBeVisible();
});
