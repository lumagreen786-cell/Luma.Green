import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NextIntlClientProvider } from "next-intl";
import { expect, it, vi } from "vitest";

import messages from "../../../messages/en.json";
import { KabadiwalaForm } from "./kabadiwala-form";
import type * as AutosaveModule from "./use-autosave";
import type { Application } from "./use-mine";

const calls = vi.hoisted(() => ({
  mutate: vi.fn().mockResolvedValue(undefined),
  push: vi.fn(),
}));
vi.mock("convex/react", () => ({
  useMutation: () => calls.mutate,
  useAction: () => calls.mutate,
}));
vi.mock("@/i18n/navigation", () => ({
  useRouter: () => ({ push: calls.push }),
}));
vi.mock("./use-autosave", async (original) => ({
  ...(await original<typeof AutosaveModule>()),
  useAutosave: () => "saved",
}));

it("validates each shop stage and sends the complete retained application only at the end", async () => {
  const application = { kabadiwala: {}, files: [] } as unknown as Application;
  render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <KabadiwalaForm application={application} loginPhone={undefined} />
    </NextIntlClientProvider>,
  );
  await userEvent.click(screen.getByRole("button", { name: "Continue" }));
  expect(screen.getByLabelText("Your name")).toBeVisible();
  expect(calls.mutate).not.toHaveBeenCalled();
  fireEvent.change(screen.getByLabelText("Your name"), {
    target: { value: "Demo owner" },
  });
  fireEvent.change(screen.getByLabelText("Shop name"), {
    target: { value: "Demo shop" },
  });
  await userEvent.click(screen.getByRole("radio", { name: "No" }));
  await userEvent.click(screen.getByRole("button", { name: "Continue" }));
  expect(
    await screen.findByRole("heading", { name: "Shop address" }),
  ).toBeVisible();
  await userEvent.click(screen.getByRole("button", { name: "Continue" }));
  expect(screen.getByLabelText("Shop address")).toBeVisible();
  fireEvent.change(screen.getByLabelText("Shop address"), {
    target: { value: "123 Demo street Bengaluru" },
  });
  await userEvent.click(screen.getByRole("button", { name: "Continue" }));
  await userEvent.click(screen.getByRole("radio", { name: "No" }));
  await userEvent.click(
    screen.getByRole("button", { name: "Send for verification" }),
  );
  expect(calls.mutate).toHaveBeenNthCalledWith(1, {
    kabadiwala: expect.objectContaining({
      ownerName: "Demo owner",
      shopName: "Demo shop",
      address: "123 Demo street Bengaluru",
      gstRegistered: false,
      offersPickup: false,
    }),
  });
  expect(calls.mutate).toHaveBeenNthCalledWith(2, {});
  expect(calls.push).toHaveBeenCalledWith("/join/status");
});
