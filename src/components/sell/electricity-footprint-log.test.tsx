import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { beforeEach, expect, it, vi } from "vitest";

import en from "../../../messages/en.json";
import { ElectricityFootprintLog } from "./electricity-footprint-log";

const mocks = vi.hoisted(() => ({
  save: vi.fn(),
  remove: vi.fn(),
  authenticated: true,
}));
vi.mock("convex/react", () => ({
  useConvexAuth: () => ({ isAuthenticated: mocks.authenticated }),
  useQuery: () => [],
  useMutation: () => mocks.save,
}));
vi.mock("@/components/providers/convex-provider", () => ({
  isConvexConfigured: true,
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
beforeEach(() => {
  vi.clearAllMocks();
  mocks.authenticated = true;
});

function show(reading = "10.501") {
  return render(
    <NextIntlClientProvider locale="en" messages={en} timeZone="Asia/Kolkata">
      <ElectricityFootprintLog reading={reading} />
    </NextIntlClientProvider>,
  );
}

it("saves integer readings only after valid dates and explicit consent, with stable retry identity", async () => {
  show();
  const copy = en.householdTools.footprintLog;
  const save = screen.getByRole("button", { name: en.common.save });
  expect(save).toBeDisabled();
  fireEvent.change(screen.getByLabelText(copy.start), {
    target: { value: "2026-01-01" },
  });
  fireEvent.change(screen.getByLabelText(copy.end), {
    target: { value: "2026-01-31" },
  });
  expect(save).toBeDisabled();
  fireEvent.click(screen.getByRole("checkbox", { name: copy.consent }));
  fireEvent.click(save);
  await waitFor(() => {
    expect(mocks.save).toHaveBeenCalledTimes(1);
  });
  expect(mocks.save).toHaveBeenCalledWith(
    expect.objectContaining({
      wattHours: 10_501,
      periodStart: "2026-01-01",
      periodEnd: "2026-01-31",
      consent: true,
    }),
  );
  await waitFor(() => expect(save).toBeEnabled());
  fireEvent.click(save);
  await waitFor(() => {
    expect(mocks.save).toHaveBeenCalledTimes(2);
  });
  expect(mocks.save.mock.calls[0]).toEqual(mocks.save.mock.calls[1]);
});

it("offers sign-in without a storage form when signed out", () => {
  mocks.authenticated = false;
  show();
  expect(screen.getByText(en.householdTools.footprintLog.signIn)).toBeVisible();
  expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
});
