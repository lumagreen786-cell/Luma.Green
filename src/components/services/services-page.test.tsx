import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { getFunctionName } from "convex/server";
import { NextIntlClientProvider } from "next-intl";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useSignedInQuery } from "@/components/providers/use-signed-in-query";

import type { Id } from "../../../convex/_generated/dataModel";
import arabic from "../../../messages/ar.json";
import messages from "../../../messages/en.json";
import { ServicesPage } from "./services-page";
const { create, update } = vi.hoisted(() => ({
  create: vi.fn(),
  update: vi.fn(),
}));
vi.mock("@/components/providers/use-signed-in-query", () => ({
  useSignedInQuery: vi.fn(),
}));
vi.mock("convex/react", () => ({
  useMutation: (reference: Parameters<typeof getFunctionName>[0]) =>
    getFunctionName(reference) === "services:createEnquiry" ? create : update,
}));
beforeEach(() => {
  create.mockReset().mockResolvedValue("test-enquiry");
  update.mockReset().mockResolvedValue(null);
  vi.mocked(useSignedInQuery).mockReturnValue({
    orgId: null,
    canCreate: true,
    enquiries: [],
    received: [],
    programmes: [],
    reports: [],
    recipients: [],
    lots: [],
  });
});
function page(locale = "en") {
  return render(
    <NextIntlClientProvider
      locale={locale}
      messages={locale === "ar" ? arabic : messages}
    >
      <ServicesPage />
    </NextIntlClientProvider>,
  );
}
describe("service records page", () => {
  it("clears unsaved scoped details on workspace change and removes forms when write access ends", async () => {
    const board = {
      orgId: "scope-one" as Id<"orgs">,
      canCreate: true,
      enquiries: [],
      received: [],
      programmes: [],
      reports: [],
      recipients: [],
      lots: [],
    };
    vi.mocked(useSignedInQuery).mockReturnValue(board);
    const view = page();
    const user = userEvent.setup();
    await user.type(
      screen.getByLabelText(messages.help.contact.message),
      "Private details for scope one",
    );
    const next = { ...board, orgId: "scope-two" as Id<"orgs"> };
    vi.mocked(useSignedInQuery).mockReturnValue(next);
    view.rerender(
      <NextIntlClientProvider locale="en" messages={messages}>
        <ServicesPage />
      </NextIntlClientProvider>,
    );
    expect(screen.getByLabelText(messages.help.contact.message)).toHaveValue(
      "",
    );
    vi.mocked(useSignedInQuery).mockReturnValue({ ...next, canCreate: false });
    view.rerender(
      <NextIntlClientProvider locale="en" messages={messages}>
        <ServicesPage />
      </NextIntlClientProvider>,
    );
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
  });
  it("shows scoped records without create, edit, share or revoke controls when access is read-only", () => {
    vi.mocked(useSignedInQuery).mockReturnValue({
      orgId: "test-org" as Id<"orgs">,
      canCreate: false,
      enquiries: [
        {
          id: "test-enquiry" as Id<"serviceEnquiries">,
          orgId: "test-org" as Id<"orgs">,
          commercialModel: "partner_service",
          paymentDirection: "not_applicable",
          principalParty: "",
          kind: "equipment",
          title: "Saved equipment enquiry",
          details: "Private details remain readable to their creator",
          state: "draft",
          version: 1,
          canEdit: false,
          providerStatus: "unavailable",
          recipientId: "test-recipient" as Id<"stakeholderAccounts">,
        },
      ],
      received: [],
      programmes: [
        {
          id: "test-programme" as Id<"programmeRecords">,
          title: "Saved reported collection",
          evidenceReference: "Private source reference",
          area: "Sample area",
          startsOn: "2026-10-01",
          endsOn: "2026-10-31",
          stream: "Dry recyclables",
          coverageCount: 1,
          trips: 1,
          centreHandovers: 1,
          quantityGrams: 1000,
          groupIncomePaise: 100,
          sourceQuality: "reported_unverified",
          state: "draft",
          version: 1,
          canEdit: false,
        },
      ],
      reports: [],
      recipients: [],
      lots: [],
    });
    page();
    expect(screen.getByText("Saved equipment enquiry")).toBeVisible();
    expect(screen.getByText("Saved reported collection")).toBeVisible();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
  });
  it("sends a chosen enquiry without presenting a confirmed provider service", async () => {
    page();
    const user = userEvent.setup();
    await user.type(
      screen.getAllByLabelText(messages.serviceRecords.recordName)[0],
      "Equipment repair request",
    );
    await user.type(
      screen.getByLabelText(messages.help.contact.message),
      "Please discuss a machine inspection",
    );
    await user.click(screen.getByRole("button", { name: "Send message" }));
    await waitFor(() => {
      expect(create).toHaveBeenCalledWith(
        expect.objectContaining({
          title: "Equipment repair request",
          details: "Please discuss a machine inspection",
          submit: true,
        }),
      );
    });
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: "equipment",
        commercialModel: "partner_service",
        shareMaterialLotReference: false,
      }),
    );
    expect(screen.getByText(messages.serviceRecords.unavailable)).toBeVisible();
  });
  it("keeps entered private details when creation fails", async () => {
    create.mockRejectedValueOnce(new Error("unavailable"));
    page();
    const user = userEvent.setup();
    await user.type(
      screen.getAllByLabelText(messages.serviceRecords.recordName)[0],
      "Finance referral",
    );
    await user.type(
      screen.getByLabelText(messages.help.contact.message),
      "Keep these referral details",
    );
    await user.click(screen.getAllByRole("button", { name: "Save" })[0]);
    await waitFor(() => {
      expect(create).toHaveBeenCalledOnce();
    });
    expect(screen.getByLabelText(messages.help.contact.message)).toHaveValue(
      "Keep these referral details",
    );
  });
  it("keeps service choices right to left in Arabic", () => {
    page("ar");
    const choices = screen.getAllByRole("combobox");
    expect(choices[0]).toHaveAttribute("dir", "rtl");
    expect(screen.getByText(arabic.serviceRecords.unavailable)).toBeVisible();
  });
});
