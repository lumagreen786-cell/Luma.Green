import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NextIntlClientProvider } from "next-intl";
import { expect, it, vi } from "vitest";

import arabic from "../../../messages/ar.json";
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
  useQuery: () => null,
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
  fireEvent.change(screen.getByLabelText(messages.join.form.city), {
    target: { value: "Bengaluru" },
  });
  fireEvent.change(screen.getByLabelText("Shop address"), {
    target: { value: "123 Demo street Bengaluru" },
  });
  await userEvent.click(screen.getByRole("button", { name: "Continue" }));
  await userEvent.click(screen.getByRole("radio", { name: "No" }));
  await userEvent.click(
    screen.getByRole("button", { name: messages.join.form.submit }),
  );
  expect(calls.mutate).toHaveBeenNthCalledWith(1, {
    kabadiwala: expect.objectContaining({
      ownerName: "Demo owner",
      shopName: "Demo shop",
      address: "123 Demo street Bengaluru",
      city: "Bengaluru",
      gstRegistered: false,
      offersPickup: false,
    }),
  });
  expect(calls.mutate).toHaveBeenNthCalledWith(2, {});
  expect(calls.push).toHaveBeenCalledWith("/app");
});

it("resumes at the incomplete address and keeps saved identity on Back", async () => {
  const application = {
    kabadiwala: {
      ownerName: "Saved owner",
      shopName: "Saved shop",
      gstRegistered: false,
    },
    files: [],
  } as unknown as Application;
  render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <KabadiwalaForm application={application} loginPhone={undefined} />
    </NextIntlClientProvider>,
  );
  expect(
    screen.getByRole("heading", { name: messages.join.kabadiwala.address }),
  ).toBeVisible();
  await userEvent.click(
    screen.getByRole("button", { name: messages.join.form.back }),
  );
  expect(screen.getByLabelText(messages.join.kabadiwala.ownerName)).toHaveValue(
    "Saved owner",
  );
  expect(screen.getByLabelText(messages.join.kabadiwala.shopName)).toHaveValue(
    "Saved shop",
  );
});

it.each([
  ["en", messages],
  ["ar", arabic],
] as const)(
  "retains city and state when moving between application stages in %s",
  async (locale, copy) => {
    const application = {
      kabadiwala: {
        ownerName: "Test owner",
        shopName: "Test shop",
        gstRegistered: false,
        city: "Bilaspur, Chhattisgarh",
        address: "Full test address",
      },
      files: [],
    } as unknown as Application;
    render(
      <NextIntlClientProvider locale={locale} messages={copy}>
        <KabadiwalaForm application={application} loginPhone={undefined} />
      </NextIntlClientProvider>,
    );
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: copy.join.form.back }));
    expect(
      screen.getByRole("textbox", { name: copy.join.form.city }),
    ).toHaveValue("Bilaspur");
    expect(
      screen.getByRole("combobox", { name: copy.join.form.stateUT }),
    ).toHaveTextContent("Chhattisgarh");
    await user.click(
      screen.getByRole("combobox", { name: copy.join.form.stateUT }),
    );
    await user.click(screen.getByRole("option", { name: "Himachal Pradesh" }));
    await user.click(screen.getByRole("button", { name: copy.auth.continue }));
    await user.click(screen.getByRole("button", { name: copy.join.form.back }));
    expect(
      screen.getByRole("textbox", { name: copy.join.form.city }),
    ).toHaveValue("Bilaspur");
    expect(
      screen.getByRole("combobox", { name: copy.join.form.stateUT }),
    ).toHaveTextContent("Himachal Pradesh");
    expect(screen.getByLabelText(copy.join.kabadiwala.address)).toHaveValue(
      "Full test address",
    );
  },
);
