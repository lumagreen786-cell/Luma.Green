import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { beforeEach, expect, it, vi } from "vitest";

import type { Id } from "../../../convex/_generated/dataModel";
import messages from "../../../messages/en.json";
import { BusinessForm } from "./business-form";
import { SaathiForm } from "./saathi-form";
import type * as AutosaveModule from "./use-autosave";
import type { Application } from "./use-mine";

const { save, verify } = vi.hoisted(() => ({ save: vi.fn(), verify: vi.fn() }));
vi.mock("convex/react", () => ({
  useMutation: () => save,
  useAction: () => verify,
}));
vi.mock("@/i18n/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock("./use-autosave", async (original) => ({
  ...(await original<typeof AutosaveModule>()),
  useAutosave: () => "saved",
}));
beforeEach(() => {
  vi.clearAllMocks();
  save.mockResolvedValue(null);
  verify.mockResolvedValue(null);
});

it.each(["yard", "recycler", "manufacturer"] as const)(
  "always displays required GST for %s even on an old unregistered draft",
  async (kind) => {
    const application = {
      id: "example-app" as Id<"applications">,
      kind,
      business: {
        gstRegistered: false,
        businessName: "Demo business",
        materials: ["paper"],
        address: "Demo street",
        collectsFromSuppliers: true,
      },
      files: [],
    } as unknown as Application;
    render(
      <NextIntlClientProvider locale="en" messages={messages}>
        <BusinessForm
          kind={kind}
          application={application}
          loginPhone={undefined}
        />
      </NextIntlClientProvider>,
    );
    expect(
      screen.getByRole("textbox", {
        name: messages.join.form.gstin,
      }),
    ).toBeVisible();
    fireEvent.click(
      screen.getByRole("button", { name: messages.auth.continue }),
    );
    await waitFor(() => {
      expect(
        screen.getByRole("textbox", {
          name: messages.join.form.gstin,
        }),
      ).toHaveAttribute("aria-invalid", "true");
    });
    expect(
      screen.queryByText(messages.join.form.gstQuestion),
    ).not.toBeInTheDocument();
  },
);

it("lets a Saathi omit PAN and checks a supplied normalized PAN only after explicit consent", async () => {
  const application = {
    id: "example-app" as Id<"applications">,
    kind: "saathi",
    saathi: {},
    files: [],
  } as unknown as Application;
  render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <SaathiForm application={application} />
    </NextIntlClientProvider>,
  );
  expect(
    screen.queryByRole("button", { name: messages.join.identity.check }),
  ).not.toBeInTheDocument();
  const pan = screen.getByRole("textbox", { name: messages.join.identity.pan });
  fireEvent.change(pan, { target: { value: "abcde1234f" } });
  expect(verify).not.toHaveBeenCalled();
  fireEvent.click(
    screen.getByRole("button", { name: messages.join.identity.check }),
  );
  await waitFor(() => {
    expect(save).toHaveBeenCalledWith({
      saathi: expect.objectContaining({ pan: "ABCDE1234F" }),
    });
  });
  expect(verify).toHaveBeenCalledExactlyOnceWith({
    applicationId: application.id,
    consent: true,
  });
  expect(
    await screen.findByText(messages.join.identity.verified),
  ).toBeVisible();
  expect(
    screen.queryByRole("textbox", {
      name: messages.join.form.gstin,
    }),
  ).not.toBeInTheDocument();
});
