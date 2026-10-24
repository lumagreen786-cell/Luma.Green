import { fireEvent, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { beforeEach, expect, it, vi } from "vitest";

import type { Id } from "../../../convex/_generated/dataModel";
import messages from "../../../messages/en.json";
import { BusinessForm } from "./business-form";
import { SaathiForm } from "./saathi-form";
import type * as AutosaveModule from "./use-autosave";
import type { Application } from "./use-mine";

const { save, lookup } = vi.hoisted(() => ({ save: vi.fn(), lookup: vi.fn() }));
vi.mock("convex/react", () => ({
  useMutation: () => save,
  useAction: () => lookup,
  useQuery: () => null,
}));
vi.mock("@/i18n/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock("./use-autosave", async (original) => ({
  ...(await original<typeof AutosaveModule>()),
  useAutosave: () => "saved",
}));
const details = {
  gstin: "29ABCDE1234F1Z5",
  businessName: "Example recycling",
  legalName: "Example recycling limited",
  address: "Example registered street",
};
beforeEach(() => {
  vi.clearAllMocks();
  save.mockResolvedValue(null);
  lookup.mockResolvedValue(details);
});

it.each(["yard", "recycler", "manufacturer"] as const)(
  "unlocks %s only after GST lookup and explicit confirmation",
  async (kind) => {
    const application = {
      id: "example-app" as Id<"applications">,
      kind,
      business: { gstRegistered: false },
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
      screen.queryByRole("textbox", {
        name: messages.join.business.businessName,
      }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText(messages.join.form.gstQuestion),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByLabelText(messages.join.identity.pan),
    ).not.toBeInTheDocument();
    fireEvent.change(
      screen.getByRole("textbox", {
        name: messages.join.form.gstin,
      }),
      { target: { value: details.gstin } },
    );
    fireEvent.click(
      screen.getByRole("button", { name: messages.join.identity.check }),
    );
    expect(await screen.findByText(details.businessName)).toBeVisible();
    expect(
      screen.queryByRole("textbox", {
        name: messages.join.business.businessName,
      }),
    ).not.toBeInTheDocument();
    fireEvent.click(
      screen.getByRole("button", {
        name: messages.join.identity.confirm,
      }),
    );
    const name = await screen.findByRole("textbox", {
      name: messages.join.business.businessName,
    });
    expect(name).toHaveValue(details.businessName);
    expect(name).toHaveAttribute("readonly");
  },
);

it("keeps Saathi uploads and work fields while removing PAN and all paid identity checks", () => {
  const application = {
    id: "example-app" as Id<"applications">,
    kind: "saathi",
    saathi: {},
    files: [],
  } as unknown as Application;
  const { container } = render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <SaathiForm application={application} />
    </NextIntlClientProvider>,
  );
  expect(
    screen.queryByLabelText(messages.join.identity.pan),
  ).not.toBeInTheDocument();
  expect(container.querySelectorAll('input[type="file"]')).toHaveLength(2);
  expect(
    screen.getByRole("textbox", {
      name: messages.join.saathi.name,
    }),
  ).toBeVisible();
  expect(
    screen.queryByRole("button", { name: messages.join.identity.check }),
  ).not.toBeInTheDocument();
  expect(lookup).not.toHaveBeenCalled();
});
