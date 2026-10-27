import { fireEvent, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useAction, useMutation, useQuery } from "convex/react";
import type { ReactNode } from "react";
import { beforeEach, expect, it, vi } from "vitest";

import { useSignedInQuery } from "@/components/providers/use-signed-in-query";
import { renderWithIntl } from "@/components/shop/test-helpers";

import en from "../../../messages/en.json";
import { AuditReports } from "./audit-reports";
import { QualityDocuments } from "./quality-documents";
const mocks = vi.hoisted(() => ({
  write: vi.fn(),
  upload: vi.fn(),
  inspection: "",
}));
vi.mock("next/navigation", () => ({
  useSearchParams: () =>
    new URLSearchParams(
      mocks.inspection ? `inspection=${mocks.inspection}` : "",
    ),
}));
vi.mock("convex/react", () => ({
  useQuery: vi.fn(),
  useMutation: vi.fn(),
  useAction: vi.fn(),
}));
vi.mock("@/components/shop/use-shop", () => ({
  useBusiness: () => ({ id: "org-a" }),
}));
vi.mock("@/components/providers/use-signed-in-query", () => ({
  useSignedInQuery: vi.fn(),
}));
vi.mock("@/i18n/navigation", () => ({
  Link: ({ children }: { children: ReactNode }) => <span>{children}</span>,
}));
vi.mock("@/lib/auth-client", () => ({
  authClient: { convex: { token: vi.fn() } },
}));
const file = {
  id: "file-a",
  inspectionId: "inspection-a",
  name: "test-quality.pdf",
  kind: "coa",
  contentType: "application/pdf",
  size: 300,
  sha256: "a".repeat(64),
  createdAt: 1,
  sharedWithBuyer: true,
};
const board = {
  orgId: "org-a",
  canOperate: true,
  canWithdraw: true,
  inspections: [
    { id: "inspection-a", label: "PET v1", buyerName: "Test buyer" },
  ],
  own: [file],
  incoming: [],
  decisions: [],
};
beforeEach(() => {
  mocks.inspection = "";
  mocks.write.mockReset();
  mocks.upload.mockReset();
  mocks.write.mockResolvedValue("saved");
  mocks.upload.mockResolvedValue("file-new");
  vi.mocked(useMutation).mockReturnValue(
    mocks.write as unknown as ReturnType<typeof useMutation>,
  );
  vi.mocked(useAction).mockReturnValue(mocks.upload);
  vi.mocked(useQuery).mockReturnValue(board);
});
it("lets a viewer read documents but removes all write controls", () => {
  vi.mocked(useQuery).mockReturnValue({
    ...board,
    canOperate: false,
    canWithdraw: false,
  });
  renderWithIntl(<QualityDocuments />);
  expect(
    screen.getByRole("button", { name: en.qualityDocuments.download }),
  ).toBeVisible();
  expect(
    screen.queryByRole("button", { name: en.qualityDocuments.upload }),
  ).not.toBeInTheDocument();
  expect(
    screen.queryByRole("button", { name: en.qualityDocuments.withdraw }),
  ).not.toBeInTheDocument();
});
it("withdraws only the selected document", async () => {
  renderWithIntl(<QualityDocuments />);
  await userEvent.click(
    screen.getByRole("button", { name: en.qualityDocuments.withdraw }),
  );
  expect(mocks.write).toHaveBeenCalledWith({ fileId: "file-a" });
});
it("requires an inspection and file before upload", async () => {
  renderWithIntl(<QualityDocuments />);
  await userEvent.click(
    screen.getByRole("tab", { name: en.qualityDocuments.upload }),
  );
  expect(
    screen.getByRole("button", { name: en.qualityDocuments.upload }),
  ).toBeDisabled();
  expect(screen.getByText(en.qualityDocuments.fileHint)).toBeVisible();
});
it("records a separate buyer decision with the document it reviewed", async () => {
  vi.mocked(useQuery).mockReturnValue({ ...board, own: [], incoming: [file] });
  renderWithIntl(<QualityDocuments />);
  await userEvent.click(
    screen.getByRole("tab", { name: en.qualityDocuments.incoming }),
  );
  fireEvent.change(
    screen.getByRole("textbox", { name: en.qualityDocuments.note }),
    { target: { value: "Resample before acceptance" } },
  );
  await userEvent.click(
    screen.getByRole("button", { name: en.qualityDocuments.record }),
  );
  expect(mocks.write).toHaveBeenCalledWith({
    inspectionId: "inspection-a",
    attachmentIds: ["file-a"],
    decision: "conditional",
    note: "Resample before acceptance",
  });
});
it("retains the buyer reason when the server denies the decision", async () => {
  mocks.write.mockRejectedValue(new Error("DENIED"));
  vi.mocked(useQuery).mockReturnValue({ ...board, own: [], incoming: [file] });
  renderWithIntl(<QualityDocuments />);
  await userEvent.click(
    screen.getByRole("tab", { name: en.qualityDocuments.incoming }),
  );
  fireEvent.change(
    screen.getByRole("textbox", { name: en.qualityDocuments.note }),
    { target: { value: "Measured result" } },
  );
  await userEvent.click(
    screen.getByRole("button", { name: en.qualityDocuments.record }),
  );
  expect(await screen.findByRole("alert")).toBeVisible();
  expect(
    screen.getByRole("textbox", { name: en.qualityDocuments.note }),
  ).toHaveValue("Measured result");
});
it("does not offer report creation to a recipient", () => {
  vi.mocked(useSignedInQuery).mockReturnValue({
    canCreate: false,
    orgId: null,
    own: [],
    received: [],
    recipients: [],
    inspections: [],
    files: [],
  });
  renderWithIntl(<AuditReports />);
  expect(
    screen.queryByRole("button", { name: en.auditReports.create }),
  ).not.toBeInTheDocument();
  expect(
    screen.getByRole("heading", { name: en.auditReports.received }),
  ).toBeVisible();
});
it("does not offer access to an expired report", () => {
  vi.mocked(useSignedInQuery).mockReturnValue({
    canCreate: false,
    orgId: null,
    own: [],
    received: [
      { id: "report-a", purpose: "Review", createdAt: 1, expiresAt: 2 },
    ],
    recipients: [],
    inspections: [],
    files: [],
  });
  renderWithIntl(<AuditReports />);
  expect(
    screen.queryByRole("button", { name: en.auditReports.open }),
  ).not.toBeInTheDocument();
  expect(screen.getByText(en.auditReports.unavailable)).toBeVisible();
});

