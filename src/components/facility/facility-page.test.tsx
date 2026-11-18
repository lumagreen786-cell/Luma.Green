import { fireEvent, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useMutation, useQuery } from "convex/react";
import type { ReactNode } from "react";
import { beforeEach, expect, it, vi } from "vitest";

import { fakeQueries, renderWithIntl } from "@/components/shop/test-helpers";
import { WorkspacePermissions } from "@/components/workspace/permissions";

import en from "../../../messages/en.json";
import { FacilityPage } from "./facility-page";
import { IndustryExplorer } from "./industry-explorer";

const mocks = vi.hoisted(() => ({ role: "owner", save: vi.fn() }));
vi.mock("convex/react", () => ({ useQuery: vi.fn(), useMutation: vi.fn() }));
vi.mock("@/components/app/use-workspace", () => ({
  useWorkspace: () => ({ kind: "org", org: { id: "org-a" }, role: mocks.role }),
}));
vi.mock("@/i18n/navigation", () => ({
  Link: ({ children }: { children: ReactNode }) => <span>{children}</span>,
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
const facility = {
  _id: "facility-a",
  name: "Local wash line",
  siteReference: "Synthetic site",
  capabilities: ["washing"],
  createdAt: 1,
  updatedAt: 1,
};
const reference = {
  id: "cpcb-2025-row-2",
  title: "Original source sector",
  subtitle: "Original category",
  sheet: "Source",
  row: 2,
  details: [{ key: "category", value: "Reported source category" }],
};
const registration = {
  id: "reg-a",
  kind: "consent_to_operate",
  reference: "LOCAL-OLD",
  issuedAt: "2020-01-01",
  validUntil: "2021-01-01",
  dateStatus: "expired",
  supersededById: "reg-b",
  recordedAt: 1,
  sourceQuality: "reported_unverified",
};
function queries(extra: Record<string, unknown> = {}) {
  vi.mocked(useQuery).mockImplementation(
    fakeQueries({
      "industrialProfiles:mine": [facility],
      "industrialProfiles:registrations": {
        rows: [registration],
        hasMore: false,
      },
      "industryReference:search": {
        items: [reference],
        total: 30,
        nextOffset: 25,
        sourceQuality: "workbook_unverified",
        sourceLanguage: "en",
        sourceWorkbook: "Source",
      },
      ...extra,
    }) as unknown as typeof useQuery,
  );
}
beforeEach(() => {
  mocks.role = "owner";
  mocks.save.mockReset();
  mocks.save.mockResolvedValue("saved-id");
  vi.mocked(useMutation).mockReturnValue(
    mocks.save as unknown as ReturnType<typeof useMutation>,
  );
  queries();
});
function view(role: "owner" | "member" | "viewer" = "owner") {
  mocks.role = role;
  return renderWithIntl(
    <WorkspacePermissions membershipRole={role}>
      <FacilityPage />
    </WorkspacePermissions>,
  );
}

it("keeps facility settings and registration evidence read-only for viewers", async () => {
  view("viewer");
  expect(screen.getByText(facility.name)).toBeVisible();
  expect(
    screen.queryByRole("button", { name: en.facility.add }),
  ).not.toBeInTheDocument();
  expect(
    screen.queryByRole("button", { name: en.facility.edit }),
  ).not.toBeInTheDocument();
  await userEvent.click(
    screen.getByRole("button", { name: en.facility.registration.title }),
  );
  expect(screen.getByText(registration.reference)).toBeVisible();
  expect(
    screen.getByText(new RegExp(en.facility.registration.superseded)),
  ).toBeVisible();
  expect(
    screen.queryByRole("button", { name: en.facility.registration.add }),
  ).not.toBeInTheDocument();
});
it("requires a capability, then saves both processing capabilities and source row identity", async () => {
  const user = userEvent.setup();
  view();
  await user.click(screen.getByRole("button", { name: en.facility.add }));
  await user.type(screen.getByLabelText(en.facility.name), "Synthetic line");
  await user.type(
    screen.getByLabelText(en.facility.siteReference),
    "Local site only",
  );
  await user.click(screen.getByRole("button", { name: en.lots.save }));
  expect(mocks.save).not.toHaveBeenCalled();
  await user.click(
    screen.getByRole("checkbox", { name: en.facility.processKinds.washing }),
  );
  await user.click(
    screen.getByRole("checkbox", {
      name: en.facility.processKinds.granulating,
    }),
  );
  await user.click(screen.getByRole("button", { name: en.industry.select }));
  const choose = screen
    .getAllByRole("button", { name: en.industry.select })
    .at(-1);
  if (!choose) throw new Error("Missing source selection");
  await user.click(choose);
  await user.click(screen.getByRole("button", { name: en.lots.save }));
  expect(mocks.save).toHaveBeenCalledWith(
    expect.objectContaining({
      name: "Synthetic line",
      sectorId: reference.id,
      capabilities: ["washing", "granulating"],
    }),
  );
});
it("retains facility inputs on a rejected save", async () => {
  mocks.save.mockRejectedValue(new Error("denied"));
  const user = userEvent.setup();
  view();
  await user.click(screen.getByRole("button", { name: en.facility.edit }));
  await user.click(screen.getByRole("button", { name: en.lots.save }));
  expect(await screen.findByRole("alert")).toBeVisible();
  expect(screen.getByLabelText(en.facility.name)).toHaveValue(facility.name);
});

it("retains a national activity after a failed save and clears it explicitly", async () => {
  const activity = {
    code: "011101",
    title: "Growing of wheat",
    sourceVersion: "NIC-2025",
    sourceQuality: "official_reference",
  };
  queries({
    "industryReference:nationalSearch": {
      items: [activity],
      total: 1,
      nextOffset: null,
      sourceVersion: "NIC-2025",
      sourcePublicationUrl: "https://www.mospi.gov.in/reference.pdf",
    },
  });
  mocks.save.mockRejectedValueOnce(new Error("denied"));
  const user = userEvent.setup();
  view();
  await user.click(screen.getByRole("button", { name: en.facility.edit }));
  await user.click(
    screen.getByRole("button", { name: en.industry.chooseActivity }),
  );
  await user.click(
    screen.getByRole("button", { name: `${en.industry.select}: 011101` }),
  );
  await user.click(screen.getByRole("button", { name: en.lots.save }));
  expect(await screen.findByRole("alert")).toBeVisible();
  expect(screen.getByText("011101 · Growing of wheat")).toBeVisible();
  expect(mocks.save).toHaveBeenLastCalledWith(
    expect.objectContaining({ industryActivityCode: "011101" }),
  );
  expect(screen.getByLabelText(en.facility.name)).toHaveValue(facility.name);
  await user.click(
    screen.getByRole("button", { name: en.industry.clearActivity }),
  );
  await user.click(screen.getByRole("button", { name: en.lots.save }));
  expect(mocks.save).toHaveBeenLastCalledWith(
    expect.objectContaining({ industryActivityCode: null }),
  );
});
it("resets reference pagination when search changes and renders source text plainly", async () => {
  const user = userEvent.setup();
  renderWithIntl(<IndustryExplorer />);
  await user.click(screen.getByRole("button", { name: en.industry.next }));
  expect(useQuery).toHaveBeenLastCalledWith(expect.anything(), {
    kind: "sectors",
    search: "",
    offset: 25,
  });
  await user.type(screen.getByRole("searchbox"), "paper");
  expect(useQuery).toHaveBeenLastCalledWith(expect.anything(), {
    kind: "sectors",
    search: "paper",
    offset: 0,
  });
  await user.click(screen.getByRole("button", { name: en.industry.view }));
  expect(screen.getByText("Reported source category")).toHaveAttribute(
    "lang",
    "en",
  );
});
it("validates dates before recording an append-only facility reference", async () => {
  const user = userEvent.setup();
  view("member");
  await user.click(
    screen.getByRole("button", { name: en.facility.registration.title }),
  );
  await user.click(
    screen.getByRole("button", { name: en.facility.registration.add }),
  );
  await user.type(
    screen.getByLabelText(en.facility.registration.reference),
    "LOCAL-NEW",
  );
  fireEvent.change(screen.getByLabelText(en.facility.registration.issuedAt), {
    target: { value: "2026-10-06" },
  });
  fireEvent.change(screen.getByLabelText(en.facility.registration.validUntil), {
    target: { value: "2025-01-01" },
  });
  await user.click(screen.getByRole("button", { name: en.lots.save }));
  expect(mocks.save).not.toHaveBeenCalled();
  fireEvent.change(screen.getByLabelText(en.facility.registration.validUntil), {
    target: { value: "2027-01-01" },
  });
  await user.click(screen.getByRole("button", { name: en.lots.save }));
  expect(mocks.save).toHaveBeenCalledWith(
    expect.objectContaining({
      facilityId: facility._id,
      reference: "LOCAL-NEW",
      issuedAt: "2026-10-06",
      validUntil: "2027-01-01",
    }),
  );
});