it("keeps a report draft when switching tasks and shows sharing warnings before creation", async () => {
  vi.mocked(useSignedInQuery).mockReturnValue({
    canCreate: true,
    orgId: "org-a",
    own: [],
    received: [],
    recipients: [],
    inspections: [],
    files: [],
  });
  renderWithIntl(<AuditReports />);
  expect(
    screen.queryByRole("textbox", { name: en.auditReports.purpose }),
  ).not.toBeInTheDocument();
  await userEvent.click(
    screen.getByRole("tab", { name: en.auditReports.create }),
  );
  await userEvent.type(
    screen.getByRole("textbox", { name: en.auditReports.purpose }),
    "Review batch quality",
  );
  expect(screen.getByText(en.auditReports.warning)).toBeVisible();
  await userEvent.click(
    screen.getByRole("tab", { name: en.auditReports.received }),
  );
  await userEvent.click(
    screen.getByRole("tab", { name: en.auditReports.create }),
  );
  expect(
    screen.getByRole("textbox", { name: en.auditReports.purpose }),
  ).toHaveValue("Review batch quality");
  expect(mocks.write).not.toHaveBeenCalled();
});

it("opens upload with the permitted inspection selected from its lot", () => {
  mocks.inspection = "inspection-a";
  renderWithIntl(<QualityDocuments />);
  expect(
    screen.getByRole("tab", { name: en.qualityDocuments.upload }),
  ).toHaveAttribute("aria-selected", "true");
  expect(
    screen.getByRole("combobox", { name: en.qualityDocuments.inspection }),
  ).toHaveTextContent("PET v1");
});
it("ignores an inspection link outside the permitted board", () => {
  mocks.inspection = "other-org-inspection";
  renderWithIntl(<QualityDocuments />);
  expect(
    screen.getByRole("tab", { name: en.qualityDocuments.own }),
  ).toHaveAttribute("aria-selected", "true");
});
